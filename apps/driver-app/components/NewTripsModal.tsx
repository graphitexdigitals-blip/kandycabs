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
              <Ionicons name="flash" size={19} color="#ea580c" />
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
                  ? 'Slide to accept and lock ride assignment'
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
                <Ionicons name="flash-outline" size={40} color="#ea580c" />
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
                  <View key={d.id || `dispatch-${index}`} style={styles.floatingDispatchCardWhite}>
                    {/* Header Banner: Negative Margins with #f8fafc background matching Image 1 */}
                    <View style={styles.dispatchHeaderBanner}>
                      <View style={styles.dispatchHeaderRow}>
                        <View>
                          <View style={styles.newAlertBadge}>
                            <Ionicons
                              name="radio-button-on"
                              size={13}
                              color="#2563eb"
                            />
                            <Text style={styles.newAlertText}>
                              {t('dashboard.new_ride', 'NEW RIDE')}
                            </Text>
                          </View>
                          <Text style={styles.dispatchRefText}>
                            {b?.humanReadableRef || 'RIDE'}
                          </Text>
                        </View>
                        <View style={styles.distanceBadgeLight}>
                          <Text style={styles.distanceBadgeTextLight}>
                            📍 {b?.distanceKm || '--'} km
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Trip Date & Pickup Time Banner */}
                    <View style={styles.tripDateBanner}>
                      <View style={styles.tripDateBannerLeft}>
                        <Ionicons name="calendar" size={14} color="#0284c7" />
                        <Text style={styles.tripDateBannerLabel}>
                          {t('dashboard.pickup_date_time_banner', { defaultValue: 'PICKUP DATE & TIME:' })}
                        </Text>
                        <Text style={styles.tripDateBannerValue}>
                          {tripTiming.fullText}
                        </Text>
                      </View>
                      {tripTiming.isToday ? (
                        <View style={styles.todayTagPill}>
                          <Text style={styles.todayTagText}>
                            {t('dashboard.today_tag', { defaultValue: 'TODAY' })}
                          </Text>
                        </View>
                      ) : tripTiming.isTomorrow ? (
                        <View style={styles.tomorrowTagPill}>
                          <Text style={styles.tomorrowTagText}>
                            {t('dashboard.tomorrow_tag', { defaultValue: 'TOMORROW' })}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Stepper Route (Clean open design without nested boxes) */}
                    <View style={styles.stepperContainer}>
                      <View style={styles.stepperLeft}>
                        {/* Pickup */}
                        <View style={styles.stepPoint}>
                          <Ionicons name="location-sharp" size={16} color="#16a34a" style={styles.pickupPin} />
                          <View style={styles.stepTextGroup}>
                            <Text style={styles.locationTitle}>{b?.pickupAddress || 'Pickup Location'}</Text>
                          </View>
                        </View>

                        {/* Connector line */}
                        <View style={styles.dashedTrail} />

                        {/* Drop */}
                        <View style={styles.stepPoint}>
                          <Ionicons name="location-sharp" size={16} color="#dc2626" style={styles.dropPin} />
                          <View style={styles.stepTextGroup}>
                            <Text style={styles.locationTitle}>{b?.dropAddress || 'Drop Location'}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Customer Requirements & Preferences Pills */}
                    {(reqs.length > 0 || note) && (
                      <View style={styles.dispatchReqsSection}>
                        <View style={styles.dispatchReqsHeaderRow}>
                          <Ionicons name="options-outline" size={12} color="#64748b" />
                          <Text style={styles.dispatchReqsHeading}>
                            {t('dashboard.customer_requirements', { defaultValue: 'CUSTOMER REQUIREMENTS' })}
                          </Text>
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

                    {/* Passenger, Driver Payee Amount In Between, & Trip Type Row */}
                    <View style={styles.dispatchPassengerRowLight}>
                      <Text style={styles.dispatchPassengerNameDark} numberOfLines={1}>
                        👤 {b?.customer?.user?.fullName || 'Customer'}
                      </Text>
                      <Text style={styles.dispatchVendorAmountCenter}>
                        ₹{payeeAmount.toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.dispatchTripTypeOrange}>
                        {b?.tripType ? (b.tripType === 'ONE_WAY' ? 'ONEWAY' : b.tripType.replace(/_/g, ' ')) : 'ONEWAY'}
                      </Text>
                    </View>

                    {/* SLIDE TO ACCEPT & DECLINE ACTIONS */}
                    <View style={styles.actionContainer}>
                      {/* Slide to Accept Slider */}
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

                      {/* Clean Decline Button matching Image 1 aesthetics */}
                      <TouchableOpacity
                        style={styles.declineDispatchOutlineBtn}
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
                            <Ionicons name="close-circle-outline" size={16} color="#dc2626" style={{ marginRight: 6 }} />
                            <Text style={styles.declineDispatchOutlineBtnText}>
                              {t('dashboard.decline_btn', { defaultValue: 'DECLINE RIDE' })}
                            </Text>
                          </>
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
    gap: 14,
  },

  /* EXACT IMAGE 1 CARD STYLES */
  floatingDispatchCardWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 3,
      },
    }),
  },
  dispatchHeaderBanner: {
    backgroundColor: '#f8fafc',
    marginHorizontal: -14,
    marginTop: -14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 10,
  },
  dispatchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  newAlertText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0f2744',
    letterSpacing: 0.3,
  },
  dispatchRefText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f2744',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  distanceBadgeLight: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  distanceBadgeTextLight: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f2744',
  },

  /* Trip Date Banner */
  tripDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingVertical: 5,
    marginTop: 2,
    marginBottom: 6,
  },
  tripDateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    flexWrap: 'wrap',
  },
  tripDateBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.5,
  },
  tripDateBannerValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f2744',
  },
  todayTagPill: {
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
  tomorrowTagPill: {
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

  /* Stepper Route */
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginVertical: 4,
  },
  stepperLeft: {
    flex: 1,
  },
  stepPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickupPin: {
    width: 18,
    textAlign: 'center',
  },
  dropPin: {
    width: 18,
    textAlign: 'center',
  },
  stepTextGroup: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f2744',
    lineHeight: 18,
  },
  dashedTrail: {
    width: 2,
    height: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginLeft: 8,
    marginVertical: 2,
  },

  /* Customer Requirements */
  dispatchReqsSection: {
    marginTop: 6,
    marginBottom: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dispatchReqsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  dispatchReqsHeading: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  dispatchReqsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  reqLineSeparator: {
    width: 1,
    height: 12,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 2,
  },
  reqPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reqPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  reqPillTextHighlight: {
    color: '#c2410c',
    fontWeight: '800',
  },
  reqPillTextWarning: {
    color: '#b45309',
    fontWeight: '800',
  },
  reqPillTextInfo: {
    color: '#2563eb',
    fontWeight: '800',
  },
  dispatchNotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
    padding: 6,
    backgroundColor: '#fff7ed',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  dispatchNotesText: {
    fontSize: 11,
    color: '#9a3412',
    fontStyle: 'italic',
    flex: 1,
  },

  /* Passenger, Amount, and Trip Type Row */
  dispatchPassengerRowLight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginTop: 4,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dispatchPassengerNameDark: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  dispatchVendorAmountCenter: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  dispatchTripTypeOrange: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },

  /* Actions Area */
  actionContainer: {
    marginTop: 6,
    gap: 10,
  },
  declineDispatchOutlineBtn: {
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineDispatchOutlineBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#dc2626',
    letterSpacing: 0.5,
  },
});
