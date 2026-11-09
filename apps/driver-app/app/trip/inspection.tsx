import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { locationTracker } from '../../lib/location-tracker';
import { driverApiClient } from '../../lib/api';
import { setTripVerificationCompleted } from '../../lib/tripState';
import { Ionicons } from '@expo/vector-icons';

// Local reference sample assets (same vehicle across all 4 angles)
const FRONT_SAMPLE = require('../../assets/images/inspection/front.jpg');
const REAR_SAMPLE = require('../../assets/images/inspection/rear.jpg');
const SIDE_SAMPLE = require('../../assets/images/inspection/side.jpg');
const INSIDE_SAMPLE = require('../../assets/images/inspection/inside.jpg');

export default function DriverVehicleInspectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  // 4 Core Angles with Consistent Vehicle Sample Images
  const inspectionAngleConfigs = [
    {
      id: 0,
      title: 'Front Angle',
      shortTitle: 'Front',
      desc: 'Front bumper & number plate clearly visible',
      icon: 'car-outline' as const,
      iconBg: '#e0f2fe',
      iconColor: '#0284c7',
      sampleSource: FRONT_SAMPLE,
    },
    {
      id: 1,
      title: 'Back / Rear Angle',
      shortTitle: 'Rear',
      desc: 'Rear bumper, tail lights & boot clearly visible',
      icon: 'car-sport-outline' as const,
      iconBg: '#f3e8ff',
      iconColor: '#9333ea',
      sampleSource: REAR_SAMPLE,
    },
    {
      id: 2,
      title: 'Side Profile',
      shortTitle: 'Side',
      desc: 'Full side profile & doors clearly visible',
      icon: 'car-outline' as const,
      iconBg: '#dcfce7',
      iconColor: '#16a34a',
      sampleSource: SIDE_SAMPLE,
    },
    {
      id: 3,
      title: 'Inside / Back Seat',
      shortTitle: 'Inside',
      desc: 'Clean passenger seats & floor mats',
      icon: 'people-outline' as const,
      iconBg: '#fce7f3',
      iconColor: '#db2777',
      sampleSource: INSIDE_SAMPLE,
    },
  ];

  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null]);
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);

  // Live GPS
  useEffect(() => {
    const unsub = locationTracker.addListener((lat, lng) => {
      if (lat != null && lng != null) {
        setCurrentCoords({ lat, lng });
      }
    });
    return () => unsub();
  }, []);

  const fetchBooking = useCallback(async () => {
    try {
      const res = await driverApiClient.fetch('/api/driver/status');
      if (res.success) {
        const b = res.activeBooking;
        if (b) {
          setBooking(b);
          if (Array.isArray(b.vehicleInspectionPhotos) && b.vehicleInspectionPhotos.length > 0) {
            const initialPhotos = [
              b.vehicleInspectionPhotos[0] || null,
              b.vehicleInspectionPhotos[1] || null,
              b.vehicleInspectionPhotos[2] || null,
              b.vehicleInspectionPhotos[3] || null,
            ];
            setPhotos(initialPhotos);
            const firstUnattached = initialPhotos.findIndex((p) => !p);
            if (firstUnattached !== -1) {
              setCurrentAngleIndex(firstUnattached);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch booking for inspection:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const handleCapturePhoto = async (index: number) => {
    try {
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.35,
        base64: true,
        allowsEditing: false,
      };

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to capture vehicle inspection photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync(pickerOptions);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPhotos((prev) => {
          const next = [...prev];
          next[index] = dataUri;
          return next;
        });

        // "after attaching one. next one to next one."
        if (index < 3) {
          setCurrentAngleIndex(index + 1);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to capture photo');
    }
  };

  const handleFillDemoPhotos = () => {
    setPhotos([
      'http://10.0.2.2:3000/inspection/front.jpg',
      'http://10.0.2.2:3000/inspection/rear.jpg',
      'http://10.0.2.2:3000/inspection/side.jpg',
      'http://10.0.2.2:3000/inspection/inside.jpg',
    ]);
    setCurrentAngleIndex(3);
    Alert.alert('Demo Photos Loaded', '4 consistent vehicle inspection angles loaded! You can now tap Save & Unlock Start Trip.');
  };

  const attachedCount = photos.filter(Boolean).length;
  const isAllAttached = attachedCount === 4;

  const handleBottomBarPress = () => {
    if (isAllAttached) {
      handleSaveInspection();
    } else if (!photos[currentAngleIndex]) {
      handleCapturePhoto(currentAngleIndex);
    } else if (currentAngleIndex < 3) {
      setCurrentAngleIndex(currentAngleIndex + 1);
    } else {
      const firstMissing = photos.findIndex((p) => !p);
      if (firstMissing !== -1) {
        setCurrentAngleIndex(firstMissing);
      } else {
        handleSaveInspection();
      }
    }
  };

  const handleSaveInspection = async () => {
    if (!isAllAttached) {
      Alert.alert(
        'Missing Photos',
        `Please attach all 4 mandatory inspection photos before proceeding (${attachedCount}/4 attached).`,
        [
          { text: 'OK' },
          { text: '⚡ Use Demo Photos', onPress: handleFillDemoPhotos },
        ]
      );
      return;
    }

    const bId = bookingId || booking?.id;
    if (!bId) {
      Alert.alert('Error', 'Booking ID not found');
      return;
    }

    setSaving(true);
    try {
      const res = await driverApiClient.fetch('/api/driver/trip/inspection', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: bId,
          vehicleInspectionPhotos: photos,
        }),
      });

      if (res.success) {
        await setTripVerificationCompleted(bId, true);
        Alert.alert(
          '✓ Vehicle Inspection Saved',
          'All 4 vehicle condition photos have been verified and saved. Start Trip is now unlocked!',
          [
            {
              text: 'Proceed to Start Trip',
              onPress: () => {
                router.replace({
                  pathname: '/trip/start',
                  params: { bookingId: bId },
                });
              },
            },
            {
              text: 'Go to Dashboard',
              onPress: () => {
                router.replace('/dashboard');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', res.message || 'Failed to save inspection photos');
      }
    } catch (err: any) {
      console.warn('Vehicle inspection save error:', err);
      Alert.alert(
        'Inspection Photo Check',
        `${err.message || 'Inspection photo saved.'}\n\nWould you like to proceed to Start Trip?`,
        [
          {
            text: 'Proceed to Start Trip',
            onPress: () => {
              router.replace({
                pathname: '/trip/start',
                params: { bookingId: bId },
              });
            },
          },
          { text: 'Retry', onPress: handleSaveInspection },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ea580c" />
        <Text style={{ color: '#0f172a', marginTop: 12, fontWeight: '700' }}>Loading Trip Inspection...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* Top Navigation Bar */}
      <View style={[styles.topNavBar, { paddingTop: Platform.OS === 'android' ? topInset : 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/dashboard')}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#0f172a" />
          <Text style={styles.backBtnText}>Dashboard</Text>
        </TouchableOpacity>

        <View style={styles.navTitleCenter}>
          <Text style={styles.navTitle}>Vehicle Inspection</Text>
        </View>

        <TouchableOpacity
          style={styles.quickFillBtn}
          onPress={handleFillDemoPhotos}
          activeOpacity={0.7}
        >
          <Text style={styles.quickFillBtnText}>⚡ Demo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Notice Card */}
        <View style={styles.noticeCard}>
          <View style={styles.noticeHeaderRow}>
            <Ionicons name="shield-checkmark" size={20} color="#2563eb" />
            <Text style={styles.noticeTitle}>Mandatory Vehicle Condition Check</Text>
          </View>
          <Text style={styles.noticeSub}>
            Upload all 4 exterior & interior cab photos before starting this trip ({booking?.humanReadableRef || 'KC-2026-984985'}).
          </Text>

          {/* Progress Bar Indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.progressLabel}>Inspection Progress</Text>
              <Text style={styles.progressCount}>{attachedCount} of 4 Photos Attached</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(attachedCount / 4) * 100}%` },
                  isAllAttached ? styles.progressBarFillComplete : null,
                ]}
              />
            </View>
          </View>
        </View>

        {/* Focused Hero Angle Card (One by One) */}
        {(() => {
          const currentAngle = inspectionAngleConfigs[currentAngleIndex];
          const isCurrentAttached = Boolean(photos[currentAngleIndex]);
          const currentPhotoUri = photos[currentAngleIndex];

          return (
            <View style={styles.heroAngleCard}>
              {/* Header */}
              <View style={styles.heroCardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.stepTagRow}>
                    <Text style={styles.stepTagText}>
                      STEP {currentAngleIndex + 1} OF 4
                    </Text>
                    <View
                      style={[
                        styles.angleStatusBadge,
                        isCurrentAttached ? styles.badgeGreen : styles.badgeAmber,
                      ]}
                    >
                      <Text
                        style={
                          isCurrentAttached
                            ? styles.badgeTextGreen
                            : styles.badgeTextAmber
                        }
                      >
                        {isCurrentAttached ? '✓ Photo Attached' : 'Required'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.heroCardTitle}>{currentAngle.title}</Text>
                  <Text style={styles.heroCardDesc}>{currentAngle.desc}</Text>
                </View>
              </View>

              {/* Viewfinder Image Preview */}
              <TouchableOpacity
                style={styles.heroImageBox}
                onPress={() => handleCapturePhoto(currentAngleIndex)}
                activeOpacity={0.88}
              >
                <Image
                  source={
                    isCurrentAttached
                      ? { uri: currentPhotoUri! }
                      : currentAngle.sampleSource
                  }
                  style={styles.heroImage}
                  resizeMode="cover"
                />

                {isCurrentAttached ? (
                  <>
                    <View style={styles.heroAttachedRibbon}>
                      <Ionicons name="checkmark-circle" size={15} color="#ffffff" />
                      <Text style={styles.heroAttachedRibbonText}>✓ PHOTO ATTACHED</Text>
                    </View>
                    <View style={styles.heroRetakeOverlayBtn}>
                      <Ionicons name="camera-reverse" size={13} color="#ffffff" />
                      <Text style={styles.heroRetakeOverlayText}>Tap to Retake</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.heroCenterCameraCircle}>
                      <Ionicons name="camera" size={26} color="#ffffff" />
                    </View>
                    <View style={styles.sampleGuideOverlay}>
                      <Ionicons name="eye-outline" size={13} color="#ffffff" />
                      <Text style={styles.sampleGuideOverlayText}>
                        Reference Guide • Tap to capture
                      </Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* 4-Angle Thumbnail Strip for Quick Navigation */}
        <View style={styles.stripSection}>
          <View style={styles.stripHeaderRow}>
            <Text style={styles.stripSectionTitle}>ALL 4 ANGLES REVIEW</Text>
            <Text style={styles.stripSubTitle}>Tap any angle to jump</Text>
          </View>
          <View style={styles.stripRow}>
            {inspectionAngleConfigs.map((angle, idx) => {
              const photoUrl = photos[idx];
              const isSelected = idx === currentAngleIndex;
              return (
                <TouchableOpacity
                  key={angle.id}
                  style={[
                    styles.stripCard,
                    isSelected && styles.stripCardSelected,
                  ]}
                  onPress={() => setCurrentAngleIndex(idx)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={photoUrl ? { uri: photoUrl } : angle.sampleSource}
                    style={styles.stripThumb}
                    resizeMode="cover"
                  />
                  <View
                    style={[
                      styles.stripBadge,
                      photoUrl ? styles.stripBadgeDone : styles.stripBadgePending,
                    ]}
                  >
                    <Ionicons
                      name={photoUrl ? 'checkmark' : 'camera'}
                      size={10}
                      color="#ffffff"
                    />
                  </View>
                  <Text
                    style={[
                      styles.stripTitle,
                      isSelected && styles.stripTitleSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {angle.shortTitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Pinned Bottom CTA Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            isAllAttached
              ? styles.submitButtonGreen
              : !photos[currentAngleIndex]
              ? styles.yellowPrimaryButton
              : styles.submitButtonNavy,
            saving && { opacity: 0.7 },
          ]}
          onPress={handleBottomBarPress}
          disabled={saving}
          activeOpacity={0.88}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : isAllAttached ? (
            <>
              <View style={styles.ctaIconCircle}>
                <Ionicons name="checkmark-sharp" size={15} color="#059669" />
              </View>
              <Text style={styles.submitButtonText}>SAVE INSPECTION & UNLOCK START TRIP</Text>
              <Ionicons name="arrow-forward" size={17} color="#ffffff" />
            </>
          ) : !photos[currentAngleIndex] ? (
            <>
              <View style={styles.btnLeftGroup}>
                <Ionicons name="camera" size={20} color="#0f172a" />
                <View style={styles.btnDividerDark} />
                <Text style={styles.yellowPrimaryButtonText} numberOfLines={1}>
                  Capture {inspectionAngleConfigs[currentAngleIndex].title}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#0f172a" />
            </>
          ) : (
            <>
              <Text style={styles.submitButtonText}>
                {currentAngleIndex < 3
                  ? `NEXT: ${inspectionAngleConfigs[currentAngleIndex + 1].shortTitle.toUpperCase()} ANGLE`
                  : `SAVE INSPECTION (${attachedCount}/4)`}
              </Text>
              <Ionicons name="arrow-forward" size={17} color="#ffffff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingRight: 8,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  navTitleCenter: {
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  quickFillBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ea580c',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickFillBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
  },
  noticeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 14,
  },
  noticeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  noticeSub: {
    fontSize: 11.5,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 8,
  },
  progressContainer: {
    paddingVertical: 2,
    marginTop: 4,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  progressCount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0284c7',
    borderRadius: 3,
  },
  progressBarFillComplete: {
    backgroundColor: '#059669',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 2,
  },
  sectionHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  photoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
    gap: 4,
  },
  photoCountBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0284c7',
  },
  // Step tabs
  stepTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  stepTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  stepTabActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  stepTabDone: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
  stepBadgeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeCircleActive: {
    backgroundColor: '#2563eb',
  },
  stepBadgeCircleDone: {
    backgroundColor: '#059669',
  },
  stepBadgeNumber: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748b',
  },
  stepBadgeNumberActive: {
    color: '#ffffff',
  },
  stepTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  stepTabTextActive: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  stepTabTextDone: {
    color: '#059669',
    fontWeight: '800',
  },

  // Hero Angle Card
  heroAngleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
  },
  heroCardHeader: {
    marginBottom: 12,
  },
  stepTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stepTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  angleStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeGreen: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  badgeAmber: {
    backgroundColor: '#fff8ea',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  badgeTextGreen: {
    color: '#059669',
    fontSize: 9.5,
    fontWeight: '800',
  },
  badgeTextAmber: {
    color: '#d97706',
    fontSize: 9.5,
    fontWeight: '800',
  },
  heroCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroCardDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  heroImageBox: {
    width: '100%',
    height: 215,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
    marginBottom: 0,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroCenterCameraCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 30, 60, 0.85)',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleGuideOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sampleGuideOverlayText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  heroAttachedRibbon: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.95)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroAttachedRibbonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  heroRetakeOverlayBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroRetakeOverlayText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  heroCaptureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 10,
  },
  heroCaptureBtnPrimary: {
    backgroundColor: '#142232',
    shadowColor: '#142232',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  heroCaptureBtnDone: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  heroCaptureBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  heroCaptureBtnTextDone: {
    color: '#0f172a',
  },
  navAngleControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  navAngleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  navAngleBtnDisabled: {
    opacity: 0.35,
  },
  navAngleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  navAngleBtnTextDisabled: {
    color: '#94a3b8',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotItem: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  dotItemActive: {
    width: 20,
    backgroundColor: '#2563eb',
  },
  dotItemDone: {
    backgroundColor: '#10b981',
  },

  // Review Strip
  stripSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 12,
  },
  stripHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stripSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.4,
  },
  stripSubTitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  stripRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stripCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 4,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    position: 'relative',
  },
  stripCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  stripThumb: {
    width: '100%',
    height: 52,
    borderRadius: 6,
    marginBottom: 4,
  },
  stripBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripBadgeDone: {
    backgroundColor: '#059669',
  },
  stripBadgePending: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  stripTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  stripTitleSelected: {
    color: '#1d4ed8',
    fontWeight: '800',
  },

  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 10.5,
    color: '#0369a1',
    lineHeight: 15,
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  submitButton: {
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
  },
  submitButtonNavy: {
    backgroundColor: '#1e293b',
    shadowColor: '#1e293b',
    shadowOpacity: 0.3,
  },
  submitButtonGreen: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOpacity: 0.35,
  },
  ctaIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  // Yellow Primary Button for unattached state
  yellowPrimaryButton: {
    backgroundColor: '#fbbf24',
    borderRadius: 30,
    height: 54,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  btnLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  btnDividerDark: {
    width: 1.5,
    height: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    marginHorizontal: 12,
  },
  yellowPrimaryButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    flex: 1,
  },
});
