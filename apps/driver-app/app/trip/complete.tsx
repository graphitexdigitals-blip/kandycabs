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
  Platform,
  StatusBar,
  Image,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { locationTracker } from '../../lib/location-tracker';
import { reverseGeocodeAddress } from '../../lib/reverse-geocoding';
import { driverApiClient } from '../../lib/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from '../../components/SafeLinearGradient';
import { TripFlowHeader } from '../../components/TripFlowHeader';
import { useTranslation } from 'react-i18next';
import {
  setTripInProcess,
  setTripCompletionDraft,
  getTripCompletionDraft,
  clearTripCompletionDraft,
  getTripWaitingState,
  clearTripWaitingState,
} from '../../lib/tripState';

const ODOMETER_SAMPLE = require('../../assets/images/inspection/odometer_sample.jpg');
const CASH_RUPEE_ICON = require('../../assets/images/cash-rupee-icon.png');

export default function DriverTripCompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<any>(null);
  const [finalOdometer, setFinalOdometer] = useState('');
  const [odometerImageUri, setOdometerImageUri] = useState<string | null>(null);
  const [odometerPhotoAttached, setOdometerPhotoAttached] = useState(false);
  const [nhTollAmount, setNhTollAmount] = useState('');
  const [niceRoadTollAmount, setNiceRoadTollAmount] = useState('');
  const [parkingAmount, setParkingAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [photoLocation, setPhotoLocation] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResultText, setOcrResultText] = useState<{ status: 'success' | 'failed' | 'idle'; reading?: number; message?: string }>({ status: 'idle' });

  // Payment Collection Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'UPI_QR' | 'CASH'>('UPI_QR');
  const [tripSuccess, setTripSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ distance: number; totalAmount: number; paymentMethod: string } | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Subscribe to live GPS coordinates
  useEffect(() => {
    const unsub = locationTracker.addListener((lat, lng) => {
      if (lat != null && lng != null) {
        setCurrentCoords({ lat, lng });
      }
    });
    return () => unsub();
  }, []);

  // Fetch active booking details
  const fetchBookingDetails = useCallback(async () => {
    try {
      const res = await driverApiClient.fetch('/api/driver/status');
      if (res.success && res.activeBooking) {
        setBooking(res.activeBooking);
      }
    } catch (_) {
      // Ignore background fetch error
    }
  }, []);

  useEffect(() => {
    fetchBookingDetails();
  }, [fetchBookingDetails]);

  // Restore any previously entered odometer or photo draft when reopening screen
  useEffect(() => {
    const id = bookingId || booking?.id;
    if (!id) return;
    const draft = getTripCompletionDraft(id);
    if (draft) {
      if (draft.finalOdometer) {
        setFinalOdometer(draft.finalOdometer);
      }
      if (draft.odometerImageUri) {
        setOdometerImageUri(draft.odometerImageUri);
        setOdometerPhotoAttached(true);
      }
      if (draft.nhTollAmount) {
        setNhTollAmount(draft.nhTollAmount);
      } else if (draft.tollAmount) {
        setNhTollAmount(draft.tollAmount);
      }
      if (draft.niceRoadTollAmount) {
        setNiceRoadTollAmount(draft.niceRoadTollAmount);
      }
      if (draft.parkingAmount) {
        setParkingAmount(draft.parkingAmount);
      }
      if (draft.photoLocation) {
        setPhotoLocation(draft.photoLocation);
      }
      if (draft.ocrResultText) {
        setOcrResultText(draft.ocrResultText);
      }
    }
  }, [bookingId, booking?.id]);

  const runOdometerOcr = async (uriOrBase64: string) => {
    setOcrScanning(true);
    setOcrResultText({ status: 'idle' });
    try {
      const res = await driverApiClient.fetch('/api/driver/odometer/ocr', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: uriOrBase64 }),
      });
      if (res && res.success && res.reading) {
        setFinalOdometer(String(res.reading));
        const successOcr = {
          status: 'success' as const,
          reading: res.reading,
          message: t('complete_trip.auto_detected_km', { reading: res.reading }),
        };
        setOcrResultText(successOcr);
        const id = bookingId || booking?.id;
        if (id) {
          setTripCompletionDraft(id, {
            finalOdometer: String(res.reading),
            ocrResultText: successOcr,
          });
        }
      } else {
        setOcrResultText({
          status: 'failed',
          message: t('complete_trip.could_not_read_gauge'),
        });
      }
    } catch (err: any) {
      console.warn('Odometer OCR error:', err);
      setOcrResultText({
        status: 'failed',
        message: t('complete_trip.could_not_read_gauge'),
      });
    } finally {
      setOcrScanning(false);
    }
  };

  const handleOpenCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('complete_trip.permission_required'), t('complete_trip.camera_permission_msg'));
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
        const id = bookingId || booking?.id;
        if (id) {
          setTripCompletionDraft(id, {
            odometerImageUri: dataUri,
            photoLocation: locStamp,
          });
        }
      }
    } catch (err: any) {
      Alert.alert(t('complete_trip.camera_error'), err.message || t('complete_trip.failed_open_camera'));
    }
  };

  const handleFillDemo = () => {
    setOdometerImageUri('demo_odometer');
    setOdometerPhotoAttached(true);
    setFinalOdometer('42990');
    setError('');
    const id = bookingId || booking?.id;
    if (id) {
      setTripCompletionDraft(id, {
        odometerImageUri: 'demo_odometer',
        finalOdometer: '42990',
      });
    }
    Alert.alert('⚡ Demo Odometer Loaded', 'Final odometer photo and 42,990 KM loaded!');
  };

  const isOdometerComplete = Boolean(odometerImageUri && finalOdometer.trim());

  const baseBalance = parseFloat(booking?.balanceAmount) || 0;
  const parsedNhToll = parseFloat(nhTollAmount) || 0;
  const parsedNiceRoadToll = parseFloat(niceRoadTollAmount) || 0;
  const parsedParking = parseFloat(parkingAmount) || 0;
  const totalExtraCharges = parsedNhToll + parsedNiceRoadToll + parsedParking;
  const totalRemainingAmount = Math.max(0, Math.round(baseBalance + totalExtraCharges));

  const adminUpiId = process.env.EXPO_PUBLIC_ADMIN_UPI_ID || 'kandycabs@icici';
  const adminUpiName = process.env.EXPO_PUBLIC_ADMIN_UPI_NAME || 'Kandy Cabs';
  const upiPayUrl = `upi://pay?pa=${encodeURIComponent(adminUpiId)}&pn=${encodeURIComponent(adminUpiName)}&am=${totalRemainingAmount}&cu=INR&tn=${encodeURIComponent(`Booking ${booking?.humanReadableRef || 'Trip'}`)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(upiPayUrl)}`;

  const handleOpenPaymentModal = () => {
    if (!finalOdometer) {
      setError(t('complete_trip.enter_final_error', 'Please enter final odometer reading'));
      return;
    }
    if (!odometerImageUri) {
      setError(t('complete_trip.photo_mandatory_error', 'Final odometer photo is mandatory'));
      Alert.alert(
        t('complete_trip.photo_required_title', 'Photo Required'),
        t('complete_trip.photo_required_msg', 'Please capture a clear photo of the final odometer reading.'),
        [
          { text: t('complete_trip.capture_photo_btn', 'Capture Photo'), onPress: handleOpenCamera },
          { text: 'OK' },
        ]
      );
      return;
    }

    const startOdo = parseFloat(booking?.startingOdometer || 0);
    const endOdo = parseFloat(finalOdometer);

    if (startOdo > 0 && endOdo < startOdo) {
      setError(t('complete_trip.lower_odometer_error', `Final reading (${endOdo}) cannot be less than starting reading (${startOdo})`));
      return;
    }

    setError('');
    setPaymentError('');
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async (method: 'UPI_QR' | 'CASH') => {
    const endOdo = parseFloat(finalOdometer);
    const parsedNhTollVal = parseFloat(nhTollAmount) || 0;
    const parsedNiceRoadTollVal = parseFloat(niceRoadTollAmount) || 0;
    const parsedTollVal = parsedNhTollVal + parsedNiceRoadTollVal;
    const parsedParkingVal = parseFloat(parkingAmount) || 0;

    setLoading(true);
    setPaymentError('');

    try {
      // Capture exact driver GPS location at completion moment
      const latestCoords = locationTracker.getCurrentCoordinates();
      const actualLat = latestCoords.lat ?? currentCoords?.lat ?? photoLocation?.lat ?? booking?.dropLat;
      const actualLng = latestCoords.lng ?? currentCoords?.lng ?? photoLocation?.lng ?? booking?.dropLng;
      const actualAddress = await reverseGeocodeAddress(
        actualLat,
        actualLng,
        booking?.dropAddress
      );

      const bId = bookingId || booking?.id;
      const waitingState = bId ? getTripWaitingState(bId) : null;
      const totalWaitSeconds = waitingState?.totalAccumulatedSeconds || 0;
      const waitMins = Math.round(totalWaitSeconds / 60);

      const res = await driverApiClient.fetch('/api/driver/trip/complete', {
        method: 'POST',
        timeoutMs: 35000,
        body: JSON.stringify({
          bookingId: bId,
          finalOdometer: endOdo,
          finalOdometerImagePath: odometerImageUri,
          nhTollAmount: parsedNhTollVal,
          niceRoadTollAmount: parsedNiceRoadTollVal,
          tollAmount: parsedTollVal,
          parkingAmount: parsedParkingVal,
          paymentMethod: method,
          actualDropLat: actualLat,
          actualDropLng: actualLng,
          actualDropAddress: actualAddress,
          waitingMinutes: waitMins,
          waitingDurationSeconds: totalWaitSeconds,
          waitingSessions: waitingState?.sessions || [],
        }),
      } as any);

      if (res.success) {
        if (bId) {
          await setTripInProcess(bId, false);
          clearTripCompletionDraft(bId);
          clearTripWaitingState(bId);
        }
        await locationTracker.sendFinalTrackingPoint(bookingId || booking?.id);
        await locationTracker.stopTracking();

        setTripSuccess(true);
        setSuccessData({
          distance: res.actualDistanceKm ?? distanceCovered,
          totalAmount: totalRemainingAmount,
          paymentMethod: method,
        });
      } else {
        setPaymentError(res.message || 'Failed to complete trip. Please try again.');
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to complete trip. Please check your network and retry.');
    } finally {
      setLoading(false);
    }
  };

  const startOdoNum = parseFloat(booking?.startingOdometer) || 0;
  const endOdoNum = parseFloat(finalOdometer) || 0;
  const distanceCovered = endOdoNum > startOdoNum ? (endOdoNum - startOdoNum).toFixed(1) : '0.0';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* 6-Step Flow Header: 1. Verify (✓) -> 2. Start (✓) -> 3. Odometer (✓) -> 4. OTP (✓) -> 5. On Trip (✓) -> 6. Drop (Active) */}
      <TripFlowHeader currentStep={6} />

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

        {/* 1. Final Odometer Reading Card (Matching Pickup Odometer Design) */}
        <View style={styles.odoCard}>
          {/* Header */}
          <View style={styles.odoCardHeaderRow}>
            <View style={styles.odoHeaderLeft}>
              <View style={styles.odoHeaderIconCircle}>
                <Ionicons name="speedometer" size={16} color="#ffffff" />
              </View>
              <View style={styles.odoHeaderTextCol}>
                <Text style={styles.odoHeaderTitle}>
                  {t('trip_flow.final_odometer', 'Final Odometer Reading')} *
                </Text>
                <Text style={styles.odoHeaderSubtitle}>
                  {isOdometerComplete ? 'Final gauge & photo completed ✓' : 'Gauge photo & reading required'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.odoDemoBtn}
              onPress={handleFillDemo}
              activeOpacity={0.7}
            >
              <Ionicons name="flash" size={11} color="#ea580c" />
              <Text style={styles.odoDemoBtnText}>Demo</Text>
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
              onPress={handleOpenCamera}
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
                  {(photoLocation || currentCoords) && (
                    <View style={styles.gpsStamp}>
                      <Text style={styles.gpsStampText}>
                        📍 {photoLocation
                          ? `${photoLocation.lat.toFixed(4)}° N, ${photoLocation.lng.toFixed(4)}° E • ${photoLocation.time}`
                          : `${currentCoords?.lat ? currentCoords.lat.toFixed(4) : '0.0000'}° N, ${currentCoords?.lng ? currentCoords.lng.toFixed(4) : '0.0000'}° E`}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.blankUploadContent}>
                  <View style={styles.blankCameraCircle}>
                    <Ionicons name="camera" size={32} color="#0284c7" />
                  </View>
                  <Text style={styles.blankUploadTitle}>Upload Final Odometer Photo</Text>
                  <Text style={styles.blankUploadSubtitle}>Tap to open camera & capture photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Reference Guide Image */}
            <View style={styles.referenceSection}>
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
            <View style={styles.odoInputWrapper}>
              <View style={styles.odoInputContainer}>
                <Ionicons name="speedometer-outline" size={18} color="#6366f1" style={styles.odoInputIcon} />
                <TextInput
                  style={styles.odoTextInput}
                  value={finalOdometer}
                  onChangeText={(val) => {
                    setFinalOdometer(val);
                    setError('');
                    const id = bookingId || booking?.id;
                    if (id) setTripCompletionDraft(id, { finalOdometer: val });
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Enter final km (e.g. 45310 KM)"
                  placeholderTextColor="#94a3b8"
                  maxLength={10}
                />
                {finalOdometer ? (
                  <TouchableOpacity
                    onPress={() => {
                      setFinalOdometer('');
                      const id = bookingId || booking?.id;
                      if (id) setTripCompletionDraft(id, { finalOdometer: '' });
                    }}
                    style={styles.odoClearBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* OCR Feedback */}
              {ocrScanning ? (
                <View style={styles.odoOcrLoadingRow}>
                  <ActivityIndicator size="small" color="#6366f1" style={{ marginRight: 6 }} />
                  <Text style={styles.odoOcrLoadingText}>Auto-detecting odometer reading...</Text>
                </View>
              ) : ocrResultText.status === 'success' ? (
                <View style={styles.odoOcrSuccessRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginRight: 5 }} />
                  <Text style={styles.odoOcrSuccessText}>{ocrResultText.message}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* 2. Extra Charges: NH Toll, Nice Road Toll & Parking */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.walletIconCircle}>
              <Ionicons name="card" size={20} color="#475569" />
            </View>
            <View style={styles.cardHeaderTextCol}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>{t('trip_flow.additional_charges', 'Additional Charges')}</Text>
              </View>
            </View>
          </View>

          {/* Row 1: NH Toll & Nice Road Toll */}
          <View style={styles.extraChargesRow}>
            {/* NH Toll Box */}
            <View style={styles.chargeBox}>
              <View style={styles.chargeHeaderRow}>
                <Ionicons name="business" size={16} color="#475569" />
                <Text style={styles.chargeLabel}>{t('trip_flow.nh_toll_fare', 'NH Toll (₹)')}</Text>
              </View>
              <TextInput
                style={styles.chargeInput}
                value={nhTollAmount}
                onChangeText={(val) => {
                  setNhTollAmount(val);
                  const id = bookingId || booking?.id;
                  if (id) setTripCompletionDraft(id, { nhTollAmount: val });
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#64748b"
              />
            </View>

            {/* Nice Road Toll Box */}
            <View style={styles.chargeBox}>
              <View style={styles.chargeHeaderRow}>
                <Ionicons name="git-merge" size={16} color="#475569" />
                <Text style={styles.chargeLabel}>{t('trip_flow.nice_road_toll_fare', 'Nice Road Toll (₹)')}</Text>
              </View>
              <TextInput
                style={styles.chargeInput}
                value={niceRoadTollAmount}
                onChangeText={(val) => {
                  setNiceRoadTollAmount(val);
                  const id = bookingId || booking?.id;
                  if (id) setTripCompletionDraft(id, { niceRoadTollAmount: val });
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#64748b"
              />
            </View>
          </View>

          {/* Row 2: Parking Fare & Total Extra Summary */}
          <View style={[styles.extraChargesRow, { marginTop: 8 }]}>
            {/* Parking Fare Box */}
            <View style={styles.chargeBox}>
              <View style={styles.chargeHeaderRow}>
                <MaterialCommunityIcons name="parking" size={16} color="#475569" />
                <Text style={styles.chargeLabel}>{t('trip_flow.parking_fare', 'Parking (₹)')}</Text>
              </View>
              <TextInput
                style={styles.chargeInput}
                value={parkingAmount}
                onChangeText={(val) => {
                  setParkingAmount(val);
                  const id = bookingId || booking?.id;
                  if (id) setTripCompletionDraft(id, { parkingAmount: val });
                }}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#64748b"
              />
            </View>

            {/* Total Additional Charges Summary Box */}
            <View style={styles.chargeBox}>
              <View style={styles.chargeHeaderRow}>
                <Ionicons name="calculator" size={16} color="#475569" />
                <Text style={styles.chargeLabel}>Total Extra</Text>
              </View>
              <View style={styles.totalExtraDisplayBox}>
                <Text style={styles.totalExtraAmount}>
                  ₹{totalExtraCharges.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Pinned Bottom Complete CTA Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[
            styles.yellowPrimaryButton,
            odometerImageUri && finalOdometer ? styles.yellowPrimaryButtonReady : null,
            loading && styles.completeButtonDisabled,
          ]}
          onPress={odometerImageUri && finalOdometer ? handleOpenPaymentModal : (!odometerImageUri ? handleOpenCamera : handleOpenPaymentModal)}
          disabled={loading}
          activeOpacity={0.88}
        >
          {odometerImageUri && finalOdometer ? (
            <LinearGradient
              colors={['#009669', '#008760', '#007c5a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.readyGradient}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <View style={styles.centerBtnRow}>
                  <Text style={[styles.yellowPrimaryButtonText, styles.yellowPrimaryButtonTextReady]} numberOfLines={1}>
                    End Trip
                  </Text>
                  <Ionicons name="arrow-forward" size={19} color="#ffffff" style={{ marginLeft: 8 }} />
                </View>
              )}
            </LinearGradient>
          ) : loading ? (
            <ActivityIndicator color="#0f172a" size="small" />
          ) : !odometerImageUri ? (
            <View style={styles.centerBtnRow}>
              <Text style={styles.yellowPrimaryButtonText} numberOfLines={1}>
                {t('complete_trip.open_camera_odometer', 'Capture Odometer Photo')}
              </Text>
              <Ionicons name="camera" size={19} color="#0f172a" style={{ marginLeft: 8 }} />
            </View>
          ) : (
            <View style={styles.centerBtnRow}>
              <Text style={styles.yellowPrimaryButtonText} numberOfLines={1}>
                {t('complete_trip.enter_final_reading', 'Enter Final Reading')}
              </Text>
              <Ionicons name="arrow-forward" size={19} color="#0f172a" style={{ marginLeft: 8 }} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Remaining Payment Options Modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!loading && !tripSuccess) setShowPaymentModal(false);
        }}
      >
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            {tripSuccess ? (
              /* Success Receipt State */
              <View style={styles.successContentBox}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-circle" size={72} color="#16a34a" />
                </View>

                <Text style={styles.successMainTitle}>Trip Completed!</Text>
                <Text style={styles.successSubtitle}>
                  Booking #{booking?.humanReadableRef || 'TRIP'}
                </Text>

                <View style={styles.receiptCard}>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Total Distance</Text>
                    <Text style={styles.receiptValue}>{successData?.distance} KM</Text>
                  </View>
                  <View style={styles.receiptDivider} />
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Remaining Payment</Text>
                    <Text style={[styles.receiptValue, { color: '#16a34a', fontWeight: '800' }]}>
                      ₹{successData?.totalAmount}
                    </Text>
                  </View>
                  <View style={styles.receiptDivider} />
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Payment Method</Text>
                    <View style={styles.methodBadge}>
                      {successData?.paymentMethod === 'UPI_QR' ? (
                        <Ionicons
                          name="qr-code-outline"
                          size={14}
                          color="#0f172a"
                        />
                      ) : (
                        <Image
                          source={CASH_RUPEE_ICON}
                          style={styles.receiptCashIcon}
                          resizeMode="contain"
                        />
                      )}
                      <Text style={styles.methodBadgeText}>
                        {successData?.paymentMethod === 'UPI_QR' ? 'Admin UPI QR' : 'Cash Collected'}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.dashboardReturnBtn}
                  onPress={() => router.replace('/dashboard')}
                  activeOpacity={0.88}
                >
                  <Text style={styles.dashboardReturnBtnText}>Back to Dashboard</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              /* Payment Options Selection & Confirmation State */
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
                {/* Modal Header */}
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalHeaderTitleRow}>
                    <Text style={styles.modalTitle}>Remaining Payment</Text>
                    <View style={styles.bookingRefPill}>
                      <Text style={styles.bookingRefPillText}>#{booking?.humanReadableRef || 'TRIP'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => !loading && setShowPaymentModal(false)}
                    disabled={loading}
                  >
                    <Ionicons name="close" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {paymentError ? (
                  <View style={styles.modalErrorBox}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.modalErrorText}>{paymentError}</Text>
                  </View>
                ) : null}

                {/* Payment Option Selector Tabs */}
                <Text style={styles.sectionHeaderTitle}>SELECT PAYMENT METHOD</Text>
                <View style={styles.paymentTabsRow}>
                  <TouchableOpacity
                    style={[
                      styles.paymentTabBtn,
                      selectedPaymentMethod === 'UPI_QR' ? styles.paymentTabBtnActive : null,
                    ]}
                    onPress={() => setSelectedPaymentMethod('UPI_QR')}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={20}
                      color={selectedPaymentMethod === 'UPI_QR' ? '#008860' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.paymentTabText,
                        selectedPaymentMethod === 'UPI_QR' ? styles.paymentTabTextActive : null,
                      ]}
                    >
                      Admin UPI QR
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.paymentTabBtn,
                      selectedPaymentMethod === 'CASH' ? styles.paymentTabBtnActive : null,
                    ]}
                    onPress={() => setSelectedPaymentMethod('CASH')}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={CASH_RUPEE_ICON}
                      style={[
                        styles.cashTabIcon,
                        { tintColor: selectedPaymentMethod === 'CASH' ? '#008860' : '#64748b' },
                      ]}
                      resizeMode="contain"
                    />
                    <Text
                      style={[
                        styles.paymentTabText,
                        selectedPaymentMethod === 'CASH' ? styles.paymentTabTextActive : null,
                      ]}
                    >
                      Cash Collected
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* TAB 1: ADMIN UPI QR CODE */}
                {selectedPaymentMethod === 'UPI_QR' ? (
                  <View style={styles.qrContentCard}>
                    <Text style={styles.qrHeaderTitle}>Scan & Pay to Admin</Text>

                    {/* QR Code Container */}
                    <View style={styles.qrCodeWrapper}>
                      <Image
                        source={{ uri: qrCodeUrl }}
                        style={styles.qrCodeImage}
                        resizeMode="contain"
                      />
                      <View style={styles.qrAmountTag}>
                        <Text style={styles.qrAmountTagText}>Amount: ₹{totalRemainingAmount}</Text>
                      </View>
                    </View>

                    {/* Accepted UPI Apps Row */}
                    <View style={styles.upiBadgesRow}>
                      <View style={styles.upiBadgePill}><Text style={styles.upiBadgeText}>GPay</Text></View>
                      <View style={styles.upiBadgePill}><Text style={styles.upiBadgeText}>PhonePe</Text></View>
                      <View style={styles.upiBadgePill}><Text style={styles.upiBadgeText}>Paytm</Text></View>
                      <View style={styles.upiBadgePill}><Text style={styles.upiBadgeText}>BHIM</Text></View>
                      <View style={styles.upiBadgePill}><Text style={styles.upiBadgeText}>Any UPI</Text></View>
                    </View>

                    {/* Admin UPI ID Box */}
                    <View style={styles.upiIdCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.upiIdLabel}>ADMIN UPI ID</Text>
                        <Text style={styles.upiIdText} selectable>{adminUpiId}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.copyBtn}
                        onPress={() => {
                          setCopiedUpi(true);
                          setTimeout(() => setCopiedUpi(false), 2500);
                        }}
                      >
                        <Ionicons
                          name={copiedUpi ? 'checkmark-circle' : 'copy-outline'}
                          size={16}
                          color={copiedUpi ? '#16a34a' : '#2563eb'}
                        />
                        <Text style={[styles.copyBtnText, copiedUpi && { color: '#16a34a' }]}>
                          {copiedUpi ? 'Verified' : 'Verify ID'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* QR Payment Confirmation Button */}
                    <TouchableOpacity
                      style={[styles.confirmPaymentBtn, loading && styles.completeButtonDisabled]}
                      onPress={() => handleConfirmPayment('UPI_QR')}
                      disabled={loading}
                      activeOpacity={0.88}
                    >
                      {loading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                          <Text style={styles.confirmPaymentBtnText}>
                            Confirm QR Payment Received
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* TAB 2: CASH COLLECTED BY DRIVER */
                  <View style={styles.cashContentCard}>
                    <View style={styles.cashIconCircle}>
                      <Image
                        source={CASH_RUPEE_ICON}
                        style={styles.cashCardLargeIcon}
                        resizeMode="contain"
                      />
                    </View>

                    <Text style={styles.cashHeaderTitle}>Cash Collection by Driver</Text>
                    <Text style={styles.cashAmountDisplay}>₹{totalRemainingAmount}</Text>

                    <View style={styles.cashInstructionsBox}>
                      <View style={styles.bulletRow}>
                        <Ionicons name="checkbox-outline" size={18} color="#16a34a" style={{ marginTop: 2 }} />
                        <Text style={styles.bulletText}>
                          Collect <Text style={{ fontWeight: '800', color: '#0f172a' }}>₹{totalRemainingAmount}</Text> in physical cash directly from the passenger.
                        </Text>
                      </View>
                      <View style={styles.bulletRow}>
                        <Ionicons name="shield-checkmark-outline" size={18} color="#2563eb" style={{ marginTop: 2 }} />
                        <Text style={styles.bulletText}>
                          This cash will be recorded against your driver account and settled in your weekly payout statement.
                        </Text>
                      </View>
                    </View>

                    {/* Cash Collection Confirmation Button */}
                    <TouchableOpacity
                      style={[styles.confirmCashBtn, loading && styles.completeButtonDisabled]}
                      onPress={() => handleConfirmPayment('CASH')}
                      disabled={loading}
                      activeOpacity={0.88}
                    >
                      {loading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="hand-right-outline" size={20} color="#ffffff" />
                          <Text style={styles.confirmPaymentBtnText}>
                            Confirm Cash Collected
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>
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
    height: 32,
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
  headerSubtitleText: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  headerRefCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  headerRefText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
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
  odoCard: {
    marginBottom: 10,
    paddingTop: 0,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  odoCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  odoHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  odoHeaderIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  odoHeaderTextCol: {
    flex: 1,
  },
  odoHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  odoHeaderSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  odoDemoBtn: {
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
  odoDemoBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ea580c',
  },
  viewfinderWrapper: {
    marginTop: 4,
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
  referenceSection: {
    marginTop: 8,
    marginBottom: 0,
  },
  referenceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  referenceHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  referenceImageBox: {
    height: 130,
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
  odoInputWrapper: {
    marginTop: 8,
  },
  odoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 42,
  },
  odoInputIcon: {
    marginRight: 8,
  },
  odoTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  odoClearBtn: {
    padding: 4,
  },
  odoOcrLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  odoOcrLoadingText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
  },
  odoOcrSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  odoOcrSuccessText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  speedometerIconCircle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletIconCircle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTextCol: {
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepCircleBlue: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1d63ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCirclePurple: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  redAsterisk: {
    color: '#ef4444',
    fontWeight: '900',
  },
  sectionSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
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
    backgroundColor: '#f0f7ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 14,
    height: 50,
    marginTop: 10,
  },
  odometerTextInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  odometerDividerV: {
    width: 1,
    height: 24,
    backgroundColor: '#bfdbfe',
    marginHorizontal: 10,
  },
  odometerKmBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  odometerKmText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d63ed',
  },
  odometerSampleContainer: {
    width: '100%',
    gap: 8,
    marginTop: 4,
  },
  sampleGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0f9ff',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  sampleGuideHeaderText: {
    fontSize: 10.5,
    color: '#0369a1',
    fontWeight: '700',
    flex: 1,
  },
  odometerSampleImageBox: {
    width: '100%',
    height: 135,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
  },
  odometerSampleImage: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  sampleBadgeOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sampleBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  centerCameraCircleOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -24 }, { translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  cameraPrimaryBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  cameraPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  preCaptureGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f0fdf9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  gpsLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  preCaptureGpsText: {
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  extraChargesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  chargeBox: {
    flex: 1,
  },
  tollChargeBox: {
    flex: 1,
  },
  parkingChargeBox: {
    flex: 1,
  },
  totalExtraDisplayBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
  },
  totalExtraAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  chargeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  parkingBadge: {
    backgroundColor: '#0284c7',
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkingBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  chargeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  chargeInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    height: 40,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  previewContainer: {
    alignItems: 'center',
    marginVertical: 6,
    width: '100%',
  },
  imageWrapper: {
    width: '100%',
    position: 'relative',
    borderRadius: 12,
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
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    shadowColor: '#007c5a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  readyGradient: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
  },
  centerBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  btnDividerLight: {
    width: 1.5,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 12,
  },
  yellowPrimaryButtonText: {
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  yellowPrimaryButtonTextReady: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  // --- Payment Modal Styles ---
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  bookingRefPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bookingRefPillText: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    gap: 6,
  },
  modalErrorText: {
    fontSize: 12.5,
    color: '#ef4444',
    flex: 1,
    fontWeight: '600',
  },
  amountDueCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  amountDueLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  amountDueValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#065f46',
  },
  amountBreakdownRow: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  amountBreakdownText: {
    fontSize: 11.5,
    color: '#047857',
    fontWeight: '600',
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  paymentTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  paymentTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  paymentTabBtnActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#008860',
  },
  paymentTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  paymentTabTextActive: {
    color: '#008860',
    fontWeight: '800',
  },
  cashTabIcon: {
    width: 20,
    height: 14,
  },
  qrContentCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    alignItems: 'center',
  },
  qrHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  qrHeaderDesc: {
    fontSize: 11.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  qrCodeWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 8,
  },
  qrCodeImage: {
    width: 185,
    height: 185,
    borderRadius: 6,
  },
  qrAmountTag: {
    marginTop: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  qrAmountTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065f46',
  },
  upiBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 10,
  },
  upiBadgePill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  upiBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  upiIdCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 12,
  },
  upiIdLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  upiIdText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  copyBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  confirmPaymentBtn: {
    width: '100%',
    backgroundColor: '#008860',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#008860',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmPaymentBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
  },
  cashContentCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    alignItems: 'center',
  },
  cashIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    borderWidth: 2,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cashCardLargeIcon: {
    width: 38,
    height: 25,
    tintColor: '#008860',
  },
  cashHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  cashAmountDisplay: {
    fontSize: 28,
    fontWeight: '900',
    color: '#008860',
    marginBottom: 12,
  },
  cashInstructionsBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
    lineHeight: 17,
  },
  confirmCashBtn: {
    width: '100%',
    backgroundColor: '#008860',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#008860',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  // Success Receipt State
  successContentBox: {
    padding: 28,
    alignItems: 'center',
  },
  successIconCircle: {
    marginBottom: 16,
  },
  successMainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 20,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 24,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  receiptLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  receiptValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  methodBadgeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  receiptCashIcon: {
    width: 16,
    height: 11,
    tintColor: '#0f172a',
  },
  dashboardReturnBtn: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dashboardReturnBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});

