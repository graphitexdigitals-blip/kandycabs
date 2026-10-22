import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { customerApiClient, customerTokenStorage, formatDisplayPhone } from '../lib/api';
import { customerRealtimeTracker } from '../lib/realtime-client';
import { reviewManager } from '../lib/reviewManager';
import { BookingStatus, TripType } from '@kandy-cabs/shared';
import { TaxInvoiceModal } from '../components/TaxInvoiceModal';
import { CustomerBottomDock } from '../components/CustomerBottomDock';
import { AuthModal } from '../components/AuthModal';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Rides', icon: 'car' },
  { id: 'ACTIVE', label: 'Active', icon: 'time-outline' },
  { id: 'COMPLETED', label: 'Completed', icon: 'checkmark-circle-outline' },
  { id: 'CANCELLED', label: 'Cancelled', icon: 'close-circle-outline' },
] as const;

export default function MyBookingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const [user, setUser] = useState<any | null>(customerTokenStorage.getUser());
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(customerTokenStorage.getToken()));
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [proximityAlerts, setProximityAlerts] = useState<
    Record<string, { isNear?: boolean; isArrived?: boolean; message?: string; distanceMeters?: number; pickupOtp?: string }>
  >({});

  // Load User & Bookings
  const loadData = useCallback(async (isSilent = false, filterOverride?: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED') => {
    const token = customerTokenStorage.getToken();
    if (!token) {
      setUser(null);
      setBookings([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!isSilent) setLoading(true);
    try {
      // 1. User Profile
      try {
        const meRes = await customerApiClient.fetch('/api/auth/me');
        if (meRes?.user) {
          setUser(meRes.user);
          customerTokenStorage.setUser(meRes.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(customerTokenStorage.getUser());
      }

      // 2. Bookings
      const currentCategory = filterOverride || activeFilter;
      const res = await customerApiClient.fetch(`/api/customer/bookings/list?category=${currentCategory}`);
      if (res && res.bookings) {
        setBookings(res.bookings);

        // Pre-hydrate proximity status from server tripEvents if available
        const alertsUpdate: Record<string, any> = {};
        res.bookings.forEach((b: any) => {
          if (b.tripEvents && Array.isArray(b.tripEvents)) {
            const hasArrived = b.tripEvents.some((e: any) => e.type === 'DRIVER_ARRIVED');
            const hasNear = b.tripEvents.some((e: any) => e.type === 'DRIVER_NEAR_PICKUP');
            if (hasArrived || hasNear) {
              alertsUpdate[b.id] = {
                isNear: hasNear || hasArrived,
                isArrived: hasArrived,
                pickupOtp: b.pickupOtp,
                message: hasArrived
                  ? `🔐 Your pickup OTP is ${b.pickupOtp}. Share with your driver.`
                  : '🚕 Your driver is approaching your pickup point.',
              };
            }
          }
        });
        if (Object.keys(alertsUpdate).length > 0) {
          setProximityAlerts((prev) => ({ ...prev, ...alertsUpdate }));
        }

        // Check if there is an active ride to track live via SSE
        const activeRide = res.bookings.find(
          (b: any) =>
            b.status === BookingStatus.DRIVER_ACCEPTED ||
            b.status === BookingStatus.DRIVER_EN_ROUTE ||
            b.status === BookingStatus.TRIP_STARTED
        );
        if (activeRide) {
          customerRealtimeTracker.trackBooking(activeRide.id);
        }

        // Auto-prompt rating review modal if there is an unrated completed trip
        const unreviewedCompleted = res.bookings.find(
          (b: any) =>
            b.status === BookingStatus.TRIP_COMPLETED &&
            !b.customerRating &&
            !reviewManager.isDismissed(b.id)
        );
        if (unreviewedCompleted) {
          reviewManager.showReview(unreviewedCompleted);
        }
      } else {
        setBookings([]);
      }
    } catch (err: any) {
      if (err.status === 401) {
        customerTokenStorage.removeToken();
        setUser(null);
        setBookings([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadData();

    // Subscribe to token & user state changes across the app
    const unsubAuth = customerTokenStorage.subscribe(() => {
      const u = customerTokenStorage.getUser();
      setUser(u);
      if (!u) {
        setBookings([]);
        setLoading(false);
      } else {
        loadData(true);
      }
    });

    // Listen for live booking status transitions
    const unsubStatus = customerRealtimeTracker.on('BOOKING_STATUS', (payload: any) => {
      loadData(true);
      const bId = payload?.id || payload?.bookingId;
      if (
        payload?.status === BookingStatus.TRIP_COMPLETED &&
        bId &&
        !reviewManager.isDismissed(bId)
      ) {
        reviewManager.showReview(payload);
      }
    });

    // Listen for proximity stage 1: Driver Near Pickup (~100m)
    const unsubNear = customerRealtimeTracker.on('DRIVER_NEAR_PICKUP', (data: any) => {
      if (data?.bookingId) {
        setProximityAlerts((prev) => ({
          ...prev,
          [data.bookingId]: {
            ...prev[data.bookingId],
            isNear: true,
            message: data.message || '🚕 Your driver is nearby. Please be ready.',
            distanceMeters: data.distanceMeters,
          },
        }));
      }
    });

    // Listen for proximity stage 2: Driver Arrived (~30-50m) & Reveal OTP
    const unsubArrived = customerRealtimeTracker.on('DRIVER_ARRIVED', (data: any) => {
      if (data?.bookingId) {
        setProximityAlerts((prev) => ({
          ...prev,
          [data.bookingId]: {
            ...prev[data.bookingId],
            isNear: true,
            isArrived: true,
            message: data.message || `🔐 Your pickup OTP is ${data.pickupOtp}. Give this to your driver.`,
            pickupOtp: data.pickupOtp,
            distanceMeters: data.distanceMeters,
          },
        }));
        Alert.alert(
          '🚕 Driver Has Arrived!',
          `Your driver has reached the pickup location.\n\n🔐 Your Pickup OTP is: ${data.pickupOtp || '----'}\n\nPlease share this OTP with your driver to begin your journey.`,
          [{ text: 'Got It', style: 'default' }]
        );
      }
    });

    // Subscribe to rating submissions from global review modal
    const unsubSubmission = reviewManager.onSubmission((ratingData) => {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === ratingData.bookingId
            ? {
                ...b,
                customerRating: {
                  ...ratingData,
                  rating: ratingData.driverRating || ratingData.rating,
                  driverRating: ratingData.driverRating || ratingData.rating,
                  driverFeedbackTags: ratingData.driverFeedbackTags || ratingData.feedbackTags || [],
                  kandyRating: ratingData.kandyRating || 5,
                  kandyFeedbackTags: ratingData.kandyFeedbackTags || [],
                  comment: ratingData.comment,
                  ratedAt: new Date().toISOString(),
                },
              }
            : b
        )
      );
    });

    // Gentle 60s background sync
    const interval = setInterval(() => {
      if (customerTokenStorage.getToken()) {
        loadData(true);
      }
    }, 60000);

    return () => {
      unsubAuth();
      unsubStatus();
      unsubNear();
      unsubArrived();
      unsubSubmission();
      clearInterval(interval);
      customerRealtimeTracker.stop();
    };
  }, [loadData]);

  const handleCancelBooking = (bookingId: string, ref: string) => {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel booking ${ref}?`,
      [
        { text: 'No, Keep Booking', style: 'cancel' },
        {
          text: 'Yes, Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(bookingId);
            try {
              const res = await customerApiClient.fetch('/api/customer/cancel-booking', {
                method: 'POST',
                body: JSON.stringify({ bookingId, reason: 'Customer cancelled from mobile app' }),
              });
              if (res.success) {
                Alert.alert('Booking Cancelled', `Ride ${ref} has been cancelled.`);
                loadData();
              } else {
                Alert.alert('Notice', res.message || 'Cannot cancel booking at this time.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel booking.');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.PENDING_ADMIN:
        return { label: 'Pending Dispatch', bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      case BookingStatus.DISPATCHED:
        return { label: 'Finding Driver', bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' };
      case BookingStatus.DRIVER_ACCEPTED:
        return { label: 'Driver Assigned', bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' };
      case BookingStatus.DRIVER_EN_ROUTE:
        return { label: 'Driver En Route', bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
      case BookingStatus.TRIP_STARTED:
        return { label: 'Trip in Progress', bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' };
      case BookingStatus.TRIP_COMPLETED:
        return { label: 'Completed', bg: '#dcfce7', text: '#166534', border: '#bbf7d0' };
      case BookingStatus.CANCELLED:
        return { label: 'Cancelled', bg: '#fee2e2', text: '#991b1b', border: '#fecaca' };
      default:
        return { label: status, bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' };
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={true} />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#103A75" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>My Bookings</Text>
          <Text style={styles.headerSub}>
            {user ? `${user.fullName || 'Customer'} • ${formatDisplayPhone(user.phone)}` : 'Sign in to view your rides'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newRideBtn}
          onPress={() => router.push('/select-trip-type')}
        >
          <Text style={styles.newRideBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Customer Profile Summary Card (Only if logged in) */}
      {user && (
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.8}
          onPress={() => router.push('/profile')}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName}>{user.fullName || 'Valued Customer'}</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
              </View>
            </View>
            <View style={styles.profilePhoneRow}>
              <Ionicons name="call" size={12} color="#0f172a" style={{ marginRight: 4 }} />
              <Text style={styles.profilePhone}>{formatDisplayPhone(user.phone)}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </TouchableOpacity>
      )}

      {/* If logged out: Show clean Sign In state */}
      {!user && !loading ? (
        <View style={styles.guestContainer}>
          <View style={styles.guestAvatar}>
            <Ionicons name="receipt-outline" size={44} color="#ea580c" />
          </View>
          <Text style={styles.guestTitle}>Sign In to View Your Bookings</Text>
          <Text style={styles.guestSubtitle}>
            Log in with your mobile number to view active rides, driver assignments, trip history, and download tax invoices.
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => setIsAuthModalOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.signInButtonText}>Sign In / Register</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Filter Tabs */}
          <View style={styles.filterTabsContainer}>
            {STATUS_FILTERS.map((item) => {
              const isActive = activeFilter === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.filterTab,
                    isActive && styles.filterTabActive,
                  ]}
                  onPress={() => {
                    setActiveFilter(item.id);
                    loadData(false, item.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={13}
                    color={isActive ? '#ffffff' : '#64748b'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.filterTabText,
                      isActive && styles.filterTabTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bookings List */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadData();
                }}
                tintColor="#ea580c"
              />
            }
          >
        {loading && bookings.length === 0 ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#ea580c" />
            <Text style={styles.loadingText}>Loading your bookings...</Text>
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🚕</Text>
            <Text style={styles.emptyTitle}>No bookings found</Text>
            <Text style={styles.emptySub}>
              {activeFilter === 'ACTIVE'
                ? 'You do not have any active rides right now.'
                : 'Ready for your next journey? Book a clean AC cab in seconds!'}
            </Text>
            <TouchableOpacity
              style={styles.bookNowBtn}
              onPress={() => router.push('/')}
            >
              <Text style={styles.bookNowBtnText}>Book a Cab Now ➔</Text>
            </TouchableOpacity>
          </View>
        ) : (
          bookings.map((booking) => {
            const badge = getStatusBadge(booking.status);
            const totalFare = Number(booking.estimatedFare || 0);
            const advancePaid = Number(booking.advanceAmount || 0);
            const balanceDue = Number(booking.balanceAmount || totalFare - advancePaid);
            const isBalancePending = booking.balancePaymentStatus === 'PENDING';

            const driver = booking.assignedDriver;
            const vehicle = booking.vehicle || driver?.vehicles?.[0];

            return (
              <View key={booking.id} style={styles.card}>
                {/* 1. Header: Ref, Status, Scheduled Date */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.refRow}>
                      <Text style={styles.refText}>{booking.humanReadableRef}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: badge.bg, borderColor: badge.border },
                        ]}
                      >
                        <Text style={[styles.statusPillText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.scheduledRow}>
                      <Ionicons name="calendar-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
                      <Text style={styles.scheduledText} numberOfLines={1}>
                        Scheduled: <Text style={styles.scheduledBold}>
                          {new Date(booking.scheduledAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </Text>
                    </View>
                  </View>

                  <View style={styles.fareHeaderBlock}>
                    <Text style={styles.fareTotalAmount} numberOfLines={1} adjustsFontSizeToFit>
                      ₹{totalFare.toFixed(2)}
                    </Text>
                    <Text style={styles.advancePaidTag} numberOfLines={1}>
                      Adv: ₹{advancePaid.toFixed(2)} ({Math.round((advancePaid / (totalFare || 1)) * 100)}%)
                    </Text>
                  </View>
                </View>

                {/* 2. Trip Route Details (Clean Timeline Node Track) */}
                <View style={styles.routeContainer}>
                  <View style={styles.routeContentRow}>
                    {/* Left: Timeline Tracker */}
                    <View style={styles.timelineTrack}>
                      <View style={styles.greenNodeDot} />
                      <View style={styles.timelineConnector} />
                      <View style={styles.redNodeDot} />
                    </View>

                    {/* Middle & Right: Pickup Row with KM Badge, and Drop Destination */}
                    <View style={styles.routePointsCol}>
                      {/* Pickup Row with KM Badge on Right */}
                      <View style={styles.pickupRow}>
                        <View style={styles.pickupBlock}>
                          <Text style={styles.routeNodeLabel}>Pickup Location</Text>
                          <Text style={styles.routeAddressText} numberOfLines={1}>
                            {booking.status === BookingStatus.TRIP_STARTED || booking.status === BookingStatus.TRIP_COMPLETED
                              ? (booking.actualPickupAddress || booking.pickupAddress)
                              : booking.pickupAddress}
                          </Text>
                        </View>

                        {/* Right: Distance & Trip Type Pill */}
                        <View style={styles.distanceBadgePill}>
                          <View style={styles.distanceTopRow}>
                            <Ionicons name="speedometer-outline" size={11} color="#2563eb" style={{ marginRight: 3 }} />
                            <Text style={styles.distanceBadgeText}>
                              {booking.distanceKm ? `~${booking.distanceKm} km` : '~50 km'}
                            </Text>
                          </View>
                          <Text style={styles.tripTypeSubText}>
                            {booking.tripType === TripType.ONEWAY
                              ? 'One Way'
                              : booking.tripType === TripType.ROUND
                              ? 'Round Trip'
                              : booking.tripType === TripType.AIRPORT
                              ? 'Airport'
                              : booking.tripType === TripType.LOCAL
                              ? 'Hourly Local'
                              : 'Standard'}
                          </Text>
                        </View>
                      </View>

                      {/* Drop */}
                      <View style={styles.dropBlock}>
                        <Text style={styles.routeNodeLabel}>Drop Destination</Text>
                        <Text style={styles.routeAddressText} numberOfLines={1}>
                          {booking.status === BookingStatus.TRIP_COMPLETED
                            ? (booking.actualDropAddress || booking.dropAddress)
                            : booking.dropAddress}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 3. Geofenced Proximity & Arrival OTP Banner */}
                {proximityAlerts[booking.id]?.isArrived ? (
                  <View style={styles.arrivedAlertBanner}>
                    <View style={styles.arrivedHeaderRow}>
                      <View style={styles.pulseDotGreen} />
                      <Text style={styles.arrivedBadgeText}>🚕 DRIVER HAS ARRIVED AT PICKUP</Text>
                    </View>
                    <Text style={styles.arrivedAlertMessage}>
                      Your driver has reached your pickup location. Give the OTP below to start the ride.
                    </Text>
                    <View style={styles.revealedOtpCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.revealedOtpLabel}>🔐 YOUR PICKUP OTP</Text>
                        <Text style={styles.revealedOtpSub}>Share this 4-digit code with your driver</Text>
                      </View>
                      <View style={styles.revealedOtpPill}>
                        <Text style={styles.revealedOtpCode}>
                          {proximityAlerts[booking.id]?.pickupOtp || booking.pickupOtp}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : proximityAlerts[booking.id]?.isNear ? (
                  <View style={styles.nearAlertBanner}>
                    <Text style={styles.nearAlertEmoji}>🚕</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nearAlertTitle}>Your driver is nearby (~100m)</Text>
                      <Text style={styles.nearAlertSub}>Please be ready at your pickup location. Ride starting soon.</Text>
                    </View>
                  </View>
                ) : (
                  booking.pickupOtp &&
                  booking.status !== BookingStatus.TRIP_COMPLETED &&
                  booking.status !== BookingStatus.CANCELLED && (
                    <View style={styles.otpBox}>
                      <View style={styles.otpIconCircle}>
                        <Ionicons name="pricetag" size={13} color="#ea580c" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.otpLabel}>Pickup OTP</Text>
                        <Text style={styles.otpSub}>
                          Share this 4-digit code with your driver at pickup only to start the ride.
                        </Text>
                      </View>
                      <View style={styles.otpPill}>
                        <Text style={styles.otpPillText}>{booking.pickupOtp}</Text>
                      </View>
                    </View>
                  )
                )}

                {/* 4. Driver & Vehicle Card */}
                <View style={styles.driverBox}>
                  {driver ? (
                    <View style={styles.driverInfoRow}>
                      <View style={styles.driverCarCircle}>
                        <Ionicons name="car" size={16} color="#0284c7" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={styles.driverHeaderRow}>
                          <Text style={styles.driverBoxSubtitle}>Driver & Vehicle</Text>
                          {/* Driver Overall Rating Badge */}
                          <View style={styles.driverRatingPill}>
                            <Ionicons name="star" size={10} color="#f59e0b" />
                            <Text style={styles.driverRatingPillText}>
                              {booking.driverRating ? Number(booking.driverRating).toFixed(1) : '4.9'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.driverName}>
                          {driver.user?.fullName || 'Assigned Driver'}
                        </Text>
                        <Text style={styles.driverVehicle}>
                          {vehicle?.category || booking.category || 'Sedan'} • {vehicle?.plateNumber || 'Verified Vehicle'}
                        </Text>
                      </View>
                      {driver.user?.phone &&
                        booking.status !== BookingStatus.TRIP_COMPLETED &&
                        booking.status !== BookingStatus.CANCELLED && (
                        <TouchableOpacity
                          style={styles.driverCallBtn}
                          onPress={() => Linking.openURL(`tel:${driver.user.phone}`)}
                        >
                          <Ionicons name="call" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                          <Text style={styles.driverCallBtnText}>Call</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={styles.unassignedRow}>
                      <View style={styles.driverUserCircle}>
                        <Ionicons name="person" size={15} color="#64748b" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.unassignedTitle}>Driver & Vehicle</Text>
                        <Text style={styles.unassignedText}>
                          Dispatching to closest driver... Waiting for driver assignment
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
                    </View>
                  )}
                </View>

                {/* 5. Payment & Invoice Breakdown */}
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>
                    Balance Due on Trip: <Text style={styles.paymentBold}>₹{balanceDue.toFixed(2)}</Text>
                  </Text>
                  <View style={[styles.statusBadgePill, isBalancePending ? styles.badgePending : styles.badgePaid]}>
                    <Text style={[styles.statusBadgePillText, isBalancePending ? styles.badgePendingText : styles.badgePaidText]}>
                      {isBalancePending ? 'PENDING' : 'PAID'}
                    </Text>
                  </View>
                </View>

                {/* Customer Submitted Rating Badge (if completed and rated) */}
                {booking.customerRating && (
                  <View style={styles.tripRatedSummaryRow}>
                    <View style={styles.tripRatedStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= Number(booking.customerRating.driverRating || booking.customerRating.rating) ? 'star' : 'star-outline'}
                          size={12}
                          color="#f59e0b"
                        />
                      ))}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tripRatedText} numberOfLines={1}>
                        Driver: {booking.customerRating.driverRating || booking.customerRating.rating}★ • KandyCabs: {booking.customerRating.kandyRating || 5}★
                      </Text>
                      {booking.customerRating.comment ? (
                        <Text style={styles.tripRatedCommentText} numberOfLines={1}>
                          "{booking.customerRating.comment}"
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )}

                {/* 6. Action Buttons */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.invoiceBtn}
                    onPress={() => setSelectedInvoiceId(booking.id)}
                  >
                    <Ionicons name="document-text-outline" size={14} color="#334155" />
                    <Text style={styles.invoiceBtnText}>View Tax Invoice</Text>
                  </TouchableOpacity>

                  {/* Driver & Trip Rating Button for Completed Trips */}
                  {booking.status === BookingStatus.TRIP_COMPLETED && (
                    <TouchableOpacity
                      style={[
                        styles.rateDriverBtn,
                        booking.customerRating && styles.rateDriverBtnRated,
                      ]}
                      onPress={() => reviewManager.forceShowReview(booking)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="star"
                        size={13}
                        color={booking.customerRating ? '#b45309' : '#ea580c'}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.rateDriverBtnText,
                          booking.customerRating && styles.rateDriverBtnRatedText,
                        ]}
                      >
                        {booking.customerRating
                          ? `Rated ${booking.customerRating.driverRating || booking.customerRating.rating}★ (Review)`
                          : 'Rate Trip & Driver'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {booking.status !== BookingStatus.TRIP_COMPLETED &&
                    booking.status !== BookingStatus.CANCELLED &&
                    booking.status !== BookingStatus.TRIP_STARTED && (
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => handleCancelBooking(booking.id, booking.humanReadableRef)}
                        disabled={cancellingId === booking.id}
                      >
                        <Ionicons name="close-circle" size={14} color="#dc2626" />
                        <Text style={styles.cancelBtnText}>
                          {cancellingId === booking.id ? 'Cancelling...' : 'Cancel Ride'}
                        </Text>
                      </TouchableOpacity>
                    )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      </>
      )}

      {/* Persistent Bottom Navigation Dock */}
      <CustomerBottomDock
        activeTab="BOOKINGS"
        onPressProfile={() => {
          if (user) {
            router.push('/profile');
          } else {
            setIsAuthModalOpen(true);
          }
        }}
      />

      {/* Tax Invoice Modal */}
      {selectedInvoiceId && (
        <TaxInvoiceModal
          bookingId={selectedInvoiceId}
          isOpen={!!selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
        />
      )}



      {/* Auth Modal */}
      <AuthModal
        visible={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          setIsAuthModalOpen(false);
          loadData(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#103A75',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  newRideBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  newRideBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#103A75',
  },
  verifiedBadge: {
    marginLeft: 8,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '700',
  },
  profilePhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  profilePhone: {
    fontSize: 12,
    color: '#64748b',
  },
  filterTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#e2e8f0',
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  filterTabActive: {
    backgroundColor: '#103A75',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  filterTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 110,
  },
  centerBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 16,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#103A75',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  bookNowBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  bookNowBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 11,
    marginBottom: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 7,
    gap: 6,
  },
  cardHeaderLeft: {
    flex: 1,
    paddingRight: 4,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  refText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#103A75',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  scheduledText: {
    fontSize: 10.5,
    color: '#64748b',
  },
  scheduledBold: {
    color: '#334155',
    fontWeight: '700',
  },
  fareHeaderBlock: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    maxWidth: 130,
  },
  fareTotalAmount: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#103A75',
    textAlign: 'right',
  },
  advancePaidTag: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#16a34a',
    marginTop: 2,
    textAlign: 'right',
  },
  routeContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 7,
    marginTop: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  routeContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineTrack: {
    width: 12,
    alignItems: 'center',
    marginRight: 6,
    paddingTop: 3,
  },
  greenNodeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16a34a',
  },
  timelineConnector: {
    width: 2,
    height: 22,
    backgroundColor: '#cbd5e1',
    marginVertical: 2,
  },
  redNodeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#dc2626',
  },
  routePointsCol: {
    flex: 1,
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pickupBlock: {
    flex: 1,
    marginRight: 6,
  },
  dropBlock: {
    marginTop: 4,
  },
  routeNodeLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  routeAddressText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#103A75',
    marginTop: 1,
  },
  distanceBadgePill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  distanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  tripTypeSubText: {
    fontSize: 8.5,
    color: '#3b82f6',
    fontWeight: '700',
    marginTop: 0.5,
  },
  otpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffaf5',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    padding: 7,
    marginTop: 7,
  },
  otpIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  otpLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#9a3412',
  },
  otpSub: {
    fontSize: 9,
    color: '#c2410c',
    marginTop: 0.5,
    lineHeight: 12,
  },
  otpPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ea580c',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    marginLeft: 6,
  },
  otpPillText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ea580c',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  nearAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderRadius: 12,
    padding: 10,
    marginTop: 9,
    gap: 8,
  },
  nearAlertEmoji: {
    fontSize: 22,
  },
  nearAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  nearAlertSub: {
    fontSize: 10.5,
    color: '#92400e',
    marginTop: 1,
  },
  arrivedAlertBanner: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 14,
    padding: 12,
    marginTop: 9,
  },
  arrivedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pulseDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  arrivedBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.5,
  },
  arrivedAlertMessage: {
    fontSize: 11,
    color: '#065f46',
    marginBottom: 8,
  },
  revealedOtpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#059669',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  revealedOtpLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#065f46',
  },
  revealedOtpSub: {
    fontSize: 9.5,
    color: '#047857',
    marginTop: 1,
  },
  revealedOtpPill: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
  },
  revealedOtpCode: {
    fontSize: 18,
    fontWeight: '900',
    color: '#065f46',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  driverBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    marginTop: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverCarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  driverUserCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  driverHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  driverRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 5.5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  driverRatingPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
  },
  driverBoxSubtitle: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  driverName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#103A75',
  },
  driverVehicle: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  driverCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  driverCallBtnText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
  },
  unassignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unassignedTitle: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  unassignedText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  paymentLabel: {
    fontSize: 11.5,
    color: '#475569',
  },
  paymentBold: {
    fontWeight: '800',
    color: '#103A75',
  },
  statusBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgePending: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  badgePaid: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  statusBadgePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgePendingText: {
    color: '#dc2626',
  },
  badgePaidText: {
    color: '#166534',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  invoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  invoiceBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#334155',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  cancelBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#dc2626',
  },
  rateDriverBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  rateDriverBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ea580c',
  },
  rateDriverBtnRated: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  rateDriverBtnRatedText: {
    color: '#b45309',
  },
  tripRatedSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    marginTop: 6,
  },
  tripRatedStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
  },
  tripRatedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#92400e',
    flex: 1,
  },
  tripRatedCommentText: {
    fontSize: 9.5,
    fontStyle: 'italic',
    color: '#78350f',
    marginTop: 1,
  },
  guestContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginTop: 20,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  guestAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#103A75',
    marginBottom: 8,
  },
  guestSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ea580c',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: '100%',
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
