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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SlideToAccept } from './SlideToAccept';
import { driverApiClient } from '../lib/api';
import {
  formatTripDateTime,
  parseCustomerRequirements,
  extractCustomerNotes,
  isTripPhoneReleased,
  getFleetDisplay,
} from '../lib/tripRequirements';
import {
  setTripInProcess,
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
  onOpenAssignedBooking?: (bookingId?: string) => void;
  onCancelBooking?: (bookingId: string, reason?: string) => Promise<void>;
}

export function UpcomingTripsModal({
  visible,
  onClose,
  upcomingBookings = [],
  activeBooking,
  driver,
  onSelectBooking,
  onOpenAssignedBooking,
  onCancelBooking,
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

      // If scheduled pickup date/time has already passed and trip was never started, exclude it from accepted bookings
      if (diff < 0) {
        return;
      }

      // Within 24 hours, or scheduled for Today or Tomorrow
      if (timing.isToday || timing.isTomorrow || diff <= 24 * 3600 * 1000) {
        withinOneDay.push(trip);
      } else {
        later.push(trip);
      }
    });

    return { onTripTrips: activeOnTrip, withinOneDayTrips: withinOneDay, laterTrips: later };
  }, [upcomingBookings, activeBooking, t]);

  const totalCount = onTripTrips.length + withinOneDayTrips.length + laterTrips.length;

  // Selected Date Filter: 'all' | 'today' | 'tomorrow' | 'day3' | 'date-YYYY-M-D'
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filterTabs = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const dayAfterTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
    const day3Num = dayAfterTomorrow.getDate();

    const getOrdinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const day3Ordinal = getOrdinal(day3Num);

    const allTrips = [...onTripTrips, ...withinOneDayTrips, ...laterTrips];
    let todayCount = 0;
    let tomorrowCount = 0;
    let day3Count = 0;
    const otherDateCounts: Record<string, { label: string; count: number; dateKey: string; timestamp: number }> = {};

    const todayTime = today.getTime();
    const tomorrowTime = tomorrow.getTime();
    const day3Time = dayAfterTomorrow.getTime();

    allTrips.forEach((trip) => {
      const dateVal = trip?.scheduledAt;
      if (!dateVal) {
        todayCount++;
        return;
      }
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) {
        todayCount++;
        return;
      }
      const tripDayTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (tripDayTime === todayTime) {
        todayCount++;
      } else if (tripDayTime === tomorrowTime) {
        tomorrowCount++;
      } else if (tripDayTime === day3Time) {
        day3Count++;
      } else {
        const key = `date-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        if (!otherDateCounts[key]) {
          otherDateCounts[key] = {
            label: getOrdinal(d.getDate()),
            count: 0,
            dateKey: key,
            timestamp: tripDayTime,
          };
        }
        otherDateCounts[key].count++;
      }
    });

    const tabs: Array<{ key: string; label: string; count: number }> = [
      { key: 'all', label: 'All', count: allTrips.length },
      { key: 'today', label: 'Today', count: todayCount },
      { key: 'tomorrow', label: 'Tomorrow', count: tomorrowCount },
      { key: 'day3', label: day3Ordinal, count: day3Count },
    ];

    Object.values(otherDateCounts)
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach((item) => {
        tabs.push({
          key: item.dateKey,
          label: item.label,
          count: item.count,
        });
      });

    return tabs;
  }, [onTripTrips, withinOneDayTrips, laterTrips]);

  const selectedTab = filterTabs.find((t) => t.key === selectedFilter);

  const filteredTrips = useMemo(() => {
    const allTrips = [...onTripTrips, ...withinOneDayTrips, ...laterTrips];
    if (selectedFilter === 'all') return allTrips;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDay = 24 * 60 * 60 * 1000;
    const tomorrow = today + oneDay;
    const day3Time = today + 2 * oneDay;

    return allTrips.filter((trip) => {
      const dateVal = trip?.scheduledAt;
      if (!dateVal) return selectedFilter === 'today';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return selectedFilter === 'today';
      const tripDayTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (selectedFilter === 'today') return tripDayTime === today;
      if (selectedFilter === 'tomorrow') return tripDayTime === tomorrow;
      if (selectedFilter === 'day3') return tripDayTime === day3Time;
      const key = `date-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      return key === selectedFilter;
    });
  }, [selectedFilter, onTripTrips, withinOneDayTrips, laterTrips]);

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
                  {t('dashboard.accepted_booking', 'Accepted Booking')}
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
                {t('dashboard.no_upcoming_trips_title', 'No Accepted Bookings')}
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
              {/* Date Filter Bar: All, Today, Tomorrow, 20th... */}
              {(totalCount > 0 || onTripTrips.length > 0) && (
                <View style={styles.filterBarContainer}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterBarContent}
                  >
                    {filterTabs.map((tab) => {
                      const isActive = selectedFilter === tab.key;
                      return (
                        <TouchableOpacity
                          key={tab.key}
                          style={[styles.filterBtn, isActive && styles.filterBtnActive]}
                          onPress={() => setSelectedFilter(tab.key)}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.filterBtnText,
                              isActive && styles.filterBtnTextActive,
                            ]}
                          >
                            {tab.label}
                          </Text>
                          {tab.count > 0 ? (
                            <View
                              style={[
                                styles.filterCountBadge,
                                isActive && styles.filterCountBadgeActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.filterCountText,
                                  isActive && styles.filterCountTextActive,
                                ]}
                              >
                                {tab.count}
                              </Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {selectedFilter === 'all' ? (
                <>
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
                          onOpenAssignedBooking={onOpenAssignedBooking}
                          onCancelBooking={onCancelBooking}
                          isAcceptedBookingView={true}
                          router={router}
                          t={t}
                        />
                      ))}
                    </View>
                  )}

                  {/* SECTION 1: CLOSER BEFORE 1 DAY (URGENT • BE READY) */}
                  {withinOneDayTrips.length > 0 && (
                    <View style={[styles.sectionGroup, onTripTrips.length > 0 && { marginTop: 14 }]}>
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
                          onOpenAssignedBooking={onOpenAssignedBooking}
                          onCancelBooking={onCancelBooking}
                          isAcceptedBookingView={true}
                          router={router}
                          t={t}
                        />
                      ))}
                    </View>
                  )}

                  {/* SECTION 2: LATER SCHEDULED BOOKINGS (> 1 DAY) */}
                  {laterTrips.length > 0 && (
                    <View
                      style={[
                        styles.sectionGroup,
                        (withinOneDayTrips.length > 0 || onTripTrips.length > 0) && { marginTop: 14 },
                      ]}
                    >
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
                          onOpenAssignedBooking={onOpenAssignedBooking}
                          onCancelBooking={onCancelBooking}
                          isAcceptedBookingView={true}
                          router={router}
                          t={t}
                        />
                      ))}
                    </View>
                  )}
                </>
              ) : filteredTrips.length === 0 ? (
                <View style={styles.filterEmptyContainer}>
                  <View style={styles.filterEmptyIconWrap}>
                    <Ionicons name="calendar-outline" size={32} color="#94a3b8" />
                  </View>
                  <Text style={styles.filterEmptyTitle}>
                    No trips scheduled for {selectedTab?.label}
                  </Text>
                  <Text style={styles.filterEmptySub}>
                    You have no accepted bookings scheduled for this date.
                  </Text>
                  <TouchableOpacity
                    style={styles.filterEmptyResetBtn}
                    onPress={() => setSelectedFilter('all')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.filterEmptyResetBtnText}>View All Bookings</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.sectionGroup}>
                  {filteredTrips.map((trip, idx) => {
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

                    return (
                      <UpcomingTripCard
                        key={trip.id || `filtered-${idx}`}
                        trip={trip}
                        isCloserBefore1Day={true}
                        isOnTrip={isTripInProcess}
                        activeBooking={activeBooking}
                        driver={driver}
                        onClose={onClose}
                        onSelectBooking={onSelectBooking}
                        onOpenAssignedBooking={onOpenAssignedBooking}
                        onCancelBooking={onCancelBooking}
                        isAcceptedBookingView={true}
                        router={router}
                        t={t}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function UpcomingTripCard({
  trip,
  isCloserBefore1Day,
  isOnTrip,
  activeBooking,
  driver,
  onClose,
  onSelectBooking,
  onOpenAssignedBooking,
  onCancelBooking,
  isAcceptedBookingView = false,
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
  onOpenAssignedBooking?: (bookingId?: string) => void;
  onCancelBooking?: (bookingId: string, reason?: string) => Promise<void>;
  isAcceptedBookingView?: boolean;
  router: any;
  t: any;
}) {
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [localCancelPending, setLocalCancelPending] = useState(false);

  const isCancelPending =
    localCancelPending ||
    trip?.isCancelRequested === true ||
    trip?.tripEvents?.some(
      (e: any) =>
        e.type === 'DRIVER_CANCEL_REQUESTED' &&
        !trip?.tripEvents?.some((a: any) => a.type === 'DRIVER_CANCEL_APPROVED')
    );

  const handleCancelPress = () => {
    const bookingRef = trip?.humanReadableRef || trip?.id || 'this trip';
    Alert.alert(
      t('dashboard.cancel_trip_confirm_title', 'Cancel Trip Assignment'),
      t(
        'dashboard.cancel_trip_confirm_msg',
        `Are you sure you want to cancel trip ${bookingRef}? A cancellation request will be submitted to Admin.`
      ),
      [
        { text: t('common.back', 'Back'), style: 'cancel' },
        {
          text: t('common.confirm_cancel', 'Yes, Cancel Trip'),
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              if (onCancelBooking) {
                await onCancelBooking(trip.id, 'Driver requested cancellation');
              } else {
                await driverApiClient.fetch('/api/driver/dispatches/decline', {
                  method: 'POST',
                  body: JSON.stringify({
                    dispatchId: `dispatch-${trip.id}`,
                    bookingId: trip.id,
                    reason: 'Driver requested cancellation',
                  }),
                });
              }
              setLocalCancelPending(true);
              Alert.alert(
                t('dashboard.cancel_req_sent_title', 'Cancellation Request Sent'),
                t('dashboard.cancel_req_sent_msg', 'Your cancellation request has been submitted to Admin.')
              );
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to submit cancellation request');
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

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
    isTripPhoneReleased(trip, activeBooking) ||
      trip?.customerPhoneReleased ||
      effectiveIsOnTrip ||
      ['TRIP_STARTED', 'ON_TRIP', 'COMPLETED', 'IN_PROGRESS', 'STARTED', 'DRIVER_EN_ROUTE'].includes(effectiveStatus) ||
      isTimingNear
  );

  const isReleasedForAssigned = Boolean(
    isTripPhoneReleased(trip, activeBooking) ||
      trip?.customerPhoneReleased ||
      effectiveIsOnTrip
  );

  const handleManageActiveTrip = async () => {
    onClose();
    if (onSelectBooking && targetBookingId) onSelectBooking(targetBookingId);
    if (targetBookingId) {
      await setTripInProcess(targetBookingId, true);
    }

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

    router.push({ pathname: '/trip/inspection', params: { bookingId: targetBookingId } });
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

  const vehicleDisplay = getFleetDisplay(trip).display;

  const activeVendorCost = Math.round(
    Number(trip?.driverPayeeAmount || 0) > 0
      ? Number(trip.driverPayeeAmount)
      : Number(trip?.distanceKm || 0) * 13 + (Number(trip?.driverAllowance) || 300)
  );
  const activeAllowance = Math.round(
    Number(trip?.driverAllowance) > 0
      ? Number(trip.driverAllowance)
      : 300
  );
  const activeVehicleCharges = Math.max(0, activeVendorCost - activeAllowance);

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
      if (trip?.id) {
        await setTripInProcess(trip.id, true);
      }
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
      {/* Top Row: Booking ID in one row with background color */}
      <View style={styles.bookingIdRowBanner}>
        <Text style={styles.bookingIdRowLabel}>Booking ID : </Text>
        <Text style={styles.bookingIdRowNumber}>{trip?.humanReadableRef || 'TRIP'}</Text>
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
      </View>

      {/* 2x2 Info Grid (2 sections per row) */}
      <View style={styles.infoGridContainer}>
        {/* Row 1: Pickup Date & Pickup Time */}
        <View style={styles.infoGridRow}>
          {/* Col 1: Pickup Date */}
          <View style={styles.infoCell}>
            <Ionicons name="calendar" size={22} color="#0f2744" style={styles.infoCellIcon} />
            <View style={styles.infoCellContent}>
              <Text style={styles.infoCellLabel}>Pickup Date</Text>
              <Text style={styles.infoCellValue} numberOfLines={1}>
                {pickupDateFormatted}
              </Text>
            </View>
          </View>

          <View style={styles.infoColDivider} />

          {/* Col 2: Pickup Time */}
          <View style={styles.infoCell}>
            <Ionicons name="time" size={22} color="#0f2744" style={styles.infoCellIcon} />
            <View style={styles.infoCellContent}>
              <Text style={styles.infoCellLabel}>Pickup Time</Text>
              <Text style={styles.infoCellValue} numberOfLines={1}>
                {pickupTimeFormatted}
              </Text>
            </View>
          </View>
        </View>

        {/* Horizontal Divider between rows */}
        <View style={styles.infoRowHorizontalDivider} />

        {/* Row 2: Vehicle & Trip Type with KM */}
        <View style={styles.infoGridRow}>
          {/* Col 1: Vehicle */}
          <View style={styles.infoCell}>
            <Ionicons name="car-sport" size={22} color="#0f2744" style={styles.infoCellIcon} />
            <View style={styles.infoCellContent}>
              <Text style={styles.infoCellLabel}>Vehicle</Text>
              <Text style={styles.infoCellValue} numberOfLines={2}>
                {vehicleDisplay}
              </Text>
            </View>
          </View>

          <View style={styles.infoColDivider} />

          {/* Col 2: Trip Type & Distance */}
          <View style={styles.infoCell}>
            <Ionicons name="swap-horizontal" size={22} color="#0f2744" style={styles.infoCellIcon} />
            <View style={styles.infoCellContent}>
              <Text style={styles.infoCellLabel}>Trip Type</Text>
              <Text style={[styles.infoCellValue, { textTransform: 'uppercase' }]} numberOfLines={1}>
                {tripTypeDisplay}
              </Text>
              <Text style={styles.infoCellSubPhone}>{trip?.distanceKm ? `${trip.distanceKm} km` : '-- km'}</Text>
            </View>
          </View>
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

      {/* In Accepted Booking: Show VIEW/DETAILS button (70%) + CANCEL button (30%) */}
      {isAcceptedBookingView ? (
        <View style={styles.viewTripActionContainer}>
          <View style={styles.actionButtonsRow}>
            {isReleasedForAssigned ? (
              <TouchableOpacity
                style={[styles.viewAssignedTripBtn, { flex: 7 }]}
                onPress={() => {
                  if (onOpenAssignedBooking) {
                    onOpenAssignedBooking(targetBookingId || trip?.id);
                  } else {
                    onClose();
                    if (onSelectBooking && (targetBookingId || trip?.id)) {
                      onSelectBooking(targetBookingId || trip?.id);
                    }
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="eye" size={15} color="#ffffff" style={{ marginRight: 5 }} />
                <Text style={styles.viewAssignedTripBtnText}>{t('dashboard.view', 'VIEW')}</Text>
                <Ionicons name="arrow-forward" size={14} color="#ffffff" style={{ marginLeft: 5 }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.viewAssignedTripBtn, { flex: 7 }]}
                onPress={() => {
                  const customerName = trip?.customer?.user?.fullName || trip?.customer?.name || trip?.customerName || trip?.passengerName || 'Customer';
                  Alert.alert(
                    `Trip: ${trip?.humanReadableRef || 'Details'}`,
                    `Customer: ${customerName}\nPickup: ${trip?.pickupAddress || '--'}\nDrop: ${trip?.dropAddress || '--'}\nDistance: ${trip?.distanceKm || '--'} km\nScheduled: ${pickupDateFormatted} ${pickupTimeFormatted}\nTrip Type: ${tripTypeDisplay}\nVehicle Charges: ₹${activeVehicleCharges.toLocaleString('en-IN')}\nChauffeur Allowance: ₹${activeAllowance.toLocaleString('en-IN')}\nTotal Amount: ₹${activeVendorCost.toLocaleString('en-IN')}`
                  );
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="document-text" size={14} color="#ffffff" style={{ marginRight: 5 }} />
                <Text style={styles.viewAssignedTripBtnText}>{t('dashboard.details', 'DETAILS')}</Text>
              </TouchableOpacity>
            )}

            {isCancelPending ? (
              <View style={[styles.cancelPendingActionBtn, { flex: 3 }]}>
                <Ionicons name="time-outline" size={12} color="#92400e" style={{ marginRight: 3 }} />
                <Text style={styles.cancelPendingActionBtnText} numberOfLines={1}>PENDING</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.cancelTripActionBtn, { flex: 3 }]}
                onPress={handleCancelPress}
                activeOpacity={0.8}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={14} color="#ffffff" style={{ marginRight: 3 }} />
                    <Text style={styles.cancelTripActionBtnText}>{t('common.cancel', 'CANCEL')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <>
          {/* CTA based on trip state: Show MANAGE TRIP in green */}
          {effectiveIsOnTrip ? (
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                style={styles.manageActiveTripBtn}
                onPress={handleManageActiveTrip}
                activeOpacity={0.85}
              >
                <Ionicons name="navigate-circle" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.manageActiveTripBtnText}>MANAGE TRIP</Text>
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

          {/* Quick Action Buttons */}
          <View style={styles.quickActionsRow}>
            {(effectiveIsOnTrip || isPhoneReleased) && (
              <TouchableOpacity
                style={styles.quickActionPill}
                onPress={() => {
                  Linking.openURL(`tel:${trip?.customer?.user?.phone || ''}`);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="call"
                  size={14}
                  color="#0f172a"
                />
                <Text style={styles.quickActionText}>
                  {t('dashboard.call_customer', 'CALL')}
                </Text>
              </TouchableOpacity>
            )}

            {(effectiveIsOnTrip || isPhoneReleased) && (
              <TouchableOpacity
                style={styles.quickActionPill}
                onPress={() => {
                  Linking.openURL(`sms:${trip?.customer?.user?.phone || ''}`);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="chatbox"
                  size={14}
                  color="#0f172a"
                />
                <Text style={styles.quickActionText}>
                  {t('dashboard.message', 'MESSAGE')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.quickActionPill, styles.quickActionDetailsPill]}
              onPress={() => {
                const customerName = trip?.customer?.user?.fullName || trip?.customer?.name || trip?.customerName || trip?.passengerName || 'Customer';
                Alert.alert(
                  `Trip: ${trip?.humanReadableRef || 'Details'}`,
                  `Customer: ${customerName}\nPickup: ${trip?.pickupAddress || '--'}\nDrop: ${trip?.dropAddress || '--'}\nDistance: ${trip?.distanceKm || '--'} km\nScheduled: ${pickupDateFormatted} ${pickupTimeFormatted}\nTrip Type: ${tripTypeDisplay}\nVehicle Charges: ₹${activeVehicleCharges.toLocaleString('en-IN')}\nChauffeur Allowance: ₹${activeAllowance.toLocaleString('en-IN')}\nTotal Amount: ₹${activeVendorCost.toLocaleString('en-IN')}`
                );
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text" size={14} color="#ffffff" />
              <Text style={[styles.quickActionText, styles.quickActionDetailsText]}>{t('dashboard.details', 'DETAILS')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
    paddingHorizontal: 16,
    paddingTop: 12,
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
  bookingIdRowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  bookingIdRowLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9a3412',
  },
  bookingIdRowNumber: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#ea580c',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.3,
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
  infoGridContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  infoGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  infoCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 8,
  },
  infoCellIcon: {
    marginRight: 2,
  },
  infoCellContent: {
    flex: 1,
    justifyContent: 'center',
  },
  infoCellLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  infoCellValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 17,
  },
  infoCellSubPhone: {
    fontSize: 10.5,
    color: '#ea580c',
    fontWeight: '700',
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoRowHorizontalDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 8,
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
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoColDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    alignSelf: 'stretch',
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
  viewTripActionContainer: {
    width: '100%',
    marginTop: 10,
  },
  actionButtonsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewAssignedTripBtn: {
    height: 38,
    backgroundColor: '#0f2744',
    paddingVertical: 0,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f2744',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  viewAssignedTripBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cancelTripActionBtn: {
    height: 38,
    backgroundColor: '#dc2626',
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  cancelTripActionBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cancelPendingActionBtn: {
    height: 38,
    backgroundColor: '#fef3c7',
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPendingActionBtnText: {
    color: '#92400e',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
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
  quickActionDetailsPill: {
    backgroundColor: '#0f2744',
    borderColor: '#0f2744',
  },
  quickActionDetailsText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
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
  // Filter Bar Styles
  filterBarContainer: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderTopWidth: 0,
    paddingVertical: 2,
    marginBottom: 8,
  },
  filterBarContent: {
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterBtnActive: {
    backgroundColor: '#0f2744',
    borderColor: '#0f2744',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  filterCountBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  filterCountTextActive: {
    color: '#ffffff',
  },
  filterEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  filterEmptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  filterEmptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f2744',
    marginBottom: 4,
    textAlign: 'center',
  },
  filterEmptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  filterEmptyResetBtn: {
    backgroundColor: '#0f2744',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  filterEmptyResetBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});

