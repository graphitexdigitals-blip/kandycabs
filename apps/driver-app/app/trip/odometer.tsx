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
  PermissionsAndroid,
  BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { TripFlowHeader } from '../../components/TripFlowHeader';
import { driverApiClient } from '../../lib/api';
import { locationTracker } from '../../lib/location-tracker';
import { useTranslation } from 'react-i18next';
import {
  getTripStartDraft,
  setTripStartDraft,
  getVerifiedSelfie,
  setVerifiedSelfie,
  setTripOdometerCompleted,
  isTripOdometerCompleted,
  isTripOdometerCompletedSync,
} from '../../lib/tripState';

const DRIVER_SELFIE_SAMPLE = require('../../assets/images/driver-selfie-reference.jpg');
const ODOMETER_SAMPLE = require('../../assets/images/inspection/odometer_sample.jpg');
import {
  ODOMETER_SAMPLE_57612_BASE64,
  ODOMETER_SAMPLE_91308_BASE64,
} from '../../assets/images/sampleOdometerBase64';

export default function DriverOdometerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'selfie' | 'odometer'>('odometer');
  const [driverSelfieUri, setDriverSelfieUri] = useState<string | null>(null);
  const [selfieLocation, setSelfieLocation] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const [odometerImageUri, setOdometerImageUri] = useState<string | null>(null);
  const [startingOdometer, setStartingOdometer] = useState<string>('');
  const [photoLocation, setPhotoLocation] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const [error, setError] = useState<string>('');

  // Handle hardware back button -> direct directly to driver home dashboard
  useEffect(() => {
    const onBackPress = () => {
      router.replace('/dashboard');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]);

  // If odometer was already completed or trip is started/completed, redirect immediately to the right screen
  useEffect(() => {
    if (!bookingId) return;
    const checkAlreadyDone = async () => {
      // 1. Check in-memory / local storage
      const isDoneLocally = isTripOdometerCompletedSync(bookingId) || (await isTripOdometerCompleted(bookingId));

      // 2. Check live status from database so mobile restart / app reopen doesn't re-show submitted odometer
      try {
        const res = await driverApiClient.fetch('/api/driver/status');
        if (res.success && res.activeBooking) {
          const b = res.activeBooking;
          if (b.status === 'COMPLETED' || b.status === 'TRIP_COMPLETED' || b.status === 'TRIP_ENDED') {
            router.replace('/dashboard');
            return;
          }
          if (b.status === 'TRIP_STARTED' || b.status === 'ON_TRIP' || b.status === 'IN_PROGRESS') {
            router.replace({
              pathname: '/trip/active',
              params: { bookingId },
            });
            return;
          }
          if (b.startingOdometer != null || isDoneLocally) {
            await setTripOdometerCompleted(bookingId, true);
            router.replace({
              pathname: '/trip/start',
              params: { bookingId, step: '2', arrived: 'true' },
            });
            return;
          }
        }
      } catch (e) {
        // Fallback to local state if offline
        if (isDoneLocally) {
          router.replace({
            pathname: '/trip/start',
            params: { bookingId, step: '2', arrived: 'true' },
          });
        }
      }
    };
    checkAlreadyDone();
  }, [bookingId, router]);

  // Restore draft selfie and odometer on mount
  useEffect(() => {
    if (!bookingId) return;
    const draft = getTripStartDraft(bookingId);
    if (draft) {
      if (draft.driverSelfieUri && !draft.driverSelfieUri.includes('images.unsplash.com')) {
        setDriverSelfieUri(draft.driverSelfieUri);
        setCurrentStep('odometer');
      }
      if (draft.startingOdometer) {
        setStartingOdometer(draft.startingOdometer);
      }
      if (draft.odometerImageUri && !draft.odometerImageUri.includes('images.unsplash.com')) {
        setOdometerImageUri(draft.odometerImageUri);
      }
      if (draft.photoLocation) {
        setPhotoLocation(draft.photoLocation);
      }
    }

    getVerifiedSelfie(bookingId).then((savedSelfie) => {
      if (savedSelfie && savedSelfie.uri && !savedSelfie.uri.includes('images.unsplash.com')) {
        setDriverSelfieUri(savedSelfie.uri);
        setCurrentStep('odometer');
        if (savedSelfie.location) {
          setSelfieLocation(savedSelfie.location);
        }
      }
    }).catch(() => {});

    // Fetch active booking
    driverApiClient.fetch('/api/driver/status').then((res) => {
      if (res && res.success && res.activeBooking) {
        setBooking(res.activeBooking);
      }
    }).catch(() => {});
  }, [bookingId]);

  const handleSelectSampleOdometer = (reading: string, base64Uri: string) => {
    setOdometerImageUri(base64Uri);
    setStartingOdometer(reading);
    setError('');

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
        odometerImageUri: base64Uri,
        startingOdometer: reading,
        photoLocation: locStamp,
      });
    }
  };

  const handleOpenSelfieCamera = async () => {
    try {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: t('start_odometer.camera_permission_title', 'Camera Permission'),
              message: t('start_odometer.selfie_camera_permission_msg', 'Kandy Cabs driver app needs camera access to capture driver cabin selfie.'),
              buttonPositive: 'OK',
            }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              t('start_odometer.permission_denied', 'Permission Denied'),
              t('start_odometer.camera_permission_required', 'Camera permission is required to capture selfie.')
            );
            return;
          }
        } catch (_) {}
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync().catch(() => ({ status: 'denied' }));
      if (status !== 'granted') {
        Alert.alert(
          t('start_odometer.permission_required', 'Permission Required'),
          t('start_odometer.camera_permission_required', 'Camera permission is required to capture driver selfie.')
        );
        return;
      }
      let result: any = null;
      try {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.35,
          base64: true,
          cameraType: ImagePicker.CameraType.front,
        });
      } catch (camErr1) {
        // Retry without cameraType parameter if OEM throws
        try {
          result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.35,
            base64: true,
          });
        } catch (camErr2: any) {
          console.warn('Selfie launchCameraAsync failed:', camErr2);
          Alert.alert(
            t('start_odometer.camera_error', 'Camera Error'),
            'Could not open camera on this device. Please check camera permissions.'
          );
          return;
        }
      }

      if (result && !result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        applySelfiePhoto(dataUri);
      }
    } catch (err: any) {
      Alert.alert(
        t('start_odometer.camera_error', 'Camera Error'),
        err?.message || t('start_odometer.failed_capture_selfie', 'Failed to capture selfie')
      );
    }
  };

  const applySelfiePhoto = (dataUri: string) => {
    setDriverSelfieUri(dataUri);
    setCurrentStep('odometer');
    setError('');

    const latest = locationTracker.getCurrentCoordinates();
    let locStamp: { lat: number; lng: number; time: string } | null = null;
    if (latest.lat != null && latest.lng != null) {
      locStamp = {
        lat: latest.lat,
        lng: latest.lng,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setSelfieLocation(locStamp);
    }
    if (bookingId) {
      setVerifiedSelfie(bookingId, dataUri, locStamp);
      setTripStartDraft(bookingId, {
        driverSelfieUri: dataUri,
      });
    }
  };

  const handleSelfieAction = () => {
    handleOpenSelfieCamera();
  };

  const handlePhotoAction = () => {
    handleOpenCamera();
  };

  const handleOpenCamera = async () => {
    try {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: t('start_odometer.camera_permission_title', 'Camera Permission'),
              message: t('start_odometer.camera_permission_msg', 'Kandy Cabs driver app needs camera access to capture vehicle odometer photo.'),
              buttonPositive: 'OK',
            }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert(
              t('start_odometer.permission_denied', 'Permission Denied'),
              t('start_odometer.camera_permission_required', 'Camera permission is required to capture odometer photo.')
            );
            return;
          }
        } catch (_) {}
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync().catch(() => ({ status: 'denied' }));
      if (status !== 'granted') {
        Alert.alert(
          t('start_odometer.permission_required', 'Permission Required'),
          t('start_odometer.camera_permission_required', 'Camera permission is required to capture odometer photo.')
        );
        return;
      }
      let result: any = null;
      try {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.3,
          base64: true,
        });
      } catch (camErr: any) {
        console.warn('Odometer launchCameraAsync failed:', camErr);
        Alert.alert(
          t('start_odometer.camera_error', 'Camera Error'),
          'Could not launch camera. Please check camera permissions.'
        );
        return;
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setOdometerImageUri(dataUri);
        setError('');

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
      Alert.alert(
        t('start_odometer.camera_error', 'Camera Error'),
        err?.message || t('start_odometer.failed_capture_odometer', 'Failed to capture odometer')
      );
    }
  };

  const handleFillDemo = () => {
    setDriverSelfieUri('demo_selfie');
    setOdometerImageUri('demo_odometer');
    setStartingOdometer('42850');
    setCurrentStep('odometer');
    setError('');
    if (bookingId) {
      setVerifiedSelfie(bookingId, 'demo_selfie');
      setTripStartDraft(bookingId, {
        driverSelfieUri: 'demo_selfie',
        odometerImageUri: 'demo_odometer',
        startingOdometer: '42850',
      });
    }
    Alert.alert(
      t('start_odometer.demo_loaded_title', '⚡ Demo Evidence Loaded'),
      t('start_odometer.demo_loaded_msg', 'Driver cabin selfie, odometer photo and 42,850 KM loaded!')
    );
  };

  const handleProceedToOtp = () => {
    if (!driverSelfieUri) {
      setError(t('start_odometer.selfie_required_error', 'Driver cabin selfie is required.'));
      Alert.alert(
        t('start_odometer.selfie_required_title', 'Driver Selfie Required'),
        t('start_odometer.selfie_required_msg', 'Please capture a clear face selfie from the driving seat before continuing.'),
        [
          { text: t('start_odometer.capture_selfie_btn', '📷 Capture Selfie'), onPress: handleOpenSelfieCamera },
          { text: t('start_odometer.cancel_btn', 'Cancel'), style: 'cancel' },
        ]
      );
      return;
    }
    if (!odometerImageUri) {
      setError(t('start_odometer.odometer_photo_required_error', 'Starting odometer photo is required.'));
      Alert.alert(
        t('start_odometer.odometer_photo_required_title', 'Odometer Photo Required'),
        t('start_odometer.odometer_photo_required_msg', 'Please capture a clear photo of the starting odometer gauge before continuing.'),
        [
          { text: t('start_odometer.capture_photo_btn', '📷 Capture Photo'), onPress: handleOpenCamera },
          { text: t('start_odometer.cancel_btn', 'Cancel'), style: 'cancel' },
        ]
      );
      return;
    }
    if (!startingOdometer || !startingOdometer.trim()) {
      setError(t('start_odometer.enter_starting_km_error', 'Please enter the starting odometer reading in KM.'));
      Alert.alert(
        t('start_odometer.odometer_reading_required_title', 'Odometer Reading Required'),
        t('start_odometer.enter_starting_km_msg', 'Please enter the starting odometer reading in KM. Without odometer reading you cannot proceed.')
      );
      return;
    }

    const odoNum = parseFloat(startingOdometer.trim());
    if (isNaN(odoNum) || odoNum <= 0) {
      setError(t('start_odometer.enter_valid_km_error', 'Please enter a valid positive odometer reading in KM.'));
      Alert.alert(
        t('start_odometer.odometer_reading_required_title', 'Odometer Reading Required'),
        'Please enter a valid numeric odometer reading in KM. Without odometer reading you cannot proceed.'
      );
      return;
    }

    const targetBookingId = bookingId || booking?.id;
    if (targetBookingId) {
      setTripStartDraft(targetBookingId, {
        driverSelfieUri,
        odometerImageUri,
        startingOdometer: startingOdometer.trim(),
        photoLocation,
      });
      setTripOdometerCompleted(targetBookingId, true);

      // Persist directly to database so restart/power off will remember it permanently
      driverApiClient.fetch('/api/driver/trip/odometer', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: targetBookingId,
          startingOdometer: startingOdometer.trim(),
          startingOdometerImagePath: odometerImageUri,
          driverSelfie: driverSelfieUri,
          photoLocation,
        }),
      }).catch((err) => console.warn('Sync starting odometer to DB error:', err));
    }

    router.replace({
      pathname: '/trip/start',
      params: { bookingId: targetBookingId, step: '2', arrived: 'true' },
    });
  };

  const isAttached = Boolean(odometerImageUri);
  const isComplete = Boolean(odometerImageUri && startingOdometer.trim());
  const isStepReady =
    currentStep === 'selfie'
      ? Boolean(driverSelfieUri)
      : Boolean(odometerImageUri && startingOdometer.trim());

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* 6-Step Flow Header: 1. Verify (✓) -> 2. Start (✓) -> 3. Odometer (Active) -> 4. OTP -> 5. On Trip -> 6. Drop */}
      <TripFlowHeader currentStep={3} />

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

          {/* STEP 1: DRIVER CABIN SELFIE ONLY (ARRANGED FIRST WITH REFERENCE) */}
          {currentStep === 'selfie' ? (
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.headerIconCircle, { backgroundColor: '#2563eb' }]}>
                    <Ionicons name="person" size={16} color="#ffffff" />
                  </View>
                  <View style={styles.headerTextCol}>
                    <Text style={styles.headerTitle}>{t('start_odometer.driver_cabin_selfie_title', 'Driver Cabin Selfie *')}</Text>
                    <Text style={styles.headerSubtitle}>
                      {driverSelfieUri
                        ? t('start_odometer.cabin_selfie_attached', 'Cabin selfie attached ✓')
                        : t('start_odometer.cabin_selfie_required_sub', 'Front face selfie from driving seat required')}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.demoBtn}
                  onPress={handleFillDemo}
                  activeOpacity={0.7}
                >
                  <Ionicons name="flash" size={11} color="#ea580c" />
                  <Text style={styles.demoBtnText}>{t('start_odometer.demo_btn', 'Demo')}</Text>
                </TouchableOpacity>
              </View>

              {/* Viewfinder Wrapper */}
              <View style={styles.viewfinderWrapper}>
                {/* Top Photo Upload Box (Blank when no photo, shows user photo when uploaded) */}
                <TouchableOpacity
                  style={[
                    styles.photoBox,
                    !driverSelfieUri ? styles.photoBoxBlank : null,
                  ]}
                  onPress={handleSelfieAction}
                  activeOpacity={0.88}
                >
                  {driverSelfieUri ? (
                    <>
                      <Image
                        source={
                          driverSelfieUri.startsWith('demo_') || driverSelfieUri.includes('images.unsplash.com')
                            ? DRIVER_SELFIE_SAMPLE
                            : { uri: driverSelfieUri }
                        }
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                      <View style={styles.attachedRibbon}>
                        <Ionicons name="checkmark-circle" size={13} color="#ffffff" />
                        <Text style={styles.attachedRibbonText}>{t('start_odometer.photo_attached_ribbon', '✓ PHOTO ATTACHED')}</Text>
                      </View>
                      <View style={styles.retakeBtn}>
                        <Ionicons name="camera-reverse" size={12} color="#ffffff" />
                        <Text style={styles.retakeBtnText}>{t('start_odometer.tap_to_retake', 'Tap to Retake')}</Text>
                      </View>

                      {/* GPS Stamp */}
                      {selfieLocation && (
                        <View style={styles.gpsStamp}>
                          <Text style={styles.gpsStampText}>
                            📍 {`${selfieLocation.lat.toFixed(4)}° N, ${selfieLocation.lng.toFixed(4)}° E • ${selfieLocation.time}`}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.blankUploadContent}>
                      <View style={[styles.blankCameraCircle, { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }]}>
                        <Ionicons name="person" size={28} color="#2563eb" />
                      </View>
                      <Text style={styles.blankUploadTitle}>{t('start_odometer.upload_selfie_title', 'Upload Driver Cabin Selfie')}</Text>
                      <Text style={styles.blankUploadSubtitle}>{t('start_odometer.upload_selfie_sub', 'Tap to open front camera & capture selfie')}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Selfie Action Row */}
                <View style={styles.photoActionRow}>
                  <TouchableOpacity
                    style={[styles.photoActionBtn, { flex: 1 }]}
                    onPress={handleOpenSelfieCamera}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={14} color="#2563eb" style={{ marginRight: 5 }} />
                    <Text style={styles.photoActionBtnText}>Take Live Selfie (Camera Only)</Text>
                  </TouchableOpacity>
                </View>

                {/* Reference Guide Image at Bottom */}
                <View style={styles.referenceSection}>
                  <View style={styles.referenceImageBox}>
                    <Image
                      source={DRIVER_SELFIE_SAMPLE}
                      style={styles.referenceImage}
                      resizeMode="cover"
                    />
                    <View style={styles.referenceOverlayBadge}>
                      <Text style={styles.referenceOverlayBadgeText}>{t('start_odometer.sample_reference', 'SAMPLE REFERENCE')}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            /* STEP 2: STARTING ODOMETER READING */
            <View>
              <View style={styles.card}>
                {/* Header */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.headerIconCircle}>
                      <Ionicons name="speedometer" size={16} color="#ffffff" />
                    </View>
                    <View style={styles.headerTextCol}>
                      <Text style={styles.headerTitle}>{t('start_odometer.starting_odometer_title', 'Starting Odometer Reading *')}</Text>
                      <Text style={styles.headerSubtitle}>
                        {odometerImageUri && startingOdometer.trim()
                          ? t('start_odometer.starting_gauge_completed', 'Starting gauge & photo completed ✓')
                          : t('start_odometer.gauge_photo_required_sub', 'Gauge photo & reading required')}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.demoBtn}
                    onPress={handleFillDemo}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="flash" size={11} color="#ea580c" />
                    <Text style={styles.demoBtnText}>{t('start_odometer.demo_btn', 'Demo')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Viewfinder Wrapper */}
                <View style={styles.viewfinderWrapper}>
                  {/* Top Photo Upload Box */}
                  <TouchableOpacity
                    style={[
                      styles.photoBox,
                      !odometerImageUri ? styles.photoBoxBlank : null,
                    ]}
                    onPress={handlePhotoAction}
                    activeOpacity={0.88}
                  >
                    {odometerImageUri ? (
                      <>
                        <Image
                          source={
                            odometerImageUri.startsWith('demo_') || odometerImageUri.includes('images.unsplash.com')
                              ? ODOMETER_SAMPLE
                              : { uri: odometerImageUri }
                          }
                          style={styles.photoImage}
                          resizeMode="cover"
                        />
                        <View style={styles.attachedRibbon}>
                          <Ionicons name="checkmark-circle" size={13} color="#ffffff" />
                          <Text style={styles.attachedRibbonText}>{t('start_odometer.photo_attached_ribbon', '✓ PHOTO ATTACHED')}</Text>
                        </View>
                        <View style={styles.retakeBtn}>
                          <Ionicons name="camera-reverse" size={12} color="#ffffff" />
                          <Text style={styles.retakeBtnText}>{t('start_odometer.tap_to_retake', 'Tap to Retake')}</Text>
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
                        <Text style={styles.blankUploadTitle}>{t('start_odometer.upload_odometer_title', 'Upload Starting Odometer Photo')}</Text>
                        <Text style={styles.blankUploadSubtitle}>{t('start_odometer.upload_odometer_sub', 'Tap to open camera & capture photo')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Photo Actions Row (Camera Only) */}
                  <View style={styles.photoActionRow}>
                    <TouchableOpacity
                      style={[styles.photoActionBtn, { flex: 1 }]}
                      onPress={handleOpenCamera}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={15} color="#0284c7" style={{ marginRight: 6 }} />
                      <Text style={styles.photoActionBtnText}>Take Live Photo (Camera Only)</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Reference Guide Image */}
                  <View style={styles.referenceSection}>
                    <View style={styles.referenceImageBox}>
                      <Image
                        source={ODOMETER_SAMPLE}
                        style={styles.referenceImage}
                        resizeMode="cover"
                      />
                      <View style={styles.referenceOverlayBadge}>
                        <Text style={styles.referenceOverlayBadgeText}>{t('start_odometer.sample_reference', 'SAMPLE REFERENCE')}</Text>
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
                        placeholder={t('start_odometer.km_placeholder', 'Enter starting km (e.g. 42850 KM)')}
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

                    {/* Manual Entry Required Note */}
                    <View style={styles.manualEntryRow}>
                      <Ionicons name="information-circle-outline" size={14} color="#64748b" style={{ marginRight: 5 }} />
                      <Text style={styles.manualEntryText}>
                        {t('start_odometer.manual_reading_hint', 'Enter starting reading manually in KM. Odometer reading is mandatory.')}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Bar: Action to proceed to Odometer or OTP */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              isStepReady ? styles.primaryBtnReady : null,
            ]}
            onPress={() => {
              if (currentStep === 'selfie') {
                if (!driverSelfieUri) {
                  handleOpenSelfieCamera();
                } else {
                  setCurrentStep('odometer');
                }
              } else {
                if (!odometerImageUri) {
                  handlePhotoAction();
                } else {
                  handleProceedToOtp();
                }
              }
            }}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>
              {currentStep === 'selfie'
                ? !driverSelfieUri
                  ? t('start_odometer.btn_capture_selfie', 'Capture Driver Cabin Selfie')
                  : t('start_odometer.btn_proceed_to_odometer', 'PROCEED TO ODOMETER →')
                : !odometerImageUri
                ? t('start_odometer.btn_capture_odometer', 'Capture Starting Odometer Photo')
                : !startingOdometer.trim()
                ? t('start_odometer.btn_enter_reading', 'Enter Starting Odometer Reading')
                : t('start_odometer.btn_continue_to_otp', 'CONTINUE TO CUSTOMER OTP →')}
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
  sectionDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 22,
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
  manualEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  manualEntryText: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '500',
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
  selfieSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 14,
  },
  selfieSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selfieSummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803d',
  },
  selfieSummarySubtitle: {
    fontSize: 11,
    color: '#16a34a',
    marginTop: 1,
  },
  retakeSelfieBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  retakeSelfieBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#2563eb',
  },
  primaryBtn: {
    backgroundColor: '#059669',
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnReady: {
    backgroundColor: '#059669',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  photoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 6,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  photoActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  sampleTestBar: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 6,
    marginBottom: 8,
  },
  sampleTestTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065f46',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  samplePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  samplePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  samplePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
});

