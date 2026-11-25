import React, { useState, useMemo } from 'react';
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
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { UpcomingTripCard } from './UpcomingTripsModal';
import {
  formatTripDateTime,
  parseCustomerRequirements,
  extractCustomerNotes,
  getFleetDisplay,
} from '../lib/tripRequirements';

const CANCELLATION_REASONS = [
  'Vehicle Breakdown / Mechanical Issue',
  'Medical or Personal Emergency',
  'Heavy Traffic / Unable to Reach on Time',
  'Customer Requested Cancellation',
  'Distance Too Far / Fuel Issue',
  'Other Reason',
];

export function NewTripsPinIcon({
  size = 26,
  color = '#ea580c',
  style,
}: {
  size?: number;
  color?: string;
  dotColor?: string;
  style?: any;
}) {
  return (
    <MaterialCommunityIcons name="map-marker-plus" size={size} color={color} style={style} />
  );
}

interface NewTripsModalProps {
  visible: boolean;
  onClose: () => void;
  dispatches?: any[];
  phoneReleasedTrips?: any[];
  activeBooking?: any;
  onSelectBooking?: (id: string) => void;
  onAcceptDispatch?: (dispatchId: string, bookingId: string) => Promise<void>;
  onDeclineDispatch?: (dispatchId: string, bookingId: string, reason?: string) => Promise<void>;
  acceptingId?: string | null;
  decliningId?: string | null;
  driver?: any;
  acceptedDispatches?: Record<string, string>;
}

export function NewTripsModal({
  visible,
  onClose,
  dispatches = [],
  phoneReleasedTrips = [],
  activeBooking,
  onSelectBooking,
  onAcceptDispatch,
  onDeclineDispatch,
  acceptingId,
  decliningId,
  driver,
  acceptedDispatches,
}: NewTripsModalProps) {
  const { t } = useTranslation();
  const router = useRouter();

  // Cancellation Reason Modal State
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [targetCancelDispatch, setTargetCancelDispatch] = useState<{ dispatchId: string; bookingId: string } | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(CANCELLATION_REASONS[0]);
  const [customReasonText, setCustomReasonText] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Trip Details Modal State
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedTripDetails, setSelectedTripDetails] = useState<any>(null);

  const handleOpenCancelModal = (dispatchId: string, bookingId: string) => {
    setTargetCancelDispatch({ dispatchId, bookingId });
    setSelectedReason(CANCELLATION_REASONS[0]);
    setCustomReasonText('');
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (!targetCancelDispatch) return;
    const finalReason =
      selectedReason === 'Other Reason'
        ? customReasonText.trim() || 'Other reason'
        : selectedReason;

    setIsSubmittingCancel(true);
    try {
      if (onDeclineDispatch) {
        await onDeclineDispatch(
          targetCancelDispatch.dispatchId,
          targetCancelDispatch.bookingId,
          finalReason
        );
      }
      setCancelModalVisible(false);
      setTargetCancelDispatch(null);
      Alert.alert(
        'Ride Declined',
        'You have declined this ride request.'
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to decline ride request');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Only count brand new dispatches assigned by admin that are awaiting driver action
  // Do NOT show count / badge if trip is accepted, declined, cancelled, or pending admin cancellation
  const newTripsPendingCount = useMemo(() => {
    return (dispatches || []).filter((d) => {
      const b = d?.booking || {};
      const cancelReqEvent = b?.tripEvents?.find((e: any) => e.type === 'DRIVER_CANCEL_REQUESTED');
      const cancelAppEvent = b?.tripEvents?.find((e: any) => e.type === 'DRIVER_CANCEL_APPROVED');
      const isCancelPending =
        Boolean(d?.isCancelRequested) ||
        Boolean(b?.isCancelRequested) ||
        (Boolean(cancelReqEvent) &&
          (!cancelAppEvent || new Date(cancelReqEvent.createdAt) > new Date(cancelAppEvent.createdAt)));

      const isAccepted =
        d?.status === 'ACCEPTED' ||
        d?.isAccepted ||
        b?.status === 'DRIVER_ACCEPTED' ||
        Boolean(d?.bookingId && acceptedDispatches?.[d.bookingId]) ||
        Boolean(d?.id && acceptedDispatches?.[d.id]) ||
        isCancelPending;

      return !isAccepted && !isCancelPending;
    }).length;
  }, [dispatches, acceptedDispatches]);

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
            <NewTripsPinIcon size={25} color="#ea580c" style={styles.headerIcon} />
            <View>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle}>
                  {t('dashboard.assigned_booking', 'Assigned Booking')}
                </Text>
                {((phoneReleasedTrips?.length || 0) + (newTripsPendingCount || 0)) > 0 && (
                  <View style={styles.headerCountBadge}>
                    <Text style={styles.headerCountText}>
                      {(phoneReleasedTrips?.length || 0) + (newTripsPendingCount || 0)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.headerSub}>
                {phoneReleasedTrips && phoneReleasedTrips.length > 0
                  ? `${phoneReleasedTrips.length} ride(s) ready to slide & start`
                  : t('dashboard.assigned_booking_sub', 'View and start your trip')}
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
          {(!phoneReleasedTrips || phoneReleasedTrips.length === 0) && dispatches.length === 0 ? (
            /* Empty State */
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="navigate-outline" size={44} color="#ea580c" />
              </View>
              <Text style={styles.emptyTitle}>
                {t('dashboard.no_trips_to_start_title', 'No Trips Ready to Start')}
              </Text>
              <Text style={styles.emptyText}>
                {t(
                  'dashboard.no_trips_to_start_desc',
                  'When your assigned trip is within 5 hours of pickup or customer phone is released, you can view and start your trip right here.'
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
              {/* SECTION 1: TRIPS READY TO START (Phone released -> slide to start trip) */}
              {phoneReleasedTrips && phoneReleasedTrips.length > 0 && (
                <View style={styles.sectionGroup}>
                  {phoneReleasedTrips.map((trip: any, idx: number) => (
                    <UpcomingTripCard
                      key={trip.id || `ready-${idx}`}
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

              {/* SECTION 2: NEW DISPATCHES (Awaiting Accept / Decline) */}
              {dispatches.length > 0 && (
                <View style={[styles.sectionGroup, (phoneReleasedTrips && phoneReleasedTrips.length > 0) && { marginTop: 14 }]}>
                  {phoneReleasedTrips && phoneReleasedTrips.length > 0 && (
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="radio-button-on" size={14} color="#2563eb" />
                      <Text style={styles.sectionHeadingBlue}>
                        {t('dashboard.pending_dispatches', 'NEW RIDE REQUESTS')} ({dispatches.length})
                      </Text>
                    </View>
                  )}
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

                const cancelReqEvent = b?.tripEvents?.find((e: any) => e.type === 'DRIVER_CANCEL_REQUESTED');
                const cancelAppEvent = b?.tripEvents?.find((e: any) => e.type === 'DRIVER_CANCEL_APPROVED');
                const isCancelPending =
                  Boolean(d?.isCancelRequested) ||
                  Boolean(b?.isCancelRequested) ||
                  (Boolean(cancelReqEvent) &&
                    (!cancelAppEvent || new Date(cancelReqEvent.createdAt) > new Date(cancelAppEvent.createdAt)));

                const isAccepted =
                  d?.status === 'ACCEPTED' ||
                  d?.isAccepted ||
                  b?.status === 'DRIVER_ACCEPTED' ||
                  Boolean(bookingId && acceptedDispatches?.[bookingId]) ||
                  Boolean(d.id && acceptedDispatches?.[d.id]) ||
                  isCancelPending;

                return (
                  <View key={d.id || `dispatch-${index}`} style={styles.floatingDispatchCardWhite}>
                    {/* Header Banner: Negative Margins with #f8fafc background matching Image 1 */}
                    <View style={styles.dispatchHeaderBanner}>
                      <View style={styles.dispatchHeaderRow}>
                        <View>
                          {isCancelPending ? (
                            <View style={styles.cancelPendingAlertBadge}>
                              <Ionicons
                                name="time"
                                size={13}
                                color="#b45309"
                              />
                              <Text style={styles.cancelPendingAlertText}>
                                {t('dashboard.cancellation_requested', 'CANCELLATION REQUESTED')}
                              </Text>
                            </View>
                          ) : isAccepted ? (
                            <View style={styles.acceptedAlertBadge}>
                              <Ionicons
                                name="checkmark-circle"
                                size={13}
                                color="#16a34a"
                              />
                              <Text style={styles.acceptedAlertText}>
                                {t('dashboard.accepted_by_driver', 'ACCEPTED BY DRIVER')}
                              </Text>
                            </View>
                          ) : (
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
                          )}
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

                    {/* Stepper Route (Clean open design matching Image 1) */}
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

                    {/* Trip Details Table: Rows & Columns matching Reference */}
                    {(() => {
                      const fleet = getFleetDisplay(b);
                      const tripTypeText = b?.tripType ? (b.tripType === 'ONE_WAY' ? 'ONEWAY' : b.tripType.replace(/_/g, ' ')) : 'ONEWAY';
                      const passengerName = b?.customer?.user?.fullName || 'Customer';

                      return (
                        <View style={styles.dispatchTableContainer}>
                          {/* Row 1: Selected Fleet */}
                          <View style={styles.dispatchTableRow}>
                            <View style={styles.dispatchTableColLabel}>
                              <Text style={styles.dispatchTableLabelText}>
                                {t('dashboard.fleet_label', { defaultValue: 'Fleet' })}
                              </Text>
                            </View>
                            <View style={styles.dispatchTableColValue}>
                              <View style={styles.dispatchTableFleetRow}>
                                <Ionicons name="car-sport" size={13} color="#0f766e" style={{ marginRight: 6 }} />
                                <Text style={styles.dispatchTableFleetText} numberOfLines={1}>
                                  {fleet.display}
                                </Text>
                                <View style={styles.dispatchTableCategoryPill}>
                                  <Text style={styles.dispatchTableCategoryPillText}>
                                    {fleet.category}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>

                          {/* Row 2: Passenger */}
                          <View style={styles.dispatchTableRow}>
                            <View style={styles.dispatchTableColLabel}>
                              <Text style={styles.dispatchTableLabelText}>
                                {t('dashboard.passenger_label', { defaultValue: 'Passenger' })}
                              </Text>
                            </View>
                            <View style={styles.dispatchTableColValue}>
                              <View style={styles.dispatchTableValueRow}>
                                <Ionicons name="person" size={12} color="#2563eb" style={{ marginRight: 6 }} />
                                <Text style={styles.dispatchTableValueText} numberOfLines={1}>
                                  {passengerName}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Row 3: Trip Type */}
                          <View style={styles.dispatchTableRow}>
                            <View style={styles.dispatchTableColLabel}>
                              <Text style={styles.dispatchTableLabelText}>
                                {t('dashboard.trip_type_label', { defaultValue: 'Trip type' })}
                              </Text>
                            </View>
                            <View style={styles.dispatchTableColValue}>
                              <View style={styles.dispatchTableValueRow}>
                                <View style={styles.dispatchTripTypeBadge}>
                                  <Text style={styles.dispatchTripTypeBadgeText}>
                                    {tripTypeText}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>

                          {/* Row 4: Net Payout Amount (Reference style: "Net payout amount | Rs ...") */}
                          <View style={[styles.dispatchTableRow, styles.dispatchTableRowLast]}>
                            <View style={[styles.dispatchTableColLabel, styles.dispatchTableColLabelHighlight]}>
                              <Text style={styles.dispatchTableLabelHighlightText}>
                                {t('dashboard.net_payout_amount', { defaultValue: 'Net payout amount' })}
                              </Text>
                            </View>
                            <View style={[styles.dispatchTableColValue, styles.dispatchTableColValueHighlight]}>
                              <Text style={styles.dispatchTablePayoutValue}>
                                ₹{payeeAmount.toLocaleString('en-IN')}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })()}

                    {/* Action Buttons Row: (Pending Admin) if cancel requested, or (Cancel Ride & Details) if accepted, or (Decline & Accept) if pending */}
                    {isCancelPending ? (
                      <View style={styles.dispatchActionRow}>
                        <View style={styles.cancelPendingBtn}>
                          <Ionicons name="time-outline" size={16} color="#92400e" style={{ marginRight: 5 }} />
                          <Text style={styles.cancelPendingBtnText}>
                            PENDING ADMIN APPROVAL
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.detailsRideBtn}
                          onPress={() => {
                            setSelectedTripDetails({
                              booking: b,
                              timing: tripTiming,
                              payeeAmount,
                              reqs,
                              note,
                            });
                            setDetailsModalVisible(true);
                          }}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="document-text-outline" size={17} color="#ffffff" style={{ marginRight: 5 }} />
                          <Text style={styles.detailsRideBtnText}>
                            {t('dashboard.details_btn', { defaultValue: 'DETAILS' })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : isAccepted ? (
                      <View style={styles.dispatchActionRow}>
                        <TouchableOpacity
                          style={styles.cancelRideBtn}
                          onPress={() => handleOpenCancelModal(d.id, bookingId)}
                          disabled={isDeclining || isSubmittingCancel}
                          activeOpacity={0.85}
                        >
                          {isDeclining ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <>
                              <Ionicons name="close-circle-outline" size={17} color="#ffffff" style={{ marginRight: 5 }} />
                              <Text style={styles.cancelRideBtnText}>
                                {t('dashboard.cancel_ride_btn', { defaultValue: 'CANCEL RIDE' })}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.detailsRideBtn}
                          onPress={() => {
                            setSelectedTripDetails({
                              booking: b,
                              timing: tripTiming,
                              payeeAmount,
                              reqs,
                              note,
                            });
                            setDetailsModalVisible(true);
                          }}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="document-text-outline" size={17} color="#ffffff" style={{ marginRight: 5 }} />
                          <Text style={styles.detailsRideBtnText}>
                            {t('dashboard.details_btn', { defaultValue: 'DETAILS' })}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.dispatchActionRow}>
                        <TouchableOpacity
                          style={styles.declineDispatchBtn}
                          onPress={() => handleOpenCancelModal(d.id, bookingId)}
                          disabled={isAccepting || isDeclining}
                          activeOpacity={0.8}
                        >
                          {isDeclining ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <>
                              <Ionicons name="close-circle-outline" size={17} color="#ffffff" style={{ marginRight: 4 }} />
                              <Text style={styles.declineDispatchBtnText}>
                                {t('dashboard.decline_btn', { defaultValue: 'DECLINE' })}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.acceptDispatchBtn}
                          onPress={async () => {
                            if (onAcceptDispatch) {
                              await onAcceptDispatch(d.id, bookingId);
                            }
                          }}
                          disabled={isAccepting || isDeclining}
                          activeOpacity={0.85}
                        >
                          {isAccepting ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={17} color="#ffffff" style={{ marginRight: 4 }} />
                              <Text style={styles.acceptDispatchBtnText}>
                                {t('dashboard.accept_ride_btn', { defaultValue: 'ACCEPT RIDE' })}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Dedicated Cancellation Reason Modal */}
        <Modal
          visible={cancelModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!isSubmittingCancel) setCancelModalVisible(false);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.cancelModalOverlay}
          >
            <View style={styles.cancelModalCard}>
              <View style={styles.cancelModalHeader}>
                <View style={styles.cancelModalIconWrap}>
                  <Ionicons name="alert-circle" size={28} color="#dc2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cancelModalTitle}>Decline Ride Request</Text>
                  <Text style={styles.cancelModalSubtitle}>
                    Please select a reason for declining this ride.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (!isSubmittingCancel) setCancelModalVisible(false);
                  }}
                  style={styles.cancelModalCloseBtn}
                  disabled={isSubmittingCancel}
                >
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.cancelReasonsList} showsVerticalScrollIndicator={false}>
                {CANCELLATION_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      style={[styles.reasonOptionRow, isSelected && styles.reasonOptionRowSelected]}
                      onPress={() => setSelectedReason(reason)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.reasonRadioOuter, isSelected && styles.reasonRadioOuterSelected]}>
                        {isSelected && <View style={styles.reasonRadioInner} />}
                      </View>
                      <Text style={[styles.reasonOptionText, isSelected && styles.reasonOptionTextSelected]}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {selectedReason === 'Other Reason' && (
                  <View style={styles.customReasonInputWrap}>
                    <TextInput
                      style={styles.customReasonInput}
                      placeholder="Enter cancellation reason..."
                      placeholderTextColor="#94a3b8"
                      value={customReasonText}
                      onChangeText={setCustomReasonText}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                )}
              </ScrollView>

              <View style={styles.cancelModalActions}>
                <TouchableOpacity
                  style={styles.cancelModalBackBtn}
                  onPress={() => setCancelModalVisible(false)}
                  disabled={isSubmittingCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelModalBackBtnText}>Keep Ride</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cancelModalConfirmBtn,
                    selectedReason === 'Other Reason' && !customReasonText.trim() && { opacity: 0.5 },
                  ]}
                  disabled={
                    isSubmittingCancel ||
                    (selectedReason === 'Other Reason' && !customReasonText.trim())
                  }
                  onPress={handleConfirmCancel}
                  activeOpacity={0.8}
                >
                  {isSubmittingCancel ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.cancelModalConfirmBtnText}>Decline Ride</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Dedicated Trip Details Modal */}
        <Modal
          visible={detailsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDetailsModalVisible(false)}
        >
          <View style={styles.cancelModalOverlay}>
            <View style={[styles.cancelModalCard, { maxHeight: '90%' }]}>
              <View style={styles.cancelModalHeader}>
                <View style={styles.cancelModalIconWrap}>
                  <Ionicons name="document-text" size={26} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cancelModalTitle}>
                    {selectedTripDetails?.booking?.humanReadableRef || 'Trip Details'}
                  </Text>
                  <Text style={styles.cancelModalSubtitle}>
                    Ride Assignment Information
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDetailsModalVisible(false)}
                  style={styles.cancelModalCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Status Badge */}
                <View style={{ marginBottom: 14 }}>
                  <View style={styles.acceptedAlertBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#16a34a" />
                    <Text style={styles.acceptedAlertText}>ACCEPTED BY DRIVER</Text>
                  </View>
                </View>

                {/* Pickup Date & Time */}
                <View style={styles.detailsInfoBox}>
                  <View style={styles.detailsInfoRow}>
                    <Ionicons name="calendar-outline" size={16} color="#0284c7" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailsInfoLabel}>Pickup Date & Time</Text>
                      <Text style={styles.detailsInfoValue}>
                        {selectedTripDetails?.timing?.fullText || '--'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Stepper Route */}
                <View style={styles.detailsInfoBox}>
                  <Text style={styles.detailsInfoSectionTitle}>ROUTE DETAILS</Text>
                  <View style={{ marginTop: 8 }}>
                    <View style={styles.stepPoint}>
                      <Ionicons name="location-sharp" size={16} color="#16a34a" style={styles.pickupPin} />
                      <View style={styles.stepTextGroup}>
                        <Text style={styles.detailsLocationLabel}>Pickup Location</Text>
                        <Text style={styles.locationTitle}>
                          {selectedTripDetails?.booking?.pickupAddress || 'Pickup Address'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dashedTrail} />
                    <View style={styles.stepPoint}>
                      <Ionicons name="location-sharp" size={16} color="#dc2626" style={styles.dropPin} />
                      <View style={styles.stepTextGroup}>
                        <Text style={styles.detailsLocationLabel}>Drop Destination</Text>
                        <Text style={styles.locationTitle}>
                          {selectedTripDetails?.booking?.dropAddress || 'Drop Address'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.detailsDistanceRow}>
                    <Text style={styles.detailsDistanceText}>
                      Total Distance: {selectedTripDetails?.booking?.distanceKm || '--'} km
                    </Text>
                    <Text style={styles.detailsTripTypeText}>
                      {selectedTripDetails?.booking?.tripType
                        ? selectedTripDetails.booking.tripType.replace(/_/g, ' ')
                        : 'ONE WAY'}
                    </Text>
                  </View>
                </View>

                {/* Customer & Fare */}
                <View style={styles.detailsInfoBox}>
                  <Text style={styles.detailsInfoSectionTitle}>CUSTOMER & DRIVER PAYEE</Text>
                  <View style={[styles.detailsInfoRow, { marginTop: 8 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailsInfoLabel}>Passenger Name</Text>
                      <Text style={styles.detailsInfoValue}>
                        {selectedTripDetails?.booking?.customer?.user?.fullName || 'Customer'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.detailsInfoLabel}>Driver Fare Amount</Text>
                      <Text style={[styles.detailsInfoValue, { color: '#16a34a', fontSize: 16, fontWeight: '900' }]}>
                        ₹{selectedTripDetails?.payeeAmount?.toLocaleString('en-IN') || '--'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Customer Requirements */}
                {selectedTripDetails?.reqs && selectedTripDetails.reqs.length > 0 && (
                  <View style={styles.detailsInfoBox}>
                    <Text style={styles.detailsInfoSectionTitle}>CUSTOMER REQUIREMENTS</Text>
                    <View style={[styles.dispatchReqsRow, { marginTop: 8 }]}>
                      {selectedTripDetails.reqs.map((r: any, rIdx: number) => (
                        <View key={`modal-req-${rIdx}`} style={styles.reqPill}>
                          <Ionicons name={r.icon as any} size={13} color="#2563eb" />
                          <Text style={styles.reqPillText}>{r.label}</Text>
                        </View>
                      ))}
                    </View>
                    {selectedTripDetails?.note ? (
                      <View style={[styles.dispatchNotesBox, { marginTop: 8 }]}>
                        <Ionicons name="chatbubble-ellipses-outline" size={13} color="#475569" style={{ marginTop: 1 }} />
                        <Text style={styles.dispatchNotesText}>
                          Note: "{selectedTripDetails.note}"
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </ScrollView>

              {/* Close Button */}
              <View style={{ marginTop: 14 }}>
                <TouchableOpacity
                  style={styles.detailsCloseBtn}
                  onPress={() => setDetailsModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.detailsCloseBtnText}>Close Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    gap: 14,
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
  sectionHeadingGreen: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#15803d',
    letterSpacing: 0.6,
  },
  sectionHeadingBlue: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#2563eb',
    letterSpacing: 0.6,
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

  /* Table Grid: Rows and Columns matching Reference */
  dispatchTableContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  dispatchTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    minHeight: 34,
    alignItems: 'stretch',
  },
  dispatchTableRowLast: {
    borderBottomWidth: 0,
  },
  dispatchTableColLabel: {
    width: 128,
    backgroundColor: '#f8fafc',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    paddingHorizontal: 9,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  dispatchTableLabelText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  dispatchTableColValue: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 9,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  dispatchTableFleetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  dispatchTableFleetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  dispatchTableCategoryPill: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  dispatchTableCategoryPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0f766e',
  },
  dispatchTableValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dispatchTableValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  dispatchTripTypeBadge: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  dispatchTripTypeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#c2410c',
    letterSpacing: 0.4,
  },
  dispatchTableColLabelHighlight: {
    backgroundColor: '#f1f5f9',
  },
  dispatchTableLabelHighlightText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  dispatchTableColValueHighlight: {
    backgroundColor: '#f8fafc',
  },
  dispatchTablePayoutValue: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0f766e',
  },

  /* Decline & Accept Action Buttons Row - EXACTLY AS IMAGE 1 */
  dispatchActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  declineDispatchBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#dc2626',
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineDispatchBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  acceptDispatchBtn: {
    flex: 1.45,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  acceptDispatchBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },

  /* Accepted State Badge & Button */
  acceptedAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 3,
    gap: 4,
  },
  acceptedAlertText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  cancelPendingAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 3,
    gap: 4,
  },
  cancelPendingAlertText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#92400e',
    letterSpacing: 0.5,
  },
  cancelPendingBtn: {
    flex: 1.35,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cancelPendingBtnText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#92400e',
    letterSpacing: 0.3,
  },
  dispatchActionRowAccepted: {
    marginTop: 6,
    width: '100%',
  },
  cancelRideBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  cancelRideBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  detailsRideBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0f2744',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f2744',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  detailsRideBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },

  /* Cancellation Reason Modal */
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  cancelModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cancelModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  cancelModalIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2744',
  },
  cancelModalSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  cancelModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelReasonsList: {
    maxHeight: 280,
    marginBottom: 16,
  },
  reasonOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  reasonOptionRowSelected: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  reasonRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reasonRadioOuterSelected: {
    borderColor: '#dc2626',
  },
  reasonRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dc2626',
  },
  reasonOptionText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  reasonOptionTextSelected: {
    color: '#991b1b',
    fontWeight: '700',
  },
  customReasonInputWrap: {
    marginTop: 4,
    marginBottom: 8,
  },
  customReasonInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    textAlignVertical: 'top',
    minHeight: 70,
  },
  cancelModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  cancelModalBackBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalBackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  cancelModalConfirmBtn: {
    flex: 1.4,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelModalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  /* Dedicated Trip Details Modal Styles */
  detailsInfoBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  detailsInfoSectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  detailsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsInfoLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  detailsInfoValue: {
    fontSize: 13,
    color: '#0f2744',
    fontWeight: '800',
    marginTop: 2,
  },
  detailsLocationLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '700',
    marginBottom: 2,
  },
  detailsDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  detailsDistanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f2744',
  },
  detailsTripTypeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
    textTransform: 'uppercase',
  },
  detailsCloseBtn: {
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0f2744',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCloseBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
  },
});
