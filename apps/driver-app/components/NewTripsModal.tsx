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
              <Ionicons name="flash" size={18} color="#ea580c" />
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
                  ? 'Accept or decline dispatched ride assignments'
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
                <Ionicons name="flash-outline" size={38} color="#ea580c" />
              </View>
              <Text style={styles.emptyTitle}>
                {t('dashboard.no_new_trips_title', 'No New Trips Right Now')}
              </Text>
              <Text style={styles.emptyText}>
                {t(
                  'dashboard.no_new_trips_desc',
                  'When an admin dispatches a ride to you, it will pop up here instantly. Stay online on duty to receive requests along your route.'
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
                  <View key={d.id || `dispatch-${index}`} style={styles.premiumCard}>
                    {/* Top Header Row: Live Alert Pill + Booking Ref + Distance */}
                    <View style={styles.topHeaderRow}>
                      <View style={styles.topHeaderLeft}>
                        <View style={styles.newRideBadge}>
                          <Ionicons name="radio-button-on" size={13} color="#2563eb" style={{ marginRight: 4 }} />
                          <Text style={styles.newRideBadgeText}>NEW RIDE</Text>
                        </View>
                        <Text style={styles.bookingRefText}>
                          {b?.humanReadableRef || 'RIDE'}
                        </Text>
                      </View>

                      {b?.distanceKm ? (
                        <View style={styles.distanceBadge}>
                          <Ionicons name="location-sharp" size={12} color="#ea580c" style={{ marginRight: 3 }} />
                          <Text style={styles.distanceBadgeText}>{b.distanceKm} km</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Earnings Hero Row */}
                    <View style={styles.earningsHeroRow}>
                      <View>
                        <Text style={styles.earningsAmount}>
                          ₹{payeeAmount.toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.earningsLabel}>Driver Payee Amount</Text>
                      </View>
                      <View style={styles.tripTypeTag}>
                        <Text style={styles.tripTypeTagText}>
                          {b?.tripType ? (b.tripType === 'ONE_WAY' ? 'ONEWAY' : b.tripType.replace(/_/g, ' ')) : 'ONEWAY'}
                          {b?.category ? ` • ${b.category}` : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Pickup Date & Time Banner */}
                    <View style={styles.pickupTimeBanner}>
                      <View style={styles.pickupTimeLeft}>
                        <Ionicons name="calendar" size={15} color="#0284c7" />
                        <Text style={styles.pickupTimeLabel}>PICKUP DATE & TIME:</Text>
                        <Text style={styles.pickupTimeValue}>{tripTiming.fullText}</Text>
                      </View>
                      {tripTiming.isToday ? (
                        <View style={styles.todayPill}>
                          <Text style={styles.todayTagText}>TODAY</Text>
                        </View>
                      ) : tripTiming.isTomorrow ? (
                        <View style={styles.tomorrowPill}>
                          <Text style={styles.tomorrowTagText}>TOMORROW</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Stepper Route (Clean & Open) */}
                    <View style={styles.routeContainer}>
                      {/* Pickup */}
                      <View style={styles.routePointRow}>
                        <View style={styles.pinCircleGreen}>
                          <Ionicons name="location-sharp" size={14} color="#16a34a" />
                        </View>
                        <View style={styles.routeTextCol}>
                          <Text style={styles.routeAddressText}>
                            {b?.pickupAddress || 'Pickup Location'}
                          </Text>
                        </View>
                      </View>

                      {/* Dashed Connecting Line */}
                      <View style={styles.connectorTrack}>
                        <View style={styles.connectorDashedLine} />
                      </View>

                      {/* Destination */}
                      <View style={styles.routePointRow}>
                        <View style={styles.pinCircleRed}>
                          <Ionicons name="location-sharp" size={14} color="#dc2626" />
                        </View>
                        <View style={styles.routeTextCol}>
                          <Text style={styles.routeAddressText}>
                            {b?.dropAddress || 'Destination Address'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Customer Requirements & Passenger Specs */}
                    <View style={styles.specsSection}>
                      <View style={styles.specsHeaderRow}>
                        <Ionicons name="options-outline" size={12} color="#64748b" />
                        <Text style={styles.specsHeading}>CUSTOMER REQUIREMENTS</Text>
                      </View>
                      <View style={styles.specsRow}>
                        <View style={styles.specChip}>
                          <Ionicons name="person" size={12} color="#0f2744" />
                          <Text style={styles.specChipText}>
                            {b?.customer?.user?.fullName || 'Customer'}
                          </Text>
                        </View>

                        {reqs.map((r, rIdx) => (
                          <View key={`req-${rIdx}`} style={styles.specChip}>
                            <Ionicons name={r.icon as any} size={12} color="#475569" />
                            <Text style={styles.specChipText}>{r.label}</Text>
                          </View>
                        ))}
                      </View>

                      {note ? (
                        <View style={styles.notesBox}>
                          <Ionicons name="chatbubble-ellipses-outline" size={13} color="#9a3412" style={{ marginTop: 1 }} />
                          <Text style={styles.notesText}>Note: "{note}"</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* ======================================================= */}
                    {/* REDESIGNED BUTTONS: HIGH-CONVERTING MODERN ACTIONS     */}
                    {/* ======================================================= */}
                    <View style={styles.actionsSection}>
                      {/* 1. Modern Side-by-Side Decline & Accept Buttons */}
                      <View style={styles.dualButtonsRow}>
                        {/* DECLINE BUTTON (Clean, Soft-Red Rounded Pill) */}
                        <TouchableOpacity
                          style={styles.modernDeclineBtn}
                          onPress={() => {
                            Alert.alert(
                              'Decline Ride',
                              'Are you sure you want to pass on this ride request?',
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
                          activeOpacity={0.8}
                        >
                          {isDeclining ? (
                            <ActivityIndicator size="small" color="#dc2626" />
                          ) : (
                            <>
                              <Ionicons name="close-circle-outline" size={18} color="#dc2626" style={{ marginRight: 6 }} />
                              <Text style={styles.modernDeclineBtnText}>DECLINE</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        {/* ACCEPT RIDE BUTTON (Rich Emerald Green with Checkmark) */}
                        <TouchableOpacity
                          style={styles.modernAcceptBtn}
                          onPress={async () => {
                            await onAcceptDispatch(d.id, bookingId);
                            onClose();
                          }}
                          disabled={isAccepting || isDeclining}
                          activeOpacity={0.85}
                        >
                          {isAccepting ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={19} color="#ffffff" style={{ marginRight: 6 }} />
                              <Text style={styles.modernAcceptBtnText}>ACCEPT RIDE</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* 2. Optional Slide To Accept for swipe convenience */}
                      <View style={styles.orDividerRow}>
                        <View style={styles.orDividerLine} />
                        <Text style={styles.orDividerText}>OR SLIDE TO LOCK</Text>
                        <View style={styles.orDividerLine} />
                      </View>

                      <View style={styles.sliderContainer}>
                        <SlideToAccept
                          onAccept={async () => {
                            await onAcceptDispatch(d.id, bookingId);
                            onClose();
                          }}
                          isAccepting={isAccepting}
                          disabled={isAccepting || isDeclining}
                          title={t('dashboard.slide_to_accept_caps', { defaultValue: 'SLIDE TO ACCEPT RIDE' })}
                          acceptingTitle={t('dashboard.accepting', { defaultValue: 'ACCEPTING RIDE...' })}
                        />
                      </View>
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    padding: 14,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
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

  /* PREMIUM REDESIGNED CARD */
  premiumCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 4,
      },
    }),
  },
  topHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newRideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  newRideBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  bookingRefText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f2744',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  distanceBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f2744',
  },

  /* Earnings Hero */
  earningsHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  earningsAmount: {
    fontSize: 25,
    fontWeight: '900',
    color: '#0f2744',
    letterSpacing: -0.5,
  },
  earningsLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#16a34a',
    marginTop: 1,
  },
  tripTypeTag: {
    backgroundColor: '#fff3e3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  tripTypeTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },

  /* Pickup Time Banner */
  pickupTimeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  pickupTimeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  pickupTimeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.5,
  },
  pickupTimeValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f2744',
  },
  todayPill: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 6,
  },
  todayTagText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  tomorrowPill: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tomorrowTagText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#d97706',
    letterSpacing: 0.5,
  },

  /* Route Stepper */
  routeContainer: {
    paddingHorizontal: 2,
    marginBottom: 12,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pinCircleGreen: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCircleRed: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeTextCol: {
    flex: 1,
  },
  routeAddressText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f2744',
    lineHeight: 18,
  },
  connectorTrack: {
    width: 22,
    alignItems: 'center',
    paddingVertical: 2,
  },
  connectorDashedLine: {
    width: 2,
    height: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },

  /* Specs Section */
  specsSection: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginBottom: 12,
  },
  specsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  specsHeading: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  specChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  specChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#fff7ed',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffedd5',
    marginTop: 4,
  },
  notesText: {
    fontSize: 11,
    color: '#9a3412',
    fontStyle: 'italic',
    flex: 1,
  },

  /* ========================================================= */
  /* REDESIGNED BUTTONS: DUAL ACTIONS + OPTIONAL SLIDER        */
  /* ========================================================= */
  actionsSection: {
    marginTop: 4,
    gap: 10,
  },
  dualButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modernDeclineBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#fff1f2',
    borderWidth: 1.5,
    borderColor: '#fecdd3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modernDeclineBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#dc2626',
    letterSpacing: 0.5,
  },
  modernAcceptBtn: {
    flex: 1.45,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  modernAcceptBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },

  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  orDividerText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
  },
  sliderContainer: {
    width: '100%',
  },
});
