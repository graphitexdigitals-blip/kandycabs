import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { customerApiClient } from '../lib/api';

export interface TripReviewModalProps {
  booking: any | null;
  isOpen: boolean;
  onClose: () => void;
  onRatingSubmitted: (ratingData: {
    bookingId: string;
    driverRating: number;
    driverFeedbackTags?: string[];
    kandyRating: number;
    kandyFeedbackTags?: string[];
    comment: string;
    rating?: number;
    feedbackTags?: string[];
  }) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: '1 - Poor',
  2: '2 - Needs improvement',
  3: '3 - Good',
  4: '4 - Very good',
  5: '5 - Excellent',
};

export function DriverRatingModal({
  booking,
  isOpen,
  onClose,
  onRatingSubmitted,
}: TripReviewModalProps) {
  const { t } = useTranslation();
  const [driverRating, setDriverRating] = useState<number>(0);
  const [kandyRating, setKandyRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const activeBookingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen && booking) {
      const bId = booking.id || booking.bookingId || 'current';
      if (activeBookingIdRef.current !== bId) {
        activeBookingIdRef.current = bId;
        if (booking.customerRating) {
          setDriverRating(Number(booking.customerRating.driverRating || booking.customerRating.rating) || 0);
          setKandyRating(Number(booking.customerRating.kandyRating) || 0);
          setComment(booking.customerRating.comment || '');
        } else {
          setDriverRating(0);
          setKandyRating(0);
          setComment('');
        }
      }
    } else if (!isOpen) {
      activeBookingIdRef.current = null;
    }
  }, [isOpen, booking?.id]);

  if (!isOpen || !booking) return null;

  const driver = booking.assignedDriver;
  const vehicle = booking.vehicle || driver?.vehicles?.[0];
  const driverName = driver?.user?.fullName || driver?.name || 'Assigned Driver';
  const driverPhoto = driver?.user?.avatarUrl || driver?.avatarUrl || driver?.photoUrl || null;

  const categoryRaw = vehicle?.category || booking.category || 'Sedan';
  const categoryFormatted = categoryRaw.charAt(0).toUpperCase() + categoryRaw.slice(1).toLowerCase();
  const plateNumber = (vehicle?.plateNumber || 'KA 01 MJ 2023').toUpperCase();
  const vehicleDesc = `${categoryFormatted}  •  ${plateNumber}`;

  const handleSubmit = async () => {
    if (!driverRating || driverRating < 1 || !kandyRating || kandyRating < 1) {
      Alert.alert('Rating Required', 'Please provide a star rating for both the driver and KandyCabs.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await customerApiClient.fetch('/api/customer/rate-driver', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: booking.id,
          driverRating,
          driverFeedbackTags: [],
          rating: driverRating,
          feedbackTags: [],
          kandyRating,
          kandyFeedbackTags: [],
          comment: comment.trim(),
        }),
      });

      if (res && res.success) {
        Alert.alert(
          t('modals.rating.reviewSubmitted', { defaultValue: 'Review Submitted' }),
          t('modals.rating.thankYouFeedback', { defaultValue: 'Thank you for your feedback' })
        );
        onRatingSubmitted({
          bookingId: booking.id,
          driverRating,
          driverFeedbackTags: [],
          rating: driverRating,
          feedbackTags: [],
          kandyRating,
          kandyFeedbackTags: [],
          comment: comment.trim(),
        });
        onClose();
      } else {
        Alert.alert('Error', res?.message || 'Failed to submit review.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.modalCard}>
          {/* Top Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextCol}>
              <Text style={styles.modalTitle}>Rate your trip</Text>
              <View style={styles.bookingMetaRow}>
                <Text style={styles.metaLabel}>Booking No.  </Text>
                <Text style={styles.metaRef}>{booking.humanReadableRef || booking.ref || 'KC-2026-428597'}</Text>
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="rgb(22, 34, 50)" />
            </TouchableOpacity>
          </View>

          {/* Header Divider */}
          <View style={styles.headerDivider} />

          <ScrollView
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* TOP CARD: DRIVER INFO & RIDE COMPLETED (Refined to match reference: suit icon, soft card, vertical divider) */}
            <View style={styles.driverCompletedCard}>
              <View style={styles.driverAvatarContainer}>
                {driverPhoto ? (
                  <Image source={{ uri: driverPhoto }} style={styles.driverAvatarImage} />
                ) : (
                  <View style={styles.driverAvatarFallback}>
                    <MaterialCommunityIcons name="account-tie" size={26} color="#0f172a" />
                  </View>
                )}
              </View>

              <View style={styles.driverDetailsCol}>
                <Text style={styles.driverNameText} numberOfLines={1}>{driverName}</Text>
                <Text style={styles.vehicleDescText}>{vehicleDesc}</Text>
              </View>

              <View style={styles.driverBadgeDivider} />

              <View style={styles.rideCompletedBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#059669" />
                <View style={styles.rideCompletedTextCol}>
                  <Text style={styles.rideCompletedLine1}>Ride</Text>
                  <Text style={styles.rideCompletedLine2}>completed</Text>
                </View>
              </View>
            </View>

            <View style={styles.cardSeparator} />

            {/* RATING CARD 1: HOW WAS YOUR DRIVER? (No box border/shadow) */}
            <View style={styles.ratingCard}>
              <View style={styles.ratingCardHeader}>
                <View style={styles.ratingBadge}>
                  <View style={styles.driverIconComposite}>
                    <Ionicons name="person" size={20} color="rgb(22, 34, 50)" />
                    <MaterialCommunityIcons
                      name="steering"
                      size={12}
                      color="rgb(22, 34, 50)"
                      style={styles.steeringSubIcon}
                    />
                  </View>
                </View>
                <View style={styles.ratingHeaderCol}>
                  <Text style={styles.ratingCardTitle}>How was your driver?</Text>
                  <Text style={styles.ratingCardSubtitle}>Rate the professionalism and behaviour</Text>
                </View>
              </View>

              {/* 5 Stars Row */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const isFilled = driverRating > 0 && starVal <= driverRating;
                  return (
                    <TouchableOpacity
                      key={starVal}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                      onPress={() => setDriverRating(starVal)}
                      style={styles.starTouchable}
                    >
                      <Ionicons
                        name={isFilled ? 'star' : 'star-outline'}
                        size={32}
                        color="#f59e0b"
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {driverRating > 0 && (
                <Text style={styles.ratingFeedbackLabel}>
                  {RATING_LABELS[driverRating] || ''}
                </Text>
              )}
            </View>

            <View style={styles.cardSeparator} />

            {/* RATING CARD 2: KANDYCABS SERVICE (No box border/shadow) */}
            <View style={styles.ratingCard}>
              <View style={styles.ratingCardHeader}>
                <View style={styles.ratingBadge}>
                  <Ionicons name="car" size={22} color="rgb(22, 34, 50)" />
                </View>
                <View style={styles.ratingHeaderCol}>
                  <Text style={styles.ratingCardTitle}>KandyCabs service</Text>
                  <Text style={styles.ratingCardSubtitle}>Rate your overall experience</Text>
                </View>
              </View>

              {/* 5 Stars Row */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const isFilled = kandyRating > 0 && starVal <= kandyRating;
                  return (
                    <TouchableOpacity
                      key={starVal}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                      onPress={() => setKandyRating(starVal)}
                      style={styles.starTouchable}
                    >
                      <Ionicons
                        name={isFilled ? 'star' : 'star-outline'}
                        size={32}
                        color="#f59e0b"
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {kandyRating > 0 && (
                <Text style={styles.ratingFeedbackLabel}>
                  {RATING_LABELS[kandyRating] || ''}
                </Text>
              )}
            </View>

            <View style={styles.cardSeparator} />

            {/* SECTION 3: WRITE A REVIEW */}
            <View style={styles.reviewCard}>
              <View style={styles.reviewCardHeader}>
                <View style={styles.reviewBadge}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="rgb(22, 34, 50)" />
                </View>
                <View style={styles.reviewTitleInline}>
                  <Text style={styles.reviewCardTitle}>Write a review</Text>
                  <Text style={styles.optionalText}> (optional)</Text>
                </View>
              </View>

              <View style={styles.reviewInputWrapper}>
                <TextInput
                  style={styles.reviewTextInput}
                  placeholder="Tell us about your driver, cleanliness, punctuality, and overall experience..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={2}
                  value={comment}
                  onChangeText={setComment}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={styles.charCountText}>{comment.length}/500</Text>
              </View>
            </View>

            {/* ACTION BUTTONS */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={styles.submitBtnContent}>
                  <Ionicons name="star" size={16} color="#ffffff" />
                  <Text style={styles.submitBtnText}>{t('modals.rating.submitRating', { defaultValue: 'Submit Rating' })}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.maybeLaterBtn}
              onPress={onClose}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.maybeLaterText}>Maybe later</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Alias for seamless import compatibility
export const TripReviewModal = DriverRatingModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '100%',
    paddingTop: 8,
    paddingBottom: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 14,
    marginBottom: 8,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.3,
  },
  bookingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaLabel: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '500',
  },
  metaRef: {
    fontSize: 11.5,
    color: 'rgb(22, 34, 50)',
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  cardSeparator: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 5,
  },

  /* TOP CARD: DRIVER INFO & RIDE COMPLETED (Visible light background per reference) */
  driverCompletedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#edf3fa',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 4,
  },
  driverAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dbe4f0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  driverAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dbe4f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDetailsCol: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  driverNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  vehicleDescText: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  driverBadgeDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 10,
  },
  rideCompletedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rideCompletedTextCol: {
    justifyContent: 'center',
  },
  rideCompletedLine1: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    lineHeight: 14,
  },
  rideCompletedLine2: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    lineHeight: 14,
  },

  /* RATING CARDS (No box border, no drop shadow) */
  ratingCard: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 6,
  },
  ratingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingBadge: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  driverIconComposite: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  steeringSubIcon: {
    position: 'absolute',
    bottom: -1,
    right: -2,
  },
  ratingHeaderCol: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  ratingCardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.2,
  },
  ratingCardSubtitle: {
    fontSize: 11.5,
    fontWeight: '400',
    color: '#64748b',
    marginTop: 1,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    gap: 10,
  },
  starTouchable: {
    padding: 2,
  },
  ratingFeedbackLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#f59e0b',
    textAlign: 'center',
    marginTop: 3,
  },

  /* REVIEW CARD (No box border, no drop shadow) */
  reviewCard: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 6,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewBadge: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  reviewTitleInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  reviewCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  optionalText: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '500',
  },
  reviewInputWrapper: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    minHeight: 52,
    justifyContent: 'space-between',
  },
  reviewTextInput: {
    fontSize: 11.5,
    color: '#1e293b',
    minHeight: 34,
    padding: 0,
    textAlignVertical: 'top',
  },
  charCountText: {
    alignSelf: 'flex-end',
    fontSize: 9.5,
    color: '#94a3b8',
    fontWeight: '600',
  },

  /* BOTTOM BUTTONS */
  submitBtn: {
    backgroundColor: 'rgb(22, 34, 50)',
    borderRadius: 24,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 6,
    shadowColor: 'rgb(22, 34, 50)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2.5,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  maybeLaterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    marginTop: 2,
  },
  maybeLaterText: {
    fontSize: 13,
    color: 'rgb(22, 34, 50)',
    fontWeight: '600',
  },
});
