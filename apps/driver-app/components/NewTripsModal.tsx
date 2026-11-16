import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SlideToAccept } from './SlideToAccept';
import {
  formatTripDateTime,
  parseCustomerRequirements,
  extractCustomerNotes,
} from '../lib/tripRequirements';

interface NewTripsModalProps {
  visible: boolean;
  onClose: () => void;
  dispatches: any[];
  onAcceptDispatch: (dispatchId: string, bookingId: string) => Promise<void>;
  onDeclineDispatch: (dispatchId: string, bookingId: string) => Promise<void>;
  acceptingId: string | null;
  decliningId: string | null;
  driver?: any;
}

export function NewTripsModal({
  visible,
  onClose,
  dispatches = [],
  onAcceptDispatch,
  onDeclineDispatch,
  acceptingId,
  decliningId,
  driver,
}: NewTripsModalProps) {
  const { t } = useTranslation();

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
              <Ionicons name="flash" size={20} color="#ea580c" />
            </View>
            <View>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle}>
                  {t('dashboard.new_trips', 'New Trips')}
                </Text>
                {dispatches.length > 0 && (
                  <View style={styles.headerCountBadge}>
                    <Text style={styles.headerCountText}>{dispatches.length}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.headerSub}>
                {dispatches.length > 0
                  ? 'Slide right to accept and lock your ride assignment'
                  : 'Live ride requests dispatched by Admin'}
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
          {dispatches.length === 0 ? (
            /* Empty State */
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="flash-outline" size={42} color="#ea580c" />
              </View>
              <Text style={styles.emptyTitle}>
                {t('dashboard.no_new_trips_title', 'No New Trips Right Now')}
              </Text>
              <Text style={styles.emptyText}>
                {t(
                  'dashboard.no_new_trips_desc',
                  'When an admin dispatches a ride to you, it will pop up here instantly with Slide to Accept. Stay online on duty to receive requests along your route.'
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
              <Text style={styles.listSectionHeading}>
                ASSIGNED BY ADMIN ({dispatches.length})
              </Text>

              {dispatches.map((d, index) => {
                const b = d?.booking || {};
                const bookingId = b?.id || d.bookingId;
                const isAccepting = acceptingId === d.id;
                const isDeclining = decliningId === d.id;
                const tripTiming = formatTripDateTime(b?.scheduledAt, t);

                // Driver payee calculation
                const payeeAmount = Math.round(
                  Number(b?.driverPayeeAmount || 0) > 0
                    ? Number(b.driverPayeeAmount)
                    : Number(b?.distanceKm || 0) * 13 + (Number(b?.driverAllowance) || 300)
                );

                const reqs = parseCustomerRequirements(b, t);
                const note = extractCustomerNotes(b);

                return (
                  <View key={d.id || `dispatch-${index}`} style={styles.dispatchCard}>
                    {/* Card Header: Ride Ref, Trip Type, Distance, Fare */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.refGroup}>
                        <View style={styles.badgeLive}>
                          <View style={styles.pulseDot} />
                          <Text style={styles.badgeLiveText}>DISPATCHED</Text>
                        </View>
                        <Text style={styles.refText}>
                          {b?.humanReadableRef || 'NEW RIDE'}
                        </Text>
                      </View>

                      <View style={styles.fareGroup}>
                        <Text style={styles.fareAmount}>₹{payeeAmount.toLocaleString('en-IN')}</Text>
                        <Text style={styles.fareSub}>Driver Payee</Text>
                      </View>
                    </View>

                    {/* Trip Type & Distance Pill */}
                    <View style={styles.tripMetaPillsRow}>
                      <View style={styles.tripTypePill}>
                        <Ionicons name="car-sport-outline" size={12} color="#0f2744" style={{ marginRight: 4 }} />
                        <Text style={styles.tripTypePillText}>
                          {b?.tripType ? b.tripType.replace(/_/g, ' ') : 'ONE WAY'}
                          {b?.category ? ` • ${b.category}` : ''}
                        </Text>
                      </View>
                      {b?.distanceKm ? (
                        <View style={styles.distancePill}>
                          <Ionicons name="navigate-outline" size={12} color="#2563eb" style={{ marginRight: 4 }} />
                          <Text style={styles.distancePillText}>{b.distanceKm} km</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Pickup Date & Time Banner */}
                    <View style={styles.timeBanner}>
                      <Ionicons name="calendar-outline" size={14} color="#0284c7" style={{ marginRight: 6 }} />
                      <Text style={styles.timeBannerLabel}>PICKUP TIME:</Text>
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

                    {/* Stepper Route */}
                    <View style={styles.routeContainer}>
                      {/* Pickup */}
                      <View style={styles.routePointRow}>
                        <View style={styles.pinCircleGreen}>
                          <Ionicons name="location" size={12} color="#ffffff" />
                        </View>
                        <View style={styles.routeTextGroup}>
                          <Text style={styles.routeLabel}>PICKUP LOCATION</Text>
                          <Text style={styles.routeAddress}>{b?.pickupAddress || 'Pickup Address'}</Text>
                        </View>
                      </View>

                      {/* Route Line */}
                      <View style={styles.routeConnectorLine} />

                      {/* Drop */}
                      <View style={styles.routePointRow}>
                        <View style={styles.pinCircleRed}>
                          <Ionicons name="location" size={12} color="#ffffff" />
                        </View>
                        <View style={styles.routeTextGroup}>
                          <Text style={styles.routeLabel}>DROP DESTINATION</Text>
                          <Text style={styles.routeAddress}>{b?.dropAddress || 'Destination Address'}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Passenger Info */}
                    <View style={styles.passengerRow}>
                      <View style={styles.passengerLeft}>
                        <Ionicons name="person-circle-outline" size={18} color="#475569" style={{ marginRight: 6 }} />
                        <Text style={styles.passengerName}>
                          {b?.customer?.user?.fullName || 'Customer'}
                        </Text>
                      </View>
                      {b?.passengerCount ? (
                        <Text style={styles.passengerCount}>
                          👥 {b.passengerCount} {b.passengerCount === 1 ? 'Passenger' : 'Passengers'}
                        </Text>
                      ) : null}
                    </View>

                    {/* Special requirements / Notes */}
                    {(reqs.length > 0 || note) && (
                      <View style={styles.reqsContainer}>
                        {reqs.map((r, rIdx) => (
                          <View key={rIdx} style={styles.reqPill}>
                            <Ionicons name={r.icon as any} size={11} color="#475569" style={{ marginRight: 4 }} />
                            <Text style={styles.reqText}>{r.label}</Text>
                          </View>
                        ))}
                        {note ? (
                          <View style={styles.noteBox}>
                            <Text style={styles.noteText}>Note: "{note}"</Text>
                          </View>
                        ) : null}
                      </View>
                    )}

                    {/* SLIDE TO ACCEPT SLIDER */}
                    <View style={styles.sliderContainer}>
                      <SlideToAccept
                        onAccept={async () => {
                          await onAcceptDispatch(d.id, bookingId);
                          onClose();
                        }}
                        isAccepting={isAccepting}
                        disabled={isAccepting || isDeclining}
                        title="SLIDE TO ACCEPT"
                        acceptingTitle="ACCEPTING RIDE..."
                      />

                      {/* Decline Link */}
                      <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={() => {
                          Alert.alert(
                            'Decline Ride',
                            'Are you sure you want to pass on this ride assignment?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Decline',
                                style: 'destructive',
                                onPress: () => onDeclineDispatch(d.id, bookingId),
                              },
                            ]
                          );
                        }}
                        disabled={isAccepting || isDeclining}
                        activeOpacity={0.7}
                      >
                        {isDeclining ? (
                          <ActivityIndicator size="small" color="#dc2626" />
                        ) : (
                          <Text style={styles.declineBtnText}>Pass / Decline</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    backgroundColor: '#fff3e3',
    borderWidth: 1,
    borderColor: '#fed7aa',
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
    backgroundColor: '#ea580c',
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
    backgroundColor: '#fff3e3',
    borderWidth: 2,
    borderColor: '#fed7aa',
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
    gap: 16,
  },
  listSectionHeading: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  dispatchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    ...Platform.select({
      ios: {
        shadowColor: '#ea580c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
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
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ea580c',
    marginRight: 6,
  },
  badgeLiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
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
    fontSize: 22,
    fontWeight: '900',
    color: '#16a34a',
    letterSpacing: -0.5,
  },
  fareSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  tripMetaPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tripTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tripTypePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f2744',
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  distancePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
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
    marginBottom: 14,
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
    marginBottom: 12,
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
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 8,
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
  passengerCount: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  reqsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  reqPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reqText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  noteBox: {
    width: '100%',
    backgroundColor: '#fff7ed',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  noteText: {
    fontSize: 11,
    color: '#9a3412',
    fontStyle: 'italic',
  },
  sliderContainer: {
    marginTop: 6,
  },
  declineBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  declineBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#94a3b8',
    textDecorationLine: 'underline',
  },
});
