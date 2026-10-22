import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const DRIVER_RATING_LABELS: Record<number, string> = {
  1: '1/5 - Unsatisfactory Driver',
  2: '2/5 - Needs Improvement',
  3: '3/5 - Average Driver',
  4: '4/5 - Good & Helpful',
  5: '5/5 - Outstanding Driver',
};

const KANDY_RATING_LABELS: Record<number, string> = {
  1: '1/5 - Poor Experience',
  2: '2/5 - Below Expectations',
  3: '3/5 - Fair Service',
  4: '4/5 - Great Service',
  5: '5/5 - Exceptional Experience',
};

export function DriverRatingModal({
  booking,
  isOpen,
  onClose,
  onRatingSubmitted,
}: TripReviewModalProps) {
  const [driverRating, setDriverRating] = useState<number>(5);
  const [kandyRating, setKandyRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && booking) {
      if (booking.customerRating) {
        setDriverRating(Number(booking.customerRating.driverRating || booking.customerRating.rating) || 5);
        setKandyRating(Number(booking.customerRating.kandyRating) || 5);
        setComment(booking.customerRating.comment || '');
      } else {
        setDriverRating(5);
        setKandyRating(5);
        setComment('');
      }
    }
  }, [isOpen, booking]);

  if (!isOpen || !booking) return null;

  const driver = booking.assignedDriver;
  const vehicle = booking.vehicle || driver?.vehicles?.[0];
  const driverName = driver?.user?.fullName || 'Assigned Driver';
  const vehicleDesc = `${(vehicle?.category || booking.category || 'SEDAN').toUpperCase()}  •  ${(vehicle?.plateNumber || 'KA 01 MJ 2023').toUpperCase()}`;

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
          {/* Header */}
          <View style={styles.headerRow}>
            {/* Header Titles */}
            <View style={styles.headerTextCol}>
              <Text style={styles.modalTitle}>Rate Your Trip & Driver</Text>
              <Text style={styles.modalSubHeader}>Your feedback helps us serve you better</Text>
              <Text style={styles.bookingMetaRow}>
                <Text style={styles.metaLabel}>Booking No. </Text>
                <Text style={styles.metaRef}>{booking.humanReadableRef}</Text>
                <Text style={styles.metaDot}>  •  </Text>
                <Text style={styles.metaStatus}>Ride Completed</Text>
              </Text>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* CARD 1: DRIVER RATING */}
            <View style={styles.driverSectionCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.driverAvatarCircle}>
                  <Ionicons name="person" size={20} color="#0284c7" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.driverNameText}>{driverName}</Text>
                  <Text style={styles.vehicleDescText}>{vehicleDesc}</Text>
                </View>
                <View style={styles.driverBadge}>
                  <Ionicons name="checkmark-circle" size={11} color="#16a34a" />
                  <Text style={styles.driverBadgeText}>Driver</Text>
                </View>
              </View>

              {/* Driver Stars */}
              <View style={styles.starsBox}>
                <Text style={styles.starsPrompt}>How was your driver?</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((starVal) => {
                    const isFilled = starVal <= driverRating;
                    return (
                      <TouchableOpacity
                        key={starVal}
                        activeOpacity={0.7}
                        onPress={() => setDriverRating(starVal)}
                        style={styles.starTouchable}
                      >
                        <Ionicons
                          name={isFilled ? 'star' : 'star-outline'}
                          size={32}
                          color={isFilled ? '#f59e0b' : '#cbd5e1'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.driverRatingLabelText}>
                  {DRIVER_RATING_LABELS[driverRating] || ''}
                </Text>
              </View>
            </View>

            {/* CARD 2: KANDYCABS SERVICE EXPERIENCE */}
            <View style={styles.kandySectionCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.kandyAvatarCircle}>
                  <Ionicons name="car-sport" size={19} color="#059669" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.kandyNameText}>KandyCabs Service</Text>
                  <Text style={styles.kandySubText}>Overall booking & ride quality</Text>
                </View>
                <View style={styles.kandyBadge}>
                  <Ionicons name="shield-checkmark" size={11} color="#2563eb" />
                  <Text style={styles.kandyBadgeText}>Official Service</Text>
                </View>
              </View>

              {/* KandyCabs Stars */}
              <View style={styles.starsBox}>
                <Text style={styles.starsPrompt}>How was your experience with KandyCabs?</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((starVal) => {
                    const isFilled = starVal <= kandyRating;
                    return (
                      <TouchableOpacity
                        key={starVal}
                        activeOpacity={0.7}
                        onPress={() => setKandyRating(starVal)}
                        style={styles.starTouchable}
                      >
                        <Ionicons
                          name={isFilled ? 'star' : 'star-outline'}
                          size={32}
                          color={isFilled ? '#f59e0b' : '#cbd5e1'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.kandyRatingLabelText}>
                  {KANDY_RATING_LABELS[kandyRating] || ''}
                </Text>
              </View>
            </View>

            {/* CARD 3: TYPABLE REVIEW SECTION */}
            <View style={styles.reviewSectionCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.reviewIconSquircle}>
                  <Ionicons name="create-outline" size={18} color="#ea580c" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.reviewSectionTitle}>Write Your Review</Text>
                  <Text style={styles.reviewSectionSub}>
                    Share your experience with KandyCabs & your driver
                  </Text>
                </View>
                <View style={styles.charCountPill}>
                  <Text style={styles.commentCharCount}>{comment.length}/500</Text>
                </View>
              </View>

              <TextInput
                style={styles.reviewTextInput}
                placeholder="Share details about your trip, driver behavior, cab cleanliness, punctuality, and overall journey..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={setComment}
                maxLength={500}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsFooter}>
            <TouchableOpacity
              style={styles.navySubmitBtn}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={styles.navyBtnInnerRow}>
                  <Ionicons name="star" size={16} color="#ffffff" />
                  <View style={styles.navyDividerBar} />
                  <Text style={styles.navyBtnText}>Submit Trip & Driver Review</Text>
                  <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.laterBtn}
              onPress={onClose}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.laterBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
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
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    width: '100%',
    maxWidth: 440,
    maxHeight: '94%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cabLogoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
    marginRight: 10,
  },
  headerTextCol: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f294a',
  },
  modalSubHeader: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
    marginTop: 0.5,
  },
  bookingMetaRow: {
    fontSize: 10,
    marginTop: 2,
  },
  metaLabel: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  metaRef: {
    color: '#334155',
    fontWeight: '700',
  },
  metaDot: {
    color: '#cbd5e1',
  },
  metaStatus: {
    color: '#64748b',
    fontWeight: '500',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginLeft: 6,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 11,
  },
  driverSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  kandySectionCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  reviewSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.6)',
  },
  driverAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  kandyAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  reviewIconSquircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  driverNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f294a',
  },
  kandyNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#064e3b',
  },
  reviewSectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f294a',
  },
  vehicleDescText: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  kandySubText: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '500',
  },
  reviewSectionSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 0.5,
  },
  driverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  driverBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  kandyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  kandyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  charCountPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  commentCharCount: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  starsBox: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 2,
  },
  starsPrompt: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f294a',
    marginBottom: 5,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  starTouchable: {
    padding: 2,
  },
  driverRatingLabelText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#d97706',
    marginTop: 4,
  },
  kandyRatingLabelText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#d97706',
    marginTop: 4,
  },
  reviewTextInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 11.5,
    color: '#0f294a',
    minHeight: 82,
    textAlignVertical: 'top',
    lineHeight: 17,
    marginTop: 8,
  },
  actionsFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  navySubmitBtn: {
    backgroundColor: '#0a2540',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#0a2540',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  navyBtnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navyDividerBar: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginHorizontal: 12,
  },
  navyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  laterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginTop: 3,
  },
  laterBtnText: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '600',
  },
});
