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
import { Ionicons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
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
  const rawDriverPhoto =
    driver?.user?.avatarUrl ||
    driver?.avatarUrl ||
    driver?.photoUrl ||
    driver?.profilePhoto ||
    null;
  const driverPhoto = rawDriverPhoto
    ? rawDriverPhoto.startsWith('http')
      ? rawDriverPhoto
      : `https://kandycabs-production.up.railway.app${rawDriverPhoto.startsWith('/') ? '' : '/'}${rawDriverPhoto}`
    : null;

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
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextCol}>
              <Text style={styles.modalTitle}>Rate your trip</Text>
              <View style={styles.bookingMetaRow}>
                <Text style={styles.metaLabel}>Booking No.  </Text>
                <Text style={styles.metaRef}>{booking.humanReadableRef || booking.ref || 'KC-2026-693393'}</Text>
              </View>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* RATING CARD 1: HOW WAS YOUR DRIVER? (With Driver Profile Photo) */}
            <View style={styles.ratingCard}>
              <View style={styles.ratingCardHeader}>
                <View style={styles.ratingBadge}>
                  {driverPhoto ? (
                    <Image
                      source={{ uri: driverPhoto }}
                      style={styles.driverProfileBadgePic}
                      resizeMode="cover"
                    />
                  ) : (
                    <Image
                      source={require('../assets/images/driver_profile_icon.png')}
                      style={styles.driverProfileBadgePic}
                      resizeMode="contain"
                    />
                  )}
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
                      <FontAwesome
                        name={isFilled ? 'star' : 'star-o'}
                        size={30}
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

            {/* RATING CARD 2: KANDYCABS SERVICE (With KandyCabs Logo) */}
            <View style={styles.ratingCard}>
              <View style={styles.ratingCardHeader}>
                <View style={styles.ratingBadge}>
                  <Image
                    source={require('../assets/icon.png')}
                    style={styles.customerAppIconBadge}
                    resizeMode="cover"
                  />
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
                      <FontAwesome
                        name={isFilled ? 'star' : 'star-o'}
                        size={30}
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

            {/* SECTION 3: WRITE A REVIEW */}
            <View style={styles.reviewCard}>
              <View style={styles.reviewInputWrapper}>
                <TextInput
                  style={styles.reviewTextInput}
                  placeholder="Tell us about your driver, cleanliness, punctuality, and overall experience..."
                  placeholderTextColor="#64748b"
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
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <View style={styles.submitBtnContent}>
                  <Text style={styles.submitBtnText}>{t('modals.rating.submitRating', { defaultValue: 'Submit Rating' })}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#000000" style={styles.submitBtnArrow} />
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalCard: {
    backgroundColor: '#182232',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '100%',
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  bookingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  metaLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  metaRef: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#263345',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  cardSeparator: {
    height: 0,
    marginVertical: 4,
  },
  ratingCard: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 6,
  },
  ratingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingBadge: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  driverProfileBadgePic: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  customerAppIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  ratingHeaderCol: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  ratingCardTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  ratingCardSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#94a3b8',
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    gap: 12,
  },
  starTouchable: {
    padding: 2,
  },
  ratingFeedbackLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
    textAlign: 'center',
    marginTop: 4,
  },

  /* REVIEW CARD */
  reviewCard: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
    marginBottom: 4,
  },
  reviewInputWrapper: {
    borderWidth: 1,
    borderColor: '#2d3d52',
    borderRadius: 12,
    backgroundColor: '#202b3b',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    minHeight: 56,
    justifyContent: 'space-between',
  },
  reviewTextInput: {
    fontSize: 12,
    color: '#ffffff',
    minHeight: 34,
    padding: 0,
    textAlignVertical: 'top',
  },
  charCountText: {
    alignSelf: 'flex-end',
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '600',
  },

  /* BOTTOM BUTTONS */
  submitBtn: {
    backgroundColor: '#f5a623',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  submitBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  submitBtnArrow: {
    position: 'absolute',
    right: 4,
  },
  maybeLaterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 6,
  },
  maybeLaterText: {
    fontSize: 13.5,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
