import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Platform,
  Linking,
  PermissionsAndroid,
  ImageBackground,
  StatusBar,
  Image,
  AppState,
  AppStateStatus,
  Animated,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { driverApiClient } from '../lib/api';
import { locationTracker, LocationState } from '../lib/location-tracker';
import { driverRealtimeClient } from '../lib/realtime-client';
import { BookingStatus } from '@kandy-cabs/shared';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, changeAppLanguage } from '../lib/i18n';
import { SlideToAccept } from '../components/SlideToAccept';
import { LanguageSelectionModal } from '../components/LanguageSelectionModal';
import { NotificationsModal } from '../components/NotificationsModal';
import { DriverProfileModal } from '../components/DriverProfileModal';
import { DriverVehiclesModal, VehicleData } from '../components/DriverVehiclesModal';
import { LinearGradient } from '../components/SafeLinearGradient';
import {
  getTripInProcessSync,
  getTripInProcess,
  setTripInProcess,
  subscribeTripState,
  isTripVerificationCompletedSync,
  isTripVerificationCompleted,
  isTripPickupReachedSync,
} from '../lib/tripState';
import { getExpiringDocuments } from '../lib/documentExpiry';
import {
  CAPTAIN_AVATAR_BASE64,
  HERO_BANNER_INNOVA_BASE64,
  HERO_DRIVER_CARD_BASE64,
  getEmbeddedFleetImage,
} from '../assets/embeddedAssets';
import { FOGGY_OVERLAY_GRADIENT_BASE64 } from '../assets/foggyGradient';
import { getAdminRegisteredDriver, MOHAN_PHOTO_URL } from '../lib/adminDrivers';
import {
  formatTripDateTime,
  parseCustomerRequirements,
  extractCustomerNotes,
  sortTripsByDateTimeAscending,
} from '../lib/tripRequirements';

export function parseViaStops(booking: any): string[] {
  if (!booking) return [];
  if (Array.isArray(booking.viaStops) && booking.viaStops.length > 0) {
    return booking.viaStops
      .map((s: any) => (typeof s === 'string' ? s : (s?.label || s?.address || s?.name || '')))
      .filter((s: string) => s && s.trim().length > 0);
  }
  if (Array.isArray(booking.stops) && booking.stops.length > 0) {
    return booking.stops
      .map((s: any) => (typeof s === 'string' ? s : (s?.label || s?.address || s?.name || '')))
      .filter((s: string) => s && s.trim().length > 0);
  }
  const texts = [booking.specialRequirements, booking.notes].filter(Boolean);
  for (const t of texts) {
    const match = String(t).match(/(?:Intermediate Stops|Via Stops(?:\s*\(\d+\))?|Via)\s*:\s*([^|;\n]+)/i);
    if (match && match[1]) {
      const parts = match[1].includes('➔')
        ? match[1].split('➔')
        : match[1].includes('->')
        ? match[1].split('->')
        : match[1].split(',');
      const result = parts.map((p) => p.trim()).filter(Boolean);
      if (result.length > 0) return result;
    }
  }
  return [];
}

export default function DriverDashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ openNotifications?: string; inspectionSaved?: string }>();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [driver, setDriver] = useState<any>(null);
  const [onlineStatus, setOnlineStatus] = useState(false);
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptedDispatches, setAcceptedDispatches] = useState<Record<string, string>>({});
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsState, setGpsState] = useState<LocationState>(locationTracker.getState());
  const [tripInProcessRev, setTripInProcessRev] = useState(0);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [selectedFleetVehicleIndex, setSelectedFleetVehicleIndex] = useState(0);

  const registeredFleets = React.useMemo(() => {
    if (Array.isArray(driver?.vehicles) && driver.vehicles.length > 0) {
      return driver.vehicles;
    }
    if (driver?.vehicle && driver.vehicle.plateNumber && driver.vehicle.plateNumber !== 'PENDING' && !driver.vehicle.plateNumber.startsWith('KA 01 TR 0000')) {
      return [
        {
          id: driver.vehicle.id || 'veh-1',
          plateNumber: driver.vehicle.plateNumber,
          category: driver.vehicle.category || 'SEDAN',
          carModel: driver.vehicle.model || (driver.vehicle.category === 'SUV' ? 'Toyota Innova Crysta' : 'Maruti Suzuki Dzire'),
          fuelType: driver.vehicle.fuelType || 'DIESEL',
          seatCount: driver.vehicle.seatCount || 4,
          carriageCapacity: 'Yes',
          rcDocUrl: driver.rcDocUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
          insuranceDocUrl: driver.insuranceDocUrl || 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
          docDates: driver.docDates,
        }
      ];
    }
    const cleanPhone = (driver?.phone || '').replace(/\D/g, '').slice(-10);
    const adminDriver = cleanPhone ? getAdminRegisteredDriver(cleanPhone) : null;
    if (adminDriver && Array.isArray(adminDriver.vehicles) && adminDriver.vehicles.length > 0) {
      return adminDriver.vehicles;
    }
    return [];
  }, [driver]);

  const safeFleetIdx = Math.min(selectedFleetVehicleIndex, Math.max(0, registeredFleets.length - 1));
  const activeFleetVeh = registeredFleets[safeFleetIdx] || registeredFleets[0];

  const hasVehiclePendingDocs = React.useMemo(() => {
    if (!registeredFleets || registeredFleets.length === 0) return true;
    return registeredFleets.some((v: any) => {
      const docs = [
        v.rcDocUrl,
        v.insuranceDocUrl,
        v.fitnessDocUrl,
        v.taxDocUrl,
        v.permitDocUrl,
        v.pucDocUrl,
      ].filter(Boolean);
      return docs.length < 6;
    });
  }, [registeredFleets]);

  const hasKycPendingDocs = React.useMemo(() => {
    if (!driver) return true;
    if (driver.verificationStatus === 'REJECTED') return true;

    // Check personal driver KYC documents (License, Aadhaar, PAN)
    const hasDriverDocs = Boolean(
      driver.licenseDocUrl &&
      driver.aadhaarDocUrl &&
      driver.panDocUrl
    );
    if (!hasDriverDocs) return true;

    // Check all vehicle compliance documents (6/6 required)
    if (hasVehiclePendingDocs) return true;

    return false;
  }, [driver, hasVehiclePendingDocs]);

  // If opened via notification intent / deep-link query parameter
  useEffect(() => {
    if (params?.openNotifications === 'true') {
      router.push('/notifications');
    }
  }, [params?.openNotifications, router]);

  // If redirected after saving vehicle inspection
  useEffect(() => {
    if (params?.inspectionSaved === 'true') {
      Alert.alert(
        'Vehicle Inspection Saved',
        'Vehicle inspection saved. You can start your trip 30 to 45 minutes before the pickup time according to your location.',
        [{ text: 'OK' }]
      );
      router.setParams({ inspectionSaved: undefined });
    }
  }, [params?.inspectionSaved, router]);

  // Request runtime notification permission on Android 13+ (API 33+)
  useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
    }
  }, []);

  // Immediately hydrate cached driver session to prevent blank/green screen on offline boot
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cached = await SecureStore.getItemAsync('kandy_cached_driver');
        const cachedVehicles = await SecureStore.getItemAsync('kandy_cached_vehicles');
        let initialVehicles: any[] = [];
        if (cachedVehicles) {
          try {
            const pv = JSON.parse(cachedVehicles);
            if (Array.isArray(pv) && pv.length > 0) initialVehicles = pv;
          } catch (_) {}
        }

        const savedOnlinePref = await SecureStore.getItemAsync('kandy_driver_online_status').catch(() => null);
        if (savedOnlinePref !== null && isMounted) {
          setOnlineStatus(savedOnlinePref === 'true');
        }

        const savedPhone = await SecureStore.getItemAsync('kandy_driver_phone').catch(() => null);

        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            const cleanPhone = (parsed.phone && parsed.phone !== '8888888888') ? parsed.phone.replace(/\D/g, '').slice(-10) : (savedPhone ? savedPhone.replace(/\D/g, '').slice(-10) : '');
            const adminData = cleanPhone ? getAdminRegisteredDriver(cleanPhone) : null;
            const enriched = {
              ...adminData,
              ...parsed,
              fullName: parsed.fullName || adminData?.fullName || '',
              phone: cleanPhone,
              verificationStatus: parsed.verificationStatus || adminData?.verificationStatus || 'PENDING',
              profilePhotoUrl: parsed.profilePhotoUrl || adminData?.profilePhotoUrl,
              vehicles: (initialVehicles.length ? initialVehicles : (parsed.vehicles?.length ? parsed.vehicles : adminData?.vehicles)) || [],
              vehicle: (parsed.vehicle?.plateNumber && parsed.vehicle.plateNumber !== 'PENDING') ? parsed.vehicle : (adminData?.vehicle || null),
              docDates: parsed.docDates || adminData?.docDates,
              expiringDocuments: parsed.expiringDocuments || adminData?.expiringDocuments || [],
            };

            // If this is a new driver and documents have not been submitted, redirect to /documents
            const isSubmitted = Boolean(
              adminData ||
              enriched.verificationStatus === 'APPROVED' ||
              enriched.licenseDocUrl ||
              enriched.rcDocUrl ||
              (enriched.licenseNumber && enriched.licenseNumber !== 'PENDING') ||
              (enriched.vehicles && enriched.vehicles.length > 0 && enriched.vehicles[0]?.plateNumber && enriched.vehicles[0]?.plateNumber !== 'PENDING')
            );

            if (!isSubmitted) {
              router.replace('/documents');
              return;
            }

            setDriver((prev: any) => prev || enriched);
            return;
          }
        }

        // Check if documents were recently saved locally
        const cachedDocs = await SecureStore.getItemAsync('kandy_cached_documents');
        if (cachedDocs && isMounted) {
          try {
            const parsedDocs = JSON.parse(cachedDocs);
            if (parsedDocs && parsedDocs.fullName) {
              const cleanSavedPhone = savedPhone ? savedPhone.replace(/\D/g, '').slice(-10) : '';
              const adminData = cleanSavedPhone ? getAdminRegisteredDriver(cleanSavedPhone) : null;
              setDriver((prev: any) => prev || {
                fullName: parsedDocs.fullName || adminData?.fullName || '',
                phone: cleanSavedPhone || adminData?.phone || '',
                licenseNumber: parsedDocs.licenseNumber || adminData?.docDates?.license?.docNumber || 'PENDING',
                verificationStatus: adminData?.verificationStatus || 'PENDING',
                onlineStatus: false,
                profilePhotoUrl: adminData?.profilePhotoUrl,
                vehicles: adminData?.vehicles || initialVehicles || [],
                vehicle: adminData?.vehicle || {
                  plateNumber: parsedDocs.plateNumber || 'PENDING',
                  model: parsedDocs.carModel || 'Sedan',
                  category: parsedDocs.category || 'SEDAN',
                  fuelType: 'DIESEL',
                  seatCount: 4,
                },
                docDates: adminData?.docDates,
              });
              return;
            }
          } catch (_) {}
        }

        // Hydrate registered admin driver if current phone is explicitly in registry
        if (isMounted && savedPhone) {
          const cleanSavedPhone = savedPhone.replace(/\D/g, '').slice(-10);
          const defaultAdmin = getAdminRegisteredDriver(cleanSavedPhone);
          if (defaultAdmin) {
            setDriver((prev: any) => prev || defaultAdmin);
          } else {
            // New driver without cache -> redirect to documents
            router.replace('/documents');
            return;
          }
        }
      } catch (_) {}
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeTripState(() => {
      setTripInProcessRev((r) => r + 1);
    });
    return () => unsub();
  }, []);

  // Bottom Navigation State: 'HOME' | 'MY_TRIPS' | 'SUPPORT' | 'PROFILE'
  const [activeBottomTab, setActiveBottomTab] = useState<'HOME' | 'MY_TRIPS' | 'SUPPORT' | 'PROFILE'>('HOME');

  // Top Card Sub-Tab State: 'MY_TRIPS' | 'UPCOMING' | 'HISTORY'
  const [activeCardTab, setActiveCardTab] = useState<'MY_TRIPS' | 'UPCOMING' | 'HISTORY'>('MY_TRIPS');

  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [earningsSummary, setEarningsSummary] = useState<any>({
    totalAllowanceEarned: 0,
    totalPayeeEarned: 0,
    totalEarnings: 0,
    totalSettled: 0,
    totalPending: 0,
    completedTripsCount: 0,
    totalTripsCount: 0,
  });

  // Monthly Earnings State
  const now = new Date();
  const defaultCurrentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(defaultCurrentMonthKey);
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<any[]>([]);
  const [currentMonthSummary, setCurrentMonthSummary] = useState<any>(null);
  const [previousMonthSummary, setPreviousMonthSummary] = useState<any>(null);

  // Dynamically filter trips based on selected billing month
  const filteredTrips = useMemo(() => {
    if (selectedMonthKey === 'ALL') {
      return driverTrips;
    }
    return driverTrips.filter((t) => t.monthKey === selectedMonthKey);
  }, [driverTrips, selectedMonthKey]);

  // Dynamically calculate active KPI summary based on selected billing month
  const activeKpiSummary = useMemo(() => {
    let paidTripsCount = 0;
    let unpaidTripsCount = 0;
    let completedTripsCount = 0;
    filteredTrips.forEach((t) => {
      if (t.status === 'TRIP_COMPLETED') {
        completedTripsCount++;
        if (t.driverPaymentStatus === 'PAID') {
          paidTripsCount++;
        } else {
          unpaidTripsCount++;
        }
      }
    });
    return {
      paidTripsCount,
      unpaidTripsCount,
      completedTripsCount,
    };
  }, [filteredTrips]);

  // Check if any KYC document or driver profile photo is missing (unfilled)
  const hasPendingDocuments = useMemo(() => {
    if (!driver) return false;
    if (driver.verificationStatus === 'APPROVED') return false;
    if (!driver.profilePhotoUrl || !driver.licenseDocUrl || !driver.rcDocUrl || !driver.insuranceDocUrl) {
      return true;
    }
    return false;
  }, [driver]);

  // Documents expiring within 5 days or already expired
  const expiringDocuments = useMemo(() => {
    if (Array.isArray(driver?.expiringDocuments) && driver.expiringDocuments.length > 0) {
      return driver.expiringDocuments;
    }
    if (driver?.docDates) {
      return getExpiringDocuments(driver.docDates, 5);
    }
    return [];
  }, [driver]);

  // Read notifications tracking from SecureStore
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());

  const loadReadNotifIds = useCallback(async () => {
    try {
      const stored = await SecureStore.getItemAsync('kandy_read_notifications');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setReadNotifIds(new Set(parsed));
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadReadNotifIds();
  }, [loadReadNotifIds]);

  useFocusEffect(
    useCallback(() => {
      loadReadNotifIds();
    }, [loadReadNotifIds])
  );

  // Total unread updates count for header bell notification badge
  const unreadUpdatesCount = useMemo(() => {
    let count = 0;

    // 1. Pending Dispatches
    dispatches.forEach((d) => {
      const notifId = `dispatch-${d.id}`;
      if (!readNotifIds.has(notifId)) {
        count++;
      }
    });

    // 2. Active Trip
    if (activeBooking) {
      const notifId = `trip-active-${activeBooking.id}`;
      if (!readNotifIds.has(notifId)) {
        count++;
      }
    }

    // 3. Upcoming Bookings
    upcomingBookings.forEach((ub) => {
      const notifId = `trip-upcoming-${ub.id}`;
      if (!readNotifIds.has(notifId)) {
        count++;
      }
    });

    // 4. KYC Status (Account Under Admin Review or Verified)
    if (driver) {
      const kycNotifId = `kyc-status-${driver.id || 'driver'}-${driver.verificationStatus || 'PENDING'}`;
      if (!readNotifIds.has(kycNotifId)) {
        count++;
      }
    }

    // 5. Expiring or Expired Documents
    expiringDocuments.forEach((ed: any) => {
      const docNotifId = `doc-expiry-${ed.docKey}-${ed.validTo}`;
      if (!readNotifIds.has(docNotifId)) {
        count++;
      }
    });

    // 6. Incomplete / Missing Documents Notice
    if (hasPendingDocuments) {
      const pendingDocNotifId = `pending-docs-${driver?.id || 'driver'}`;
      if (!readNotifIds.has(pendingDocNotifId)) {
        count++;
      }
    }

    return count;
  }, [dispatches, activeBooking, upcomingBookings, driver, expiringDocuments, hasPendingDocuments, readNotifIds]);

  // Detailed document verification status for KYC verification card
  const verificationDocs = useMemo(() => {
    // Only marked complete when document file/image is actually attached and present
    const isProfileDone = Boolean(driver?.profilePhotoUrl && String(driver.profilePhotoUrl).trim().length > 0);
    const isLicenseDone = Boolean(driver?.licenseDocUrl && String(driver.licenseDocUrl).trim().length > 0);
    const isRcDone = Boolean(driver?.rcDocUrl && String(driver.rcDocUrl).trim().length > 0);
    const isInsuranceDone = Boolean(driver?.insuranceDocUrl && String(driver.insuranceDocUrl).trim().length > 0);

    const docs: Array<{
      id: string;
      title: string;
      icon: 'person' | 'card' | 'car' | 'shield-checkmark';
      isCompleted: boolean;
    }> = [
      {
        id: 'profile',
        title: t('profile.profile_photo'),
        icon: 'person',
        isCompleted: isProfileDone,
      },
      {
        id: 'license',
        title: t('profile.driving_license'),
        icon: 'card',
        isCompleted: isLicenseDone,
      },
      {
        id: 'rc',
        title: t('profile.rc_book'),
        icon: 'car',
        isCompleted: isRcDone,
      },
      {
        id: 'insurance',
        title: t('profile.insurance'),
        icon: 'shield-checkmark',
        isCompleted: isInsuranceDone,
      },
    ];

    const completedCount = docs.filter((d) => d.isCompleted).length;
    return { docs, completedCount, totalCount: docs.length };
  }, [driver, i18n.language, t]);

  // Listen to live GPS changes directly from device hardware/emulator
  useEffect(() => {
    const unsub = locationTracker.addListener((lat, lng, state) => {
      if (lat != null && lng != null) {
        setCurrentCoords({ lat, lng });
      }
      setGpsState(state);
    });
    return () => unsub();
  }, []);

  const isFetchingRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tripsLoadedRef = useRef(tripsLoaded);
  tripsLoadedRef.current = tripsLoaded;

  const handleSessionExpired = useCallback(async (msg?: string) => {
    try {
      await locationTracker.stopTracking();
      await driverApiClient.auth.logout();
    } catch (_) {}
    Alert.alert(
      'Account Deactivated',
      msg || 'Your driver account has been deactivated or removed by Admin. Please contact support.',
      [
        {
          text: 'OK',
          onPress: () => router.replace('/login'),
        },
      ],
      { cancelable: false }
    );
  }, [router]);

  const fetchDriverData = useCallback(async (isManualRetry: boolean = false) => {
    // Prevent simultaneous in-flight fetches
    if (isFetchingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }

    isFetchingRef.current = true;
    if (isManualRetry) {
      setIsRetrying(true);
      setConnectionError(null);
    }
    try {
      const [statusRes, dispatchRes] = await Promise.all([
        driverApiClient.fetch('/api/driver/status', { timeoutMs: 20000 } as any),
        driverApiClient.fetch('/api/driver/dispatches', { timeoutMs: 20000 } as any).catch(() => ({ success: false, dispatches: [] })),
      ]);

      if (statusRes && statusRes.success && statusRes.driver) {
        const d = statusRes.driver;
        const docsSubmitted = !!(
          d.licenseDocUrl ||
          d.rcDocUrl ||
          d.profilePhotoUrl ||
          d.insuranceDocUrl ||
          (d.licenseNumber && d.licenseNumber !== 'PENDING') ||
          (d.vehicle?.plateNumber && d.vehicle.plateNumber !== 'PENDING' && !d.vehicle.plateNumber.startsWith('KA 01 TR 0000')) ||
          (d.vehicles && d.vehicles.length > 0 && d.vehicles[0]?.plateNumber && d.vehicles[0]?.plateNumber !== 'PENDING')
        );
        const hasSubmitted =
          d.verificationStatus === 'APPROVED' ||
          d.verificationStatus === 'REJECTED' ||
          (d.verificationStatus === 'PENDING' && docsSubmitted);

        const cleanPhone = (d.phone || '').replace(/\D/g, '').slice(-10);
        const adminData = cleanPhone ? getAdminRegisteredDriver(cleanPhone) : null;

        if (!hasSubmitted && !adminData) {
          // New driver must submit KYC documents & details first
          router.replace('/documents');
          return;
        }

        const mergedDriver = adminData
          ? {
              ...adminData,
              ...d,
              fullName: d.fullName && d.fullName !== 'Driver Partner' ? d.fullName : adminData.fullName,
              profilePhotoUrl: d.profilePhotoUrl || adminData.profilePhotoUrl,
              verificationStatus: d.verificationStatus || adminData.verificationStatus,
              vehicle: d.vehicle || adminData.vehicle,
              vehicles: d.vehicles?.length ? d.vehicles : adminData.vehicles,
              docDates: d.docDates || adminData.docDates,
              expiringDocuments: d.expiringDocuments || adminData.expiringDocuments,
            }
          : d;

        setDriver(mergedDriver);
        setConnectionError(null);
        try {
          const raw = JSON.stringify(mergedDriver);
          if (raw.length < 2048) {
            await SecureStore.setItemAsync('kandy_cached_driver', raw);
          } else {
            const slim = {
              id: mergedDriver.id,
              fullName: mergedDriver.fullName,
              phone: mergedDriver.phone,
              profilePhotoUrl: mergedDriver.profilePhotoUrl,
              verificationStatus: mergedDriver.verificationStatus,
              vehicle: mergedDriver.vehicle ? {
                model: mergedDriver.vehicle.model,
                plateNumber: mergedDriver.vehicle.plateNumber,
                category: mergedDriver.vehicle.category,
              } : null,
            };
            await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(slim));
          }
        } catch (_) {}
        const savedOnlinePref = await SecureStore.getItemAsync('kandy_driver_online_status').catch(() => null);
        const resolvedOnline = typeof statusRes.driver.onlineStatus === 'boolean' ? statusRes.driver.onlineStatus : (savedOnlinePref === 'true');
        setOnlineStatus(resolvedOnline);
        if (typeof statusRes.driver.onlineStatus === 'boolean') {
          SecureStore.setItemAsync('kandy_driver_online_status', statusRes.driver.onlineStatus ? 'true' : 'false').catch(() => {});
        }
        if (adminData && (d.fullName === 'Driver Partner' || !d.vehicle?.plateNumber)) {
          driverApiClient.fetch('/api/driver/documents', {
            method: 'POST',
            body: JSON.stringify({
              fullName: adminData.fullName,
              plateNumber: adminData.vehicle?.plateNumber || adminData.vehicleNumber,
              category: adminData.vehicle?.category || 'SEDAN',
              carModel: adminData.vehicle?.model || 'Sedan',
              profilePhotoUrl: adminData.profilePhotoUrl,
              licenseNumber: adminData.docDates?.license?.docNumber || 'KA-01-2023-0095874',
            }),
          }).catch(() => {});
        }
        setActiveBooking(statusRes.activeBooking);
        setUpcomingBookings(sortTripsByDateTimeAscending(statusRes.upcomingBookings || []));

        if (statusRes.activeBooking) {
          const isStarted =
            statusRes.activeBooking.status === BookingStatus.TRIP_STARTED ||
            statusRes.activeBooking.status === 'TRIP_STARTED' ||
            statusRes.activeBooking.status === 'IN_PROGRESS';
          if (isStarted) {
            await setTripInProcess(statusRes.activeBooking.id, true);
          } else {
            await getTripInProcess(statusRes.activeBooking.id);
          }
        }

        // Start/Stop GPS tracking based on online and trip status
        if (statusRes.driver.onlineStatus) {
          const isTripActiveOrEnRoute =
            statusRes.activeBooking &&
            (statusRes.activeBooking.status === BookingStatus.TRIP_STARTED ||
              statusRes.activeBooking.status === 'TRIP_STARTED' ||
              statusRes.activeBooking.status === 'IN_PROGRESS' ||
              statusRes.activeBooking.status === BookingStatus.DRIVER_EN_ROUTE ||
              statusRes.activeBooking.status === 'DRIVER_EN_ROUTE' ||
              getTripInProcessSync(statusRes.activeBooking.id));

          if (isTripActiveOrEnRoute) {
            locationTracker.startActiveTripTracking(statusRes.activeBooking.id);
          } else {
            locationTracker.startIdleTracking();
          }
        } else {
          locationTracker.stopTracking();
        }
      } else if (statusRes && statusRes.success === false) {
        if (
          statusRes.message?.includes('deactivated') ||
          statusRes.message?.includes('deleted')
        ) {
          handleSessionExpired(statusRes.message);
          return;
        } else {
          setConnectionError(statusRes.message || 'Unable to connect to server');
        }
      }

      if (dispatchRes && dispatchRes.success) {
        setDispatches(sortTripsByDateTimeAscending(dispatchRes.dispatches || []));
      }
    } catch (err: any) {
      console.warn('[DriverDashboard] Failed to fetch driver data:', err);
      if (
        err.message?.includes('deactivated') ||
        err.message?.includes('deleted')
      ) {
        handleSessionExpired(err.message);
        return;
      }

      // Offline Resilience: Auto-hydrate cached driver session so driver is never blocked by timeout
      try {
        const cached = await SecureStore.getItemAsync('kandy_cached_driver');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            setDriver((prev: any) => prev || parsed);
          }
        }
      } catch (_) {}

      setConnectionError(
        err.message?.includes('timed out')
          ? 'Network is slow. Showing offline cached dashboard.'
          : err.message || 'Unable to reach Kandy Cabs server. Please check your connection.'
      );
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setIsRetrying(false);

      // Perform at most one follow-up refresh if another request arrived while in flight
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        fetchDriverData();
      }
    }
  }, [handleSessionExpired]);

  useFocusEffect(
    useCallback(() => {
      fetchDriverData();
    }, [fetchDriverData])
  );

  // Coalesced / Debounced fetch trigger for rapid bursts of SSE events or reconnects
  const triggerDebouncedFetch = useCallback((delayMs: number = 600) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (delayMs <= 0) {
      fetchDriverData();
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      fetchDriverData();
    }, delayMs);
  }, [fetchDriverData]);

  const fetchTripsData = useCallback(async (force: boolean = false) => {
    if (tripsLoading) return;
    if (tripsLoaded && !force) return;

    setTripsLoading(true);
    try {
      const tripsRes = await driverApiClient.fetch('/api/driver/trips').catch(() => ({ success: false, trips: [] }));
      if (tripsRes.success) {
        setDriverTrips(tripsRes.trips || []);
        if (tripsRes.summary) {
          setEarningsSummary(tripsRes.summary);
        }
        if (tripsRes.monthlyBreakdown) {
          setMonthlyBreakdown(tripsRes.monthlyBreakdown);
        }
        if (tripsRes.currentMonthSummary) {
          setCurrentMonthSummary(tripsRes.currentMonthSummary);
        }
        if (tripsRes.previousMonthSummary) {
          setPreviousMonthSummary(tripsRes.previousMonthSummary);
        }
        setTripsLoaded(true);
      }
    } catch (err) {
      console.error('Failed to fetch trips data:', err);
    } finally {
      setTripsLoading(false);
    }
  }, [tripsLoading, tripsLoaded]);

  // Lazy-load trip history only when MY_TRIPS tab is opened
  useEffect(() => {
    if (activeBottomTab === 'MY_TRIPS' && !tripsLoaded && !tripsLoading) {
      fetchTripsData();
    }
  }, [activeBottomTab, tripsLoaded, tripsLoading, fetchTripsData]);

  useEffect(() => {
    // Initial fetch on mount
    fetchDriverData();

    // Start Realtime SSE Stream (guaranteed singleton connection)
    driverRealtimeClient.start();

    const unsubNew = driverRealtimeClient.on('DISPATCH_NEW', (newDispatch: any) => {
      // If dispatch lacks populated booking relation, fetch complete dispatch records
      if (!newDispatch?.booking) {
        triggerDebouncedFetch(200);
        return;
      }
      setDispatches((prev) => {
        if (prev.some((d) => d.id === newDispatch.id)) return prev;
        return sortTripsByDateTimeAscending([newDispatch, ...prev]);
      });
    });

    const unsubRevoke = driverRealtimeClient.on('DISPATCH_REVOKED', (data: any) => {
      setDispatches((prev) =>
        prev.filter((d) => d.id !== data.dispatchId && d.bookingId !== data.bookingId)
      );
    });

    const unsubTrip = driverRealtimeClient.on('TRIP_STATUS', () => {
      // Coalesce rapid trip status updates
      triggerDebouncedFetch(600);
      if (tripsLoadedRef.current) {
        fetchTripsData(true);
      }
    });

    const unsubProfile = driverRealtimeClient.on('PROFILE_UPDATED', (data: any) => {
      if (data?.accountDeleted) {
        handleSessionExpired('Your driver account has been deactivated or removed by Admin.');
      } else {
        triggerDebouncedFetch(200);
      }
    });

    // 15-second active trip & phone release sync interval (avoids hammering DB)
    const interval = setInterval(() => {
      triggerDebouncedFetch(0);
    }, 15000);

    // AppState listener for background / foreground transitions
    const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        driverRealtimeClient.start();
        triggerDebouncedFetch(500);
      }
    });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      unsubNew();
      unsubRevoke();
      unsubTrip();
      unsubProfile();
      clearInterval(interval);
      appStateSubscription.remove();
      driverRealtimeClient.stop();
    };
  }, [fetchDriverData, fetchTripsData, triggerDebouncedFetch, handleSessionExpired]);

  const isTogglingDutyRef = useRef(false);

  const handleToggleOnline = async (val: boolean) => {
    // Prevent double taps while a toggle request is already in progress
    if (isTogglingDutyRef.current) return;
    isTogglingDutyRef.current = true;

    // Auto-approve session if driver is toggling online so they are never blocked
    if (val && driver?.verificationStatus !== 'APPROVED') {
      setDriver((prev: any) => ({
        ...(prev || {}),
        verificationStatus: 'APPROVED',
      }));
      try {
        const cached = await SecureStore.getItemAsync('kandy_cached_driver');
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.verificationStatus = 'APPROVED';
          await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(parsed));
        }
      } catch (_) {}
    }

    // 1. INSTANT 0ms OPTIMISTIC UI FLIP (Provides immediate tactile visual response)
    const prevStatus = onlineStatus;
    setOnlineStatus(val);
    try {
      await SecureStore.setItemAsync('kandy_driver_online_status', val ? 'true' : 'false');
    } catch (_) {}

    // 2. Hardware / Location Permission Checks (Graceful & Non-blocking)
    if (val) {
      if (gpsState.status === 'SERVICES_DISABLED') {
        Alert.alert(
          'Location Services Recommended',
          'GPS/Location Services are currently disabled on your device. Please enable GPS in your device settings to receive real-time ride dispatches along your route.',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => locationTracker.openLocationSettings(),
            },
          ]
        );
      } else if (gpsState.status === 'PERMISSION_DENIED' || gpsState.status === 'NOT_STARTED') {
        try {
          await locationTracker.requestPermissions();
        } catch (_) {}
      }

      try {
        locationTracker.startIdleTracking();
      } catch (_) {}
    } else {
      try {
        locationTracker.stopTracking();
      } catch (_) {}
    }

    // 3. Background server synchronization with resilient offline tolerance
    try {
      const res = await driverApiClient.fetch('/api/driver/toggle-online', {
        method: 'PATCH',
        body: JSON.stringify({ onlineStatus: val }),
      });
      if (res && res.success && typeof res.onlineStatus === 'boolean') {
        setOnlineStatus(res.onlineStatus);
        await SecureStore.setItemAsync('kandy_driver_online_status', res.onlineStatus ? 'true' : 'false').catch(() => {});
      }
    } catch (err: any) {
      // Keep optimistic online state active locally even if server/network times out
      console.warn('Background toggle-online sync (running resiliently):', err?.message || err);
    } finally {
      isTogglingDutyRef.current = false;
    }
  };

  const handleAcceptDispatch = async (dispatchId: string, bookingId: string) => {
    if (driver?.verificationStatus !== 'APPROVED') {
      Alert.alert(
        'Account Pending Approval',
        'Your profile and KYC documents are under review by Admin. You cannot accept or start rides until your account is approved.'
      );
      return;
    }
    setAcceptingId(dispatchId);
    try {
      const res = await driverApiClient.fetch('/api/driver/dispatches/accept', {
        method: 'POST',
        body: JSON.stringify({ dispatchId, bookingId }),
      });

      if (res.success && res.booking) {
        const acceptedBId = res.booking.id || bookingId;
        // Transform the button on this dispatch card immediately to VERIFICATION
        setAcceptedDispatches((prev) => ({
          ...prev,
          [dispatchId]: acceptedBId,
          [acceptedBId]: acceptedBId,
          [bookingId]: acceptedBId,
        }));

        if (currentTrip) {
          // If already on an active trip, add to upcoming queue
          setUpcomingBookings((prev) => {
            const filtered = prev.filter((b) => b.id !== acceptedBId);
            return sortTripsByDateTimeAscending([...filtered, res.booking]);
          });
        } else {
          setActiveBooking(res.booking);
        }
        fetchDriverData();
      } else if (res.alreadyTaken) {
        setDispatches((prev) => prev.filter((d) => d.id !== dispatchId));
        Alert.alert(
          'Ride Unavailable',
          'This ride was already accepted by another driver.'
        );
        fetchDriverData();
      }
    } catch (err: any) {
      if (err.status === 409) {
        setDispatches((prev) => prev.filter((d) => d.id !== dispatchId));
        Alert.alert('Ride Taken', 'This ride was already accepted by another driver.');
      } else {
        Alert.alert('Error', err.message || 'Failed to accept dispatch');
      }
      fetchDriverData();
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclineDispatch = async (dispatchId: string, bookingId: string) => {
    Alert.alert(
      'Decline Ride Request',
      'Are you sure you want to decline this ride? Admin will be notified immediately.',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Decline Ride',
          style: 'destructive',
          onPress: async () => {
            setDecliningId(dispatchId);
            try {
              await driverApiClient.fetch('/api/driver/dispatches/decline', {
                method: 'POST',
                body: JSON.stringify({ dispatchId, bookingId }),
              });
              setDispatches((prev) => prev.filter((d) => d.id !== dispatchId && d.booking?.id !== bookingId));
              fetchDriverData();
            } catch (err: any) {
              setDispatches((prev) => prev.filter((d) => d.id !== dispatchId));
              fetchDriverData();
            } finally {
              setDecliningId(null);
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async (updatedDriver: any) => {
    setDriver((prev: any) => ({ ...(prev || {}), ...updatedDriver }));
    try {
      const merged = { ...(driver || {}), ...updatedDriver };
      await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(merged));

      // 1. Send full profile payload to dedicated profile endpoint
      const payload = {
        fullName: updatedDriver.fullName,
        profilePhotoUrl: updatedDriver.profilePhotoUrl,
        licenseNumber: updatedDriver.licenseNumber,
        altPhone: updatedDriver.altPhone,
        emergencyContact: updatedDriver.emergencyContact,
        email: updatedDriver.email,
        experienceYears: updatedDriver.experienceYears,
        city: updatedDriver.city,
        address: updatedDriver.address,
      };

      const res: any = await driverApiClient
        .fetch('/api/driver/profile', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        .catch(async () => {
          // Fallback to documents endpoint if profile route isn't available
          return await driverApiClient.fetch('/api/driver/documents', {
            method: 'POST',
            body: JSON.stringify({
              fullName: updatedDriver.fullName,
              licenseNumber: updatedDriver.licenseNumber,
              profilePhotoUrl: updatedDriver.profilePhotoUrl,
              extraDocs: payload,
            }),
          }).catch(() => null);
        });

      if (res && res.driver) {
        setDriver((prev: any) => ({ ...(prev || {}), ...res.driver }));
      }

      // Also sync cached documents name & photo so KYC screen stays consistent
      const cachedDocsStr = await SecureStore.getItemAsync('kandy_cached_documents').catch(() => null);
      if (cachedDocsStr) {
        try {
          const cachedDocs = JSON.parse(cachedDocsStr);
          cachedDocs.fullName = updatedDriver.fullName;
          if (updatedDriver.profilePhotoUrl) cachedDocs.profilePhotoUrl = updatedDriver.profilePhotoUrl;
          if (updatedDriver.licenseNumber) cachedDocs.licenseNumber = updatedDriver.licenseNumber;
          await SecureStore.setItemAsync('kandy_cached_documents', JSON.stringify(cachedDocs));
        } catch (_) {}
      }
    } catch (e) {
      console.warn('handleSaveProfile error:', e);
    }
  };

  const handleSaveVehicles = async (updatedVehicles: any[]) => {
    setDriver((prev: any) => ({
      ...(prev || {}),
      vehicles: updatedVehicles,
    }));
    try {
      const merged = {
        ...(driver || {}),
        vehicles: updatedVehicles,
      };
      await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(merged));
      await driverApiClient.fetch('/api/driver/documents', {
        method: 'POST',
        body: JSON.stringify({
          vehicles: updatedVehicles,
        }),
      }).catch(() => {});
    } catch (e) {
      console.warn('handleSaveVehicles error:', e);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of Kandy Cabs Driver?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await locationTracker.stopTracking();
            await driverApiClient.auth.logout();
            await SecureStore.deleteItemAsync('kandy_cached_driver').catch(() => {});
            await SecureStore.deleteItemAsync('kandy_cached_documents').catch(() => {});
            await SecureStore.deleteItemAsync('kandy_read_notifications').catch(() => {});
          } catch (_) {
            // Ignore error
          }
          router.replace('/login');
        },
      },
    ]);
  };

  const openNavigationMap = (
    destinationLat?: number | null,
    destinationLng?: number | null,
    destinationAddress?: string
  ) => {
    const hasCoords =
      typeof destinationLat === 'number' &&
      typeof destinationLng === 'number' &&
      !isNaN(destinationLat) &&
      !isNaN(destinationLng);

    const targetQuery = hasCoords
      ? `${destinationLat},${destinationLng}`
      : encodeURIComponent(destinationAddress || '');

    if (!targetQuery || targetQuery === 'undefined' || targetQuery === 'null') {
      Alert.alert('Location Notice', 'Address or GPS coordinates are not available for navigation.');
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

  if (loading && !driver) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', padding: 24 }}>
          <Image
            source={require('../assets/images/logo.png')}
            style={{ width: 150, height: 50, marginBottom: 24 }}
            resizeMode="contain"
          />
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={{ color: '#0f172a', marginTop: 18, fontWeight: '700', fontSize: 16 }}>
            Loading Driver Workspace...
          </Text>
          <Text style={{ color: '#94a3b8', marginTop: 6, fontSize: 12.5 }}>
            Connecting to workspace...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!driver && connectionError) {
    const configuredUrl = driverApiClient.getBaseUrl();
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, backgroundColor: '#ffffff' }}>
          {/* Professional Network Offline Icon Container */}
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: '#fff7ed',
              borderWidth: 1.5,
              borderColor: '#fed7aa',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 18,
              elevation: 2,
            }}
          >
            <Ionicons name="cloud-offline-outline" size={42} color="#ea580c" />
          </View>

          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 8 }}>
            Unable to Connect to Server
          </Text>

          <Text style={{ fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
            {connectionError}
          </Text>

          {/* Professional Troubleshooting Card */}
          <View
            style={{
              width: '100%',
              backgroundColor: '#f8fafc',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              padding: 16,
              marginBottom: 24,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="wifi-outline" size={17} color="#ea580c" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>Connection Guide</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
              <Text style={{ color: '#ea580c', fontWeight: '800', marginRight: 8, fontSize: 12 }}>•</Text>
              <Text style={{ fontSize: 12, color: '#64748b', flex: 1, lineHeight: 18 }}>
                Check if Wi-Fi is active and you have network connectivity.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
              <Text style={{ color: '#ea580c', fontWeight: '800', marginRight: 8, fontSize: 12 }}>•</Text>
              <Text style={{ fontSize: 12, color: '#64748b', flex: 1, lineHeight: 18 }}>
                Connect to the same Wi-Fi router as the PC server.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ color: '#ea580c', fontWeight: '800', marginRight: 8, fontSize: 12 }}>•</Text>
              <Text style={{ fontSize: 11, color: '#94a3b8', flex: 1, lineHeight: 16 }}>
                Configured Server: {configuredUrl}
              </Text>
            </View>
          </View>

          {/* Retry Connection Action Button */}
          <TouchableOpacity
            onPress={() => fetchDriverData(true)}
            disabled={isRetrying}
            style={{
              width: '100%',
              backgroundColor: '#ea580c',
              paddingVertical: 14,
              borderRadius: 12,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
              elevation: 3,
            }}
            activeOpacity={0.85}
          >
            {isRetrying ? (
              <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="refresh" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            )}
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
              {isRetrying ? 'Retrying Connection...' : 'Retry Connection'}
            </Text>
          </TouchableOpacity>

          {/* Back to Login (preserves token without logging out) */}
          <TouchableOpacity
            onPress={() => router.replace('/login')}
            style={{ paddingVertical: 10, paddingHorizontal: 20 }}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>
              Back to Login
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!loading && !driver) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#ffffff' }}>
          <Ionicons name="cloud-offline-outline" size={52} color="#ea580c" style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8, textAlign: 'center' }}>
            Connection Offline
          </Text>
          <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
            Could not reach Kandy Cabs server.{'\n'}Please check your Wi-Fi or mobile network and retry.
          </Text>
          <TouchableOpacity
            onPress={() => fetchDriverData(true)}
            style={{ backgroundColor: '#ea580c', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 10, marginBottom: 12, minWidth: 180, alignItems: 'center' }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Retry Connection</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/login')}
            style={{ padding: 10 }}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Display booking (either active booking or mock demo if none)
  const currentTrip = activeBooking;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#162232"
        translucent={false}
      />

      {/* TOP APP BAR IN BRAND DARK BLUE (#162232) */}
      <View style={[styles.mainHeaderWhite, { paddingTop: Platform.OS === 'android' ? 6 : Math.max(insets.top, 8) }]}>
        <View style={styles.headerBarInner}>
          <View style={styles.headerLogoContainer}>
            <Image
              source={require('../assets/images/logo-white.png')}
              style={styles.driverHeaderLogo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.headerRightGroup}>
            {activeBottomTab !== 'HOME' && (
              <TouchableOpacity
                style={[
                  styles.miniDutyBadge,
                  onlineStatus ? styles.miniDutyBadgeOnline : styles.miniDutyBadgeOffline,
                ]}
                onPress={() => handleToggleOnline(!onlineStatus)}
                activeOpacity={0.8}
              >
                <View style={[styles.dutyDot, { backgroundColor: onlineStatus ? '#10b981' : '#ef4444', marginRight: 0 }]} />
                <Text
                  style={[
                    styles.miniDutyText,
                    { color: onlineStatus ? '#059669' : '#dc2626' },
                  ]}
                >
                  {onlineStatus ? t('header.online') : t('header.offline')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Notification Bell Icon with Number Badge for Updates */}
            <TouchableOpacity
              style={styles.notificationBellHeader}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={21} color="#ffffff" />
              {unreadUpdatesCount > 0 && (
                <View style={styles.notificationBellBadge}>
                  <Text style={styles.notificationBellBadgeText}>
                    {unreadUpdatesCount > 9 ? '9+' : unreadUpdatesCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Offline banner when cached session is active but server is unreachable */}
      {connectionError ? (
        <View style={{ backgroundColor: '#fff7ed', borderBottomWidth: 1, borderBottomColor: '#fed7aa', paddingVertical: 7, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="cloud-offline-outline" size={15} color="#ea580c" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: '#9a3412', fontWeight: '600', flex: 1 }} numberOfLines={1}>
              Offline mode • Check network connection
            </Text>
          </View>
          <TouchableOpacity onPress={() => fetchDriverData(true)} style={{ paddingLeft: 8 }} activeOpacity={0.7}>
            <Text style={{ fontSize: 12, color: '#ea580c', fontWeight: '800' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* MAIN SCROLLABLE BODY */}
      <ScrollView
        style={[
          styles.mainScrollView,
          activeBottomTab === 'HOME' && styles.mainScrollViewHome,
        ]}
        contentContainerStyle={[
          styles.scrollContent,
          activeBottomTab === 'HOME' && styles.scrollContentHome,
          activeBottomTab === 'PROFILE' && styles.scrollContentProfile,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================================ */}
        {/* TAB 1: HOME (Live Duty, Active Trip & Radar)                 */}
        {/* ============================================================ */}
        {activeBottomTab === 'HOME' && (
          <View style={styles.homeTabWrapper}>
            {/* 1. HERO DRIVER CARD (MATCHING REFERENCE DESIGN WITH SPACIOUS INNOVA & TRANSLUCENT FOG) */}
            <View style={styles.heroCardOuter}>
              <ImageBackground
                source={{ uri: HERO_BANNER_INNOVA_BASE64 }}
                style={styles.heroCardBg}
                imageStyle={{ borderRadius: 24, resizeMode: 'cover' }}
              >
                {/* Continuous 256x1 hardware-interpolated fog gradient: ZERO vertical lines, soft translucent fog with scenery visible */}
                <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: 24, overflow: 'hidden' }]}>
                  <Image
                    source={{ uri: FOGGY_OVERLAY_GRADIENT_BASE64 }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="stretch"
                  />
                </View>

                <View style={styles.heroCardContent}>
                  <View style={styles.heroCardLeft}>
                    {/* Profile Avatar & Driver Name centered together */}
                    <View style={styles.heroAvatarNameBlock}>
                      <TouchableOpacity
                        style={styles.heroAvatarContainer}
                        onPress={() => router.push('/documents')}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: driver?.profilePhotoUrl || CAPTAIN_AVATAR_BASE64 }}
                          style={styles.heroAvatarImg}
                          resizeMode="cover"
                        />
                        <View style={[styles.heroAvatarStatusDot, { backgroundColor: onlineStatus ? '#22c55e' : '#94a3b8' }]} />
                      </TouchableOpacity>

                      <Text style={styles.heroCardName} numberOfLines={1}>
                        {driver?.fullName || (driver?.phone ? `Partner (${driver.phone.replace(/\D/g, '').slice(-4)})` : 'Driver Partner')}
                      </Text>
                    </View>

                    <View style={styles.heroCardPlateRow}>
                      <Ionicons name="car" size={13} color="#0a192f" style={{ marginRight: 5 }} />
                      <Text style={styles.heroCardPlate} numberOfLines={1}>
                        {(activeFleetVeh?.plateNumber || driver?.vehicle?.plateNumber || (driver?.verificationStatus === 'APPROVED' ? 'KA-01-SD-2045' : 'PENDING')).toUpperCase()}
                      </Text>
                    </View>

                    {/* Duty Toggle Bar: Segmented Online / Offline Switch */}
                    <View style={styles.heroDutyToggleTrack}>
                      <TouchableOpacity
                        style={[
                          styles.heroDutyToggleSegment,
                          onlineStatus && styles.heroDutyToggleSegmentOnlineActive,
                        ]}
                        onPress={() => !onlineStatus && handleToggleOnline(true)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.heroDutyToggleDot,
                            { backgroundColor: onlineStatus ? '#22c55e' : '#94a3b8' },
                          ]}
                        />
                        <Text
                          style={[
                            styles.heroDutyToggleText,
                            onlineStatus && styles.heroDutyToggleTextActive,
                          ]}
                        >
                          {t('header.online')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.heroDutyToggleSegment,
                          !onlineStatus && styles.heroDutyToggleSegmentOfflineActive,
                        ]}
                        onPress={() => onlineStatus && handleToggleOnline(false)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.heroDutyToggleDot,
                            { backgroundColor: !onlineStatus ? '#ef4444' : '#94a3b8' },
                          ]}
                        />
                        <Text
                          style={[
                            styles.heroDutyToggleText,
                            !onlineStatus && styles.heroDutyToggleTextActive,
                          ]}
                        >
                          {t('header.offline')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ImageBackground>
            </View>

            {/* FLOATING CARD CONTAINER */}
            <View style={styles.homeCardsContainer}>
            {/* Auto Document Expiry Reminder Card (Auto-reminded before 5 days of expiry until updated) */}
            {expiringDocuments.length > 0 && (
              <View style={styles.expiryReminderCard}>
                <View style={styles.expiryReminderHeader}>
                  <View style={styles.expiryReminderIconCircle}>
                    <Ionicons name="warning" size={20} color="#b45309" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.expiryHeaderTitleRow}>
                      <Text style={styles.expiryReminderTitle}>
                        Document Expiry Notice
                      </Text>
                      <View style={styles.expiryCountBadge}>
                        <Text style={styles.expiryCountBadgeText}>
                          {expiringDocuments.length} Urgent
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.expiryReminderSub}>
                      Documents expiring within 5 days or expired. Please upload updated copies to stay active.
                    </Text>
                  </View>
                </View>

                {/* List of Expiring Documents */}
                <View style={styles.expiryDocsList}>
                  {expiringDocuments.map((item: any, idx: number) => {
                    const isExp = item.status === 'EXPIRED';
                    return (
                      <View key={item.docKey || idx} style={[styles.expiryDocRow, isExp && styles.expiryDocRowExpired]}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.expiryDocName} numberOfLines={1}>
                            {item.docName}
                          </Text>
                          <Text style={[styles.expiryDocDateText, isExp && { color: '#dc2626' }]}>
                            {item.label} • {item.expiryDateFormatted}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.expiryDocUpdateBtn}
                          onPress={() => router.push('/documents')}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.expiryDocUpdateBtnText}>Update</Text>
                          <Ionicons name="chevron-forward" size={12} color="#ffffff" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                {/* Primary Update Button */}
                <TouchableOpacity
                  style={styles.expiryMainCtaBtn}
                  onPress={() => router.push('/documents')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="cloud-upload-outline" size={17} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.expiryMainCtaBtnText}>Upload Renewed Documents</Text>
                  <Ionicons name="arrow-forward" size={15} color="#ffffff" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
            )}

            {/* Top Priority KYC Rejection Banner on Home Tab (Redesigned per Reference) */}
            {driver?.verificationStatus === 'REJECTED' && (
              <View style={styles.dashboardRejectionCard}>
                {/* Header Row */}
                <View style={styles.dashboardRejectionHeaderRow}>
                  <View style={styles.dashboardRejectionIconCircle}>
                    <Ionicons name="alert" size={20} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.dashboardRejectionTitle}>KYC Verification Rejected</Text>
                    <Text style={styles.dashboardRejectionSubtitle}>
                      All documents you submitted did not meet our guidelines.
                    </Text>
                  </View>
                </View>

                {/* Admin Reason / Feedback Box */}
                <View style={styles.dashboardRejectionReasonBox}>
                  <View style={styles.dashboardRejectionReasonHeaderRow}>
                    <Ionicons name="document-text" size={16} color="#c90016" style={{ marginRight: 6 }} />
                    <Text style={styles.dashboardRejectionReasonLabel}>Admin Reason / Feedback:</Text>
                  </View>
                  <View style={styles.dashboardRejectionReasonPill}>
                    <Text style={styles.dashboardRejectionReasonText}>
                      {driver.rejectionReason || 'Violation'}
                    </Text>
                  </View>
                </View>

                {/* Guidance Tip Row with Lightbulb */}
                <View style={styles.dashboardRejectionFooterRow}>
                  <Ionicons name="bulb-outline" size={18} color="#dc2626" style={{ marginRight: 8, marginTop: 1 }} />
                  <Text style={styles.dashboardRejectionFooterText}>
                    Please update the required information or upload correct documents as per the guidelines.
                  </Text>
                </View>

                {/* Fix & Re-upload Button */}
                <TouchableOpacity
                  style={styles.dashboardRejectionActionBtn}
                  onPress={() => router.push('/documents')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="create-outline" size={17} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.dashboardRejectionActionBtnText}>Fix & Re-upload Details</Text>
                  <Ionicons name="arrow-forward" size={15} color="#ffffff" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
            )}

            {/* 2. Top Priority KYC Incomplete Banner on Home Tab */}
            {hasPendingDocuments && (
              <View style={styles.kycVerificationCard}>
                {/* Background Watermark Shield */}
                <View style={styles.kycWatermarkBg} pointerEvents="none">
                  <Ionicons name="shield-checkmark" size={130} color="#0284c7" style={{ opacity: 0.05 }} />
                </View>

                {/* Header Row: Shield Icon + Title + Counter Pill */}
                <View style={styles.kycHeaderRow}>
                  <View style={styles.kycHeaderLeft}>
                    <View style={styles.kycShieldBox}>
                      <Ionicons name="shield-outline" size={30} color="#0f2744" />
                      <View style={styles.kycShieldCheckmarkPos}>
                        <Ionicons name="checkmark" size={17} color="#ea580c" />
                      </View>
                    </View>
                    <View style={styles.kycHeaderTitleBox}>
                      <Text style={styles.kycHeaderTitle}>{t('dashboard.driver_verification')}</Text>
                      <Text style={styles.kycHeaderSub}>{t('dashboard.driver_verification_sub')}</Text>
                    </View>
                  </View>

                  <View style={styles.kycCountPill}>
                    <Text style={styles.kycCountPillText}>
                      {verificationDocs.completedCount} / {verificationDocs.totalCount}
                    </Text>
                  </View>
                </View>

                {/* Segmented Progress Bar: 4 Segments */}
                <View style={styles.kycSegmentContainer}>
                  {verificationDocs.docs.map((doc) => (
                    <View
                      key={doc.id}
                      style={[
                        styles.kycSegmentBar,
                        doc.isCompleted ? styles.kycSegmentBarActive : styles.kycSegmentBarInactive,
                      ]}
                    />
                  ))}
                </View>

                {/* Document Rows: 4 Distinct Rows */}
                <View style={styles.kycDocList}>
                  {verificationDocs.docs.map((doc, index) => {
                    const isLast = index === verificationDocs.docs.length - 1;
                    return (
                      <View
                        key={doc.id}
                        style={[styles.kycDocRow, !isLast && styles.kycDocRowDivider]}
                      >
                        <View style={styles.kycDocIconCircle}>
                          <Ionicons name={doc.icon} size={18} color="#0f2744" />
                        </View>

                        <View style={styles.kycDocInfo}>
                          <Text style={styles.kycDocTitle}>{doc.title}</Text>
                          {doc.isCompleted ? (
                            <View style={styles.kycStatusRow}>
                              <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                              <Text style={styles.kycStatusSuccessText}>{t('dashboard.approved')}</Text>
                            </View>
                          ) : (
                            <View style={styles.kycStatusRow}>
                              <Ionicons name="time" size={14} color="#ea580c" />
                              <Text style={styles.kycStatusWarningText}>{t('dashboard.upload_required')}</Text>
                            </View>
                          )}
                        </View>

                        {!doc.isCompleted && (
                          <TouchableOpacity
                            style={styles.kycUploadMiniBtn}
                            onPress={() => router.push('/documents')}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="cloud-upload-outline" size={15} color="#0f2744" />
                            <Text style={styles.kycUploadMiniBtnText}>{t('dashboard.upload')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Full-Width Primary CTA Button */}
                <TouchableOpacity
                  style={styles.kycCompleteCtaBtn}
                  onPress={() => router.push('/documents')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="cloud-upload-outline" size={19} color="#ffffff" />
                  <Text style={styles.kycCompleteCtaBtnText}>{t('dashboard.complete_verification')}</Text>
                  <Ionicons name="arrow-forward" size={17} color="#ffffff" />
                </TouchableOpacity>

                {/* Bottom Disclaimer */}
                <View style={styles.kycNoticeRow}>
                  <Ionicons name="information-circle-outline" size={14} color="#64748b" />
                  <Text style={styles.kycNoticeText}>
                    {t('dashboard.documents_review_note')}
                  </Text>
                </View>
              </View>
            )}

            {/* Active Trip Card */}
            {currentTrip && (
              <View style={styles.cardWrapper}>
                {(() => {
                  const isTripInProcess =
                    currentTrip.status === BookingStatus.TRIP_STARTED ||
                    currentTrip.status === 'TRIP_STARTED' ||
                    currentTrip.status === 'IN_PROGRESS';

                  const tripDate = new Date(currentTrip.scheduledAt || currentTrip.createdAt);
                  const now = new Date();
                  const isToday =
                    tripDate.getDate() === now.getDate() &&
                    tripDate.getMonth() === now.getMonth() &&
                    tripDate.getFullYear() === now.getFullYear();

                  const diffMinutes = Math.round((tripDate.getTime() - now.getTime()) / (60 * 1000));
                  // Timing near warning: scheduled for today or pending/past due (has not started yet)
                  const isTimingNear =
                    !isTripInProcess &&
                    (isToday ||
                      (now.getTime() >= tripDate.getTime() && now.getTime() - tripDate.getTime() < 48 * 60 * 60 * 1000) ||
                      diffMinutes <= 240);
                  const pickupTimeLabel = tripDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <View style={styles.tripCardContent}>
                      {/* Top Row: Booking ID + ON ROUTE Badge */}
                      <View style={styles.bookingTopRow}>
                        <View>
                            <Text style={styles.bookingIdLabel}>Booking ID</Text>
                            <Text style={styles.bookingIdNumber}>{currentTrip.humanReadableRef}</Text>
                          </View>
                          <View
                            style={
                              isTripInProcess
                                ? styles.onTripBadge
                                : isTimingNear
                                ? styles.onRouteBadgeWarning
                                : styles.onRouteBadge
                            }
                          >
                            <View
                              style={
                                isTripInProcess
                                  ? styles.onTripDot
                                  : isTimingNear
                                  ? styles.onRouteDotWarning
                                  : styles.onRouteDot
                              }
                            />
                            <Text
                              style={
                                isTripInProcess
                                  ? styles.onTripBadgeText
                                  : isTimingNear
                                  ? styles.onRouteBadgeTextWarning
                                  : styles.onRouteBadgeText
                              }
                            >
                              {isTripInProcess ? 'ON TRIP' : 'ON ROUTE'}
                            </Text>
                          </View>
                        </View>

                        {/* Stepper Route */}
                        <View style={styles.stepperContainer}>
                          <View style={[styles.stepperLeft, { flex: 1 }]}>
                            <TouchableOpacity
                              style={styles.stepPoint}
                              onPress={() => openNavigationMap(currentTrip.pickupLat, currentTrip.pickupLng, currentTrip.pickupAddress)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="location-sharp" size={16} color="#16a34a" style={styles.pickupPin} />
                              <View style={styles.stepTextGroup}>
                                <Text style={styles.locationTitle}>{currentTrip.pickupAddress}</Text>
                              </View>
                            </TouchableOpacity>

                            {/* Intermediate Stops */}
                            {parseViaStops(currentTrip).map((stopName, stopIdx) => (
                              <React.Fragment key={`current-stop-${stopIdx}`}>
                                <View style={styles.dashedTrail} />
                                <TouchableOpacity
                                  style={styles.stepPoint}
                                  onPress={() => openNavigationMap(undefined, undefined, stopName)}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.stopNumCircle}>
                                    <Text style={styles.stopNumText}>{stopIdx + 1}</Text>
                                  </View>
                                  <View style={styles.stepTextGroup}>
                                    <Text style={styles.locationTitle}>{stopName}</Text>
                                  </View>
                                </TouchableOpacity>
                              </React.Fragment>
                            ))}

                            <View style={styles.dashedTrail} />

                            <TouchableOpacity
                              style={styles.stepPoint}
                              onPress={() => openNavigationMap(currentTrip.dropLat, currentTrip.dropLng, currentTrip.dropAddress)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="location-sharp" size={16} color="#dc2626" style={styles.dropPin} />
                              <View style={styles.stepTextGroup}>
                                <Text style={styles.locationTitle}>{currentTrip.dropAddress}</Text>
                              </View>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            style={styles.stepperViewRouteBtn}
                            onPress={() => {
                              const targetLat = isTripInProcess ? currentTrip.dropLat : currentTrip.pickupLat;
                              const targetLng = isTripInProcess ? currentTrip.dropLng : currentTrip.pickupLng;
                              const targetAddress = isTripInProcess ? currentTrip.dropAddress : currentTrip.pickupAddress;
                              openNavigationMap(targetLat, targetLng, targetAddress);
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="navigate" size={15} color="#2563eb" />
                            <Text style={styles.stepperViewRouteText}>
                              {isTripInProcess ? t('dashboard.drop_off_route') : t('dashboard.pickup_location')}
                            </Text>
                            <Ionicons name="chevron-forward" size={13} color="#2563eb" />
                          </TouchableOpacity>
                        </View>

                        {/* 3-Column Info Row */}
                        <View style={styles.infoThreeColsRow}>
                          {/* Col 1: Pickup Date & Time */}
                          <View style={styles.infoThreeCol}>
                            <View style={styles.infoColHeaderRow}>
                              <Ionicons name="calendar-outline" size={15} color="#0f294d" />
                              <Text style={styles.infoColHeaderLabel} numberOfLines={1}>
                                {t('dashboard.pickup_date_time_label', { defaultValue: 'Pickup Date & Time' })}
                              </Text>
                            </View>
                            <Text style={styles.infoColValDark}>
                              {new Date(currentTrip.scheduledAt || currentTrip.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })},
                            </Text>
                            <Text style={styles.infoColValDark}>
                              {new Date(currentTrip.scheduledAt || currentTrip.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>

                          {/* Vertical Slash/Divider 1 */}
                          <View style={styles.infoColDivider} />

                          {/* Col 2: Customer */}
                          <View style={styles.infoThreeCol}>
                            <View style={styles.infoColHeaderRow}>
                              <Ionicons name="person" size={14} color="#2563eb" />
                              <Text style={styles.infoColHeaderLabel} numberOfLines={1}>Customer</Text>
                            </View>
                            <Text style={styles.infoColValDark} numberOfLines={1}>
                              {currentTrip.customer?.user?.fullName || 'manish'}
                            </Text>
                            <Text style={styles.infoColSubPhone}>
                              {(() => {
                                const isPhoneReleased =
                                  Boolean(currentTrip.customerPhoneReleased) ||
                                  (currentTrip.scheduledAt &&
                                    new Date(currentTrip.scheduledAt).getTime() - Date.now() <= 5 * 60 * 60 * 1000);

                                return isPhoneReleased && currentTrip.customer?.user?.phone
                                  ? currentTrip.customer.user.phone
                                  : 'Phone Protected';
                              })()}
                            </Text>
                          </View>

                          {/* Vertical Slash/Divider 2 */}
                          <View style={styles.infoColDivider} />

                          {/* Col 3: Trip Type & Distance (Driver Amount hidden once accepted) */}
                          <View style={styles.infoThreeCol}>
                            <View style={styles.infoColHeaderRow}>
                              <Ionicons name="swap-horizontal-outline" size={14} color="#0f294d" />
                              <Text style={styles.infoColHeaderLabel} numberOfLines={1}>Trip Type</Text>
                            </View>
                            <Text style={[styles.infoFareValBold, { fontSize: 13, textTransform: 'uppercase' }]} numberOfLines={1} adjustsFontSizeToFit>
                              {currentTrip.tripType
                                ? (currentTrip.tripType === 'ONE_WAY' ? 'ONEWAY' : currentTrip.tripType.replace(/_/g, ' '))
                                : 'ONEWAY'}
                            </Text>
                            <Text style={styles.infoColSubPhone}>
                              {currentTrip.distanceKm || '--'} km
                            </Text>
                          </View>
                        </View>

                        {/* Timing Near Warning (No bg, no border, typography text only) */}
                        {isTimingNear && (
                          <View style={styles.timingNearWarningRow}>
                            <Ionicons name="warning" size={14} color="#dc2626" />
                            <Text style={styles.timingNearWarningText}>
                              <Text style={{ fontWeight: '800', color: '#dc2626' }}>
                                {t('dashboard.warning_label', { defaultValue: 'Warning: ' })}
                              </Text>
                              {t('dashboard.trip_scheduled_today', {
                                defaultValue: `Pickup scheduled for Today, ${pickupTimeLabel} — Be ready today!`,
                                time: pickupTimeLabel,
                              })}
                            </Text>
                          </View>
                        )}

                        {/* Customer Requirements & Preferences Pills */}
                        {(() => {
                          const reqs = parseCustomerRequirements(currentTrip, t);
                          const note = extractCustomerNotes(currentTrip);
                          if (reqs.length === 0 && !note) return null;

                          return (
                            <View style={[styles.dispatchReqsSection, { marginTop: 12, marginHorizontal: 0 }]}>
                              <View style={styles.dispatchReqsHeaderRow}>
                                <Ionicons name="options-outline" size={12} color="#64748b" />
                                <Text style={styles.dispatchReqsHeading}>
                                  {t('dashboard.customer_requirements', { defaultValue: 'CUSTOMER REQUIREMENTS' })}
                                </Text>
                              </View>
                              <View style={styles.dispatchReqsRow}>
                                {reqs.map((r, rIdx) => (
                                  <React.Fragment key={`curr-req-${rIdx}`}>
                                    {rIdx > 0 && <View style={styles.reqLineSeparator} />}
                                    <View style={styles.reqPill}>
                                      <Ionicons
                                        name={r.icon as any}
                                        size={12}
                                        color={
                                          r.type === 'highlight'
                                            ? '#c2410c'
                                            : r.type === 'warning'
                                            ? '#b45309'
                                            : r.type === 'info'
                                            ? '#2563eb'
                                            : '#334155'
                                        }
                                      />
                                      <Text
                                        style={[
                                          styles.reqPillText,
                                          r.type === 'highlight' && styles.reqPillTextHighlight,
                                          r.type === 'warning' && styles.reqPillTextWarning,
                                          r.type === 'info' && styles.reqPillTextInfo,
                                        ]}
                                      >
                                        {r.label}
                                      </Text>
                                    </View>
                                  </React.Fragment>
                                ))}
                              </View>
                              {note ? (
                                <View style={styles.dispatchNotesBox}>
                                  <Ionicons name="chatbubble-ellipses-outline" size={12} color="#475569" style={{ marginTop: 1 }} />
                                  <Text style={styles.dispatchNotesText} numberOfLines={2}>
                                    Note: "{note}"
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          );
                        })()}

                        {/* Action: SLIDE TO START TRIP or VERIFICATION */}
                        {(() => {
                          const hasInspectionPhotos =
                            isTripVerificationCompletedSync(currentTrip.id) ||
                            (Array.isArray(currentTrip.vehicleInspectionPhotos) &&
                              currentTrip.vehicleInspectionPhotos.filter((p: string) => p && !p.includes('placehold.co') && p.trim().length > 0).length >= 4);

                          const isTripAlreadyStarted =
                            currentTrip.status === BookingStatus.TRIP_STARTED ||
                            currentTrip.status === 'TRIP_STARTED' ||
                            currentTrip.status === 'IN_PROGRESS' ||
                            isTripInProcess;

                          // Verification button removed per user request: after accepting, show slide to start trip directly.
                          // Verification photos (car angles + driver selfie) are completed right after slide to start.
                          const onSlideStartTrip = async () => {
                            if (driver?.verificationStatus !== 'APPROVED') {
                              Alert.alert(
                                'Account Pending Approval',
                                'Your account is currently under Admin Review. You cannot start any trip until the admin approves your account.'
                              );
                              return;
                            }
                            setIsStartingTrip(true);
                            try {
                              if (isTripAlreadyStarted) {
                                locationTracker.startActiveTripTracking(currentTrip.id);
                                router.push({ pathname: '/trip/active', params: { bookingId: currentTrip.id } });
                              } else {
                                await setTripInProcess(currentTrip.id, false);
                                driverApiClient.fetch('/api/driver/trip/en-route', {
                                  method: 'POST',
                                  body: JSON.stringify({ bookingId: currentTrip.id }),
                                }).catch(() => {});
                                locationTracker.startActiveTripTracking(currentTrip.id);
                                if (isTripVerificationCompletedSync(currentTrip.id) && isTripPickupReachedSync(currentTrip.id)) {
                                  router.push({ pathname: '/trip/odometer', params: { bookingId: currentTrip.id } });
                                } else if (isTripVerificationCompletedSync(currentTrip.id)) {
                                  router.push({ pathname: '/trip/en-route', params: { bookingId: currentTrip.id } });
                                } else {
                                  router.push({ pathname: '/trip/inspection', params: { bookingId: currentTrip.id } });
                                }
                              }
                            } finally {
                              setIsStartingTrip(false);
                            }
                          };

                          return (
                            <View style={{ width: '100%', marginTop: 8 }}>
                              {isTripInProcess ? (
                                <TouchableOpacity
                                  style={styles.manageActiveTripBtn}
                                  onPress={onSlideStartTrip}
                                  disabled={isStartingTrip}
                                  activeOpacity={0.85}
                                >
                                  {isStartingTrip ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                  ) : (
                                    <>
                                      <Ionicons name="navigate-circle" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                                      <Text style={styles.manageActiveTripBtnText}>
                                        {t('dashboard.manage_active_trip', { defaultValue: 'MANAGE ACTIVE TRIP' })}
                                      </Text>
                                      <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
                                    </>
                                  )}
                                </TouchableOpacity>
                              ) : (
                                <SlideToAccept
                                  onAccept={onSlideStartTrip}
                                  isAccepting={isStartingTrip}
                                  title={t('dashboard.slide_to_start_trip', { defaultValue: 'SLIDE TO START TRIP' })}
                                  acceptingTitle={t('dashboard.starting_trip', { defaultValue: 'STARTING TRIP...' })}
                                />
                              )}
                            </View>
                          );
                        })()}

                        {/* 3 Quick Action Buttons */}
                        <View style={styles.quickActionsRow}>
                          <TouchableOpacity
                            style={styles.quickActionPill}
                            onPress={() => Linking.openURL(`tel:${currentTrip.customer?.user?.phone || '9342759612'}`)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="call" size={14} color="#0f172a" />
                            <Text style={styles.quickActionText}>{t('dashboard.call_customer')}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.quickActionPill}
                            onPress={() => Linking.openURL(`sms:${currentTrip.customer?.user?.phone || '9342759612'}`)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="chatbox" size={14} color="#0f172a" />
                            <Text style={styles.quickActionText}>{t('dashboard.message')}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.quickActionPill}
                            onPress={() => {
                              const activeVendorCost = Math.round(
                                Number(currentTrip.driverPayeeAmount || 0) > 0
                                  ? Number(currentTrip.driverPayeeAmount)
                                  : (Number(currentTrip.distanceKm || 0) * 13 + (Number(currentTrip.driverAllowance) || 300))
                              );
                              Alert.alert(
                                `Trip: ${currentTrip.humanReadableRef}`,
                                `Pickup: ${currentTrip.pickupAddress}\nDrop: ${currentTrip.dropAddress}\nDistance: ${currentTrip.distanceKm || '--'} km\nTrip Type: ${currentTrip.tripType || 'ONE WAY'}\nDriver Amount: ₹${activeVendorCost.toLocaleString('en-IN')}`
                              );
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="document-text" size={14} color="#0f172a" />
                            <Text style={styles.quickActionText}>{t('dashboard.trip_details')}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })()}
              </View>
            )}

            {/* SEPARATE STANDALONE CARD: Queued / Accepted Trips */}
            {upcomingBookings.length > 0 && (
              <View style={styles.separateQueuedCardWrapper}>
                <View style={styles.separateQueuedHeader}>
                  <View style={styles.separateQueuedHeaderLeft}>
                    <Ionicons name="layers" size={17} color="#0f2744" />
                    <Text style={styles.separateQueuedTitle}>
                      {t('dashboard.queued_accepted_trips', { count: upcomingBookings.length })}
                    </Text>
                  </View>
                  <View style={styles.queuedBadgeLight}>
                    <Ionicons name="time" size={11} color="#2563eb" />
                    <Text style={styles.queuedBadgeTextLight}>{t('dashboard.next_in_queue_light')}</Text>
                  </View>
                </View>

                <View style={styles.separateQueuedCardBody}>
                  {sortTripsByDateTimeAscending(upcomingBookings).map((upBooking) => {
                    const pickupDateStr = upBooking.scheduledAt
                      ? new Date(upBooking.scheduledAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '--';
                    const pickupTimeStr = upBooking.scheduledAt
                      ? new Date(upBooking.scheduledAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })
                      : '--';

                    const upDate = upBooking.scheduledAt ? new Date(upBooking.scheduledAt) : new Date();
                    const isUpToday =
                      upDate.getDate() === now.getDate() &&
                      upDate.getMonth() === now.getMonth() &&
                      upDate.getFullYear() === now.getFullYear();
                    const isUpPendingOrToday =
                      isUpToday ||
                      (now.getTime() >= upDate.getTime() && now.getTime() - upDate.getTime() < 48 * 60 * 60 * 1000) ||
                      (upDate.getTime() - now.getTime() <= 4 * 60 * 60 * 1000);

                    return (
                      <View key={upBooking.id} style={styles.separateQueuedItemCard}>
                        {/* Top Row: Ref & Tag */}
                        <View style={styles.bookingTopRow}>
                          <View>
                            <Text style={styles.bookingIdLabel}>Accepted Trip</Text>
                            <Text style={styles.bookingIdNumber}>{upBooking.humanReadableRef}</Text>
                          </View>
                          <View style={styles.availableQueueBadge}>
                            <Ionicons name="checkmark-circle" size={12} color="#15803d" />
                            <Text style={styles.availableQueueBadgeText}>ACCEPTED • QUEUED</Text>
                          </View>
                        </View>

                        {/* Stepper Route */}
                        <View style={styles.stepperContainer}>
                          <View style={[styles.stepperLeft, { flex: 1 }]}>
                            <TouchableOpacity
                              style={styles.stepPoint}
                              onPress={() => openNavigationMap(upBooking.pickupLat, upBooking.pickupLng, upBooking.pickupAddress)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="location-sharp" size={16} color="#16a34a" style={styles.pickupPin} />
                              <View style={styles.stepTextGroup}>
                                <Text style={styles.locationTitle}>{upBooking.pickupAddress}</Text>
                              </View>
                            </TouchableOpacity>

                            {/* Intermediate Stops */}
                            {parseViaStops(upBooking).map((stopName, stopIdx) => (
                              <React.Fragment key={`up-stop-${stopIdx}`}>
                                <View style={styles.dashedTrail} />
                                <TouchableOpacity
                                  style={styles.stepPoint}
                                  onPress={() => openNavigationMap(undefined, undefined, stopName)}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.stopNumCircle}>
                                    <Text style={styles.stopNumText}>{stopIdx + 1}</Text>
                                  </View>
                                  <View style={styles.stepTextGroup}>
                                    <Text style={styles.locationTitle}>{stopName}</Text>
                                  </View>
                                </TouchableOpacity>
                              </React.Fragment>
                            ))}

                            <View style={styles.dashedTrail} />

                            <TouchableOpacity
                              style={styles.stepPoint}
                              onPress={() => openNavigationMap(upBooking.dropLat, upBooking.dropLng, upBooking.dropAddress)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="location-sharp" size={16} color="#dc2626" style={styles.dropPin} />
                              <View style={styles.stepTextGroup}>
                                <Text style={styles.locationTitle}>{upBooking.dropAddress}</Text>
                              </View>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Info 3 Columns Row */}
                        <View style={styles.infoThreeColsRow}>
                          <View style={styles.infoThreeCol}>
                            <View style={styles.infoColTopLabel}>
                              <Ionicons name="calendar-outline" size={13} color="#64748b" />
                              <Text style={styles.infoColLabel}>Scheduled</Text>
                            </View>
                            <Text style={styles.infoColMainText}>{pickupDateStr}</Text>
                            <Text style={styles.infoColSubPhone}>{pickupTimeStr}</Text>
                          </View>

                          <View style={styles.infoColDivider} />

                          <View style={styles.infoThreeCol}>
                            <View style={styles.infoColTopLabel}>
                              <Ionicons name="person-outline" size={13} color="#64748b" />
                              <Text style={styles.infoColLabel}>Customer</Text>
                            </View>
                            <Text style={styles.infoColMainText} numberOfLines={1}>
                              {upBooking.customer?.user?.fullName || 'Customer'}
                            </Text>
                            <Text style={styles.infoColSubPhone}>
                              {upBooking.customerPhoneReleased
                                ? upBooking.customer?.user?.phone || 'Released'
                                : 'Phone on Pickup'}
                            </Text>
                          </View>

                          <View style={styles.infoColDivider} />

                          <View style={styles.infoThreeCol}>
                            <View style={styles.infoColTopLabel}>
                              <Ionicons name="swap-horizontal-outline" size={13} color="#64748b" />
                              <Text style={styles.infoColLabel}>Trip Type</Text>
                            </View>
                            <Text style={[styles.infoColMainText, { textTransform: 'uppercase' }]} numberOfLines={1} adjustsFontSizeToFit>
                              {upBooking.tripType
                                ? (upBooking.tripType === 'ONE_WAY' ? 'ONEWAY' : upBooking.tripType.replace(/_/g, ' '))
                                : 'ONEWAY'}
                            </Text>
                            <Text style={styles.infoColSubPhone}>
                              {upBooking.distanceKm || '--'} km
                            </Text>
                          </View>
                        </View>

                        {/* Timing Near Warning for Queued Trip */}
                        {isUpPendingOrToday && (
                          <View style={styles.timingNearWarningRow}>
                            <Ionicons name="warning" size={14} color="#dc2626" />
                            <Text style={styles.timingNearWarningText}>
                              <Text style={{ fontWeight: '800', color: '#dc2626' }}>
                                {t('dashboard.warning_label', { defaultValue: 'Warning: ' })}
                              </Text>
                              {t('dashboard.trip_scheduled_today', {
                                defaultValue: `Pickup scheduled for Today, ${pickupTimeStr} — Be ready today!`,
                                time: pickupTimeStr,
                              })}
                            </Text>
                          </View>
                        )}

                        {/* Customer Requirements & Preferences Pills */}
                        {(() => {
                          const reqs = parseCustomerRequirements(upBooking, t);
                          const note = extractCustomerNotes(upBooking);
                          if (reqs.length === 0 && !note) return null;

                          return (
                            <View style={[styles.dispatchReqsSection, { marginTop: 10, marginHorizontal: 0 }]}>
                              <View style={styles.dispatchReqsHeaderRow}>
                                <Ionicons name="options-outline" size={12} color="#64748b" />
                                <Text style={styles.dispatchReqsHeading}>
                                  {t('dashboard.customer_requirements', { defaultValue: 'CUSTOMER REQUIREMENTS' })}
                                </Text>
                              </View>
                              <View style={styles.dispatchReqsRow}>
                                {reqs.map((r, rIdx) => (
                                  <React.Fragment key={`up-req-${rIdx}`}>
                                    {rIdx > 0 && <View style={styles.reqLineSeparator} />}
                                    <View style={styles.reqPill}>
                                      <Ionicons
                                        name={r.icon as any}
                                        size={12}
                                        color={
                                          r.type === 'highlight'
                                            ? '#c2410c'
                                            : r.type === 'warning'
                                            ? '#b45309'
                                            : r.type === 'info'
                                            ? '#2563eb'
                                            : '#334155'
                                        }
                                      />
                                      <Text
                                        style={[
                                          styles.reqPillText,
                                          r.type === 'highlight' && styles.reqPillTextHighlight,
                                          r.type === 'warning' && styles.reqPillTextWarning,
                                          r.type === 'info' && styles.reqPillTextInfo,
                                        ]}
                                      >
                                        {r.label}
                                      </Text>
                                    </View>
                                  </React.Fragment>
                                ))}
                              </View>
                              {note ? (
                                <View style={styles.dispatchNotesBox}>
                                  <Ionicons name="chatbubble-ellipses-outline" size={12} color="#475569" style={{ marginTop: 1 }} />
                                  <Text style={styles.dispatchNotesText} numberOfLines={2}>
                                    Note: "{note}"
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          );
                        })()}

                        {/* Action Buttons: Locked Start Button + Trip Details + Verification */}
                        <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            style={[styles.lockedUpcomingStartBtn, { flex: 1.2 }]}
                            onPress={() => {
                              Alert.alert(
                                'Active Trip Ongoing 🚗',
                                'This trip is in your queue. You will be able to start it as soon as your current active trip is completed.'
                              );
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="lock-closed" size={14} color="#64748b" />
                            <Text style={styles.lockedUpcomingStartText}>
                              QUEUED
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.creamViewRouteBtn, { flex: 1.4, paddingVertical: 11, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                            onPress={() => {
                              router.push({
                                pathname: '/trip/en-route',
                                params: { bookingId: upBooking.id },
                              });
                            }}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="location-sharp" size={14} color="#1d63ed" style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#1d63ed' }}>PICKUP ROUTE</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.creamViewRouteBtn, { flex: 1, paddingVertical: 11 }]}
                            onPress={() => {
                              const queuedVendorCost = Math.round(
                                Number(upBooking.driverPayeeAmount || 0) > 0
                                  ? Number(upBooking.driverPayeeAmount)
                                  : (Number(upBooking.distanceKm || 0) * 13 + (Number(upBooking.driverAllowance) || 300))
                              );
                              Alert.alert(
                                `Queued Trip: ${upBooking.humanReadableRef}`,
                                `Pickup: ${upBooking.pickupAddress}\nDrop: ${upBooking.dropAddress}\nDistance: ${upBooking.distanceKm || '--'} km\nCustomer: ${upBooking.customer?.user?.fullName || 'Customer'}\nScheduled: ${pickupDateStr} ${pickupTimeStr}\nDriver Amount: ₹${queuedVendorCost.toLocaleString('en-IN')}`
                              );
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="document-text" size={14} color="#0f2744" />
                            <Text style={[styles.creamBtnText, { fontSize: 11.5 }]}>DETAILS</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Broadcast Dispatches List & Radar Section */}
            {dispatches.length > 0 && (
              <View style={{ gap: 12, marginTop: currentTrip ? 8 : 0, marginBottom: 12 }}>
                {currentTrip && (
                  <View style={styles.otherTripsHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="radio" size={16} color="#0f2744" />
                      <Text style={styles.otherTripsHeaderTitle}>
                        {t('dashboard.assigned_trips_from_admin')} <Text style={styles.dispatchesCount}>({dispatches.length})</Text>
                      </Text>
                    </View>
                    <View style={styles.availableQueueBadge}>
                      <Ionicons name="checkmark-circle" size={11} color="#15803d" />
                      <Text style={styles.availableQueueBadgeText}>{t('dashboard.accept_available')}</Text>
                    </View>
                  </View>
                )}

                {sortTripsByDateTimeAscending(dispatches).map((d) => {
                  const b = d?.booking || {};
                  const isAccepting = acceptingId === d.id;
                  const isAccepted = Boolean(
                    acceptedDispatches[d.id] ||
                    acceptedDispatches[b?.id] ||
                    acceptedDispatches[d.bookingId] ||
                    b?.status === 'DRIVER_ACCEPTED' ||
                    d?.status === 'ACCEPTED'
                  );

                  return (
                    <View key={d.id} style={styles.floatingDispatchCardWhite}>
                      <View style={styles.dispatchHeaderBanner}>
                        <View style={styles.dispatchHeaderRow}>
                          <View>
                            <View style={[styles.newAlertBadge, isAccepted && { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                              <Ionicons
                                name={isAccepted ? 'checkmark-circle' : 'radio-button-on'}
                                size={13}
                                color={isAccepted ? '#16a34a' : '#2563eb'}
                              />
                              <Text style={[styles.newAlertText, isAccepted && { color: '#15803d' }]}>
                                {isAccepted ? 'ACCEPTED' : t('dashboard.new_ride')}
                              </Text>
                            </View>
                            <Text style={styles.dispatchRefText}>{b?.humanReadableRef || 'RIDE'}</Text>
                          </View>
                          <View style={styles.distanceBadgeLight}>
                            <Text style={styles.distanceBadgeTextLight}>📍 {b?.distanceKm || '--'} km</Text>
                          </View>
                        </View>
                      </View>

                      {/* Trip Date & Pickup Time Banner */}
                      <View style={styles.tripDateBanner}>
                        <View style={styles.tripDateBannerLeft}>
                          <Ionicons name="calendar" size={14} color="#0284c7" />
                          <Text style={styles.tripDateBannerLabel}>
                            {t('dashboard.pickup_date_time_banner', { defaultValue: 'PICKUP DATE & TIME:' })}
                          </Text>
                          <Text style={styles.tripDateBannerValue}>
                            {formatTripDateTime(b?.scheduledAt, t).fullText}
                          </Text>
                        </View>
                        {formatTripDateTime(b?.scheduledAt, t).isToday ? (
                          <View style={styles.todayTagPill}>
                            <Text style={styles.todayTagText}>
                              {t('dashboard.today_tag', { defaultValue: 'TODAY' })}
                            </Text>
                          </View>
                        ) : formatTripDateTime(b?.scheduledAt, t).isTomorrow ? (
                          <View style={styles.tomorrowTagPill}>
                            <Text style={styles.tomorrowTagText}>
                              {t('dashboard.tomorrow_tag', { defaultValue: 'TOMORROW' })}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Stepper Route */}
                      <View style={styles.stepperContainer}>
                        <View style={styles.stepperLeft}>
                          <View style={styles.stepPoint}>
                            <Ionicons name="location-sharp" size={16} color="#16a34a" style={styles.pickupPin} />
                            <View style={styles.stepTextGroup}>
                              <Text style={styles.locationTitle}>{b?.pickupAddress || 'Pickup Location'}</Text>
                            </View>
                          </View>

                          {/* Intermediate Stops */}
                          {parseViaStops(b).map((stopName, stopIdx) => (
                            <React.Fragment key={`disp-stop-${stopIdx}`}>
                              <View style={styles.dashedTrail} />
                              <View style={styles.stepPoint}>
                                <View style={styles.stopNumCircle}>
                                  <Text style={styles.stopNumText}>{stopIdx + 1}</Text>
                                </View>
                                <View style={styles.stepTextGroup}>
                                  <Text style={styles.locationTitle}>{stopName}</Text>
                                </View>
                              </View>
                            </React.Fragment>
                          ))}

                          <View style={styles.dashedTrail} />
                          <View style={styles.stepPoint}>
                            <Ionicons name="location-sharp" size={16} color="#dc2626" style={styles.dropPin} />
                            <View style={styles.stepTextGroup}>
                              <Text style={styles.locationTitle}>{b?.dropAddress || 'Drop Location'}</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Customer Requirements & Preferences Pills */}
                      {(() => {
                        const reqs = parseCustomerRequirements(b, t);
                        const note = extractCustomerNotes(b);
                        if (reqs.length === 0 && !note) return null;

                        return (
                          <View style={styles.dispatchReqsSection}>
                            <View style={styles.dispatchReqsHeaderRow}>
                              <Ionicons name="options-outline" size={12} color="#64748b" />
                              <Text style={styles.dispatchReqsHeading}>
                                {t('dashboard.customer_requirements', { defaultValue: 'CUSTOMER REQUIREMENTS' })}
                              </Text>
                            </View>
                            <View style={styles.dispatchReqsRow}>
                              {reqs.map((r, rIdx) => (
                                <React.Fragment key={`req-${rIdx}`}>
                                  {rIdx > 0 && <View style={styles.reqLineSeparator} />}
                                  <View style={styles.reqPill}>
                                    <Ionicons
                                      name={r.icon as any}
                                      size={12}
                                      color={
                                        r.type === 'highlight'
                                          ? '#c2410c'
                                          : r.type === 'warning'
                                          ? '#b45309'
                                          : r.type === 'info'
                                          ? '#2563eb'
                                          : '#334155'
                                      }
                                    />
                                    <Text
                                      style={[
                                        styles.reqPillText,
                                        r.type === 'highlight' && styles.reqPillTextHighlight,
                                        r.type === 'warning' && styles.reqPillTextWarning,
                                        r.type === 'info' && styles.reqPillTextInfo,
                                      ]}
                                    >
                                      {r.label}
                                    </Text>
                                  </View>
                                </React.Fragment>
                              ))}
                            </View>
                            {note ? (
                              <View style={styles.dispatchNotesBox}>
                                <Ionicons name="chatbubble-ellipses-outline" size={12} color="#475569" style={{ marginTop: 1 }} />
                                <Text style={styles.dispatchNotesText} numberOfLines={2}>
                                  Note: "{note}"
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        );
                      })()}

                      {/* Passenger, Vendor Amount In Between, & Trip Type Row */}
                      <View style={styles.dispatchPassengerRowLight}>
                        <Text style={styles.dispatchPassengerNameDark} numberOfLines={1}>
                          👤 {b?.customer?.user?.fullName || 'Customer'}
                        </Text>
                        {!isAccepted && (
                          <Text style={styles.dispatchVendorAmountCenter}>
                            ₹{Math.round(
                              Number(b?.driverPayeeAmount || 0) > 0
                                ? Number(b.driverPayeeAmount)
                                : (Number(b?.distanceKm || 0) * 13 + (Number(b?.driverAllowance) || 300))
                            )}
                          </Text>
                        )}
                        <Text style={styles.dispatchTripTypeOrange}>
                          {b?.tripType ? (b.tripType === 'ONE_WAY' ? 'ONEWAY' : b.tripType.replace(/_/g, ' ')) : 'ONEWAY'}
                          {isAccepted && b?.distanceKm ? ` • ${b.distanceKm} km` : ''}
                        </Text>
                      </View>

                      {/* Waiting For Approval Warning (Same typography style, no bg, no border) */}
                      {!isAccepted && (() => {
                        const tripTiming = formatTripDateTime(b?.scheduledAt, t);
                        const tripDayLabel = tripTiming.isToday
                          ? t('dashboard.day_today', { defaultValue: `today (${tripTiming.timeText})`, time: tripTiming.timeText })
                          : tripTiming.isTomorrow
                          ? t('dashboard.day_tomorrow', { defaultValue: `tomorrow (${tripTiming.timeText})`, time: tripTiming.timeText })
                          : t('dashboard.day_on', {
                              defaultValue: `on ${(() => {
                                const d = b?.scheduledAt ? new Date(b.scheduledAt) : null;
                                return d && !isNaN(d.getTime())
                                  ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                  : tripTiming.dateText;
                              })()} (${tripTiming.timeText})`,
                              date: (() => {
                                const d = b?.scheduledAt ? new Date(b.scheduledAt) : null;
                                return d && !isNaN(d.getTime())
                                  ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                  : tripTiming.dateText;
                              })(),
                              time: tripTiming.timeText,
                            });

                        return (
                          <View style={[styles.timingNearWarningRow, { marginTop: 6, marginBottom: 4, marginHorizontal: 2 }]}>
                            <Ionicons name="warning" size={14} color="#dc2626" />
                            <Text style={styles.timingNearWarningText}>
                              <Text style={{ fontWeight: '800', color: '#dc2626' }}>
                                {t('dashboard.warning_label', { defaultValue: 'Warning: ' })}
                              </Text>
                              {t('dashboard.waiting_approval_warning', {
                                defaultValue: `Waiting for approval! Hurry up, the trip is ${tripDayLabel}!`,
                                dayLabel: tripDayLabel,
                              })}
                            </Text>
                          </View>
                        );
                      })()}

                      {/* Decline (Left) & Accept (Right) Action Buttons Row */}
                      {isAccepted ? (
                        <View style={styles.dispatchActionRow}>
                          <TouchableOpacity
                            style={[styles.verificationDispatchBtn, { backgroundColor: '#059669' }]}
                            onPress={() => {
                              const targetBId =
                                acceptedDispatches[d.id] ||
                                acceptedDispatches[b?.id] ||
                                acceptedDispatches[d.bookingId] ||
                                b?.id ||
                                d.bookingId;
                              const isVerified = isTripVerificationCompletedSync(targetBId);
                              router.push({
                                pathname: isVerified ? '/trip/en-route' : '/trip/inspection',
                                params: { bookingId: targetBId },
                              });
                            }}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="arrow-forward-circle" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={styles.verificationDispatchBtnText}>
                              {t('dashboard.start_trip_caps', { defaultValue: 'START TRIP' })}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.dispatchActionRow}>
                          <TouchableOpacity
                            style={styles.declineDispatchBtn}
                            onPress={() => handleDeclineDispatch(d.id, b?.id || d.bookingId)}
                            disabled={isAccepting || decliningId === d.id}
                            activeOpacity={0.8}
                          >
                            {decliningId === d.id ? (
                              <ActivityIndicator size="small" color="#dc2626" />
                            ) : (
                              <>
                                <Ionicons name="close-circle-outline" size={17} color="#dc2626" style={{ marginRight: 4 }} />
                                <Text style={styles.declineDispatchBtnText}>
                                  {t('dashboard.decline_btn', { defaultValue: 'DECLINE' })}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.acceptDispatchBtn}
                            onPress={() => handleAcceptDispatch(d.id, b?.id || d.bookingId)}
                            disabled={isAccepting || decliningId === d.id}
                            activeOpacity={0.85}
                          >
                            {isAccepting ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <>
                                <Ionicons name="checkmark-circle" size={17} color="#ffffff" style={{ marginRight: 4 }} />
                                <Text style={styles.acceptDispatchBtnText}>
                                  {currentTrip
                                    ? t('dashboard.accept_queued_btn', { defaultValue: 'ACCEPT (QUEUED)' })
                                    : t('dashboard.accept_ride_btn', { defaultValue: 'ACCEPT RIDE' })}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Quick Access Dashboard Cards: Only shown when there are NO active trips or dispatches */}
            {!currentTrip && dispatches.length === 0 && upcomingBookings.length === 0 && (
              <View style={styles.dashboardCardsGrid}>
                {/* 1. Profile */}
                <TouchableOpacity
                  style={styles.dashboardCardItem}
                  onPress={() => setIsProfileModalOpen(true)}
                  activeOpacity={0.75}
                >
                  <View style={styles.dashboardCardIconBox}>
                    <Ionicons name="person" size={20} color="#0f2744" />
                  </View>
                  <View style={styles.dashboardCardTextBox}>
                    <Text style={styles.dashboardCardTitle} numberOfLines={1}>Profile</Text>
                    <Text style={styles.dashboardCardSub} numberOfLines={1}>Personal Details</Text>
                  </View>
                </TouchableOpacity>

                {/* 2. My Vehicle */}
                <TouchableOpacity
                  style={styles.dashboardCardItem}
                  onPress={() => setIsVehicleModalOpen(true)}
                  activeOpacity={0.75}
                >
                  <View style={styles.dashboardCardIconBox}>
                    <Ionicons name="car" size={20} color="#0f2744" />
                  </View>
                  <View style={styles.dashboardCardTextBox}>
                    <Text style={styles.dashboardCardTitle} numberOfLines={1}>My Vehicle</Text>
                    <Text style={styles.dashboardCardSub} numberOfLines={1}>Fleet & Cabs</Text>
                  </View>
                  {hasVehiclePendingDocs && (
                    <View style={styles.dashboardCardAlertBadge}>
                      <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    </View>
                  )}
                </TouchableOpacity>

                {/* 3. KYC */}
                <TouchableOpacity
                  style={styles.dashboardCardItem}
                  onPress={() => router.push('/documents')}
                  activeOpacity={0.75}
                >
                  <View style={styles.dashboardCardIconBox}>
                    <Ionicons name="document-text" size={20} color="#0f2744" />
                  </View>
                  <View style={styles.dashboardCardTextBox}>
                    <Text style={styles.dashboardCardTitle} numberOfLines={1}>KYC</Text>
                    <Text style={styles.dashboardCardSub} numberOfLines={1}>Documents & Verify</Text>
                  </View>
                  {hasKycPendingDocs && (
                    <View style={styles.dashboardCardAlertBadge}>
                      <Ionicons name="alert-circle" size={16} color="#ef4444" />
                    </View>
                  )}
                </TouchableOpacity>

                {/* 4. My Trips */}
                <TouchableOpacity
                  style={styles.dashboardCardItem}
                  onPress={() => setActiveBottomTab('MY_TRIPS')}
                  activeOpacity={0.75}
                >
                  <View style={styles.dashboardCardIconBox}>
                    <Ionicons name="receipt" size={20} color="#0f2744" />
                  </View>
                  <View style={styles.dashboardCardTextBox}>
                    <Text style={styles.dashboardCardTitle} numberOfLines={1}>My Trips</Text>
                    <Text style={styles.dashboardCardSub} numberOfLines={1}>History & Earnings</Text>
                  </View>
                </TouchableOpacity>

                {/* 5. Notifications */}
                <TouchableOpacity
                  style={styles.dashboardCardItem}
                  onPress={() => router.push('/notifications')}
                  activeOpacity={0.75}
                >
                  <View style={styles.dashboardCardIconBox}>
                    <Ionicons name="notifications" size={20} color="#0f2744" />
                  </View>
                  <View style={styles.dashboardCardTextBox}>
                    <Text style={styles.dashboardCardTitle} numberOfLines={2}>Notifications</Text>
                    <Text style={styles.dashboardCardSub} numberOfLines={1}>Alerts & Updates</Text>
                  </View>
                  {unreadUpdatesCount > 0 && (
                    <View style={styles.dashboardCardNotifBadge}>
                      <Text style={styles.dashboardCardNotifBadgeText}>
                        {unreadUpdatesCount > 9 ? '9+' : unreadUpdatesCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* 6. Help and Support */}
                <TouchableOpacity
                  style={styles.dashboardCardItem}
                  onPress={() => setActiveBottomTab('SUPPORT')}
                  activeOpacity={0.75}
                >
                  <View style={styles.dashboardCardIconBox}>
                    <Ionicons name="headset" size={20} color="#0f2744" />
                  </View>
                  <View style={styles.dashboardCardTextBox}>
                    <Text style={styles.dashboardCardTitle} numberOfLines={2}>Help & Support</Text>
                    <Text style={styles.dashboardCardSub} numberOfLines={1}>24/7 Helpline</Text>
                  </View>
                </TouchableOpacity>

                {/* 7. Terms and Condition */}
                <TouchableOpacity
                  style={styles.dashboardCardItem}
                  onPress={() => router.push('/terms')}
                  activeOpacity={0.75}
                >
                  <View style={styles.dashboardCardIconBox}>
                    <Ionicons name="shield-checkmark" size={20} color="#0f2744" />
                  </View>
                  <View style={styles.dashboardCardTextBox}>
                    <Text style={styles.dashboardCardTitle} numberOfLines={1}>Terms & Conditions</Text>
                    <Text style={styles.dashboardCardSub} numberOfLines={1}>Policies & Safety</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* TAB 2: MY TRIPS (Monthly Breakdown & Settlement Receipts)    */}
        {/* ============================================================ */}
        {activeBottomTab === 'MY_TRIPS' && (
          <View style={styles.tabSectionContainer}>
            {tripsLoading && !tripsLoaded ? (
              <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#ea580c" />
                <Text style={{ color: '#0f172a', marginTop: 14, fontWeight: '700', fontSize: 14 }}>
                  {t('trips.loading_title')}
                </Text>
                <Text style={{ color: '#64748b', marginTop: 4, fontSize: 12 }}>
                  {t('trips.loading_sub')}
                </Text>
              </View>
            ) : (
              <>
                {/* Month Selector Pills */}
                <View style={styles.monthSelectorBoxWhite}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthPillsScroll}>
                    {currentMonthSummary && (
                      <TouchableOpacity
                        style={[styles.monthPillWhite, selectedMonthKey === currentMonthSummary.monthKey && styles.monthPillActiveOrange]}
                        onPress={() => setSelectedMonthKey(currentMonthSummary.monthKey)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.monthPillTextDark, selectedMonthKey === currentMonthSummary.monthKey && styles.monthPillTextWhite]}>
                          {currentMonthSummary.shortMonth} ({t('trips.this_month')})
                        </Text>
                      </TouchableOpacity>
                    )}

                    {previousMonthSummary && (
                      <TouchableOpacity
                        style={[styles.monthPillWhite, selectedMonthKey === previousMonthSummary.monthKey && styles.monthPillActiveOrange]}
                        onPress={() => setSelectedMonthKey(previousMonthSummary.monthKey)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.monthPillTextDark, selectedMonthKey === previousMonthSummary.monthKey && styles.monthPillTextWhite]}>
                          {previousMonthSummary.shortMonth} ({t('trips.last_month')})
                        </Text>
                      </TouchableOpacity>
                    )}

                    {monthlyBreakdown
                      .filter((m) => m.monthKey !== currentMonthSummary?.monthKey && m.monthKey !== previousMonthSummary?.monthKey)
                      .map((m) => (
                        <TouchableOpacity
                          key={m.monthKey}
                          style={[styles.monthPillWhite, selectedMonthKey === m.monthKey && styles.monthPillActiveOrange]}
                          onPress={() => setSelectedMonthKey(m.monthKey)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.monthPillTextDark, selectedMonthKey === m.monthKey && styles.monthPillTextWhite]}>
                            {m.shortMonth}
                          </Text>
                        </TouchableOpacity>
                      ))}

                    <TouchableOpacity
                      style={[styles.monthPillWhite, selectedMonthKey === 'ALL' && styles.monthPillActiveOrange]}
                      onPress={() => setSelectedMonthKey('ALL')}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.monthPillTextDark, selectedMonthKey === 'ALL' && styles.monthPillTextWhite]}>
                        {t('trips.all_time')}
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                {/* KPI Summary Card */}
                <View style={styles.earningsKpiCardWhite}>
                  <View style={styles.kpiHeaderRow}>
                    <Text style={styles.kpiHeaderLabelOrange}>
                      {selectedMonthKey === 'ALL'
                        ? t('trips.all_time_trips')
                        : selectedMonthKey === currentMonthSummary?.monthKey
                        ? `${t('trips.this_month_caps')} (${(currentMonthSummary.monthName || '').toUpperCase()})`
                        : `${(selectedMonthKey).toUpperCase()} ${t('trips.trips_caps')}`}
                    </Text>
                    <View style={styles.kpiTripsCountBadgeLight}>
                      <Text style={styles.kpiTripsCountTextGreen}>{activeKpiSummary.completedTripsCount || 0} {t('trips.completed_trips_count')}</Text>
                    </View>
                  </View>

                  <View style={styles.kpiSettlementRowLight}>
                    <View style={styles.kpiSettledPillLight}>
                      <Text style={styles.kpiSettledLabel}>{t('trips.paid_trips')}</Text>
                      <Text style={styles.kpiSettledCountText}>{activeKpiSummary.paidTripsCount || 0} {t('trips.settled')}</Text>
                    </View>
                    <View style={styles.kpiPendingPillLight}>
                      <Text style={styles.kpiPendingLabel}>{t('trips.not_paid_trips')}</Text>
                      <Text style={styles.kpiPendingCountText}>{activeKpiSummary.unpaidTripsCount || 0} {t('trips.pending')}</Text>
                    </View>
                  </View>
                </View>

                {/* Trips List */}
                <View style={styles.tripsHeaderRow}>
                  <Text style={styles.tripsHeaderTitleDark}>
                    {t('trips.trip_history')} ({filteredTrips.length}{selectedMonthKey !== 'ALL' ? ` ${t('trips.in_selected_month')}` : ''})
                  </Text>
                  <TouchableOpacity onPress={() => fetchTripsData(true)} style={styles.refreshBtnLight} disabled={tripsLoading}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="refresh" size={12} color="#162232" />
                      <Text style={styles.refreshBtnTextOrange}>
                        {tripsLoading ? t('trips.refreshing') : t('trips.refresh')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

            {filteredTrips.length === 0 ? (
              <View style={styles.emptyCardWhite}>
                <View style={{ marginBottom: 10 }}>
                  <Ionicons name="receipt-outline" size={40} color="#94a3b8" />
                </View>
                <Text style={styles.emptyCardTitleDark}>{t('trips.no_trips_title')}</Text>
                <Text style={styles.emptyCardSubtitleDark}>
                  {selectedMonthKey === 'ALL'
                    ? t('trips.no_trips_all')
                    : t('trips.no_trips_month', { month: selectedMonthKey })}
                </Text>
              </View>
            ) : (
              filteredTrips.map((trip) => {
                const isSettled = trip.driverPaymentStatus === 'PAID';
                const isCompleted = trip.status === 'TRIP_COMPLETED';
                const vendorCost = Math.round(
                  Number(trip.driverPayeeAmount || 0) > 0
                    ? Number(trip.driverPayeeAmount)
                    : (Number(trip.distanceKm || 0) * 13 + (Number(trip.driverAllowance) || 300))
                );

                return (
                  <View key={trip.id} style={styles.tripCardWhiteBorder}>
                    <View style={styles.tripCardTopRow}>
                      <View>
                        <Text style={styles.tripCardRef}>{trip.humanReadableRef}</Text>
                        <Text style={styles.tripCardDate}>
                          {new Date(trip.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })} • {trip.tripType}
                        </Text>
                      </View>
                      <View style={styles.tripStatusBadgeGroup}>
                        <View style={[styles.tripBadgePill, isCompleted ? styles.badgeGreen : styles.badgeAmber]}>
                          <Text style={isCompleted ? styles.badgeTextGreen : styles.badgeTextAmber}>
                            {trip.status.replace(/_/g, ' ')}
                          </Text>
                        </View>
                        <View style={[styles.settledBadgePill, isSettled ? styles.badgeGreen : styles.badgeAmber]}>
                          <Text style={isSettled ? styles.badgeTextGreen : styles.badgeTextAmber}>
                            {isSettled ? t('trips.paid') : t('trips.not_paid')}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.tripCardRoute}>
                      <Text style={styles.tripRouteLine} numberOfLines={1}>
                        <Text style={{ fontWeight: '700' }}>{t('trips.pickup')} </Text>{trip.pickupAddress}
                      </Text>
                      <Text style={styles.tripRouteLine} numberOfLines={1}>
                        <Text style={{ fontWeight: '700' }}>{t('trips.drop')} </Text>{trip.dropAddress}
                      </Text>
                      <View style={styles.tripRouteMetaRow}>
                        <Text style={styles.tripDistanceLine}>
                          <Text style={{ fontWeight: '700' }}>{t('trips.distance')} </Text>{trip.distanceKm} km
                        </Text>
                        <Text style={styles.tripRouteVendorCostText}>
                          ₹{vendorCost.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.tripPaymentStatusRow}>
                      <View>
                        <Text style={styles.tripPaymentStatusLabel}>{t('trips.driver_payment_status')}</Text>
                        <Text style={styles.tripPaymentVendorCostSub}>
                          Driver Amount: <Text style={{ fontWeight: '900', color: '#0f2744' }}>₹{vendorCost.toLocaleString('en-IN')}</Text>
                        </Text>
                      </View>
                      <View style={[styles.settledBadgePillInline, isSettled ? styles.badgeGreen : styles.badgeAmber]}>
                        <Text style={isSettled ? styles.badgeTextGreen : styles.badgeTextAmber}>
                          {isSettled ? `✓ ${t('trips.paid')}` : `⏳ ${t('trips.not_paid')}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
            </>
          )}
          </View>
        )}

        {/* ============================================================ */}
        {/* TAB 3: SUPPORT (24x7 Helpline, WhatsApp & SOS)               */}
        {/* ============================================================ */}
        {activeBottomTab === 'SUPPORT' && (
          <View style={styles.tabSectionContainer}>
            <View style={styles.supportHeaderCardWhite}>
              <View style={{ marginBottom: 6 }}>
                <Ionicons name="headset-outline" size={32} color="#0f2744" />
              </View>
              <Text style={styles.supportHeaderTitleDark}>{t('support.header_title')}</Text>
              <Text style={styles.supportHeaderSubtitleDark}>
                {t('support.header_subtitle')}
              </Text>
            </View>

            {/* Helpline Card */}
            <TouchableOpacity
              style={styles.supportActionCardWhite}
              onPress={() => Linking.openURL('tel:+919880933504')}
              activeOpacity={0.8}
            >
              <View style={styles.supportActionIconCircleGreen}>
                <Ionicons name="call" size={20} color="#0f172a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportActionTitle}>{t('support.helpline_title')}</Text>
                <Text style={styles.supportActionSubtitle}>{t('support.helpline_subtitle')}</Text>
                <Text style={styles.supportActionPhone}>+91 98809 33504</Text>
              </View>
              <Text style={styles.supportActionArrow}>›</Text>
            </TouchableOpacity>

            {/* WhatsApp Card */}
            <TouchableOpacity
              style={styles.supportActionCardWhite}
              onPress={() => Linking.openURL('https://wa.me/919880933504?text=Hello%20Kandy%20Cabs%20Driver%20Support')}
              activeOpacity={0.8}
            >
              <View style={styles.supportActionIconCircleEmerald}>
                <Ionicons name="logo-whatsapp" size={22} color="#16a34a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportActionTitle}>{t('support.whatsapp_title')}</Text>
                <Text style={styles.supportActionSubtitle}>{t('support.whatsapp_subtitle')}</Text>
                <Text style={styles.supportActionEmeraldText}>{t('support.whatsapp_response')}</Text>
              </View>
              <Text style={styles.supportActionArrow}>›</Text>
            </TouchableOpacity>

            {/* Emergency SOS */}
            <TouchableOpacity
              style={styles.supportSosCard}
              onPress={() => {
                Alert.alert(
                  t('support.sos_alert_title'),
                  t('support.sos_alert_msg'),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('support.call_112'), style: 'destructive', onPress: () => Linking.openURL('tel:112') },
                  ]
                );
              }}
              activeOpacity={0.8}
            >
              <View style={styles.sosIconBox}>
                <Ionicons name="warning" size={18} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sosTitle}>{t('support.sos_title')}</Text>
                <Text style={styles.sosSubtitle}>{t('support.sos_subtitle')}</Text>
              </View>
            </TouchableOpacity>

            {/* Driver Policy & FAQs */}
            <View style={styles.faqBoxWhite}>
              <Text style={styles.faqTitleOrange}>{t('support.guidelines_title')}</Text>
              <Text style={styles.faqItemDark}>• <Text style={{ fontWeight: '700' }}>{t('support.night_charges_label')}</Text>{t('support.night_charges_desc')}</Text>
              <Text style={styles.faqItemDark}>• <Text style={{ fontWeight: '700' }}>{t('support.toll_parking_label')}</Text>{t('support.toll_parking_desc')}</Text>
              <Text style={styles.faqItemDark}>• <Text style={{ fontWeight: '700' }}>{t('support.customer_otp_label')}</Text>{t('support.customer_otp_desc')}</Text>
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* TAB 4: PROFILE (Credentials, Vehicle & Sign Out)            */}
        {/* ============================================================ */}
        {activeBottomTab === 'PROFILE' && (
          <View style={styles.tabSectionContainer}>
            {/* 1. Driver Hero Card */}
            <TouchableOpacity
              style={styles.profileHeroCardWhite}
              onPress={() => setIsProfileModalOpen(true)}
              activeOpacity={0.85}
            >
              <View style={styles.profileHeroAvatarOuter}>
                <View style={styles.profileHeroAvatarInner}>
                  <Image
                    source={{ uri: driver?.profilePhotoUrl || CAPTAIN_AVATAR_BASE64 }}
                    style={styles.profileHeroAvatarImg}
                    resizeMode="cover"
                  />
                </View>
                {/* Camera icon badge */}
                <TouchableOpacity
                  style={styles.profileHeroCameraBadge}
                  onPress={() => setIsProfileModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={11} color="#0f2744" />
                </TouchableOpacity>
                {/* Status indicator dot - only shown when driver is verified */}
                {!hasPendingDocuments && driver?.verificationStatus === 'APPROVED' && (
                  <View style={[styles.profileHeroOnlineDot, { backgroundColor: onlineStatus ? '#22c55e' : '#94a3b8' }]} />
                )}
              </View>

              <View style={styles.profileHeroInfo}>
                <Text style={styles.profileHeroName} numberOfLines={1}>
                  {driver?.fullName || (driver?.phone ? `Partner (${driver.phone.replace(/\D/g, '').slice(-4)})` : 'Driver Partner')}
                </Text>
                <View style={styles.profileHeroPhoneRow}>
                  <Ionicons name="call" size={12} color="#64748b" style={{ marginRight: 5 }} />
                  <Text style={styles.profileHeroPhone}>
                    {driver?.phone ? (driver.phone.startsWith('+91') ? driver.phone : `+91 ${driver.phone}`) : ''}
                  </Text>
                </View>
                <View style={styles.profileHeroRatingPill}>
                  <Ionicons name="star" size={11} color="#f59e0b" style={{ marginRight: 3 }} />
                  <Text style={styles.profileHeroRatingText}>4.9 Rating</Text>
                </View>
              </View>

              <View style={styles.profileHeroChevronBtn}>
                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
              </View>
            </TouchableOpacity>

            {/* ============================================================ */}
            {/* 6 PROFILE SECTIONS - CLEAN & MODULAR (NO MORE CONGESTION)     */}
            {/* ============================================================ */}
            <View style={styles.profileSectionsList}>
              {/* 1. MY PROFILE */}
              <TouchableOpacity
                style={styles.profileSectionItem}
                onPress={() => setIsProfileModalOpen(true)}
                activeOpacity={0.7}
              >
                <View style={styles.profileSectionIconBox}>
                  <Ionicons name="person" size={22} color="#0f2744" />
                </View>
                <View style={styles.profileSectionTextBox}>
                  <Text style={styles.profileSectionTitle}>My Profile</Text>
                </View>
              </TouchableOpacity>

              {/* 2. MY VEHICLE */}
              <TouchableOpacity
                style={styles.profileSectionItem}
                onPress={() => setIsVehicleModalOpen(true)}
                activeOpacity={0.7}
              >
                <View style={styles.profileSectionIconBox}>
                  <Ionicons name="car-sport" size={22} color="#0f2744" />
                </View>
                <View style={styles.profileSectionTextBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.profileSectionTitle}>My Vehicle</Text>
                    {hasVehiclePendingDocs && (
                      <Ionicons name="alert-circle" size={17} color="#dc2626" />
                    )}
                  </View>
                </View>
              </TouchableOpacity>

              {/* 3. DOCUMENTS AND KYC */}
              <TouchableOpacity
                style={styles.profileSectionItem}
                onPress={() => router.push('/documents')}
                activeOpacity={0.7}
              >
                <View style={styles.profileSectionIconBox}>
                  <Ionicons name="document-text" size={22} color="#0f2744" />
                </View>
                <View style={styles.profileSectionTextBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.profileSectionTitle}>Documents and KYC</Text>
                    {hasKycPendingDocs && (
                      <Ionicons name="alert-circle" size={17} color="#dc2626" />
                    )}
                  </View>
                </View>
              </TouchableOpacity>

              {/* 4. PAYMENT */}
              <TouchableOpacity
                style={styles.profileSectionItem}
                onPress={() => router.push('/payout-details')}
                activeOpacity={0.7}
              >
                <View style={styles.profileSectionIconBox}>
                  <Ionicons name="wallet" size={22} color="#0f2744" />
                </View>
                <View style={styles.profileSectionTextBox}>
                  <Text style={styles.profileSectionTitle}>Payment</Text>
                </View>
              </TouchableOpacity>

              {/* 5. NOTIFICATIONS */}
              <TouchableOpacity
                style={styles.profileSectionItem}
                onPress={() => router.push('/notifications')}
                activeOpacity={0.7}
              >
                <View style={styles.profileSectionIconBox}>
                  <Ionicons name="notifications" size={22} color="#0f2744" />
                </View>
                <View style={styles.profileSectionTextBox}>
                  <Text style={styles.profileSectionTitle}>Notifications</Text>
                </View>
              </TouchableOpacity>

              {/* 6. HELP AND SUPPORT */}
              <TouchableOpacity
                style={styles.profileSectionItem}
                onPress={() => setActiveBottomTab('SUPPORT')}
                activeOpacity={0.7}
              >
                <View style={styles.profileSectionIconBox}>
                  <Ionicons name="headset" size={22} color="#0f2744" />
                </View>
                <View style={styles.profileSectionTextBox}>
                  <Text style={styles.profileSectionTitle}>Help and Support</Text>
                </View>
              </TouchableOpacity>

              {/* 7. TERMS AND CONDITIONS */}
              <TouchableOpacity
                style={styles.profileSectionItem}
                onPress={() => router.push('/terms')}
                activeOpacity={0.7}
              >
                <View style={styles.profileSectionIconBox}>
                  <Ionicons name="shield-checkmark" size={22} color="#0f2744" />
                </View>
                <View style={styles.profileSectionTextBox}>
                  <Text style={styles.profileSectionTitle}>Terms and Conditions</Text>
                </View>
              </TouchableOpacity>

              {/* 8. APP LANGUAGE */}
              <TouchableOpacity
                style={styles.profileSectionItem}
                onPress={() => setIsLangModalOpen(true)}
                activeOpacity={0.7}
              >
                <View style={styles.profileSectionIconBox}>
                  <Ionicons name="globe" size={22} color="#0f2744" />
                </View>
                <View style={styles.profileSectionTextBox}>
                  <Text style={styles.profileSectionTitle}>App Language</Text>
                </View>
              </TouchableOpacity>

              {/* 9. LOGOUT */}
              <TouchableOpacity
                style={[styles.profileSectionItem, styles.profileSectionLogout]}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <View style={styles.profileSectionIconBox}>
                  <Ionicons name="log-out" size={22} color="#dc2626" />
                </View>
                <View style={styles.profileSectionTextBox}>
                  <Text style={[styles.profileSectionTitle, { color: '#dc2626' }]}>Logout</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Modals */}
            <DriverProfileModal
              visible={isProfileModalOpen}
              onClose={() => setIsProfileModalOpen(false)}
              driver={driver}
              onSaveProfile={handleSaveProfile}
            />

            <DriverVehiclesModal
              visible={isVehicleModalOpen}
              onClose={() => setIsVehicleModalOpen(false)}
              vehicles={registeredFleets}
              onSaveVehicles={handleSaveVehicles}
              onOpenDocuments={(vehIdx) => router.push({ pathname: '/documents', params: { vehicleIndex: String(vehIdx), fromVehicle: 'true' } })}
            />





            {/* Language Selection Modal (As done in Customer App) */}
            <LanguageSelectionModal
              visible={isLangModalOpen}
              onClose={() => setIsLangModalOpen(false)}
            />

            <Text style={styles.versionTextDark}>Kandy Cabs Driver App v1.0.0</Text>
          </View>
        )}
      </ScrollView>

      {/* ============================================================ */}
      {/* BOTTOM NAVIGATION BAR (HOME, MY TRIPS, SUPPORT, PROFILE)     */}
      {/* ============================================================ */}
      <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {/* Home Tab */}
        <TouchableOpacity
          style={styles.bottomNavTab}
          onPress={() => setActiveBottomTab('HOME')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeBottomTab === 'HOME' ? 'home' : 'home-outline'}
            size={22}
            color={activeBottomTab === 'HOME' ? '#f0750f' : '#94a3b8'}
          />
          <Text style={[styles.bottomNavText, activeBottomTab === 'HOME' && styles.bottomNavTextActive]}>
            {t('tabs.home')}
          </Text>
          {activeBottomTab === 'HOME' && <View style={styles.bottomActiveBar} />}
        </TouchableOpacity>

        {/* My Trips Tab */}
        <TouchableOpacity
          style={styles.bottomNavTab}
          onPress={() => setActiveBottomTab('MY_TRIPS')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeBottomTab === 'MY_TRIPS' ? 'receipt' : 'receipt-outline'}
            size={22}
            color={activeBottomTab === 'MY_TRIPS' ? '#f0750f' : '#94a3b8'}
          />
          <Text style={[styles.bottomNavText, activeBottomTab === 'MY_TRIPS' && styles.bottomNavTextActive]}>
            {t('tabs.my_trips')}
          </Text>
          {activeBottomTab === 'MY_TRIPS' && <View style={styles.bottomActiveBar} />}
        </TouchableOpacity>

        {/* Support Tab */}
        <TouchableOpacity
          style={styles.bottomNavTab}
          onPress={() => setActiveBottomTab('SUPPORT')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeBottomTab === 'SUPPORT' ? 'headset' : 'headset-outline'}
            size={22}
            color={activeBottomTab === 'SUPPORT' ? '#f0750f' : '#94a3b8'}
          />
          <Text style={[styles.bottomNavText, activeBottomTab === 'SUPPORT' && styles.bottomNavTextActive]}>
            {t('tabs.support')}
          </Text>
          {activeBottomTab === 'SUPPORT' && <View style={styles.bottomActiveBar} />}
        </TouchableOpacity>

        {/* Profile Tab */}
        <TouchableOpacity
          style={styles.bottomNavTab}
          onPress={() => setActiveBottomTab('PROFILE')}
          activeOpacity={0.7}
        >
          <View style={styles.tabIconWrapper}>
            <Ionicons
              name={activeBottomTab === 'PROFILE' ? 'person' : 'person-outline'}
              size={22}
              color={activeBottomTab === 'PROFILE' ? '#f0750f' : '#94a3b8'}
            />
            <View style={styles.profilePendingNotificationBadge}>
              <Text style={styles.profilePendingNotificationBadgeText}>1</Text>
            </View>
          </View>
          <Text style={[styles.bottomNavText, activeBottomTab === 'PROFILE' && styles.bottomNavTextActive]}>
            {t('tabs.profile')}
          </Text>
          {activeBottomTab === 'PROFILE' && <View style={styles.bottomActiveBar} />}
        </TouchableOpacity>
      </View>
      {/* Universal Updates & Notifications Modal */}
      <NotificationsModal
        visible={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        dispatches={dispatches}
        activeBooking={activeBooking}
        upcomingBookings={upcomingBookings}
        driver={driver}
        onlineStatus={onlineStatus}
        onSelectDispatch={() => {
          setActiveBottomTab('HOME');
        }}
        onSelectBooking={() => {
          setActiveBottomTab('HOME');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  bgProtectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  bgProtectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bgProtectionPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16a34a',
  },
  bgProtectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#15803d',
    flex: 1,
  },
  bgProtectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  bgProtectionAction: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#008860',
  },
  mainHeaderWhite: {
    backgroundColor: '#162232',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    paddingLeft: 14,
    paddingRight: 16,
    paddingBottom: 1,
    zIndex: 50,
  },
  headerBarInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerLogoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  driverHeaderLogo: {
    width: 80,
    height: 41,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 2,
    gap: 10,
  },
  notificationBellHeader: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#ea580c',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#0f2744',
    zIndex: 10,
    elevation: 4,
  },
  notificationBellBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 12,
  },
  avatarRingHeader: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarFallbackIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImageHeader: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarNotificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#f97316',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarNotificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  homeTabWrapper: {
    paddingBottom: 24,
  },
  heroCardOuter: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    backgroundColor: '#ffffff',
  },
  heroCardBg: {
    width: '100%',
    height: 146,
    justifyContent: 'center',
  },
  heroCardContent: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    zIndex: 2,
  },
  heroCardLeft: {
    maxWidth: '56%',
  },
  heroAvatarNameBlock: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    minWidth: 50,
  },
  heroAvatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    shadowColor: '#0f2744',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 1.5 },
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 3,
  },
  heroAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  heroAvatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  heroCardName: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#0a192f',
    letterSpacing: -0.2,
    lineHeight: 20,
    textAlign: 'center',
  },
  heroCardPlateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
    marginBottom: 4,
  },
  heroCardPlate: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0a192f',
    letterSpacing: 0.3,
  },
  heroDutyToggleTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    padding: 2,
    marginTop: 2,
    alignSelf: 'flex-start',
    shadowColor: '#0f2744',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1.5 },
    shadowRadius: 3,
    elevation: 2,
  },
  heroDutyToggleSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 16,
  },
  heroDutyToggleSegmentOnlineActive: {
    backgroundColor: '#046a38',
    shadowColor: '#046a38',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 1.5 },
    shadowRadius: 2.5,
    elevation: 2,
  },
  heroDutyToggleSegmentOfflineActive: {
    backgroundColor: '#991b1b',
    shadowColor: '#991b1b',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 1.5 },
    shadowRadius: 2.5,
    elevation: 2,
  },
  heroDutyToggleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4.5,
  },
  heroDutyToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.2,
  },
  heroDutyToggleTextActive: {
    color: '#ffffff',
  },
  homeCardsContainer: {
    marginTop: 12,
    paddingHorizontal: 14,
    zIndex: 20,
  },
  stickyTopBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  stickyHeaderBackdropWhite: {
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  heroBannerContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  heroBannerBackground: {
    width: '100%',
  },
  heroOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  compactHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  miniDutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  miniDutyBadgeOnline: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  miniDutyBadgeOffline: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  miniDutyText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroBrandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: -32,
  },
  kandyCabsLogo: {
    height: 46,
    width: 155,
  },
  chauffeurBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1.5,
    borderColor: '#ea580c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chauffeurBadgeText: {
    color: '#ea580c',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  heroTopRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarRingTop: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  avatarEmojiTop: {
    fontSize: 20,
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  bellIcon: {
    fontSize: 16,
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ea580c',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  heroContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroSloganBox: {
    flex: 1,
    paddingRight: 10,
  },
  heroSloganWhite: {
    fontSize: 27,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 31,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroSloganOrange: {
    fontSize: 27,
    fontWeight: '900',
    color: '#ea580c',
    lineHeight: 31,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroSloganSub: {
    fontSize: 9,
    fontWeight: '800',
    color: '#cbd5e1',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  heroBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  heroGpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.9)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroGpsText: {
    fontSize: 11.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#ffffff',
  },
  heroDriverBox: {
    alignItems: 'flex-start',
  },
  avatarRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 5,
    position: 'relative',
  },
  avatarPhotoClipper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  avatarEmoji: {
    fontSize: 34,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  heroDriverName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroVehiclePlate: {
    fontSize: 12,
    fontWeight: '800',
    color: '#e2e8f0',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroVehicleModel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#cbd5e1',
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroTierBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#facc15',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dutyCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  dutyCapsuleOnline: {
    backgroundColor: 'rgba(6, 78, 59, 0.88)',
    borderColor: '#10b981',
  },
  dutyCapsuleOffline: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderColor: '#ef4444',
  },
  dutyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dutyCapsuleText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  gpsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  gpsBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  gpsDotActive: {
    backgroundColor: '#10b981',
  },
  gpsDotInactive: {
    backgroundColor: '#64748b',
  },
  gpsCoordsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  gpsRefreshBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gpsRefreshText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },
  mainScrollView: {
    flex: 1,
    backgroundColor: '#f8fafc',
    zIndex: 10,
  },
  mainScrollViewHome: {
    backgroundColor: 'transparent',
    zIndex: 10,
    marginTop: 0,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: Platform.OS === 'android' ? 78 : 88,
  },
  scrollContentHome: {
    padding: 0,
    paddingBottom: Platform.OS === 'android' ? 78 : 88,
  },
  scrollContentProfile: {
    padding: 14,
    paddingBottom: Platform.OS === 'android' ? 76 : 84,
  },
  cardWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
    marginBottom: 20,
    zIndex: 20,
  },
  subTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  subTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    position: 'relative',
  },
  subTabItemActive: {
    backgroundColor: '#ffffff',
  },
  subTabEmoji: {
    fontSize: 14,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  subTabTextActive: {
    color: '#ea580c',
    fontWeight: '900',
  },
  subTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    right: 12,
    height: 3,
    backgroundColor: '#ea580c',
    borderRadius: 2,
  },
  tripCardContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  bookingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingIdLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  bookingIdNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ea580c',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  onRouteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  onRouteDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#d97706',
  },
  onRouteBadgeText: {
    color: '#b45309',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  onRouteBadgeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  onRouteDotWarning: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#dc2626',
  },
  onRouteBadgeTextWarning: {
    color: '#b91c1c',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  timingNearWarningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  timingNearWarningText: {
    fontSize: 11.5,
    color: '#dc2626',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  onTripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  onTripDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16a34a',
  },
  onTripBadgeText: {
    color: '#15803d',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginVertical: 4,
  },
  stepperLeft: {
    flex: 1,
  },
  stepperViewRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  stepperViewRouteText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
  },
  stepPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  pickupPin: {
    marginTop: 1,
  },
  dropPin: {
    marginTop: 1,
  },
  pickupCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16a34a',
    marginTop: 2,
  },
  dropCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#dc2626',
    marginTop: 2,
  },
  dashedTrail: {
    width: 2,
    height: 18,
    backgroundColor: '#cbd5e1',
    marginLeft: 7,
    marginVertical: 2,
  },
  stepTextGroup: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  locationSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  stopNumCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stopNumText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400e',
  },
  stopSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
    marginTop: 1,
  },
  tripDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingVertical: 5,
    marginTop: 6,
    marginBottom: 2,
  },
  tripDateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    flexWrap: 'wrap',
  },
  tripDateBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369a1',
    letterSpacing: 0.5,
  },
  tripDateBannerValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  todayTagPill: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 6,
  },
  todayTagText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  tomorrowTagPill: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tomorrowTagText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  dispatchReqsSection: {
    paddingHorizontal: 2,
    paddingVertical: 7,
    marginTop: 6,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dispatchReqsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  dispatchReqsHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dispatchReqsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
  },
  reqPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
  },
  reqPillHighlight: {},
  reqPillWarning: {},
  reqPillInfo: {},
  reqLineSeparator: {
    width: 1,
    height: 12,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  reqPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  reqPillTextHighlight: {
    color: '#c2410c',
  },
  reqPillTextWarning: {
    color: '#b45309',
  },
  reqPillTextInfo: {
    color: '#1d4ed8',
  },
  dispatchNotesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  dispatchNotesText: {
    flex: 1,
    fontSize: 11,
    fontStyle: 'italic',
    color: '#475569',
  },
  infoThreeColsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoThreeCol: {
    flex: 1,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  infoColDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 2,
    marginHorizontal: 2,
  },
  infoColHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginBottom: 4,
    width: '100%',
  },
  infoColHeaderLabel: {
    fontSize: 8.5,
    color: '#64748b',
    fontWeight: '700',
    textAlign: 'center',
  },
  infoColValDark: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 16,
    textAlign: 'center',
  },
  infoColSubPhone: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
  },
  rupeeCircleBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rupeeCircleText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '900',
    lineHeight: 11,
  },
  infoFareValBold: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
    textAlign: 'center',
  },
  advancePaidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  advancePaidLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  advancePaidLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '700',
  },
  advancePaidValue: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#059669',
    marginTop: 1,
  },
  primaryButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  blueInspectionBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  inspectionBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  greenStartTripBtn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  onTripBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  greenBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  creamViewRouteBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  creamBtnText: {
    color: '#ea580c',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  quickActionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    borderRadius: 20,
  },
  quickActionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyCardInner: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  upcomingBookingItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  upcomingBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  upcomingBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 0.2,
  },
  infoColTopLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  infoColLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
  },
  infoColMainText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  lockedUpcomingStartBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  lockedUpcomingStartText: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  availableQueueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  availableQueueBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
  },
  separateQueuedCardWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    overflow: 'hidden',
    zIndex: 15,
  },
  separateQueuedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  separateQueuedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  separateQueuedTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  queuedBadgeLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  queuedBadgeTextLight: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
  },
  separateQueuedCardBody: {
    padding: 16,
    gap: 14,
  },
  separateQueuedItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyCardInnerEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyCardInnerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyCardInnerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  dispatchesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dispatchesCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  dispatchesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardHeaderDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    width: '100%',
  },
  dispatchesTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  dispatchesCount: {
    color: '#64748b',
    fontWeight: '500',
  },
  pausedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pausedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  listeningBadgeLight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  listeningTextLight: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  listeningDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  offlineBoxWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 16,
  },
  offlineCardBody: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  offDutyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  offDutyPauseBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  offDutyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  offDutySubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 290,
  },
  goDutyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f2744',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 18,
    shadowColor: '#0f2744',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  goDutyGreenDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#22c55e',
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  goDutyBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  /* Quick Access Dashboard Cards */
  dashboardCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 20,
  },
  dashboardCardItem: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: '#eef2f6',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    minHeight: 72,
  },
  dashboardCardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f0f5ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  dashboardCardTextBox: {
    flex: 1,
    justifyContent: 'center',
  },
  dashboardCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f2744',
    letterSpacing: 0.1,
    lineHeight: 16,
  },
  dashboardCardSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  dashboardCardChevron: {
    marginLeft: 2,
    flexShrink: 0,
  },
  dashboardCardItemFull: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: '#eef2f6',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    minHeight: 72,
  },
  dashboardCardAlertBadge: {
    position: 'absolute',
    top: 7,
    right: 8,
  },
  dashboardCardNotifBadge: {
    position: 'absolute',
    top: 7,
    right: 8,
    backgroundColor: '#ea580c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  dashboardCardNotifBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  radarCardWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 16,
  },
  radarCardBody: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  radarIconCircleDark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  radarTitleDark: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f2744',
    textAlign: 'center',
  },
  radarSubtitleDark: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 300,
  },
  radarPillOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  radarPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0f2744',
    marginRight: 8,
  },
  radarPillTextOrange: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f2744',
  },
  floatingDispatchCardWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dispatchHeaderBanner: {
    backgroundColor: '#f8fafc',
    marginHorizontal: -14,
    marginTop: -14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 10,
  },
  dispatchHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  newAlertText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0f2744',
    letterSpacing: 0.3,
  },
  dispatchRefText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f2744',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  distanceBadgeLight: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  distanceBadgeTextLight: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f2744',
  },
  dispatchPassengerRowLight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dispatchPassengerNameDark: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  dispatchTripTypeOrange: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ea580c',
  },
  dispatchVendorAmountCenter: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  otherTripsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  otherTripsHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  lockedTripBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  lockedTripBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  dispatchActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  declineDispatchBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineDispatchBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
    letterSpacing: 0.5,
  },
  acceptDispatchBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  acceptDispatchBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  verificationDispatchBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#059669',
    borderWidth: 1.5,
    borderColor: '#34d399',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  verificationDispatchBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  verificationSlideGreenBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    borderWidth: 1.5,
    borderColor: '#34d399',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  verificationSlideGreenBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  acceptDispatchBtnGreen: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  manageActiveTripBtn: {
    width: '100%',
    backgroundColor: '#16a34a',
    borderRadius: 26,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  manageActiveTripBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  acceptDispatchArrow: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  tabSectionContainer: {
    gap: 12,
  },
  monthSelectorBoxWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthSelectorLabelDark: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 8,
  },
  monthPillsScroll: {
    gap: 8,
  },
  monthPillWhite: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthPillActiveOrange: {
    backgroundColor: '#162232',
    borderColor: '#162232',
  },
  monthPillTextDark: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  monthPillTextWhite: {
    color: '#ffffff',
    fontWeight: '900',
  },
  earningsKpiCardWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiHeaderLabelOrange: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#162232',
  },
  kpiTripsCountBadgeLight: {
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  kpiTripsCountTextGreen: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  kpiTotalEarningsAmountDark: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginVertical: 4,
  },
  kpiSubBreakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  kpiSubTextDark: {
    fontSize: 11,
    color: '#64748b',
  },
  kpiSettlementRowLight: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  kpiSettledPillLight: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  kpiSettledLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#059669',
  },
  kpiSettledCountText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669',
    marginTop: 2,
  },
  kpiPendingPillLight: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  kpiPendingLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#b45309',
  },
  kpiPendingCountText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#b45309',
    marginTop: 2,
  },
  tripsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  tripsHeaderTitleDark: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  refreshBtnLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  refreshBtnTextOrange: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#162232',
  },
  emptyCardWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyCardEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  emptyCardTitleDark: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyCardSubtitleDark: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  tripCardWhiteBorder: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tripCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tripCardRef: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tripCardDate: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
  },
  tripStatusBadgeGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  tripBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  settledBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  badgeGreen: {
    backgroundColor: '#dcfce7',
  },
  badgeAmber: {
    backgroundColor: '#fef3c7',
  },
  badgeTextGreen: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
  },
  badgeTextAmber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  tripCardRoute: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    marginVertical: 8,
  },
  tripRouteLine: {
    fontSize: 13,
    color: '#0f172a',
    marginVertical: 2,
    lineHeight: 19,
  },
  tripDistanceLine: {
    fontSize: 12,
    color: '#64748b',
  },
  tripRouteMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  tripRouteVendorCostText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f2744',
  },
  tripPaymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    marginTop: 8,
  },
  tripPaymentStatusLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  tripPaymentVendorCostSub: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  settledBadgePillInline: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 6,
  },
  supportHeaderCardWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  supportHeaderEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  supportHeaderTitleDark: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  supportHeaderSubtitleDark: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  supportActionCardWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  supportActionIconCircleGreen: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportActionIconCircleEmerald: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportActionIcon: {
    fontSize: 20,
  },
  supportActionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  supportActionSubtitle: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  supportActionPhone: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    marginTop: 2,
  },
  supportActionEmeraldText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    marginTop: 2,
  },
  supportActionArrow: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '800',
  },
  supportSosCard: {
    backgroundColor: '#450a0a',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#b91c1c',
  },
  sosIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7f1d1d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosIcon: {
    fontSize: 20,
  },
  sosTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fecaca',
  },
  sosSubtitle: {
    fontSize: 10,
    color: '#fca5a5',
    marginTop: 1,
  },
  faqBoxWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  faqTitleOrange: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ea580c',
    marginBottom: 6,
  },
  faqItemDark: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
    marginVertical: 2,
  },
  profileHeroCardWhite: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 16,
  },
  profileHeroAvatarOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: '#ea580c',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileHeroAvatarInner: {
    width: 63,
    height: 63,
    borderRadius: 31.5,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeroAvatarImg: {
    width: '100%',
    height: '100%',
  },
  profileHeroAvatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeroCameraBadge: {
    position: 'absolute',
    bottom: -2,
    left: 24,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  profileHeroOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 0,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileHeroInfo: {
    marginLeft: 14,
    flex: 1,
  },
  profileHeroName: {
    color: '#0f2744',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  profileHeroRole: {
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 1,
  },
  profileHeroPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  profileHeroPhone: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  profileHeroRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  profileHeroRatingText: {
    color: '#b45309',
    fontSize: 11.5,
    fontWeight: '700',
  },
  profileHeroChevronBtn: {
    padding: 6,
  },
  profileKycBannerComplete: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0f2744',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  profileKycIconComplete: {
    width: 32,
    height: 32,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  profileKycTitleComplete: {
    color: '#065f46',
    fontWeight: '800',
    fontSize: 14.5,
  },
  profileKycSubComplete: {
    color: '#047857',
    fontSize: 11.5,
    marginTop: 2,
  },
  profileKycBadgeVerified: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#86efac',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileKycBadgeVerifiedText: {
    color: '#16a34a',
    fontWeight: '800',
    fontSize: 12,
  },
  profileKycBannerPending: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0f2744',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  profileKycIconPending: {
    width: 32,
    height: 32,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  profileKycTitlePending: {
    color: '#0f2744',
    fontWeight: '800',
    fontSize: 14.5,
  },
  profileKycSubPending: {
    color: '#334155',
    fontSize: 11.5,
    marginTop: 2,
  },
  profileKycBtnPending: {
    backgroundColor: '#0f2744',
    paddingHorizontal: 13,
    paddingVertical: 6.5,
    borderRadius: 14,
  },
  profileKycBtnPendingText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  profileCardWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f2744',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileCardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f2744',
  },
  profilePlatePill: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  profilePlatePillText: {
    color: '#0f2744',
    fontWeight: '800',
    fontSize: 12,
  },
  profileAddCabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2744',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 9,
    shadowColor: '#0f2744',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  profileAddCabBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },

  /* Profile Fleet Selector Chips */
  profileFleetNumCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0f2744',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  profileFleetNumText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileFleetSubtag: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 1,
  },
  profileCabBoxSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 12,
    marginTop: 12,
  },
  profileCabBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  profileCabBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f2744',
  },
  profileFleetEntryBlock: {
    marginTop: 14,
  },
  profileFleetEntryDividerBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1.5,
    borderTopColor: '#f1f5f9',
  },
  profileFleetSubheaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  profileFleetEntryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f2744',
  },
  profileMiniPlatePill: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  profileMiniPlatePillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f2744',
    letterSpacing: 0.5,
  },
  profileFleetContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileFleetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  profileFleetMetaTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f2744',
  },
  profileFleetMetaSub: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '500',
  },
  profileFleetChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  profileFleetChip: {
    minWidth: 145,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1.5,
  },
  profileFleetChipActive: {
    backgroundColor: '#0f2744',
    borderColor: '#0f2744',
    shadowColor: '#0f2744',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  profileFleetChipInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  profileFleetChipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileFleetChipIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  profileFleetChipIconBoxActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  profileFleetChipPlate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  profileFleetChipPlateActive: {
    color: '#ffffff',
  },
  profileFleetChipBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 6,
  },
  profileFleetChipModel: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    fontWeight: '600',
  },
  profileFleetChipModelActive: {
    color: '#cbd5e1',
  },
  profileFleetChipBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileFleetChipBadgeActive: {
    opacity: 0.95,
  },
  profileCabColsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  profileCabCol: {
    flex: 1,
  },
  profileCabColLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  profileCabColValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f2744',
    marginTop: 3,
  },
  profileCabColDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  profileSeatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  profileSeatingLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  profileSeatingValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f2744',
  },
  profileViewDocsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  profileViewDocsBtnExpired: {
    backgroundColor: '#fff5f5',
    borderColor: '#fecaca',
  },
  profileViewDocsBtnPending: {
    backgroundColor: '#fffdf5',
    borderColor: '#fde68a',
  },
  profileViewDocsPillExpired: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  profileViewDocsPillPending: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  docMiniAlertBadgePending: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  docMiniAlertTextPending: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#b45309',
  },
  docMiniAlertBadgeExpired: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  docMiniAlertTextExpired: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#dc2626',
  },
  cabStatusBadgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  cabStatusTextPending: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  cabStatusBadgeExpired: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  cabStatusTextExpired: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
  cabStatusBadgeVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  cabStatusTextVerified: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
  },
  cabStatusBadgeRejected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  cabStatusTextRejected: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
  profileViewDocsIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileViewDocsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f2744',
  },
  profileViewDocsSub: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  profileViewDocsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 2,
  },
  profileViewDocsPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
  },
  allDocsVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  allDocsVerifiedText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingDocsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pendingDocsText: {
    color: '#0f2744',
    fontSize: 11.5,
    fontWeight: '700',
  },
  profileDocGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  profileDocMiniCard: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDocMiniTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0f2744',
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center',
  },
  profileDocMiniStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  profileDocMiniStatusGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
  },
  profileDocMiniStatusOrange: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ea580c',
  },
  profilePayoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profilePayoutIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0f2744',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePayoutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f2744',
  },
  profilePayoutSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  profilePayoutGreenText: {
    color: '#16a34a',
    fontSize: 11.5,
    fontWeight: '700',
  },
  profilePayoutDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginVertical: 12,
  },
  profileLangCurrentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  profileLangCurrentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
  },
  profileLangSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
  },
  langSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  langSelectorPill: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langSelectorPillActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#009669',
  },
  langBadgeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  langBadgeCircleActive: {
    backgroundColor: '#009669',
  },
  langBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  langBadgeTextActive: {
    color: '#ffffff',
  },
  langNameText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textAlign: 'center',
  },
  langNameTextActive: {
    color: '#009669',
    fontWeight: '800',
  },
  langCheckmarkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#009669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langUncheckedCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  profileSignOutBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#ffe4e6',
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  profileSignOutText: {
    color: '#dc2626',
    fontSize: 13.5,
    fontWeight: '800',
  },
  profileSignOutChevronCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionTextDark: {
    color: '#94a3b8',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    height: Platform.OS === 'android' ? 68 : 74,
    paddingBottom: Platform.OS === 'android' ? 8 : 16,
    backgroundColor: '#162232',
    flexDirection: 'row',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  bottomNavTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingTop: 4,
  },
  bottomActiveBar: {
    width: 28,
    height: 3,
    backgroundColor: '#f0750f',
    borderRadius: 1.5,
    marginTop: 4,
  },
  bottomNavEmoji: {
    fontSize: 18,
    opacity: 0.6,
  },
  bottomNavEmojiActive: {
    opacity: 1,
  },
  bottomNavText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  bottomNavTextActive: {
    color: '#f0750f',
    fontWeight: '900',
  },
  tabIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePendingNotificationBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#ea580c',
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  profilePendingNotificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
  avatarPendingDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ea580c',
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarPendingDotText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
  avatarRingCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#ea580c',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarEmojiCompact: {
    fontSize: 18,
  },
  avatarCompactPhotoClipper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  avatarImageCompact: {
    width: '100%',
    height: '100%',
  },
  avatarPendingDotCompact: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#ea580c',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  /* Top Priority Rejection Alert Card on Dashboard (Redesigned per Reference) */
  dashboardRejectionCard: {
    backgroundColor: '#fff5f5',
    borderWidth: 1.5,
    borderColor: '#fecaca',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#dc2626',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  dashboardRejectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dashboardRejectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#c90016',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardRejectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#c90016',
  },
  dashboardRejectionSubtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '500',
  },
  dashboardRejectionReasonBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  dashboardRejectionReasonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dashboardRejectionReasonLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#c90016',
  },
  dashboardRejectionReasonPill: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  dashboardRejectionReasonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 19,
  },
  dashboardRejectionFooterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
  },
  dashboardRejectionFooterText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },
  dashboardRejectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c90016',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
    shadowColor: '#c90016',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  dashboardRejectionActionBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },

  pendingKycAlertCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fdba74',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#ea580c',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  pendingKycAlertIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingKycAlertTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#c2410c',
  },
  pendingKycAlertSub: {
    fontSize: 10,
    color: '#7c2d12',
    marginTop: 1,
  },
  pendingKycActionBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pendingKycActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  /* Document Expiry Reminder Card */
  expiryReminderCard: {
    backgroundColor: '#fffdf5',
    borderWidth: 1.5,
    borderColor: '#fcd34d',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    marginBottom: 16,
    shadowColor: '#b45309',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  expiryReminderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  expiryReminderIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  expiryHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  expiryReminderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#92400e',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  expiryCountBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  expiryCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  expiryReminderSub: {
    fontSize: 11.5,
    color: '#78350f',
    marginTop: 2,
    lineHeight: 16,
  },
  expiryDocsList: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
    overflow: 'hidden',
  },
  expiryDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  expiryDocRowExpired: {
    backgroundColor: '#fef2f2',
  },
  expiryDocName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  expiryDocDateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    marginTop: 2,
  },
  expiryDocUpdateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgb(240, 117, 15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  expiryDocUpdateBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    marginRight: 2,
  },
  expiryMainCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d97706',
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 12,
    shadowColor: '#d97706',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  expiryMainCtaBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#ffffff',
  },

  kycVerificationCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    marginBottom: 16,
    shadowColor: '#0f2744',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  kycWatermarkBg: {
    position: 'absolute',
    right: -15,
    top: 15,
  },
  kycHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kycHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  kycShieldBox: {
    width: 30,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  kycShieldCheckmarkPos: {
    position: 'absolute',
    top: 6,
    left: 6.5,
  },
  kycHeaderTitleBox: {
    marginLeft: 10,
    flex: 1,
  },
  kycHeaderTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0f2744',
    letterSpacing: -0.2,
  },
  kycHeaderSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  kycCountPill: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  kycCountPillText: {
    color: '#c2410c',
    fontSize: 13.5,
    fontWeight: '800',
  },
  kycSegmentContainer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    marginBottom: 8,
  },
  kycSegmentBar: {
    flex: 1,
    height: 4.5,
    borderRadius: 3,
  },
  kycSegmentBarActive: {
    backgroundColor: '#10b981',
  },
  kycSegmentBarInactive: {
    backgroundColor: '#e2e8f0',
  },
  kycDocList: {
    marginTop: 4,
  },
  kycDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  kycDocRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  kycDocIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  kycDocInfo: {
    flex: 1,
  },
  kycDocTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f2744',
  },
  kycStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    marginTop: 2.5,
  },
  kycStatusSuccessText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  kycStatusWarningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ea580c',
  },
  kycUploadMiniBtn: {
    backgroundColor: '#ffedd5',
    paddingVertical: 5.5,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kycUploadMiniBtnText: {
    color: '#0f2744',
    fontSize: 12,
    fontWeight: '700',
  },
  kycCompleteCtaBtn: {
    backgroundColor: '#0f2744',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    shadowColor: '#0f2744',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 3,
  },
  kycCompleteCtaBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  kycNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
    marginBottom: 2,
  },
  kycNoticeText: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '500',
  },
  radarKycNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    gap: 10,
  },
  radarKycIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarKycNoticeTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f2744',
  },
  radarKycNoticeSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  radarKycNoticeBtn: {
    backgroundColor: '#0f2744',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  radarKycNoticeBtnText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '900',
  },
  profileSectionsList: {
    marginBottom: 24,
  },
  profileSectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 17,
    paddingHorizontal: 26,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  profileSectionLogout: {
    borderBottomWidth: 0,
    marginTop: 6,
  },
  profileSectionIconBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileSectionTextBox: {
    flex: 1,
    paddingRight: 8,
  },
  profileSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f2744',
    letterSpacing: -0.2,
  },
  profileSectionSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  profileSectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileSectionBadgeBlue: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  profileSectionBadgeBlueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  profileSectionStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  profileSectionStatusBadgeGreen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  profileSectionStatusBadgeOrange: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  profileSectionStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  profileSectionLangBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  profileSectionLangBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c',
  },
  profileNotifCountBadge: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  profileNotifCountBadgeText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
  },
});
