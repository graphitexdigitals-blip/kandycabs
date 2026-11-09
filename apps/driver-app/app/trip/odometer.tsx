import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { TripFlowHeader } from '../../components/TripFlowHeader';
import { driverApiClient } from '../../lib/api';
import { locationTracker } from '../../lib/location-tracker';
import { getTripStartDraft, setTripStartDraft } from '../../lib/tripState';

const ODOMETER_SAMPLE = require('../../assets/images/inspection/odometer_sample.jpg');

export default function DriverOdometerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [odometerImageUri, setOdometerImageUri] = useState<string | null>(null);
  const [startingOdometer, setStartingOdometer] = useState<string>('');
  const [photoLocation, setPhotoLocation] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResultText, setOcrResultText] = useState<{ status: 'success' | 'failed' | 'idle'; reading?: number; message?: string }>({ status: 'idle' });
  const [error, setError] = useState<string>('');

  // Restore draft odometer on mount
  useEffect(() => {
    if (!bookingId) return;
    const draft = getTripStartDraft(bookingId);
    if (draft) {
      if (draft.startingOdometer) {
        setStartingOdometer(draft.startingOdometer);
      }
      if (draft.odometerImageUri && !draft.odometerImageUri.includes('images.unsplash.com')) {
        setOdometerImageUri(draft.odometerImageUri);
      }
      if (draft.photoLocation) {
        setPhotoLocation(draft.photoLocation);
      }
      if (draft.ocrResultText) {
        setOcrResultText(draft.ocrResultText);
      }
    }

    // Fetch active booking
    driverApiClient.fetch('/api/driver/status').then((res) => {
      if (res && res.success && res.activeBooking) {
        setBooking(res.activeBooking);
      }
    }).catch(() => {});
  }, [bookingId]);

  const runOdometerOcr = async (uriOrBase64: string) => {
    setOcrScanning(true);
    setOcrResultText({ status: 'idle' });
    try {
      const res = await driverApiClient.fetch('/api/driver/odometer/ocr', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: uriOrBase64 }),
      });
      if (res && res.success && res.reading) {
        setStartingOdometer(String(res.reading));
        const successOcr = {
          status: 'success' as const,
          reading: res.reading,
          message: `Auto-detected ${res.reading} KM from odometer photo`,
        };
        setOcrResultText(successOcr);
        if (bookingId) {
          setTripStartDraft(bookingId, {
            startingOdometer: String(res.reading),
            ocrResultText: successOcr,
          });
        }
      } else {
        setOcrResultText({
          status: 'failed',
          message: 'Could not auto-read gauge numbers. Please check and type reading manually.',
        });
      }
    } catch (err: any) {
      setOcrResultText({
        status: 'failed',
        message: 'Could not auto-read. Please enter reading manually.',
      });
    } finally {
      setOcrScanning(false);
    }
  };

  const handlePickGalleryImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery access is required to upload odometer photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.3,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setOdometerImageUri(dataUri);
        setError('');
        runOdometerOcr(dataUri);

        const latest = locationTracker.getCurrentCoordinates();
        let locStamp: { lat: number; lng: number; time: string } | null = null;
        if (latest.lat != null && latest.lng != null) {
          locStamp = {
            lat: latest.lat,
            lng: latest.lng,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          };
          setPhotoLocation(locStamp);
        }
        if (bookingId) {
          setTripStartDraft(bookingId, {
            odometerImageUri: dataUri,
            photoLocation: locStamp,
          });
        }
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err.message || 'Failed to select image');
    }
  };

  const handlePhotoAction = () => {
    handleOpenCamera();
  };

  const handleOpenCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to capture odometer photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.3,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setOdometerImageUri(dataUri);
        setError('');
        runOdometerOcr(dataUri);

        const latest = locationTracker.getCurrentCoordinates();
        let locStamp: { lat: number; lng: number; time: string } | null = null;
        if (latest.lat != null && latest.lng != null) {
          locStamp = {
            lat: latest.lat,
            lng: latest.lng,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          };
          setPhotoLocation(locStamp);
        }
        if (bookingId) {
          setTripStartDraft(bookingId, {
            odometerImageUri: dataUri,
            photoLocation: locStamp,
          });
        }
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Failed to open camera');
    }
  };

  const handleFillDemo = () => {
    setOdometerImageUri('demo_odometer');
    setStartingOdometer('42850');
    setError('');
    if (bookingId) {
      setTripStartDraft(bookingId, {
        odometerImageUri: 'demo_odometer',
        startingOdometer: '42850',
      });
    }
    Alert.alert('⚡ Demo Odometer Loaded', 'Starting odometer photo and 42,850 KM loaded!');
  };

  const handleProceedToOtp = () => {
    if (!odometerImageUri) {
      setError('Starting odometer photo is required.');
      Alert.alert('Odometer Photo Required', 'Please capture a clear photo of the starting odometer gauge before continuing.', [
        { text: '📷 Capture Photo', onPress: handleOpenCamera },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (!startingOdometer.trim()) {
      setError('Please enter the starting odometer reading in KM.');
      return;
    }

    if (bookingId) {
      setTripStartDraft(bookingId, {
        odometerImageUri,
        startingOdometer: startingOdometer.trim(),
        photoLocation,
      });
    }

    router.push({
      pathname: '/trip/start',
      params: { bookingId: bookingId || booking?.id, step: '2', arrived: 'true' },
    });
  };

  const isAttached = Boolean(odometerImageUri);
  const isComplete = Boolean(odometerImageUri && startingOdometer.trim());

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* 4-Step Flow Header: 1. Pickup (✓) -> 2. Odometer (Active) -> 3. OTP -> 4. Drop */}
      <TripFlowHeader currentStep={2} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={17} color="#ef4444" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Odometer Card (Only Content on Page) */}
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.headerIconCircle}>
                  <Ionicons name="speedometer" size={16} color="#ffffff" />
                </View>
                <View style={styles.headerTextCol}>
                  <Text style={styles.headerTitle}>Starting Odometer Reading *</Text>
                  <Text style={styles.headerSubtitle}>
                    {isComplete ? 'Starting gauge & photo completed ✓' : 'Gauge photo & reading required'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.demoBtn}
                onPress={handleFillDemo}
                activeOpacity={0.7}
              >
                <Ionicons name="flash" size={11} color="#ea580c" />
                <Text style={styles.demoBtnText}>Demo</Text>
              </TouchableOpacity>
            </View>

            {/* Viewfinder Wrapper */}
            <View style={styles.viewfinderWrapper}>
              {/* Top Photo Upload Box (Blank when no photo, shows user photo when uploaded) */}
              <TouchableOpacity
                style={[
                  styles.photoBox,
                  !odometerImageUri && styles.photoBoxBlank,
                ]}
                onPress={handlePhotoAction}
                activeOpacity={0.88}
              >
                {odometerImageUri ? (
                  <>
                    <Image
                      source={
                        odometerImageUri.startsWith('demo_')
                          ? ODOMETER_SAMPLE
                          : { uri: odometerImageUri }
                      }
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                    <View style={styles.attachedRibbon}>
                      <Ionicons name="checkmark-circle" size={13} color="#ffffff" />
                      <Text style={styles.attachedRibbonText}>✓ PHOTO ATTACHED</Text>
                    </View>
                    <View style={styles.retakeBtn}>
                      <Ionicons name="camera-reverse" size={12} color="#ffffff" />
                      <Text style={styles.retakeBtnText}>Tap to Retake</Text>
                    </View>

                    {/* GPS Stamp */}
                    {photoLocation && (
                      <View style={styles.gpsStamp}>
                        <Text style={styles.gpsStampText}>
                          📍 {`${photoLocation.lat.toFixed(4)}° N, ${photoLocation.lng.toFixed(4)}° E • ${photoLocation.time}`}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.blankUploadContent}>
                    <View style={styles.blankCameraCircle}>
                      <Ionicons name="camera" size={32} color="#0284c7" />
                    </View>
                    <Text style={styles.blankUploadTitle}>Upload Starting Odometer Photo</Text>
                    <Text style={styles.blankUploadSubtitle}>Tap to open camera & capture photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Reference Guide Image */}
              <View style={styles.referenceSection}>
                <View style={styles.referenceHeaderRow}>
                  <Ionicons name="eye-outline" size={15} color="#0284c7" style={{ marginRight: 6 }} />
                  <Text style={styles.referenceHeaderTitle}>Reference Guide (Sample)</Text>
                </View>

                <View style={styles.referenceImageBox}>
                  <Image
                    source={ODOMETER_SAMPLE}
                    style={styles.referenceImage}
                    resizeMode="cover"
                  />
                  <View style={styles.referenceOverlayBadge}>
                    <Text style={styles.referenceOverlayBadgeText}>SAMPLE REFERENCE</Text>
                  </View>
                </View>
              </View>

              {/* KM Input Field (Arranged Below Reference Image) */}
              <View style={styles.inputWrapper}>
                <View style={styles.inputContainer}>
                  <Ionicons name="speedometer-outline" size={18} color="#6366f1" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={startingOdometer}
                    onChangeText={(val) => {
                      setStartingOdometer(val);
                      setError('');
                      if (bookingId) setTripStartDraft(bookingId, { startingOdometer: val });
                    }}
                    keyboardType="decimal-pad"
                    placeholder="Enter starting km (e.g. 42850 KM)"
                    placeholderTextColor="#94a3b8"
                    maxLength={10}
                  />
                  {startingOdometer ? (
                    <TouchableOpacity
                      onPress={() => {
                        setStartingOdometer('');
                        if (bookingId) setTripStartDraft(bookingId, { startingOdometer: '' });
                      }}
                      style={styles.clearBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* OCR Feedback */}
                {ocrScanning ? (
                  <View style={styles.ocrLoadingRow}>
                    <ActivityIndicator size="small" color="#6366f1" style={{ marginRight: 6 }} />
                    <Text style={styles.ocrLoadingText}>Auto-detecting odometer reading...</Text>
                  </View>
                ) : ocrResultText.status === 'success' ? (
                  <View style={styles.ocrSuccessRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginRight: 5 }} />
                    <Text style={styles.ocrSuccessText}>{ocrResultText.message}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Bar: Action to proceed to OTP */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.instructionRow}>
            <Ionicons name="information-circle" size={18} color="#0284c7" style={{ marginTop: 2, marginRight: 8 }} />
            <Text style={styles.instructionText}>
              Capture vehicle starting odometer photo & confirm reading to proceed to customer OTP.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={!odometerImageUri ? handlePhotoAction : handleProceedToOtp}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>
              {!odometerImageUri
                ? 'Capture Starting Odometer Photo'
                : !startingOdometer.trim()
                ? 'Enter Starting Odometer Reading'
                : 'CONTINUE TO CUSTOMER OTP →'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    // Zero card background, border, or shadow
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  demoBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ea580c',
  },
  viewfinderWrapper: {
    marginTop: 6,
  },
  photoBox: {
    height: 190,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBoxBlank: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    padding: 16,
  },
  blankUploadContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankCameraCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
  },
  blankUploadTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 3,
  },
  blankUploadSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  referenceSection: {
    marginTop: 14,
    marginBottom: 4,
  },
  referenceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  referenceHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  referenceImageBox: {
    height: 135,
    borderRadius: 14,
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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  referenceOverlayBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cameraCenterCircle: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideOverlay: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  guideOverlayText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '600',
  },
  attachedRibbon: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  attachedRibbonText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  retakeBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  retakeBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  gpsStamp: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gpsStampText: {
    color: '#cbd5e1',
    fontSize: 9.5,
    fontWeight: '600',
  },
  inputWrapper: {
    marginTop: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  ocrLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  ocrLoadingText: {
    fontSize: 11.5,
    color: '#6366f1',
    fontWeight: '600',
  },
  ocrSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  ocrSuccessText: {
    fontSize: 11.5,
    color: '#16a34a',
    fontWeight: '600',
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    flex: 1,
    fontWeight: '500',
  },
  primaryBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

