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
  PermissionsAndroid,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { locationTracker } from '../../lib/location-tracker';
import { driverApiClient } from '../../lib/api';
import {
  setTripVerificationCompleted,
  setVerifiedSelfie,
  getVerifiedSelfie,
  setTripStartDraft,
  getTripStartDraft,
} from '../../lib/tripState';
import { TripFlowHeader } from '../../components/TripFlowHeader';
import { Ionicons } from '@expo/vector-icons';

import {
  FRONT_SAMPLE_URI,
  REAR_SAMPLE_URI,
  SIDE_SAMPLE_URI,
  INSIDE_FRONT_SAMPLE_URI,
  INSIDE_BACK_SAMPLE_URI,
  DRIVER_SELFIE_SAMPLE_URI,
} from '../../assets/inspectionSamples';

// Local reference sample assets (5 vehicle angles + driver cabin selfie)
// Sourced from optimized base64 data URIs for guaranteed offline rendering across all Android versions
const FRONT_SAMPLE = { uri: FRONT_SAMPLE_URI };
const REAR_SAMPLE = { uri: REAR_SAMPLE_URI };
const SIDE_SAMPLE = { uri: SIDE_SAMPLE_URI };
const INSIDE_FRONT_SAMPLE = { uri: INSIDE_FRONT_SAMPLE_URI };
const INSIDE_BACK_SAMPLE = { uri: INSIDE_BACK_SAMPLE_URI };
const DRIVER_SELFIE_SAMPLE = { uri: DRIVER_SELFIE_SAMPLE_URI };

export default function DriverVehicleInspectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  // 5 Verification Steps: Driver Cabin Selfie first, followed by 4 Vehicle Angles (Side profile removed)
  const inspectionAngleConfigs = [
    {
      id: 0,
      title: 'Driver Cabin Selfie',
      shortTitle: 'Selfie',
      desc: 'Front face selfie from driving seat required',
      icon: 'person-outline' as const,
      iconBg: '#eff6ff',
      iconColor: '#2563eb',
      sampleSource: DRIVER_SELFIE_SAMPLE,
      isFrontCamera: true,
    },
    {
      id: 1,
      title: 'Front Angle',
      shortTitle: 'Front',
      desc: 'Front bumper & number plate clearly visible',
      icon: 'car-outline' as const,
      iconBg: '#e0f2fe',
      iconColor: '#0284c7',
      sampleSource: FRONT_SAMPLE,
      isFrontCamera: false,
    },
    {
      id: 2,
      title: 'Back / Rear Angle',
      shortTitle: 'Rear',
      desc: 'Rear bumper, tail lights & boot clearly visible',
      icon: 'car-sport-outline' as const,
      iconBg: '#f3e8ff',
      iconColor: '#9333ea',
      sampleSource: REAR_SAMPLE,
      isFrontCamera: false,
    },
    {
      id: 3,
      title: 'Inside Front (Door Open)',
      shortTitle: 'Front Door',
      desc: 'Front door opened, dashboard, steering & front seats',
      icon: 'car-outline' as const,
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      sampleSource: INSIDE_FRONT_SAMPLE,
      isFrontCamera: false,
    },
    {
      id: 4,
      title: 'Inside Back Seat (Door Open)',
      shortTitle: 'Back Door',
      desc: 'Back seat door opened, passenger seats & floor mats',
      icon: 'people-outline' as const,
      iconBg: '#fce7f3',
      iconColor: '#db2777',
      sampleSource: INSIDE_BACK_SAMPLE,
      isFrontCamera: false,
    },
  ];

  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null, null, null]);
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
          let initialPhotos: (string | null)[] = [null, null, null, null, null];
          if (Array.isArray(b.vehicleInspectionPhotos) && b.vehicleInspectionPhotos.length === 5) {
            initialPhotos = [
              b.vehicleInspectionPhotos[0] || null, // 0: Driver Cabin Selfie
              b.vehicleInspectionPhotos[1] || null, // 1: Front
              b.vehicleInspectionPhotos[2] || null, // 2: Rear
              b.vehicleInspectionPhotos[3] || null, // 3: Front Door
              b.vehicleInspectionPhotos[4] || null, // 4: Back Door
            ];
          } else if (Array.isArray(b.vehicleInspectionPhotos) && b.vehicleInspectionPhotos.length === 4) {
            initialPhotos = [
              null, // 0: Driver Cabin Selfie
              b.vehicleInspectionPhotos[0] || null, // 1: Front
              b.vehicleInspectionPhotos[1] || null, // 2: Rear
              b.vehicleInspectionPhotos[2] || null, // 3: Front Door
              b.vehicleInspectionPhotos[3] || null, // 4: Back Door
            ];
          }

          // Check if driver selfie is already attached or drafted
          const targetId = b.id || bookingId;
          if (targetId) {
            const draft = getTripStartDraft(targetId);
            if (draft?.driverSelfieUri) {
              initialPhotos[0] = draft.driverSelfieUri;
            }
            const savedSelfie = await getVerifiedSelfie(targetId);
            if (savedSelfie?.uri) {
              initialPhotos[0] = savedSelfie.uri;
            }
          }

          setPhotos(initialPhotos);
          const firstUnattached = initialPhotos.findIndex((p) => !p);
          if (firstUnattached !== -1) {
            setCurrentAngleIndex(firstUnattached);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch booking for inspection:', err);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const applyCapturedPhoto = (index: number, dataUri: string) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = dataUri;
      return next;
    });

    const bId = bookingId || booking?.id;
    if (index === 0 && bId) {
      const latest = locationTracker.getCurrentCoordinates();
      let locStamp = null;
      if (latest.lat != null && latest.lng != null) {
        locStamp = {
          lat: latest.lat,
          lng: latest.lng,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
      }
      setVerifiedSelfie(bId, dataUri, locStamp);
      setTripStartDraft(bId, { driverSelfieUri: dataUri });
    }

    // Advance to next angle if not at last
    if (index < 4) {
      setCurrentAngleIndex(index + 1);
    }
  };

  const handleCameraCapture = async (index: number) => {
    try {
      const isFront = inspectionAngleConfigs[index]?.isFrontCamera;

      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: 'Camera Permission',
              message: 'Kandy Cabs driver app needs camera access to capture vehicle inspection photos.',
              buttonPositive: 'OK',
            }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
            return;
          }
        } catch (_) {}
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync().catch(() => ({ status: 'denied' }));
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to capture photos.');
        return;
      }

      let result: ImagePicker.ImagePickerResult | null = null;
      try {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.35,
          base64: true,
          allowsEditing: false,
          cameraType: isFront ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
        });
      } catch (camErr: any) {
        // Fallback retry without cameraType parameter
        try {
          result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.35,
            base64: true,
          });
        } catch (camErr2: any) {
          Alert.alert('Camera Error', camErr2?.message || 'Could not launch camera');
          return;
        }
      }

      if (result && !result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        applyCapturedPhoto(index, dataUri);
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err?.message || 'Could not capture photo');
    }
  };

  const handleFillDemoPhotos = () => {
    setPhotos([
      'demo_selfie',
      'demo_front',
      'demo_rear',
      'demo_inside_front',
      'demo_inside_back',
    ]);
    const bId = bookingId || booking?.id;
    if (bId) {
      setVerifiedSelfie(bId, 'demo_selfie');
      setTripStartDraft(bId, { driverSelfieUri: 'demo_selfie' });
    }
    setCurrentAngleIndex(4);
    Alert.alert('Demo Evidence Loaded', 'Driver Cabin Selfie and 4 vehicle inspection angles loaded!');
  };

  const attachedCount = photos.filter(Boolean).length;
  const isAllAttached = attachedCount === 5;

  const handleBottomBarPress = () => {
    if (isAllAttached) {
      handleSaveInspection();
    } else if (!photos[currentAngleIndex]) {
      handleCameraCapture(currentAngleIndex);
    } else if (currentAngleIndex < 4) {
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
        `Please attach driver cabin selfie and 4 vehicle inspection photos before proceeding (${attachedCount}/5 attached).`,
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
          vehicleInspectionPhotos: photos, // All 5 verification photos: [0: Selfie, 1: Front, 2: Rear, 3: Front Door, 4: Back Door]
          driverSelfie: photos[0],
        }),
      });

      if (photos[0]) {
        setVerifiedSelfie(bId, photos[0]);
        setTripStartDraft(bId, { driverSelfieUri: photos[0] });
      }

      await setTripVerificationCompleted(bId, true);
      // Navigate to Step 2: Pickup Page
      router.replace({
        pathname: '/trip/en-route',
        params: { bookingId: bId },
      });
    } catch (err: any) {
      console.warn('Vehicle inspection save error:', err);
      await setTripVerificationCompleted(bId, true);
      router.replace({
        pathname: '/trip/en-route',
        params: { bookingId: bId },
      });
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

      {/* 6-Step Connected Progress Stepper: 1. Verify (Active) -> 2. Pickup -> 3. Odometer -> 4. OTP -> 5. On Trip -> 6. Drop */}
      <TripFlowHeader currentStep={1} />

      {/* Top Navigation Bar */}
      <View style={[styles.topNavBar, { paddingTop: 6 }]}>
        <View style={styles.navPlaceholder} />

        <View style={styles.navTitleCenter}>
          <Text style={styles.navTitle}>Verification</Text>
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
                      STEP {currentAngleIndex + 1} OF 5
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
                </View>
              </View>

              {/* Top: Blank Box to Upload / Attached Clicked Photo */}
              <TouchableOpacity
                style={[
                  styles.photoBox,
                  !isCurrentAttached && styles.photoBoxBlank,
                ]}
                onPress={() => handleCameraCapture(currentAngleIndex)}
                activeOpacity={0.88}
              >
                {isCurrentAttached ? (
                  <>
                    <Image
                      source={
                        currentPhotoUri?.startsWith('demo_')
                          ? currentAngle.sampleSource
                          : { uri: currentPhotoUri! }
                      }
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
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
                  <View style={styles.blankUploadContent}>
                    <View style={styles.blankCameraCircle}>
                      <Ionicons
                        name={currentAngle.isFrontCamera ? 'person' : 'camera'}
                        size={22}
                        color="#2563eb"
                      />
                    </View>
                    <Text style={styles.blankUploadTitle}>Upload {currentAngle.title}</Text>
                    <Text style={styles.blankUploadSubtitle}>
                      {currentAngle.isFrontCamera
                        ? 'Tap to open front camera & capture selfie'
                        : 'Tap to open camera & capture photo'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Bottom: Reference Guide Image */}
              <View style={styles.referenceSection}>
                <View style={styles.referenceHeaderRow}>
                  <Ionicons name="eye-outline" size={13} color="#64748b" />
                  <Text style={styles.referenceHeaderTitle}>
                    Reference Guide • {currentAngle.title}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.referenceImageBox}
                  onPress={() => handleCameraCapture(currentAngleIndex)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={currentAngle.sampleSource}
                    style={styles.referenceImage}
                    resizeMode="cover"
                  />
                  <View style={styles.referenceOverlayBadge}>
                    <Text style={styles.referenceOverlayBadgeText}>SAMPLE REFERENCE</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* 5-Angle Thumbnail Strip for Quick Navigation */}
        <View style={styles.stripSection}>
          <View style={styles.stripHeaderRow}>
            <Text style={styles.stripSectionTitle}>VERIFICATION REVIEW (5 STEPS)</Text>
            <Text style={styles.stripSubTitle}>Tap any angle to jump</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripRow}
          >
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
                    source={
                      photoUrl && !photoUrl.startsWith('demo_')
                        ? { uri: photoUrl }
                        : angle.sampleSource
                    }
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
                  <View style={styles.stripLabelBar}>
                    <Text
                      style={[
                        styles.stripTitle,
                        isSelected && styles.stripTitleSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {angle.shortTitle}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
              <Text style={styles.submitButtonText}>PROCEED TO PICKUP</Text>
              <Ionicons name="arrow-forward" size={17} color="#ffffff" />
            </>
          ) : !photos[currentAngleIndex] ? (
            <>
              <View style={styles.btnLeftGroup}>
                <Ionicons name={inspectionAngleConfigs[currentAngleIndex].isFrontCamera ? 'person' : 'camera'} size={20} color="#0f172a" />
                <Text style={styles.yellowPrimaryButtonText} numberOfLines={1}>
                  Capture {inspectionAngleConfigs[currentAngleIndex].title}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#0f172a" />
            </>
          ) : (
            <>
              <Text style={styles.submitButtonText}>
                {currentAngleIndex < 4
                  ? `NEXT: ${inspectionAngleConfigs[currentAngleIndex + 1].shortTitle.toUpperCase()}`
                  : `PROCEED TO PICKUP (${attachedCount}/5)`}
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
  navPlaceholder: {
    width: 60,
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
    marginBottom: 10,
  },
  heroCardHeader: {
    marginBottom: 6,
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
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroCardDesc: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  photoBox: {
    width: '100%',
    height: 125,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  photoBoxBlank: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    padding: 8,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  blankUploadContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankCameraCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
  },
  blankUploadTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  blankUploadSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  referenceSection: {
    marginTop: 0,
    marginBottom: 4,
  },
  referenceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  referenceHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.3,
  },
  referenceImageBox: {
    width: '100%',
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  referenceImage: {
    width: '100%',
    height: '100%',
  },
  referenceOverlayBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  referenceOverlayBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 10,
  },
  stripHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  stripCard: {
    width: 76,
    height: 76,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    position: 'relative',
    overflow: 'hidden',
  },
  stripCardSelected: {
    borderColor: '#2563eb',
    borderWidth: 2.5,
    backgroundColor: '#eff6ff',
    elevation: 3,
  },
  stripThumb: {
    width: '100%',
    height: '100%',
  },
  stripBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stripBadgeDone: {
    backgroundColor: '#059669',
  },
  stripBadgePending: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  stripLabelBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingVertical: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stripTitle: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  stripTitleSelected: {
    color: '#93c5fd',
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
    gap: 10,
  },
  yellowPrimaryButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    flex: 1,
  },
});
