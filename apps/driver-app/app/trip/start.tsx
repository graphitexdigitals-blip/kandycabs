import React, { useState, useEffect, useCallback, useRef } from 'react';
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
const FRONT_SAMPLE = require('../../assets/images/inspection/front.jpg');
const REAR_SAMPLE = require('../../assets/images/inspection/rear.jpg');
const SIDE_SAMPLE = require('../../assets/images/inspection/side.jpg');
const INSIDE_SAMPLE = require('../../assets/images/inspection/inside.jpg');

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
      if (draft.odometerImageUri && !draft.odometerImageUri.includes('images.unsplash.com')) {
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
        setInspectionPhotos(
          draft.inspectionPhotos.map((p) => (p && p.includes('images.unsplash.com') ? 'demo_photo' : p))
        );
      }
    }

    getVerifiedPickupOtp(bookingId).then((savedOtp) => {
      if (savedOtp) {
        setPickupOtp(savedOtp);
        setIsOtpVerified(true);
      }
    });
    getVerifiedSelfie(bookingId).then((savedSelfie) => {
      if (savedSelfie && savedSelfie.uri && !savedSelfie.uri.includes('images.unsplash.com')) {
        setDriverSelfieUri(savedSelfie.uri);
        if (savedSelfie.location) {
          setSelfieLocation(savedSelfie.location);
        }
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
  const [activeAttachmentIdx, setActiveAttachmentIdx] = useState<number>(0);
  const [currentVerificationStep, setCurrentVerificationStep] = useState<1 | 2>(1);
  const scrollViewRef = useRef<ScrollView>(null);

  // Automatically cleanse any external unsplash demo images so original local reference samples are restored
  useEffect(() => {
    if (driverSelfieUri && driverSelfieUri.includes('images.unsplash.com')) {
      setDriverSelfieUri('demo_selfie');
    }
    if (odometerImageUri && odometerImageUri.includes('images.unsplash.com')) {
      setOdometerImageUri('demo_odometer');
    }
  }, [driverSelfieUri, odometerImageUri]);

  // 6 Core Mandatory Trip Attachments: [Front, Rear, Side, Inside, Selfie, Odometer]
  const verificationAttachments = [
    {
      id: 'front',
      title: 'Vehicle Front Angle',
      shortTitle: 'Front Angle',
      tag: '1. FRONT',
      desc: 'Front bumper & number plate clearly visible',
      icon: 'car-outline' as const,
      sampleSource: FRONT_SAMPLE,
      type: 'inspection' as const,
      index: 0,
    },
    {
      id: 'rear',
      title: 'Vehicle Rear / Back Angle',
      shortTitle: 'Rear Angle',
      tag: '2. REAR',
      desc: 'Rear bumper, tail lights & boot clearly visible',
      icon: 'car-sport-outline' as const,
      sampleSource: REAR_SAMPLE,
      type: 'inspection' as const,
      index: 1,
    },
    {
      id: 'side',
      title: 'Vehicle Side Profile',
      shortTitle: 'Side Profile',
      tag: '3. SIDE',
      desc: 'Full side profile & passenger doors clearly visible',
      icon: 'browsers-outline' as const,
      sampleSource: SIDE_SAMPLE,
      type: 'inspection' as const,
      index: 2,
    },
    {
      id: 'inside',
      title: 'Vehicle Inside Cabin',
      shortTitle: 'Inside Cabin',
      tag: '4. INSIDE',
      desc: 'Clean interior, passenger seats & floor mats',
      icon: 'people-outline' as const,
      sampleSource: INSIDE_SAMPLE,
      type: 'inspection' as const,
      index: 3,
    },
    {
      id: 'selfie',
      title: 'Driver Cabin Selfie',
      shortTitle: 'Driver Selfie',
      tag: '5. SELFIE',
      desc: 'Clear face selfie captured from driving seat',
      icon: 'person-outline' as const,
      sampleSource: DRIVER_SELFIE_SAMPLE,
      type: 'selfie' as const,
    },
    {
      id: 'odometer',
      title: 'Starting Odometer Reading',
      shortTitle: 'Odometer',
      tag: '6. ODOMETER',
      desc: 'Clear photo of starting dashboard km gauge',
      icon: 'speedometer-outline' as const,
      sampleSource: ODOMETER_SAMPLE,
      type: 'odometer' as const,
    },
  ];

  const [inspectionPhotos, setInspectionPhotos] = useState<(string | null)[]>([null, null, null, null]);

  const isAttachmentCompleted = (idx: number) => {
    if (idx < 4) return Boolean(inspectionPhotos[idx]);
    if (idx === 4) return Boolean(driverSelfieUri);
    if (idx === 5) return Boolean(odometerImageUri && startingOdometer);
    return false;
  };

  const getAttachmentPhotoUri = (idx: number) => {
    let uri: string | null = null;
    if (idx < 4) uri = inspectionPhotos[idx];
    else if (idx === 4) uri = driverSelfieUri;
    else if (idx === 5) uri = odometerImageUri;
    if (typeof uri === 'string' && uri.includes('images.unsplash.com')) {
      return null;
    }
    return uri;
  };

  const totalAttachedCount =
    inspectionPhotos.filter(Boolean).length +
    (driverSelfieUri ? 1 : 0) +
    (odometerImageUri && startingOdometer ? 1 : 0);

  const vehicleAttachedCount = inspectionPhotos.filter(Boolean).length;
  const isVehicleEvidenceDone = vehicleAttachedCount === 4;
  const step2AttachedCount =
    (driverSelfieUri ? 1 : 0) +
    (odometerImageUri && startingOdometer ? 1 : 0);
  const isStep2Done = Boolean(
    driverSelfieUri && odometerImageUri && startingOdometer
  );

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

        // Automatically slide to next attachment
        if (currentVerificationStep === 1) {
          if (index < 3) {
            setActiveAttachmentIdx(index + 1);
          }
        } else if (index < 5) {
          setActiveAttachmentIdx(index + 1);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to capture vehicle photo');
    }
  };

  const handleInspectionOptions = (index: number) => {
    const title = verificationAttachments[index]?.title || 'Vehicle Photo';
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
    if (currentVerificationStep === 1) {
      setInspectionPhotos([
        'demo_front',
        'demo_rear',
        'demo_side',
        'demo_inside',
      ]);
      setActiveAttachmentIdx(0);
      Alert.alert(
        '⚡ Demo Vehicle Evidence Loaded',
        'All 4 vehicle angles loaded! Click "PROCEED TO STEP 2" below to enter Customer OTP & Odometer.'
      );
    } else {
      setDriverSelfieUri('demo_selfie');
      setOdometerImageUri('demo_odometer');
      setStartingOdometer('42850');
      setActiveAttachmentIdx(4);
      Alert.alert(
        '⚡ Demo Step 2 Evidence Loaded',
        'Driver selfie & starting odometer reading loaded!'
      );
    }
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
        setActiveAttachmentIdx(5);
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
    if (overrideRequested) {
      Alert.alert(
        'Cancel Admin Request',
        'Would you like to cancel the pending admin verification request and enter OTP instead?',
        [
          { text: 'Keep Waiting', style: 'cancel' },
          {
            text: 'Undo / Cancel Request',
            style: 'destructive',
            onPress: () => {
              setOverrideRequested(false);
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Customer OTP Help',
      'If the customer cannot receive their OTP (dead battery, phone off, or network issue), dispatch admin can verify and authorize this ride.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Admin Help',
          onPress: async () => {
            setOverrideRequesting(true);
            try {
              await driverApiClient.fetch('/api/driver/trip/request-override', {
                method: 'POST',
                body: JSON.stringify({
                  bookingId,
                  note: 'Customer phone is unreachable / dead battery. Verbal ID checked.',
                }),
              });

              setOverrideRequested(true);
              Alert.alert(
                'Admin Help Requested',
                'Admin dispatch has been notified. You can wait for approval or tap again to cancel if customer finds their OTP.'
              );
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to request override');
            } finally {
              setOverrideRequesting(false);
            }
          },
        },
      ]
    );
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
              <Text style={styles.headerLiveRadarText}>
                {currentVerificationStep === 1
                  ? '• STEP 1: VEHICLE EVIDENCE'
                  : '• STEP 2: PASSENGER OTP & METER'}
              </Text>
            </View>
            <Text style={styles.headerMainTitle}>
              {currentVerificationStep === 1
                ? 'Vehicle Evidence Inspection'
                : t('trip_flow.verify_inspection')}
            </Text>
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

      {/* 2-Step Verification Stepper Tab Bar */}
      <View style={styles.twoStepTabBar}>
        <TouchableOpacity
          style={[
            styles.stepTabItem,
            currentVerificationStep === 1 && styles.stepTabItemActive,
          ]}
          onPress={() => {
            setCurrentVerificationStep(1);
            if (activeAttachmentIdx >= 4) setActiveAttachmentIdx(0);
          }}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.stepTabBadge,
              isVehicleEvidenceDone
                ? styles.stepTabBadgeDone
                : currentVerificationStep === 1
                ? styles.stepTabBadgeActive
                : styles.stepTabBadgeInactive,
            ]}
          >
            {isVehicleEvidenceDone ? (
              <Ionicons name="checkmark" size={13} color="#ffffff" />
            ) : (
              <Text style={styles.stepTabBadgeNum}>1</Text>
            )}
          </View>
          <View style={styles.stepTabTextCol}>
            <Text
              style={[
                styles.stepTabMainText,
                currentVerificationStep === 1 && styles.stepTabMainTextActive,
              ]}
              numberOfLines={1}
            >
              1. Vehicle Evidence
            </Text>
            <Text style={styles.stepTabSubText}>
              {vehicleAttachedCount}/4 Photos {isVehicleEvidenceDone ? '✓' : ''}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.stepTabDivider} />

        <TouchableOpacity
          style={[
            styles.stepTabItem,
            currentVerificationStep === 2 && styles.stepTabItemActive,
            !isVehicleEvidenceDone && styles.stepTabItemDisabled,
          ]}
          onPress={() => {
            if (!isVehicleEvidenceDone) {
              Alert.alert(
                'Complete Vehicle Evidence First',
                'Please capture all 4 vehicle photos (Front, Rear, Side, Inside) before proceeding to Passenger OTP, Selfie and Odometer verification.'
              );
              return;
            }
            setCurrentVerificationStep(2);
            if (activeAttachmentIdx < 4) setActiveAttachmentIdx(4);
          }}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.stepTabBadge,
              isStep2Done && isOtpVerified
                ? styles.stepTabBadgeDone
                : currentVerificationStep === 2
                ? styles.stepTabBadgeActive
                : styles.stepTabBadgeInactive,
            ]}
          >
            {isStep2Done && isOtpVerified ? (
              <Ionicons name="checkmark" size={13} color="#ffffff" />
            ) : (
              <Text style={styles.stepTabBadgeNum}>2</Text>
            )}
          </View>
          <View style={styles.stepTabTextCol}>
            <Text
              style={[
                styles.stepTabMainText,
                currentVerificationStep === 2 && styles.stepTabMainTextActive,
              ]}
              numberOfLines={1}
            >
              2. OTP, Selfie & Meter
            </Text>
            <Text style={styles.stepTabSubText}>
              {isOtpVerified ? 'OTP Verified ✓' : 'OTP & Meter'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
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

        {/* STEP 1: VEHICLE EVIDENCE ONLY (No OTP, Selfie, or Odometer) */}
        {currentVerificationStep === 1 && (
          <>
            <View style={styles.step1Banner}>
              <View style={styles.step1BannerHeader}>
                <View style={styles.step1BannerIconBox}>
                  <Ionicons name="camera" size={18} color="#0284c7" />
                </View>
                <View style={styles.step1BannerTextCol}>
                  <Text style={styles.step1BannerTitle}>Step 1: Vehicle Evidence (4 Angles)</Text>
                  <Text style={styles.step1BannerDesc}>
                    Mandatory 4 vehicle angles required before passenger pickup. Customer OTP, driver selfie & odometer unlock in Step 2.
                  </Text>
                </View>
              </View>
            </View>

            {/* Step 1 Unified Verification Card */}
            {(() => {
              const vehicleItems = verificationAttachments.slice(0, 4);
              const safeIdx = activeAttachmentIdx >= 0 && activeAttachmentIdx < 4 ? activeAttachmentIdx : 0;
              const activeItem = vehicleItems[safeIdx] || vehicleItems[0];
              const isCurrentAttached = isAttachmentCompleted(safeIdx);
              const currentPhotoUri = getAttachmentPhotoUri(safeIdx);

              return (
                <View style={styles.card}>
                  {/* Card Header Row */}
                  <View style={styles.cardHeaderRowBetween}>
                    <View style={styles.cardHeaderLeftGroup}>
                      <View style={[styles.cardHeaderIconCircle, { backgroundColor: '#0284c7' }]}>
                        <Ionicons name="car-sport" size={16} color="#ffffff" />
                      </View>
                      <View style={styles.cardHeaderTextCol}>
                        <Text style={styles.cardHeaderTitle}>Vehicle Evidence Photos *</Text>
                        <Text style={styles.cardHeaderSubtitle}>
                          {vehicleAttachedCount} of 4 mandatory vehicle photos completed
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.demoFillMiniBtn}
                      onPress={handleFillDemoInspectionPhotos}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="flash" size={11} color="#ea580c" />
                      <Text style={styles.demoFillMiniBtnText}>Demo</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Progress Bar Track */}
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.round((vehicleAttachedCount / 4) * 100)}%` },
                        isVehicleEvidenceDone && styles.progressBarFillComplete,
                      ]}
                    />
                  </View>

                  {/* Active Viewfinder (Top Focused View) */}
                  <View style={styles.focusedViewfinderWrapper}>
                    <View style={styles.viewfinderHeaderRow}>
                      <View style={styles.viewfinderStepTag}>
                        <Text style={styles.viewfinderStepTagText}>
                          {activeItem.shortTitle.toUpperCase()} ({safeIdx + 1}/4)
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.viewfinderStatusPill,
                          isCurrentAttached ? styles.pillGreen : styles.pillAmber,
                        ]}
                      >
                        <Ionicons
                          name={isCurrentAttached ? 'checkmark-circle' : 'time-outline'}
                          size={12}
                          color={isCurrentAttached ? '#16a34a' : '#d97706'}
                        />
                        <Text
                          style={
                            isCurrentAttached
                              ? styles.pillTextGreen
                              : styles.pillTextAmber
                          }
                        >
                          {isCurrentAttached ? 'Attached' : 'Required'}
                        </Text>
                      </View>
                    </View>

                    {/* Viewfinder Preview Box */}
                    <TouchableOpacity
                      style={styles.viewfinderPhotoBox}
                      onPress={() => handleInspectionOptions(safeIdx)}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={
                          currentPhotoUri &&
                          !currentPhotoUri.startsWith('demo_') &&
                          !currentPhotoUri.includes('images.unsplash.com')
                            ? { uri: currentPhotoUri }
                            : activeItem.sampleSource
                        }
                        style={styles.viewfinderPhotoImage}
                        resizeMode="cover"
                      />

                      {isCurrentAttached ? (
                        <>
                          <View style={styles.heroAttachedRibbon}>
                            <Ionicons name="checkmark-circle" size={13} color="#ffffff" />
                            <Text style={styles.heroAttachedRibbonText}>✓ PHOTO ATTACHED</Text>
                          </View>
                          <View style={styles.heroRetakeOverlayBtn}>
                            <Ionicons name="camera-reverse" size={12} color="#ffffff" />
                            <Text style={styles.heroRetakeOverlayText}>Tap to Retake</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={styles.viewfinderCenterCameraCircle}>
                            <Ionicons name="camera" size={24} color="#ffffff" />
                          </View>
                          <View style={styles.sampleGuideOverlay}>
                            <Ionicons name="eye-outline" size={12} color="#ffffff" />
                            <Text style={styles.sampleGuideOverlayText}>Reference Guide • Tap to capture</Text>
                          </View>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Section: WHAT ALL SHOULD BE ATTACHED (Slidable Strip for 4 Vehicle Angles) */}
                  <View style={styles.slidableStripSection}>
                    <View style={styles.slidableStripHeader}>
                      <Text style={styles.slidableStripTitle}>4 VEHICLE ANGLES REQUIRED</Text>
                      <Text style={styles.slidableStripSub}>Slide & tap to view or retake</Text>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.slidableScrollContent}
                    >
                      {vehicleItems.map((item, idx) => {
                        const isSelected = idx === safeIdx;
                        const isDone = isAttachmentCompleted(idx);
                        const thumbUri = getAttachmentPhotoUri(idx);

                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.slidableAttachmentCard,
                              isSelected && styles.slidableAttachmentCardSelected,
                            ]}
                            onPress={() => setActiveAttachmentIdx(idx)}
                            activeOpacity={0.8}
                          >
                            <View style={styles.slidableThumbBox}>
                              <Image
                                source={
                                  thumbUri &&
                                  !thumbUri.startsWith('demo_') &&
                                  !thumbUri.includes('images.unsplash.com')
                                    ? { uri: thumbUri }
                                    : item.sampleSource
                                }
                                style={styles.slidableThumbImage}
                                resizeMode="cover"
                              />
                              <View
                                style={[
                                  styles.slidableThumbBadge,
                                  isDone ? styles.badgeGreen : styles.badgeMuted,
                                ]}
                              >
                                <Ionicons
                                  name={isDone ? 'checkmark-circle' : 'camera-outline'}
                                  size={11}
                                  color="#ffffff"
                                />
                              </View>
                            </View>

                            <Text
                              style={[
                                styles.slidableItemTitle,
                                isSelected && styles.slidableItemTitleSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {item.shortTitle}
                            </Text>

                            <Text
                              style={[
                                styles.slidableItemStatus,
                                isDone ? styles.textGreen : styles.textMuted,
                              ]}
                            >
                              {isDone ? 'Attached' : 'Required'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              );
            })()}
          </>
        )}

        {/* STEP 2: PASSENGER OTP, DRIVER SELFIE & ODOMETER */}
        {currentVerificationStep === 2 && (
          <>
            {/* Quick Switcher Back to Step 1 */}
            <TouchableOpacity
              style={styles.backToStep1Btn}
              onPress={() => {
                setCurrentVerificationStep(1);
                setActiveAttachmentIdx(0);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.backToStep1Left}>
                <Ionicons name="arrow-back" size={14} color="#0284c7" />
                <Text style={styles.backToStep1Text}>Review Vehicle Evidence (4/4 Completed)</Text>
              </View>
              <View style={styles.step1DoneBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                <Text style={styles.step1DoneBadgeText}>Attached</Text>
              </View>
            </TouchableOpacity>

            {/* Passenger Information Card (Separate Section Box) */}
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

            {/* Admin Authorization Notice OR Customer Pickup OTP Card */}
            {isAdminAuthorized ? (
              <View style={styles.authorizedBox}>
                <View style={styles.authorizedHeader}>
                  <Ionicons name="checkmark-circle" size={18} color="#34d399" />
                  <Text style={styles.authorizedTitle}>{t('trip_flow.admin_auth_title')}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.otpHeaderBadge}>
                    <Ionicons name="shield-checkmark" size={22} color="#ea580c" />
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

                  {/* Verify OTP Button */}
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

                {/* Admin Override / Info Banner */}
                <TouchableOpacity
                  style={[
                    styles.overrideLinkBanner,
                    overrideRequested && styles.overrideLinkBannerRequested,
                  ]}
                  onPress={handleRequestAdminOverride}
                  disabled={overrideRequesting}
                  activeOpacity={0.8}
                >
                  <View style={styles.overrideBannerLeft}>
                    <Ionicons
                      name={overrideRequested ? 'alert-circle' : 'information-circle-outline'}
                      size={17}
                      color={overrideRequested ? '#b45309' : '#2563eb'}
                    />
                    <View
                      style={[
                        styles.overrideDividerBlue,
                        overrideRequested && { backgroundColor: '#fde68a' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.overrideLinkText,
                        overrideRequested && { color: '#92400e', fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {overrideRequesting
                        ? t('trip_flow.requesting_override')
                        : overrideRequested
                        ? t('trip_flow.override_requested')
                        : t('trip_flow.verify_before_starting')}
                    </Text>
                  </View>
                  <Ionicons
                    name={overrideRequested ? 'close-circle' : 'chevron-forward'}
                    size={16}
                    color={overrideRequested ? '#b45309' : '#2563eb'}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2 Verification Card: Driver Selfie & Starting Odometer */}
            {(() => {
              const step2Items = verificationAttachments.slice(4, 6);
              const safeIdx = activeAttachmentIdx >= 4 && activeAttachmentIdx <= 5 ? activeAttachmentIdx : 4;
              const activeItem = verificationAttachments[safeIdx];
              const isCurrentAttached = isAttachmentCompleted(safeIdx);
              const currentPhotoUri = getAttachmentPhotoUri(safeIdx);

              return (
                <View style={styles.card}>
                  {/* Card Header Row */}
                  <View style={styles.cardHeaderRowBetween}>
                    <View style={styles.cardHeaderLeftGroup}>
                      <View style={[styles.cardHeaderIconCircle, { backgroundColor: '#0284c7' }]}>
                        <Ionicons name="speedometer" size={16} color="#ffffff" />
                      </View>
                      <View style={styles.cardHeaderTextCol}>
                        <Text style={styles.cardHeaderTitle}>Driver Selfie & Starting Odometer *</Text>
                        <Text style={styles.cardHeaderSubtitle}>
                          {step2AttachedCount} of 2 mandatory attachments completed
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.demoFillMiniBtn}
                      onPress={handleFillDemoInspectionPhotos}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="flash" size={11} color="#ea580c" />
                      <Text style={styles.demoFillMiniBtnText}>Demo</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Progress Bar Track */}
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.round((step2AttachedCount / 2) * 100)}%` },
                        isStep2Done && styles.progressBarFillComplete,
                      ]}
                    />
                  </View>

                  {/* Active Viewfinder (Top Focused View) */}
                  <View style={styles.focusedViewfinderWrapper}>
                    <View style={styles.viewfinderHeaderRow}>
                      <View style={styles.viewfinderStepTag}>
                        <Text style={styles.viewfinderStepTagText}>
                          {activeItem.shortTitle.toUpperCase()} ({safeIdx === 4 ? '1/2' : '2/2'})
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.viewfinderStatusPill,
                          isCurrentAttached ? styles.pillGreen : styles.pillAmber,
                        ]}
                      >
                        <Ionicons
                          name={isCurrentAttached ? 'checkmark-circle' : 'time-outline'}
                          size={12}
                          color={isCurrentAttached ? '#16a34a' : '#d97706'}
                        />
                        <Text
                          style={
                            isCurrentAttached
                              ? styles.pillTextGreen
                              : styles.pillTextAmber
                          }
                        >
                          {isCurrentAttached ? 'Attached' : 'Required'}
                        </Text>
                      </View>
                    </View>

                    {/* Viewfinder Preview Box */}
                    <TouchableOpacity
                      style={styles.viewfinderPhotoBox}
                      onPress={() => {
                        if (activeItem.type === 'selfie') {
                          handleOpenSelfieCamera();
                        } else if (activeItem.type === 'odometer') {
                          handleOpenCamera();
                        }
                      }}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={
                          currentPhotoUri &&
                          !currentPhotoUri.startsWith('demo_') &&
                          !currentPhotoUri.includes('images.unsplash.com')
                            ? { uri: currentPhotoUri }
                            : activeItem.sampleSource
                        }
                        style={styles.viewfinderPhotoImage}
                        resizeMode="cover"
                      />

                      {isCurrentAttached ? (
                        <>
                          <View style={styles.heroAttachedRibbon}>
                            <Ionicons name="checkmark-circle" size={13} color="#ffffff" />
                            <Text style={styles.heroAttachedRibbonText}>✓ PHOTO ATTACHED</Text>
                          </View>
                          <View style={styles.heroRetakeOverlayBtn}>
                            <Ionicons name="camera-reverse" size={12} color="#ffffff" />
                            <Text style={styles.heroRetakeOverlayText}>Tap to Retake</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={styles.viewfinderCenterCameraCircle}>
                            <Ionicons name="camera" size={24} color="#ffffff" />
                          </View>
                          <View style={styles.sampleGuideOverlay}>
                            <Ionicons name="eye-outline" size={12} color="#ffffff" />
                            <Text style={styles.sampleGuideOverlayText}>Reference Guide • Tap to capture</Text>
                          </View>
                        </>
                      )}

                      {/* Watermark for selfie / odometer */}
                      {activeItem.type === 'selfie' && selfieLocation && (
                        <View style={styles.gpsWatermarkOverlay}>
                          <Text style={styles.gpsWatermarkCoords}>
                            📍 {`${selfieLocation.lat.toFixed(4)}° N, ${selfieLocation.lng.toFixed(4)}° E • ${selfieLocation.time}`}
                          </Text>
                        </View>
                      )}
                      {activeItem.type === 'odometer' && photoLocation && (
                        <View style={styles.gpsWatermarkOverlay}>
                          <Text style={styles.gpsWatermarkCoords}>
                            📍 {`${photoLocation.lat.toFixed(4)}° N, ${photoLocation.lng.toFixed(4)}° E • ${photoLocation.time}`}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* If Odometer is selected, show numeric KM input & OCR banner */}
                    {activeItem.type === 'odometer' && (
                      <View style={styles.odometerInputWrapper}>
                        <View style={styles.odometerInputContainer}>
                          <Ionicons name="speedometer-outline" size={18} color="#6366f1" style={styles.odometerIcon} />
                          <TextInput
                            style={styles.odometerTextInput}
                            value={startingOdometer}
                            onChangeText={(val) => {
                              setStartingOdometer(val);
                              if (bookingId) setTripStartDraft(bookingId, { startingOdometer: val });
                            }}
                            keyboardType="decimal-pad"
                            placeholder="Enter starting km (e.g. 42850)"
                            placeholderTextColor="#94a3b8"
                          />
                          <View style={styles.odometerKmBadge}>
                            <Text style={styles.odometerKmText}>KM</Text>
                          </View>
                        </View>

                        {ocrScanning ? (
                          <View style={styles.ocrScanningBanner}>
                            <ActivityIndicator size="small" color="#0284c7" />
                            <Text style={styles.ocrScanningText}>Auto-reading gauge numbers...</Text>
                          </View>
                        ) : ocrResultText.status === 'success' ? (
                          <View style={styles.ocrSuccessBanner}>
                            <Ionicons name="checkmark-circle" size={13} color="#16a34a" />
                            <Text style={styles.ocrSuccessText}>{ocrResultText.message}</Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>

                  {/* Section: WHAT ALL SHOULD BE ATTACHED (Slidable Strip for Step 2: Selfie & Odometer) */}
                  <View style={styles.slidableStripSection}>
                    <View style={styles.slidableStripHeader}>
                      <Text style={styles.slidableStripTitle}>STEP 2 VERIFICATIONS</Text>
                      <Text style={styles.slidableStripSub}>Slide & tap to view or retake</Text>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.slidableScrollContent}
                    >
                      {step2Items.map((item) => {
                        const idx = item.id === 'selfie' ? 4 : 5;
                        const isSelected = idx === safeIdx;
                        const isDone = isAttachmentCompleted(idx);
                        const thumbUri = getAttachmentPhotoUri(idx);

                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.slidableAttachmentCard,
                              isSelected && styles.slidableAttachmentCardSelected,
                            ]}
                            onPress={() => setActiveAttachmentIdx(idx)}
                            activeOpacity={0.8}
                          >
                            <View style={styles.slidableThumbBox}>
                              <Image
                                source={
                                  thumbUri &&
                                  !thumbUri.startsWith('demo_') &&
                                  !thumbUri.includes('images.unsplash.com')
                                    ? { uri: thumbUri }
                                    : item.sampleSource
                                }
                                style={styles.slidableThumbImage}
                                resizeMode="cover"
                              />
                              <View
                                style={[
                                  styles.slidableThumbBadge,
                                  isDone ? styles.badgeGreen : styles.badgeMuted,
                                ]}
                              >
                                <Ionicons
                                  name={isDone ? 'checkmark-circle' : 'camera-outline'}
                                  size={11}
                                  color="#ffffff"
                                />
                              </View>
                            </View>

                            <Text
                              style={[
                                styles.slidableItemTitle,
                                isSelected && styles.slidableItemTitleSelected,
                              ]}
                              numberOfLines={1}
                            >
                              {item.shortTitle}
                            </Text>

                            <Text
                              style={[
                                styles.slidableItemStatus,
                                isDone ? styles.textGreen : styles.textMuted,
                              ]}
                            >
                              {isDone ? 'Attached' : 'Required'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              );
            })()}
          </>
        )}
      </ScrollView>

      {/* Pinned Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {currentVerificationStep === 1 ? (
          <TouchableOpacity
            style={[
              styles.yellowPrimaryButton,
              isVehicleEvidenceDone && styles.yellowPrimaryButtonReady,
              loading && styles.startButtonDisabled,
            ]}
            onPress={() => {
              if (!isVehicleEvidenceDone) {
                // Find next missing vehicle photo (0..3)
                const nextMissingVehicleIdx = [0, 1, 2, 3].find((idx) => !inspectionPhotos[idx]);
                const targetIdx = nextMissingVehicleIdx !== undefined ? nextMissingVehicleIdx : (activeAttachmentIdx < 4 ? activeAttachmentIdx : 0);
                setActiveAttachmentIdx(targetIdx);
                handleInspectionOptions(targetIdx);
                return;
              }

              // Step 1 done -> advance to Step 2
              setCurrentVerificationStep(2);
              setActiveAttachmentIdx(4);
              scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#0f172a" size="small" />
            ) : (
              <>
                <Text style={styles.yellowPrimaryButtonText} numberOfLines={1}>
                  {!isVehicleEvidenceDone
                    ? `Capture ${verificationAttachments[activeAttachmentIdx < 4 ? activeAttachmentIdx : 0]?.shortTitle || 'Vehicle Photo'} (${vehicleAttachedCount}/4) →`
                    : 'PROCEED TO STEP 2: OTP & TRIP LAUNCH →'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#0f172a" />
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.yellowPrimaryButton,
              isStep2Done && Boolean(isOtpVerified || isAdminAuthorized) && styles.yellowPrimaryButtonReady,
              loading && styles.startButtonDisabled,
            ]}
            onPress={() => {
              if (!isAdminAuthorized && pickupOtp.length < 4) {
                setError('Please enter the 4-digit pickup OTP from the customer');
                return;
              }

              if (!isAdminAuthorized && !isOtpVerified) {
                handleVerifyOtp();
                return;
              }

              if (!driverSelfieUri) {
                setActiveAttachmentIdx(4);
                handleOpenSelfieCamera();
                return;
              }

              if (!odometerImageUri) {
                setActiveAttachmentIdx(5);
                handleOpenCamera();
                return;
              }

              if (!startingOdometer) {
                setActiveAttachmentIdx(5);
                setError('Please enter the starting odometer reading in KM');
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
                  {!isAdminAuthorized && pickupOtp.length < 4
                    ? 'Enter Customer Pickup OTP (4 Digits) →'
                    : !isAdminAuthorized && !isOtpVerified
                    ? 'Verify Customer Pickup OTP →'
                    : !driverSelfieUri
                    ? 'Capture Driver Selfie (1/2) →'
                    : !odometerImageUri
                    ? 'Capture Starting Odometer Photo (2/2) →'
                    : !startingOdometer
                    ? 'Enter Starting Odometer Reading →'
                    : 'CONFIRM & START TRIP →'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#0f172a" />
              </>
            )}
          </TouchableOpacity>
        )}
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
  twoStepTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  stepTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  stepTabItemActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  stepTabItemDisabled: {
    opacity: 0.65,
  },
  stepTabBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTabBadgeDone: {
    backgroundColor: '#16a34a',
  },
  stepTabBadgeActive: {
    backgroundColor: '#2563eb',
  },
  stepTabBadgeInactive: {
    backgroundColor: '#94a3b8',
  },
  stepTabBadgeNum: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  stepTabTextCol: {
    flex: 1,
  },
  stepTabMainText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  stepTabMainTextActive: {
    color: '#1d4ed8',
    fontWeight: '900',
  },
  stepTabSubText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
  },
  stepTabDivider: {
    width: 10,
  },
  step1Banner: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  step1BannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  step1BannerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  step1BannerTextCol: {
    flex: 1,
  },
  step1BannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369a1',
  },
  step1BannerDesc: {
    fontSize: 11,
    color: '#0c4a6e',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 15,
  },
  backToStep1Btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  backToStep1Left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  backToStep1Text: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0284c7',
  },
  step1DoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  step1DoneBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
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
  passengerSectionInside: {
    paddingBottom: 8,
  },
  passengerOtpDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: -12,
    marginBottom: 10,
  },
  otpSectionInside: {
    paddingTop: 2,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  authorizedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  overrideLinkBannerRequested: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
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
    fontSize: 12,
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
  badgeGreenLight: {
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

  inspectionGridItem: {
    width: '48%',
  },
  inspectionAngleBox: {
    width: '100%',
    height: 115,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  inspectionAngleImage: {
    width: '100%',
    height: '100%',
  },
  inspectionAngleBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  inspectionAngleBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  inspectionGuidePill: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  inspectionGuidePillText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '700',
  },
  inspectionAngleFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  inspectionAngleTitle: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardHeaderRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 3,
  },
  progressBarFillComplete: {
    backgroundColor: '#16a34a',
  },
  focusedViewfinderWrapper: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 12,
  },
  viewfinderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  viewfinderStepTag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  viewfinderStepTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1d4ed8',
    letterSpacing: 0.5,
  },
  viewfinderStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillGreen: {
    backgroundColor: '#dcfce7',
  },
  pillAmber: {
    backgroundColor: '#fef3c7',
  },
  pillTextGreen: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
  },
  pillTextAmber: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
  },
  viewfinderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  viewfinderDesc: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 8,
  },
  viewfinderPhotoBox: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderPhotoImage: {
    width: '100%',
    height: '100%',
  },
  viewfinderCenterCameraCircle: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  heroAttachedRibbon: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroAttachedRibbonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroRetakeOverlayBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroRetakeOverlayText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  odometerInputWrapper: {
    marginTop: 10,
    gap: 8,
  },
  slidableStripSection: {
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  slidableStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slidableStripTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.4,
  },
  slidableStripSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  slidableScrollContent: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 10,
  },
  slidableAttachmentCard: {
    width: 102,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  slidableAttachmentCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  slidableThumbBox: {
    width: '100%',
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    position: 'relative',
    marginBottom: 5,
  },
  slidableThumbImage: {
    width: '100%',
    height: '100%',
  },
  slidableThumbBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGreen: {
    backgroundColor: '#16a34a',
  },
  badgeMuted: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  slidableItemTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  slidableItemTitleSelected: {
    color: '#1d4ed8',
    fontWeight: '900',
  },
  slidableItemStatus: {
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 1,
  },
  textGreen: {
    color: '#16a34a',
  },
  textMuted: {
    color: '#94a3b8',
  },
});

