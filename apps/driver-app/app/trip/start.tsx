import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StatusBar,
  Image,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { locationTracker } from '../../lib/location-tracker';
import { reverseGeocodeAddress } from '../../lib/reverse-geocoding';
import { driverApiClient } from '../../lib/api';
import {
  setTripInProcess,
  getVerifiedPickupOtp,
  setVerifiedPickupOtp,
  clearVerifiedPickupOtp,
  getVerifiedSelfie,
  setVerifiedSelfie,
  clearVerifiedSelfie,
  setTripStartDraft,
  getTripStartDraft,
  clearTripStartDraft,
} from '../../lib/tripState';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '../../components/SafeLinearGradient';
import { useTranslation } from 'react-i18next';

const ODOMETER_SAMPLE = require('../../assets/images/inspection/odometer_sample.jpg');
const DRIVER_SELFIE_SAMPLE = require('../../assets/images/driver-selfie-reference.jpg');

export default function DriverTripStartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<any>(null);
  const [pickupOtp, setPickupOtp] = useState('');
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [startingOdometer, setStartingOdometer] = useState('');
  const [odometerPhotoAttached, setOdometerPhotoAttached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [overrideRequesting, setOverrideRequesting] = useState(false);
  const [overrideRequested, setOverrideRequested] = useState(false);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [photoLocation, setPhotoLocation] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResultText, setOcrResultText] = useState<{ status: 'success' | 'failed' | 'idle'; reading?: number; message?: string }>({ status: 'idle' });

  // Subscribe to live GPS coordinates and ensure active trip tracking is running
  useEffect(() => {
    if (bookingId) {
      locationTracker.startActiveTripTracking(bookingId);
    }
    const unsub = locationTracker.addListener((lat, lng) => {
      if (lat != null && lng != null) {
        setCurrentCoords({ lat, lng });
      }
    });
    return () => unsub();
  }, [bookingId]);

  // Restore previously verified OTP, selfie, odometer, and photos if driver navigated away and came back
  useEffect(() => {
    if (!bookingId) return;
    const draft = getTripStartDraft(bookingId);
    if (draft) {
      if (draft.startingOdometer) {
        setStartingOdometer(draft.startingOdometer);
      }
      if (draft.odometerImageUri) {
        setOdometerImageUri(draft.odometerImageUri);
        setOdometerPhotoAttached(true);
      }
      if (draft.photoLocation) {
        setPhotoLocation(draft.photoLocation);
      }
      if (draft.ocrResultText) {
        setOcrResultText(draft.ocrResultText);
      }
      if (draft.pickupOtp) {
        setPickupOtp(draft.pickupOtp);
      }
      if (draft.inspectionPhotos) {
        setInspectionPhotos(draft.inspectionPhotos);
      }
    }

    getVerifiedPickupOtp(bookingId).then((savedOtp) => {
      if (savedOtp) {
        setPickupOtp(savedOtp);
        setIsOtpVerified(true);
      }
    });
    getVerifiedSelfie(bookingId).then((savedSelfie) => {
      if (savedSelfie && savedSelfie.uri) {
        setDriverSelfieUri(savedSelfie.uri);
        if (savedSelfie.location) {
          setSelfieLocation(savedSelfie.location);
        }
        setVerificationStep('odometer');
      }
    });
  }, [bookingId]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await driverApiClient.fetch('/api/driver/status');
      if (res.success && res.activeBooking) {
        setBooking(res.activeBooking);
        if (res.activeBooking.status === 'TRIP_STARTED') {
          setIsAdminAuthorized(true);
        }
        if (res.activeBooking.isOtpVerified) {
          setIsOtpVerified(true);
          if (res.activeBooking.verifiedPickupOtp) {
            setPickupOtp(res.activeBooking.verifiedPickupOtp);
            if (bookingId) {
              setVerifiedPickupOtp(bookingId, res.activeBooking.verifiedPickupOtp);
            }
          }
        }
        if (Array.isArray(res.activeBooking.vehicleInspectionPhotos) && res.activeBooking.vehicleInspectionPhotos.length > 0) {
          setInspectionPhotos([
            res.activeBooking.vehicleInspectionPhotos[0] || null,
            res.activeBooking.vehicleInspectionPhotos[1] || null,
            res.activeBooking.vehicleInspectionPhotos[2] || null,
            res.activeBooking.vehicleInspectionPhotos[3] || null,
          ]);
        }
      }
    } catch (_) {
      // Ignore polling errors
    }
  }, [bookingId]);

  useEffect(() => {
    checkStatus();
    // 12-second status check (avoids overwhelming connection queue)
    const interval = setInterval(() => {
      if (!isAdminAuthorized || !isOtpVerified) {
        checkStatus();
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [checkStatus, isAdminAuthorized, isOtpVerified]);

  const [odometerImageUri, setOdometerImageUri] = useState<string | null>(null);
  const [driverSelfieUri, setDriverSelfieUri] = useState<string | null>(null);
  const [selfieLocation, setSelfieLocation] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const [verificationStep, setVerificationStep] = useState<'selfie' | 'odometer'>('selfie');

  // 4 Core Vehicle Inspection Angles: [Front, Back/Rear, Side, Inside]
  const inspectionAngles = [
    { id: 0, title: 'Front Photo', desc: 'Front bumper & plate visible', icon: 'car-outline' as const },
    { id: 1, title: 'Back / Rear Photo', desc: 'Rear bumper, tail lights & boot', icon: 'car-sport-outline' as const },
    { id: 2, title: 'Side Photo', desc: 'Full side profile & door panels', icon: 'browsers-outline' as const },
    { id: 3, title: 'Inside Photo', desc: 'Clean interior & dashboard', icon: 'speedometer-outline' as const },
  ];
  const [inspectionPhotos, setInspectionPhotos] = useState<(string | null)[]>([null, null, null, null]);

  const handlePickInspectionPhoto = async (index: number, mode: 'camera' | 'library') => {
    try {
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.3,
        base64: true,
        allowsEditing: false,
      };
      let result;
      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera access is required to capture vehicle photo.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(pickerOptions);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Photo library access is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setInspectionPhotos((prev) => {
          const next = [...prev];
          next[index] = dataUri;
          if (bookingId) {
            setTripStartDraft(bookingId, { inspectionPhotos: next });
          }
          return next;
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to capture vehicle photo');
    }
  };

  const handleInspectionOptions = (index: number) => {
    const title = inspectionAngles[index].title;
    Alert.alert(
      `Capture ${title}`,
      'Choose source for vehicle inspection photo:',
      [
        { text: '📷 Take Photo with Camera', onPress: () => handlePickInspectionPhoto(index, 'camera') },
        { text: '🖼️ Choose from Gallery', onPress: () => handlePickInspectionPhoto(index, 'library') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleFillDemoInspectionPhotos = () => {
    setInspectionPhotos([
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80', // Front
      'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&auto=format&fit=crop&q=80', // Rear
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&fit=crop&q=80', // Side
      'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&auto=format&fit=crop&q=80', // Inside
    ]);
  };


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
      console.warn('Odometer OCR error:', err);
      setOcrResultText({
        status: 'failed',
        message: 'Could not auto-read. Please enter reading manually.',
      });
    } finally {
      setOcrScanning(false);
    }
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
        setOdometerPhotoAttached(true);
        runOdometerOcr(dataUri);
        // Lock location at the exact moment of photo capture
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

  const handleOpenSelfieCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to capture driver selfie.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.35,
        base64: true,
        cameraType: ImagePicker.CameraType.front,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setDriverSelfieUri(dataUri);
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
        setVerificationStep('odometer');
        if (bookingId) {
          setVerifiedSelfie(bookingId, dataUri, locStamp);
        }
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err.message || 'Failed to open front camera');
    }
  };

  const handleVerifyOtp = async () => {
    if (pickupOtp.length < 4) {
      setError('Please enter all 4 digits of customer pickup OTP.');
      Alert.alert('Incomplete OTP', 'Please enter all 4 digits of customer pickup OTP.');
      return;
    }
    setError('');
    setIsVerifyingOtp(true);
    try {
      const res = await driverApiClient.fetch('/api/driver/trip/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          pickupOtp: pickupOtp.trim(),
        }),
      });
      if (res.success && res.verified) {
        setIsOtpVerified(true);
        if (bookingId) {
          await setVerifiedPickupOtp(bookingId, pickupOtp.trim());
        }
        Keyboard.dismiss();
        Alert.alert('OTP Verified', 'Customer pickup OTP verified successfully!');
      } else {
        setIsOtpVerified(false);
        setError(res.message || 'Incorrect pickup OTP. Please verify with customer.');
        Alert.alert('Invalid OTP', res.message || 'The OTP entered is incorrect. Please recheck with customer.');
      }
    } catch (err: any) {
      setIsOtpVerified(false);
      setError(err.message || 'Failed to verify OTP. Please try again.');
      Alert.alert('Verification Error', err.message || 'Failed to verify OTP');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleStartTrip = async () => {
    if (!isAdminAuthorized && pickupOtp.length < 4) {
      setError('Please enter the 4-digit pickup OTP from the customer');
      return;
    }
    if (!isAdminAuthorized && !isOtpVerified) {
      // Auto verify OTP before starting trip if driver didn't click verify button yet
      try {
        const vRes = await driverApiClient.fetch('/api/driver/trip/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ bookingId, pickupOtp: pickupOtp.trim() }),
        });
        if (!vRes.success || !vRes.verified) {
          setError(vRes.message || 'Incorrect pickup OTP. Please verify with customer.');
          Alert.alert('Invalid OTP', vRes.message || 'The OTP entered is incorrect. Please recheck with customer.');
          return;
        }
        setIsOtpVerified(true);
      } catch (err: any) {
        setError(err.message || 'Failed to verify OTP');
        return;
      }
    }
    if (!startingOdometer) {
      setError('Please enter the starting odometer reading');
      return;
    }
    if (!odometerImageUri) {
      setError('Starting odometer photo is mandatory. Please capture photo of the odometer.');
      Alert.alert(
        'Odometer Photo Required',
        'You must capture a clear photo of the vehicle starting odometer before starting the trip.',
        [
          { text: '📷 Capture Odometer Photo', onPress: handleOpenCamera },
          { text: 'OK' },
        ]
      );
      return;
    }
    if (!driverSelfieUri) {
      setError('Driver selfie is mandatory. Please take a selfie before starting the trip.');
      Alert.alert(
        'Driver Selfie Required',
        'Please capture a clear front-camera selfie of yourself before starting the trip.',
        [
          { text: '📷 Take Driver Selfie', onPress: handleOpenSelfieCamera },
          { text: 'OK' },
        ]
      );
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Capture exact driver GPS location at OTP verification moment
      const latestCoords = locationTracker.getCurrentCoordinates();
      const actualLat = latestCoords.lat ?? currentCoords?.lat ?? photoLocation?.lat ?? booking?.pickupLat;
      const actualLng = latestCoords.lng ?? currentCoords?.lng ?? photoLocation?.lng ?? booking?.pickupLng;
      const actualAddress = await reverseGeocodeAddress(
        actualLat,
        actualLng,
        booking?.pickupAddress
      );

      const res = await driverApiClient.fetch('/api/driver/trip/start', {
        method: 'POST',
        timeoutMs: 35000,
        body: JSON.stringify({
          bookingId,
          pickupOtp: isAdminAuthorized ? 'OVERRIDE' : pickupOtp,
          startingOdometer: parseFloat(startingOdometer),
          startingOdometerImagePath: odometerImageUri,
          driverSelfie: driverSelfieUri,
          vehicleInspectionPhotos: inspectionPhotos.filter(Boolean),
          actualPickupLat: actualLat,
          actualPickupLng: actualLng,
          actualPickupAddress: actualAddress,
        }),
      } as any);

      if (res.success) {
        // Start background GPS tracking immediately
        if (bookingId) {
          await setTripInProcess(bookingId, true);
          await clearVerifiedPickupOtp(bookingId);
          await clearVerifiedSelfie(bookingId);
          clearTripStartDraft(bookingId);
          locationTracker.startActiveTripTracking(bookingId);
        }
        router.replace({
          pathname: '/trip/active',
          params: { bookingId },
        });
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP and start trip');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = async () => {
    if (bookingId) {
      await setTripInProcess(bookingId, true);
      driverApiClient.fetch('/api/driver/trip/en-route', {
        method: 'POST',
        body: JSON.stringify({ bookingId }),
      }).catch(() => {});
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/dashboard');
    }
  };

  const handleNotReached = async () => {
    if (bookingId) {
      await setTripInProcess(bookingId, false);
      driverApiClient.fetch('/api/driver/trip/en-route', {
        method: 'POST',
        body: JSON.stringify({ bookingId, action: 'NOT_REACHED' }),
      }).catch(() => {});
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/dashboard');
    }
  };

  const handleRequestAdminOverride = async () => {
    setOverrideRequesting(true);
    try {
      const res = await driverApiClient.fetch('/api/driver/trip/request-override', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          note: 'Customer phone is unreachable / dead battery. Verbal ID checked.',
        }),
      });

      setOverrideRequested(true);
      Alert.alert(
        'Override Requested',
        'Admin dispatch has been notified to manually authorize trip start. Once approved, you can start the trip immediately.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to request override');
    } finally {
      setOverrideRequesting(false);
    }
  };

  const openPickupNavigation = () => {
    if (!booking) return;
    const hasCoords =
      typeof booking.pickupLat === 'number' &&
      typeof booking.pickupLng === 'number' &&
      !isNaN(booking.pickupLat) &&
      !isNaN(booking.pickupLng);

    const targetQuery = hasCoords
      ? `${booking.pickupLat},${booking.pickupLng}`
      : encodeURIComponent(booking.pickupAddress || '');

    if (!targetQuery) {
      Alert.alert('Location Notice', 'Pickup address or coordinates are not available.');
      return;
    }

    const androidNavUrl = `google.navigation:q=${targetQuery}&mode=d`;
    const universalFallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetQuery}&travelmode=driving`;
    const iosUrl = `maps:0,0?q=${targetQuery}`;

    if (Platform.OS === 'android') {
      Linking.openURL(androidNavUrl).catch(() => {
        Linking.openURL(universalFallbackUrl).catch(() => {});
      });
    } else if (Platform.OS === 'ios') {
      Linking.openURL(iosUrl).catch(() => {
        Linking.openURL(universalFallbackUrl).catch(() => {});
      });
    } else {
      Linking.openURL(universalFallbackUrl).catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* Top Header Bar */}
      <View style={[styles.topHeaderBar, { paddingTop: Platform.OS === 'android' ? 10 : topInset + 6 }]}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={handleGoBack}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
          </TouchableOpacity>

          <View style={styles.headerTextCol}>
            <View style={styles.headerStepBadgeRow}>
              <View style={styles.headerLiveDot} />
              <Text style={styles.headerLiveRadarText}>{t('trip_flow.start_verification')}</Text>
            </View>
            <Text style={styles.headerMainTitle}>{t('trip_flow.verify_inspection')}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerHomeBtn}
          onPress={handleNotReached}
          activeOpacity={0.8}
        >
          <Ionicons name="close-circle" size={14} color="#dc2626" />
          <Text style={styles.headerHomeText}>{t('trip_flow.not_reached')}</Text>
        </TouchableOpacity>
      </View>

      {/* Top Action Ribbon / Quick Nav */}
      <View style={styles.topActionRibbon}>
        <TouchableOpacity
          style={styles.ribbonHomeBtn}
          onPress={handleNotReached}
          activeOpacity={0.82}
        >
          <View style={styles.ribbonHomeGradient}>
            <View style={styles.ribbonRedHalo}>
              <LinearGradient
                colors={['#ff1722', '#c90410']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.ribbonRedCircle}
              >
                <Ionicons name="close" size={13} color="#ffffff" />
              </LinearGradient>
            </View>
            <Text style={styles.ribbonHomeText} numberOfLines={1}>{t('trip_flow.not_reached')}</Text>
            <View style={styles.ribbonRightGroup}>
              <View style={styles.ribbonDividerRed} />
              <Ionicons name="chevron-forward" size={14} color="#881337" />
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ribbonNavBtn}
          onPress={openPickupNavigation}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#10356c', '#082758', '#021a3f']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.ribbonNavGradient}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.ribbonNavBadge}
            >
              <Ionicons name="navigate" size={15} color="#ffffff" />
            </LinearGradient>
            <Text style={styles.ribbonNavText} numberOfLines={1}>{t('trip_flow.pickup_navigate')}</Text>
            <View style={styles.ribbonRightGroup}>
              <View style={styles.ribbonDividerNavy} />
              <Ionicons name="chevron-forward" size={14} color="#ffffff" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color="#f87171" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Passenger Information Card */}
        {booking && (
          <View style={styles.passengerCard}>
            <View style={styles.passengerHeaderTopRow}>
              <Ionicons name="information-circle-outline" size={14} color="#64748b" />
              <Text style={styles.passengerSubtitleTop}>{t('trip_flow.confirm_passenger_info')}</Text>
            </View>

            <View style={styles.passengerMainRow}>
              <View style={styles.passengerLeftContent}>
                <View style={styles.passengerAvatarSolid}>
                  <Ionicons name="person" size={20} color="#ffffff" />
                </View>
                <View style={styles.passengerInfoCol}>
                  <Text style={styles.passengerName} numberOfLines={1}>
                    {booking.customer?.user?.fullName || 'Customer'}
                  </Text>
                  <Text style={styles.passengerSubtitle}>{t('trip_flow.confirmed_passenger')}</Text>
                </View>
              </View>

              {booking.customerPhoneReleased && booking.customer?.user?.phone ? (
                <TouchableOpacity
                  style={styles.callNowBtnWhite}
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL(`tel:${booking.customer.user.phone}`)}
                >
                  <Ionicons name="call" size={15} color="#16a34a" />
                  <Text style={styles.callNowBtnText}>{t('trip_flow.call_now')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {!booking.customerPhoneReleased && (
              <View style={styles.phoneProtectedBox}>
                <Ionicons name="shield-checkmark" size={14} color="#64748b" />
                <Text style={styles.phoneProtectedText}>
                  {t('trip_flow.phone_locked_policy')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Admin Authorization Notice */}
        {isAdminAuthorized ? (
          <View style={styles.authorizedBox}>
            <View style={styles.authorizedHeader}>
              <Ionicons name="checkmark-circle" size={18} color="#34d399" />
              <Text style={styles.authorizedTitle}>{t('trip_flow.admin_auth_title')}</Text>
            </View>
            <Text style={styles.authorizedSubtitle}>
              {t('trip_flow.admin_auth_subtitle')}
            </Text>
          </View>
        ) : (
          /* 1. Customer OTP Entry */
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.otpHeaderBadge}>
                <Ionicons name="shield-checkmark" size={24} color="#ea580c" />
              </View>
              <View style={styles.otpHeaderDivider} />
              <View style={styles.cardHeaderTextCol}>
                <Text style={styles.cardHeaderTitle}>
                  {t('trip_flow.customer_pickup_otp')} <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <Text style={styles.cardHeaderSubtitle}>{t('trip_flow.enter_otp_shared')}</Text>
              </View>
            </View>

            {/* Visual 4-Digit Box Container */}
            <View style={styles.otpRowContainer}>
              <View style={styles.otpBoxesWrapper}>
                {[0, 1, 2, 3].map((idx) => {
                  const digit = pickupOtp[idx] || '';
                  const isFocused = pickupOtp.length === idx;
                  const isFilled = Boolean(digit);
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.otpBox,
                        isFocused && styles.otpBoxActive,
                        isFilled && styles.otpBoxFilled,
                      ]}
                    >
                      {isFocused && !digit && !isOtpVerified ? (
                        <View style={styles.otpCursor} />
                      ) : (
                        <Text style={styles.otpDigit}>
                          {digit}
                        </Text>
                      )}
                    </View>
                  );
                })}

                {/* Invisible Overlay Input to handle touch and keyboard only over the 4 boxes */}
                <TextInput
                  style={styles.hiddenOtpInput}
                  value={pickupOtp}
                  onChangeText={(val) => {
                    const clean = val.replace(/\D/g, '').slice(0, 4);
                    setPickupOtp(clean);
                    if (isOtpVerified) setIsOtpVerified(false);
                    setError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  caretHidden={true}
                  editable={!isOtpVerified}
                />
              </View>

              {/* Verify OTP Button matching reference design */}
              <TouchableOpacity
                style={[
                  styles.verifyOtpBtn,
                  isOtpVerified && styles.verifyOtpBtnVerified,
                ]}
                onPress={handleVerifyOtp}
                disabled={pickupOtp.length < 4 || isVerifyingOtp || isOtpVerified}
                activeOpacity={0.85}
              >
                {isVerifyingOtp ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : isOtpVerified ? (
                  <View style={styles.verifyOtpContentRow}>
                    <Ionicons name="checkmark-circle" size={17} color="#10b981" />
                    <Text style={styles.verifyOtpTextVerified}>{t('trip_flow.otp_verified')}</Text>
                  </View>
                ) : (
                  <View style={styles.verifyOtpContentRow}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color="#ffffff"
                    />
                    <Text style={styles.verifyOtpText}>
                      {t('trip_flow.verify_otp')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Admin Override / Info Banner matching reference */}
            <TouchableOpacity
              style={styles.overrideLinkBanner}
              onPress={handleRequestAdminOverride}
              disabled={overrideRequesting}
              activeOpacity={0.8}
            >
              <View style={styles.overrideBannerLeft}>
                <Ionicons name="information-circle-outline" size={17} color="#2563eb" />
                <View style={styles.overrideDividerBlue} />
                <Text style={styles.overrideLinkText} numberOfLines={1}>
                  {overrideRequesting
                    ? t('trip_flow.requesting_override')
                    : overrideRequested
                    ? t('trip_flow.override_requested')
                    : t('trip_flow.verify_before_starting')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#2563eb" />
            </TouchableOpacity>
          </View>
        )}

        {/* 2. Step 1: Driver Selfie Verification Card */}
        {verificationStep === 'selfie' && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardHeaderIconCircle, { backgroundColor: '#0284c7' }]}>
                <Ionicons name="person" size={16} color="#ffffff" />
              </View>
              <View style={styles.cardHeaderTextCol}>
                <Text style={styles.cardHeaderTitle}>{t('trip_flow.step1_title')} *</Text>
                <Text style={styles.cardHeaderSubtitle}>{t('trip_flow.step1_desc')}</Text>
              </View>
            </View>

            {/* Selfie Photo Preview Box */}
            <TouchableOpacity
              style={styles.selfiePhotoContainer}
              onPress={handleOpenSelfieCamera}
              activeOpacity={0.9}
            >
              <Image
                source={driverSelfieUri ? { uri: driverSelfieUri } : DRIVER_SELFIE_SAMPLE}
                style={styles.selfiePhotoImage}
                resizeMode="cover"
              />

              {driverSelfieUri ? (
                <>
                  <View style={styles.selfieVerifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#ffffff" />
                    <Text style={styles.selfieVerifiedBadgeText}>{t('trip_flow.selfie_verified')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.vehiclePhotoRetakeOverlay}
                    onPress={handleOpenSelfieCamera}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.vehiclePhotoRetakeText}>{t('trip_flow.retake')}</Text>
                  </TouchableOpacity>

                  {selfieLocation && (
                    <View style={styles.gpsWatermarkOverlay}>
                      <View style={styles.gpsWatermarkHeader}>
                        <View style={styles.gpsWatermarkDot} />
                        <Text style={styles.gpsWatermarkTitle}>📍 {t('trip_flow.gps_location_stamp')}</Text>
                      </View>
                      <Text style={styles.gpsWatermarkCoords}>
                        {`${selfieLocation.lat.toFixed(5)}° N, ${selfieLocation.lng.toFixed(5)}° E`}
                      </Text>
                      <Text style={styles.gpsWatermarkTime}>
                        ⏱️ {selfieLocation.time} • {t('trip_flow.verified_driver_identity')}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.vehiclePhotoRetakeOverlay}
                    onPress={handleOpenSelfieCamera}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.vehiclePhotoRetakeText}>{t('trip_flow.capture')}</Text>
                  </TouchableOpacity>

                  <View style={styles.sampleGuideOverlay}>
                    <Ionicons name="eye-outline" size={13} color="#ffffff" />
                    <Text style={styles.sampleGuideOverlayText}>{t('trip_flow.reference_guide')}</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            {driverSelfieUri ? (
              <TouchableOpacity
                style={styles.nextStepHintBtn}
                onPress={() => setVerificationStep('odometer')}
                activeOpacity={0.8}
              >
                <Text style={styles.nextStepHintText}>{t('trip_flow.proceed_to_odometer')}</Text>
                <Ionicons name="arrow-forward" size={14} color="#2563eb" />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* 3. Step 2: Starting Odometer Reading & Vehicle Photo */}
        {verificationStep === 'odometer' && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardHeaderIconCircle, { backgroundColor: '#6366f1' }]}>
                <Ionicons name="speedometer" size={16} color="#ffffff" />
              </View>
              <View style={styles.cardHeaderTextCol}>
                <Text style={styles.cardHeaderTitle}>{t('trip_flow.step2_title')} *</Text>
                <Text style={styles.cardHeaderSubtitle}>{t('trip_flow.step2_desc')}</Text>
              </View>
            </View>

            {/* Odometer Input with Speedometer Icon */}
            <View style={styles.odometerInputContainer}>
              <Ionicons name="speedometer-outline" size={20} color="#6366f1" style={styles.odometerIcon} />
              <TextInput
                style={styles.odometerTextInput}
                value={startingOdometer}
                onChangeText={(val) => {
                  setStartingOdometer(val);
                  if (bookingId) setTripStartDraft(bookingId, { startingOdometer: val });
                }}
                keyboardType="decimal-pad"
                placeholder={t('trip_flow.odometer_placeholder')}
                placeholderTextColor="#94a3b8"
              />
              <View style={styles.odometerKmBadge}>
                <Text style={styles.odometerKmText}>KM</Text>
              </View>
            </View>

            {/* Info Banner matching reference */}
            <View style={styles.odometerInfoNotice}>
              <Ionicons name="information-circle" size={16} color="#3b82f6" />
              <Text style={styles.odometerInfoNoticeText}>
                {t('trip_flow.odometer_photo_hint')}
              </Text>
            </View>

            {/* OCR Auto-Read Feedback Banner */}
            {ocrScanning ? (
              <View style={styles.ocrScanningBanner}>
                <ActivityIndicator size="small" color="#0284c7" />
                <Text style={styles.ocrScanningText}>⚡ {t('trip_flow.auto_reading_odometer')}</Text>
              </View>
            ) : ocrResultText.status === 'success' ? (
              <View style={styles.ocrSuccessBanner}>
                <Ionicons name="checkmark-circle" size={15} color="#16a34a" />
                <Text style={styles.ocrSuccessText}>
                  ✨ {ocrResultText.message || `Auto-detected ${ocrResultText.reading} KM`}
                </Text>
              </View>
            ) : ocrResultText.status === 'failed' ? (
              <View style={styles.ocrFailedBanner}>
                <Ionicons name="information-circle-outline" size={15} color="#d97706" />
                <Text style={styles.ocrFailedText}>
                  {ocrResultText.message || t('trip_flow.type_odometer_manually')}
                </Text>
              </View>
            ) : null}

            {/* Vehicle / Odometer Photo inside the same card */}
            <TouchableOpacity
              style={styles.vehiclePhotoContainer}
              onPress={handleOpenCamera}
              activeOpacity={0.9}
            >
              <Image
                source={odometerImageUri ? { uri: odometerImageUri } : ODOMETER_SAMPLE}
                style={styles.vehiclePhotoImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.vehiclePhotoRetakeOverlay}
                onPress={handleOpenCamera}
                activeOpacity={0.8}
              >
                <Text style={styles.vehiclePhotoRetakeText}>
                  {odometerImageUri ? t('trip_flow.retake') : t('trip_flow.capture')}
                </Text>
              </TouchableOpacity>

              {!odometerImageUri && (
                <View style={styles.sampleGuideOverlay}>
                  <Ionicons name="eye-outline" size={13} color="#ffffff" />
                  <Text style={styles.sampleGuideOverlayText}>{t('trip_flow.reference_guide')}</Text>
                </View>
              )}

              {/* GPS Watermark if photo captured */}
              {odometerImageUri && photoLocation && (
                <View style={styles.gpsWatermarkOverlay}>
                  <View style={styles.gpsWatermarkHeader}>
                    <View style={styles.gpsWatermarkDot} />
                    <Text style={styles.gpsWatermarkTitle}>📍 {t('trip_flow.gps_location_stamp')}</Text>
                  </View>
                  <Text style={styles.gpsWatermarkCoords}>
                    {`${photoLocation.lat.toFixed(5)}° N, ${photoLocation.lng.toFixed(5)}° E`}
                  </Text>
                  <Text style={styles.gpsWatermarkTime}>
                    ⏱️ {photoLocation.time} • {t('trip_flow.verified_evidence')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backStepHintBtn}
              onPress={() => setVerificationStep('selfie')}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={13} color="#64748b" />
              <Text style={styles.backStepHintText}>{t('trip_flow.back_to_selfie')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Pinned Bottom Action Bar matching reference design */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[
            styles.yellowPrimaryButton,
            Boolean(isOtpVerified && startingOdometer && odometerImageUri && driverSelfieUri && verificationStep === 'odometer') && styles.yellowPrimaryButtonReady,
            loading && styles.startButtonDisabled,
          ]}
          onPress={() => {
            if (!isAdminAuthorized && pickupOtp.length < 4) {
              setError('Please enter the 4-digit pickup OTP');
              return;
            }
            if (verificationStep === 'selfie') {
              if (!driverSelfieUri) {
                handleOpenSelfieCamera();
                return;
              }
              setVerificationStep('odometer');
              if (!odometerImageUri) {
                handleOpenCamera();
              }
              return;
            }

            // verificationStep === 'odometer'
            if (!odometerImageUri) {
              handleOpenCamera();
              return;
            }
            if (!startingOdometer) {
              setError('Please enter the starting odometer reading');
              return;
            }
            if (!driverSelfieUri) {
              setVerificationStep('selfie');
              return;
            }

            handleStartTrip();
          }}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#0f172a" size="small" />
          ) : (
            <>
              <Text style={styles.yellowPrimaryButtonText} numberOfLines={1}>
                {verificationStep === 'selfie'
                  ? !driverSelfieUri
                    ? t('trip_flow.take_selfie_btn')
                    : t('trip_flow.next_capture_odometer')
                  : !odometerImageUri
                  ? t('trip_flow.open_camera_odometer')
                  : t('trip_flow.start_trip_btn')}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#0f172a" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerDividerV: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 10,
  },
  headerTextCol: {
    flex: 1,
  },
  headerStepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  headerLiveRadarText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#16a34a',
    letterSpacing: 0.8,
  },
  headerMainTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 1,
    letterSpacing: -0.2,
  },
  headerHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  headerHomeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#dc2626',
  },
  topActionRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  ribbonHomeBtn: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  ribbonHomeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#fda4af',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  ribbonRedHalo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffd0d6',
    borderWidth: 1,
    borderColor: '#ffbec7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonRedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#b91c1c',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  },
  ribbonHomeText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#881337',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  ribbonNavBtn: {
    flex: 1,
    borderRadius: 999,
    shadowColor: '#07265c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 4,
  },
  ribbonNavGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  ribbonNavBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonNavText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.2,
    paddingHorizontal: 2,
  },
  ribbonRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 4,
  },
  ribbonDividerRed: {
    width: 1,
    height: 14,
    backgroundColor: '#fca5a5',
  },
  ribbonDividerNavy: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 6,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  passengerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  passengerHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  passengerSubtitleTop: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  passengerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  passengerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orangeAccentBar: {
    width: 3.5,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#ea580c',
    marginRight: 6,
  },
  passengerHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  releasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#86efac',
    gap: 4,
  },
  releasedBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#15803d',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
  },
  passengerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  passengerLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  passengerAvatarSolid: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0052cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerInfoCol: {
    flex: 1,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  passengerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '500',
  },
  callNowBtnWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  callNowBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  phoneProtectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  phoneProtectedText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  authorizedBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.2,
    borderColor: '#10b981',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  authorizedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  authorizedTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#047857',
  },
  authorizedSubtitle: {
    fontSize: 11,
    color: '#065f46',
    lineHeight: 15,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  otpHeaderBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 2,
  },
  otpHeaderDivider: {
    width: 1.5,
    height: 28,
    backgroundColor: '#d8dae6',
    marginHorizontal: 4,
  },
  requiredAsterisk: {
    color: '#ef4444',
    fontWeight: '800',
  },
  cardHeaderIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTextCol: {
    flex: 1,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  cardHeaderSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 0.5,
    fontWeight: '500',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  hint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 15,
  },
  otpRowContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  otpBoxesWrapper: {
    flexDirection: 'row',
    gap: 7,
    flex: 1,
  },
  otpBox: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: '#0c2253',
    borderWidth: 2,
    backgroundColor: '#ffffff',
  },
  otpBoxFilled: {
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  otpCursor: {
    width: 2,
    height: 24,
    backgroundColor: '#2563eb',
    borderRadius: 1,
  },
  otpDigit: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  otpBoxVerified: {
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  otpDigitVerified: {
    color: '#0f172a',
  },
  verifyOtpBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#0c2253',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    elevation: 3,
    shadowColor: '#0c2253',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  verifyOtpBtnActive: {
    backgroundColor: '#0c2253',
    borderColor: '#0c2253',
  },
  verifyOtpBtnVerified: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.2,
    borderColor: '#a7f3d0',
    shadowColor: '#10b981',
    shadowOpacity: 0.15,
  },
  verifyOtpContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifyOtpText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  verifyOtpTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  verifyOtpTextVerified: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10b981',
  },
  hiddenOtpInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  overrideLinkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  overrideBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  overrideDividerBlue: {
    width: 1.5,
    height: 16,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
  },
  overrideLinkText: {
    color: '#1e3a8a',
    fontSize: 12.5,
    fontWeight: '700',
    flex: 1,
  },
  ocrScanningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
  },
  ocrScanningText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  ocrSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
  },
  ocrSuccessText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803d',
  },
  ocrFailedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
  },
  ocrFailedText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#b45309',
  },
  odometerInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 7,
  },
  odometerIcon: {
    marginRight: 8,
  },
  odometerTextInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  odometerKmBadge: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  odometerKmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748b',
  },
  odometerInfoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 7,
  },
  odometerInfoNoticeText: {
    fontSize: 11.5,
    color: '#1d4ed8',
    fontWeight: '600',
    flex: 1,
  },
  vehiclePhotoContainer: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vehiclePhotoImage: {
    width: '100%',
    height: '100%',
  },
  vehiclePhotoRetakeOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    zIndex: 10,
  },
  vehiclePhotoRetakeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  odometerSampleContainer: {
    width: '100%',
    gap: 8,
  },
  sampleGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 4,
  },
  sampleGuideHeaderText: {
    fontSize: 11,
    color: '#0369a1',
    fontWeight: '700',
    flex: 1,
  },
  odometerSampleImageBox: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  odometerSampleImage: {
    width: '100%',
    height: '100%',
    opacity: 0.95,
  },
  sampleBadgeOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sampleBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  cameraPrimaryBtn: {
    backgroundColor: '#142232',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 6,
    shadowColor: '#142232',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cameraPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  preCaptureGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
  },
  gpsLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  preCaptureGpsText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  previewContainer: {
    alignItems: 'center',
    marginVertical: 4,
    width: '100%',
  },
  imageWrapper: {
    width: '100%',
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: '#059669',
  },
  odometerPreviewImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#f1f5f9',
  },
  gpsWatermarkOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.4)',
  },
  gpsWatermarkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 1,
  },
  gpsWatermarkDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  gpsWatermarkTitle: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  gpsWatermarkCoords: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  gpsWatermarkTime: {
    fontSize: 8.5,
    color: '#cbd5e1',
    marginTop: 1,
  },
  photoLocationCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    marginTop: 6,
    gap: 3,
  },
  photoLocationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoLocationLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  photoLocationVal: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  retakeBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 5,
  },
  retakeBtnText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
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
  yellowPrimaryButtonReady: {
    backgroundColor: '#fbbf24',
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
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
    flex: 1,
  },
  sectionSubTitle: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1,
  },
  demoFillMiniBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  demoFillMiniBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },
  inspectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  inspectionCard: {
    width: '48.5%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
  },
  inspectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  inspectionCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 4,
  },
  inspectionCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  inspectionCardDesc: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 6,
  },
  inspectionBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  badgeGreen: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  badgeAmber: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  badgeTextGreen: {
    color: '#059669',
    fontSize: 8.5,
    fontWeight: '800',
  },
  badgeTextAmber: {
    color: '#d97706',
    fontSize: 8.5,
    fontWeight: '800',
  },
  inspectionPreviewWrapper: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  inspectionThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e2e8f0',
  },
  inspectionRetakeBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  inspectionRetakeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  inspectionPlaceholder: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  inspectionCameraCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectionPlaceholderText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  startButton: {
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  startButtonReady: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOpacity: 0.35,
  },
  startButtonLocked: {
    backgroundColor: '#142232',
    shadowColor: '#142232',
    shadowOpacity: 0.25,
  },
  startButtonDisabled: {
    opacity: 0.6,
  },
  ctaIconCircleWhite: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIconCircleOrange: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIconCircleAmber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
    flex: 1,
  },
  selfiePhotoContainer: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
    marginTop: 10,
  },
  selfiePhotoImage: {
    width: '100%',
    height: '100%',
  },
  selfieVerifiedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.95)',
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  selfieVerifiedBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  selfiePlaceholder: {
    flex: 1,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  selfieCameraCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  selfiePlaceholderTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  selfiePlaceholderSub: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
  },
  nextStepHintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  nextStepHintText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  backStepHintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  backStepHintText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  sampleGuideOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
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
});

