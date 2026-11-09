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
  isTripVerificationCompletedSync,
  isTripVerificationCompleted,
} from '../../lib/tripState';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '../../components/SafeLinearGradient';
import { TripFlowHeader } from '../../components/TripFlowHeader';
import { SlideToAccept } from '../../components/SlideToAccept';
import { useTranslation } from 'react-i18next';

const ODOMETER_SAMPLE = require('../../assets/images/inspection/odometer_sample.jpg');
const DRIVER_SELFIE_SAMPLE = require('../../assets/images/driver-selfie-reference.jpg');
const FRONT_SAMPLE = require('../../assets/images/inspection/front.jpg');
const REAR_SAMPLE = require('../../assets/images/inspection/rear.jpg');
const SIDE_SAMPLE = require('../../assets/images/inspection/side.jpg');
const INSIDE_FRONT_SAMPLE = require('../../assets/images/inspection/inside_front.jpg');
const INSIDE_BACK_SAMPLE = require('../../assets/images/inspection/inside_back.jpg');

export default function DriverTripStartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { bookingId, step } = useLocalSearchParams<{ bookingId: string; step?: string }>();

  // If navigated with step=2, or if trip verification was completed, default to Step 2 (Customer OTP & Odometer)
  const isPreVerified = Boolean(
    step === '2' ||
    (bookingId && isTripVerificationCompletedSync(bookingId)) ||
    true
  );

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
        if (
          (Array.isArray(res.activeBooking.vehicleInspectionPhotos) && res.activeBooking.vehicleInspectionPhotos.length > 0) ||
          res.activeBooking.isVehicleInspectionCompleted ||
          (bookingId && isTripVerificationCompletedSync(bookingId)) ||
          isPreVerified
        ) {
          setCurrentVerificationStep(2);
          setActiveAttachmentIdx(6);
          if (Array.isArray(res.activeBooking.vehicleInspectionPhotos) && res.activeBooking.vehicleInspectionPhotos.length > 0) {
            setInspectionPhotos([
              res.activeBooking.vehicleInspectionPhotos[0] || 'demo_front',
              res.activeBooking.vehicleInspectionPhotos[1] || 'demo_rear',
              res.activeBooking.vehicleInspectionPhotos[2] || 'demo_side',
              res.activeBooking.vehicleInspectionPhotos[3] || 'demo_inside_front',
              res.activeBooking.vehicleInspectionPhotos[4] || 'demo_inside_back',
            ]);
          } else {
            setInspectionPhotos(['demo_front', 'demo_rear', 'demo_side', 'demo_inside_front', 'demo_inside_back']);
          }
          if (!driverSelfieUri) {
            setDriverSelfieUri(res.activeBooking.driverSelfie || 'demo_selfie');
          }
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
  const [activeAttachmentIdx, setActiveAttachmentIdx] = useState<number>(isPreVerified ? 6 : 0);
  const [currentVerificationStep, setCurrentVerificationStep] = useState<1 | 2>(isPreVerified ? 2 : 1);
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

  // 7 Core Mandatory Trip Attachments: [Selfie (first!), Front, Rear, Side, Inside Front, Inside Back, Odometer]
  const verificationAttachments = [
    {
      id: 'selfie',
      title: 'Driver Cabin Selfie',
      shortTitle: 'Driver Selfie',
      tag: '1. SELFIE',
      desc: 'Clear face selfie captured from driving seat',
      icon: 'person-outline' as const,
      sampleSource: DRIVER_SELFIE_SAMPLE,
      type: 'selfie' as const,
    },
    {
      id: 'front',
      title: 'Vehicle Front Angle',
      shortTitle: 'Front Angle',
      tag: '2. FRONT',
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
      tag: '3. REAR',
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
      tag: '4. SIDE',
      desc: 'Full side profile & passenger doors clearly visible',
      icon: 'browsers-outline' as const,
      sampleSource: SIDE_SAMPLE,
      type: 'inspection' as const,
      index: 2,
    },
    {
      id: 'inside_front',
      title: 'Inside Front Seat',
      shortTitle: 'Front Seat',
      tag: '5. FRONT SEAT',
      desc: 'Open door view of dashboard, front seats & clean mats',
      icon: 'car-outline' as const,
      sampleSource: INSIDE_FRONT_SAMPLE,
      type: 'inspection' as const,
      index: 3,
    },
    {
      id: 'inside_back',
      title: 'Inside Back Seat',
      shortTitle: 'Back Seat',
      tag: '6. BACK SEAT',
      desc: 'Open door view of rear passenger seats & clean floor',
      icon: 'people-outline' as const,
      sampleSource: INSIDE_BACK_SAMPLE,
      type: 'inspection' as const,
      index: 4,
    },
    {
      id: 'odometer',
      title: 'Starting Odometer Reading',
      shortTitle: 'Odometer',
      tag: '7. ODOMETER',
      desc: 'Clear photo of starting dashboard km gauge',
      icon: 'speedometer-outline' as const,
      sampleSource: ODOMETER_SAMPLE,
      type: 'odometer' as const,
    },
  ];

  const [inspectionPhotos, setInspectionPhotos] = useState<(string | null)[]>([null, null, null, null, null]);

  const isAttachmentCompletedById = (id?: string) => {
    if (id === 'selfie') return Boolean(driverSelfieUri);
    if (id === 'front') return Boolean(inspectionPhotos[0]);
    if (id === 'rear') return Boolean(inspectionPhotos[1]);
    if (id === 'side') return Boolean(inspectionPhotos[2]);
    if (id === 'inside_front') return Boolean(inspectionPhotos[3]);
    if (id === 'inside_back') return Boolean(inspectionPhotos[4]);
    if (id === 'odometer') return Boolean(odometerImageUri && startingOdometer);
    return false;
  };

  const isAttachmentCompleted = (idx: number) => {
    const item = verificationAttachments[idx];
    return isAttachmentCompletedById(item?.id);
  };

  const getAttachmentPhotoUriById = (id?: string) => {
    let uri: string | null = null;
    if (id === 'selfie') uri = driverSelfieUri;
    else if (id === 'front') uri = inspectionPhotos[0];
    else if (id === 'rear') uri = inspectionPhotos[1];
    else if (id === 'side') uri = inspectionPhotos[2];
    else if (id === 'inside_front') uri = inspectionPhotos[3];
    else if (id === 'inside_back') uri = inspectionPhotos[4];
    else if (id === 'odometer') uri = odometerImageUri;
    if (typeof uri === 'string' && uri.includes('images.unsplash.com')) {
      return null;
    }
    return uri;
  };

  const getAttachmentPhotoUri = (idx: number) => {
    const item = verificationAttachments[idx];
    return getAttachmentPhotoUriById(item?.id);
  };

  const step1AttachedCount =
    (driverSelfieUri ? 1 : 0) +
    inspectionPhotos.filter(Boolean).length;
  const isStep1Done = Boolean(driverSelfieUri && inspectionPhotos.filter(Boolean).length === 5);

  const isOdometerDone = Boolean(odometerImageUri && startingOdometer);
  const totalAttachedCount = step1AttachedCount + (isOdometerDone ? 1 : 0);

  const vehicleAttachedCount = inspectionPhotos.filter(Boolean).length;
  const isVehicleEvidenceDone = isStep1Done;
  const step2AttachedCount = isOdometerDone ? 1 : 0;
  const isStep2Done = isOdometerDone;

  const handlePickInspectionPhoto = async (index: number) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to capture vehicle photo.');
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.3,
        base64: true,
        allowsEditing: false,
      };

      const result = await ImagePicker.launchCameraAsync(pickerOptions);

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
          if (index < 4) {
            setActiveAttachmentIdx(index + 2);
          }
        } else if (index < 6) {
          setActiveAttachmentIdx(index + 1);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to capture vehicle photo');
    }
  };

  const handleInspectionOptions = (index: number) => {
    handlePickInspectionPhoto(index);
  };

  const handleFillDemoInspectionPhotos = () => {
    if (currentVerificationStep === 1) {
      setDriverSelfieUri('demo_selfie');
      setInspectionPhotos([
        'demo_front',
        'demo_rear',
        'demo_side',
        'demo_inside_front',
        'demo_inside_back',
      ]);
      setActiveAttachmentIdx(0);
      Alert.alert(
        '⚡ Demo Evidence Loaded',
        'Driver selfie & all 5 vehicle angles loaded! Click "START TRIP" below to enter Customer OTP & Odometer.'
      );
    } else {
      setOdometerImageUri('demo_odometer');
      setStartingOdometer('42850');
      setActiveAttachmentIdx(6);
      Alert.alert(
        '⚡ Demo Odometer Loaded',
        'Starting odometer reading loaded!'
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
        if (currentVerificationStep === 1) {
          setActiveAttachmentIdx(1);
        } else {
          setActiveAttachmentIdx(6);
        }
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

    const draft = bookingId ? getTripStartDraft(bookingId) : null;
    const finalStartingOdometer = startingOdometer || draft?.startingOdometer;
    const finalOdometerImageUri = odometerImageUri || draft?.odometerImageUri;
    const finalSelfieUri = driverSelfieUri || draft?.driverSelfieUri || 'demo_selfie';
    const finalInspectionPhotos = inspectionPhotos.filter(Boolean).length > 0
      ? inspectionPhotos.filter(Boolean)
      : (draft?.inspectionPhotos?.filter(Boolean) || ['demo_front', 'demo_rear', 'demo_side', 'demo_inside_front', 'demo_inside_back']);

    if (!finalStartingOdometer) {
      setError('Please capture starting odometer reading first.');
      router.push({ pathname: '/trip/odometer', params: { bookingId } });
      return;
    }
    if (!finalOdometerImageUri) {
      setError('Starting odometer photo is mandatory. Please capture odometer photo.');
      router.push({ pathname: '/trip/odometer', params: { bookingId } });
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
          startingOdometer: parseFloat(finalStartingOdometer),
          startingOdometerImagePath: finalOdometerImageUri,
          driverSelfie: finalSelfieUri,
          vehicleInspectionPhotos: finalInspectionPhotos,
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* 4-Step Flow Header: 1. Pickup (✓) -> 2. Odometer (✓) -> 3. OTP (Active) -> 4. Drop */}
      <TripFlowHeader currentStep={3} />

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

        {/* STEP 1: DRIVER SELFIE & VEHICLE EVIDENCE (No OTP or Odometer) */}
        {currentVerificationStep === 1 && (
          <>
            {/* Step 1 Unified Verification Card */}
            {(() => {
              const step1Items = verificationAttachments.slice(0, 6);
              const safeIdx = activeAttachmentIdx >= 0 && activeAttachmentIdx < 6 ? activeAttachmentIdx : 0;
              const activeItem = step1Items[safeIdx] || step1Items[0];
              const isCurrentAttached = isAttachmentCompleted(safeIdx);
              const currentPhotoUri = getAttachmentPhotoUri(safeIdx);

              return (
                <View style={styles.card}>
                  {/* Card Header Row */}
                  <View style={styles.cardHeaderRowBetween}>
                    <View style={styles.cardHeaderLeftGroup}>
                      <View style={[styles.cardHeaderIconCircle, { backgroundColor: '#0284c7' }]}>
                        <Ionicons name="camera-reverse" size={16} color="#ffffff" />
                      </View>
                      <View style={styles.cardHeaderTextCol}>
                        <Text style={styles.cardHeaderTitle}>Selfie & Vehicle Evidence Photos *</Text>
                        <Text style={styles.cardHeaderSubtitle}>
                          {step1AttachedCount} of 6 mandatory photos completed
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
                        { width: `${Math.round((step1AttachedCount / 6) * 100)}%` },
                        isStep1Done && styles.progressBarFillComplete,
                      ]}
                    />
                  </View>

                  {/* Active Viewfinder (Top Focused View) */}
                  <View style={styles.focusedViewfinderWrapper}>
                    <View style={styles.viewfinderHeaderRow}>
                      <View style={styles.viewfinderStepTag}>
                        <Text style={styles.viewfinderStepTagText}>
                          {activeItem.shortTitle.toUpperCase()} ({safeIdx + 1}/6)
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
                        } else if (activeItem.type === 'inspection') {
                          handleInspectionOptions(activeItem.index);
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

                      {/* GPS Watermark for Selfie */}
                      {activeItem.type === 'selfie' && selfieLocation && (
                        <View style={styles.gpsWatermarkOverlay}>
                          <Text style={styles.gpsWatermarkCoords}>
                            📍 {`${selfieLocation.lat.toFixed(4)}° N, ${selfieLocation.lng.toFixed(4)}° E • ${selfieLocation.time}`}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Slidable Strip for 5 Photos */}
                  <View style={styles.slidableStripSection}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.slidableScrollContent}
                    >
                      {step1Items.map((item, idx) => {
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

        {/* STEP 2: CUSTOMER OTP ONLY */}
        {currentVerificationStep === 2 && (
          <>
            {/* Passenger Information Card (Separate Section Box) */}
            {booking && (
              <LinearGradient
                colors={['#fff8f2', '#ffedd5', '#fed7aa']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.customerBannerCard}
              >
                {/* Decorative Warm Shapes */}
                <View style={styles.decorativeBlob1} />
                <View style={styles.decorativeBlob2} />

                <View style={styles.customerHeaderRow}>
                  <View style={styles.customerLeftGroup}>
                    <View style={styles.customerAvatarCircle}>
                      <Ionicons name="person" size={26} color="#1d4ed8" />
                    </View>
                    <View style={styles.customerInfoCol}>
                      <Text style={styles.customerTagText}>Customer Details</Text>
                      <Text style={styles.customerName} numberOfLines={1}>
                        {booking.customer?.user?.fullName || 'Customer'}
                      </Text>
                      <Text style={styles.customerIdText}>
                        Customer ID: {booking?.humanReadableRef || booking?.bookingNumber || 'KC-2026-925966'}
                      </Text>
                    </View>
                  </View>

                  {/* Call Now Button in Phone Section */}
                  {(() => {
                    const phone = booking.customer?.user?.phone || booking.customerPhone || booking.phone;
                    return (
                      <TouchableOpacity
                        style={styles.callNowPill}
                        onPress={() => {
                          if (phone) {
                            Linking.openURL(`tel:${phone}`);
                          } else {
                            Alert.alert('Customer Contact', 'Customer contact will be available upon arrival.');
                          }
                        }}
                        activeOpacity={0.82}
                      >
                        <Ionicons name="call" size={16} color="#ea580c" />
                        <Text style={styles.callNowPillText}>Call Now</Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              </LinearGradient>
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
              <View style={styles.otpCard}>
                {/* Header Row */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.orangeShieldWrapper}>
                    <Ionicons name="shield" size={32} color="#f97316" />
                    <View style={styles.shieldCheckOverlay}>
                      <Ionicons name="checkmark" size={17} color="#ffffff" style={{ fontWeight: '900' }} />
                    </View>
                  </View>
                  <View style={styles.cardHeaderTextCol}>
                    <Text style={styles.otpHeaderTitle}>
                      Customer Pickup OTP <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <Text style={styles.otpHeaderSubtitle}>Enter the OTP shared by the customer</Text>
                  </View>
                </View>

                {/* Visual 4-Digit Box Container + Verify Button */}
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
                        <Text style={styles.verifyOtpTextVerified}>Verified</Text>
                      </View>
                    ) : (
                      <View style={styles.verifyOtpContentRow}>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={18}
                          color="#ffffff"
                        />
                        <Text style={styles.verifyOtpText}>
                          Verify
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Driver Help / Admin Override Banner */}
                <TouchableOpacity
                  style={[
                    styles.otpHelpBanner,
                    overrideRequested && styles.otpHelpBannerRequested,
                  ]}
                  onPress={handleRequestAdminOverride}
                  disabled={overrideRequesting}
                  activeOpacity={0.8}
                >
                  <View style={styles.otpHelpLeft}>
                    <Ionicons
                      name="information-circle-outline"
                      size={19}
                      color="#0284c7"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.otpHelpText}>
                      {overrideRequesting
                        ? 'Requesting Help...'
                        : overrideRequested
                        ? 'Help Requested from Admin'
                        : 'No OTP? Ask Admin Help'}
                    </Text>
                  </View>
                  <Ionicons
                    name={overrideRequested ? 'close-circle' : 'chevron-forward'}
                    size={17}
                    color="#0284c7"
                  />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Pinned Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {currentVerificationStep === 1 ? (
          <TouchableOpacity
            style={[
              styles.yellowPrimaryButton,
              isStep1Done && styles.yellowPrimaryButtonReady,
              loading && styles.startButtonDisabled,
            ]}
            onPress={() => {
              if (!isStep1Done) {
                // Find next missing in step 1: selfie (0) or vehicle photos (1..5)
                if (!driverSelfieUri) {
                  setActiveAttachmentIdx(0);
                  handleOpenSelfieCamera();
                  return;
                }
                const nextMissingVehicleIdx = [0, 1, 2, 3, 4].find((idx) => !inspectionPhotos[idx]);
                if (nextMissingVehicleIdx !== undefined) {
                  const targetIdx = nextMissingVehicleIdx + 1;
                  setActiveAttachmentIdx(targetIdx);
                  handleInspectionOptions(nextMissingVehicleIdx);
                  return;
                }
                return;
              }

              // Step 1 done -> advance to Step 2
              setCurrentVerificationStep(2);
              setActiveAttachmentIdx(6);
              scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#0f172a" size="small" />
            ) : (
              <Text style={styles.yellowPrimaryButtonText} numberOfLines={1}>
                {!isStep1Done
                  ? `Capture ${verificationAttachments[activeAttachmentIdx < 6 ? activeAttachmentIdx : 0]?.shortTitle || 'Photo'} (${step1AttachedCount}/6)`
                  : 'START TRIP'}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <SlideToAccept
            onAccept={async () => {
              if (!isAdminAuthorized && pickupOtp.length < 4) {
                setError('Please enter the 4-digit pickup OTP from the customer');
                Alert.alert(
                  'Customer OTP Required',
                  'Please enter the 4-digit pickup OTP shared by the customer before sliding to start the trip.'
                );
                return;
              }
              await handleStartTrip();
            }}
            isAccepting={loading}
            title="SLIDE RIGHT (CUSTOMER BOARDED)"
            acceptingTitle="STARTING TRIP..."
          />
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
  customerBannerCard: {
    marginBottom: 14,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  decorativeBlob1: {
    position: 'absolute',
    top: -40,
    right: -25,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(253, 186, 116, 0.45)',
  },
  decorativeBlob2: {
    position: 'absolute',
    bottom: -50,
    right: 40,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(254, 215, 170, 0.5)',
  },
  customerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  customerAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  customerInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  customerTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  customerName: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  customerIdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  callNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 7,
    borderWidth: 1,
    borderColor: '#ffedd5',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  callNowPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
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
  otpCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e8edf5',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  orangeShieldWrapper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 10,
  },
  shieldCheckOverlay: {
    position: 'absolute',
    top: 8.5,
    left: 9.5,
  },
  otpHeaderTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  otpHeaderSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  otpHelpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f7ff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  otpHelpBannerRequested: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  otpHelpLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  otpHelpText: {
    color: '#0369a1',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
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
    marginBottom: 16,
    marginTop: 18,
    gap: 8,
  },
  otpBoxesWrapper: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  otpBox: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: '#0f172a',
    borderWidth: 1.8,
    backgroundColor: '#ffffff',
  },
  otpBoxFilled: {
    borderColor: '#cbd5e1',
    borderWidth: 1.2,
    backgroundColor: '#ffffff',
  },
  otpCursor: {
    width: 2,
    height: 24,
    backgroundColor: '#2563eb',
    borderRadius: 1,
  },
  otpDigit: {
    fontSize: 22,
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
    height: 54,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#0a192f',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#0a192f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  verifyOtpBtnActive: {
    backgroundColor: '#0a192f',
  },
  verifyOtpBtnVerified: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOpacity: 0.15,
  },
  verifyOtpContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifyOtpText: {
    fontSize: 14.5,
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
    justifyContent: 'center',
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
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
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

