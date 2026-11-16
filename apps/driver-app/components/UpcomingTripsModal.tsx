import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { formatTripDateTime } from '../lib/tripRequirements';

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

  // Split trips into "Closer before 1 day" vs "Later upcoming"
  const { withinOneDayTrips, laterTrips } = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const withinOneDay: any[] = [];
    const later: any[] = [];

    upcomingBookings.forEach((trip) => {
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

      // Within 24-36 hours or scheduled for Today or Tomorrow
      if (timing.isToday || timing.isTomorrow || (diff >= 0 && diff <= oneDayMs + 12 * 3600 * 1000)) {
        withinOneDay.push(trip);
      } else {
        later.push(trip);
      }
    });

    return { withinOneDayTrips: withinOneDay, laterTrips: later };
  }, [upcomingBookings, t]);

  const totalCount = upcomingBookings.length;

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
            <View style={styles.headerIconBadge}>
              <Ionicons name="calendar" size={20} color="#2563eb" />
            </View>
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
                {withinOneDayTrips.length > 0
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
          {totalCount === 0 ? (
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
              {/* SECTION 1: CLOSER BEFORE 1 DAY (URGENT • BE READY) */}
              {withinOneDayTrips.length > 0 && (
                <View style={styles.sectionGroup}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="time" size={15} color="#ea580c" />
                    <Text style={styles.sectionHeadingOrange}>
                      CLOSER BEFORE 1 DAY ({withinOneDayTrips.length})
                    </Text>
                  </View>

                  {withinOneDayTrips.map((trip, idx) => (
                    <UpcomingTripCard
                      key={trip.id || `closer-${idx}`}
                      trip={trip}
                      isCloserBefore1Day={true}
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
                <View style={[styles.sectionGroup, withinOneDayTrips.length > 0 && { marginTop: 14 }]}>
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
  onClose,
  onSelectBooking,
  router,
  t,
}: {
  trip: any;
  isCloserBefore1Day: boolean;
  onClose: () => void;
  onSelectBooking?: (id: string) => void;
  router: any;
  t: any;
}) {
  const tripTiming = formatTripDateTime(trip?.scheduledAt, t);

  const payeeAmount = Math.round(
    Number(trip?.driverPayeeAmount || 0) > 0
      ? Number(trip.driverPayeeAmount)
      : Number(trip?.distanceKm || 0) * 13 + (Number(trip?.driverAllowance) || 300)
  );

  return (
    <View style={[styles.tripCard, isCloserBefore1Day && styles.tripCardUrgent]}>
      {/* Urgent 1-Day Banner */}
      {isCloserBefore1Day && (
        <View style={styles.urgentBanner}>
          <Ionicons name="alert-circle" size={14} color="#c2410c" style={{ marginRight: 6 }} />
          <Text style={styles.urgentBannerText}>
            {tripTiming.isToday
              ? '⚠️ TRIP TODAY • BE READY FOR PICKUP!'
              : tripTiming.isTomorrow
              ? '⚠️ TRIP TOMORROW • SCHEDULED WITHIN 24 HOURS'
              : '⚠️ PICKUP CLOSER BEFORE 1 DAY • BE READY'}
          </Text>
        </View>
      )}

      {/* Top Row: Ref & Amount */}
      <View style={styles.cardTopRow}>
        <View style={styles.refGroup}>
          <View style={styles.badgeScheduled}>
            <Ionicons name="checkmark-done" size={12} color="#16a34a" style={{ marginRight: 4 }} />
            <Text style={styles.badgeScheduledText}>CONFIRMED</Text>
          </View>
          <Text style={styles.refText}>{trip?.humanReadableRef || 'SCHEDULED RIDE'}</Text>
        </View>

        <View style={styles.fareGroup}>
          <Text style={styles.fareAmount}>₹{payeeAmount.toLocaleString('en-IN')}</Text>
          <Text style={styles.fareSub}>Driver Allowance</Text>
        </View>
      </View>

      {/* Timing Banner */}
      <View style={[styles.timeBanner, isCloserBefore1Day && styles.timeBannerOrange]}>
        <Ionicons
          name="alarm-outline"
          size={15}
          color={isCloserBefore1Day ? '#c2410c' : '#0369a1'}
          style={{ marginRight: 6 }}
        />
        <Text style={[styles.timeBannerLabel, isCloserBefore1Day && { color: '#c2410c' }]}>
          PICKUP TIME:
        </Text>
        <Text style={styles.timeBannerValue}>{tripTiming.fullText}</Text>
        {tripTiming.isToday ? (
          <View style={styles.todayPill}>
            <Text style={styles.todayPillText}>TODAY</Text>
          </View>
        ) : tripTiming.isTomorrow ? (
          <View style={styles.tomorrowPill}>
            <Text style={styles.tomorrowPillText}>TOMORROW</Text>
          </View>
        ) : null}
      </View>

      {/* Route */}
      <View style={styles.routeContainer}>
        {/* Pickup */}
        <View style={styles.routePointRow}>
          <View style={styles.pinCircleGreen}>
            <Ionicons name="location" size={12} color="#ffffff" />
          </View>
          <View style={styles.routeTextGroup}>
            <Text style={styles.routeLabel}>PICKUP</Text>
            <Text style={styles.routeAddress}>{trip?.pickupAddress || 'Pickup Address'}</Text>
          </View>
        </View>

        <View style={styles.routeConnectorLine} />

        {/* Drop */}
        <View style={styles.routePointRow}>
          <View style={styles.pinCircleRed}>
            <Ionicons name="location" size={12} color="#ffffff" />
          </View>
          <View style={styles.routeTextGroup}>
            <Text style={styles.routeLabel}>DESTINATION</Text>
            <Text style={styles.routeAddress}>{trip?.dropAddress || 'Destination Address'}</Text>
          </View>
        </View>
      </View>

      {/* Customer & Distance */}
      <View style={styles.passengerRow}>
        <View style={styles.passengerLeft}>
          <Ionicons name="person-outline" size={14} color="#475569" style={{ marginRight: 6 }} />
          <Text style={styles.passengerName}>
            {trip?.customer?.user?.fullName || 'Customer'}
          </Text>
        </View>
        {trip?.distanceKm ? (
          <Text style={styles.distanceText}>📍 {trip.distanceKm} km</Text>
        ) : null}
      </View>

      {/* Action Area */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={() => {
            onClose();
            if (onSelectBooking) onSelectBooking(trip.id);
            router.push({
              pathname: '/trip/inspection',
              params: { bookingId: trip.id },
            });
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="car" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.detailsBtnText}>
            {tripTiming.isToday ? 'START VEHICLE INSPECTION' : 'VIEW TRIP DETAILS'}
          </Text>
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
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
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
  tripCardUrgent: {
    borderColor: '#fed7aa',
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  urgentBannerText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#c2410c',
    letterSpacing: 0.3,
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  refGroup: {
    flex: 1,
  },
  badgeScheduled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  badgeScheduledText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
    letterSpacing: 0.5,
  },
  refText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f2744',
    letterSpacing: -0.2,
  },
  fareGroup: {
    alignItems: 'flex-end',
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f2744',
    letterSpacing: -0.5,
  },
  fareSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  timeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  timeBannerOrange: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  timeBannerLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0369a1',
    marginRight: 6,
  },
  timeBannerValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f2744',
    flex: 1,
  },
  todayPill: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  todayPillText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#ffffff',
  },
  tomorrowPill: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tomorrowPillText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#ffffff',
  },
  routeContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pinCircleGreen: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pinCircleRed: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  routeTextGroup: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f2744',
    lineHeight: 17,
  },
  routeConnectorLine: {
    width: 2,
    height: 18,
    backgroundColor: '#cbd5e1',
    marginLeft: 10,
    marginVertical: 4,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  passengerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengerName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  distanceText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  actionRow: {
    marginTop: 4,
  },
  detailsBtn: {
    backgroundColor: '#0f2744',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  detailsBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
