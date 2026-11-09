import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Linking,
  ActivityIndicator,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDistanceInMeters } from '@kandy-cabs/shared';
import { driverApiClient } from '../../lib/api';
import { locationTracker } from '../../lib/location-tracker';
import { SlideToAccept } from '../../components/SlideToAccept';
import { setTripPickupReached } from '../../lib/tripState';
import { TripFlowHeader } from '../../components/TripFlowHeader';

export default function DriverEnRouteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [isSlidingReached, setIsSlidingReached] = useState(false);

  const fetchBooking = useCallback(async () => {
    try {
      const res = await driverApiClient.fetch('/api/driver/status');
      if (res.success) {
        let found = null;
        if (bookingId && res.activeBooking && res.activeBooking.id === bookingId) {
          found = res.activeBooking;
        } else if (res.driver?.assignedBookings?.length) {
          found = res.driver.assignedBookings.find((b: any) => b.id === bookingId);
        }
        if (!found && res.assignedTrips?.length) {
          found = res.assignedTrips.find((b: any) => b.id === bookingId);
        }
        if (!found && res.activeBooking) {
          found = res.activeBooking;
        }
        if (!found && res.driver?.assignedBookings?.length) {
          found = res.driver.assignedBookings[0];
        }
        if (found) {
          setBooking(found);
          setLoading(false);
          return;
        }
      }

      // Fallback: check /api/driver/trips
      const tripsRes = await driverApiClient.fetch('/api/driver/trips');
      if (tripsRes.success && Array.isArray(tripsRes.trips)) {
        const found = tripsRes.trips.find((b: any) => b.id === bookingId) || tripsRes.trips[0];
        if (found) {
          setBooking(found);
        }
      }
    } catch (err) {
      console.error('Failed to fetch en-route booking:', err);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
    // Start active trip background GPS tracking
    if (bookingId) {
      locationTracker.startActiveTripTracking(bookingId);
      // Mark driver en-route on backend
      driverApiClient.fetch('/api/driver/trip/en-route', {
        method: 'POST',
        body: JSON.stringify({ bookingId }),
      }).catch(() => {});
    }

    const unsubLoc = locationTracker.addListener((lat, lng) => {
      if (lat != null && lng != null) {
        setDriverCoords({ lat, lng });
      }
    });

    // 10-second polling sync for phone release and customer live location
    const interval = setInterval(fetchBooking, 10000);
    return () => {
      unsubLoc();
      clearInterval(interval);
    };
  }, [bookingId, fetchBooking]);

  const openNavigation = () => {
    if (!booking) return;
    const hasCoords = typeof booking.pickupLat === 'number' && typeof booking.pickupLng === 'number';
    const targetQuery = hasCoords
      ? `${booking.pickupLat},${booking.pickupLng}`
      : encodeURIComponent(booking.pickupAddress || '');

    const androidNavUrl = `google.navigation:q=${targetQuery}&mode=d`;
    const universalFallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetQuery}&travelmode=driving`;
    const iosUrl = `maps:0,0?q=${targetQuery}`;

    if (Platform.OS === 'android') {
      Linking.openURL(androidNavUrl).catch(() => {
        Linking.openURL(universalFallbackUrl).catch(() => {});
      });
    } else if (Platform.OS === 'ios') {
      Linking.openURL(iosUrl).catch(() => {
        Linking.openURL(universalFallbackUrl).catch(() => {});
      });
    } else {
      Linking.openURL(universalFallbackUrl).catch(() => {});
    }
  };

  const handleSlideReached = async () => {
    if (isSlidingReached) return;
    setIsSlidingReached(true);
    const targetBookingId = booking?.id || bookingId;
    try {
      if (targetBookingId) {
        await setTripPickupReached(targetBookingId, true);
        await driverApiClient.fetch('/api/driver/trip/en-route', {
          method: 'POST',
          body: JSON.stringify({ bookingId: targetBookingId, action: 'REACHED' }),
        }).catch(() => {});
      }
      router.push({
        pathname: '/trip/start',
        params: { bookingId: targetBookingId, step: '2', arrived: 'true' },
      });
    } catch (err) {
      console.error('Error on handleSlideReached:', err);
      router.push({
        pathname: '/trip/start',
        params: { bookingId: targetBookingId, step: '2', arrived: 'true' },
      });
    } finally {
      setIsSlidingReached(false);
    }
  };

  if (loading || !booking) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  const isCustomerSharing = booking.customerLocationSharingEnabled !== false;
  const hasCustomerCoords =
    isCustomerSharing &&
    typeof booking.customerCurrentLat === 'number' &&
    typeof booking.customerCurrentLng === 'number';

  const distanceMeters =
    booking &&
    driverCoords &&
    typeof booking.pickupLat === 'number' &&
    typeof booking.pickupLng === 'number'
      ? Math.round(
          getDistanceInMeters(
            driverCoords.lat,
            driverCoords.lng,
            booking.pickupLat,
            booking.pickupLng
          )
        )
      : null;

  const isNearPickup = distanceMeters !== null && distanceMeters <= 120;
  const isArrived = distanceMeters !== null && distanceMeters <= 50;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* 3-Step Flow Header: 1. Pickup (Active) -> 2. OTP -> 3. Drop */}
      <TripFlowHeader currentStep={1} />

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Pickup Header Section */}
        <View style={styles.pickupHeaderSection}>
          <View style={styles.statusBadgeRow}>
            <View style={isArrived ? styles.greenPulseDot : isNearPickup ? styles.amberPulseDot : styles.greenPulseDot} />
            <Text style={styles.statusBadgeText}>
              {isArrived ? 'ARRIVED AT PICKUP' : isNearPickup ? 'NEAR PICKUP LOCATION' : 'EN ROUTE TO PICKUP'}
            </Text>
          </View>
          <Text style={styles.pickupDestinationTitle} numberOfLines={2}>
            {booking.pickupAddress || 'Customer Location'}
          </Text>
          <Text style={styles.pickupInstructionsSubtitle}>
            Drive to this pickup point. After reaching {booking.pickupAddress || 'the pickup location'}, click ARRIVED AT PICKUP below.
          </Text>
        </View>

        {/* Live Distance & Geofence Status Card */}
        {distanceMeters !== null && (
          <View
            style={[
              styles.proximityRadarCard,
              isArrived
                ? styles.proximityCardArrived
                : isNearPickup
                ? styles.proximityCardNear
                : styles.proximityCardNormal,
            ]}
          >
            <View style={styles.proximityHeaderRow}>
              <View
                style={[
                  styles.proximityPulseDot,
                  isArrived
                    ? styles.dotGreen
                    : isNearPickup
                    ? styles.dotAmber
                    : styles.dotBlue,
                ]}
              />
              <Text
                style={[
                  styles.proximityStatusTitle,
                  isArrived
                    ? styles.textGreen
                    : isNearPickup
                    ? styles.textAmber
                    : styles.textBlue,
                ]}
              >
                {isArrived
                  ? '🎯 GEOFENCE: ARRIVED AT PICKUP'
                  : isNearPickup
                  ? '🚕 GEOFENCE: NEAR PICKUP (<120m)'
                  : '📡 LIVE GPS DISTANCE TO PICKUP'}
              </Text>
            </View>

            <View style={styles.proximityDistanceRow}>
              <Text
                style={[
                  styles.proximityDistanceVal,
                  isArrived
                    ? styles.textGreen
                    : isNearPickup
                    ? styles.textAmber
                    : styles.textBlue,
                ]}
              >
                {distanceMeters > 1000
                  ? `${(distanceMeters / 1000).toFixed(1)} km`
                  : `${distanceMeters} m`}
              </Text>
              <Text style={styles.proximityDistanceSub}>
                {isArrived
                  ? 'Customer OTP revealed. Click button below to start ride.'
                  : isNearPickup
                  ? 'Customer notified: "Driver is nearby. Please be ready."'
                  : 'Geofenced triggers: ~100m notify customer, ~50m reveal OTP.'}
              </Text>
            </View>
          </View>
        )}

        {/* Map Preview Card */}
        <View style={styles.mapCard}>
          <View style={styles.mapCanvas}>
            {/* Water Coastline Area */}
            <View style={styles.mapWaterArea} />

            {/* Stylized Roads */}
            <View style={styles.mapRoadH1} />
            <View style={styles.mapRoadH2} />
            <View style={styles.mapRoadDiag1} />
            <View style={styles.mapRoadDiag2} />

            {/* Curved Blue Route Polyline */}
            <View style={styles.mapRouteCurve1} />
            <View style={styles.mapRouteCurve2} />

            {/* Driver Navigation Marker */}
            <View style={styles.driverMarkerContainer}>
              <View style={styles.driverMarkerOuterRing}>
                <View style={styles.driverMarkerInner}>
                  <Ionicons name="navigate" size={14} color="#ffffff" style={{ transform: [{ rotate: '45deg' }] }} />
                </View>
              </View>
            </View>

            {/* Destination Pin Marker */}
            <View style={styles.destinationPinContainer}>
              <Ionicons name="location-sharp" size={28} color="#ef4444" />
            </View>

            {/* Destination Tag Pill */}
            <View style={styles.destinationTagPill}>
              <Ionicons name="airplane" size={12} color="#2563eb" style={{ marginRight: 4 }} />
              <Text style={styles.destinationTagText} numberOfLines={1}>
                {booking.pickupAddress || 'Pickup Point'}
              </Text>
            </View>
          </View>

          {/* Open Navigation Button */}
          <TouchableOpacity style={styles.openNavButton} onPress={openNavigation} activeOpacity={0.85}>
            <Ionicons name="navigate" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.openNavButtonText}>Open Navigation</Text>
            <Ionicons name="chevron-forward" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Trip Information Card */}
        <View style={styles.infoCard}>
          {/* Customer Header Row */}
          <View style={styles.customerHeaderRow}>
            <View style={styles.customerLeftGroup}>
              <View style={styles.customerAvatarCircle}>
                <Ionicons name="person" size={24} color="#2563eb" />
              </View>
              <View style={styles.customerInfoCol}>
                <Text style={styles.customerName}>{booking.customer?.user?.fullName || 'Customer'}</Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                  <Text style={styles.verifiedBadgeText}>Verified Driver</Text>
                </View>
              </View>
            </View>

            {(() => {
              const isPhoneReleased =
                Boolean(booking.customerPhoneReleased) ||
                (booking.scheduledAt &&
                  new Date(booking.scheduledAt).getTime() - Date.now() <= 5 * 60 * 60 * 1000);

              return isPhoneReleased ? (
                <TouchableOpacity
                  style={styles.releasedBadge}
                  onPress={() => booking.customer?.user?.phone && Linking.openURL(`tel:${booking.customer.user.phone}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={13} color="#10b981" />
                  <Text style={styles.releasedBadgeText}>Phone Released</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.lockedBadge}>
                  <Ionicons name="shield-checkmark" size={14} color="#2563eb" />
                  <Text style={styles.lockedBadgeText}>Phone Protected</Text>
                </View>
              );
            })()}
          </View>

          {/* Call CTA if Phone Released */}
          {(() => {
            const isPhoneReleased =
              Boolean(booking.customerPhoneReleased) ||
              (booking.scheduledAt &&
                new Date(booking.scheduledAt).getTime() - Date.now() <= 5 * 60 * 60 * 1000);

            return isPhoneReleased && booking.customer?.user?.phone ? (
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => Linking.openURL(`tel:${booking.customer.user.phone}`)}
                activeOpacity={0.85}
              >
                <Ionicons name="call" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.callButtonText}>Call Customer ({booking.customer.user.phone})</Text>
              </TouchableOpacity>
            ) : null;
          })()}

          <View style={styles.divider} />

          {/* Pickup Location Row */}
          <TouchableOpacity
            style={styles.infoDetailRow}
            onPress={openNavigation}
            activeOpacity={0.7}
          >
            <View style={styles.detailIconCircleRed}>
              <Ionicons name="location-sharp" size={20} color="#ea580c" />
            </View>
            <View style={styles.detailContentCol}>
              <Text style={styles.detailLabel}>PICKUP LOCATION</Text>
              <Text style={styles.detailValDark} numberOfLines={2}>{booking.pickupAddress}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Trip Type Row */}
          <View style={styles.infoDetailRow}>
            <View style={styles.detailIconCircleOrange}>
              <Ionicons name="git-branch-outline" size={19} color="#ea580c" />
            </View>
            <View style={styles.detailContentCol}>
              <Text style={styles.detailLabel}>TRIP TYPE</Text>
              <Text style={styles.detailValOrange}>
                {booking.tripType?.toUpperCase() || 'ONEWAY'}
                {booking.distanceKm ? ` (${booking.distanceKm} km)` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action: SLIDE RIGHT (REACHED) */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Clear Instructions Banner */}
        <View style={isArrived ? styles.arrivedNoticeBox : styles.arrivedInstructionsBox}>
          <Ionicons
            name={isArrived ? 'checkmark-circle' : 'information-circle'}
            size={18}
            color={isArrived ? '#059669' : '#0284c7'}
            style={{ marginTop: 2, marginRight: 8 }}
          />
          <Text style={isArrived ? styles.arrivedNoticeText : styles.arrivedInstructionsText}>
            {isArrived ? (
              <Text>
                You have reached <Text style={styles.highlightText}>{booking.pickupAddress || 'Pickup Location'}</Text>. Slide right to verify customer OTP & meter.
              </Text>
            ) : (
              <Text>
                Drive to <Text style={styles.highlightText}>{booking.pickupAddress || 'Pickup Location'}</Text>. After reaching the pickup location, slide right below to continue.
              </Text>
            )}
          </Text>
        </View>

        <SlideToAccept
          onAccept={handleSlideReached}
          isAccepting={isSlidingReached}
          title="SLIDE RIGHT (REACHED)"
          acceptingTitle="CONFIRMING REACHED..."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDividerV: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  headerTextCol: {
    flex: 1,
  },
  headerStepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerStepText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  headerLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  headerLiveRadarText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#16a34a',
    letterSpacing: 0.8,
  },
  headerMainTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  headerSubtitleText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  headerRefCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  headerRefText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  pickupHeaderSection: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  greenPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16a34a',
    marginRight: 8,
  },
  statusBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#16a34a',
    letterSpacing: 0.6,
  },
  pickupDestinationTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  pickupInstructionsSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
  },
  mapCard: {
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 16,
  },
  mapCanvas: {
    height: 146,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    position: 'relative',
  },
  mapWaterArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '32%',
    backgroundColor: '#dbeafe',
    borderTopRightRadius: 40,
    borderBottomRightRadius: 80,
    opacity: 0.85,
  },
  mapRoadH1: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#e2e8f0',
    transform: [{ rotate: '-8deg' }],
  },
  mapRoadH2: {
    position: 'absolute',
    top: 95,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: '#e2e8f0',
    transform: [{ rotate: '14deg' }],
  },
  mapRoadDiag1: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: '42%',
    width: 6,
    backgroundColor: '#e2e8f0',
    transform: [{ rotate: '28deg' }],
  },
  mapRoadDiag2: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    right: '25%',
    width: 5,
    backgroundColor: '#e2e8f0',
    transform: [{ rotate: '-32deg' }],
  },
  mapRouteCurve1: {
    position: 'absolute',
    top: 80,
    left: '40%',
    width: 64,
    height: 5,
    backgroundColor: '#2563eb',
    transform: [{ rotate: '-38deg' }],
    borderRadius: 3,
  },
  mapRouteCurve2: {
    position: 'absolute',
    top: 50,
    left: '52%',
    width: 68,
    height: 5,
    backgroundColor: '#2563eb',
    transform: [{ rotate: '-20deg' }],
    borderRadius: 3,
  },
  driverMarkerContainer: {
    position: 'absolute',
    top: 90,
    left: '38%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  driverMarkerOuterRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1d63ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  destinationPinContainer: {
    position: 'absolute',
    top: 34,
    right: 140,
  },
  destinationTagPill: {
    position: 'absolute',
    top: 38,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: '45%',
  },
  destinationTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
  },
  openNavButton: {
    backgroundColor: '#1d63ed',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    shadowColor: '#1d63ed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  openNavButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  customerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInfoCol: {
    justifyContent: 'center',
  },
  customerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  releasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  releasedBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#059669',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
    gap: 6,
  },
  disclaimerText: {
    fontSize: 11.5,
    color: '#64748b',
    fontStyle: 'italic',
    flex: 1,
  },
  callButton: {
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  callButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  infoDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailIconCircleRed: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  detailIconCircleOrange: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  detailContentCol: {
    flex: 1,
    paddingRight: 8,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  detailValDark: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 20,
  },
  detailValOrange: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#ea580c',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  arrivedInstructionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  arrivedInstructionsText: {
    fontSize: 12.5,
    color: '#1e40af',
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
  arrivedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  arrivedNoticeText: {
    fontSize: 12.5,
    color: '#065f46',
    lineHeight: 18,
    flex: 1,
    fontWeight: '600',
  },
  highlightText: {
    color: '#0f172a',
    fontWeight: '800',
  },
  highlightGreen: {
    color: '#059669',
    fontWeight: '900',
  },
  arrivedButton: {
    backgroundColor: '#059669',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  arrivedButtonPulse: {
    backgroundColor: '#047857',
    borderWidth: 2,
    borderColor: '#34d399',
  },
  ctaIconCircleWhite: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrivedButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  amberPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  proximityRadarCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
  },
  proximityCardNormal: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  proximityCardNear: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  proximityCardArrived: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  proximityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  proximityPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotBlue: {
    backgroundColor: '#2563eb',
  },
  dotAmber: {
    backgroundColor: '#f59e0b',
  },
  dotGreen: {
    backgroundColor: '#10b981',
  },
  proximityStatusTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  textBlue: {
    color: '#1d4ed8',
  },
  textAmber: {
    color: '#b45309',
  },
  textGreen: {
    color: '#047857',
  },
  proximityDistanceRow: {
    flexDirection: 'column',
    gap: 2,
  },
  proximityDistanceVal: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  proximityDistanceSub: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2,
  },
});
