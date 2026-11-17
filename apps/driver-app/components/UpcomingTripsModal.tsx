import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SlideToAccept } from './SlideToAccept';
import {
  formatTripDateTime,
  parseCustomerRequirements,
  extractCustomerNotes,
} from '../lib/tripRequirements';
import {
  getTripInProcessSync,
  isTripVerificationCompletedSync,
  isTripPickupReachedSync,
  isTripOdometerCompletedSync,
  isTripDestinationReachedSync,
} from '../lib/tripState';

function parseSafeDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function parseViaStops(booking: any): string[] {
  if (!booking) return [];
  if (Array.isArray(booking.viaStops) && booking.viaStops.length > 0) {
    return booking.viaStops
      .map((s: any) => (typeof s === 'string' ? s : s?.address || s?.name || ''))
      .filter((s: string) => s.trim().length > 0);
  }
  if (typeof booking.viaStops === 'string' && booking.viaStops.trim().length > 0) {
    try {
      const parsed = JSON.parse(booking.viaStops);
      if (Array.isArray(parsed)) {
        return parsed
          .map((s: any) => (typeof s === 'string' ? s : s?.address || s?.name || ''))
          .filter((s: string) => s.trim().length > 0);
      }
    } catch (_) {
      return booking.viaStops
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
    }
  }
  return [];
}

function openNavigationMap(
  destinationLat?: number | null,
  destinationLng?: number | null,
  destinationAddress?: string
) {
  const hasCoords =
    typeof destinationLat === 'number' &&
    typeof destinationLng === 'number' &&
    !isNaN(destinationLat) &&
    !isNaN(destinationLng);

  const targetQuery = hasCoords
    ? `${destinationLat},${destinationLng}`
    : encodeURIComponent(destinationAddress || '');

  if (!targetQuery || targetQuery === 'undefined' || targetQuery === 'null') {
    Alert.alert('Location Notice', 'Address or GPS coordinates are not available for navigation.');
    return;
  }

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
}

interface UpcomingTripsModalProps {
  visible: boolean;
  onClose: () => void;
  upcomingBookings: any[];
  activeBooking?: any;
  driver?: any;
  onSelectBooking?: (bookingId: string) => void;
}

export function UpcomingTripsModal({
  visible,
  onClose,
  upcomingBookings = [],
  activeBooking,
  driver,
  onSelectBooking,
}: UpcomingTripsModalProps) {
  const { t } = useTranslation();
  const router = useRouter();

  // Split trips into "Active On-Trip", "Closer before 1 day" vs "Later upcoming"
  const { onTripTrips, withinOneDayTrips, laterTrips } = useMemo(() => {
    const now = Date.now();
    const activeOnTrip: any[] = [];
    const withinOneDay: any[] = [];
    const later: any[] = [];

    // Ensure all trips including activeBooking are covered without duplicates
    // Also merge activeBooking into any matching entry from upcomingBookings to prevent stale status
    const combinedList: any[] = (upcomingBookings || []).map((b) => {
      if (
        activeBooking &&
        (b.id === activeBooking.id ||
          (b.humanReadableRef && b.humanReadableRef === activeBooking.humanReadableRef))
      ) {
        return { ...b, ...activeBooking };
      }
      return b;
    });

    if (
      activeBooking &&
      !combinedList.some(
        (b) =>
          b.id === activeBooking.id ||
          (b.humanReadableRef && b.humanReadableRef === activeBooking.humanReadableRef)
      )
    ) {
      if (
        activeBooking.status !== 'COMPLETED' &&
        activeBooking.status !== 'TRIP_COMPLETED' &&
        activeBooking.status !== 'CANCELLED'
      ) {
        combinedList.unshift(activeBooking);
      }
    }

    combinedList.forEach((trip) => {
      const matchActive =
        activeBooking &&
        (activeBooking.id === trip.id ||
          (trip.humanReadableRef && activeBooking.humanReadableRef === trip.humanReadableRef));

      const status = (matchActive && matchActive.status) || trip?.status;

      const isStatusStarted = [
        'TRIP_STARTED',
        'ON_TRIP',
        'IN_PROGRESS',
        'STARTED',
        'DRIVER_EN_ROUTE',
        'EN_ROUTE',
        'ARRIVED',
        'DRIVER_ARRIVED',
        'OTP_VERIFIED',
      ].includes(status);

      const tId = trip?.id || (matchActive ? activeBooking?.id : undefined);

      const isLocalStarted = Boolean(
        tId &&
          (getTripInProcessSync(tId) ||
            isTripVerificationCompletedSync(tId) ||
            isTripPickupReachedSync(tId) ||
            isTripOdometerCompletedSync(tId) ||
            isTripDestinationReachedSync(tId))
      );

      const isTripInProcess =
        isStatusStarted ||
        Boolean(trip?.startedAt) ||
        Boolean(matchActive?.startedAt) ||
        Boolean(trip?.isTripStarted) ||
        Boolean(matchActive?.isTripStarted) ||
        isLocalStarted;

      if (isTripInProcess) {
        activeOnTrip.push(trip);
        return;
      }

      if (!trip?.scheduledAt) {
        withinOneDay.push(trip);
        return;
      }
      const tripTime = new Date(trip.scheduledAt).getTime();
      if (isNaN(tripTime)) {
        withinOneDay.push(trip);
        return;
      }

      const diff = tripTime - now;
      const timing = formatTripDateTime(trip.scheduledAt, t);

      // Within 24 hours, or scheduled for Today or Tomorrow, or pickup time has arrived/passed
      if (timing.isToday || timing.isTomorrow || diff <= 24 * 3600 * 1000) {
        withinOneDay.push(trip);
      } else {
        later.push(trip);
      }
    });

    return { onTripTrips: activeOnTrip, withinOneDayTrips: withinOneDay, laterTrips: later };
  }, [upcomingBookings, activeBooking, t]);

  const totalCount = onTripTrips.length + withinOneDayTrips.length + laterTrips.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeftGroup}>
            <Ionicons name="calendar" size={24} color="#2563eb" style={styles.headerIcon} />
            <View>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle}>
                  {t('dashboard.upcoming_trips', 'Upcoming Trips')}
                </Text>
                {totalCount > 0 && (
                  <View style={styles.headerCountBadge}>
                    <Text style={styles.headerCountText}>{totalCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.headerSub}>
                {onTripTrips.length > 0
                  ? `${onTripTrips.length} trip(s) in progress • ${withinOneDayTrips.length} upcoming`
                  : withinOneDayTrips.length > 0
                  ? `${withinOneDayTrips.length} ride(s) scheduled within 24 hours`
                  : 'Confirmed scheduled rides assigned to you'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={22} color="#0f2744" />
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {totalCount === 0 && onTripTrips.length === 0 ? (
            /* Empty State */
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="calendar-outline" size={42} color="#2563eb" />
              </View>
              <Text style={styles.emptyTitle}>
                {t('dashboard.no_upcoming_trips_title', 'No Upcoming Trips')}
              </Text>
              <Text style={styles.emptyText}>
                {t(
                  'dashboard.no_upcoming_trips_desc',
                  'When trips scheduled closer before 1 day or future advance bookings are accepted, they will be listed here with route details and countdown reminders.'
                )}
              </Text>

              <TouchableOpacity
                style={styles.emptyBackBtn}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBackBtnText}>Back to Dashboard</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.tripsListContainer}>
              {/* SECTION 0: ACTIVE ON-TRIP (Live trip in progress) */}
              {onTripTrips.length > 0 && (
                <View style={styles.sectionGroup}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="navigate-circle" size={15} color="#16a34a" />
                    <Text style={styles.sectionHeadingGreen}>
                      ACTIVE ON TRIP ({onTripTrips.length})
                    </Text>
                  </View>

                  {onTripTrips.map((trip, idx) => (
                    <UpcomingTripCard
                      key={trip.id || `ontrip-${idx}`}
                      trip={trip}
                      isCloserBefore1Day={false}
                      isOnTrip={true}
                      activeBooking={activeBooking}
                      driver={driver}
                      onClose={onClose}
                      onSelectBooking={onSelectBooking}
                      router={router}
                      t={t}
                    />
                  ))}
                </View>
              )}

              {/* SECTION 1: CLOSER BEFORE 1 DAY (URGENT • BE READY) */}
              {withinOneDayTrips.length > 0 && (
                <View style={[styles.sectionGroup, onTripTrips.length > 0 && { marginTop: 14 }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="time" size={15} color="#ea580c" />
                    <Text style={styles.sectionHeadingOrange}>
                      UPCOMING TRIPS ({withinOneDayTrips.length})
                    </Text>
                  </View>

                  {withinOneDayTrips.map((trip, idx) => (
                    <UpcomingTripCard
                      key={trip.id || `closer-${idx}`}
                      trip={trip}
                      isCloserBefore1Day={true}
                      isOnTrip={false}
                      activeBooking={activeBooking}
                      driver={driver}
                      onClose={onClose}
                      onSelectBooking={onSelectBooking}
                      router={router}
                      t={t}
                    />
                  ))}
                </View>
              )}

              {/* SECTION 2: LATER SCHEDULED BOOKINGS (> 1 DAY) */}
              {laterTrips.length > 0 && (
                <View style={[styles.sectionGroup, (withinOneDayTrips.length > 0 || onTripTrips.length > 0) && { marginTop: 14 }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="calendar-outline" size={15} color="#64748b" />
                    <Text style={styles.sectionHeadingGrey}>
                      FUTURE SCHEDULED TRIPS ({laterTrips.length})
                    </Text>
                  </View>

                  {laterTrips.map((trip, idx) => (
                    <UpcomingTripCard
                      key={trip.id || `later-${idx}`}
                      trip={trip}
                      isCloserBefore1Day={false}
                      isOnTrip={false}
                      activeBooking={activeBooking}
                      driver={driver}
                      onClose={onClose}
                      onSelectBooking={onSelectBooking}
                      router={router}
                      t={t}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function UpcomingTripCard({
  trip,
  isCloserBefore1Day,
  isOnTrip,
  activeBooking,
  driver,
  onClose,
  onSelectBooking,
  router,
  t,
}: {
  trip: any;
  isCloserBefore1Day: boolean;
  isOnTrip?: boolean;
  activeBooking?: any;
  driver?: any;
  onClose: () => void;
  onSelectBooking?: (id: string) => void;
  router: any;
  t: any;
}) {
  const [isStartingTrip, setIsStartingTrip] = useState(false);

  const tripDate = trip?.scheduledAt ? parseSafeDate(trip.scheduledAt) : null;
  const now = new Date();
  const isToday = tripDate
    ? tripDate.getDate() === now.getDate() &&
      tripDate.getMonth() === now.getMonth() &&
      tripDate.getFullYear() === now.getFullYear()
    : false;

  const isTimingNear = (() => {
    if (!trip?.scheduledAt) return false;
    const d = parseSafeDate(trip.scheduledAt);
    if (!d || isNaN(d.getTime())) return false;
    const diffHours = (d.getTime() - Date.now()) / (1000 * 60 * 60);
    return diffHours <= 5 && diffHours >= -4;
  })();

  const isMatchingActive = Boolean(
    activeBooking &&
      (activeBooking.id === trip?.id ||
        (trip?.humanReadableRef && activeBooking.humanReadableRef === trip?.humanReadableRef))
  );

  const effectiveStatus = (isMatchingActive && activeBooking?.status) || trip?.status;

  const isStatusStarted = [
    'TRIP_STARTED',
    'ON_TRIP',
    'IN_PROGRESS',
    'STARTED',
    'DRIVER_EN_ROUTE',
    'EN_ROUTE',
    'ARRIVED',
    'DRIVER_ARRIVED',
    'OTP_VERIFIED',
  ].includes(effectiveStatus);

  const targetBookingId = trip?.id || (isMatchingActive ? activeBooking?.id : undefined);

  const isLocalStarted = Boolean(
    targetBookingId &&
      (getTripInProcessSync(targetBookingId) ||
        isTripVerificationCompletedSync(targetBookingId) ||
        isTripPickupReachedSync(targetBookingId) ||
        isTripOdometerCompletedSync(targetBookingId) ||
        isTripDestinationReachedSync(targetBookingId))
  );

  const effectiveIsOnTrip = Boolean(
    isOnTrip ||
      isStatusStarted ||
      trip?.startedAt ||
      (isMatchingActive && activeBooking?.startedAt) ||
      trip?.isTripStarted ||
      (isMatchingActive && activeBooking?.isTripStarted) ||
      isLocalStarted
  );

  // 1. Auto phone release if within 5 hours of pickup, or 2. Released by admin, or 3. Trip is in progress
  const isPhoneReleased = Boolean(
    trip?.customerPhoneReleased ||
      effectiveIsOnTrip ||
      ['TRIP_STARTED', 'ON_TRIP', 'COMPLETED', 'IN_PROGRESS', 'STARTED', 'DRIVER_EN_ROUTE'].includes(effectiveStatus) ||
      isTimingNear
  );

  const handleManageActiveTrip = () => {
    onClose();
    if (onSelectBooking && targetBookingId) onSelectBooking(targetBookingId);

    const isDestReached =
      trip?.isDestinationReached ||
      (targetBookingId && isTripDestinationReachedSync(targetBookingId)) ||
      trip?.tripEvents?.some(
        (e: any) => e.type === 'DRIVER_ARRIVED_AT_DESTINATION' || e.type === 'DESTINATION_REACHED'
      );
    if (isDestReached) {
      router.push({ pathname: '/trip/complete', params: { bookingId: targetBookingId } });
      return;
    }

    if (
      effectiveStatus === 'TRIP_STARTED' ||
      effectiveStatus === 'ON_TRIP' ||
      effectiveStatus === 'IN_PROGRESS' ||
      effectiveStatus === 'STARTED' ||
      trip?.startedAt ||
      (isMatchingActive && activeBooking?.startedAt)
    ) {
      router.push({ pathname: '/trip/active', params: { bookingId: targetBookingId } });
      return;
    }

    if (trip?.startingOdometer != null || (targetBookingId && isTripOdometerCompletedSync(targetBookingId))) {
      router.push({ pathname: '/trip/start', params: { bookingId: targetBookingId, step: '2', arrived: 'true' } });
      return;
    }

    if (
      (targetBookingId && isTripPickupReachedSync(targetBookingId)) ||
      trip?.tripEvents?.some((e: any) => e.type === 'DRIVER_ARRIVED_AT_PICKUP')
    ) {
      router.push({ pathname: '/trip/odometer', params: { bookingId: targetBookingId } });
      return;
    }

    if (
      (targetBookingId && isTripVerificationCompletedSync(targetBookingId)) ||
      (Array.isArray(trip?.vehicleInspectionPhotos) && trip.vehicleInspectionPhotos.filter(Boolean).length >= 4) ||
      effectiveStatus === 'DRIVER_EN_ROUTE'
    ) {
      router.push({ pathname: '/trip/en-route', params: { bookingId: targetBookingId } });
      return;
    }

    router.push({ pathname: '/trip/active', params: { bookingId: targetBookingId } });
  };

  const viaStopsList = parseViaStops(trip);
  const reqs = parseCustomerRequirements(trip, t);
  const note = extractCustomerNotes(trip);

  const pickupDateFormatted = tripDate
    ? tripDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '--';

  const pickupTimeFormatted = tripDate
    ? tripDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '--';

  const tripTypeDisplay = trip?.tripType
    ? trip.tripType === 'ONE_WAY'
      ? 'ONEWAY'
      : trip.tripType.replace(/_/g, ' ')
    : 'ONEWAY';

  const activeVendorCost = Math.round(
    Number(trip?.driverPayeeAmount || 0) > 0
      ? Number(trip.driverPayeeAmount)
      : Number(trip?.distanceKm || 0) * 13 + (Number(trip?.driverAllowance) || 300)
  );

  const handleSlideStartTrip = async () => {
    if (driver?.verificationStatus !== 'APPROVED') {
      Alert.alert(
        'Account Pending Approval',
        'Your account is currently under Admin Review. You cannot start any trip until the admin approves your account.'
      );
      return;
    }
    setIsStartingTrip(true);
    try {
      onClose();
      if (onSelectBooking) onSelectBooking(trip.id);

      // Determine the exact step the trip is already at so we never re-show submitted steps
      if (trip.status === 'COMPLETED' || trip.status === 'TRIP_COMPLETED' || trip.status === 'TRIP_ENDED') {
        router.push('/dashboard');
      } else if (trip.status === 'TRIP_STARTED' || trip.status === 'ON_TRIP' || trip.status === 'IN_PROGRESS') {
        router.push({
          pathname: '/trip/active',
          params: { bookingId: trip.id },
        });
      } else if (trip.startingOdometer != null || isTripOdometerCompletedSync(trip.id)) {
        router.push({
          pathname: '/trip/start',
          params: { bookingId: trip.id, step: '2', arrived: 'true' },
        });
      } else if (
        isTripPickupReachedSync(trip.id) ||
        trip.tripEvents?.some((e: any) => e.type === 'DRIVER_ARRIVED_AT_PICKUP')
      ) {
        router.push({
          pathname: '/trip/odometer',
          params: { bookingId: trip.id },
        });
      } else if (
        isTripVerificationCompletedSync(trip.id) ||
        (Array.isArray(trip.vehicleInspectionPhotos) && trip.vehicleInspectionPhotos.filter(Boolean).length >= 4) ||
        trip.status === 'DRIVER_EN_ROUTE'
      ) {
        router.push({
          pathname: '/trip/en-route',
          params: { bookingId: trip.id },
        });
      } else {
        router.push({
          pathname: '/trip/inspection',
          params: { bookingId: trip.id },
        });
      }
    } catch (err) {
      console.error('Error starting trip from upcoming card:', err);
    } finally {
      setIsStartingTrip(false);
    }
  };

  return (
    <View style={styles.tripCard}>
      {/* Top Row: Booking ID + Status Badge */}
      <View style={styles.bookingTopRow}>
        <View>
          <Text style={styles.bookingIdLabel}>Booking ID</Text>
          <Text style={styles.bookingIdNumber}>{trip?.humanReadableRef || 'TRIP'}</Text>
        </View>

        <View style={
          effectiveIsOnTrip
            ? styles.onTripBadge
            : (isTimingNear || isToday)
            ? styles.onRouteBadgeWarning
            : styles.onRouteBadgeScheduled
        }>
          <View style={
            effectiveIsOnTrip ? styles.onTripDot
            : (isTimingNear || isToday) ? styles.onRouteDotWarning
            : styles.onRouteDotScheduled
          } />
          <Text style={
            effectiveIsOnTrip ? styles.onTripBadgeText
            : (isTimingNear || isToday) ? styles.onRouteBadgeTextWarning
            : styles.onRouteBadgeTextScheduled
          }>
            {effectiveIsOnTrip ? 'ON TRIP' : (isTimingNear || isToday) ? 'PICKUP SOON' : 'SCHEDULED'}
          </Text>
        </View>
      </View>

      {/* Stepper Route */}
      <View style={styles.stepperContainer}>
        <View style={styles.stepperLeft}>
          {/* Pickup */}
          <TouchableOpacity
            style={styles.stepPoint}
            onPress={() => openNavigationMap(trip?.pickupLat, trip?.pickupLng, trip?.pickupAddress)}
            activeOpacity={0.7}
          >
            <Ionicons name="location-sharp" size={16} color="#16a34a" style={styles.pinIcon} />
            <View style={styles.stepTextGroup}>
              <Text style={styles.locationTitle}>{trip?.pickupAddress || 'Pickup Address'}</Text>
            </View>
          </TouchableOpacity>

          {/* Intermediate Stops */}
          {viaStopsList.map((stopName: string, stopIdx: number) => (
            <React.Fragment key={`stop-${stopIdx}`}>
              <View style={styles.dashedTrail} />
              <TouchableOpacity
                style={styles.stepPoint}
                onPress={() => openNavigationMap(undefined, undefined, stopName)}
                activeOpacity={0.7}
              >
                <View style={styles.stopNumCircle}>
                  <Text style={styles.stopNumText}>{stopIdx + 1}</Text>
                </View>
                <View style={styles.stepTextGroup}>
                  <Text style={styles.locationTitle}>{stopName}</Text>
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}

          <View style={styles.dashedTrail} />

          {/* Drop */}
          <TouchableOpacity
            style={styles.stepPoint}
            onPress={() => openNavigationMap(trip?.dropLat, trip?.dropLng, trip?.dropAddress)}
            activeOpacity={0.7}
          >
            <Ionicons name="location-sharp" size={16} color="#dc2626" style={styles.pinIcon} />
            <View style={styles.stepTextGroup}>
              <Text style={styles.locationTitle}>{trip?.dropAddress || 'Destination Address'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Route Navigation Button */}
        <TouchableOpacity
          style={styles.stepperViewRouteBtn}
          onPress={() => openNavigationMap(
            effectiveIsOnTrip ? trip?.dropLat : trip?.pickupLat,
            effectiveIsOnTrip ? trip?.dropLng : trip?.pickupLng,
            effectiveIsOnTrip ? trip?.dropAddress : trip?.pickupAddress
          )}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate" size={15} color="#2563eb" />
          <Text style={styles.stepperViewRouteText}>{effectiveIsOnTrip ? 'DROP-OFF ROUTE' : 'PICKUP LOCATION'}</Text>
          <Ionicons name="chevron-forward" size={13} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* 3-Column Info Row */}
      <View style={styles.infoThreeColsRow}>
        {/* Col 1: Pickup Date & Time */}
        <View style={styles.infoThreeCol}>
          <View style={styles.infoColHeaderRow}>
            <Ionicons name="calendar-outline" size={13} color="#64748b" />
            <Text style={styles.infoColHeaderLabel}>Pickup Date & Time</Text>
          </View>
          <Text style={styles.infoColValDark}>{pickupDateFormatted},</Text>
          <Text style={styles.infoColValDark}>{pickupTimeFormatted}</Text>
        </View>

        <View style={styles.infoColDivider} />

        {/* Col 2: Customer */}
        <View style={styles.infoThreeCol}>
          <View style={styles.infoColHeaderRow}>
            <Ionicons name="person" size={13} color="#2563eb" />
            <Text style={styles.infoColHeaderLabel}>Customer</Text>
          </View>
          <Text style={styles.infoColValDark} numberOfLines={1}>
            {trip?.customer?.user?.fullName || 'Customer'}
          </Text>
          {(effectiveIsOnTrip || isPhoneReleased) && trip?.customer?.user?.phone ? (
            <Text style={styles.infoColSubPhone}>{trip.customer.user.phone}</Text>
          ) : null}
        </View>

        <View style={styles.infoColDivider} />

        {/* Col 3: Trip Type & Distance */}
        <View style={styles.infoThreeCol}>
          <View style={styles.infoColHeaderRow}>
            <Ionicons name="swap-horizontal-outline" size={13} color="#64748b" />
            <Text style={styles.infoColHeaderLabel}>Trip Type</Text>
          </View>
          <Text style={[styles.infoColValDark, { textTransform: 'uppercase' }]} numberOfLines={1}>
            {tripTypeDisplay}
          </Text>
          <Text style={styles.infoColSubPhone}>{trip?.distanceKm || '--'} km</Text>
        </View>
      </View>

      {/* Customer Requirements Section */}
      {(reqs.length > 0 || note) && (
        <View style={styles.dispatchReqsSection}>
          <View style={styles.dispatchReqsHeaderRow}>
            <Ionicons name="options-outline" size={12} color="#64748b" />
            <Text style={styles.dispatchReqsHeading}>CUSTOMER REQUIREMENTS</Text>
          </View>
          <View style={styles.dispatchReqsRow}>
            {reqs.map((r, rIdx) => (
              <React.Fragment key={`req-${rIdx}`}>
                {rIdx > 0 && <View style={styles.reqLineSeparator} />}
                <View style={styles.reqPill}>
                  <Ionicons
                    name={r.icon as any}
                    size={12}
                    color={
                      r.type === 'highlight'
                        ? '#c2410c'
                        : r.type === 'warning'
                        ? '#b45309'
                        : r.type === 'info'
                        ? '#2563eb'
                        : '#334155'
                    }
                  />
                  <Text
                    style={[
                      styles.reqPillText,
                      r.type === 'highlight' && styles.reqPillTextHighlight,
                      r.type === 'warning' && styles.reqPillTextWarning,
                      r.type === 'info' && styles.reqPillTextInfo,
                    ]}
                  >
                    {r.label}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          {note ? (
            <View style={styles.dispatchNotesBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={12} color="#475569" style={{ marginTop: 1 }} />
              <Text style={styles.dispatchNotesText} numberOfLines={2}>
                Note: "{note}"
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* CTA based on trip state: If trip is ALREADY started, ONLY show MANAGE ACTIVE TRIP. Never show START TRIP */}
      {effectiveIsOnTrip ? (
        <View style={{ width: '100%', marginTop: 8 }}>
          <TouchableOpacity
            style={styles.manageActiveTripBtn}
            onPress={handleManageActiveTrip}
            activeOpacity={0.85}
          >
            <Ionicons name="navigate-circle" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.manageActiveTripBtnText}>MANAGE ACTIVE TRIP</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      ) : isPhoneReleased ? (
        <View style={styles.sliderContainer}>
          <SlideToAccept
            onAccept={handleSlideStartTrip}
            isAccepting={isStartingTrip}
            title={t('dashboard.slide_to_start_trip', { defaultValue: 'START TRIP' })}
            acceptingTitle={t('dashboard.starting_trip', { defaultValue: 'STARTING TRIP...' })}
          />
        </View>
      ) : null}

      {/* 3 Quick Action Buttons */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={[styles.quickActionPill, !effectiveIsOnTrip && !isPhoneReleased && styles.quickActionPillLocked]}
          onPress={() => {
            if (!effectiveIsOnTrip && !isPhoneReleased) {
              Alert.alert(
                'Phone Protected',
                'Customer contact details will auto-release 5 hours before scheduled pickup, or once released by Admin.'
              );
              return;
            }
            Linking.openURL(`tel:${trip?.customer?.user?.phone || ''}`);
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name={effectiveIsOnTrip || isPhoneReleased ? 'call' : 'lock-closed'}
            size={14}
            color={effectiveIsOnTrip || isPhoneReleased ? '#0f172a' : '#94a3b8'}
          />
          <Text style={[styles.quickActionText, !effectiveIsOnTrip && !isPhoneReleased && styles.quickActionTextLocked]}>
            {effectiveIsOnTrip || isPhoneReleased ? t('dashboard.call_customer', 'CALL') : 'Phone Locked'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionPill, !effectiveIsOnTrip && !isPhoneReleased && styles.quickActionPillLocked]}
          onPress={() => {
            if (!effectiveIsOnTrip && !isPhoneReleased) {
              Alert.alert(
                'Phone Protected',
                'Customer contact details will auto-release 5 hours before scheduled pickup, or once released by Admin.'
              );
              return;
            }
            Linking.openURL(`sms:${trip?.customer?.user?.phone || ''}`);
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name={effectiveIsOnTrip || isPhoneReleased ? 'chatbox' : 'lock-closed'}
            size={14}
            color={effectiveIsOnTrip || isPhoneReleased ? '#0f172a' : '#94a3b8'}
          />
          <Text style={[styles.quickActionText, !effectiveIsOnTrip && !isPhoneReleased && styles.quickActionTextLocked]}>
            {effectiveIsOnTrip || isPhoneReleased ? t('dashboard.message', 'MESSAGE') : 'Message Locked'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionPill}
          onPress={() => {
            Alert.alert(
              `Trip: ${trip?.humanReadableRef || 'Details'}`,
              `Pickup: ${trip?.pickupAddress || '--'}\nDrop: ${trip?.dropAddress || '--'}\nDistance: ${trip?.distanceKm || '--'} km\nCustomer: ${trip?.customer?.user?.fullName || 'Customer'}\nScheduled: ${pickupDateFormatted} ${pickupTimeFormatted}\nTrip Type: ${tripTypeDisplay}\nDriver Amount: ₹${activeVendorCost.toLocaleString('en-IN')}`
            );
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text" size={14} color="#0f172a" />
          <Text style={styles.quickActionText}>{t('dashboard.details', 'DETAILS')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    marginRight: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f2744',
    letterSpacing: -0.3,
  },
  headerCountBadge: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCountText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f2744',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBackBtn: {
    backgroundColor: '#0f2744',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBackBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  tripsListContainer: {
    gap: 8,
  },
  sectionGroup: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionHeadingOrange: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#c2410c',
    letterSpacing: 0.6,
  },
  sectionHeadingGrey: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  tripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  bookingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingIdLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  bookingIdNumber: {
    fontSize: 19,
    fontWeight: '900',
    color: '#ea580c',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  onRouteBadgeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onRouteDotWarning: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#dc2626',
  },
  onRouteBadgeTextWarning: {
    color: '#b91c1c',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  onRouteBadgeScheduled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onRouteDotScheduled: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#64748b',
  },
  onRouteBadgeTextScheduled: {
    color: '#475569',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginVertical: 4,
  },
  stepperLeft: {
    flex: 1,
  },
  stepPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  pinIcon: {
    marginTop: 1,
  },
  stepTextGroup: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  dashedTrail: {
    width: 2,
    height: 18,
    backgroundColor: '#cbd5e1',
    marginLeft: 7,
    marginVertical: 2,
  },
  stopNumCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stopNumText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400e',
  },
  stepperViewRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  stepperViewRouteText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
  },
  infoThreeColsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoThreeCol: {
    flex: 1,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  infoColDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 2,
    marginHorizontal: 2,
  },
  infoColHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginBottom: 4,
    width: '100%',
  },
  infoColHeaderLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
    textAlign: 'center',
  },
  infoColValDark: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 16,
    textAlign: 'center',
  },
  infoColSubPhone: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
  },
  dispatchReqsSection: {
    marginTop: 10,
    marginBottom: 4,
  },
  dispatchReqsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  dispatchReqsHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  dispatchReqsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  reqPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reqLineSeparator: {
    width: 1,
    height: 12,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 2,
  },
  reqPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  reqPillTextHighlight: {
    color: '#c2410c',
  },
  reqPillTextWarning: {
    color: '#b45309',
  },
  reqPillTextInfo: {
    color: '#2563eb',
  },
  dispatchNotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  dispatchNotesText: {
    flex: 1,
    fontSize: 11,
    fontStyle: 'italic',
    color: '#475569',
  },
  sliderContainer: {
    width: '100%',
    marginTop: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  quickActionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    borderRadius: 20,
  },
  quickActionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
  },
  quickActionPillLocked: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.85,
  },
  quickActionTextLocked: {
    color: '#94a3b8',
  },
  // ON TRIP badge
  onTripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  onTripDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16a34a',
  },
  onTripBadgeText: {
    color: '#15803d',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  // Section heading green (for ACTIVE ON TRIP section)
  sectionHeadingGreen: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#15803d',
    letterSpacing: 0.6,
  },
  // Manage Active Trip button
  manageActiveTripBtn: {
    width: '100%',
    backgroundColor: '#16a34a',
    borderRadius: 26,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  manageActiveTripBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});

