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
import { Ionicons } from '@expo/vector-icons';
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
        Alert.alert('Review Submitted', 'Thank you for rating KandyCabs and your driver!');
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
                <Text style={styles.metaDot}>  •  </Text>
                <Ionicons name="checkmark-circle" size={12} color="#10b981" style={{ marginRight: 3 }} />
                <Text style={styles.metaStatus}>Ride completed</Text>
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
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* SECTION 1: DRIVER INFO & RATING */}
            <View style={styles.driverRatingSection}>
              <View style={styles.driverInfoRow}>
                <View style={styles.driverAvatarContainer}>
                  {driverPhoto ? (
                    <Image source={{ uri: driverPhoto }} style={styles.driverAvatarImage} />
                  ) : (
                    <View style={styles.driverAvatarFallback}>
                      <Ionicons name="person" size={22} color="rgb(22, 34, 50)" />
                    </View>
                  )}
                </View>
                <View style={styles.driverDetailsCol}>
                  <Text style={styles.driverNameText}>{driverName}</Text>
                  <Text style={styles.vehicleDescText}>{vehicleDesc}</Text>
                </View>
              </View>

              <Text style={styles.driverPromptTitle}>How was your driver?</Text>

              {/* Stars */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const isFilled = driverRating > 0 && starVal <= driverRating;
                  return (
                    <TouchableOpacity
                      key={starVal}
                      activeOpacity={0.7}
                      hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
                      onPress={() => setDriverRating(starVal)}
                      style={styles.starTouchable}
                    >
                      <Ionicons
                        name={isFilled ? 'star' : 'star-outline'}
                        size={34}
                        color={isFilled ? '#f59e0b' : '#cbd5e1'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.ratingFeedbackLabel, driverRating === 0 && styles.unselectedRatingLabel]}>
                {driverRating > 0 ? (RATING_LABELS[driverRating] || '') : 'Tap stars to rate'}
              </Text>
            </View>

            {/* DIVIDER */}
            <View style={styles.divider} />

            {/* SECTION 2: KANDYCABS SERVICE */}
            <View style={styles.kandySection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.circleIconBadge}>
                  <Image
                    source={require('../assets/images/service-car-front.png')}
                    style={styles.serviceCarIcon}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.sectionHeaderTitleCol}>
                  <Text style={styles.sectionHeaderTitle}>KandyCabs service</Text>
                  <Text style={styles.sectionHeaderSub}>Overall booking & ride quality</Text>
                </View>
              </View>

              <Text style={styles.kandyPromptTitle}>How was your overall experience?</Text>

              {/* Stars */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const isFilled = kandyRating > 0 && starVal <= kandyRating;
                  return (
                    <TouchableOpacity
                      key={starVal}
                      activeOpacity={0.7}
                      hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
                      onPress={() => setKandyRating(starVal)}
                      style={styles.starTouchable}
                    >
                      <Ionicons
                        name={isFilled ? 'star' : 'star-outline'}
                        size={34}
                        color={isFilled ? '#f59e0b' : '#cbd5e1'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.ratingFeedbackLabel, kandyRating === 0 && styles.unselectedRatingLabel]}>
                {kandyRating > 0 ? (RATING_LABELS[kandyRating] || '') : 'Tap stars to rate'}
              </Text>
            </View>

            {/* DIVIDER */}
            <View style={styles.divider} />

            {/* SECTION 3: WRITE A REVIEW */}
            <View style={styles.reviewSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.circleIconBadge}>
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color="rgb(22, 34, 50)" />
                </View>
                <View style={styles.reviewTitleInline}>
                  <Text style={styles.sectionHeaderTitle}>Write a review</Text>
                  <Text style={styles.optionalText}> (optional)</Text>
                </View>
              </View>

              <View style={styles.reviewInputWrapper}>
                <TextInput
                  style={styles.reviewTextInput}
                  placeholder="Tell us about your driver, cleanliness, punctuality, and overall experience..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
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
                  <View style={styles.submitBtnLeft}>
                    <Ionicons name="star" size={16} color="#ffffff" />
                    <View style={styles.submitBtnDivider} />
                  </View>
                  <Text style={styles.submitBtnText}>{t('modals.rating.submitRating', { defaultValue: 'Submit review' })}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    maxHeight: '94%',
    paddingTop: 12,
    paddingBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 18,
    marginBottom: 2,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.3,
  },
  modalSubHeader: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  bookingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
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
  metaDot: {
    fontSize: 11.5,
    color: '#cbd5e1',
  },
  metaStatus: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eaf0f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  },
  driverPromptTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    marginTop: 10,
    marginBottom: 2,
  },
  driverAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eaf0f9',
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
    backgroundColor: '#eaf0f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDetailsCol: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  driverNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  vehicleDescText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  driverRatingSection: {
    paddingVertical: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#eaf0f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceCarIcon: {
    width: 20,
    height: 15,
    tintColor: 'rgb(22, 34, 50)',
  },
  sectionHeaderTitleCol: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    marginLeft: 10,
  },
  sectionHeaderSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '400',
    marginTop: 1,
    marginLeft: 10,
  },
  kandyPromptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    marginTop: 8,
    marginLeft: 44,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 10,
  },
  starTouchable: {
    padding: 3,
  },
  ratingFeedbackLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
    textAlign: 'center',
    marginTop: 5,
  },
  unselectedRatingLabel: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  kandySection: {
    paddingVertical: 2,
  },
  reviewSection: {
    paddingVertical: 2,
  },
  reviewTitleInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionalText: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '500',
  },
  reviewInputWrapper: {
    marginLeft: 44,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    minHeight: 84,
    justifyContent: 'space-between',
  },
  reviewTextInput: {
    fontSize: 11.5,
    color: '#1e293b',
    minHeight: 48,
    padding: 0,
    textAlignVertical: 'top',
  },
  charCountText: {
    alignSelf: 'flex-end',
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: 'rgb(22, 34, 50)',
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 18,
    shadowColor: 'rgb(22, 34, 50)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  submitBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtnDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginLeft: 12,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  maybeLaterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  maybeLaterText: {
    fontSize: 13.5,
    color: 'rgb(22, 34, 50)',
    fontWeight: '600',
  },
});
