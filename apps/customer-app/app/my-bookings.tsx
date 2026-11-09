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
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { customerApiClient, customerTokenStorage, formatDisplayPhone } from '../lib/api';
import { customerRealtimeTracker } from '../lib/realtime-client';
import { reviewManager } from '../lib/reviewManager';
import { BookingStatus, TripType } from '@kandy-cabs/shared';
import { TaxInvoiceModal } from '../components/TaxInvoiceModal';
import { CustomerBottomDock } from '../components/CustomerBottomDock';
import { AuthModal } from '../components/AuthModal';
import { formatTitleCase } from '../constants/typography';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Rides', icon: 'car' },
  { id: 'ACTIVE', label: 'Active', icon: 'time-outline' },
  { id: 'COMPLETED', label: 'Completed', icon: 'checkmark-circle-outline' },
  { id: 'CANCELLED', label: 'Cancelled', icon: 'close-circle-outline' },
] as const;

function parseViaStops(booking: any): string[] {
  if (!booking) return [];
  if (Array.isArray(booking.viaStops) && booking.viaStops.length > 0) {
    return booking.viaStops
      .map((s: any) => (typeof s === 'string' ? s : (s?.label || s?.address || s?.name || '')))
      .filter((s: string) => s && s.trim().length > 0);
  }
  if (Array.isArray(booking.stops) && booking.stops.length > 0) {
    return booking.stops
      .map((s: any) => (typeof s === 'string' ? s : (s?.label || s?.address || s?.name || '')))
      .filter((s: string) => s && s.trim().length > 0);
  }
  const texts = [booking.specialRequirements, booking.notes].filter(Boolean);
  if (Array.isArray(booking.tripEvents)) {
    for (const evt of booking.tripEvents) {
      try {
        const payload = typeof evt.payloadJson === 'string' ? JSON.parse(evt.payloadJson || '{}') : evt.payloadJson;
        if (payload) {
          if (Array.isArray(payload.viaStops) && payload.viaStops.length > 0) {
            return payload.viaStops
              .map((s: any) => (typeof s === 'string' ? s : (s?.label || s?.address || s?.name || '')))
              .filter((s: string) => s && s.trim().length > 0);
          }
          if (payload.specialRequirements) texts.push(payload.specialRequirements);
          if (payload.notes) texts.push(payload.notes);
        }
      } catch (_) {}
    }
  }
  for (const t of texts) {
    const match = String(t).match(/(?:Intermediate Stops|Via Stops(?:\s*\(\d+\))?|Via)\s*:\s*([^|;\n]+)/i);
    if (match && match[1]) {
      const parts = match[1].includes('➔')
        ? match[1].split('➔')
        : match[1].includes('->')
        ? match[1].split('->')
        : match[1].split(',');
      const result = parts.map((p) => p.trim()).filter(Boolean);
      if (result.length > 0) return result;
    }
  }
  return [];
}

export default function MyBookingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const [user, setUser] = useState<any | null>(customerTokenStorage.getUser());
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(() => Boolean(customerTokenStorage.getToken()));
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
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
          const isPreTrip =
            b.status === BookingStatus.DRIVER_ACCEPTED ||
            b.status === BookingStatus.DRIVER_EN_ROUTE;

          if (isPreTrip && b.tripEvents && Array.isArray(b.tripEvents)) {
            const hasArrived = b.tripEvents.some((e: any) => e.type === 'DRIVER_ARRIVED');
            const hasNear = b.tripEvents.some((e: any) => e.type === 'DRIVER_NEAR_PICKUP');
            if (hasArrived || hasNear) {
              alertsUpdate[b.id] = {
                isNear: hasNear || hasArrived,
                isArrived: hasArrived,
                pickupOtp: b.pickupOtp,
                message: hasArrived
                  ? `Your pickup OTP is ${b.pickupOtp}. Share with your driver.`
                  : 'Your driver is approaching your pickup point.',
              };
            }
          }
        });
        setProximityAlerts(alertsUpdate);

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
        payload?.status === BookingStatus.TRIP_STARTED ||
        payload?.status === BookingStatus.TRIP_COMPLETED ||
        payload?.status === BookingStatus.CANCELLED
      ) {
        if (bId) {
          setProximityAlerts((prev) => {
            const next = { ...prev };
            delete next[bId];
            return next;
          });
        }
      }
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
            message: data.message || 'Your driver is nearby. Please be ready.',
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
            message: data.message || `Your pickup OTP is ${data.pickupOtp}. Give this to your driver.`,
            pickupOtp: data.pickupOtp,
            distanceMeters: data.distanceMeters,
          },
        }));
        Alert.alert(
          'Driver Has Arrived!',
          `Your driver has reached the pickup location.\n\nYour Pickup OTP is: ${data.pickupOtp || '----'}\n\nPlease share this OTP with your driver to begin your journey.`,
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
      t('myBookings.cancelConfirmTitle', { defaultValue: 'Cancel Ride' }),
      `${t('myBookings.cancelConfirmMsg', { defaultValue: 'Are you sure you want to cancel booking Ref:' })} ${ref}?`,
      [
        { text: t('myBookings.keepBooking', { defaultValue: 'No, Keep Booking' }), style: 'cancel' },
        {
          text: t('myBookings.yesCancel', { defaultValue: 'Yes, Cancel Ride' }),
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

  const handlePayAdvance = async (booking: any) => {
    Alert.alert(
      'Pay Advance',
      `Complete advance payment of ₹${Number(booking.advanceAmount).toLocaleString('en-IN')} for ${booking.humanReadableRef}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now (Instant)',
          onPress: async () => {
            setPayingBookingId(booking.id);
            try {
              const res = await customerApiClient.fetch(`/api/customer/bookings/${booking.id}/pay-advance`, {
                method: 'POST',
                body: JSON.stringify({
                  paymentMethod: 'UPI',
                }),
              });
              if (res && res.success) {
                Alert.alert('Payment Successful!', `Advance of ₹${Number(booking.advanceAmount).toLocaleString('en-IN')} received. Your ride is confirmed and being dispatched!`);
                loadData(true);
              } else {
                Alert.alert('Payment Failed', res?.message || 'Could not complete payment.');
              }
            } catch (err: any) {
              Alert.alert('Payment Error', err.message || 'Network error');
            } finally {
              setPayingBookingId(null);
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: BookingStatus, b?: any) => {
    const isFleetApproval = b?.tripEvents?.some((e: any) =>
      e.type === 'FLEET_APPROVAL_REQUESTED' ||
      e.payloadJson?.requiresFleetApproval ||
      e.payloadJson?.category === 'TEMPO_TRAVELER' ||
      e.payloadJson?.category === 'URBANIA'
    );
    const isFleetApproved = b?.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED');
    const isAdvancePending = b?.advancePaymentStatus === 'PENDING' && Number(b?.advanceAmount) > 0;

    if (isFleetApproval && !isFleetApproved && status === BookingStatus.PENDING_ADMIN) {
      return {
        label: t('myBookings.status.checkingFleet', { defaultValue: 'Checking Fleet Availability' }),
        bg: '#fef3c7',
        text: '#92400e',
        border: '#fde68a',
        icon: 'hourglass-outline'
      };
    }

    if (isFleetApproval && isFleetApproved && isAdvancePending) {
      return {
        label: t('myBookings.status.fleetApprovedPay', { defaultValue: 'Fleet Approved • Ready to Pay' }),
        bg: '#dcfce7',
        text: '#15803d',
        border: '#bbf7d0',
        icon: 'checkmark-circle'
      };
    }

    switch (status) {
      case BookingStatus.PENDING_ADMIN:
        return { label: t('myBookings.status.pendingDispatch', { defaultValue: 'Pending Dispatch' }), bg: '#fef3c7', text: '#92400e', border: '#fde68a', icon: 'time-outline' };
      case BookingStatus.DISPATCHED:
        return { label: t('myBookings.status.findingDriver', { defaultValue: 'Finding Driver' }), bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe', icon: 'search-outline' };
      case BookingStatus.DRIVER_ACCEPTED:
        return { label: t('myBookings.status.driverAssigned', { defaultValue: 'Driver Assigned' }), bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe', icon: 'person-outline' };
      case BookingStatus.DRIVER_EN_ROUTE:
        return { label: t('myBookings.status.driverEnRoute', { defaultValue: 'Driver En Route' }), bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd', icon: 'car-outline' };
      case BookingStatus.TRIP_STARTED:
        return { label: t('myBookings.status.tripInProgress', { defaultValue: 'Trip in Progress' }), bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff', icon: 'navigate-outline' };
      case BookingStatus.TRIP_COMPLETED:
        return { label: t('myBookings.status.completed', { defaultValue: 'Completed' }), bg: '#e8f8ee', text: '#15803d', border: '#bbf7d0', icon: 'checkmark-circle' };
      case BookingStatus.CANCELLED:
        return { label: t('myBookings.status.cancelled', { defaultValue: 'Cancelled' }), bg: '#fee2e2', text: '#991b1b', border: '#fecaca', icon: 'close-circle' };
      default:
        return { label: status, bg: '#f1f5f9', text: '#334155', border: '#e2e8f0', icon: 'information-circle' };
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={true} />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="rgb(22, 34, 50)" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t('myBookings.title', { defaultValue: 'My Bookings' })}</Text>
          <Text style={styles.headerSub}>
            {user ? `${formatTitleCase(user.fullName) || 'Customer'} • ${formatDisplayPhone(user.phone)}` : t('myBookings.signInToView', { defaultValue: 'Sign in to view your rides' })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newRideBtn}
          onPress={() => router.push('/select-trip-type')}
        >
          <Text style={styles.newRideBtnText}>{t('myBookings.newRide', { defaultValue: '+ New' })}</Text>
        </TouchableOpacity>
      </View>

      {/* If logged out: Show clean Sign In state */}
      {!user && !loading ? (
        <View style={styles.guestContainer}>
          <View style={styles.guestAvatar}>
            <Ionicons name="receipt-outline" size={44} color="rgb(240, 117, 15)" />
          </View>
          <Text style={styles.guestTitle}>{t('myBookings.signInTitle', { defaultValue: 'Sign In to View Your Bookings' })}</Text>
          <Text style={styles.guestSubtitle}>
            {t('myBookings.signInSubtitle', { defaultValue: 'Log in with your mobile number to view active rides, driver assignments, trip history, and download tax invoices.' })}
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => setIsAuthModalOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.signInButtonText}>{t('myBookings.signInBtn', { defaultValue: 'Sign In / Register' })}</Text>
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
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.8}
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
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 90, 110) },
              isSmallDevice && { padding: 8 },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadData();
                }}
                tintColor="rgb(240, 117, 15)"
              />
            }
          >
            {loading && bookings.length === 0 ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="rgb(240, 117, 15)" />
                <Text style={styles.loadingText}>{t('myBookings.loadingBookings', { defaultValue: 'Loading your bookings...' })}</Text>
              </View>
            ) : bookings.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="car-outline" size={44} color="#94a3b8" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>{t('myBookings.noBookingsFound', { defaultValue: 'No bookings found' })}</Text>
                <Text style={styles.emptySub}>
                  {activeFilter === 'ACTIVE'
                    ? t('myBookings.noActiveRides', { defaultValue: 'You do not have any active rides right now.' })
                    : t('myBookings.bookNextJourney', { defaultValue: 'Ready for your next journey? Book a clean AC cab in seconds!' })}
                </Text>
                <TouchableOpacity
                  style={styles.bookNowBtn}
                  onPress={() => router.push('/')}
                >
                  <Text style={styles.bookNowBtnText}>{t('myBookings.bookNowBtn', { defaultValue: 'Book a Cab Now ➔' })}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              bookings.map((booking) => {
                const isFleetApproval = booking.tripEvents?.some((e: any) =>
                  e.type === 'FLEET_APPROVAL_REQUESTED' ||
                  e.payloadJson?.requiresFleetApproval ||
                  e.payloadJson?.category === 'TEMPO_TRAVELER' ||
                  e.payloadJson?.category === 'URBANIA'
                );
                const isFleetApproved = booking.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED');
                const isAdvancePending = booking.advancePaymentStatus === 'PENDING' && Number(booking.advanceAmount) > 0;
                const badge = getStatusBadge(booking.status, booking);
                const totalFare = Number(booking.estimatedFare || 0);
                const advancePaid = booking.advancePaymentStatus === 'PAID' ? Number(booking.advanceAmount || 0) : 0;

                const driver = booking.assignedDriver;
                const vehicle = booking.vehicle || driver?.vehicles?.[0];

                return (
                  <View key={booking.id} style={styles.card}>
                    {/* 1. Header: Ref, Status, Scheduled Date */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={styles.refRow}>
                          <Text style={styles.refText}>{booking.humanReadableRef}</Text>
                          <View style={styles.statusPill}>
                            {badge.icon && (
                              <Ionicons
                                name={badge.icon as any}
                                size={13}
                                color={badge.text}
                                style={{ marginRight: 4 }}
                              />
                            )}
                            <Text style={[styles.statusPillText, { color: badge.text }]}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.scheduledRow}>
                          <Ionicons name="calendar-outline" size={14} color="#64748b" style={{ marginRight: 5 }} />
                          <Text style={styles.scheduledText} numberOfLines={1}>
                            {t('myBookings.scheduled', { defaultValue: 'Scheduled:' })}{' '}
                            <Text style={styles.scheduledBold}>
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
                          {booking.advancePaymentStatus === 'PAID'
                            ? (advancePaid >= totalFare && totalFare > 0
                              ? `${t('myBookings.paidInFull', { defaultValue: 'Paid in Full:' })} ₹${advancePaid.toFixed(2)}`
                              : `${t('myBookings.adv', { defaultValue: 'Adv:' })} ₹${advancePaid.toFixed(2)}`)
                            : `${t('myBookings.advDue', { defaultValue: 'Adv Due:' })} ₹${Number(booking.advanceAmount || 0).toFixed(2)}`}
                        </Text>
                      </View>
                    </View>

                    {/* 2. Trip Route Details */}
                    <View style={styles.routeSection}>
                      <View style={styles.routeMainRow}>
                        {/* Pickup & Drop Stack */}
                        <View style={styles.routeLocationsCol}>
                          {/* Pickup Row */}
                          <View style={styles.locationItemRow}>
                            <Ionicons name="location" size={20} color="#16a34a" style={styles.locationPinIcon} />
                            <View style={styles.locationItemText}>
                              <Text style={styles.routeNodeLabel}>{t('myBookings.pickupLocation', { defaultValue: 'PICKUP LOCATION' })}</Text>
                              <Text style={styles.routeAddressText} numberOfLines={1}>
                                {booking.status === BookingStatus.TRIP_STARTED || booking.status === BookingStatus.TRIP_COMPLETED
                                  ? (booking.actualPickupAddress || booking.pickupAddress)
                                  : booking.pickupAddress}
                              </Text>
                            </View>
                          </View>

                          {/* Intermediate / Via Stops */}
                          {parseViaStops(booking).map((stopName, sIdx) => (
                            <View key={`via-stop-${sIdx}`} style={[styles.locationItemRow, { marginTop: 14 }]}>
                              <View style={styles.viaBadgeCircle}>
                                <Text style={styles.viaBadgeNum}>{sIdx + 1}</Text>
                              </View>
                              <View style={styles.locationItemText}>
                                <Text style={styles.routeNodeLabel}>VIA STOP #{sIdx + 1}</Text>
                                <Text style={styles.routeAddressText} numberOfLines={1}>{stopName}</Text>
                              </View>
                            </View>
                          ))}

                          {/* Drop Row */}
                          <View style={[styles.locationItemRow, { marginTop: 14 }]}>
                            <Ionicons name="location" size={20} color="rgb(240, 117, 15)" style={styles.locationPinIcon} />
                            <View style={styles.locationItemText}>
                              <Text style={styles.routeNodeLabel}>{t('myBookings.dropDestination', { defaultValue: 'DROP DESTINATION' })}</Text>
                              <Text style={styles.routeAddressText} numberOfLines={1}>
                                {booking.status === BookingStatus.TRIP_COMPLETED
                                  ? (booking.actualDropAddress || booking.dropAddress)
                                  : booking.dropAddress}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Section Divider */}
                    <View style={styles.cardSectionDivider} />

                    {/* Fleet Availability Check Banners */}
                    {isFleetApproval && !isFleetApproved && (
                      <View style={styles.fleetCheckingBanner}>
                        <Ionicons name="hourglass-outline" size={18} color="#92400e" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fleetCheckingTitle}>Checking Fleet Availability</Text>
                          <Text style={styles.fleetCheckingSub}>
                            Our operations team is checking vehicle availability. No payment needed now. You will be notified once approved to pay from here.
                          </Text>
                        </View>
                      </View>
                    )}

                    {isFleetApproval && isFleetApproved && isAdvancePending && (
                      <View style={styles.fleetApprovedBanner}>
                        <Ionicons name="checkmark-circle" size={18} color="#15803d" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fleetApprovedTitle}>Fleet Approved! Ready for Payment</Text>
                          <Text style={styles.fleetApprovedSub}>
                            Vehicle availability is confirmed by Admin. Tap "Pay Advance" below to complete advance payment and confirm your ride.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* 3. Geofenced Proximity & Arrival OTP Banner (Only shown while waiting for pickup) */}
                    {(booking.status === BookingStatus.DRIVER_ACCEPTED ||
                      booking.status === BookingStatus.DRIVER_EN_ROUTE) &&
                      proximityAlerts[booking.id]?.isArrived ? (
                      <View style={styles.arrivedAlertBanner}>
                        <View style={styles.arrivedHeaderRow}>
                          <View style={styles.pulseDotGreen} />
                          <Text style={styles.arrivedBadgeText}>{t('myBookings.driverArrivedAtPickup', { defaultValue: 'DRIVER HAS ARRIVED AT PICKUP' })}</Text>
                        </View>
                        <View style={styles.revealedOtpCard}>
                          <Text style={styles.revealedOtpLabel}>{t('myBookings.yourPickupOtp', { defaultValue: 'YOUR PICKUP OTP' })}</Text>
                          <View style={styles.revealedOtpPill}>
                            <Text style={styles.revealedOtpCode}>
                              {proximityAlerts[booking.id]?.pickupOtp || booking.pickupOtp}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (booking.status === BookingStatus.DRIVER_ACCEPTED ||
                      booking.status === BookingStatus.DRIVER_EN_ROUTE) &&
                      proximityAlerts[booking.id]?.isNear ? (
                      <View style={styles.nearAlertBanner}>
                        <Ionicons name="car" size={20} color="#b45309" />
                        <Text style={styles.nearAlertTitle}>{t('myBookings.driverNearby', { defaultValue: 'Your driver is nearby (~100m)' })}</Text>
                      </View>
                    ) : null}

                    {/* Bottom Row: KM badge on Left side of Pickup OTP */}
                    <View style={styles.bottomOtpKmRow}>
                      {/* Left: Distance & Trip Type */}
                      <View style={styles.distanceBadgePill}>
                        <View style={styles.distanceTopRow}>
                          <Ionicons name="trending-up" size={14} color="rgb(22, 34, 50)" style={{ marginRight: 4 }} />
                          <Text style={styles.distanceBadgeText}>
                            {booking.distanceKm ? `~${booking.distanceKm} km` : '~50 km'}
                          </Text>
                        </View>
                        <Text style={styles.tripTypeSubText}>
                          {booking.tripType === TripType.ONEWAY
                            ? t('home.outstationOneWay', { defaultValue: 'One Way' })
                            : booking.tripType === TripType.ROUND
                              ? t('home.outstationRound', { defaultValue: 'Round Trip' })
                              : booking.tripType === TripType.AIRPORT
                                ? t('home.airportTransfer', { defaultValue: 'Airport' })
                                : booking.tripType === TripType.LOCAL
                                  ? t('home.localRental', { defaultValue: 'Hourly Local' })
                                  : 'Standard'}
                        </Text>
                      </View>

                      {/* Vertical Line Separator */}
                      {booking.pickupOtp &&
                        booking.status !== BookingStatus.TRIP_COMPLETED &&
                        booking.status !== BookingStatus.CANCELLED && (
                          <View style={styles.verticalDivider} />
                        )}

                      {/* Right: Pickup OTP Card */}
                      {booking.pickupOtp &&
                        booking.status !== BookingStatus.TRIP_COMPLETED &&
                        booking.status !== BookingStatus.CANCELLED && (
                          <View style={styles.otpBox}>
                            <View style={styles.otpIconCircle}>
                              <Ionicons name="pricetag" size={20} color="rgb(22, 34, 50)" />
                            </View>
                            <Text style={[styles.otpLabel, { marginLeft: 8, flex: 1 }]}>{t('myBookings.pickupOtp', { defaultValue: 'Pickup OTP' })}</Text>
                            <View style={styles.otpPill}>
                              <Text style={styles.otpPillText}>{booking.pickupOtp}</Text>
                            </View>
                          </View>
                        )}
                    </View>

                    {/* 4. Driver & Vehicle Card */}
                    {driver ? (
                      <View style={styles.driverSection}>
                        <View style={styles.driverCarCircle}>
                          <Ionicons name="car" size={22} color="#0284c7" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.driverBoxSubtitle}>{t('myBookings.driverAndVehicle', { defaultValue: 'DRIVER & VEHICLE' })}</Text>
                          <Text style={styles.driverName}>
                            {driver.user?.fullName || t('myBookings.assignedDriver', { defaultValue: 'Assigned Driver' })}
                          </Text>
                          <Text style={styles.driverVehicle}>
                            {(vehicle?.category || booking.category || 'SEDAN').toUpperCase()} • {vehicle?.plateNumber || 'Ka 01 mj 2023'}
                          </Text>
                        </View>
                        <View style={styles.driverRatingPill}>
                          <Ionicons name="star" size={12} color="#f59e0b" />
                          <Text style={styles.driverRatingPillText}>
                            {booking.driverRating ? Number(booking.driverRating).toFixed(1) : '4.9'}
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
                              <Text style={styles.driverCallBtnText}>{t('myBookings.call', { defaultValue: 'Call' })}</Text>
                            </TouchableOpacity>
                          )}
                      </View>
                    ) : (
                      <View style={styles.unassignedRow}>
                        <View style={styles.driverUserCircle}>
                          <Ionicons name="person" size={18} color="#64748b" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.unassignedTitle}>{t('myBookings.driverAndVehicle', { defaultValue: 'DRIVER & VEHICLE' })}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                      </View>
                    )}

                    {/* Customer Submitted Rating Badge (if completed and rated) */}
                    {booking.customerRating && (() => {
                      const driverScore = Number(
                        booking.customerRating.driverRating ||
                        booking.customerRating.rating ||
                        5
                      );
                      const kandyScore = Number(
                        booking.customerRating.kandyRating ||
                        5
                      );

                      return (
                        <View style={styles.tripRatedCard}>
                          <View style={styles.tripRatedHeaderRow}>
                            <Ionicons name="star" size={13} color="#f59e0b" style={{ marginRight: 5 }} />
                            <Text style={styles.tripRatedHeaderTitle}>{t('myBookings.yourTripRating', { defaultValue: 'Your Trip Rating' })}</Text>
                          </View>

                          <View style={styles.ratedSectionsRow}>
                            {/* Section 1: Driver Rating */}
                            <View style={styles.ratedSectionCol}>
                              <Text style={styles.ratedSectionLabel}>{t('myBookings.driver', { defaultValue: 'Driver' })}</Text>
                              <View style={styles.ratedStarsRow}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Ionicons
                                    key={s}
                                    name={s <= driverScore ? 'star' : 'star-outline'}
                                    size={13}
                                    color={s <= driverScore ? '#f59e0b' : '#cbd5e1'}
                                    style={{ marginRight: 1.5 }}
                                  />
                                ))}
                                <Text style={styles.ratedScoreBadge}>{driverScore}★</Text>
                              </View>
                            </View>

                            {/* Divider */}
                            <View style={styles.ratedVerticalDivider} />

                            {/* Section 2: KandyCabs Rating */}
                            <View style={styles.ratedSectionCol}>
                              <Text style={styles.ratedSectionLabel}>KandyCabs</Text>
                              <View style={styles.ratedStarsRow}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Ionicons
                                    key={s}
                                    name={s <= kandyScore ? 'star' : 'star-outline'}
                                    size={13}
                                    color={s <= kandyScore ? '#f59e0b' : '#cbd5e1'}
                                    style={{ marginRight: 1.5 }}
                                  />
                                ))}
                                <Text style={styles.ratedScoreBadge}>{kandyScore}★</Text>
                              </View>
                            </View>
                          </View>

                          {/* Optional comment */}
                          {booking.customerRating.comment ? (
                            <View style={styles.ratedCommentRow}>
                              <Text style={styles.ratedCommentText} numberOfLines={2}>
                                "{booking.customerRating.comment}"
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })()}

                    {/* Pay Advance Full-Width Primary Action (When Fleet Approved & Advance Pending) */}
                    {isFleetApproved && isAdvancePending && (
                      <TouchableOpacity
                        style={styles.payAdvanceNowBtnFull}
                        onPress={() => handlePayAdvance(booking)}
                        disabled={payingBookingId === booking.id}
                        activeOpacity={0.85}
                      >
                        {payingBookingId === booking.id ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <>
                            <Ionicons name="card" size={16} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={styles.payAdvanceNowBtnFullText}>
                              Pay Advance ₹{Number(booking.advanceAmount).toLocaleString('en-IN')} & Confirm Trip →
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    {/* 6. Action Buttons */}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.invoiceBtn}
                        onPress={() => setSelectedInvoiceId(booking.id)}
                      >
                        <Ionicons name="document-text-outline" size={16} color="rgb(22, 34, 50)" />
                        <Text style={styles.invoiceBtnText} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>{t('myBookings.taxInvoice', { defaultValue: 'Tax invoice' })}</Text>
                      </TouchableOpacity>

                      {/* Driver & Trip Rating Button for Completed Trips (Only if not already rated) */}
                      {booking.status === BookingStatus.TRIP_COMPLETED && !booking.customerRating && (
                        <TouchableOpacity
                          style={styles.rateTripNavyBtn}
                          onPress={() => reviewManager.forceShowReview(booking)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="star"
                            size={16}
                            color="#ffffff"
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.rateTripNavyBtnText} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                            {t('myBookings.rateTrip', { defaultValue: 'Rate trip' })}
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
                            <Ionicons name="close-circle" size={15} color="#dc2626" />
                            <Text style={styles.cancelBtnText} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                              {cancellingId === booking.id ? t('myBookings.cancelling', { defaultValue: 'Cancelling...' }) : t('myBookings.cancelRide', { defaultValue: 'Cancel Ride' })}
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
    fontSize: 19,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 1,
  },
  newRideBtn: {
    backgroundColor: 'rgb(240, 117, 15)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  newRideBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgb(240, 117, 15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileAvatarText: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '900',
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
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
    fontSize: 11,
    fontWeight: '800',
  },
  profilePhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  profilePhone: {
    fontSize: 13.5,
    color: '#475569',
    fontWeight: '600',
  },
  filterTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
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
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  filterTabActive: {
    backgroundColor: 'rgb(22, 34, 50)',
  },
  filterTabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b',
  },
  filterTabTextActive: {
    color: '#ffffff',
    fontWeight: '900',
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
    fontSize: 17,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
  },
  emptySub: {
    fontSize: 13.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 20,
  },
  bookNowBtn: {
    backgroundColor: 'rgb(240, 117, 15)',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  bookNowBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8edf5',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 14,
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
    gap: 8,
  },
  refText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  scheduledText: {
    fontSize: 12,
    color: '#64748b',
  },
  scheduledBold: {
    color: 'rgb(22, 34, 50)',
    fontWeight: '700',
  },
  fareHeaderBlock: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    maxWidth: 140,
  },
  fareTotalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
    textAlign: 'right',
  },
  advancePaidTag: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#16a34a',
    marginTop: 2,
    textAlign: 'right',
  },
  routeSection: {
    marginTop: 2,
  },
  routeMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  routeLocationsCol: {
    flex: 1,
  },
  locationItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationPinIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  viaBadgeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  viaBadgeNum: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400e',
  },
  locationItemText: {
    flex: 1,
  },
  routeNodeLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeAddressText: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    marginTop: 2,
  },
  bottomOtpKmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  distanceBadgePill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  distanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  tripTypeSubText: {
    fontSize: 10.5,
    color: 'rgb(22, 34, 50)',
    fontWeight: '700',
    marginTop: 3.5,
    textAlign: 'center',
  },
  verticalDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 16,
  },
  cardSectionDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  otpBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  otpIconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpLabel: {
    fontSize: 12.5,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
  },
  otpSub: {
    fontSize: 11,
    color: '#c2410c',
    marginTop: 1,
    lineHeight: 14,
  },
  otpPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgb(240, 117, 15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 6,
  },
  otpPillText: {
    fontSize: 16,
    fontWeight: '900',
    color: 'rgb(240, 117, 15)',
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
    padding: 11,
    marginTop: 10,
    gap: 8,
  },
  nearAlertEmoji: {
    fontSize: 22,
  },
  nearAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b45309',
  },
  nearAlertSub: {
    fontSize: 11.5,
    color: '#92400e',
    marginTop: 1,
  },
  arrivedAlertBanner: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
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
    fontSize: 12,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.5,
  },
  arrivedAlertMessage: {
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '900',
    color: '#065f46',
  },
  revealedOtpSub: {
    fontSize: 10.5,
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
    fontSize: 19,
    fontWeight: '900',
    color: '#065f46',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverCarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverUserCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fffdf0',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  driverRatingPillText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#b45309',
  },
  driverBoxSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  driverName: {
    fontSize: 15.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    marginTop: 1,
  },
  driverVehicle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 1,
  },
  driverCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  driverCallBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800',
  },
  unassignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unassignedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unassignedText: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 1,
  },
  tripRatedCard: {
    backgroundColor: '#fffdf2',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  tripRatedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripRatedHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratedSectionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratedSectionCol: {
    flex: 1,
  },
  ratedSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  ratedStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratedScoreBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
    marginLeft: 5,
  },
  ratedVerticalDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#fde68a',
    marginHorizontal: 12,
  },
  ratedCommentRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
  },
  ratedCommentText: {
    fontSize: 11.5,
    fontStyle: 'italic',
    color: '#78350f',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 4,
    gap: 10,
  },
  invoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  invoiceBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  rateTripNavyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(22, 34, 50)',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    shadowColor: 'rgb(22, 34, 50)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  rateTripNavyBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
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
    shadowColor: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    backgroundColor: 'rgb(240, 117, 15)',
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
  fleetCheckingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  fleetCheckingTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  fleetCheckingSub: {
    fontSize: 11,
    color: '#78350f',
    marginTop: 2,
    lineHeight: 15,
  },
  fleetApprovedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  fleetApprovedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803d',
  },
  fleetApprovedSub: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
    lineHeight: 15,
  },
  payAdvanceNowBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 6,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 3,
  },
  payAdvanceNowBtnFullText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  payAdvanceNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  payAdvanceNowBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
