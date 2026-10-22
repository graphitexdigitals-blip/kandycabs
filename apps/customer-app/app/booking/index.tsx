import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Image,
  Modal,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthModal } from '../../components/AuthModal';
import BookingFlowHeader from '../../components/BookingFlowHeader';
import { customerApiClient, customerTokenStorage } from '../../lib/api';
import { VehicleCategory, TripType, FuelType } from '@kandy-cabs/shared';

const { width } = Dimensions.get('window');

interface LuggageOption {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const LUGGAGE_OPTIONS: LuggageOption[] = [
  {
    id: 'NORMAL',
    label: 'Normal Luggage',
    shortLabel: 'Normal Luggage',
    description: '2 Standard suitcases',
    icon: 'bag-handle-outline',
  },
  {
    id: 'HAND_BAGS',
    label: 'Hand Bags Only',
    shortLabel: 'Hand Bags Only',
    description: 'Backpacks & small bags',
    icon: 'briefcase-outline',
  },
  {
    id: 'EXTRA_HEAVY',
    label: 'Heavy / Extra Luggage',
    shortLabel: 'Heavy Luggage',
    description: '3+ Large suitcases / cargo',
    icon: 'cube-outline',
  },
  {
    id: 'NO_LUGGAGE',
    label: 'No Luggage',
    shortLabel: 'No Luggage',
    description: 'Cabin bags only',
    icon: 'walk-outline',
  },
];

interface QuickTagItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const QUICK_TAGS: QuickTagItem[] = [
  { id: 'baby', label: 'Baby on Board', icon: 'heart-outline' },
  { id: 'boot', label: 'Extra Boot Space', icon: 'car-outline' },
  { id: 'silent', label: 'Silent Ride', icon: 'volume-mute-outline' },
  { id: 'elderly', label: 'Elderly Passenger', icon: 'person-outline' },
  { id: 'pet', label: 'Pet Friendly', icon: 'paw-outline' },
];

const FLEET_INFO: Record<
  string,
  {
    name: string;
    models: string;
    ratePerKm: number;
    minKm: number;
    passengers: number;
    luggage: number;
    badge: string;
    image: any;
    color: string;
    category: VehicleCategory;
  }
> = {
  HATCHBACK: {
    name: 'Hatchback',
    models: 'WagonR, Tiago, Celerio',
    ratePerKm: 11,
    minKm: 50,
    passengers: 4,
    luggage: 2,
    badge: 'ECONOMY CHOICE',
    image: require('../../assets/images/fleet-hatchback.png'),
    color: '#059669',
    category: VehicleCategory.HATCHBACK,
  },
  SEDAN: {
    name: 'Prime Sedan',
    models: 'Dzire, Etios, Honda Amaze',
    ratePerKm: 13,
    minKm: 60,
    passengers: 4,
    luggage: 3,
    badge: 'MOST POPULAR',
    image: require('../../assets/images/fleet-sedan.png'),
    color: '#ea580c',
    category: VehicleCategory.SEDAN,
  },
  SUV: {
    name: 'Prime SUV',
    models: 'Ertiga, Carens, XL6',
    ratePerKm: 16,
    minKm: 80,
    passengers: 6,
    luggage: 4,
    badge: 'FAMILY & GROUP',
    image: require('../../assets/images/fleet-suv.png'),
    color: '#0284c7',
    category: VehicleCategory.SUV,
  },
  CRYSTA: {
    name: 'Innova Crysta Luxury',
    models: 'Toyota Innova Crysta / Hycross',
    ratePerKm: 20,
    minKm: 100,
    passengers: 7,
    luggage: 5,
    badge: 'EXECUTIVE LUXURY',
    image: require('../../assets/images/fleet-crysta.png'),
    color: '#7c3aed',
    category: VehicleCategory.SUV_PREMIUM,
  },
  SUV_PREMIUM: {
    name: 'Innova Crysta Luxury',
    models: 'Toyota Innova Crysta / Hycross',
    ratePerKm: 20,
    minKm: 100,
    passengers: 7,
    luggage: 5,
    badge: 'EXECUTIVE LUXURY',
    image: require('../../assets/images/fleet-crysta.png'),
    color: '#7c3aed',
    category: VehicleCategory.SUV_PREMIUM,
  },
  TRAVELLER: {
    name: 'Tempo Traveller',
    models: 'Force Traveller 3350 AC (12+1)',
    ratePerKm: 26,
    minKm: 150,
    passengers: 14,
    luggage: 10,
    badge: 'LARGE GROUP',
    image: require('../../assets/images/fleet-traveller.png'),
    color: '#b45309',
    category: VehicleCategory.TEMPO_TRAVELER,
  },
  TEMPO_TRAVELER: {
    name: 'Tempo Traveller',
    models: 'Force Traveller 3350 AC (12+1)',
    ratePerKm: 26,
    minKm: 150,
    passengers: 14,
    luggage: 10,
    badge: 'LARGE GROUP',
    image: require('../../assets/images/fleet-traveller.png'),
    color: '#b45309',
    category: VehicleCategory.TEMPO_TRAVELER,
  },
  URBANIA: {
    name: 'Force Urbania',
    models: 'Force Urbania Luxury (10/13/17 Seater)',
    ratePerKm: 32,
    minKm: 150,
    passengers: 17,
    luggage: 10,
    badge: 'LUXURY VAN',
    image: require('../../assets/images/vehicle-urbania.jpg'),
    color: '#474D5E',
    category: VehicleCategory.TEMPO_TRAVELER,
  },
};

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straight = R * c;
  return Math.max(15, Math.round(straight * 1.3));
}

export default function BookingFunnelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  // Stepper: 1: Contact Info / Login, 2: Review & Payment, 3: Success Confirmation
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Route & Vehicle Info
  const pickup = (params.pickup as string) || 'Mangaluru';
  const drop = (params.drop as string) || 'Udupi';
  const pickupDate = (params.date as string) || 'Today';
  const pickupTime = (params.time as string) || '09:00';
  const tripTypeParam = (params.tripType as string) || 'ONEWAY';
  const localHours = Number(params.localHours) || 8;
  const rawCategory = (params.category as string) || 'SEDAN';

  const viaStopsRaw = (params.viaStops as string) || '[]';
  const viaStops: any[] = useMemo(() => {
    try {
      return JSON.parse(viaStopsRaw);
    } catch {
      return [];
    }
  }, [viaStopsRaw]);

  const pickupLat = Number(params.pickupLat) || 12.8634;
  const pickupLng = Number(params.pickupLng) || 74.8436;
  const dropLat = Number(params.dropLat) || 13.348;
  const dropLng = Number(params.dropLng) || 74.782;

  const vehicleInfo = FLEET_INFO[rawCategory] || FLEET_INFO.SEDAN;

  // Estimated Distance & Time
  const estimatedKm = useMemo(() => {
    if (tripTypeParam === 'LOCAL') {
      return localHours === 4 ? 40 : localHours === 8 ? 80 : 120;
    }
    if (viaStops && viaStops.length > 0) {
      let total = 0;
      let currLat = pickupLat;
      let currLng = pickupLng;
      for (const stop of viaStops) {
        if (stop && stop.lat && stop.lng) {
          total += calculateDistanceKm(currLat, currLng, stop.lat, stop.lng);
          currLat = stop.lat;
          currLng = stop.lng;
        }
      }
      total += calculateDistanceKm(currLat, currLng, dropLat, dropLng);
      return Math.max(15, total);
    }
    return calculateDistanceKm(pickupLat, pickupLng, dropLat, dropLng);
  }, [tripTypeParam, localHours, pickupLat, pickupLng, dropLat, dropLng, viaStops]);

  const estimatedHours = useMemo(() => {
    if (tripTypeParam === 'LOCAL') return `${localHours} hrs`;
    const totalMinutes = Math.round((estimatedKm / 45) * 60);
    if (totalMinutes < 60) {
      return `${Math.max(5, totalMinutes)} mins approx`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (mins === 0) {
      return `${hours} hr${hours > 1 ? 's' : ''} approx`;
    }
    return `${hours} hr${hours > 1 ? 's' : ''} ${mins} mins approx`;
  }, [tripTypeParam, localHours, estimatedKm]);

  const customRatePerKm = Number(params.ratePerKm) || vehicleInfo.ratePerKm;
  const customExtraKmRate = Number(params.extraKmRate) || customRatePerKm;
  const customThreshold = params.extraKmThreshold && Number(params.extraKmThreshold) > 0 ? Number(params.extraKmThreshold) : 0;
  const customMinKm = Number(params.minKm) || vehicleInfo.minKm;
  const customVehicleName = (params.selectedVehicleName as string) || vehicleInfo.name;

  // Pricing Calculation
  const baseEstimatedFare = useMemo(() => {
    if (customThreshold > 0 && estimatedKm > customThreshold) {
      const basePart = customThreshold * customRatePerKm;
      const extraPart = (estimatedKm - customThreshold) * customExtraKmRate;
      return Math.round(basePart + extraPart);
    }
    const billableKm = Math.max(customMinKm, estimatedKm);
    return Math.round(billableKm * customRatePerKm);
  }, [customMinKm, customRatePerKm, customExtraKmRate, customThreshold, estimatedKm]);

  // Auth & User Profile State
  const [user, setUser] = useState<any | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  // Guest Auth form state (if not logged in)
  const [authPhone, setAuthPhone] = useState('');
  const [authName, setAuthName] = useState('');
  const [authOtp, setAuthOtp] = useState('');
  const [authStep, setAuthStep] = useState<'PHONE' | 'OTP' | 'NAME'>('PHONE');
  const [authLoading, setAuthLoading] = useState(false);
  const [authDevOtp, setAuthDevOtp] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const maxSeatsParam = Number(params.maxSeats) || vehicleInfo.passengers || 4;
  const hasCarrierParam = (params.hasCarrier as string) === 'true';
  const carrierTextParam = (params.carrierText as string) || '';
  const carrierExcludedCarsParam = (params.carrierExcludedCars as string) || '';

  const passengerCountParam = Number(params.passengers) || 4;
  const luggageDetailsParam = (params.luggage as string) || 'Normal Luggage';
  const requestCarrierParam = params.requestCarrier === 'true' || params.hasCarrier === 'true';
  const specialReqParam = (params.specialRequirements as string) || '';

  const [passengerCount, setPassengerCount] = useState<number>(() => {
    const p = Number(params.passengers);
    if (p && p > 0) return p;
    return maxSeatsParam >= 10 ? Math.min(maxSeatsParam, 10) : Math.min(4, maxSeatsParam);
  });
  interface LuggageCounts {
    normal: number;
    handBags: number;
    heavy: number;
  }

  const MAX_LUGGAGE_BAGS = 10;

  const [luggageCounts, setLuggageCounts] = useState<LuggageCounts>({
    normal: 1,
    handBags: 0,
    heavy: 0,
  });
  const [isNoLuggage, setIsNoLuggage] = useState<boolean>(false);

  const totalLuggageBags = isNoLuggage ? 0 : (luggageCounts.normal + luggageCounts.handBags + luggageCounts.heavy);

  const selectedLuggageSummary = useMemo(() => {
    if (isNoLuggage || (luggageCounts.normal === 0 && luggageCounts.handBags === 0 && luggageCounts.heavy === 0)) {
      return 'No Luggage';
    }
    const parts: string[] = [];
    if (luggageCounts.normal > 0) parts.push(`Normal Luggage: ${luggageCounts.normal}`);
    if (luggageCounts.handBags > 0) parts.push(`Hand Bags: ${luggageCounts.handBags}`);
    if (luggageCounts.heavy > 0) parts.push(`Heavy Luggage: ${luggageCounts.heavy}`);
    return `${parts.join(', ')} (Total: ${totalLuggageBags} bags)`;
  }, [isNoLuggage, luggageCounts, totalLuggageBags]);

  const handleIncrementLuggage = (category: 'normal' | 'handBags' | 'heavy') => {
    if (totalLuggageBags >= MAX_LUGGAGE_BAGS) {
      Alert.alert('Maximum Luggage', `Maximum limit of ${MAX_LUGGAGE_BAGS} bags reached across all luggage types.`);
      return;
    }
    setIsNoLuggage(false);
    setLuggageCounts((prev) => ({
      ...prev,
      [category]: Math.min(MAX_LUGGAGE_BAGS, prev[category] + 1),
    }));
  };

  const handleDecrementLuggage = (category: 'normal' | 'handBags' | 'heavy') => {
    setLuggageCounts((prev) => {
      const nextVal = Math.max(0, prev[category] - 1);
      const updated = { ...prev, [category]: nextVal };
      if (updated.normal === 0 && updated.handBags === 0 && updated.heavy === 0) {
        setIsNoLuggage(true);
      }
      return updated;
    });
  };

  const handleSelectNoLuggage = () => {
    setIsNoLuggage(true);
    setLuggageCounts({ normal: 0, handBags: 0, heavy: 0 });
  };

  const [requestCarrier, setRequestCarrier] = useState<boolean>(
    params.requestCarrier === 'true'
  );
  const [pickupNotes, setPickupNotes] = useState<string>(specialReqParam);

  const handleDecrementPassengers = () => {
    if (passengerCount > 1) {
      setPassengerCount((prev) => prev - 1);
    }
  };

  const handleIncrementPassengers = () => {
    if (passengerCount < maxSeatsParam) {
      setPassengerCount((prev) => prev + 1);
    }
  };

  const toggleQuickTag = (tagLabel: string) => {
    const isPresent = pickupNotes.includes(tagLabel);
    if (isPresent) {
      const regex = new RegExp(`(^|,\\s*)${tagLabel}`, 'g');
      const updated = pickupNotes.replace(regex, '').replace(/^,\s*/, '').trim();
      setPickupNotes(updated);
    } else {
      const updated = pickupNotes.trim()
        ? `${pickupNotes.trim()}, ${tagLabel}`
        : tagLabel;
      setPickupNotes(updated);
    }
  };

  const corporateMode = (params.corporateMode as string) || '';
  const corporateStartDate = (params.corporateStartDate as string) || '';
  const corporateEndDate = (params.corporateEndDate as string) || '';
  const corporateTotalDays = (params.corporateTotalDays as string) || '';
  const corporateActiveDatesJson = (params.corporateActiveDatesJson as string) || '';
  const corporateExcludedDatesJson = (params.corporateExcludedDatesJson as string) || '';
  const corporatePickupTimesJson = (params.corporatePickupTimesJson as string) || '';

  const corporateInfoNote = useMemo(() => {
    if (tripTypeParam !== 'CORPORATE') return '';
    if (corporateMode === 'DAILY') {
      let activeDates: string[] = [];
      let pickupTimes: string[] = [];
      try { activeDates = JSON.parse(corporateActiveDatesJson); } catch {}
      try { pickupTimes = JSON.parse(corporatePickupTimesJson); } catch {}
      return `[CORPORATE DAILY RIDES] Schedule: ${corporateStartDate} to ${corporateEndDate} (${corporateTotalDays || activeDates.length} days active) | Pickup Times: ${pickupTimes.join(', ')}`;
    }
    return `[CORPORATE BOOK ONCE] Date: ${pickupDate} | Time: ${pickupTime}`;
  }, [tripTypeParam, corporateMode, corporateStartDate, corporateEndDate, corporateTotalDays, corporateActiveDatesJson, corporatePickupTimesJson, pickupDate, pickupTime]);

  const pickupCity = useMemo(() => (pickup ? pickup.split(',')[0].trim() : 'Pickup Location'), [pickup]);
  const dropCity = useMemo(() => (drop ? drop.split(',')[0].trim() : 'Drop Location'), [drop]);

  const displayPickupDate = useMemo(() => {
    if (!pickupDate || pickupDate === 'Today') {
      const now = new Date();
      const day = now.getDate();
      const month = now.toLocaleDateString('en-US', { month: 'short' });
      const year = now.getFullYear();
      const weekday = now.toLocaleDateString('en-US', { weekday: 'short' });
      return `${day} ${month} ${year} (${weekday})`;
    }
    try {
      const d = new Date(pickupDate);
      if (!isNaN(d.getTime())) {
        const day = d.getDate();
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        const year = d.getFullYear();
        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
        return `${day} ${month} ${year} (${weekday})`;
      }
    } catch {}
    return pickupDate;
  }, [pickupDate]);

  const displayPickupTime = useMemo(() => {
    if (!pickupTime) return '09:00 AM';
    if (pickupTime.includes('AM') || pickupTime.includes('PM')) return pickupTime;
    const parts = pickupTime.split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const mins = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hStr = hours < 10 ? `0${hours}` : `${hours}`;
      return `${hStr}:${mins} ${ampm}`;
    }
    return pickupTime;
  }, [pickupTime]);

  // Step 1: Passenger Contact Info
  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [passengerEmail, setPassengerEmail] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [alternateEmail, setAlternateEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [showAlternateEmail, setShowAlternateEmail] = useState(false);
  const [showGst, setShowGst] = useState(false);
  const [flightNumber, setFlightNumber] = useState<string>((params.flightNumber as string) || '');
  const [showLuggageModal, setShowLuggageModal] = useState(false);
  const [sameAsAccount, setSameAsAccount] = useState(true);

  const handleToggleSameAsAccount = () => {
    const nextVal = !sameAsAccount;
    setSameAsAccount(nextVal);
    if (nextVal) {
      if (user) {
        const rawName = user.fullName || '';
        const cleanP = user.phone ? user.phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10) : '';
        setPassengerName(rawName === 'Kandy Customer' ? '' : rawName);
        setPassengerPhone(cleanP ? `+91 ${cleanP.slice(0, 5)} ${cleanP.slice(5)}` : '');
        setPassengerEmail(user.email || '');
      } else {
        setAuthModalVisible(true);
      }
    }
  };

  // Step 2: Promo Coupon & Payment Mode
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'ADVANCE_25' | 'PAY_ON_DROP' | 'CORPORATE'>(
    tripTypeParam === 'CORPORATE' ? 'CORPORATE' : 'ADVANCE_25'
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'UPI' | 'CARD' | 'NETBANKING' | 'OTHER_UPI'>('UPI');
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to top when switching steps
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  // Step 3: Booking Confirmation & Submitting
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);

  // Check user authentication on mount
  useEffect(() => {
    async function checkAuth() {
      setAuthChecking(true);
      try {
        const token = customerTokenStorage.getToken();
        if (!token) {
          setUser(null);
          setPassengerName('');
          setPassengerPhone('');
          setPassengerEmail('');
          setAuthChecking(false);
          return;
        }
        const res = await customerApiClient.fetch('/api/auth/me');
        const rawName = res?.user?.fullName;
        const registeredName = (rawName === 'Kandy Customer' ? '' : (rawName || '')).trim();
        const cleanP = res?.user?.phone ? res.user.phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10) : '';

        if (res?.user && registeredName.length > 0) {
          const validUser = { ...res.user, fullName: registeredName };
          customerTokenStorage.setUser(validUser);
          setUser(validUser);
          setPassengerName(registeredName);
          setPassengerPhone(cleanP ? `+91 ${cleanP.slice(0, 5)} ${cleanP.slice(5)}` : '');
          setPassengerEmail(res.user.email || '');
          setSameAsAccount(true);
        } else {
          setUser(null);
          setPassengerName('');
          if (cleanP) {
            setAuthPhone(cleanP);
            setPassengerPhone(`+91 ${cleanP.slice(0, 5)} ${cleanP.slice(5)}`);
            setAuthStep('NAME');
          } else {
            setPassengerPhone('');
            setAuthStep('PHONE');
          }
          setPassengerEmail('');
          setSameAsAccount(false);
        }
      } catch {
        // Guest mode
        setUser(null);
        setPassengerName('');
        setPassengerPhone('');
        setPassengerEmail('');
        setSameAsAccount(false);
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
    const unsub = customerTokenStorage.subscribe(() => {
      const current = customerTokenStorage.getUser();
      const rawName = current?.fullName;
      const currentName = (rawName === 'Kandy Customer' ? '' : (rawName || '')).trim();
      if (!current || !currentName) {
        setUser(null);
        setSameAsAccount(false);
      } else {
        const validUser = { ...current, fullName: currentName };
        setUser(validUser);
        setPassengerName(currentName);
        const cleanP = current.phone ? current.phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10) : '';
        setPassengerPhone(cleanP ? `+91 ${cleanP.slice(0, 5)} ${cleanP.slice(5)}` : '');
        setPassengerEmail(current.email || '');
        setSameAsAccount(true);
      }
    });
    return () => unsub();
  }, []);

  // Handle Send OTP for Guest Auth
  const handleSendOtp = async () => {
    const cleaned = authPhone.trim().replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setAuthError('Please enter a valid 10-digit mobile number');
      return;
    }
    setAuthError(null);
    setAuthLoading(true);

    try {
      const res = await customerApiClient.fetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: cleaned }),
      });

      if (res && res.success) {
        const devCode = res.debugOtp || res.devOtp || '1234';
        setAuthDevOtp(devCode);
        setAuthOtp(devCode);
        setAuthStep('OTP');
      } else {
        setAuthError(res?.message || 'Failed to send OTP code.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Connection error. Please retry.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Verify OTP for Guest Auth
  const handleVerifyOtp = async () => {
    if (authOtp.trim().length !== 4) {
      setAuthError('Please enter the 4-digit code sent to your phone');
      return;
    }
    setAuthError(null);
    setAuthLoading(true);

    try {
      const cleaned = authPhone.trim().replace(/\D/g, '');
      const res = await customerApiClient.fetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone: cleaned,
          otp: authOtp.trim(),
        }),
      });

      if (res && res.success) {
        if (res.token) {
          customerTokenStorage.setToken(res.token);
        }

        const rawName = res.user?.fullName;
        const registeredName = (rawName === 'Kandy Customer' ? '' : (rawName || '')).trim();
        const hasName = Boolean(registeredName.length > 0 && res.hasRegisteredName !== false);

        if (hasName) {
          // Existing customer with registered name -> auto login
          const validUser = { ...res.user, fullName: registeredName };
          customerTokenStorage.setUser(validUser);
          setUser(validUser);
          setPassengerName(registeredName);
          setPassengerPhone(cleaned);
          setPassengerEmail(res.user.email || '');
          Alert.alert('Signed In Successfully! 👋', `Welcome, ${registeredName}!`);
        } else {
          // New customer without name -> ask for name in step 2 (do NOT set user yet, keep auth card open)
          setUser(null);
          setPassengerPhone(cleaned);
          setPassengerName('');
          setAuthStep('NAME');
        }
      } else {
        setAuthError(res?.message || 'Invalid verification code.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Verification failed. Please retry.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Save Name for New Customer in Guest Auth
  const handleSaveAuthName = async () => {
    const trimmed = authName.trim();
    if (!trimmed) {
      setAuthError('Please enter your full name to proceed');
      return;
    }

    setAuthError(null);
    setAuthLoading(true);

    try {
      const cleaned = authPhone.trim().replace(/\D/g, '') || passengerPhone;
      const res = await customerApiClient.fetch('/api/auth/update-profile', {
        method: 'POST',
        body: JSON.stringify({ fullName: trimmed }),
      });

      const updatedUser = { ...(res?.user || user || {}), fullName: trimmed, phone: cleaned };
      customerTokenStorage.setUser(updatedUser);
      setUser(updatedUser);
      setPassengerName(trimmed);
      setPassengerPhone(cleaned);
      setAuthStep('PHONE');
      Alert.alert('Welcome to Kandy Cabs! 👋', `Glad to have you, ${trimmed}!`);
    } catch {
      const cleaned = authPhone.trim().replace(/\D/g, '') || passengerPhone;
      const fallbackUser = { ...(user || {}), fullName: trimmed, phone: cleaned };
      customerTokenStorage.setUser(fallbackUser);
      setUser(fallbackUser);
      setPassengerName(trimmed);
      setPassengerPhone(cleaned);
      setAuthStep('PHONE');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Apply Coupon
  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponMsg('Please enter a coupon code.');
      return;
    }

    if (code === 'KANDY10' || code === 'SAVE10') {
      const discount = Math.round(baseEstimatedFare * 0.1);
      setCouponDiscount(discount);
      setCouponApplied(true);
      setCouponMsg(`🎉 Promo "${code}" applied! You saved ₹${discount}`);
    } else if (code === 'FIRST50' || code === 'WELCOME50') {
      const discount = 50;
      setCouponDiscount(discount);
      setCouponApplied(true);
      setCouponMsg(`🎉 Promo "${code}" applied! You saved ₹${discount}`);
    } else {
      setCouponApplied(false);
      setCouponDiscount(0);
      setCouponMsg('Invalid coupon code. Try KANDY10 or FIRST50.');
    }
  };

  // Pet Friendly detection & convenience fee
  const isPetFriendly = /pet\s*friendly/i.test(pickupNotes);
  const petFee = isPetFriendly ? 500 : 0;

  // Calculate final totals
  const subtotal = Math.max(0, baseEstimatedFare + petFee - couponDiscount);
  const gstAmount = Math.round(subtotal * 0.05);
  const totalFare = subtotal + gstAmount;
  const advanceAmount = Math.round(totalFare * 0.25);
  const balanceAmount = totalFare - advanceAmount;

  // Proceed to Step 2
  const handleProceedToStep2 = () => {
    if (!passengerName.trim()) {
      Alert.alert('Name Required', 'Please enter the passenger full name.');
      return;
    }
    const cleanPhone = passengerPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      Alert.alert('Phone Required', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!user) {
      setAuthPhone(cleanPhone);
      setAuthModalVisible(true);
      return;
    }

    setStep(2);
  };

  // Step 2 -> Step 3: Create Booking
  const handleConfirmBooking = async () => {
    if (!agreedToTerms) {
      Alert.alert('Terms & Conditions', 'Please accept the Terms & Conditions and Cancellation Policy to proceed.');
      return;
    }
    if (!user) {
      setAuthModalVisible(true);
      return;
    }
    setSubmitting(true);
    try {
      const idempotencyKey = `idemp_app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const scheduledAt = new Date().toISOString();

      const res = await customerApiClient.fetch('/api/customer/bookings', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          pickupAddress: pickup,
          pickupLat,
          pickupLng,
          dropAddress: drop,
          dropLat,
          dropLng,
          category: vehicleInfo.category,
          fuelType: FuelType.DIESEL,
          tripType: tripTypeParam as TripType,
          scheduledAt,
          durationDays: 1,
          packageHours: localHours,
          couponCode: couponApplied ? couponCode.trim().toUpperCase() : undefined,
          passengerName: passengerName.trim(),
          passengerPhone: passengerPhone.replace(/\D/g, '').slice(-10),
          passengerEmail: passengerEmail.trim() || undefined,
          alternateEmail: alternateEmail.trim() || undefined,
          companyName: companyName.trim() || undefined,
          gstin: gstin.trim().toUpperCase() || undefined,
          paymentMode: paymentMode === 'PAY_ON_DROP' ? 'PAY_ON_DROP' : 'ADVANCE',
          requestCarrier: requestCarrier,
          hasCarrier: requestCarrier,
          flightNumber: flightNumber.trim() ? flightNumber.trim().toUpperCase() : undefined,
          hasPet: isPetFriendly,
          isPetFriendly: isPetFriendly,
          petFee: petFee,
          notes: [
            corporateInfoNote,
            `Payment Method: ${selectedPaymentMethod}`,
            viaStops.length > 0 ? `Intermediate Stops: ${viaStops.map((s: any) => s.label).join(' ➔ ')}` : '',
            flightNumber.trim() ? `Flight: ${flightNumber.trim().toUpperCase()}` : '',
            alternatePhone.trim() ? `Alt Contact: +91 ${alternatePhone.replace(/\D/g, '').slice(-10)}` : '',
            alternateEmail.trim() ? `Alt Email: ${alternateEmail.trim()}` : '',
            gstin.trim() ? `GSTIN: ${gstin.trim().toUpperCase()}${companyName.trim() ? ` (${companyName.trim()})` : ''}` : '',
            selectedLuggageSummary ? `Luggage: ${selectedLuggageSummary}` : '',
            requestCarrier ? 'Roof Luggage Carrier Requested' : '',
            isPetFriendly ? 'Pet Friendly Requested' : '',
            pickupNotes.trim(),
          ].filter(Boolean).join(' | ') || undefined,
          passengers: passengerCount,
          luggage: selectedLuggageSummary || luggageDetailsParam,
          specialRequirements: [
            corporateInfoNote,
            `Payment: ${selectedPaymentMethod}`,
            viaStops.length > 0 ? `Via Stops (${viaStops.length}): ${viaStops.map((s: any) => s.label).join(' ➔ ')}` : '',
            flightNumber.trim() ? `Flight Number: ${flightNumber.trim().toUpperCase()}` : '',
            alternatePhone.trim() ? `Alt Mobile: +91 ${alternatePhone.replace(/\D/g, '').slice(-10)}` : '',
            alternateEmail.trim() ? `Alt Email: ${alternateEmail.trim()}` : '',
            gstin.trim() ? `GST Details: ${gstin.trim().toUpperCase()}${companyName.trim() ? ` - ${companyName.trim()}` : ''}` : '',
            requestCarrier ? 'Roof Luggage Carrier: Requested (Cab Rooftop Carrier)' : '',
            isPetFriendly ? 'Pet Friendly: Yes' : '',
            pickupNotes.trim(),
          ].filter(Boolean).join(' | ') || undefined,
        }),
      });

      if (res && res.success && res.booking) {
        setConfirmedBooking(res.booking);
        setStep(3);
      } else {
        Alert.alert('Booking Error', res?.message || 'Could not place booking request.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to connect with server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={true} />

      {/* 1 & 2. Unified Booking Header & 3-Step Stepper */}
      <BookingFlowHeader
        currentStep={3}
        title={step === 3 ? 'Booking Confirmed 🎉' : step === 2 ? 'Review & Payment' : 'Passenger Details'}
        subtitle={
          step === 3
            ? 'Your verified cab booking has been created and dispatched.'
            : undefined
        }
        subStepLabel={
          step === 3
            ? 'Confirmed'
            : step === 2
            ? 'Review & Payment'
            : 'Passenger Info'
        }
        step3Label={step === 2 ? 'Review & Pay' : undefined}
        isConfirmed={step === 3}
        topInset={topInset}
        onBack={() => {
          if (step === 3) {
            router.replace('/my-bookings');
          } else if (step === 2) {
            setStep(1);
          } else {
            router.back();
          }
        }}
        onStep1Press={() => {
          if (step !== 3) {
            router.navigate({
              pathname: '/trip-details',
              params: {
                ...params,
                tripType: tripTypeParam,
              },
            });
          }
        }}
        onStep2Press={() => {
          if (step !== 3) {
            router.navigate({
              pathname: '/select-cab',
              params: {
                ...params,
                tripType: tripTypeParam,
              },
            });
          }
        }}
      />

      {/* 3. Main Body Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            step === 3 && {
              flexGrow: 1,
              paddingTop: 4,
              paddingBottom: Math.max(insets.bottom, 4),
              paddingHorizontal: 10,
            },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ========================================================= */}
          {/* STEP 1: PASSENGER DETAILS                                 */}
          {/* ========================================================= */}
          {step === 1 && (
            <View style={styles.stepSection}>
              {/* Top Vehicle & Route Summary Card (Matching Reference) */}
              <View style={styles.topSummaryCard}>
                {/* 1. Vehicle & Fare Row */}
                <View style={styles.topSummaryUpperRow}>
                  {/* Left: Car Image */}
                  <Image
                    source={vehicleInfo.image}
                    style={styles.topSummaryVehicleImage}
                    resizeMode="contain"
                  />

                  {/* Middle: Vehicle Specs & Change Vehicle */}
                  <View style={styles.topSummaryVehicleDetails}>
                    <Text style={styles.topSummaryVehicleName}>{customVehicleName}</Text>

                    {/* Specs Icons */}
                    <View style={styles.topSummarySpecsRow}>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="person" size={11} color="#64748b" />
                        <Text style={styles.topSummarySpecText}>
                          {passengerCountParam || vehicleInfo.passengers} + 1
                        </Text>
                      </View>
                      <Text style={styles.topSummarySpecPipe}>|</Text>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="briefcase" size={11} color="#64748b" />
                        <Text style={styles.topSummarySpecText}>{vehicleInfo.luggage}</Text>
                      </View>
                      <Text style={styles.topSummarySpecPipe}>|</Text>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="snow" size={11} color="#64748b" />
                        <Text style={styles.topSummarySpecText}>A/C</Text>
                      </View>
                    </View>

                    {/* Change Vehicle Link */}
                    <TouchableOpacity
                      style={styles.topSummaryChangeVehicleBtn}
                      activeOpacity={0.7}
                      onPress={() => router.back()}
                    >
                      <Text style={styles.topSummaryChangeVehicleText}>Change Vehicle</Text>
                      <Ionicons name="chevron-down" size={12} color="#2563eb" style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                  </View>

                  {/* Vertical Divider */}
                  <View style={styles.topSummaryVerticalLine} />

                  {/* Right: Fare Column */}
                  <View style={styles.topSummaryPriceCol}>
                    <Text style={styles.topSummaryPrice}>₹ {totalFare.toLocaleString('en-IN')}</Text>
                    <Text style={styles.topSummaryGst}>(Total Trip Fare)</Text>
                    <View style={styles.topSummaryAdvancePill}>
                      <Text style={styles.topSummaryAdvanceText}>Pay 25%: ₹{advanceAmount.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>

                {/* Horizontal Divider */}
                <View style={styles.topSummaryHorizontalLine} />

                {/* 2. Route & Scheduled Time Row */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.topSummaryRouteScrollContent}
                >
                  {/* Pickup & Drop Section */}
                  <View style={styles.topSummaryLocationsGroup}>
                    {/* Pickup */}
                    <View style={styles.topSummaryLocationItem}>
                      <Ionicons name="location" size={14} color="#ea580c" style={{ marginRight: 3 }} />
                      <View>
                        <Text style={styles.topSummaryLocationName} numberOfLines={1}>
                          {pickupCity}
                        </Text>
                        <Text style={styles.topSummaryLocationSub}>Pickup Location</Text>
                      </View>
                    </View>

                    {/* Dashed / Arrow Separator */}
                    <View style={styles.topSummaryArrowContainer}>
                      <Text style={styles.topSummaryArrowLine}>┄┄</Text>
                      <Ionicons name="arrow-forward" size={11} color="#94a3b8" />
                    </View>

                    {/* Drop */}
                    <View style={styles.topSummaryLocationItem}>
                      <Ionicons name="location" size={14} color="#103A75" style={{ marginRight: 3 }} />
                      <View>
                        <Text style={styles.topSummaryLocationName} numberOfLines={1}>
                          {dropCity}
                        </Text>
                        <Text style={styles.topSummaryLocationSub}>Drop Location</Text>
                      </View>
                    </View>
                  </View>

                  {/* Vertical Divider */}
                  <View style={styles.topSummaryRouteDivider} />

                  {/* Pickup Date */}
                  <View style={styles.topSummaryDateTimeItem}>
                    <Ionicons name="calendar-outline" size={13} color="#103A75" style={{ marginRight: 3 }} />
                    <View>
                      <Text style={styles.topSummaryDateTimeText} numberOfLines={1}>
                        {displayPickupDate}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Pickup Date</Text>
                    </View>
                  </View>

                  {/* Vertical Divider */}
                  <View style={styles.topSummaryRouteDivider} />

                  {/* Pickup Time */}
                  <View style={styles.topSummaryDateTimeItem}>
                    <Ionicons name="time-outline" size={13} color="#ea580c" style={{ marginRight: 3 }} />
                    <View>
                      <Text style={styles.topSummaryDateTimeText} numberOfLines={1}>
                        {displayPickupTime}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Pickup Time</Text>
                    </View>
                  </View>

                  {/* Flight Number for Airport Transfer */}
                  {tripTypeParam === 'AIRPORT' && flightNumber.trim().length > 0 && (
                    <>
                      <View style={styles.topSummaryRouteDivider} />
                      <View style={styles.topSummaryDateTimeItem}>
                        <Ionicons name="airplane" size={13} color="#0284c7" style={{ marginRight: 3 }} />
                        <View>
                          <Text style={styles.topSummaryDateTimeText} numberOfLines={1}>
                            {flightNumber.trim()}
                          </Text>
                          <Text style={styles.topSummaryLocationSub}>Flight No</Text>
                        </View>
                      </View>
                    </>
                  )}
                </ScrollView>
              </View>

              {/* Passenger Details Title & Subtitle */}
              <View style={styles.sectionHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionHeaderTitle}>Passenger Details</Text>
                  <Text style={styles.sectionHeaderSub}>Enter passenger details for your booking</Text>
                </View>
              </View>

              {/* Lead Passenger Card */}
              <View style={styles.leadPassengerCard}>
                {/* Top Header of Card */}
                <View style={styles.leadPassengerHeaderRow}>
                  <View style={styles.leadPassengerLeftTitle}>
                    <Ionicons name="person" size={17} color="#ea580c" />
                    <Text style={styles.leadPassengerTitle}>Lead Passenger</Text>
                    <Text style={styles.leadPassengerSub}>(Primary Contact)</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.sameAccountCheckboxRow}
                    activeOpacity={0.7}
                    onPress={handleToggleSameAsAccount}
                  >
                    <View style={[styles.checkboxBox, sameAsAccount && styles.checkboxBoxActive]}>
                      {sameAsAccount && <Ionicons name="checkmark" size={11} color="#ffffff" />}
                    </View>
                    <Text style={styles.sameAccountText}>Same as account details</Text>
                  </TouchableOpacity>
                </View>

                {/* 2x2 Grid of Inputs */}
                {/* Row 1: Full Name & Mobile Number */}
                <View style={styles.gridRow}>
                  {/* Full Name */}
                  <View style={[styles.gridCol, { marginRight: 4 }]}>
                    <View style={styles.inputCard}>
                      <Ionicons name="person" size={18} color="#103A75" style={styles.inputCardIcon} />
                      <View style={styles.inputCardTextCol}>
                        <Text style={styles.inputCardLabel}>
                          Full Name <Text style={{ color: '#ea580c' }}>*</Text>
                        </Text>
                        <TextInput
                          style={styles.inputCardField}
                          placeholder="Enter full name"
                          placeholderTextColor="#94a3b8"
                          value={passengerName}
                          onChangeText={(t) => {
                            setPassengerName(t);
                            if (sameAsAccount && user && t !== user.fullName) {
                              setSameAsAccount(false);
                            }
                          }}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Mobile Number */}
                  <View style={[styles.gridCol, { marginLeft: 4 }]}>
                    <View style={styles.inputCard}>
                      <Ionicons name="call" size={18} color="#103A75" style={styles.inputCardIcon} />
                      <View style={styles.inputCardTextCol}>
                        <Text style={styles.inputCardLabel}>
                          Mobile Number <Text style={{ color: '#ea580c' }}>*</Text>
                        </Text>
                        <TextInput
                          style={styles.inputCardField}
                          placeholder="+91 98765 43210"
                          placeholderTextColor="#94a3b8"
                          keyboardType="phone-pad"
                          value={passengerPhone}
                          onChangeText={(t) => {
                            setPassengerPhone(t);
                            if (sameAsAccount && user) {
                              setSameAsAccount(false);
                            }
                          }}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Row 2: Email ID & Alternate Mobile Number */}
                <View style={[styles.gridRow, { marginTop: 8 }]}>
                  {/* Email ID */}
                  <View style={[styles.gridCol, { marginRight: 4 }]}>
                    <View style={styles.inputCard}>
                      <Ionicons name="mail-outline" size={18} color="#64748b" style={styles.inputCardIcon} />
                      <View style={styles.inputCardTextCol}>
                        <Text style={styles.inputCardLabel}>Email ID</Text>
                        <TextInput
                          style={styles.inputCardField}
                          placeholder="Enter email address"
                          placeholderTextColor="#94a3b8"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          value={passengerEmail}
                          onChangeText={(t) => {
                            setPassengerEmail(t);
                            if (sameAsAccount && user && t !== user.email) {
                              setSameAsAccount(false);
                            }
                          }}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Alternate Mobile Number */}
                  <View style={[styles.gridCol, { marginLeft: 4 }]}>
                    <View style={styles.inputCard}>
                      <Ionicons name="call-outline" size={18} color="#64748b" style={styles.inputCardIcon} />
                      <View style={styles.inputCardTextCol}>
                        <Text style={styles.inputCardLabel} numberOfLines={1} ellipsizeMode="tail">
                          Alternate Mobile Number
                        </Text>
                        <TextInput
                          style={styles.inputCardField}
                          placeholder="Enter alternate number"
                          placeholderTextColor="#94a3b8"
                          keyboardType="phone-pad"
                          value={alternatePhone}
                          onChangeText={setAlternatePhone}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Optional Addons: Alternate Email & Add GST Buttons */}
                <View style={styles.optionalAddonsRow}>
                  <TouchableOpacity
                    style={[styles.addonPillBtn, showAlternateEmail && styles.addonPillBtnActive]}
                    onPress={() => setShowAlternateEmail((prev) => !prev)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showAlternateEmail ? "remove" : "add"}
                      size={13}
                      color="#2563eb"
                    />
                    <Text style={styles.addonPillText}>Alternate Email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.addonPillBtn, showGst && styles.addonPillBtnActive]}
                    onPress={() => setShowGst((prev) => !prev)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showGst ? "remove" : "add"}
                      size={13}
                      color="#2563eb"
                    />
                    <Text style={styles.addonPillText}>Add GST</Text>
                  </TouchableOpacity>
                </View>

                {/* Alternate Email Input Box (Expanded) */}
                {showAlternateEmail && (
                  <View style={styles.addonExpandRow}>
                    <View style={styles.addonExpandColFull}>
                      <TextInput
                        style={styles.addonInputBox}
                        placeholder="Enter alternate email address"
                        placeholderTextColor="#94a3b8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={alternateEmail}
                        onChangeText={setAlternateEmail}
                      />
                    </View>
                  </View>
                )}

                {/* GSTIN & Company Name Inputs (Expanded - side-by-side matching reference image) */}
                {showGst && (
                  <View style={[styles.addonExpandRow, { gap: 8 }]}>
                    <View style={styles.addonExpandColHalf}>
                      <TextInput
                        style={styles.addonInputBox}
                        placeholder="Company Name"
                        placeholderTextColor="#94a3b8"
                        value={companyName}
                        onChangeText={setCompanyName}
                      />
                    </View>
                    <View style={styles.addonExpandColHalf}>
                      <TextInput
                        style={styles.addonInputBox}
                        placeholder="15-digit GSTIN"
                        placeholderTextColor="#94a3b8"
                        value={gstin}
                        onChangeText={(t) => setGstin(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))}
                        autoCapitalize="characters"
                        maxLength={15}
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                )}

                {/* Row 3: Flight Number (Airport Transfer Only) */}
                {tripTypeParam === 'AIRPORT' && (
                  <View style={[styles.gridRow, { marginTop: 8 }]}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.inputCard}>
                        <Ionicons name="airplane" size={18} color="#103A75" style={styles.inputCardIcon} />
                        <View style={styles.inputCardTextCol}>
                          <Text style={styles.inputCardLabel}>Flight Number (Optional)</Text>
                          <TextInput
                            style={styles.inputCardField}
                            placeholder="e.g. 6E 214, AI 505"
                            placeholderTextColor="#94a3b8"
                            value={flightNumber}
                            onChangeText={(t) => setFlightNumber(t.toUpperCase())}
                            autoCapitalize="characters"
                            autoCorrect={false}
                          />
                        </View>
                        {flightNumber.length > 0 && (
                          <TouchableOpacity
                            onPress={() => setFlightNumber('')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close-circle" size={16} color="#94a3b8" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Passengers & Luggage Card */}
              <View style={styles.cardSection}>
                {/* Passengers Row */}
                <View style={styles.passengerRow}>
                  <View style={styles.passengerTextGroup}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="people" size={18} color="#ea580c" />
                      <Text style={styles.cardSectionTitle}>Passengers</Text>
                    </View>
                    <Text style={styles.cardSectionSubtitle}>
                      {passengerCount} of max {maxSeatsParam} seats selected
                    </Text>
                  </View>

                  <View style={styles.passengerStepperContainer}>
                    <TouchableOpacity
                      style={[styles.stepperBtn, passengerCount <= 1 && styles.stepperBtnDisabled]}
                      onPress={handleDecrementPassengers}
                      disabled={passengerCount <= 1}
                      activeOpacity={0.6}
                    >
                      <Ionicons
                        name="remove"
                        size={16}
                        color={passengerCount <= 1 ? '#cbd5e1' : '#64748b'}
                      />
                    </TouchableOpacity>

                    <View style={styles.stepperValueContainer}>
                      <Text style={styles.stepperValueText}>{passengerCount}</Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.stepperBtn,
                        passengerCount >= maxSeatsParam && styles.stepperBtnDisabled,
                      ]}
                      onPress={handleIncrementPassengers}
                      disabled={passengerCount >= maxSeatsParam}
                      activeOpacity={0.6}
                    >
                      <Ionicons
                        name="add"
                        size={16}
                        color={passengerCount >= maxSeatsParam ? '#cbd5e1' : '#ea580c'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                {/* Luggage 2x2 Grid with Multi-Select & Steppers */}
                <View style={styles.luggageSection}>
                  <View style={styles.luggageHeaderRow}>
                    <View style={styles.sectionHeaderRowCompact}>
                      <Ionicons name="bag-handle-outline" size={17} color="#103A75" />
                      <Text style={styles.cardSectionTitle}>Luggage Load</Text>
                    </View>
                    <View
                      style={[
                        styles.luggageTotalBadge,
                        totalLuggageBags >= MAX_LUGGAGE_BAGS && styles.luggageTotalBadgeMax,
                      ]}
                    >
                      <Text
                        style={[
                          styles.luggageTotalBadgeText,
                          totalLuggageBags >= MAX_LUGGAGE_BAGS && styles.luggageTotalBadgeTextMax,
                        ]}
                      >
                        {isNoLuggage || totalLuggageBags === 0
                          ? '0 / 10 Bags'
                          : `${totalLuggageBags} / 10 Bags`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.luggageGrid}>
                    {LUGGAGE_OPTIONS.map((item) => {
                      if (item.id === 'NO_LUGGAGE') {
                        const isSelected = isNoLuggage || totalLuggageBags === 0;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.luggageGridItem,
                              isSelected && styles.luggageGridItemSelected,
                            ]}
                            onPress={handleSelectNoLuggage}
                            activeOpacity={0.7}
                          >
                            <View style={styles.luggageItemTopRow}>
                              <View
                                style={[
                                  styles.luggageIconCircle,
                                  isSelected && styles.luggageIconCircleSelected,
                                ]}
                              >
                                <Ionicons
                                  name={item.icon}
                                  size={16}
                                  color={isSelected ? '#ea580c' : '#64748b'}
                                />
                              </View>
                              <View style={styles.luggageItemTexts}>
                                <Text
                                  style={[
                                    styles.luggageItemTitle,
                                    isSelected && styles.luggageItemTitleSelected,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {item.shortLabel}
                                </Text>
                                <Text
                                  style={[
                                    styles.luggageItemDesc,
                                    isSelected && styles.luggageItemDescSelected,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {item.description}
                                </Text>
                              </View>
                              {isSelected ? (
                                <View style={styles.checkedBadge}>
                                  <Ionicons name="checkmark-circle" size={15} color="#ea580c" />
                                </View>
                              ) : null}
                            </View>

                            <View style={styles.noLuggageActionRow}>
                              <Text
                                style={[
                                  styles.noLuggageActionText,
                                  isSelected && styles.noLuggageActionTextActive,
                                ]}
                              >
                                {isSelected ? '✓ 0 Bags (Selected)' : 'Tap for 0 Bags'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      }

                      const countKey: 'normal' | 'handBags' | 'heavy' =
                        item.id === 'NORMAL'
                          ? 'normal'
                          : item.id === 'HAND_BAGS'
                          ? 'handBags'
                          : 'heavy';
                      const count = luggageCounts[countKey];
                      const isSelected = count > 0 && !isNoLuggage;

                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.luggageGridItem,
                            isSelected && styles.luggageGridItemSelected,
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.luggageItemTopRow}
                            onPress={() => {
                              if (count === 0) {
                                handleIncrementLuggage(countKey);
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <View
                              style={[
                                styles.luggageIconCircle,
                                isSelected && styles.luggageIconCircleSelected,
                              ]}
                            >
                              <Ionicons
                                name={item.icon}
                                size={16}
                                color={isSelected ? '#ea580c' : '#64748b'}
                              />
                            </View>
                            <View style={styles.luggageItemTexts}>
                              <Text
                                style={[
                                  styles.luggageItemTitle,
                                  isSelected && styles.luggageItemTitleSelected,
                                ]}
                                numberOfLines={1}
                              >
                                {item.shortLabel}
                              </Text>
                              <Text
                                style={[
                                  styles.luggageItemDesc,
                                  isSelected && styles.luggageItemDescSelected,
                                ]}
                                numberOfLines={1}
                              >
                                {item.description}
                              </Text>
                            </View>
                            {isSelected ? (
                              <View style={styles.checkedBadge}>
                                <Ionicons name="checkmark-circle" size={15} color="#ea580c" />
                              </View>
                            ) : null}
                          </TouchableOpacity>

                          {/* Stepper controls */}
                          <View style={styles.luggageStepperRow}>
                            {isSelected ? (
                              <View style={styles.stepperMiniGroup}>
                                <TouchableOpacity
                                  style={styles.stepperMiniBtn}
                                  onPress={() => handleDecrementLuggage(countKey)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  activeOpacity={0.6}
                                >
                                  <Ionicons name="remove" size={14} color="#ea580c" />
                                </TouchableOpacity>

                                <View style={styles.stepperMiniCountBox}>
                                  <Text style={styles.stepperMiniCountText}>{count}</Text>
                                  <Text style={styles.stepperMiniCountUnit}>
                                    {count === 1 ? 'bag' : 'bags'}
                                  </Text>
                                </View>

                                <TouchableOpacity
                                  style={[
                                    styles.stepperMiniBtn,
                                    totalLuggageBags >= MAX_LUGGAGE_BAGS &&
                                      styles.stepperMiniBtnDisabled,
                                  ]}
                                  onPress={() => handleIncrementLuggage(countKey)}
                                  disabled={totalLuggageBags >= MAX_LUGGAGE_BAGS}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  activeOpacity={0.6}
                                >
                                  <Ionicons
                                    name="add"
                                    size={14}
                                    color={
                                      totalLuggageBags >= MAX_LUGGAGE_BAGS
                                        ? '#cbd5e1'
                                        : '#ea580c'
                                    }
                                  />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={[
                                  styles.addLuggageMiniBtn,
                                  totalLuggageBags >= MAX_LUGGAGE_BAGS &&
                                    styles.stepperMiniBtnDisabled,
                                ]}
                                onPress={() => handleIncrementLuggage(countKey)}
                                disabled={totalLuggageBags >= MAX_LUGGAGE_BAGS}
                                activeOpacity={0.7}
                              >
                                <Ionicons
                                  name="add"
                                  size={13}
                                  color={
                                    totalLuggageBags >= MAX_LUGGAGE_BAGS
                                      ? '#94a3b8'
                                      : '#ea580c'
                                  }
                                />
                                <Text
                                  style={[
                                    styles.addLuggageMiniBtnText,
                                    totalLuggageBags >= MAX_LUGGAGE_BAGS && {
                                      color: '#94a3b8',
                                    },
                                  ]}
                                >
                                  Add Qty
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Roof Carrier Option */}
                {hasCarrierParam ? (
                  <>
                    <View style={styles.cardDivider} />
                    <TouchableOpacity
                      style={[styles.carrierCard, requestCarrier && styles.carrierCardActive]}
                      onPress={() => setRequestCarrier((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.carrierIconBox,
                          requestCarrier && styles.carrierIconBoxActive,
                        ]}
                      >
                        <Ionicons
                          name="layers-outline"
                          size={18}
                          color={requestCarrier ? '#ea580c' : '#64748b'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.carrierTitle,
                              requestCarrier && styles.carrierTitleActive,
                            ]}
                          >
                            Roof Luggage Carrier
                          </Text>
                          {requestCarrier ? (
                            <View style={styles.carrierAddedBadge}>
                              <Text style={styles.carrierAddedBadgeText}>Added ✓</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.carrierDesc}>
                          {carrierTextParam || 'Up to 45 kg rooftop luggage space'}
                        </Text>
                      </View>

                      <View pointerEvents="none">
                        <Switch
                          value={requestCarrier}
                          trackColor={{ false: '#cbd5e1', true: '#ea580c' }}
                          thumbColor="#ffffff"
                          ios_backgroundColor="#cbd5e1"
                        />
                      </View>
                    </TouchableOpacity>
                  </>
                ) : null}

                {carrierExcludedCarsParam ? (
                  <View style={styles.carrierNoteBox}>
                    <Ionicons name="information-circle-outline" size={14} color="#b45309" />
                    <Text style={styles.carrierNoteText}>{carrierExcludedCarsParam}</Text>
                  </View>
                ) : null}
              </View>

              {/* Ride Preferences & Special Notes Card */}
              <View style={styles.cardSection}>
                <View style={styles.preferencesHeader}>
                  <Ionicons name="options-outline" size={17} color="#103A75" />
                  <Text style={styles.cardSectionTitle}>Ride Preferences</Text>
                  <Text style={styles.optionalHint}>(Optional)</Text>
                </View>

                {/* Quick Suggestion Pills */}
                <View style={styles.quickTagsContainer}>
                  {QUICK_TAGS.map((tagItem) => {
                    const isSelected = pickupNotes.includes(tagItem.label);
                    return (
                      <TouchableOpacity
                        key={tagItem.id}
                        style={[
                          styles.quickTagPill,
                          isSelected && styles.quickTagPillSelected,
                        ]}
                        onPress={() => toggleQuickTag(tagItem.label)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isSelected && tagItem.id === 'baby' ? 'heart' : tagItem.icon}
                          size={13}
                          color={isSelected ? '#ea580c' : '#64748b'}
                        />
                        <Text
                          style={[
                            styles.quickTagText,
                            isSelected && styles.quickTagTextSelected,
                          ]}
                        >
                          {tagItem.label}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={11} color="#ea580c" style={{ marginLeft: 2 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Refined Text Input with Left Icon */}
                <View style={styles.notesInputContainer}>
                  <Ionicons name="create-outline" size={15} color="#94a3b8" style={styles.notesInputIcon} />
                  <TextInput
                    style={styles.notesInputField}
                    placeholder="Any special notes (e.g. child seat, extra stops, elderly assistance)..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={2}
                    value={pickupNotes}
                    onChangeText={setPickupNotes}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Blue Info Notice Banner */}
              <View style={styles.infoNoticeBanner}>
                <Ionicons name="information-circle" size={19} color="#2563eb" style={styles.infoNoticeIcon} />
                <Text style={styles.infoNoticeText}>
                  Please ensure all passenger details are correct. These details will be used for communication regarding your booking.
                </Text>
              </View>

              {/* Bottom CTA: Continue to Review & Pay */}
              <TouchableOpacity
                style={styles.continueToReviewBtn}
                activeOpacity={0.85}
                onPress={handleProceedToStep2}
              >
                <Text style={styles.continueToReviewText}>Continue to Review & Pay</Text>
                <Ionicons name="chevron-forward" size={16} color="#ffffff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}

          {/* ========================================================= */}
          {/* STEP 2: REVIEW ROUTE & PAYMENT SELECTION                   */}
          {/* ========================================================= */}
          {step === 2 && (
            <View style={styles.stepSection}>
              {/* 1. Top Vehicle & Route Summary Card (Matching Reference Mock) */}
              <View style={styles.topSummaryCard}>
                {/* Upper Row: Vehicle Image, Details, Specs, Price */}
                <View style={styles.topSummaryUpperRow}>
                  {/* Left: Car Image */}
                  <Image
                    source={vehicleInfo.image}
                    style={styles.topSummaryVehicleImage}
                    resizeMode="contain"
                  />

                  {/* Middle: Vehicle Specs & Change Vehicle */}
                  <View style={styles.topSummaryVehicleDetails}>
                    <Text style={styles.topSummaryVehicleName}>{customVehicleName}</Text>

                    {/* Specs Icons */}
                    <View style={styles.topSummarySpecsRow}>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="person" size={11} color="#64748b" />
                        <Text style={styles.topSummarySpecText}>
                          {passengerCountParam || vehicleInfo.passengers} + 1
                        </Text>
                      </View>
                      <Text style={styles.topSummarySpecPipe}>|</Text>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="briefcase" size={11} color="#64748b" />
                        <Text style={styles.topSummarySpecText}>{vehicleInfo.luggage}</Text>
                      </View>
                      <Text style={styles.topSummarySpecPipe}>|</Text>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="snow" size={11} color="#64748b" />
                        <Text style={styles.topSummarySpecText}>A/C</Text>
                      </View>
                    </View>

                    {/* Change Vehicle Link */}
                    <TouchableOpacity
                      style={styles.topSummaryChangeVehicleBtn}
                      activeOpacity={0.7}
                      onPress={() => router.back()}
                    >
                      <Text style={styles.topSummaryChangeVehicleText}>Change Vehicle</Text>
                      <Ionicons name="chevron-forward" size={12} color="#2563eb" style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                  </View>

                  {/* Vertical Divider */}
                  <View style={styles.topSummaryVerticalLine} />

                  {/* Right: Fare Column */}
                  <View style={styles.topSummaryPriceCol}>
                    <Text style={styles.topSummaryPrice}>₹ {totalFare.toLocaleString('en-IN')}</Text>
                    <Text style={styles.topSummaryGst}>(Total Trip Fare)</Text>
                    <View style={styles.topSummaryAdvancePill}>
                      <Text style={styles.topSummaryAdvanceText}>Pay 25%: ₹{advanceAmount.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                </View>

                {/* Horizontal Divider */}
                <View style={styles.topSummaryHorizontalLine} />

                {/* Lower Row: Route & Scheduled Time Horizontal Strip */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.topSummaryRouteScrollContent}
                >
                  {/* Pickup & Drop Section */}
                  <View style={styles.topSummaryLocationsGroup}>
                    {/* Pickup */}
                    <View style={styles.topSummaryLocationItem}>
                      <Ionicons name="location" size={14} color="#ea580c" style={{ marginRight: 3 }} />
                      <View>
                        <Text style={styles.topSummaryLocationName} numberOfLines={1}>
                          {pickupCity}
                        </Text>
                        <Text style={styles.topSummaryLocationSub}>Pickup Location</Text>
                      </View>
                    </View>

                    {/* Dashed Separator */}
                    <View style={styles.topSummaryArrowContainer}>
                      <Text style={styles.topSummaryArrowLine}>┄┄</Text>
                      <Ionicons name="arrow-forward" size={11} color="#94a3b8" />
                    </View>

                    {/* Drop */}
                    <View style={styles.topSummaryLocationItem}>
                      <Ionicons name="location" size={14} color="#103A75" style={{ marginRight: 3 }} />
                      <View>
                        <Text style={styles.topSummaryLocationName} numberOfLines={1}>
                          {dropCity}
                        </Text>
                        <Text style={styles.topSummaryLocationSub}>Drop Location</Text>
                      </View>
                    </View>
                  </View>

                  {/* Vertical Divider */}
                  <View style={styles.topSummaryRouteDivider} />

                  {/* Pickup Date */}
                  <View style={styles.topSummaryDateTimeItem}>
                    <Ionicons name="calendar-outline" size={13} color="#103A75" style={{ marginRight: 3 }} />
                    <View>
                      <Text style={styles.topSummaryDateTimeText} numberOfLines={1}>
                        {displayPickupDate}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Pickup Date</Text>
                    </View>
                  </View>

                  {/* Vertical Divider */}
                  <View style={styles.topSummaryRouteDivider} />

                  {/* Pickup Time */}
                  <View style={styles.topSummaryDateTimeItem}>
                    <Ionicons name="time-outline" size={13} color="#ea580c" style={{ marginRight: 3 }} />
                    <View>
                      <Text style={styles.topSummaryDateTimeText} numberOfLines={1}>
                        {displayPickupTime}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Pickup Time</Text>
                    </View>
                  </View>

                  {/* Flight Number for Airport Transfer */}
                  {tripTypeParam === 'AIRPORT' && flightNumber.trim().length > 0 && (
                    <>
                      <View style={styles.topSummaryRouteDivider} />
                      <View style={styles.topSummaryDateTimeItem}>
                        <Ionicons name="airplane" size={13} color="#0284c7" style={{ marginRight: 3 }} />
                        <View>
                          <Text style={styles.topSummaryDateTimeText} numberOfLines={1}>
                            {flightNumber.trim()}
                          </Text>
                          <Text style={styles.topSummaryLocationSub}>Flight No</Text>
                        </View>
                      </View>
                    </>
                  )}
                </ScrollView>
              </View>

              {/* 2. Passenger Details Card (With Edit Button) */}
              <View style={styles.passengerSummaryCard}>
                <View style={styles.passengerSummaryHeader}>
                  <View style={styles.passengerHeaderLeft}>
                    <View style={styles.passengerIconCircle}>
                      <Ionicons name="person" size={13} color="#ea580c" />
                    </View>
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.passengerSummaryTitle}>Passenger Details</Text>
                      <Text style={styles.passengerSummarySub}>Primary Contact</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.editPassengerBtn}
                    activeOpacity={0.7}
                    onPress={() => setStep(1)}
                  >
                    <Ionicons name="pencil" size={11} color="#ea580c" />
                    <Text style={styles.editPassengerBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                {/* 2x2 Grid */}
                <View style={styles.passengerGridContainer}>
                  <View style={styles.passengerGridRow}>
                    <View style={styles.passengerGridBox}>
                      <Text style={styles.passengerBoxLabel}>PASSENGER NAME</Text>
                      <Text style={styles.passengerBoxVal} numberOfLines={1}>
                        {passengerName.trim() || 'Not Provided'}
                      </Text>
                    </View>
                    <View style={styles.passengerGridBox}>
                      <Text style={styles.passengerBoxLabel}>PHONE NUMBER</Text>
                      <Text style={styles.passengerBoxVal} numberOfLines={1}>
                        {passengerPhone.trim() || 'Not Provided'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.passengerGridRow, { marginTop: 6 }]}>
                    <View style={styles.passengerGridBox}>
                      <Text style={styles.passengerBoxLabel}>EMAIL ADDRESS</Text>
                      <Text style={styles.passengerBoxVal} numberOfLines={1}>
                        {passengerEmail.trim() || 'Not Provided'}
                      </Text>
                    </View>
                    <View style={styles.passengerGridBox}>
                      <Text style={styles.passengerBoxLabel}>ALTERNATE PHONE</Text>
                      <Text
                        style={[
                          styles.passengerBoxVal,
                          !alternatePhone.trim() && { color: '#94a3b8', fontWeight: '500' },
                        ]}
                        numberOfLines={1}
                      >
                        {alternatePhone.trim()
                          ? `+91 ${alternatePhone.replace(/\D/g, '').slice(-10)}`
                          : 'Not Provided'}
                      </Text>
                    </View>
                  </View>
                </View>

                {isPetFriendly && (
                  <View style={styles.petBadgeRow}>
                    <Ionicons name="paw" size={12} color="#ea580c" />
                    <Text style={styles.petBadgeText}>
                      Ride Preference: Pet Friendly (+₹{petFee} applied)
                    </Text>
                  </View>
                )}

                {tripTypeParam === 'AIRPORT' && flightNumber.trim().length > 0 && (
                  <View style={styles.flightBadgeRow}>
                    <Ionicons name="airplane" size={13} color="#0284c7" />
                    <Text style={styles.flightBadgeText}>
                      Airport Flight: <Text style={{ fontWeight: '800', color: '#0369a1' }}>{flightNumber.trim()}</Text>
                    </Text>
                  </View>
                )}

                {alternateEmail.trim().length > 0 && (
                  <View style={styles.altEmailBadgeRow}>
                    <Ionicons name="mail-outline" size={13} color="#2563eb" />
                    <Text style={styles.altEmailBadgeText}>
                      Alternate Email: <Text style={{ fontWeight: '800', color: '#1d4ed8' }}>{alternateEmail.trim()}</Text>
                    </Text>
                  </View>
                )}

                {gstin.trim().length > 0 && (
                  <View style={styles.gstBadgeRow}>
                    <Ionicons name="business" size={13} color="#4338ca" />
                    <Text style={styles.gstBadgeText}>
                      GSTIN: <Text style={{ fontWeight: '800', color: '#312e81' }}>{gstin.trim().toUpperCase()}</Text>
                      {companyName.trim() ? ` • ${companyName.trim()}` : ''}
                    </Text>
                  </View>
                )}
              </View>

              {/* 3. Middle Two-Column Grid: Fare Breakdown (Left) & Includes/Excludes (Right) */}
              <View style={styles.twoColContainer}>
                {/* Left Column: Fare Breakdown Card */}
                <View style={styles.fareBreakdownCol}>
                  <View style={styles.colHeaderRow}>
                    <Ionicons name="receipt-outline" size={13} color="#ea580c" style={{ marginRight: 4 }} />
                    <Text style={styles.colHeaderTitle}>Fare Breakdown</Text>
                  </View>

                  <View style={styles.fareLineItem}>
                    <Text style={styles.fareLineLabel}>
                      Distance Fare ({Math.max(vehicleInfo.minKm, estimatedKm)} km)
                    </Text>
                    <Text style={styles.fareLineVal}>₹ {baseEstimatedFare.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.fareLineItem}>
                    <Text style={styles.fareLineLabel}>Chauffeur Allowance</Text>
                    <Text style={[styles.fareLineVal, { color: '#16a34a' }]}>Included</Text>
                  </View>

                  <View style={styles.fareLineItem}>
                    <Text style={styles.fareLineLabel}>Toll & State Tax</Text>
                    <Text style={[styles.fareLineVal, { color: '#16a34a' }]}>Included</Text>
                  </View>

                  {isPetFriendly && (
                    <View style={styles.fareLineItem}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1, marginRight: 4 }}>
                        <Ionicons name="paw" size={11} color="#ea580c" />
                        <Text style={[styles.fareLineLabel, { color: '#ea580c', fontWeight: '700' }]}>
                          Pet Friendly Fee
                        </Text>
                      </View>
                      <Text style={[styles.fareLineVal, { color: '#ea580c', fontWeight: '800', flexShrink: 0 }]}>
                        +₹{petFee.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  )}

                  {couponDiscount > 0 && (
                    <View style={styles.fareLineItem}>
                      <Text style={[styles.fareLineLabel, { color: '#16a34a', fontWeight: '700' }]}>
                        Coupon ({couponCode})
                      </Text>
                      <Text style={[styles.fareLineVal, { color: '#16a34a', fontWeight: '800' }]}>
                        -₹ {couponDiscount.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  )}

                  <View style={styles.twoColDivider} />

                  <View style={styles.fareLineItem}>
                    <Text style={styles.fareLineLabelBold}>Subtotal</Text>
                    <Text style={styles.fareLineValBold}>₹ {subtotal.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.fareLineItem}>
                    <Text style={styles.fareLineLabel}>GST (5%)</Text>
                    <Text style={styles.fareLineVal}>₹ {gstAmount.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.twoColDivider} />

                  <View style={styles.fareLineItem}>
                    <Text style={styles.fareLineLabelBold}>Total Ride Fare</Text>
                    <Text style={styles.fareLineValBold}>₹ {totalFare.toLocaleString('en-IN')}</Text>
                  </View>

                  {/* 25% Part Payment Payable Now Box */}
                  <View style={styles.partPaymentPill}>
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <Text style={styles.partPaymentPillTitle}>Payable Now (25%):</Text>
                      <Text style={styles.partPaymentPillSub}>Rest ₹{balanceAmount.toLocaleString('en-IN')} to driver later</Text>
                    </View>
                    <Text style={styles.partPaymentPillAmount}>₹ {advanceAmount.toLocaleString('en-IN')}</Text>
                  </View>

                  {/* Optional Promo Code Toggle */}
                  <TouchableOpacity
                    style={{ marginTop: 6, alignSelf: 'flex-start' }}
                    activeOpacity={0.7}
                    onPress={() => setShowCouponInput((prev) => !prev)}
                  >
                    <Text style={{ fontSize: 9.5, color: '#2563eb', fontWeight: '700' }}>
                      {couponApplied
                        ? `Promo Applied: ${couponCode} (Edit)`
                        : showCouponInput
                        ? 'Hide Promo Code'
                        : '+ Apply Promo / Coupon Code'}
                    </Text>
                  </TouchableOpacity>

                  {showCouponInput && (
                    <View style={{ marginTop: 5 }}>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TextInput
                          style={{
                            flex: 1,
                            borderWidth: 1,
                            borderColor: '#cbd5e1',
                            borderRadius: 6,
                            paddingHorizontal: 6,
                            paddingVertical: 3,
                            fontSize: 10,
                            fontWeight: '700',
                            backgroundColor: '#ffffff',
                            color: '#103A75',
                          }}
                          placeholder="Try KANDY10"
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="characters"
                          value={couponCode}
                          onChangeText={setCouponCode}
                        />
                        <TouchableOpacity
                          style={{
                            backgroundColor: '#EE5C21',
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            justifyContent: 'center',
                          }}
                          onPress={handleApplyCoupon}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }}>Apply</Text>
                        </TouchableOpacity>
                      </View>
                      {couponMsg && (
                        <Text style={{ fontSize: 8.5, color: couponApplied ? '#16a34a' : '#dc2626', marginTop: 2 }}>
                          {couponMsg}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Right Column: Includes & Excludes Card */}
                <View style={styles.includesExcludesCol}>
                  {/* Includes Section */}
                  <View style={styles.incExcSection}>
                    <View style={styles.incHeaderRow}>
                      <Ionicons name="checkmark-circle" size={12} color="#16a34a" style={{ marginRight: 4 }} />
                      <Text style={styles.incHeaderTitle}>Includes</Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="checkmark" size={10} color="#16a34a" style={{ marginRight: 4 }} />
                      <Text style={styles.bulletText} numberOfLines={1}>Fuel Charges</Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="checkmark" size={10} color="#16a34a" style={{ marginRight: 4 }} />
                      <Text style={styles.bulletText} numberOfLines={1}>Chauffeur Allowance</Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="checkmark" size={10} color="#16a34a" style={{ marginRight: 4 }} />
                      <Text style={styles.bulletText} numberOfLines={1}>
                        {Math.max(vehicleInfo.minKm, estimatedKm)} Kms Limit
                      </Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="checkmark" size={10} color="#16a34a" style={{ marginRight: 4 }} />
                      <Text style={styles.bulletText} numberOfLines={1}>5% GST Included</Text>
                    </View>
                    {isPetFriendly && (
                      <View style={styles.bulletItem}>
                        <Ionicons name="paw" size={10} color="#16a34a" style={{ marginRight: 4 }} />
                        <Text style={[styles.bulletText, { color: '#16a34a', fontWeight: '700' }]} numberOfLines={1}>
                          Pet Friendly Ride
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.twoColDivider} />

                  {/* Excludes Section */}
                  <View style={styles.incExcSection}>
                    <View style={styles.excHeaderRow}>
                      <Ionicons name="alert-circle" size={12} color="#dc2626" style={{ marginRight: 4 }} />
                      <Text style={styles.excHeaderTitle}>Excludes</Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="close" size={10} color="#dc2626" style={{ marginRight: 4 }} />
                      <Text style={styles.bulletText} numberOfLines={1}>Extra Kms @ ₹{customRatePerKm}/km</Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="close" size={10} color="#dc2626" style={{ marginRight: 4 }} />
                      <Text style={styles.bulletText} numberOfLines={1}>Toll & Parking</Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="close" size={10} color="#dc2626" style={{ marginRight: 4 }} />
                      <Text style={styles.bulletText} numberOfLines={1}>Night Allowance</Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="close" size={10} color="#dc2626" style={{ marginRight: 4 }} />
                      <Text style={styles.bulletText} numberOfLines={1}>Multi-City Entries</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 4. Select Payment Option Card */}
              <View style={styles.paymentMethodCard}>
                <View style={[styles.colHeaderRow, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="card-outline" size={13} color="#ea580c" style={{ marginRight: 4 }} />
                    <Text style={styles.colHeaderTitle}>Select Payment Option</Text>
                  </View>
                  <View style={styles.advancePaymentBadge}>
                    <Text style={styles.advancePaymentBadgeText}>25% Part Payment: ₹{advanceAmount.toLocaleString('en-IN')}</Text>
                  </View>
                </View>

                {/* 4-Item Grid */}
                <View style={styles.paymentGridRow}>
                  {/* UPI */}
                  <TouchableOpacity
                    style={[
                      styles.paymentGridItem,
                      selectedPaymentMethod === 'UPI' && styles.paymentGridItemActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedPaymentMethod('UPI')}
                  >
                    {selectedPaymentMethod === 'UPI' && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark" size={8} color="#ffffff" />
                      </View>
                    )}
                    <Ionicons
                      name="phone-portrait-outline"
                      size={18}
                      color={selectedPaymentMethod === 'UPI' ? '#ea580c' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.paymentItemTitle,
                        selectedPaymentMethod === 'UPI' && styles.paymentItemTitleActive,
                      ]}
                      numberOfLines={1}
                    >
                      UPI
                    </Text>
                    <Text
                      style={[
                        styles.paymentItemSub,
                        selectedPaymentMethod === 'UPI' && styles.paymentItemSubActive,
                      ]}
                      numberOfLines={1}
                    >
                      GPay/PhonePe
                    </Text>
                  </TouchableOpacity>

                  {/* Card Payment */}
                  <TouchableOpacity
                    style={[
                      styles.paymentGridItem,
                      selectedPaymentMethod === 'CARD' && styles.paymentGridItemActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedPaymentMethod('CARD')}
                  >
                    {selectedPaymentMethod === 'CARD' && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark" size={8} color="#ffffff" />
                      </View>
                    )}
                    <Ionicons
                      name="card-outline"
                      size={18}
                      color={selectedPaymentMethod === 'CARD' ? '#ea580c' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.paymentItemTitle,
                        selectedPaymentMethod === 'CARD' && styles.paymentItemTitleActive,
                      ]}
                      numberOfLines={1}
                    >
                      Card
                    </Text>
                    <Text
                      style={[
                        styles.paymentItemSub,
                        selectedPaymentMethod === 'CARD' && styles.paymentItemSubActive,
                      ]}
                      numberOfLines={1}
                    >
                      Debit/Credit
                    </Text>
                  </TouchableOpacity>

                  {/* Net Banking */}
                  <TouchableOpacity
                    style={[
                      styles.paymentGridItem,
                      selectedPaymentMethod === 'NETBANKING' && styles.paymentGridItemActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedPaymentMethod('NETBANKING')}
                  >
                    {selectedPaymentMethod === 'NETBANKING' && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark" size={8} color="#ffffff" />
                      </View>
                    )}
                    <Ionicons
                      name="business-outline"
                      size={18}
                      color={selectedPaymentMethod === 'NETBANKING' ? '#ea580c' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.paymentItemTitle,
                        selectedPaymentMethod === 'NETBANKING' && styles.paymentItemTitleActive,
                      ]}
                      numberOfLines={1}
                    >
                      Net Banking
                    </Text>
                    <Text
                      style={[
                        styles.paymentItemSub,
                        selectedPaymentMethod === 'NETBANKING' && styles.paymentItemSubActive,
                      ]}
                      numberOfLines={1}
                    >
                      All Banks
                    </Text>
                  </TouchableOpacity>

                  {/* Other UPI */}
                  <TouchableOpacity
                    style={[
                      styles.paymentGridItem,
                      selectedPaymentMethod === 'OTHER_UPI' && styles.paymentGridItemActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedPaymentMethod('OTHER_UPI')}
                  >
                    {selectedPaymentMethod === 'OTHER_UPI' && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark" size={8} color="#ffffff" />
                      </View>
                    )}
                    <Ionicons
                      name="qr-code-outline"
                      size={18}
                      color={selectedPaymentMethod === 'OTHER_UPI' ? '#ea580c' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.paymentItemTitle,
                        selectedPaymentMethod === 'OTHER_UPI' && styles.paymentItemTitleActive,
                      ]}
                      numberOfLines={1}
                    >
                      Other UPI
                    </Text>
                    <Text
                      style={[
                        styles.paymentItemSub,
                        selectedPaymentMethod === 'OTHER_UPI' && styles.paymentItemSubActive,
                      ]}
                      numberOfLines={1}
                    >
                      Scan & Pay
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Blue Security Banner */}
                <View style={styles.securityBanner}>
                  <Ionicons name="shield-checkmark" size={14} color="#2563eb" style={{ marginRight: 6 }} />
                  <Text style={styles.securityBannerText}>
                    Safe & Secure 256-bit SSL encrypted payment. Pay ₹{advanceAmount.toLocaleString('en-IN')} (25%) advance now to confirm cab; balance ₹{balanceAmount.toLocaleString('en-IN')} payable to driver.
                  </Text>
                </View>

                {/* Terms & Conditions Checkbox */}
                <TouchableOpacity
                  style={styles.termsRow}
                  activeOpacity={0.7}
                  onPress={() => setAgreedToTerms((prev) => !prev)}
                >
                  <View
                    style={[
                      styles.checkboxSquare,
                      agreedToTerms && styles.checkboxSquareActive,
                    ]}
                  >
                    {agreedToTerms && <Ionicons name="checkmark" size={11} color="#ffffff" />}
                  </View>
                  <Text style={styles.termsText}>
                    I agree to the <Text style={{ color: '#ea580c', fontWeight: '700' }}>Terms & Conditions</Text> and{' '}
                    <Text style={{ color: '#ea580c', fontWeight: '700' }}>Cancellation Policy</Text>.
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 5. Bottom Action Bar */}
              <View style={styles.bottomActionBar}>
                <TouchableOpacity
                  style={styles.reviewBackBtn}
                  activeOpacity={0.7}
                  onPress={() => setStep(1)}
                  disabled={submitting}
                >
                  <Text style={styles.reviewBackBtnText}>← Back</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.reviewConfirmPayBtn, submitting && { opacity: 0.7 }]}
                  activeOpacity={0.8}
                  onPress={handleConfirmBooking}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <View style={styles.reviewConfirmPayInner}>
                      <View>
                        <Text style={styles.reviewConfirmPayText}>Confirm & Pay 25% Advance</Text>
                        <Text style={styles.reviewConfirmPaySubtext}>
                          Pay ₹{advanceAmount.toLocaleString('en-IN')} now • Rest ₹{balanceAmount.toLocaleString('en-IN')} later
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.reviewConfirmPayPrice}>
                          ₹ {advanceAmount.toLocaleString('en-IN')}
                        </Text>
                        <Ionicons name="arrow-forward" size={14} color="#ffffff" />
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================= */}
          {/* STEP 3: BOOKING CONFIRMED SUCCESS SCREEN                  */}
          {/* ========================================================= */}
          {step === 3 && confirmedBooking && (
            <View style={[styles.stepSection, { flex: 1 }]}>
              <View style={[styles.successCard, { flex: 1, justifyContent: 'space-between' }]}>
                {/* 1. Upper Content Block */}
                <View style={{ width: '100%', alignItems: 'center' }}>
                  {/* Celebration Icon with Confetti Burst Accents */}
                  <View style={styles.celebrationWrapper}>
                    <View style={[styles.confettiDash, styles.confettiDashTopLeft1]} />
                    <View style={[styles.confettiDash, styles.confettiDashTopLeft2]} />
                    <View style={[styles.confettiDash, styles.confettiDashBottomLeft]} />
                    <View style={[styles.confettiDash, styles.confettiDashTopRight1]} />
                    <View style={[styles.confettiDash, styles.confettiDashTopRight2]} />
                    <View style={[styles.confettiDash, styles.confettiDashBottomRight]} />

                    <View style={styles.successIconCircle}>
                      <Ionicons name="checkmark" size={24} color="#ffffff" />
                    </View>
                  </View>

                  {/* Booking Reference Pill */}
                  <View style={styles.refContainer}>
                    <Text style={styles.refPillLabel}>Booking Reference</Text>
                    <View style={styles.refPill}>
                      <Text style={styles.refPillValue}>{confirmedBooking.humanReadableRef}</Text>
                    </View>
                  </View>

                  {/* 4-Digit Pickup OTP Card (Matching Reference Layout) */}
                  {confirmedBooking.pickupOtp && (
                    <View style={styles.pickupOtpBox}>
                      <View style={styles.otpHeaderRow}>
                        <View style={styles.otpKeyBadge}>
                          <Ionicons name="key" size={13} color="#ea580c" />
                        </View>
                        <Text style={styles.otpHeaderTitle}>Your 4-Digit Pickup OTP</Text>
                      </View>

                      <View style={styles.otpBoxesRow}>
                        {String(confirmedBooking.pickupOtp)
                          .replace(/\D/g, '')
                          .padEnd(4, '0')
                          .slice(0, 4)
                          .split('')
                          .map((digit, idx) => (
                            <View key={idx} style={styles.otpDigitCard}>
                              <Text style={styles.otpDigitValue}>{digit}</Text>
                            </View>
                          ))}
                      </View>

                      <Text style={styles.otpInstructions}>
                        Please share this code with your driver partner only when they arrive at pickup.
                      </Text>
                    </View>
                  )}

                  {/* Trip Details Summary */}
                  <View style={styles.confirmedDetailsBox}>
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>Vehicle:</Text>
                      <Text style={styles.confirmedValue}>{vehicleInfo.name}</Text>
                    </View>
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>Route:</Text>
                      <Text style={styles.confirmedValue} numberOfLines={1}>
                        {pickup} ➔ {drop}
                      </Text>
                    </View>
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>Scheduled Date:</Text>
                      <Text style={styles.confirmedValue}>{pickupDate} at {pickupTime}</Text>
                    </View>
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>Passenger:</Text>
                      <Text style={styles.confirmedValue} numberOfLines={1}>
                        {passengerName ? `${passengerName} (${passengerPhone.replace(/^\+91\s*/, '').replace(/^\+91/, '').trim() ? `+91 ${passengerPhone.replace(/^\+91\s*/, '').replace(/^\+91/, '').trim()}` : ''})` : passengerPhone}
                      </Text>
                    </View>
                    <View style={styles.confirmedDivider} />
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>Advance Status:</Text>
                      <Text style={[styles.confirmedValue, { color: '#16a34a', fontWeight: '800' }]}>
                        {confirmedBooking.advanceAmount > 0
                          ? `₹${confirmedBooking.advanceAmount} (PAID)`
                          : 'Pay at Drop'}
                      </Text>
                    </View>
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>Balance Due on Trip:</Text>
                      <Text style={[styles.confirmedValue, { fontWeight: '800', color: '#103A75' }]}>
                        ₹{confirmedBooking.balanceAmount}
                      </Text>
                    </View>
                  </View>

                  {/* Dispatch Status Notice */}
                  <View style={styles.dispatchNoticeBox}>
                    <View style={styles.dispatchIconCircle}>
                      <Ionicons name="navigate" size={13} color="#ea580c" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dispatchNoticeTitle}>Driver Partner Assignment</Text>
                      <Text style={styles.dispatchNoticeDesc}>
                        Our dispatch system has notified nearby verified drivers. Driver details & vehicle plate number will appear in your rides dashboard.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 2. Pinned Bottom Action Group */}
                <View style={{ width: '100%', marginTop: 'auto', paddingTop: 2 }}>
                  <TouchableOpacity
                    style={styles.viewMyRidesBtn}
                    onPress={() => router.replace('/my-bookings')}
                  >
                    <Ionicons name="car-sport" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.viewMyRidesBtnText}>Track Ride in My Bookings</Text>
                    <Ionicons name="arrow-forward" size={15} color="#ffffff" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.backHomeBtn}
                    onPress={() => router.replace('/')}
                  >
                    <Text style={styles.backHomeBtnText}>Back to Home</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {step !== 3 && <View style={{ height: 36 }} />}
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setPassengerName(loggedInUser.fullName || passengerName || 'Customer');
          const cleanP = loggedInUser.phone ? loggedInUser.phone.replace(/\D/g, '').slice(-10) : '';
          setPassengerPhone(cleanP ? `+91 ${cleanP.slice(0, 5)} ${cleanP.slice(5)}` : passengerPhone);
          setPassengerEmail(loggedInUser.email || passengerEmail);
          setSameAsAccount(true);
          setStep(2);
        }}
      />

      {/* Luggage Selection Modal */}
      <Modal
        visible={showLuggageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLuggageModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLuggageModal(false)}
        >
          <View style={styles.luggageModalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="briefcase" size={20} color="#ea580c" />
              <Text style={styles.modalTitle}>Luggage Details</Text>
            </View>
            <Text style={styles.modalSub}>Select estimated luggage for your trip</Text>

            {['No Luggage', 'Normal Luggage', 'Hand Bags Only', 'Heavy Luggage'].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.luggageOptionItem,
                  selectedLuggageSummary.includes(opt) && styles.luggageOptionSelected,
                ]}
                onPress={() => {
                  if (opt === 'No Luggage') handleSelectNoLuggage();
                  else if (opt === 'Normal Luggage') handleIncrementLuggage('normal');
                  else if (opt === 'Hand Bags Only') handleIncrementLuggage('handBags');
                  else handleIncrementLuggage('heavy');
                  setShowLuggageModal(false);
                }}
              >
                <Text
                  style={[
                    styles.luggageOptionText,
                    selectedLuggageSummary.includes(opt) && styles.luggageOptionTextSelected,
                  ]}
                >
                  {opt}
                </Text>
                {selectedLuggageSummary.includes(opt) && (
                  <Ionicons name="checkmark-circle" size={18} color="#ea580c" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowLuggageModal(false)}
            >
              <Text style={styles.modalCancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#103A75',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ea580c',
    marginTop: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  stepCircleActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  stepCircleCurrent: {
    backgroundColor: '#ea580c',
    borderColor: '#fed7aa',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 4,
  },
  stepLabelActive: {
    color: '#334155',
  },
  stepLabelCurrent: {
    color: '#ea580c',
    fontWeight: '800',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
    marginBottom: 14,
  },
  stepLineActive: {
    backgroundColor: '#ea580c',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
  stepSection: {
    gap: 10,
  },
  authNoticeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  authNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  authNoticeTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#103A75',
  },
  authNoticeSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    marginBottom: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 6,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    marginBottom: 12,
  },
  countryCodeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#103A75',
  },
  authActionBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  authActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  otpInput: {
    borderWidth: 1.5,
    borderColor: '#ea580c',
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '900',
    color: '#103A75',
    textAlign: 'center',
    letterSpacing: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  devCodeBadge: {
    backgroundColor: '#ffedd5',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 12,
  },
  devCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c2410c',
  },
  changePhoneBtn: {
    alignItems: 'center',
    marginTop: 10,
    padding: 6,
  },
  changePhoneText: {
    fontSize: 12,
    color: '#ea580c',
    fontWeight: '700',
  },
  verifiedUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  userAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#103A75',
  },
  greenBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  greenBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  verifiedPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  switchAccountBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginLeft: 8,
  },
  switchAccountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c',
  },
  topSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  topSummaryUpperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topSummaryVehicleImage: {
    width: 80,
    height: 50,
  },
  topSummaryVehicleDetails: {
    flex: 1,
    paddingHorizontal: 8,
  },
  topSummaryVehicleName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#103A75',
  },
  topSummaryVehicleModels: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  topSummarySpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  topSummarySpecItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  topSummarySpecText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  topSummarySpecPipe: {
    fontSize: 9.5,
    color: '#cbd5e1',
    marginHorizontal: 1,
  },
  topSummaryChangeVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  topSummaryChangeVehicleText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#2563eb',
  },
  topSummaryVerticalLine: {
    width: 1,
    height: 50,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 6,
  },
  topSummaryPriceCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topSummaryPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#103A75',
  },
  topSummaryGst: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 0.5,
  },
  topSummaryLimit: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#334155',
    marginTop: 1.5,
  },
  topSummaryHorizontalLine: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
  },
  topSummaryRouteScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '100%',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  topSummaryLocationsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  topSummaryLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  topSummaryLocationName: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#103A75',
    maxWidth: 68,
  },
  topSummaryLocationSub: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 0.5,
    fontWeight: '500',
  },
  topSummaryArrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  topSummaryArrowLine: {
    fontSize: 8,
    color: '#94a3b8',
    letterSpacing: -1,
  },
  topSummaryRouteDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  topSummaryDateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  topSummaryDateTimeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#103A75',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#103A75',
  },
  sectionHeaderSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1.5,
  },
  leadPassengerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 11,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  leadPassengerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  leadPassengerLeftTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  leadPassengerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#103A75',
  },
  leadPassengerSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    marginLeft: 3,
  },
  sameAccountCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  checkboxBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  sameAccountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridCol: {
    flex: 1,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minHeight: 46,
  },
  inputCardIcon: {
    marginRight: 7,
  },
  inputCardTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  inputCardLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 0,
    lineHeight: 12,
  },
  inputCardField: {
    fontSize: 12,
    fontWeight: '700',
    color: '#103A75',
    padding: 0,
    paddingVertical: 0,
    margin: 0,
    lineHeight: 16,
  },
  twoCardsRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  subCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  subCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subCardIcon: {
    marginRight: 6,
  },
  subCardTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#103A75',
  },
  subCardOptional: {
    fontSize: 11,
    fontWeight: '400',
    color: '#64748b',
  },
  luggageDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 42,
  },
  luggageDropdownText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#103A75',
  },
  specialRequestsInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 42,
    maxHeight: 60,
    fontSize: 11,
    color: '#103A75',
    textAlignVertical: 'top',
  },
  infoNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginTop: 4,
    marginBottom: 10,
  },
  infoNoticeIcon: {
    marginRight: 8,
  },
  infoNoticeText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#1e40af',
    fontWeight: '500',
  },
  continueToReviewBtn: {
    backgroundColor: '#EE5C21',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 6,
    marginBottom: 12,
    shadowColor: '#EE5C21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  continueToReviewText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  luggageModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#103A75',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
  },
  luggageOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  luggageOptionSelected: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  luggageOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  luggageOptionTextSelected: {
    color: '#ea580c',
    fontWeight: '700',
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  // Passenger Details Summary Card
  passengerSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  passengerSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  passengerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passengerIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerSummaryTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#103A75',
  },
  passengerSummarySub: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 0.5,
  },
  editPassengerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  editPassengerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c',
  },
  passengerGridContainer: {
    gap: 6,
  },
  passengerGridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  passengerGridBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  passengerBoxLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.3,
  },
  passengerBoxVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#103A75',
    marginTop: 2,
  },

  // Middle Two-Column Section
  twoColContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  fareBreakdownCol: {
    flex: 1.15,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  includesExcludesCol: {
    flex: 0.85,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  colHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  colHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#103A75',
  },
  fareLineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  fareLineLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  fareLineVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#103A75',
  },
  fareLineLabelBold: {
    fontSize: 11,
    color: '#103A75',
    fontWeight: '800',
  },
  fareLineValBold: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#103A75',
  },
  twoColDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 6,
  },
  totalPayablePill: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalPayableLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9a3412',
  },
  totalPayableAmount: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#ea580c',
  },
  partPaymentPill: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  petBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#fff7ed',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  petBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ea580c',
  },
  flightBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#f0f9ff',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  flightBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0284c7',
  },
  optionalAddonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  addonPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addonPillBtnActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#1d4ed8',
  },
  addonPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#2563eb',
  },
  addonExpandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  addonExpandColFull: {
    flex: 1,
  },
  addonExpandColHalf: {
    flex: 1,
  },
  addonInputBox: {
    height: 44,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#103A75',
  },
  altEmailBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#eff6ff',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  altEmailBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  gstBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#eef2ff',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  gstBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#4338ca',
  },
  partPaymentPillTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c2410c',
  },
  partPaymentPillSub: {
    fontSize: 8,
    fontWeight: '600',
    color: '#9a3412',
    marginTop: 1,
  },
  partPaymentPillAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ea580c',
  },
  advancePaymentBadge: {
    backgroundColor: '#e6f9f0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  advancePaymentBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#166534',
  },

  // Includes & Excludes
  incExcSection: {
    flex: 1,
  },
  incHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  incHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
  },
  excHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  excHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bulletText: {
    fontSize: 9.5,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },

  // Payment Selection Card
  paymentMethodCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginTop: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  paymentGridRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  paymentGridItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  paymentGridItemActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
    borderWidth: 1.5,
  },
  selectedBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentItemTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    marginTop: 4,
  },
  paymentItemTitleActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  paymentItemSub: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 1,
  },
  paymentItemSubActive: {
    color: '#9a3412',
    fontWeight: '600',
  },
  securityBanner: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityBannerText: {
    flex: 1,
    fontSize: 9.5,
    color: '#1e40af',
    fontWeight: '500',
    lineHeight: 13,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  checkboxSquare: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  checkboxSquareActive: {
    borderColor: '#ea580c',
    backgroundColor: '#ea580c',
  },
  termsText: {
    flex: 1,
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
  },

  // Bottom Action Bar
  bottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 24,
  },
  reviewBackBtn: {
    width: 76,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  reviewBackBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  reviewConfirmPayBtn: {
    flex: 1,
    backgroundColor: '#EE5C21',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#EE5C21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewConfirmPayInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  reviewConfirmPayText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  reviewConfirmPaySubtext: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffedd5',
    marginTop: 1,
  },
  reviewConfirmPayPrice: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#ffffff',
  },
  topSummaryAdvancePill: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  topSummaryAdvanceText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ea580c',
  },
  successCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  celebrationWrapper: {
    width: 76,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 5,
    position: 'relative',
  },
  confettiDash: {
    position: 'absolute',
    width: 3,
    height: 8,
    borderRadius: 1.5,
  },
  confettiDashTopLeft1: {
    top: 4,
    left: 14,
    backgroundColor: '#f59e0b',
    transform: [{ rotate: '-35deg' }],
  },
  confettiDashTopLeft2: {
    top: 17,
    left: 3,
    backgroundColor: '#10b981',
    transform: [{ rotate: '-70deg' }],
  },
  confettiDashBottomLeft: {
    bottom: 8,
    left: 12,
    backgroundColor: '#10b981',
    transform: [{ rotate: '45deg' }],
  },
  confettiDashTopRight1: {
    top: 4,
    right: 14,
    backgroundColor: '#ea580c',
    transform: [{ rotate: '35deg' }],
  },
  confettiDashTopRight2: {
    top: 17,
    right: 3,
    backgroundColor: '#10b981',
    transform: [{ rotate: '70deg' }],
  },
  confettiDashBottomRight: {
    bottom: 8,
    right: 12,
    backgroundColor: '#f59e0b',
    transform: [{ rotate: '-45deg' }],
  },
  successIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  refContainer: {
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  refPillLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 3,
    textAlign: 'center',
  },
  refPill: {
    backgroundColor: '#e6f9f0',
    paddingHorizontal: 16,
    paddingVertical: 4.5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refPillValue: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f4c3a',
    letterSpacing: 0.3,
  },
  pickupOtpBox: {
    backgroundColor: '#fffdf5',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#fef08a',
    paddingHorizontal: 12,
    paddingVertical: 9,
    width: '100%',
    marginBottom: 9,
  },
  otpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  otpKeyBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#103A75',
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  otpDigitCard: {
    width: 38,
    height: 42,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#b45309',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.08,
        shadowRadius: 2.5,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  otpDigitValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#b45309',
  },
  otpInstructions: {
    fontSize: 10,
    color: '#92400e',
    textAlign: 'center',
    lineHeight: 13.5,
    paddingHorizontal: 4,
  },
  confirmedDetailsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 9,
  },
  confirmedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4.5,
  },
  confirmedLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
  },
  confirmedValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#103A75',
    flex: 1,
    textAlign: 'right',
  },
  confirmedDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 4.5,
  },
  dispatchNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffaf5',
    borderWidth: 1.2,
    borderColor: '#fed7aa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    width: '100%',
    marginBottom: 10,
    gap: 10,
  },
  dispatchIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchNoticeTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#9a3412',
  },
  dispatchNoticeDesc: {
    fontSize: 9.5,
    color: '#92400e',
    marginTop: 1.5,
    lineHeight: 13,
  },
  viewMyRidesBtn: {
    backgroundColor: '#EE5C21',
    paddingVertical: 11,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#EE5C21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 2.5,
    marginBottom: 5,
  },
  viewMyRidesBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  backHomeBtn: {
    paddingVertical: 5,
    alignItems: 'center',
  },
  backHomeBtnText: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '700',
  },

  // Unified Card Section Styles
  cardSection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#103A75',
  },
  cardSectionSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passengerTextGroup: {
    flex: 1,
  },
  passengerStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
    backgroundColor: '#f8fafc',
  },
  stepperValueContainer: {
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#103A75',
  },
  luggageSection: {},
  sectionHeaderRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  luggageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  luggageGridItem: {
    width: '48.5%',
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 7,
    position: 'relative',
  },
  luggageGridItemSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
  },
  luggageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  luggageTotalBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  luggageTotalBadgeMax: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  luggageTotalBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  luggageTotalBadgeTextMax: {
    color: '#ea580c',
  },
  luggageItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  luggageStepperRow: {
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    width: '100%',
    alignItems: 'center',
  },
  stepperMiniGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 3,
    paddingVertical: 2,
    width: '100%',
  },
  stepperMiniBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperMiniBtnDisabled: {
    backgroundColor: '#f1f5f9',
    opacity: 0.6,
  },
  stepperMiniCountBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  stepperMiniCountText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#103A75',
  },
  stepperMiniCountUnit: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
  },
  addLuggageMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#ffffff',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 4,
    width: '100%',
  },
  addLuggageMiniBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ea580c',
  },
  noLuggageActionRow: {
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noLuggageActionText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748b',
  },
  noLuggageActionTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  luggageIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  luggageIconCircleSelected: {
    backgroundColor: '#ffedd5',
    borderColor: '#fed7aa',
  },
  luggageItemTexts: {
    flex: 1,
    paddingRight: 10,
  },
  luggageItemTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  luggageItemTitleSelected: {
    color: '#ea580c',
    fontWeight: '800',
  },
  luggageItemDesc: {
    fontSize: 8.5,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1,
  },
  luggageItemDescSelected: {
    color: '#9a3412',
  },
  checkedBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  carrierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  carrierCardActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  carrierIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  carrierIconBoxActive: {
    backgroundColor: '#ffedd5',
    borderColor: '#fed7aa',
  },
  carrierTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#103A75',
  },
  carrierTitleActive: {
    color: '#ea580c',
  },
  carrierAddedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  carrierAddedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
  },
  carrierDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  carrierNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fffbeb',
    marginTop: 8,
  },
  carrierNoteText: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: '600',
    flex: 1,
  },
  preferencesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  optionalHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  quickTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  quickTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 9,
    paddingVertical: 5.5,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickTagPillSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
  },
  quickTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#474D5E',
  },
  quickTagTextSelected: {
    color: '#ea580c',
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 52,
    fontSize: 12,
    color: '#103A75',
    fontWeight: '500',
  },
  notesInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 46,
  },
  notesInputIcon: {
    marginTop: 2,
    marginRight: 6,
  },
  notesInputField: {
    flex: 1,
    fontSize: 11.5,
    color: '#103A75',
    fontWeight: '500',
    padding: 0,
    minHeight: 32,
  },
});
