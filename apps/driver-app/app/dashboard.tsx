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
  ImageBackground,
  StatusBar,
  Image,
  AppState,
  AppStateStatus,
  Animated,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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
import { getTripInProcessSync, getTripInProcess, setTripInProcess, subscribeTripState } from '../lib/tripState';

export default function DriverDashboardScreen() {
  const router = useRouter();
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
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsState, setGpsState] = useState<LocationState>(locationTracker.getState());
  const [tripInProcessRev, setTripInProcessRev] = useState(0);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);

  // Immediately hydrate cached driver session to prevent blank/green screen on offline boot
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cached = await SecureStore.getItemAsync('kandy_cached_driver');
        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            setDriver((prev: any) => prev || parsed);
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
        driverApiClient.fetch('/api/driver/status', { timeoutMs: 8000 } as any),
        driverApiClient.fetch('/api/driver/dispatches', { timeoutMs: 8000 } as any).catch(() => ({ success: false, dispatches: [] })),
      ]);

      if (statusRes && statusRes.success && statusRes.driver) {
        setDriver(statusRes.driver);
        setConnectionError(null);
        try {
          await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(statusRes.driver));
        } catch (_) {}
        setOnlineStatus(statusRes.driver.onlineStatus);
        setActiveBooking(statusRes.activeBooking);
        setUpcomingBookings(statusRes.upcomingBookings || []);

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
        setDispatches(dispatchRes.dispatches || []);
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
      setConnectionError(
        err.message?.includes('timed out')
          ? 'Request timed out. Please check your network connection.'
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
        return [newDispatch, ...prev];
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

    // Only block if explicitly REJECTED or SUSPENDED by Admin
    if (val && (driver?.verificationStatus === 'REJECTED' || driver?.verificationStatus === 'SUSPENDED')) {
      Alert.alert(
        'Verification In Review',
        'Your profile is currently under review by Admin. You will be able to go Online and receive rides once verified.'
      );
      isTogglingDutyRef.current = false;
      return;
    }

    // 1. INSTANT 0ms OPTIMISTIC UI FLIP (Provides immediate tactile visual response)
    const prevStatus = onlineStatus;
    setOnlineStatus(val);

    // 2. Hardware / Location Permission Checks
    if (val) {
      if (gpsState.status === 'SERVICES_DISABLED') {
        setOnlineStatus(prevStatus);
        Alert.alert(
          'Location Services Required',
          'GPS/Location Services are currently disabled on your device. Please enable GPS in your device settings to go online and receive ride dispatches.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => locationTracker.openLocationSettings(),
            },
          ]
        );
        isTogglingDutyRef.current = false;
        return;
      }

      if (gpsState.status === 'PERMISSION_DENIED' || gpsState.status === 'NOT_STARTED') {
        const permResult = await locationTracker.requestPermissions();
        if (!permResult.granted) {
          setOnlineStatus(prevStatus);
          if (permResult.status === 'SERVICES_DISABLED') {
            Alert.alert(
              'Location Services Required',
              'GPS/Location Services are currently disabled on your device. Please enable GPS in your device settings to go online and receive ride dispatches.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => locationTracker.openLocationSettings(),
                },
              ]
            );
          } else {
            Alert.alert(
              'Location Permission Required',
              'Location permission is required to detect nearby ride dispatches and navigate routes.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Settings',
                  onPress: () => Linking.openSettings(),
                },
              ]
            );
          }
          isTogglingDutyRef.current = false;
          return;
        }
      }

      locationTracker.startIdleTracking();
    } else {
      locationTracker.stopTracking();
    }

    // 3. Background server synchronization with rollback on failure
    try {
      const res = await driverApiClient.fetch('/api/driver/toggle-online', {
        method: 'PATCH',
        body: JSON.stringify({ onlineStatus: val }),
      });

      if (!res.success) {
        // Rollback state
        setOnlineStatus(prevStatus);
        if (prevStatus) {
          locationTracker.startIdleTracking();
        } else {
          locationTracker.stopTracking();
        }
        Alert.alert('Status Error', res.message || 'Failed to update online status');
      }
    } catch (err: any) {
      // Rollback on network or server error (e.g. not verified)
      setOnlineStatus(prevStatus);
      if (prevStatus) {
        locationTracker.startIdleTracking();
      } else {
        locationTracker.stopTracking();
      }
      Alert.alert('Status Error', err.message || 'Failed to update online status');
    } finally {
      isTogglingDutyRef.current = false;
    }
  };

  const handleAcceptDispatch = async (dispatchId: string, bookingId: string) => {
    setAcceptingId(dispatchId);
    try {
      const res = await driverApiClient.fetch('/api/driver/dispatches/accept', {
        method: 'POST',
        body: JSON.stringify({ dispatchId, bookingId }),
      });

      if (res.success && res.booking) {
        // Remove this dispatch from the pending list
        setDispatches((prev) => prev.filter((d) => d.id !== dispatchId && d.booking?.id !== bookingId));

        if (currentTrip) {
          // If already on an active trip, immediately add this trip to upcoming queue
          setUpcomingBookings((prev) => {
            const filtered = prev.filter((b) => b.id !== res.booking.id);
            return [...filtered, res.booking];
          });
          setActiveCardTab('MY_TRIPS');
          await fetchDriverData();
          Alert.alert(
            'Ride Accepted & Queued! 🎉',
            `Trip ${res.booking.humanReadableRef || ''} is confirmed and added to your queue below your active trip. You can start it once your current trip is finished.`,
            [{ text: 'OK' }]
          );
        } else {
          setActiveBooking(res.booking);
          setActiveCardTab('MY_TRIPS');
          fetchDriverData();
          router.push({
            pathname: '/trip/inspection',
            params: { bookingId: res.booking.id || bookingId },
          });
        }
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

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of Kandy Cabs Driver?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await driverApiClient.auth.logout();
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
            Connecting to driver partner network
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

            <TouchableOpacity
              style={styles.avatarRingHeader}
              onPress={() => setActiveBottomTab('PROFILE')}
              activeOpacity={0.8}
            >
              {driver?.profilePhotoUrl ? (
                <View style={styles.avatarPhotoClipper}>
                  <Image
                    source={{ uri: driver.profilePhotoUrl }}
                    style={styles.avatarImageHeader}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <View style={styles.avatarFallbackIconCircle}>
                  <Ionicons name="person" size={20} color="#0f2744" />
                </View>
              )}
              {hasPendingDocuments && (
                <View style={styles.avatarNotificationBadge}>
                  <Text style={styles.avatarNotificationBadgeText}>1</Text>
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
            {/* 1. HERO DRIVER CARD (MATCHING REFERENCE DESIGN) */}
            <View style={styles.heroCardOuter}>
              <ImageBackground
                source={require('../assets/images/hero-banner-scenic-night.jpg')}
                style={styles.heroCardBg}
                imageStyle={{ borderRadius: 20, resizeMode: 'cover' }}
              >
                <View style={styles.heroCardContent}>
                  <View style={styles.heroCardLeft}>
                    <Text style={styles.heroCardName} numberOfLines={1}>
                      {driver?.fullName || 'Ramesh Kumar'}
                    </Text>
                    <Text style={styles.heroCardRole}>(Driver)</Text>

                    <View style={styles.heroCardPlateRow}>
                      <Ionicons name="car" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.heroCardPlate}>
                        {driver?.vehicle?.plateNumber && driver.vehicle.plateNumber !== 'PENDING' && !driver.vehicle.plateNumber.startsWith('KA 01 TR 0000')
                          ? driver.vehicle.plateNumber.toUpperCase()
                          : 'KA-01-3002'}
                      </Text>
                    </View>

                    {/* Duty Pill: Interactive Toggle */}
                    <TouchableOpacity
                      style={[
                        styles.heroDutyCapsule,
                        onlineStatus ? styles.heroDutyCapsuleOnline : styles.heroDutyCapsuleOffline,
                      ]}
                      onPress={() => handleToggleOnline(!onlineStatus)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.heroDutyDot, { backgroundColor: onlineStatus ? '#22c55e' : '#ef4444' }]} />
                      <Text style={styles.heroDutyText}>
                        {onlineStatus ? t('header.online') : t('header.offline')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ImageBackground>
            </View>

            {/* FLOATING CARD CONTAINER */}
            <View style={styles.homeCardsContainer}>
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

            {/* Top Sub-Tab Bar on White Card (Only shown when there is an active trip) */}
            {currentTrip && (
              <View style={styles.cardWrapper}>
                <View style={styles.subTabBar}>
                  <TouchableOpacity
                    style={[styles.subTabItem, activeCardTab === 'MY_TRIPS' && styles.subTabItemActive]}
                    onPress={() => setActiveCardTab('MY_TRIPS')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="car-sport"
                      size={17}
                      color={activeCardTab === 'MY_TRIPS' ? '#0f2744' : '#64748b'}
                    />
                    <Text style={[styles.subTabText, activeCardTab === 'MY_TRIPS' && styles.subTabTextActive]}>
                      {t('dashboard.subtab_my_trips')}
                    </Text>
                    {activeCardTab === 'MY_TRIPS' && <View style={styles.subTabUnderline} />}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.subTabItem, activeCardTab === 'UPCOMING' && styles.subTabItemActive]}
                    onPress={() => setActiveCardTab('UPCOMING')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={activeCardTab === 'UPCOMING' ? '#0f2744' : '#64748b'}
                    />
                    <Text style={[styles.subTabText, activeCardTab === 'UPCOMING' && styles.subTabTextActive]}>
                      {t('dashboard.subtab_upcoming')}
                    </Text>
                    {activeCardTab === 'UPCOMING' && <View style={styles.subTabUnderline} />}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.subTabItem, activeCardTab === 'HISTORY' && styles.subTabItemActive]}
                    onPress={() => setActiveCardTab('HISTORY')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={activeCardTab === 'HISTORY' ? '#0f2744' : '#64748b'}
                    />
                    <Text style={[styles.subTabText, activeCardTab === 'HISTORY' && styles.subTabTextActive]}>
                      {t('dashboard.subtab_history')}
                    </Text>
                    {activeCardTab === 'HISTORY' && <View style={styles.subTabUnderline} />}
                  </TouchableOpacity>
                </View>

                {/* CARD BODY: ACTIVE TRIP */}
                {activeCardTab === 'MY_TRIPS' ? (
                  (() => {
                    const isTripInProcess =
                      currentTrip.status === BookingStatus.TRIP_STARTED ||
                      currentTrip.status === 'TRIP_STARTED' ||
                      currentTrip.status === 'IN_PROGRESS' ||
                      getTripInProcessSync(currentTrip.id);

                    return (
                      <View style={styles.tripCardContent}>
                        {/* Top Row: Booking ID + ON ROUTE Badge */}
                        <View style={styles.bookingTopRow}>
                          <View>
                            <Text style={styles.bookingIdLabel}>Booking ID</Text>
                            <Text style={styles.bookingIdNumber}>{currentTrip.humanReadableRef}</Text>
                          </View>
                          <View style={isTripInProcess ? styles.onTripBadge : styles.onRouteBadge}>
                            <View style={isTripInProcess ? styles.onTripDot : styles.onRouteDot} />
                            <Text style={isTripInProcess ? styles.onTripBadgeText : styles.onRouteBadgeText}>
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
                                <Text style={styles.locationSubtitle}>{t('dashboard.pickup_location_nav')}</Text>
                              </View>
                            </TouchableOpacity>

                            <View style={styles.dashedTrail} />

                            <TouchableOpacity
                              style={styles.stepPoint}
                              onPress={() => openNavigationMap(currentTrip.dropLat, currentTrip.dropLng, currentTrip.dropAddress)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="location-sharp" size={16} color="#dc2626" style={styles.dropPin} />
                              <View style={styles.stepTextGroup}>
                                <Text style={styles.locationTitle}>{currentTrip.dropAddress}</Text>
                                <Text style={styles.locationSubtitle}>{t('dashboard.destination_nav')}</Text>
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
                              <Text style={styles.infoColHeaderLabel} numberOfLines={1}>Pickup Date & Time</Text>
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

                          {/* Col 3: Distance / Trip Type */}
                          <View style={styles.infoThreeCol}>
                            <View style={styles.infoColHeaderRow}>
                              <Ionicons name="navigate-outline" size={14} color="#0f2744" />
                              <Text style={styles.infoColHeaderLabel} numberOfLines={1}>Distance</Text>
                            </View>
                            <Text style={styles.infoFareValBold}>
                              {currentTrip.distanceKm || '--'} km
                            </Text>
                            <Text style={styles.infoColSubPhone}>
                              {currentTrip.tripType || 'ONE WAY'}
                            </Text>
                          </View>
                        </View>

                        {/* 2 Primary Action Buttons */}
                        {(() => {
                          const inspectionPhotos = Array.isArray(currentTrip.vehicleInspectionPhotos)
                            ? currentTrip.vehicleInspectionPhotos.filter((p: string) => p && !p.includes('placehold.co') && p.trim().length > 0)
                            : [];
                          const hasCompletedInspection = inspectionPhotos.length >= 4;

                          return (
                            <View style={styles.primaryButtonsRow}>
                              {!hasCompletedInspection && !isTripInProcess ? (
                                <TouchableOpacity
                                  style={styles.blueInspectionBtn}
                                  onPress={() => router.push({ pathname: '/trip/inspection', params: { bookingId: currentTrip.id } })}
                                  activeOpacity={0.85}
                                >
                                  <Ionicons name="camera" size={15} color="#ffffff" style={{ marginRight: 2 }} />
                                  <Text style={styles.inspectionBtnText}>{t('dashboard.vehicle_inspection')}</Text>
                                </TouchableOpacity>
                              ) : (
                                <TouchableOpacity
                                  style={isTripInProcess ? styles.onTripBtn : styles.greenStartTripBtn}
                                  onPress={async () => {
                                    const isTripVerifiedAndStarted =
                                      currentTrip.status === BookingStatus.TRIP_STARTED ||
                                      currentTrip.status === 'TRIP_STARTED' ||
                                      currentTrip.status === 'IN_PROGRESS';

                                    if (isTripVerifiedAndStarted) {
                                      locationTracker.startActiveTripTracking(currentTrip.id);
                                      router.push({ pathname: '/trip/active', params: { bookingId: currentTrip.id } });
                                    } else {
                                      await setTripInProcess(currentTrip.id, true);
                                      driverApiClient.fetch('/api/driver/trip/en-route', {
                                        method: 'POST',
                                        body: JSON.stringify({ bookingId: currentTrip.id }),
                                      }).catch(() => {});
                                      locationTracker.startActiveTripTracking(currentTrip.id);
                                      router.push({ pathname: '/trip/start', params: { bookingId: currentTrip.id } });
                                    }
                                  }}
                                  activeOpacity={0.85}
                                >
                                  <Ionicons name={isTripInProcess ? 'navigate' : 'car'} size={17} color="#ffffff" style={{ marginRight: 4 }} />
                                  <Text style={styles.greenBtnText}>
                                    {isTripInProcess ? t('dashboard.on_trip') : t('dashboard.start_trip_caps')}
                                  </Text>
                                </TouchableOpacity>
                              )}

                              <TouchableOpacity
                                style={styles.creamViewRouteBtn}
                                onPress={() => {
                                  const targetLat = isTripInProcess ? currentTrip.dropLat : currentTrip.pickupLat;
                                  const targetLng = isTripInProcess ? currentTrip.dropLng : currentTrip.pickupLng;
                                  const targetAddress = isTripInProcess ? currentTrip.dropAddress : currentTrip.pickupAddress;
                                  openNavigationMap(targetLat, targetLng, targetAddress);
                                }}
                                activeOpacity={0.85}
                              >
                                <Ionicons name="location" size={17} color="#0f2744" />
                                <Text style={styles.creamBtnText}>
                                  {isTripInProcess ? t('dashboard.drop_off_location') : t('dashboard.pickup_location')}
                                </Text>
                              </TouchableOpacity>
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
                              Alert.alert(
                                `Trip: ${currentTrip.humanReadableRef}`,
                                `Pickup: ${currentTrip.pickupAddress}\nDrop: ${currentTrip.dropAddress}\nDistance: ${currentTrip.distanceKm || '--'} km\nTrip Type: ${currentTrip.tripType || 'ONE WAY'}`
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
                  })()
                ) : activeCardTab === 'UPCOMING' ? (
                  upcomingBookings.length === 0 ? (
                    <View style={styles.emptyCardInner}>
                      <Ionicons name="calendar-outline" size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                      <Text style={styles.emptyCardInnerTitle}>{t('dashboard.no_upcoming_scheduled')}</Text>
                      <Text style={styles.emptyCardInnerSubtitle}>Accepted rides and advanced bookings allocated to you will appear here.</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 14 }}>
                      {upcomingBookings.map((upBooking) => {
                        const isPrimaryTripActive = !!activeBooking;
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

                        return (
                          <View key={upBooking.id} style={styles.upcomingBookingItemCard}>
                            {/* Top Row: Ref & Upcoming Tag */}
                            <View style={styles.bookingTopRow}>
                              <View>
                                <Text style={styles.bookingIdLabel}>{t('dashboard.upcoming_booking')}</Text>
                                <Text style={styles.bookingIdNumber}>{upBooking.humanReadableRef}</Text>
                              </View>
                              <View style={styles.upcomingBadgePill}>
                                <Ionicons name="calendar" size={11} color="#2563eb" />
                                <Text style={styles.upcomingBadgeText}>{t('dashboard.next_in_queue')}</Text>
                              </View>
                            </View>

                            {/* Stepper Route */}
                            <View style={[styles.stepperContainer, { marginTop: 10 }]}>
                              <View style={[styles.stepperLeft, { flex: 1 }]}>
                                <TouchableOpacity
                                  style={styles.stepPoint}
                                  onPress={() => openNavigationMap(upBooking.pickupLat, upBooking.pickupLng, upBooking.pickupAddress)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="location-sharp" size={16} color="#16a34a" style={styles.pickupPin} />
                                  <View style={styles.stepTextGroup}>
                                    <Text style={styles.locationTitle}>{upBooking.pickupAddress}</Text>
                                    <Text style={styles.locationSubtitle}>{t('dashboard.pickup_pin')}</Text>
                                  </View>
                                </TouchableOpacity>

                                <View style={styles.dashedTrail} />

                                <TouchableOpacity
                                  style={styles.stepPoint}
                                  onPress={() => openNavigationMap(upBooking.dropLat, upBooking.dropLng, upBooking.dropAddress)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="location-sharp" size={16} color="#dc2626" style={styles.dropPin} />
                                  <View style={styles.stepTextGroup}>
                                    <Text style={styles.locationTitle}>{upBooking.dropAddress}</Text>
                                    <Text style={styles.locationSubtitle}>{t('dashboard.destination_pin')}</Text>
                                  </View>
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Info 3 Columns Row */}
                            <View style={styles.infoThreeColsRow}>
                              <View style={styles.infoThreeCol}>
                                <View style={styles.infoColTopLabel}>
                                  <Ionicons name="calendar-outline" size={12} color="#64748b" />
                                  <Text style={styles.infoColLabel}>Scheduled</Text>
                                </View>
                                <Text style={styles.infoColMainText}>{pickupDateStr}</Text>
                                <Text style={styles.infoColSubPhone}>{pickupTimeStr}</Text>
                              </View>

                              <View style={styles.infoColDivider} />

                              <View style={styles.infoThreeCol}>
                                <View style={styles.infoColTopLabel}>
                                  <Ionicons name="person-outline" size={12} color="#64748b" />
                                  <Text style={styles.infoColLabel}>Customer</Text>
                                </View>
                                <Text style={styles.infoColMainText} numberOfLines={1}>
                                  {upBooking.customer?.user?.fullName || 'Customer'}
                                </Text>
                                <Text style={styles.infoColSubPhone}>
                                  {upBooking.customerPhoneReleased
                                    ? upBooking.customer?.user?.phone || 'Released'
                                    : 'Phone Released on Pickup'}
                                </Text>
                              </View>

                              <View style={styles.infoColDivider} />

                              <View style={styles.infoThreeCol}>
                                <View style={styles.infoColTopLabel}>
                                  <Ionicons name="navigate-outline" size={12} color="#64748b" />
                                  <Text style={styles.infoColLabel}>Distance</Text>
                                </View>
                                <Text style={styles.infoColMainText}>
                                  {upBooking.distanceKm || '--'} km
                                </Text>
                                <Text style={styles.infoColSubPhone}>
                                  {upBooking.tripType || 'ONE WAY'}
                                </Text>
                              </View>
                            </View>

                            {/* Action Button: Disabled/Locked if primary trip is ongoing */}
                            <View style={{ marginTop: 12 }}>
                              {isPrimaryTripActive ? (
                                <TouchableOpacity
                                  style={styles.lockedUpcomingStartBtn}
                                  onPress={() => {
                                    Alert.alert(
                                      'Active Trip Ongoing 🚗',
                                      'You are currently on an active trip. Complete your ongoing trip before starting this upcoming ride.'
                                    );
                                  }}
                                  activeOpacity={0.8}
                                >
                                  <Ionicons name="lock-closed" size={15} color="#64748b" />
                                  <Text style={styles.lockedUpcomingStartText}>
                                    LOCKED • FINISH ACTIVE TRIP FIRST
                                  </Text>
                                </TouchableOpacity>
                              ) : (
                                <TouchableOpacity
                                  style={styles.greenStartTripBtn}
                                  onPress={() => router.push({ pathname: '/trip/start', params: { bookingId: upBooking.id } })}
                                  activeOpacity={0.85}
                                >
                                  <Ionicons name="car" size={17} color="#ffffff" style={{ marginRight: 4 }} />
                                  <Text style={styles.greenBtnText}>START TRIP</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )
                ) : (
                  <View style={styles.emptyCardInner}>
                    <Ionicons name="time-outline" size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyCardInnerTitle}>{t('dashboard.recent_trip_history')}</Text>
                    <Text style={styles.emptyCardInnerSubtitle}>
                      {t('dashboard.recent_trip_history_sub', { count: driverTrips.length })}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* SEPARATE STANDALONE CARD: Queued / Accepted Trips */}
            {activeCardTab === 'MY_TRIPS' && upcomingBookings.length > 0 && (
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
                  {upcomingBookings.map((upBooking) => {
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
                                <Text style={styles.locationSubtitle}>{t('dashboard.pickup_pin')}</Text>
                              </View>
                            </TouchableOpacity>

                            <View style={styles.dashedTrail} />

                            <TouchableOpacity
                              style={styles.stepPoint}
                              onPress={() => openNavigationMap(upBooking.dropLat, upBooking.dropLng, upBooking.dropAddress)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="location-sharp" size={16} color="#dc2626" style={styles.dropPin} />
                              <View style={styles.stepTextGroup}>
                                <Text style={styles.locationTitle}>{upBooking.dropAddress}</Text>
                                <Text style={styles.locationSubtitle}>{t('dashboard.destination_pin')}</Text>
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
                              <Ionicons name="navigate-outline" size={13} color="#64748b" />
                              <Text style={styles.infoColLabel}>Distance</Text>
                            </View>
                            <Text style={styles.infoColMainText}>
                              {upBooking.distanceKm || '--'} km
                            </Text>
                            <Text style={styles.infoColSubPhone}>
                              {upBooking.tripType || 'ONE WAY'}
                            </Text>
                          </View>
                        </View>

                        {/* Action Buttons: Locked Start Button + Trip Details */}
                        <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity
                            style={[styles.lockedUpcomingStartBtn, { flex: 2 }]}
                            onPress={() => {
                              Alert.alert(
                                'Active Trip Ongoing 🚗',
                                'This trip is in your queue. You will be able to start it as soon as your current active trip is completed.'
                              );
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="lock-closed" size={15} color="#64748b" />
                            <Text style={styles.lockedUpcomingStartText}>
                              UNABLE TO START • QUEUED
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.creamViewRouteBtn, { flex: 1, paddingVertical: 11 }]}
                            onPress={() => {
                              Alert.alert(
                                `Queued Trip: ${upBooking.humanReadableRef}`,
                                `Pickup: ${upBooking.pickupAddress}\nDrop: ${upBooking.dropAddress}\nDistance: ${upBooking.distanceKm || '--'} km\nCustomer: ${upBooking.customer?.user?.fullName || 'Customer'}\nScheduled: ${pickupDateStr} ${pickupTimeStr}`
                              );
                            }}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="document-text" size={15} color="#0f2744" />
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
            {!onlineStatus ? (
              <View style={styles.offlineBoxWhite}>
                <View style={styles.dispatchesCardHeader}>
                  <View style={styles.dispatchesHeaderLeft}>
                    <Ionicons name="car-sport" size={17} color="#0f2744" />
                    <Text style={styles.dispatchesTitle}>
                      Admin Assignments
                    </Text>
                  </View>
                  <View style={styles.pausedBadge}>
                    <Ionicons name="pause" size={10} color="#475569" />
                    <Text style={styles.pausedText}>Off-Duty</Text>
                  </View>
                </View>

                <View style={styles.cardHeaderDivider} />

                <View style={styles.offlineCardBody}>
                  <View style={styles.offDutyIconContainer}>
                    <Ionicons name="power-outline" size={32} color="#94a3b8" />
                    <View style={styles.offDutyPauseBadge}>
                      <Ionicons name="pause" size={10} color="#ffffff" />
                    </View>
                  </View>
                  <Text style={styles.offDutyTitle}>You are currently OFF-DUTY</Text>
                  <Text style={styles.offDutySubtitle}>
                    Go On-Duty to receive direct ride assignments from Admin.
                  </Text>
                  <TouchableOpacity
                    style={styles.goDutyBtn}
                    onPress={() => handleToggleOnline(true)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.goDutyGreenDot} />
                    <Text style={styles.goDutyBtnText}>Go ON-DUTY NOW</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : dispatches.length === 0 ? (
              !currentTrip ? (
                /* Radar Scanner in Modern White Card (only shown when no active trip) */
                <View style={styles.radarCardWhite}>
                  <View style={styles.dispatchesCardHeader}>
                    <View style={styles.dispatchesHeaderLeft}>
                      <Ionicons name="car-sport" size={17} color="#0f2744" />
                      <Text style={styles.dispatchesTitle}>
                        Admin Assignments
                      </Text>
                    </View>
                    <View style={styles.listeningBadgeLight}>
                      <View style={[styles.listeningDot, { backgroundColor: '#10b981' }]} />
                      <Text style={styles.listeningTextLight}>Ready for Duty</Text>
                    </View>
                  </View>

                  <View style={styles.cardHeaderDivider} />

                  <View style={styles.radarCardBody}>
                    <View style={styles.radarIconCircleDark}>
                      <Ionicons name="shield-checkmark" size={28} color="#0f2744" />
                    </View>
                    <Text style={styles.radarTitleDark}>Ready for Admin Assignment</Text>
                    <Text style={styles.radarSubtitleDark}>
                      You are On-Duty! When Admin directly assigns a booking for your vehicle ({driver?.vehicle?.category?.toUpperCase() || 'SEDAN'}), it will appear here immediately.
                    </Text>
                    <View style={styles.radarPillOrange}>
                      <View style={styles.radarPulseDot} />
                      <Text style={styles.radarPillTextOrange}>Direct Dispatch Active</Text>
                    </View>

                    {hasPendingDocuments && (
                      <TouchableOpacity
                        style={styles.radarKycNoticeBox}
                        onPress={() => router.push('/documents')}
                        activeOpacity={0.85}
                      >
                        <View style={styles.radarKycIconCircle}>
                          <Ionicons name="warning" size={18} color="#0f2744" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.radarKycNoticeTitle}>KYC Verification Incomplete</Text>
                          <Text style={styles.radarKycNoticeSub}>
                            Upload your Driver Profile Photo, DL, RC & Cab photos to accept rides.
                          </Text>
                        </View>
                        <View style={styles.radarKycNoticeBtn}>
                          <Text style={styles.radarKycNoticeBtnText}>Upload ›</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : null
            ) : (
              <View style={{ gap: 12, marginTop: currentTrip ? 8 : 0 }}>
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

                {dispatches.map((d) => {
                  const b = d?.booking || {};
                  const isAccepting = acceptingId === d.id;

                  return (
                    <View key={d.id} style={styles.floatingDispatchCardWhite}>
                      <View style={styles.dispatchHeaderBanner}>
                        <View style={styles.dispatchHeaderRow}>
                          <View>
                            <View style={styles.newAlertBadge}>
                              <Ionicons name="radio-button-on" size={13} color="#2563eb" />
                              <Text style={styles.newAlertText}>{t('dashboard.new_ride')}</Text>
                            </View>
                            <Text style={styles.dispatchRefText}>{b?.humanReadableRef || 'RIDE'}</Text>
                          </View>
                          <View style={styles.distanceBadgeLight}>
                            <Text style={styles.distanceBadgeTextLight}>📍 {b?.distanceKm || '--'} km</Text>
                          </View>
                        </View>
                      </View>

                      {/* Stepper Route */}
                      <View style={styles.stepperContainer}>
                        <View style={styles.stepperLeft}>
                          <View style={styles.stepPoint}>
                            <Ionicons name="location-sharp" size={16} color="#16a34a" style={styles.pickupPin} />
                            <View style={styles.stepTextGroup}>
                              <Text style={styles.locationTitle}>{b?.pickupAddress || 'Pickup Location'}</Text>
                              <Text style={styles.locationSubtitle}>{t('dashboard.pickup_location_title')}</Text>
                            </View>
                          </View>
                          <View style={styles.dashedTrail} />
                          <View style={styles.stepPoint}>
                            <Ionicons name="location-sharp" size={16} color="#dc2626" style={styles.dropPin} />
                            <View style={styles.stepTextGroup}>
                              <Text style={styles.locationTitle}>{b?.dropAddress || 'Drop Location'}</Text>
                              <Text style={styles.locationSubtitle}>{t('dashboard.drop')}</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Passenger & Fare Row */}
                      <View style={styles.dispatchPassengerRowLight}>
                        <Text style={styles.dispatchPassengerNameDark}>
                          👤 {b?.customer?.user?.fullName || 'Customer'}
                        </Text>
                        <Text style={styles.dispatchTripTypeOrange}>{b?.tripType || 'ONE WAY'}</Text>
                      </View>

                      {/* Call-style Slide to Accept Ride Slider */}
                      <SlideToAccept
                        onAccept={() => handleAcceptDispatch(d.id, b?.id || d.bookingId)}
                        isAccepting={isAccepting}
                        disabled={false}
                        title={currentTrip ? 'SLIDE TO ACCEPT (QUEUED TRIP)' : 'SLIDE RIGHT TO ACCEPT'}
                        acceptingTitle="ACCEPTING RIDE..."
                      />
                    </View>
                  );
                })}
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
                      <Text style={styles.tripDistanceLine}>
                        <Text style={{ fontWeight: '700' }}>{t('trips.distance')} </Text>{trip.distanceKm} km
                      </Text>
                    </View>

                    <View style={styles.tripPaymentStatusRow}>
                      <Text style={styles.tripPaymentStatusLabel}>{t('trips.driver_payment_status')}</Text>
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
              onPress={() => Linking.openURL('tel:+918888888888')}
              activeOpacity={0.8}
            >
              <View style={styles.supportActionIconCircleGreen}>
                <Ionicons name="call" size={20} color="#0f172a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportActionTitle}>{t('support.helpline_title')}</Text>
                <Text style={styles.supportActionSubtitle}>{t('support.helpline_subtitle')}</Text>
                <Text style={styles.supportActionPhone}>{t('support.toll_free')}</Text>
              </View>
              <Text style={styles.supportActionArrow}>›</Text>
            </TouchableOpacity>

            {/* WhatsApp Card */}
            <TouchableOpacity
              style={styles.supportActionCardWhite}
              onPress={() => Linking.openURL('https://wa.me/918888888888?text=Hello%20Kandy%20Cabs%20Driver%20Support')}
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
            <View style={styles.profileHeroCardOuter}>
              <ImageBackground
                source={require('../assets/images/hero-driver-card-navy-2x.png')}
                style={styles.profileHeroCardBg}
                imageStyle={{ borderRadius: 20, resizeMode: 'cover' }}
              >
                <View style={styles.profileHeroCardOverlay}>
                  <View style={styles.profileHeroAvatarOuter}>
                    <View style={styles.profileHeroAvatarInner}>
                      {driver?.profilePhotoUrl ? (
                        <Image
                          source={{ uri: driver.profilePhotoUrl }}
                          style={styles.profileHeroAvatarImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.profileHeroAvatarFallback}>
                          <Ionicons name="person" size={34} color="#0f2744" />
                        </View>
                      )}
                    </View>
                    {/* Camera icon badge */}
                    <TouchableOpacity
                      style={styles.profileHeroCameraBadge}
                      onPress={() => router.push('/documents')}
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
                      {driver?.fullName || 'Ramesh Kumar'}
                    </Text>
                    <Text style={styles.profileHeroRole}>
                      ({driver?.roles?.[0] ? (driver.roles[0] === 'DRIVER' ? 'Test Driver' : driver.roles[0]) : 'Test Driver'})
                    </Text>
                    <View style={styles.profileHeroPhoneRow}>
                      <Ionicons name="call" size={12} color="#ffffff" style={{ marginRight: 5 }} />
                      <Text style={styles.profileHeroPhone}>
                        +91 {driver?.phone || '91888888888'}
                      </Text>
                    </View>
                    <View style={styles.profileHeroRatingPill}>
                      <Ionicons name="star" size={11} color="#f59e0b" style={{ marginRight: 3 }} />
                      <Text style={styles.profileHeroRatingText}>4.9 Rating</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => router.push('/documents')}
                    style={styles.profileHeroChevronBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-forward" size={22} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </ImageBackground>
            </View>

            {/* 2. KYC Verification Status Banner */}
            {hasPendingDocuments ? (
              <TouchableOpacity
                style={styles.profileKycBannerPending}
                onPress={() => router.push('/documents')}
                activeOpacity={0.85}
              >
                <View style={styles.profileKycIconPending}>
                  <MaterialCommunityIcons name="shield-alert-outline" size={28} color="#ef4444" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.profileKycTitlePending}>{t('profile.kyc_incomplete')}</Text>
                  <Text style={styles.profileKycSubPending}>
                    {t('profile.kyc_incomplete_sub')}
                  </Text>
                </View>
                <View style={styles.profileKycBtnPending}>
                  <Text style={styles.profileKycBtnPendingText}>{t('profile.upload')}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.profileKycBannerComplete}>
                <View style={styles.profileKycIconComplete}>
                  <Ionicons name="shield-checkmark" size={28} color="#16a34a" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.profileKycTitleComplete}>{t('profile.kyc_complete')}</Text>
                  <Text style={styles.profileKycSubComplete}>
                    {t('profile.kyc_complete_sub')}
                  </Text>
                </View>
                <View style={styles.profileKycBadgeVerified}>
                  <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                  <Text style={styles.profileKycBadgeVerifiedText}>{t('profile.verified')}</Text>
                </View>
              </View>
            )}

            {/* 3. Assigned Cab Details Card */}
            <View style={styles.profileCardWhite}>
              <View style={styles.profileCardHeader}>
                <View style={styles.profileCardHeaderLeft}>
                  <Ionicons name="car-sport" size={18} color="#0f2744" style={{ marginRight: 8 }} />
                  <Text style={styles.profileCardHeaderTitle}>{t('profile.assigned_cab')}</Text>
                </View>
                <View style={styles.profilePlatePill}>
                  <Text style={styles.profilePlatePillText}>
                    {driver?.vehicle?.plateNumber && driver.vehicle.plateNumber !== 'PENDING' && !driver.vehicle.plateNumber.startsWith('KA 01 TR 0000')
                      ? driver.vehicle.plateNumber.toUpperCase()
                      : 'KA-01-SD-2002'}
                  </Text>
                </View>
              </View>

              <View style={styles.profileCabColsRow}>
                <View style={styles.profileCabCol}>
                  <Text style={styles.profileCabColLabel}>{t('profile.vehicle_plate')}</Text>
                  <Text style={styles.profileCabColValue}>
                    {driver?.vehicle?.plateNumber && driver.vehicle.plateNumber !== 'PENDING' && !driver.vehicle.plateNumber.startsWith('KA 01 TR 0000')
                      ? driver.vehicle.plateNumber.toUpperCase()
                      : 'KA-01-SD-2002'}
                  </Text>
                </View>
                <View style={styles.profileCabColDivider} />
                <View style={styles.profileCabCol}>
                  <Text style={styles.profileCabColLabel}>{t('profile.category')}</Text>
                  <Text style={styles.profileCabColValue}>
                    {driver?.vehicle?.category
                      ? driver.vehicle.category.charAt(0).toUpperCase() + driver.vehicle.category.slice(1).toLowerCase()
                      : 'Sedan'}
                  </Text>
                </View>
                <View style={styles.profileCabColDivider} />
                <View style={styles.profileCabCol}>
                  <Text style={styles.profileCabColLabel}>{t('profile.fuel_emission')}</Text>
                  <Text style={styles.profileCabColValue}>
                    {driver?.vehicle?.fuelType || 'Diesel'}
                  </Text>
                </View>
              </View>

              <View style={styles.profileSeatingRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="person" size={15} color="#64748b" />
                  <Text style={styles.profileSeatingLabel}>{t('profile.seating_capacity')}</Text>
                </View>
                <Text style={styles.profileSeatingValue}>
                  {driver?.vehicle?.seatCount ? `${driver.vehicle.seatCount} ${t('profile.passenger_seats')}` : `4 ${t('profile.passenger_seats')}`}
                </Text>
              </View>
            </View>

            {/* 4. Document Status Card */}
            <View style={styles.profileCardWhite}>
              <View style={styles.profileCardHeader}>
                <View style={styles.profileCardHeaderLeft}>
                  <Ionicons name="document-text" size={18} color="#0f2744" style={{ marginRight: 8 }} />
                  <Text style={styles.profileCardHeaderTitle}>{t('profile.document_status')}</Text>
                </View>
                {!hasPendingDocuments ? (
                  <View style={styles.allDocsVerifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                    <Text style={styles.allDocsVerifiedText}>{t('profile.all_docs_verified')}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.pendingDocsBadge}
                    onPress={() => router.push('/documents')}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="time" size={13} color="#0f2744" />
                    <Text style={styles.pendingDocsText}>
                      {verificationDocs.completedCount} / 4 {t('profile.verified_count')}
                    </Text>
                    <Ionicons name="chevron-forward" size={13} color="#0f2744" />
                  </TouchableOpacity>
                )}
              </View>

              {/* 4 Mini Cards Row */}
              <View style={styles.profileDocGrid}>
                {verificationDocs.docs.map((doc) => (
                  <TouchableOpacity
                    key={doc.id}
                    style={styles.profileDocMiniCard}
                    onPress={() => router.push('/documents')}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={doc.icon} size={20} color="#0f2744" />
                    <Text style={styles.profileDocMiniTitle} numberOfLines={1}>
                      {doc.title}
                    </Text>
                    {doc.isCompleted ? (
                      <View style={styles.profileDocMiniStatusRow}>
                        <Ionicons name="checkmark-circle" size={11} color="#16a34a" />
                        <Text style={styles.profileDocMiniStatusGreen}>{t('profile.verified')}</Text>
                      </View>
                    ) : (
                      <View style={styles.profileDocMiniStatusRow}>
                        <Ionicons name="time" size={11} color="#ea580c" />
                        <Text style={styles.profileDocMiniStatusOrange}>{t('profile.pending')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 5. Settlement & Payout Account Card */}
            {(() => {
              const hasPayout = Boolean(driver?.bankAccountNumber || driver?.payoutUpiId);
              const isUpi = driver?.payoutMethod === 'UPI';
              const isVerified = driver?.payoutStatus === 'VERIFIED';
              const payoutTitle = hasPayout
                ? isUpi
                  ? `UPI: ${driver.payoutUpiId}`
                  : `${driver.bankName ? driver.bankName + ' • ' : ''}A/C •••• ${driver.bankAccountNumber?.slice(-4)}`
                : t('profile.add_bank_or_upi');

              return (
                <View style={styles.profileCardWhite}>
                  <TouchableOpacity
                    style={styles.profilePayoutRow}
                    activeOpacity={0.7}
                    onPress={() => router.push('/payout-details')}
                  >
                    <View style={styles.profilePayoutIconBox}>
                      <Ionicons name="wallet" size={18} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 12 }}>
                      <Text style={styles.profilePayoutTitle}>{t('profile.settlement_payout')}</Text>
                      <Text style={styles.profilePayoutSub} numberOfLines={1}>{payoutTitle}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {hasPayout ? (
                        <>
                          <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                          <Text style={styles.profilePayoutGreenText}>{t('profile.active_on_file')}</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="alert-circle" size={14} color="#ea580c" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#ea580c' }}>{t('profile.add_details')}</Text>
                        </>
                      )}
                      <Ionicons name="chevron-forward" size={16} color="#64748b" />
                    </View>
                  </TouchableOpacity>

                  <View style={styles.profilePayoutDivider} />

                  <TouchableOpacity
                    style={styles.profilePayoutRow}
                    activeOpacity={0.7}
                    onPress={() => router.push('/payout-details')}
                  >
                    <View style={styles.profilePayoutIconBox}>
                      <Ionicons name="stats-chart" size={18} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 12 }}>
                      <Text style={styles.profilePayoutTitle}>{t('profile.bank_upi_status')}</Text>
                      <Text style={styles.profilePayoutSub} numberOfLines={1}>
                        {isVerified
                          ? t('profile.payout_verified_sub')
                          : hasPayout
                          ? t('profile.payout_pending_sub')
                          : t('profile.payout_not_submitted_sub')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {isVerified ? (
                        <>
                          <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                          <Text style={styles.profilePayoutGreenText}>{t('profile.verified')}</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="time" size={14} color="#d97706" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#d97706' }}>
                            {hasPayout ? t('profile.in_review') : t('profile.pending')}
                          </Text>
                        </>
                      )}
                      <Ionicons name="chevron-forward" size={16} color="#64748b" />
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* 6. App Language Row (Matching Customer App) */}
            {(() => {
              const activeLangMeta = SUPPORTED_LANGUAGES.find((l) => l.code === (i18n.language || 'en')) || SUPPORTED_LANGUAGES[0];
              const langSub = activeLangMeta.code === 'en'
                ? 'English'
                : `${activeLangMeta.nativeLabel} (${activeLangMeta.label})`;

              return (
                <View style={styles.profileCardWhite}>
                  <TouchableOpacity
                    style={styles.profilePayoutRow}
                    activeOpacity={0.7}
                    onPress={() => setIsLangModalOpen(true)}
                  >
                    <View style={[styles.profilePayoutIconBox, { backgroundColor: '#0f2744' }]}>
                      <Ionicons name="globe-outline" size={18} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 12 }}>
                      <Text style={styles.profilePayoutTitle}>{t('profile.app_language')}</Text>
                      <Text style={styles.profilePayoutSub} numberOfLines={1}>{langSub}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={styles.profileLangCurrentBadge}>
                        <Ionicons name="globe-outline" size={11} color="rgb(240, 117, 15)" style={{ marginRight: 4 }} />
                        <Text style={styles.profileLangCurrentBadgeText}>
                          {activeLangMeta.nativeLabel}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#64748b" />
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Language Selection Modal (As done in Customer App) */}
            <LanguageSelectionModal
              visible={isLangModalOpen}
              onClose={() => setIsLangModalOpen(false)}
            />

            {/* 7. Sign Out Button */}
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.profileSignOutBtn}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="log-out-outline" size={22} color="#dc2626" />
                <Text style={styles.profileSignOutText}>{t('profile.sign_out')}</Text>
              </View>
              <View style={styles.profileSignOutChevronCircle}>
                <Ionicons name="chevron-forward" size={18} color="#dc2626" />
              </View>
            </TouchableOpacity>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mainHeaderWhite: {
    backgroundColor: '#162232',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    paddingBottom: 6,
    zIndex: 50,
  },
  headerBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverHeaderLogo: {
    width: 125,
    height: 38,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  heroCardBg: {
    width: '100%',
    height: 144,
    justifyContent: 'center',
  },
  heroCardContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  heroCardLeft: {
    maxWidth: '56%',
  },
  heroCardName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  heroCardRole: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 1,
  },
  heroCardPlateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  heroCardPlate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  heroDutyCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  heroDutyCapsuleOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  heroDutyCapsuleOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  heroDutyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  heroDutyText: {
    fontSize: 11.5,
    fontWeight: '800',
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
    backgroundColor: '#fffaf5',
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
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
  acceptDispatchBtnGreen: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  acceptDispatchBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
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
    fontSize: 11,
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
    fontSize: 10,
    fontWeight: '800',
    color: '#162232',
  },
  kpiTripsCountBadgeLight: {
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  kpiTripsCountTextGreen: {
    fontSize: 9,
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
    fontSize: 8.5,
    fontWeight: '800',
    color: '#059669',
  },
  kpiSettledCountText: {
    fontSize: 13.5,
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
    fontSize: 8.5,
    fontWeight: '800',
    color: '#b45309',
  },
  kpiPendingCountText: {
    fontSize: 13.5,
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
    fontSize: 14,
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
    fontSize: 11,
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
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tripCardDate: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  tripStatusBadgeGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  tripBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  settledBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeGreen: {
    backgroundColor: '#dcfce7',
  },
  badgeAmber: {
    backgroundColor: '#fef3c7',
  },
  badgeTextGreen: {
    fontSize: 8,
    fontWeight: '800',
    color: '#15803d',
  },
  badgeTextAmber: {
    fontSize: 8,
    fontWeight: '800',
    color: '#b45309',
  },
  tripCardRoute: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    marginVertical: 6,
  },
  tripRouteLine: {
    fontSize: 11,
    color: '#0f172a',
    marginVertical: 1,
  },
  tripDistanceLine: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  tripPaymentStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginTop: 6,
  },
  tripPaymentStatusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  settledBadgePillInline: {
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  profileHeroCardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0f2744',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  profileHeroCardBg: {
    width: '100%',
  },
  profileHeroCardOverlay: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 39, 68, 0.45)',
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
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  profileHeroRole: {
    color: 'rgba(255, 255, 255, 0.85)',
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
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '500',
  },
  profileHeroRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  profileHeroRatingText: {
    color: '#ffffff',
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
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  profileSignOutText: {
    color: '#dc2626',
    fontSize: 14.5,
    fontWeight: '800',
  },
  profileSignOutChevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
});
