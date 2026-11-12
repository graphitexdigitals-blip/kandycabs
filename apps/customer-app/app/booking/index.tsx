import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  useWindowDimensions,
  KeyboardAvoidingView,
  Image,
  Modal,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AuthModal } from '../../components/AuthModal';
import BookingFlowHeader from '../../components/BookingFlowHeader';
import { customerApiClient, customerTokenStorage } from '../../lib/api';
import { termsAgreementState } from '../../lib/terms-agreement';
import { VehicleCategory, TripType, FuelType } from '@kandy-cabs/shared';

const { width } = Dimensions.get('window');

interface LuggageOption {
  id: 'small' | 'medium' | 'large' | 'extraLarge';
  label: string;
  shortLabel: string;
  description: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  image?: any;
}

const LUGGAGE_OPTIONS: LuggageOption[] = [
  {
    id: 'small',
    label: 'Small Bag',
    shortLabel: 'Small',
    description: 'Handbags, laptop bags & small personal bags',
    iconName: 'bag-personal-outline',
    image: require('../../assets/images/luggage-small.png'),
  },
  {
    id: 'medium',
    label: 'Medium Bag - 10 Kgs',
    shortLabel: 'Medium (10kg)',
    description: 'Cabin-size trolley bags & carry-on suitcases',
    iconName: 'bag-carry-on',
    image: require('../../assets/images/luggage-medium.png'),
  },
  {
    id: 'large',
    label: 'Large Bag - 20 Kgs',
    shortLabel: 'Large (20kg)',
    description: 'Standard check-in suitcases & travel bags',
    iconName: 'bag-suitcase',
    image: require('../../assets/images/luggage-large.png'),
  },
  {
    id: 'extraLarge',
    label: 'Extra Large Bag - 30 Kgs',
    shortLabel: 'Extra Large (30kg)',
    description: 'Oversized check-in suitcases & large travel bags',
    iconName: 'bag-checked',
    image: require('../../assets/images/luggage-extra-large.png'),
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
    name: 'Sedan – Compact',
    models: 'Toyota Glanza, WagonR, Tiago or equivalent',
    ratePerKm: 11,
    minKm: 50,
    passengers: 4,
    luggage: 2,
    badge: 'ECONOMY CHOICE',
    image: require('../../assets/images/fleet-hatchback.png'),
    color: '#059669',
    category: VehicleCategory.HATCHBACK,
  },
  SWIFT_DZIRE: {
    name: 'Sedan Swift Dzire',
    models: 'Maruti Suzuki Dzire or equivalent',
    ratePerKm: 13,
    minKm: 60,
    passengers: 4,
    luggage: 3,
    badge: 'MOST POPULAR',
    image: require('../../assets/images/fleet-sedan.png'),
    color: 'rgb(240, 117, 15)',
    category: VehicleCategory.SEDAN,
  },
  SEDAN: {
    name: 'Sedan Swift Dzire',
    models: 'Maruti Suzuki Dzire or equivalent',
    ratePerKm: 13,
    minKm: 60,
    passengers: 4,
    luggage: 3,
    badge: 'MOST POPULAR',
    image: require('../../assets/images/fleet-sedan.png'),
    color: 'rgb(240, 117, 15)',
    category: VehicleCategory.SEDAN,
  },
  TOYOTA_ETIOS: {
    name: 'Sedan Toyota Etios',
    models: 'Toyota Etios Diesel with Large Boot Space',
    ratePerKm: 14,
    minKm: 60,
    passengers: 4,
    luggage: 4,
    badge: 'DIESEL WITH BOOT',
    image: require('../../assets/images/fleet-4-sedan.png'),
    color: 'rgb(240, 117, 15)',
    category: VehicleCategory.SEDAN,
  },
  SUV_ERTIGA: {
    name: 'SUVs Ertiga',
    models: 'Maruti Suzuki Ertiga or equivalent',
    ratePerKm: 16,
    minKm: 80,
    passengers: 6,
    luggage: 4,
    badge: 'FAMILY & GROUP',
    image: require('../../assets/images/fleet-suv.png'),
    color: '#0284c7',
    category: VehicleCategory.SUV,
  },
  SUV: {
    name: 'SUVs Ertiga',
    models: 'Maruti Suzuki Ertiga or equivalent',
    ratePerKm: 16,
    minKm: 80,
    passengers: 6,
    luggage: 4,
    badge: 'FAMILY & GROUP',
    image: require('../../assets/images/fleet-suv.png'),
    color: '#0284c7',
    category: VehicleCategory.SUV,
  },
  SUV_CARENS: {
    name: 'SUVs Kia Carens',
    models: 'Kia Carens Diesel Luxury 6+1',
    ratePerKm: 18,
    minKm: 80,
    passengers: 6,
    luggage: 4,
    badge: 'PREMIUM 6-SEATER',
    image: require('../../assets/images/fleet-carens.png'),
    color: '#0284c7',
    category: VehicleCategory.SUV,
  },
  SUV_INNOVA: {
    name: 'SUVs Toyota Innova',
    models: 'Toyota Innova Diesel 7+1 Touring',
    ratePerKm: 19,
    minKm: 90,
    passengers: 7,
    luggage: 5,
    badge: 'POPULAR 7-SEATER',
    image: require('../../assets/images/fleet-innova.png'),
    color: '#7c3aed',
    category: VehicleCategory.SUV_PREMIUM,
  },
  SUV_CRYSTA: {
    name: 'SUVs Innova Crysta',
    models: 'Toyota Innova Crysta Diesel Luxury',
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
    name: 'SUVs Innova Crysta',
    models: 'Toyota Innova Crysta Diesel Luxury',
    ratePerKm: 20,
    minKm: 100,
    passengers: 7,
    luggage: 5,
    badge: 'EXECUTIVE LUXURY',
    image: require('../../assets/images/fleet-crysta.png'),
    color: '#7c3aed',
    category: VehicleCategory.SUV_PREMIUM,
  },
  CRYSTA: {
    name: 'SUVs Innova Crysta',
    models: 'Toyota Innova Crysta Diesel Luxury',
    ratePerKm: 20,
    minKm: 100,
    passengers: 7,
    luggage: 5,
    badge: 'EXECUTIVE LUXURY',
    image: require('../../assets/images/fleet-crysta.png'),
    color: '#7c3aed',
    category: VehicleCategory.SUV_PREMIUM,
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
  URBANIA: {
    name: 'Force Urbania',
    models: 'Force Urbania Luxury (10/13/17 Seater)',
    ratePerKm: 32,
    minKm: 150,
    passengers: 17,
    luggage: 10,
    badge: 'LUXURY VAN',
    image: require('../../assets/images/fleet-urbania.png'),
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
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;
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
  const isLargeFleetApproval =
    params.isFleetApprovalRequired === 'true' ||
    vehicleInfo.category === VehicleCategory.TEMPO_TRAVELER ||
    rawCategory === 'TEMPO_TRAVELER' ||
    rawCategory === 'TRAVELLER' ||
    rawCategory === 'URBANIA';

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
  const openRequirementsParam = params.openRequirements === 'true';
  const [showRequirementsModal, setShowRequirementsModal] = useState<boolean>(openRequirementsParam);
  const [showTravellersRequiredModal, setShowTravellersRequiredModal] = useState<boolean>(false);

  const [passengerCount, setPassengerCount] = useState<number>(() => {
    const p = Number(params.passengers);
    if (p && p > 0) return p;
    return 0;
  });
  type LuggageKey = 'small' | 'medium' | 'large' | 'extraLarge';

  const [requestCarrier, setRequestCarrier] = useState<boolean>(
    params.requestCarrier === 'true'
  );

  // Normalize fleet category across all query param formats and models
  const normalizedCategory = useMemo(() => {
    const c = (rawCategory || 'SEDAN').toUpperCase().trim();
    if (c.includes('HATCHBACK') || (c.includes('SWIFT') && !c.includes('DZIRE')) || c.includes('WAGONR') || c.includes('TIAGO')) return 'HATCHBACK';
    if (c.includes('ETIOS')) return 'TOYOTA_ETIOS';
    if (c.includes('DZIRE') || c === 'SEDAN') return 'SWIFT_DZIRE';
    if (c.includes('CARENS')) return 'SUV_CARENS';
    if (c.includes('ERTIGA') || c === 'SUV' || c === 'MUV') return 'SUV_ERTIGA';
    if (c.includes('CRYSTA') || c.includes('HYCROSS') || c === 'SUV_PREMIUM') return 'SUV_CRYSTA';
    if (c.includes('INNOVA')) return 'SUV_INNOVA';
    if (c.includes('TEMPO') || c.includes('TRAVELLER')) return 'TEMPO_TRAVELER';
    if (c.includes('URBANIA')) return 'URBANIA';
    return c;
  }, [rawCategory]);

  const maxVehicleLuggageLimit = useMemo(() => {
    if (normalizedCategory === 'TEMPO_TRAVELER') {
      return requestCarrier ? 16 : 8;
    }
    if (normalizedCategory === 'URBANIA') {
      return 12;
    }
    if (normalizedCategory === 'TOYOTA_ETIOS') {
      return 16;
    }
    if (normalizedCategory === 'SWIFT_DZIRE') {
      return 14;
    }
    if (normalizedCategory === 'SUV_INNOVA' || normalizedCategory === 'SUV_CRYSTA') {
      return requestCarrier ? 8 : 5;
    }
    if (normalizedCategory === 'SUV_ERTIGA' || normalizedCategory === 'SUV_CARENS') {
      return requestCarrier ? 6 : 3;
    }
    if (normalizedCategory === 'HATCHBACK') {
      return 8;
    }
    return 14;
  }, [normalizedCategory, requestCarrier]);

  const MAX_LUGGAGE_BAGS = maxVehicleLuggageLimit;

  const [luggageCounts, setLuggageCounts] = useState<Record<LuggageKey, number>>({
    small: 0,
    medium: 0,
    large: 0,
    extraLarge: 0,
  });

  const [isLuggageDropdownOpen, setIsLuggageDropdownOpen] = useState<boolean>(false);

  const totalLuggageBags =
    luggageCounts.small +
    luggageCounts.medium +
    luggageCounts.large +
    luggageCounts.extraLarge;

  const isNoLuggage = totalLuggageBags === 0;

  // Trips that do NOT require mandatory luggage selection: LOCAL TRIPS and CORPORATE TRAVEL only
  const isLuggageOptionalTrip = useMemo(() => {
    const norm = (tripTypeParam || (params.tripType as string) || (params.category as string) || '').toUpperCase().trim();
    return (
      norm === 'LOCAL' ||
      norm === 'LOCAL_TRIP' ||
      norm === 'LOCAL TRIP' ||
      norm === 'HOURLY' ||
      norm === 'PACKAGE' ||
      norm === 'RENTAL' ||
      norm === 'CORPORATE' ||
      norm === 'CORPORATE_TRAVEL' ||
      norm === 'CORPORATE TRAVEL'
    );
  }, [tripTypeParam, params.tripType, params.category]);

  const selectedLuggageList = useMemo(() => {
    return LUGGAGE_OPTIONS.filter((opt) => luggageCounts[opt.id] > 0);
  }, [luggageCounts]);

  const selectedLuggageSummary = useMemo(() => {
    if (totalLuggageBags === 0) {
      return 'No Luggage';
    }
    const parts = selectedLuggageList.map(
      (opt) => `${opt.shortLabel}: ${luggageCounts[opt.id]}`
    );
    return `${parts.join(', ')} (${totalLuggageBags} ${
      totalLuggageBags === 1 ? 'bag' : 'bags'
    })`;
  }, [totalLuggageBags, selectedLuggageList, luggageCounts]);

  const [needReturnJourney, setNeedReturnJourney] = useState<boolean>(
    params.needReturnJourney === 'true' || params.returnJourney === 'true'
  );
  const [needAirportDrop, setNeedAirportDrop] = useState<boolean>(
    params.needAirportDrop === 'true' || params.airportDrop === 'true'
  );
  const [needAirportPickup, setNeedAirportPickup] = useState<boolean>(
    params.needAirportPickup === 'true' || params.airportPickup === 'true'
  );
  const [isSeniorCitizen, setIsSeniorCitizen] = useState<boolean>(
    params.isSeniorCitizen === 'true' || /senior|elder/i.test(specialReqParam)
  );
  const [isPetFriendly, setIsPetFriendly] = useState<boolean>(
    params.isPetFriendly === 'true' || /pet\s*friendly/i.test(specialReqParam)
  );
  type PetType = 'cat' | 'dog' | 'bird';
  const [selectedPetType, setSelectedPetType] = useState<PetType>('dog');
  const [petRates, setPetRates] = useState<{ cat: number; dog: number; bird: number }>({
    cat: 200,
    dog: 500,
    bird: 100,
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await customerApiClient.fetch('/api/settings/pet-rates');
        if (res && res.success && res.rates && isMounted) {
          setPetRates({
            cat: Number(res.rates.cat) || 200,
            dog: Number(res.rates.dog) || 500,
            bird: Number(res.rates.bird) || 100,
          });
        }
      } catch {
        // Fallback to default rates
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);
  const [isBabyOnBoard, setIsBabyOnBoard] = useState<boolean>(
    params.isBabyOnBoard === 'true' || /baby\s*on\s*board/i.test(specialReqParam)
  );
  const [isPregnancyFriendly, setIsPregnancyFriendly] = useState<boolean>(
    params.isPregnancyFriendly === 'true' || /pregnan/i.test(specialReqParam)
  );
  const [isHandicapped, setIsHandicapped] = useState<boolean>(
    params.isHandicapped === 'true' || /handicap|wheelchair|disabilit/i.test(specialReqParam)
  );
  const [pickupNotes, setPickupNotes] = useState<string>(specialReqParam);

  // Luggage Capacity Modal & Refs for Special Notes Navigation
  const [showLuggageAlertModal, setShowLuggageAlertModal] = useState<boolean>(false);
  const [luggageAlertReason, setLuggageAlertReason] = useState<string>('');
  const sheetScrollRef = useRef<ScrollView>(null);
  const notesInputRef = useRef<TextInput>(null);
  const [isNotesHighlighted, setIsNotesHighlighted] = useState<boolean>(false);

  // Check if luggage counts exceed the specific cab's boot / carrier capacity based on Official Fleet Guide
  const checkLuggageCapacity = useCallback(
    (counts: Record<LuggageKey, number>) => {
      const total = counts.small + counts.medium + counts.large + counts.extraLarge;
      const standardBags = counts.large + counts.medium; // standard check-in & cabin suitcases (10kg + 20kg)
      const cat = normalizedCategory;

      // 1. Maruti Swift / Hatchback (~268L - 300L boot, No roof carrier)
      if (cat === 'HATCHBACK') {
        if (counts.extraLarge >= 2) {
          return {
            exceeded: true,
            reason: 'A hatchback boot cannot fit 2 or more Extra Large (30kg) suitcases. Combined depth exceeds boot floor; rear hatchback glass cannot close.',
            maxBags: 2,
          };
        }
        if (counts.extraLarge === 1 && (counts.large >= 1 || counts.medium >= 1 || total > 2)) {
          return {
            exceeded: true,
            reason: 'With 1 Extra Large (30kg) suitcase, hatchback boot space is limited to 1 small personal bag.',
            maxBags: 2,
          };
        }
        if (counts.large >= 2) {
          return {
            exceeded: true,
            reason: 'A hatchback boot cannot fit 2 or more Large (20kg) suitcases. Maximum boot capacity is 1 Large + 1 Medium suitcase.',
            maxBags: 2,
          };
        }
        if (counts.large === 1 && counts.medium >= 2) {
          return {
            exceeded: true,
            reason: 'Hatchback boot capacity is 1 Large + 1 Medium suitcase (or 2 Medium suitcases).',
            maxBags: 2,
          };
        }
        if (counts.medium >= 3) {
          return {
            exceeded: true,
            reason: 'Hatchback boot can fit at most 2 Medium (10kg) cabin suitcases.',
            maxBags: 2,
          };
        }
        if (standardBags > 2) {
          return {
            exceeded: true,
            reason: 'Swift / Hatchback luggage capacity is 2 standard bags (1 Large + 1 Medium, or 2 Medium).',
            maxBags: 2,
          };
        }
        if ((counts.large > 0 || counts.medium > 0) && total > 3) {
          return {
            exceeded: true,
            reason: 'Swift / Hatchback boot capacity is up to 2–3 bags maximum when standard suitcases are carried.',
            maxBags: 2,
          };
        }
        if (total > 8) {
          return {
            exceeded: true,
            reason: 'Hatchback boot capacity is up to 7–8 small soft bags maximum.',
            maxBags: 2,
          };
        }
      }

      // 2. Swift Dzire / Sedan (~378L - 400L boot, No roof carrier under RTO)
      else if (cat === 'SWIFT_DZIRE') {
        if (counts.extraLarge >= 3) {
          return {
            exceeded: true,
            reason: 'A sedan trunk cannot fit 3 or more Extra Large (30kg) suitcases. Sedans strictly have no roof carriers under RTO regulations.',
            maxBags: 3,
          };
        }
        if (counts.extraLarge === 2 && (counts.large >= 1 || counts.medium >= 1 || total > 3)) {
          return {
            exceeded: true,
            reason: 'With 2 Extra Large suitcases, sedan trunk can only take 1 small bag.',
            maxBags: 3,
          };
        }
        if (counts.extraLarge === 1 && (counts.large >= 2 || counts.large + counts.medium > 2)) {
          return {
            exceeded: true,
            reason: 'With 1 Extra Large suitcase, sedan trunk can fit at most 1 Large or 1 Medium bag.',
            maxBags: 3,
          };
        }
        if (counts.large >= 3) {
          return {
            exceeded: true,
            reason: 'Swift Dzire trunk cannot fit 3 or more Large (20kg) suitcases. Maximum is 2 Large + 1 Medium bag.',
            maxBags: 3,
          };
        }
        if (standardBags > 3) {
          return {
            exceeded: true,
            reason: 'Swift Dzire luggage capacity is 3 standard bags (2 Large + 1 Medium).',
            maxBags: 3,
          };
        }
        if ((counts.large > 0 || counts.medium > 0 || counts.extraLarge > 0) && total > 5) {
          return {
            exceeded: true,
            reason: 'Sedan boot capacity is up to 3 standard bags plus 1–2 small bags (max 5 bags total).',
            maxBags: 3,
          };
        }
        if (total > 14) {
          return {
            exceeded: true,
            reason: 'Sedan trunk capacity is up to 14 small/work bags maximum.',
            maxBags: 3,
          };
        }
      }

      // 3. Toyota Etios (Huge 592L boot, No roof carrier under RTO)
      else if (cat === 'TOYOTA_ETIOS') {
        if (counts.extraLarge >= 3) {
          return {
            exceeded: true,
            reason: 'Toyota Etios trunk cannot fit 3 or more Extra Large (30kg) suitcases. Sedans strictly have no roof carriers under RTO regulations.',
            maxBags: 4,
          };
        }
        if (counts.extraLarge === 2 && (counts.large >= 1 || counts.medium >= 1 || total > 3)) {
          return {
            exceeded: true,
            reason: 'With 2 Extra Large suitcases, Toyota Etios trunk can take 1 small personal bag.',
            maxBags: 4,
          };
        }
        if (counts.extraLarge === 1 && (counts.large >= 2 || counts.large + counts.medium > 3)) {
          return {
            exceeded: true,
            reason: 'With 1 Extra Large suitcase, Toyota Etios boot accommodates up to 2 standard bags.',
            maxBags: 4,
          };
        }
        if (counts.large >= 3) {
          return {
            exceeded: true,
            reason: 'Toyota Etios boot fits at most 2 Large (20kg) suitcases + 2 Medium (10kg) cabin bags.',
            maxBags: 4,
          };
        }
        if (standardBags > 4) {
          return {
            exceeded: true,
            reason: 'Toyota Etios luggage capacity is 4 standard bags (2 Large + 2 Medium).',
            maxBags: 4,
          };
        }
        if ((counts.large > 0 || counts.medium > 0 || counts.extraLarge > 0) && total > 6) {
          return {
            exceeded: true,
            reason: 'Toyota Etios maximum capacity is 2 Large + 2 Medium + 2 Small bags (6 bags total).',
            maxBags: 4,
          };
        }
        if (total > 16) {
          return {
            exceeded: true,
            reason: 'Toyota Etios trunk capacity is up to 14–16 small/work bags maximum.',
            maxBags: 4,
          };
        }
      }

      // 4. Maruti Ertiga / Kia Carens (~209L boot with all 6 seats full, Optional roof carrier)
      else if (cat === 'SUV_ERTIGA' || cat === 'SUV_CARENS') {
        const vehicleTitle = cat === 'SUV_CARENS' ? 'Kia Carens' : 'Maruti Ertiga';
        if (!requestCarrier) {
          if (counts.extraLarge >= 2) {
            return {
              exceeded: true,
              reason: `Without a roof carrier, ${vehicleTitle} boot with all 6 passenger seats occupied can only fit 1 Extra Large bag.`,
              maxBags: 2,
            };
          }
          if (counts.extraLarge === 1 && (counts.large >= 1 || counts.medium >= 1 || total > 2)) {
            return {
              exceeded: true,
              reason: `With 1 Extra Large suitcase in ${vehicleTitle} boot, space is limited to 1 small personal bag.`,
              maxBags: 2,
            };
          }
          if (counts.large >= 2) {
            return {
              exceeded: true,
              reason: `Without a roof carrier, ${vehicleTitle} rear boot can only fit 1 Large (20kg) bag laid flat or 2 Medium bags.`,
              maxBags: 2,
            };
          }
          if (counts.large === 1 && counts.medium >= 1) {
            return {
              exceeded: true,
              reason: `Without a roof carrier, ${vehicleTitle} boot can fit 1 Large bag laid flat + 2 Small bags, OR 2 Medium bags.`,
              maxBags: 2,
            };
          }
          if (counts.medium >= 3) {
            return {
              exceeded: true,
              reason: `Without a roof carrier, ${vehicleTitle} boot fits at most 2 Medium (10kg) bags upright.`,
              maxBags: 2,
            };
          }
          if (standardBags > 2) {
            return {
              exceeded: true,
              reason: `If all 6 passengers travel without a roof carrier, ${vehicleTitle} boot can only fit 2 standard bags.`,
              maxBags: 2,
            };
          }
          if (total > 3) {
            return {
              exceeded: true,
              reason: `Without a roof carrier, ${vehicleTitle} boot accommodates up to 2 standard bags + 1 small bag (3 bags total). Select Roof Carrier or write in Special Notes.`,
              maxBags: 2,
            };
          }
        } else {
          // With Roof Carrier
          if (counts.extraLarge >= 3) {
            return {
              exceeded: true,
              reason: `${vehicleTitle} with roof carrier can carry at most 2 Extra Large (30kg) suitcases.`,
              maxBags: 4,
            };
          }
          if (counts.extraLarge === 2 && (counts.large >= 2 || total > 4)) {
            return {
              exceeded: true,
              reason: `With 2 Extra Large suitcases on carrier, ${vehicleTitle} accommodates up to 1–2 additional medium/small bags.`,
              maxBags: 4,
            };
          }
          if (counts.large >= 5) {
            return {
              exceeded: true,
              reason: `${vehicleTitle} with roof carrier fits up to 4 Large (20kg) bags (2 in boot + 2 on roof carrier).`,
              maxBags: 4,
            };
          }
          if (standardBags > 5) {
            return {
              exceeded: true,
              reason: `${vehicleTitle} with roof carrier accommodates up to 4–5 standard bags.`,
              maxBags: 4,
            };
          }
          if (total > 6) {
            return {
              exceeded: true,
              reason: `${vehicleTitle} with roof carrier accommodates up to 4 Large bags + 2 Small bags (6 bags total).`,
              maxBags: 4,
            };
          }
        }
      }

      // 5. Toyota Innova / Innova Crysta Luxury (~300L behind 3rd row, Roof carrier available)
      else if (cat === 'SUV_INNOVA' || cat === 'SUV_CRYSTA') {
        const vehicleTitle = cat === 'SUV_CRYSTA' ? 'Innova Crysta' : 'Toyota Innova';
        if (!requestCarrier) {
          if (counts.extraLarge >= 3) {
            return {
              exceeded: true,
              reason: `${vehicleTitle} boot can fit at most 2 Extra Large (30kg) suitcases with all 7 passenger seats occupied.`,
              maxBags: 3,
            };
          }
          if (counts.extraLarge === 2 && (counts.large >= 1 || counts.medium >= 1 || total > 3)) {
            return {
              exceeded: true,
              reason: `With 2 Extra Large suitcases in ${vehicleTitle} boot, space is limited to 1 small personal bag.`,
              maxBags: 3,
            };
          }
          if (counts.extraLarge === 1 && (counts.large >= 2 || standardBags > 2)) {
            return {
              exceeded: true,
              reason: `With 1 Extra Large suitcase in ${vehicleTitle} boot, space allows 1 additional Large or Medium suitcase.`,
              maxBags: 3,
            };
          }
          if (counts.large >= 2) {
            return {
              exceeded: true,
              reason: `Without a roof carrier, ${vehicleTitle} boot fits 1 Large (20kg) + 2 Medium (10kg) + 2 Small bags standing upright.`,
              maxBags: 3,
            };
          }
          if (standardBags > 3) {
            return {
              exceeded: true,
              reason: `${vehicleTitle} rear boot fits up to 3 standard bags (1 Large + 2 Medium) when all 7 seats are occupied.`,
              maxBags: 3,
            };
          }
          if (total > 5) {
            return {
              exceeded: true,
              reason: `Without a roof carrier, ${vehicleTitle} boot accommodates up to 3 standard bags + 2 Small bags (5 bags total). Enable top carrier for 5–7 suitcases.`,
              maxBags: 3,
            };
          }
        } else {
          // With Roof Carrier
          if (counts.extraLarge >= 4) {
            return {
              exceeded: true,
              reason: `${vehicleTitle} with top carrier can carry at most 2 Extra Large in boot + 1 on roof carrier (3 XL max).`,
              maxBags: 7,
            };
          }
          if (counts.extraLarge === 3 && counts.large >= 2) {
            return {
              exceeded: true,
              reason: `${vehicleTitle} capacity reached with 3 Extra Large suitcases.`,
              maxBags: 7,
            };
          }
          if (counts.large >= 6) {
            return {
              exceeded: true,
              reason: `${vehicleTitle} with top carrier can carry up to 5 Large suitcases (3 inside boot + 2 on top rack).`,
              maxBags: 7,
            };
          }
          if (standardBags > 7) {
            return {
              exceeded: true,
              reason: `${vehicleTitle} with heavy-duty roof carrier accommodates up to 5–7 standard suitcases.`,
              maxBags: 7,
            };
          }
          if (total > 8) {
            return {
              exceeded: true,
              reason: `${vehicleTitle} total luggage limit is 5–7 standard suitcases + 1–2 small bags (up to 8 bags total).`,
              maxBags: 7,
            };
          }
        }
      }

      // 6. Force Tempo Traveller (12-17 Seater, Rear Boot Bay + Roof Rack)
      else if (cat === 'TEMPO_TRAVELER') {
        if (!requestCarrier) {
          if (counts.extraLarge >= 5) {
            return {
              exceeded: true,
              reason: 'Tempo Traveller rear boot bay fits at most 3–4 Extra Large suitcases without roof rack.',
              maxBags: 6,
            };
          }
          if (counts.large >= 7) {
            return {
              exceeded: true,
              reason: 'Tempo Traveller internal rear boot bay accommodates 5 to 6 Large check-in suitcases.',
              maxBags: 6,
            };
          }
          if (standardBags > 6) {
            return {
              exceeded: true,
              reason: 'Tempo Traveller rear boot bay accommodates up to 5–6 suitcases without roof rack.',
              maxBags: 6,
            };
          }
          if (total > 8) {
            return {
              exceeded: true,
              reason: 'Tempo Traveller internal boot accommodates 5–6 suitcases + 2 under-seat backpacks (8 bags total). Enable roof rack for up to 14 suitcases.',
              maxBags: 6,
            };
          }
        } else {
          // With Roof Carrier
          if (counts.extraLarge >= 9) {
            return {
              exceeded: true,
              reason: 'Tempo Traveller heavy-duty roof rack accommodates up to 6–8 Extra Large suitcases.',
              maxBags: 14,
            };
          }
          if (counts.large + counts.medium + counts.extraLarge > 14) {
            return {
              exceeded: true,
              reason: 'Tempo Traveller with roof rack accommodates up to 10–14 suitcases and trolleys securely roped.',
              maxBags: 14,
            };
          }
          if (total > 16) {
            return {
              exceeded: true,
              reason: 'Tempo Traveller maximum tour luggage limit of 14 suitcases + soft personal bags reached.',
              maxBags: 14,
            };
          }
        }
      }

      // 7. Force Urbania Luxury Van (Deep High-Capacity Rear Boot, No Roof Carrier)
      else if (cat === 'URBANIA') {
        if (counts.extraLarge >= 7) {
          return {
            exceeded: true,
            reason: 'Force Urbania deep internal boot accommodates up to 5–6 Extra Large (30kg) suitcases.',
            maxBags: 10,
          };
        }
        if (counts.extraLarge >= 5 && counts.large >= 3) {
          return {
            exceeded: true,
            reason: 'Force Urbania boot accommodates up to 5–6 Extra Large suitcases + 4 Medium cabin bags.',
            maxBags: 10,
          };
        }
        if (counts.large >= 11) {
          return {
            exceeded: true,
            reason: 'Force Urbania dedicated rear boot fits 8 to 10 Large check-in suitcases.',
            maxBags: 10,
          };
        }
        if (standardBags > 10) {
          return {
            exceeded: true,
            reason: 'Force Urbania internal luggage compartment accommodates up to 8–10 standard suitcases.',
            maxBags: 10,
          };
        }
        if (total > 12) {
          return {
            exceeded: true,
            reason: 'Force Urbania rear luggage boot accommodates up to 10–12 bags (5–6 XL suitcases + 4 medium cabin bags + duffles).',
            maxBags: 10,
          };
        }
      }

      return { exceeded: false, reason: '', maxBags: vehicleInfo.luggage || 4 };
    },
    [normalizedCategory, requestCarrier, vehicleInfo.luggage]
  );

  const currentLuggageCheck = useMemo(() => {
    return checkLuggageCapacity(luggageCounts);
  }, [checkLuggageCapacity, luggageCounts]);

  const handleGoToSpecialNotes = () => {
    setShowLuggageAlertModal(false);
    setIsLuggageDropdownOpen(false);
    setIsNotesHighlighted(true);
    setTimeout(() => {
      sheetScrollRef.current?.scrollToEnd({ animated: true });
      setTimeout(() => {
        notesInputRef.current?.focus();
        setTimeout(() => {
          setIsNotesHighlighted(false);
        }, 3500);
      }, 250);
    }, 150);
  };

  const handleIncrementLuggage = (category: LuggageKey) => {
    const nextCounts = {
      ...luggageCounts,
      [category]: luggageCounts[category] + 1,
    };

    const capacityCheck = checkLuggageCapacity(nextCounts);
    if (capacityCheck.exceeded) {
      setLuggageAlertReason(capacityCheck.reason);
      setShowLuggageAlertModal(true);
      return;
    }

    if (totalLuggageBags >= MAX_LUGGAGE_BAGS) {
      setLuggageAlertReason(`Maximum luggage limit of ${MAX_LUGGAGE_BAGS} bags reached for this vehicle.`);
      setShowLuggageAlertModal(true);
      return;
    }

    setLuggageCounts(nextCounts);
  };

  const handleDecrementLuggage = (category: LuggageKey) => {
    setLuggageCounts((prev) => ({
      ...prev,
      [category]: Math.max(0, prev[category] - 1),
    }));
  };

  const handleClearAllLuggage = () => {
    setLuggageCounts({
      small: 0,
      medium: 0,
      large: 0,
      extraLarge: 0,
    });
  };

  const handleDecrementPassengers = () => {
    if (passengerCount > 0) {
      setPassengerCount((prev) => prev - 1);
    }
  };

  const handleIncrementPassengers = () => {
    if (passengerCount < maxSeatsParam) {
      setPassengerCount((prev) => prev + 1);
    }
  };

  const toggleQuickTag = (tagKeyOrLabel: string, defaultLabel?: string) => {
    const key = defaultLabel ? tagKeyOrLabel : undefined;
    const fallback = defaultLabel || tagKeyOrLabel;
    const translated = key ? t(`additionalRequirements.quickTags.${key}`, { defaultValue: fallback }) : fallback;
    const matches = [translated, fallback].filter(Boolean);
    const found = matches.find((m) => pickupNotes.includes(m));
    if (found) {
      const regex = new RegExp(`(^|,\\s*)${found.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\\\$&')}`, 'g');
      const updated = pickupNotes.replace(regex, '').replace(/^,\\s*/, '').trim();
      setPickupNotes(updated);
    } else {
      const updated = pickupNotes.trim()
        ? `${pickupNotes.trim()}, ${translated}`
        : translated;
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
  const initialUser = customerTokenStorage.getUser();
  const initialRawName = initialUser?.fullName || '';
  const initialCleanName = (initialRawName === 'Kandy Customer' ? '' : initialRawName).trim();
  const initialCleanP = initialUser?.phone ? initialUser.phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10) : '';

  const [passengerName, setPassengerName] = useState(initialCleanName);
  const [passengerPhone, setPassengerPhone] = useState(initialCleanP ? `+91 ${initialCleanP.slice(0, 5)} ${initialCleanP.slice(5)}` : '');
  const [passengerEmail, setPassengerEmail] = useState(initialUser?.email || '');
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
      const accountUser = user || customerTokenStorage.getUser();
      if (accountUser) {
        const rawName = accountUser.fullName || '';
        const cleanName = (rawName === 'Kandy Customer' ? '' : rawName).trim();
        const cleanP = accountUser.phone ? accountUser.phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10) : '';
        setPassengerName(cleanName);
        setPassengerPhone(cleanP ? `+91 ${cleanP.slice(0, 5)} ${cleanP.slice(5)}` : '');
        setPassengerEmail(accountUser.email || '');
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
  const [paymentOption, setPaymentOption] = useState<'PART' | 'FULL'>('PART');
  const [paymentMode, setPaymentMode] = useState<'ADVANCE_25' | 'PAY_ON_DROP' | 'CORPORATE'>(
    tripTypeParam === 'CORPORATE' ? 'CORPORATE' : 'ADVANCE_25'
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'UPI' | 'CARD' | 'NETBANKING' | 'OTHER_UPI'>('UPI');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Sync agreement status if accepted from the Terms & Conditions screen
  useEffect(() => {
    const unsub = termsAgreementState.subscribe((val) => {
      if (val) {
        setAgreedToTerms(true);
      }
    });
    return () => unsub();
  }, []);

  // Auto-scroll to top when switching steps
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  // Step 3: Booking Confirmation & Submitting
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);

  // Check user authentication on mount
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      setAuthChecking(true);
      try {
        // 1. Immediately check in-memory cached user or async SecureStore
        let cached = customerTokenStorage.getUser();
        if (!cached && typeof customerTokenStorage.getUserAsync === 'function') {
          cached = await customerTokenStorage.getUserAsync();
        }

        let token = customerTokenStorage.getToken();
        if (!token) {
          token = await customerTokenStorage.getTokenAsync();
        }

        // 2. If cached user exists, populate immediately!
        if (cached && isMounted) {
          const rawName = cached.fullName || '';
          const registeredName = (rawName === 'Kandy Customer' ? '' : rawName).trim();
          const cleanP = cached.phone ? cached.phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10) : '';

          setUser(cached);
          if (registeredName) {
            setPassengerName((prev: string) => prev || registeredName);
          }
          if (cleanP) {
            setPassengerPhone((prev: string) => prev || `+91 ${cleanP.slice(0, 5)} ${cleanP.slice(5)}`);
          }
          if (cached.email) {
            setPassengerEmail((prev: string) => prev || cached.email);
          }
          setSameAsAccount(true);
        }

        if (!token) {
          if (isMounted) setAuthChecking(false);
          return;
        }

        // 3. Try refreshing from /api/auth/me
        try {
          const res = await customerApiClient.fetch('/api/auth/me');
          if (res?.user && isMounted) {
            const rawName = res.user.fullName || '';
            const registeredName = (rawName === 'Kandy Customer' ? '' : rawName).trim();
            const cleanP = res.user.phone ? res.user.phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10) : '';

            const validUser = { ...res.user, fullName: registeredName || rawName };
            customerTokenStorage.setUser(validUser);
            setUser(validUser);
            if (registeredName) {
              setPassengerName(registeredName);
            }
            if (cleanP) {
              setPassengerPhone(`+91 ${cleanP.slice(0, 5)} ${cleanP.slice(5)}`);
            }
            if (res.user.email) {
              setPassengerEmail(res.user.email);
            }
            setSameAsAccount(true);
          }
        } catch {
          // If offline or network fails, KEEP the cached user! Do NOT erase!
        }
      } catch (err) {
        console.warn('[Booking] checkAuth error:', err);
      } finally {
        if (isMounted) setAuthChecking(false);
      }
    }

    checkAuth();

    const unsub = customerTokenStorage.subscribe(() => {
      const current = customerTokenStorage.getUser();
      if (!current || !isMounted) return;

      const rawName = current.fullName || '';
      const cleanName = (rawName === 'Kandy Customer' ? '' : rawName).trim();
      const cleanP = current.phone ? current.phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10) : '';

      setUser(current);
      if (cleanName) {
        setPassengerName(cleanName);
      }
      if (cleanP) {
        setPassengerPhone(`+91 ${cleanP.slice(0, 5)} ${cleanP.slice(5)}`);
      }
      if (current.email) {
        setPassengerEmail(current.email);
      }
      setSameAsAccount(true);
    });

    return () => {
      isMounted = false;
      unsub();
    };
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

        const rawName = res.user?.fullName?.trim() || '';
        const registeredName = (rawName.toLowerCase() === 'customer' || rawName.toLowerCase() === 'kandy customer') ? '' : rawName;
        const hasName = Boolean(registeredName.length > 0 && res.hasRegisteredName !== false);
        const isRegistered = res.isNewUser === false || Boolean(res.user?.id) || hasName;

        if (isRegistered) {
          // Existing customer -> auto login
          const validUser = { ...res.user, fullName: registeredName };
          customerTokenStorage.setUser(validUser);
          setUser(validUser);
          setPassengerName(registeredName);
          setPassengerPhone(cleaned);
          setPassengerEmail(res.user?.email || '');
          Alert.alert('Signed In Successfully! 👋', `Welcome${registeredName ? `, ${registeredName}` : ''}!`);
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

  // Handle Apply Coupon (Live validation with backend + smart offline fallback)
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponMsg('Please enter a coupon code.');
      return;
    }

    setIsApplyingCoupon(true);
    setCouponMsg('Validating coupon...');

    try {
      const res = await customerApiClient.fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          fare: baseEstimatedFare,
          tripType: tripTypeParam,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.valid && data.coupon) {
        setCouponDiscount(Number(data.coupon.discountAmount));
        setCouponApplied(true);
        setCouponMsg(data.message || `🎉 Promo "${code}" applied! You saved ₹${data.coupon.discountAmount}`);
        return;
      } else if (data.message) {
        setCouponApplied(false);
        setCouponDiscount(0);
        setCouponMsg(data.message);
        return;
      }
    } catch (networkErr) {
      // Graceful offline fallback
    } finally {
      setIsApplyingCoupon(false);
    }

    // Offline / fallback rules if server is unreachable
    if (code === 'WELCOME100') {
      const discount = Math.min(100, baseEstimatedFare);
      setCouponDiscount(discount);
      setCouponApplied(true);
      setCouponMsg(`🎉 Promo "${code}" applied! You saved ₹${discount}`);
    } else if (code === 'KANDY15' || code === 'SAVE15') {
      const discount = Math.min(Math.round(baseEstimatedFare * 0.15), 400);
      setCouponDiscount(discount);
      setCouponApplied(true);
      setCouponMsg(`🎉 Promo "${code}" applied! You saved ₹${discount}`);
    } else if (code === 'FESTIVE500' || code === 'KCD500') {
      const discount = Math.min(500, baseEstimatedFare);
      setCouponDiscount(discount);
      setCouponApplied(true);
      setCouponMsg(`🎉 Festive Promo "${code}" applied! You saved ₹${discount}`);
    } else if (code === 'AIRPORT10') {
      const discount = Math.min(Math.round(baseEstimatedFare * 0.1), 250);
      setCouponDiscount(discount);
      setCouponApplied(true);
      setCouponMsg(`🎉 Promo "${code}" applied! You saved ₹${discount}`);
    } else if (code === 'KANDY10' || code === 'SAVE10') {
      const discount = Math.min(Math.round(baseEstimatedFare * 0.1), 300);
      setCouponDiscount(discount);
      setCouponApplied(true);
      setCouponMsg(`🎉 Promo "${code}" applied! You saved ₹${discount}`);
    } else if (code === 'FIRST50' || code === 'WELCOME50') {
      const discount = Math.min(50, baseEstimatedFare);
      setCouponDiscount(discount);
      setCouponApplied(true);
      setCouponMsg(`🎉 Promo "${code}" applied! You saved ₹${discount}`);
    } else {
      setCouponApplied(false);
      setCouponDiscount(0);
      setCouponMsg('Invalid coupon code. Try WELCOME100 or KANDY15.');
    }
  };

  const handleRemoveCoupon = () => {
    setCouponApplied(false);
    setCouponDiscount(0);
    setCouponCode('');
    setCouponMsg('');
  };

  // Pet Friendly convenience fee (dynamically determined by selected pet: Cat, Dog, or Bird)
  const petFee = isPetFriendly ? (petRates[selectedPetType] ?? 500) : 0;
  const petLabel = selectedPetType === 'cat' ? 'Cat' : selectedPetType === 'bird' ? 'Bird' : 'Dog';

  // Calculate final totals
  const subtotal = Math.max(0, baseEstimatedFare + petFee - couponDiscount);
  const gstAmount = Math.round(subtotal * 0.05);
  const totalFare = subtotal + gstAmount;
  const advanceAmount = Math.round(totalFare * 0.30);
  const balanceAmount = totalFare - advanceAmount;

  // Selected payment amount depending on choice (30% Part Payment vs Full Amount)
  const payableAmount = paymentOption === 'FULL' ? totalFare : advanceAmount;
  const dueToDriver = paymentOption === 'FULL' ? 0 : balanceAmount;

  // Proceed to Step 2
  const handleProceedToStep2 = () => {
    const isTravellersMissing = passengerCount <= 0;
    const isLuggageMissing = !isLuggageOptionalTrip && totalLuggageBags <= 0;

    if (isTravellersMissing || isLuggageMissing) {
      if (isLuggageMissing && !isTravellersMissing) {
        setIsLuggageDropdownOpen(true);
      }
      setShowTravellersRequiredModal(true);
      return;
    }

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
      router.push({
        pathname: '/terms',
        params: { fromBooking: 'true' },
      });
      return;
    }
    if (!user) {
      setAuthModalVisible(true);
      return;
    }
    setSubmitting(true);
    try {
      const idempotencyKey = `idemp_app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let scheduledAt = new Date().toISOString();
      if (pickupDate && pickupDate !== 'Today') {
        try {
          const d = new Date(pickupDate);
          if (!isNaN(d.getTime())) {
            let hours = 9;
            let minutes = 0;
            if (pickupTime) {
              const timeParts = pickupTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
              if (timeParts) {
                hours = parseInt(timeParts[1], 10);
                minutes = parseInt(timeParts[2], 10);
                const ampm = timeParts[3]?.toUpperCase();
                if (ampm === 'PM' && hours < 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
              }
            }
            d.setHours(hours, minutes, 0, 0);
            scheduledAt = d.toISOString();
          }
        } catch (_) {}
      } else if (pickupTime) {
        try {
          const d = new Date();
          const timeParts = pickupTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (timeParts) {
            let hours = parseInt(timeParts[1], 10);
            let minutes = parseInt(timeParts[2], 10);
            const ampm = timeParts[3]?.toUpperCase();
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
            d.setHours(hours, minutes, 0, 0);
            scheduledAt = d.toISOString();
          }
        } catch (_) {}
      }

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
          viaStops: viaStops.map((s: any) => ({
            label: typeof s === 'string' ? s : (s?.label || s?.address || s?.name || ''),
            lat: s?.lat,
            lng: s?.lng,
          })),
          category: vehicleInfo.category,
          fuelType: FuelType.DIESEL,
          tripType: tripTypeParam as TripType,
          scheduledAt,
          durationDays: 1,
          packageHours: localHours,
          couponCode: couponApplied ? couponCode.trim().toUpperCase() : undefined,
          couponDiscount: couponApplied ? couponDiscount : 0,
          passengerName: passengerName.trim(),
          passengerPhone: passengerPhone.replace(/\D/g, '').slice(-10),
          passengerEmail: passengerEmail.trim() || undefined,
          alternateEmail: alternateEmail.trim() || undefined,
          companyName: companyName.trim() || undefined,
          gstin: gstin.trim().toUpperCase() || undefined,
          paymentMode: isLargeFleetApproval
            ? 'PAY_ON_APPROVAL'
            : (paymentOption === 'FULL' ? 'FULL' : (paymentMode === 'PAY_ON_DROP' ? 'PAY_ON_DROP' : 'ADVANCE')),
          isFleetApprovalRequired: isLargeFleetApproval,
          requestCarrier: requestCarrier,
          hasCarrier: requestCarrier,
          flightNumber: flightNumber.trim() ? flightNumber.trim().toUpperCase() : undefined,
          hasPet: isPetFriendly,
          isPetFriendly: isPetFriendly,
          petType: selectedPetType,
          petFee: petFee,
          notes: [
            isLargeFleetApproval ? '[FLEET AVAILABILITY APPROVAL REQUIRED] Admin fleet availability verification required. Payment deferred until Admin approval.' : '',
            corporateInfoNote,
            `Payment Option: ${paymentOption === 'FULL' ? 'Full Payment' : 'Part Payment (Advance)'}`,
            `Payment Method: ${selectedPaymentMethod}`,
            viaStops.length > 0 ? `Intermediate Stops: ${viaStops.map((s: any) => s.label).join(' ➔ ')}` : '',
            flightNumber.trim() ? `Flight: ${flightNumber.trim().toUpperCase()}` : '',
            alternatePhone.trim() ? `Alt Contact: +91 ${alternatePhone.replace(/\D/g, '').slice(-10)}` : '',
            alternateEmail.trim() ? `Alt Email: ${alternateEmail.trim()}` : '',
            gstin.trim() ? `GSTIN: ${gstin.trim().toUpperCase()}${companyName.trim() ? ` (${companyName.trim()})` : ''}` : '',
            selectedLuggageSummary ? `Luggage: ${selectedLuggageSummary}` : '',
            requestCarrier ? 'Roof Luggage Carrier Requested' : '',
            isSeniorCitizen ? 'Senior Citizen / Elderly (Age 60+): Yes' : '',
            needReturnJourney ? 'Return Journey Requested Later' : '',
            needAirportDrop ? 'Airport Drop Requested' : '',
            needAirportPickup ? 'Airport Pickup Requested' : '',
            isPetFriendly ? `Pet Friendly Requested (${petLabel} - Surcharge ₹${petFee})` : '',
            isBabyOnBoard ? 'Baby on Board: Yes (Child Safety)' : '',
            isPregnancyFriendly ? 'Pregnancy Friendly: Yes (Smooth Drive)' : '',
            isHandicapped ? 'Accessibility Assistance: Yes' : '',
            pickupNotes.trim(),
          ].filter(Boolean).join(' | ') || undefined,
          passengers: passengerCount,
          luggage: selectedLuggageSummary || luggageDetailsParam,
          specialRequirements: [
            isLargeFleetApproval ? 'Fleet Availability Check: Required (Admin verification needed before payment)' : '',
            corporateInfoNote,
            `Payment: ${selectedPaymentMethod}`,
            viaStops.length > 0 ? `Via Stops (${viaStops.length}): ${viaStops.map((s: any) => s.label).join(' ➔ ')}` : '',
            flightNumber.trim() ? `Flight Number: ${flightNumber.trim().toUpperCase()}` : '',
            alternatePhone.trim() ? `Alt Mobile: +91 ${alternatePhone.replace(/\D/g, '').slice(-10)}` : '',
            alternateEmail.trim() ? `Alt Email: ${alternateEmail.trim()}` : '',
            gstin.trim() ? `GST Details: ${gstin.trim().toUpperCase()}${companyName.trim() ? ` - ${companyName.trim()}` : ''}` : '',
            requestCarrier ? 'Roof Luggage Carrier: Requested (Cab Rooftop Carrier)' : '',
            isSeniorCitizen ? 'Senior Citizen / Elderly (Age 60+): Yes (Easy Access & Assistance)' : '',
            needReturnJourney ? 'Return Journey: Yes (Later date)' : '',
            needAirportDrop ? 'Airport Drop: Yes' : '',
            needAirportPickup ? 'Airport Pickup: Yes' : '',
            isPetFriendly ? `Pet Friendly: Yes (${petLabel} - Surcharge ₹${petFee})` : '',
            isBabyOnBoard ? 'Baby on Board: Yes' : '',
            isPregnancyFriendly ? 'Pregnancy Friendly: Yes' : '',
            isHandicapped ? 'Accessibility Assistance: Yes (Driver Assistance & Easy Boarding)' : '',
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
        title={step === 3 ? t('bookingReview.bookingSuccessTitle', { defaultValue: 'Booking Confirmed' }) : step === 2 ? (isLargeFleetApproval ? 'Review Booking Request' : t('bookingReview.title', { defaultValue: 'Review & Payment' })) : t('additionalDetails.contactInfo', { defaultValue: 'Passenger Details' })}
        subtitle={
          step === 3
            ? t('bookingReview.bookingSuccessMsg', { defaultValue: 'Your verified cab booking has been created and dispatched.' })
            : undefined
        }
        subStepLabel={
          step === 3
            ? t('nav.confirmed', { defaultValue: 'Confirmed' })
            : step === 2
            ? (isLargeFleetApproval ? 'Review Request' : t('nav.reviewAndPay', { defaultValue: 'Review & Payment' }))
            : 'Passenger Info'
        }
        step3Label={step === 2 ? (isLargeFleetApproval ? 'Review Request' : t('nav.reviewAndPay', { defaultValue: 'Review & Pay' })) : undefined}
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
            {
              paddingBottom:
                step === 3
                  ? Math.max(insets.bottom + 20, 28)
                  : 12,
              paddingHorizontal: isSmallDevice ? 8 : 12,
            },
            step === 3 && {
              flexGrow: 1,
              paddingTop: 4,
              paddingHorizontal: isSmallDevice ? 8 : 10,
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
                  {vehicleInfo.image ? (
                    <Image
                      source={vehicleInfo.image}
                      style={[
                        styles.topSummaryVehicleImage,
                        isSmallDevice && { width: 76, height: 48 },
                      ]}
                      resizeMode="contain"
                    />
                  ) : (
                    <View
                      style={[
                        styles.topSummaryVehicleImage,
                        isSmallDevice && { width: 76, height: 48 },
                        { alignItems: 'center', justifyContent: 'center' },
                      ]}
                    >
                      <Ionicons name="car-outline" size={24} color="#94a3b8" />
                    </View>
                  )}

                  {/* Middle: Vehicle Specs & Change Vehicle */}
                  <View style={[styles.topSummaryVehicleDetails, isSmallDevice && { paddingHorizontal: 4 }]}>
                    <Text
                      style={[styles.topSummaryVehicleName, isSmallDevice && { fontSize: 14 }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.8}
                    >
                      {customVehicleName}
                    </Text>

                    {/* Specs Icons */}
                    <View style={styles.topSummarySpecsRow}>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="person" size={13.5} color="#64748b" />
                        <Text style={styles.topSummarySpecText}>
                          {passengerCountParam || vehicleInfo.passengers} + 1
                        </Text>
                      </View>
                      <Text style={styles.topSummarySpecPipe}>|</Text>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="briefcase" size={13.5} color="#64748b" />
                        <Text style={styles.topSummarySpecText}>{vehicleInfo.luggage}</Text>
                      </View>
                      <Text style={styles.topSummarySpecPipe}>|</Text>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="snow" size={13.5} color="#64748b" />
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
                      <Ionicons name="chevron-down" size={13.5} color="#2563eb" style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                  </View>

                  {/* Vertical Divider */}
                  <View style={styles.topSummaryVerticalLine} />

                  {/* Right: Fare Column */}
                  <View style={styles.topSummaryPriceCol}>
                    <Text
                      style={[styles.topSummaryPrice, isSmallDevice && { fontSize: 17 }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.8}
                    >
                      ₹ {totalFare.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.topSummaryGst} numberOfLines={1}>(Total Trip Fare)</Text>
                  </View>
                </View>

                {/* Horizontal Divider */}
                <View style={styles.topSummaryHorizontalLine} />

                {/* 2. Route Locations Row */}
                <View style={styles.topSummaryLocationsRow}>
                  {/* Pickup */}
                  <View style={styles.topSummaryLocationItem}>
                    <Ionicons name="location" size={18} color="#16a34a" style={{ marginRight: 5 }} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={styles.topSummaryLocationName}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {pickupCity}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Pickup Location</Text>
                    </View>
                  </View>

                  {/* Dashed / Arrow Separator */}
                  <View style={styles.topSummaryArrowContainer}>
                    <Text style={styles.topSummaryArrowLine}>┄┄</Text>
                    <Ionicons name="arrow-forward" size={14} color="#94a3b8" />
                  </View>

                  {/* Drop */}
                  <View style={styles.topSummaryLocationItem}>
                    <Ionicons name="location" size={18} color="#ef4444" style={{ marginRight: 5 }} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={styles.topSummaryLocationName}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {dropCity}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Drop Location</Text>
                    </View>
                  </View>
                </View>

                {/* Inner Horizontal Divider */}
                <View style={styles.topSummaryInnerDivider} />

                {/* 3. Scheduled Date & Time Row (Arranged Below Locations, Non-Slidable) */}
                <View style={styles.topSummaryScheduleRow}>
                  {/* Pickup Date */}
                  <View style={styles.topSummaryScheduleItem}>
                    <Ionicons name="calendar-outline" size={18} color="rgb(22, 34, 50)" style={{ marginRight: 5 }} />
                    <View>
                      <Text
                        style={styles.topSummaryDateTimeText}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {displayPickupDate}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Pickup Date</Text>
                    </View>
                  </View>

                  {/* Vertical Divider */}
                  <View style={styles.topSummaryRouteDivider} />

                  {/* Pickup Time */}
                  <View style={styles.topSummaryScheduleItem}>
                    <Ionicons name="time-outline" size={18} color="rgb(22, 34, 50)" style={{ marginRight: 5 }} />
                    <View>
                      <Text
                        style={styles.topSummaryDateTimeText}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {displayPickupTime}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Pickup Time</Text>
                    </View>
                  </View>

                  {/* Flight Number for Airport Transfer */}
                  {tripTypeParam === 'AIRPORT' && flightNumber.trim().length > 0 && (
                    <>
                      <View style={styles.topSummaryRouteDivider} />
                      <View style={styles.topSummaryScheduleItem}>
                        <Ionicons name="airplane" size={17} color="#0284c7" style={{ marginRight: 5 }} />
                        <View>
                          <Text style={styles.topSummaryDateTimeText} numberOfLines={1}>
                            {flightNumber.trim()}
                          </Text>
                          <Text style={styles.topSummaryLocationSub}>{t('passengerDetails.flightNo', { defaultValue: 'Flight No' })}</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* Lead Passenger Card */}
              <View style={styles.leadPassengerCard}>
                {/* Top Header of Card */}
                <View style={styles.leadPassengerHeaderRow}>
                  <View style={styles.leadPassengerLeftTitle}>
                    <Ionicons name="person" size={22} color="rgb(240, 117, 15)" />
                    <Text style={styles.leadPassengerTitle}>{t('passengerDetails.leadPassenger', { defaultValue: 'Lead Passenger' })}</Text>
                  </View>
                </View>

                {/* 2x2 Grid of Inputs */}
                {/* Row 1: Full Name & Mobile Number */}
                <View style={styles.gridRow}>
                  {/* Full Name */}
                  <View style={[styles.gridCol, { marginRight: 4 }]}>
                    <View style={styles.inputCard}>
                      <Ionicons name="person" size={23} color="rgb(22, 34, 50)" style={styles.inputCardIcon} />
                      <View style={styles.inputCardTextCol}>
                        <Text style={styles.inputCardLabel}>
                          {t('passengerDetails.fullName', { defaultValue: 'Full Name' })} <Text style={{ color: 'rgb(240, 117, 15)' }}>*</Text>
                        </Text>
                        <TextInput
                          style={[styles.inputCardField, { color: 'rgb(22, 34, 50)' }]}
                          placeholder={t('passengerDetails.enterFullName', { defaultValue: 'Enter full name' })}
                          placeholderTextColor="#94a3b8"
                          value={passengerName}
                          onChangeText={(text) => {
                            setPassengerName(text);
                            if (sameAsAccount && user && text !== user.fullName) {
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
                      <Ionicons name="call" size={23} color="rgb(22, 34, 50)" style={styles.inputCardIcon} />
                      <View style={styles.inputCardTextCol}>
                        <Text style={styles.inputCardLabel}>
                          {t('passengerDetails.mobileNumber', { defaultValue: 'Mobile Number' })} <Text style={{ color: 'rgb(240, 117, 15)' }}>*</Text>
                        </Text>
                        <TextInput
                          style={[styles.inputCardField, { color: 'rgb(22, 34, 50)' }]}
                          placeholder="+91 98765 43210"
                          placeholderTextColor="#94a3b8"
                          keyboardType="phone-pad"
                          value={passengerPhone}
                          onChangeText={(text) => {
                            setPassengerPhone(text);
                            if (sameAsAccount && user && text !== user.phone) {
                              setSameAsAccount(false);
                            }
                          }}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Row 2: Email ID & Alternate Mobile Number */}
                <View style={[styles.gridRow, { marginTop: 9 }]}>
                  {/* Email ID */}
                  <View style={[styles.gridCol, { marginRight: 4 }]}>
                    <View style={styles.inputCard}>
                      <Ionicons name="mail-outline" size={23} color="#64748b" style={styles.inputCardIcon} />
                      <View style={styles.inputCardTextCol}>
                        <Text style={styles.inputCardLabel}>{t('passengerDetails.emailId', { defaultValue: 'Email ID' })}</Text>
                        <TextInput
                          style={styles.inputCardField}
                          placeholder={t('passengerDetails.enterEmail', { defaultValue: 'Enter email address' })}
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
                      <Ionicons name="call-outline" size={23} color="#64748b" style={styles.inputCardIcon} />
                      <View style={styles.inputCardTextCol}>
                        <Text style={styles.inputCardLabel} numberOfLines={1} ellipsizeMode="tail">
                          {t('passengerDetails.alternateMobile', { defaultValue: 'Alternate Mobile Number' })}
                        </Text>
                        <TextInput
                          style={styles.inputCardField}
                          placeholder={t('passengerDetails.enterAlternateMobile', { defaultValue: 'Enter alternate number' })}
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
                      size={14}
                      color="rgb(22, 34, 50)"
                    />
                    <Text style={styles.addonPillText}>{t('passengerDetails.alternateEmail', { defaultValue: 'Alternate Email' })}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.addonPillBtn, showGst && styles.addonPillBtnActive]}
                    onPress={() => setShowGst((prev) => !prev)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showGst ? "remove" : "add"}
                      size={14}
                      color="rgb(22, 34, 50)"
                    />
                    <Text style={styles.addonPillText}>{t('passengerDetails.addGst', { defaultValue: 'Add GST' })}</Text>
                  </TouchableOpacity>
                </View>

                {/* Alternate Email Input Box (Expanded) */}
                {showAlternateEmail && (
                  <View style={styles.addonExpandRow}>
                    <View style={styles.addonExpandColFull}>
                      <TextInput
                        style={styles.addonInputBox}
                        placeholder={t('passengerDetails.enterAlternateEmail', { defaultValue: 'Enter alternate email address' })}
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
                        placeholder={t('passengerDetails.companyName', { defaultValue: 'Company Name' })}
                        placeholderTextColor="#94a3b8"
                        value={companyName}
                        onChangeText={setCompanyName}
                      />
                    </View>
                    <View style={styles.addonExpandColHalf}>
                      <TextInput
                        style={styles.addonInputBox}
                        placeholder={t('passengerDetails.gstinPlaceholder', { defaultValue: '15-digit GSTIN' })}
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
                  <View style={[styles.gridRow, { marginTop: 9 }]}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.inputCard}>
                        <Ionicons name="airplane" size={18} color="rgb(22, 34, 50)" style={styles.inputCardIcon} />
                        <View style={styles.inputCardTextCol}>
                          <Text style={styles.inputCardLabel}>{t('passengerDetails.flightNumberOptional', { defaultValue: 'Flight Number (Optional)' })}</Text>
                          <TextInput
                            style={styles.inputCardField}
                            placeholder={t('passengerDetails.flightNumberPlaceholder', { defaultValue: 'e.g. 6E 214, AI 505' })}
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

              {/* Additional Requirements Trigger Card (Matching Reference Image) */}
              <TouchableOpacity
                style={styles.requirementsTriggerCard}
                onPress={() => setShowRequirementsModal(true)}
                activeOpacity={0.85}
              >
                <View style={styles.requirementsTriggerTopRow}>
                  <View style={styles.requirementsIconBox}>
                    <Ionicons name="options-outline" size={24} color="rgb(240, 117, 15)" />
                  </View>
                  <View style={styles.requirementsTriggerTextGroup}>
                    <View style={styles.requirementsTitleRow}>
                      <Text style={styles.requirementsTriggerTitle}>{t('additionalRequirements.triggerTitle', { defaultValue: 'Additional Details' })}</Text>
                      <View style={styles.requirementsEditPill}>
                        <Text style={styles.requirementsEditText}>{t('additionalRequirements.configure', { defaultValue: 'Configure' })}</Text>
                        <Ionicons name="chevron-forward" size={14} color="rgb(22, 34, 50)" />
                      </View>
                    </View>
                    <Text style={styles.requirementsTriggerSubtitle}>
                      {t('additionalRequirements.triggerSubtitle', { defaultValue: 'Add your requirements for a better travel experience.' })}
                    </Text>
                  </View>
                </View>

                {/* Live Requirements Summary Chips */}
                {(() => {
                  const summaryItems: {
                    key: string;
                    icon?: any;
                    image?: any;
                    imageStyle?: any;
                    text: string;
                  }[] = [
                    {
                      key: 'passengers',
                      icon: 'people',
                      text: passengerCount === 0
                        ? t('additionalRequirements.zeroTravellers', { defaultValue: '0 Travellers' })
                        : `${passengerCount} ${passengerCount === 1 ? t('additionalRequirements.passenger', { defaultValue: 'Traveller' }) : t('additionalRequirements.passengersPlural', { defaultValue: 'Travellers' })}`,
                    },
                    {
                      key: 'luggage',
                      image: require('../../assets/images/luggage-two-suitcases.png'),
                      imageStyle: { width: 22, height: 21, resizeMode: 'contain' as const, tintColor: 'rgb(22, 34, 50)' },
                      text: totalLuggageBags === 0
                        ? t('additionalRequirements.zeroLuggage', { defaultValue: '0 Luggage' })
                        : `${totalLuggageBags} ${totalLuggageBags === 1 ? t('additionalRequirements.bag', { defaultValue: 'Bag' }) : t('additionalRequirements.bags', { defaultValue: 'Bags' })}`,
                    },
                    ...(isSeniorCitizen ? [{
                      key: 'senior',
                      image: require('../../assets/images/senior-citizen-icon.png'),
                      imageStyle: { width: 22, height: 21, resizeMode: 'contain' as const, tintColor: 'rgb(22, 34, 50)' },
                      text: t('additionalRequirements.seniorCitizenChip', { defaultValue: 'Senior (60+)' }),
                    }] : []),
                    ...(needReturnJourney ? [{
                      key: 'return',
                      icon: 'swap-horizontal',
                      text: t('additionalRequirements.returnTripChip', { defaultValue: 'Return Later' }),
                    }] : []),
                    ...(needAirportDrop ? [{
                      key: 'airportDrop',
                      icon: 'airplane',
                      text: t('additionalRequirements.airportDropChip', { defaultValue: 'Airport Drop' }),
                    }] : []),
                    ...(needAirportPickup ? [{
                      key: 'airportPickup',
                      icon: 'airplane',
                      text: t('additionalRequirements.airportPickupChip', { defaultValue: 'Airport Pickup' }),
                    }] : []),
                    ...(isPetFriendly ? [{
                      key: 'pet',
                      icon: 'paw',
                      text: t('additionalRequirements.petChip', { defaultValue: `Pet (${petLabel})` }),
                    }] : []),
                    ...(isBabyOnBoard ? [{
                      key: 'baby',
                      image: require('../../assets/images/baby-on-board-icon.png'),
                      imageStyle: { width: 22, height: 21, resizeMode: 'contain' as const, tintColor: 'rgb(22, 34, 50)' },
                      text: t('additionalRequirements.babyOnBoardChip', { defaultValue: 'Baby on Board' }),
                    }] : []),
                    ...(isPregnancyFriendly ? [{
                      key: 'pregnancy',
                      image: require('../../assets/images/pregnancy-icon.png'),
                      imageStyle: { width: 21, height: 21, resizeMode: 'contain' as const, tintColor: 'rgb(22, 34, 50)' },
                      text: t('additionalRequirements.pregnancyChip', { defaultValue: 'Pregnancy' }),
                    }] : []),
                    ...(isHandicapped ? [{
                      key: 'handicap',
                      icon: 'accessibility' as any,
                      text: t('additionalRequirements.handicapChip', { defaultValue: 'Accessibility' }),
                    }] : []),
                    ...(((hasCarrierParam || params.hasCarrier !== 'false') && requestCarrier) ? [{
                      key: 'carrier',
                      image: require('../../assets/images/roof-carrier-icon.png'),
                      imageStyle: { width: 25, height: 21, resizeMode: 'contain' as const, tintColor: 'rgb(22, 34, 50)' },
                      text: `${t('additionalRequirements.carrierChip', { defaultValue: 'Roof Carrier' })} ✓`,
                    }] : []),
                    ...(pickupNotes.trim().length > 0 ? [{
                      key: 'notes',
                      icon: 'sparkles',
                      text: t('additionalRequirements.preferencesAdded', { defaultValue: 'Preferences Added' }),
                    }] : []),
                  ];

                  // Group into rows with maximum 4 items per row (matching 4-column grid)
                  const COLUMNS_PER_ROW = 4;
                  const rows: typeof summaryItems[] = [];
                  for (let i = 0; i < summaryItems.length; i += COLUMNS_PER_ROW) {
                    rows.push(summaryItems.slice(i, i + COLUMNS_PER_ROW));
                  }

                  return (
                    <View style={styles.requirementsSummaryContainer}>
                      {rows.map((row, rowIndex) => {
                        const emptySlotsCount = COLUMNS_PER_ROW - row.length;
                        return (
                          <View
                            key={rowIndex}
                            style={[
                              styles.summaryRow,
                              rowIndex > 0 && { marginTop: 10 },
                            ]}
                          >
                            {row.map((item) => (
                              <View key={item.key} style={styles.summaryChipItem}>
                                {item.image ? (
                                  <Image source={item.image} style={item.imageStyle} />
                                ) : (
                                  <Ionicons name={item.icon} size={22} color="rgb(22, 34, 50)" />
                                )}
                                <Text
                                  style={styles.summaryChipText}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit={true}
                                  minimumFontScale={0.7}
                                >
                                  {item.text}
                                </Text>
                              </View>
                            ))}
                            {emptySlotsCount > 0 &&
                              Array.from({ length: emptySlotsCount }).map((_, emptyIdx) => (
                                <View key={`empty-${emptyIdx}`} style={styles.summaryChipEmptySlot} />
                              ))}
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
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
                  {vehicleInfo.image ? (
                    <Image
                      source={vehicleInfo.image}
                      style={[
                        styles.topSummaryVehicleImage,
                        isSmallDevice && { width: 76, height: 48 },
                      ]}
                      resizeMode="contain"
                    />
                  ) : (
                    <View
                      style={[
                        styles.topSummaryVehicleImage,
                        isSmallDevice && { width: 76, height: 48 },
                        { alignItems: 'center', justifyContent: 'center' },
                      ]}
                    >
                      <Ionicons name="car-outline" size={24} color="#94a3b8" />
                    </View>
                  )}

                  {/* Middle: Vehicle Specs & Change Vehicle */}
                  <View style={[styles.topSummaryVehicleDetails, isSmallDevice && { paddingHorizontal: 4 }]}>
                    <Text
                      style={[styles.topSummaryVehicleName, isSmallDevice && { fontSize: 14 }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.8}
                    >
                      {customVehicleName}
                    </Text>

                    {/* Specs Icons */}
                    <View style={styles.topSummarySpecsRow}>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="person" size={13.5} color="#64748b" />
                        <Text style={styles.topSummarySpecText}>
                          {passengerCountParam || vehicleInfo.passengers} + 1
                        </Text>
                      </View>
                      <Text style={styles.topSummarySpecPipe}>|</Text>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="briefcase" size={13.5} color="#64748b" />
                        <Text style={styles.topSummarySpecText}>{vehicleInfo.luggage}</Text>
                      </View>
                      <Text style={styles.topSummarySpecPipe}>|</Text>
                      <View style={styles.topSummarySpecItem}>
                        <Ionicons name="snow" size={13.5} color="#64748b" />
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
                      <Ionicons name="chevron-forward" size={13.5} color="#2563eb" style={{ marginLeft: 2 }} />
                    </TouchableOpacity>
                  </View>

                  {/* Vertical Divider */}
                  <View style={styles.topSummaryVerticalLine} />

                  {/* Right: Fare Column */}
                  <View style={styles.topSummaryPriceCol}>
                    <Text
                      style={[styles.topSummaryPrice, isSmallDevice && { fontSize: 17 }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.8}
                    >
                      ₹ {totalFare.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.topSummaryGst} numberOfLines={1}>(Total Trip Fare)</Text>
                  </View>
                </View>

                {/* Horizontal Divider */}
                <View style={styles.topSummaryHorizontalLine} />

                {/* 2. Route Locations Row */}
                <View style={styles.topSummaryLocationsRow}>
                  {/* Pickup */}
                  <View style={styles.topSummaryLocationItem}>
                    <Ionicons name="location" size={18} color="#16a34a" style={{ marginRight: 5 }} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={styles.topSummaryLocationName}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {pickupCity}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Pickup Location</Text>
                    </View>
                  </View>

                  {/* Dashed Separator */}
                  <View style={styles.topSummaryArrowContainer}>
                    <Text style={styles.topSummaryArrowLine}>┄┄</Text>
                    <Ionicons name="arrow-forward" size={14} color="#94a3b8" />
                  </View>

                  {/* Drop */}
                  <View style={styles.topSummaryLocationItem}>
                    <Ionicons name="location" size={18} color="#ef4444" style={{ marginRight: 5 }} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={styles.topSummaryLocationName}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {dropCity}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Drop Location</Text>
                    </View>
                  </View>
                </View>

                {/* Inner Horizontal Divider */}
                <View style={styles.topSummaryInnerDivider} />

                {/* 3. Scheduled Date & Time Row (Arranged Below Locations, Non-Slidable) */}
                <View style={styles.topSummaryScheduleRow}>
                  {/* Pickup Date */}
                  <View style={styles.topSummaryScheduleItem}>
                    <Ionicons name="calendar-outline" size={16} color="rgb(22, 34, 50)" style={{ marginRight: 5 }} />
                    <View>
                      <Text
                        style={styles.topSummaryDateTimeText}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {displayPickupDate}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Pickup Date</Text>
                    </View>
                  </View>

                  {/* Vertical Divider */}
                  <View style={styles.topSummaryRouteDivider} />

                  {/* Pickup Time */}
                  <View style={styles.topSummaryScheduleItem}>
                    <Ionicons name="time-outline" size={18} color="rgb(22, 34, 50)" style={{ marginRight: 5 }} />
                    <View>
                      <Text
                        style={styles.topSummaryDateTimeText}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {displayPickupTime}
                      </Text>
                      <Text style={styles.topSummaryLocationSub}>Pickup Time</Text>
                    </View>
                  </View>

                  {/* Flight Number for Airport Transfer */}
                  {tripTypeParam === 'AIRPORT' && flightNumber.trim().length > 0 && (
                    <>
                      <View style={styles.topSummaryRouteDivider} />
                      <View style={styles.topSummaryScheduleItem}>
                        <Ionicons name="airplane" size={15} color="#0284c7" style={{ marginRight: 5 }} />
                        <View>
                          <Text style={styles.topSummaryDateTimeText} numberOfLines={1}>
                            {flightNumber.trim()}
                          </Text>
                          <Text style={styles.topSummaryLocationSub}>Flight No</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* 2. Passenger Details Card (With Edit Button) */}
              <View style={styles.passengerSummaryCard}>
                <View style={styles.passengerSummaryHeader}>
                  <View style={styles.passengerHeaderLeft}>
                    <Ionicons name="person" size={20} color="rgb(240, 117, 15)" />
                    <View style={{ marginLeft: 6 }}>
                      <Text style={styles.passengerSummaryTitle}>{t('passengerDetails.summaryTitle', { defaultValue: 'Passenger Details' })}</Text>
                      <Text style={styles.passengerSummarySub}>{t('passengerDetails.primaryContact', { defaultValue: 'Primary Contact' })}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.editPassengerBtn}
                    activeOpacity={0.7}
                    onPress={() => setStep(1)}
                  >
                    <Ionicons name="pencil" size={13} color="rgb(240, 117, 15)" />
                    <Text style={styles.editPassengerBtnText}>{t('passengerDetails.edit', { defaultValue: 'Edit' })}</Text>
                  </TouchableOpacity>
                </View>

                {/* 2x2 Grid */}
                <View style={styles.passengerGridContainer}>
                  <View style={styles.passengerGridRow}>
                    <View style={styles.passengerGridBox}>
                      <Text style={styles.passengerBoxLabel}>{t('passengerDetails.labelName', { defaultValue: 'PASSENGER NAME' })}</Text>
                      <Text style={styles.passengerBoxVal} numberOfLines={1}>
                        {passengerName.trim() || t('passengerDetails.notProvided', { defaultValue: 'Not Provided' })}
                      </Text>
                    </View>
                    <View style={styles.passengerGridBox}>
                      <Text style={styles.passengerBoxLabel}>{t('passengerDetails.labelPhone', { defaultValue: 'PHONE NUMBER' })}</Text>
                      <Text style={styles.passengerBoxVal} numberOfLines={1}>
                        {passengerPhone.trim() || t('passengerDetails.notProvided', { defaultValue: 'Not Provided' })}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.passengerGridRow, { marginTop: 6 }]}>
                    <View style={styles.passengerGridBox}>
                      <Text style={styles.passengerBoxLabel}>{t('passengerDetails.labelEmail', { defaultValue: 'EMAIL ADDRESS' })}</Text>
                      <Text style={styles.passengerBoxVal} numberOfLines={1}>
                        {passengerEmail.trim() || t('passengerDetails.notProvided', { defaultValue: 'Not Provided' })}
                      </Text>
                    </View>
                    <View style={styles.passengerGridBox}>
                      <Text style={styles.passengerBoxLabel}>{t('passengerDetails.labelAltPhone', { defaultValue: 'ALTERNATE PHONE' })}</Text>
                      <Text
                        style={[
                          styles.passengerBoxVal,
                          !alternatePhone.trim() && { color: '#94a3b8', fontWeight: '500' },
                        ]}
                        numberOfLines={1}
                      >
                        {alternatePhone.trim()
                          ? `+91 ${alternatePhone.replace(/\D/g, '').slice(-10)}`
                          : t('passengerDetails.notProvided', { defaultValue: 'Not Provided' })}
                      </Text>
                    </View>
                  </View>
                </View>

                {isPetFriendly && (
                  <>
                    <View style={styles.badgeDivider} />
                    <View style={styles.petBadgeRow}>
                      <Ionicons name="paw" size={14} color="rgb(240, 117, 15)" />
                      <Text style={styles.petBadgeText}>
                        {t('bookingReview.petBadge', { fee: petFee, pet: petLabel, defaultValue: `Ride Preference: Pet Friendly - ${petLabel} (+₹${petFee} applied)` })}
                      </Text>
                    </View>
                  </>
                )}

                {needReturnJourney && (
                  <>
                    <View style={styles.badgeDivider} />
                    <View style={styles.petBadgeRow}>
                      <Ionicons name="swap-horizontal" size={14} color="rgb(240, 117, 15)" />
                      <Text style={styles.petBadgeText}>
                        {t('bookingReview.returnJourneyBadge', { defaultValue: 'Trip Option: Return Journey Later Requested' })}
                      </Text>
                    </View>
                  </>
                )}

                {needAirportDrop && (
                  <>
                    <View style={styles.badgeDivider} />
                    <View style={styles.petBadgeRow}>
                      <Ionicons name="airplane" size={14} color="#0284c7" />
                      <Text style={[styles.petBadgeText, { color: '#0369a1' }]}>
                        {t('bookingReview.airportDropBadge', { defaultValue: 'Airport Service: Airport Drop Requested' })}
                      </Text>
                    </View>
                  </>
                )}

                {needAirportPickup && (
                  <>
                    <View style={styles.badgeDivider} />
                    <View style={styles.petBadgeRow}>
                      <Ionicons name="airplane" size={14} color="#16a34a" />
                      <Text style={[styles.petBadgeText, { color: '#15803d' }]}>
                        {t('bookingReview.airportPickupBadge', { defaultValue: 'Airport Service: Airport Pickup Requested' })}
                      </Text>
                    </View>
                  </>
                )}

                {tripTypeParam === 'AIRPORT' && flightNumber.trim().length > 0 && (
                  <>
                    <View style={styles.badgeDivider} />
                    <View style={styles.flightBadgeRow}>
                      <Ionicons name="airplane" size={14} color="#0284c7" />
                      <Text style={styles.flightBadgeText}>
                        {t('bookingReview.airportFlightBadge', { defaultValue: 'Airport Flight:' })}{' '}
                        <Text style={{ fontWeight: '800', color: '#0369a1' }}>{flightNumber.trim()}</Text>
                      </Text>
                    </View>
                  </>
                )}

                {alternateEmail.trim().length > 0 && (
                  <>
                    <View style={styles.badgeDivider} />
                    <View style={styles.altEmailBadgeRow}>
                      <Ionicons name="mail-outline" size={14} color="#2563eb" />
                      <Text style={styles.altEmailBadgeText}>
                        {t('bookingReview.alternateEmailBadge', { defaultValue: 'Alternate Email:' })}{' '}
                        <Text style={{ fontWeight: '800', color: '#1d4ed8' }}>{alternateEmail.trim()}</Text>
                      </Text>
                    </View>
                  </>
                )}

                {gstin.trim().length > 0 && (
                  <>
                    <View style={styles.badgeDivider} />
                    <View style={styles.gstBadgeRow}>
                      <Ionicons name="business" size={14} color="#4338ca" />
                      <Text style={styles.gstBadgeText}>
                        GSTIN: <Text style={{ fontWeight: '800', color: '#312e81' }}>{gstin.trim().toUpperCase()}</Text>
                        {companyName.trim() ? ` • ${companyName.trim()}` : ''}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* 3. Middle Two-Column Grid: Fare Breakdown (Left) & Includes/Excludes (Right) */}
              <View style={[styles.twoColContainer, isSmallDevice && { flexDirection: 'column', gap: 10 }]}>
                {/* Left Column: Fare Breakdown Card */}
                <View style={styles.fareBreakdownCol}>
                  <View style={styles.colHeaderRow}>
                    <Ionicons name="receipt-outline" size={16} color="rgb(240, 117, 15)" style={{ marginRight: 5 }} />
                    <Text style={styles.colHeaderTitle}>{t('bookingReview.fareBreakdown', { defaultValue: 'Fare Breakdown' })}</Text>
                  </View>

                  <View style={styles.fareLineItem}>
                    <Text style={styles.fareLineLabel}>
                      {t('bookingReview.distanceFare', { km: Math.max(vehicleInfo.minKm, estimatedKm), defaultValue: `Distance Fare (${Math.max(vehicleInfo.minKm, estimatedKm)} km)` })}
                    </Text>
                    <Text style={styles.fareLineVal}>₹ {baseEstimatedFare.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.fareLineItem}>
                    <Text style={styles.fareLineLabel}>{t('bookingReview.chauffeurAllowance', { defaultValue: 'Chauffeur Allowance' })}</Text>
                    <Text style={[styles.fareLineVal, { color: '#16a34a' }]}>{t('bookingReview.included', { defaultValue: 'Included' })}</Text>
                  </View>

                  <View style={styles.fareLineItem}>
                    <Text style={styles.fareLineLabel}>{t('bookingReview.tollAndStateTax', { defaultValue: 'Toll & State Tax' })}</Text>
                    <Text style={[styles.fareLineVal, { color: '#16a34a' }]}>{t('bookingReview.included', { defaultValue: 'Included' })}</Text>
                  </View>

                  {isPetFriendly && (
                    <View style={styles.fareLineItem}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1, marginRight: 4 }}>
                        <Ionicons name="paw" size={11} color="rgb(240, 117, 15)" />
                        <Text style={[styles.fareLineLabel, { color: 'rgb(240, 117, 15)', fontWeight: '700' }]}>
                          {t('bookingReview.petFriendlyFee', { defaultValue: `Pet Friendly Fee (${petLabel})` })}
                        </Text>
                      </View>
                      <Text style={[styles.fareLineVal, { color: 'rgb(240, 117, 15)', fontWeight: '800', flexShrink: 0 }]}>
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
                    <Text style={styles.fareLineLabelBold}>{t('bookingReview.subtotal', { defaultValue: 'Subtotal' })}</Text>
                    <Text style={styles.fareLineValBold}>₹ {subtotal.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.fareLineItem}>
                    <Text style={styles.fareLineLabel}>{t('bookingReview.gst', { defaultValue: 'GST (5%)' })}</Text>
                    <Text style={styles.fareLineVal}>₹ {gstAmount.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.twoColDivider} />

                  <View style={styles.fareLineItem}>
                    <Text style={styles.fareLineLabelBold}>{t('bookingReview.totalRideFare', { defaultValue: 'Total Ride Fare' })}</Text>
                    <Text style={styles.fareLineValBold}>₹ {totalFare.toLocaleString('en-IN')}</Text>
                  </View>

                  {/* Part Payment / Full Amount Payable Now Box */}
                  <View style={styles.partPaymentPill}>
                    <View style={{ flex: 1, marginRight: 4 }}>
                      <Text style={styles.partPaymentPillTitle}>
                        {paymentOption === 'FULL'
                          ? t('bookingReview.payableNowFull', { defaultValue: 'Payable Now (Full Amount):' })
                          : t('bookingReview.payableNowAdvance', { defaultValue: 'Payable Now (Advance):' })}
                      </Text>
                      <Text style={styles.partPaymentPillSub}>
                        {paymentOption === 'FULL'
                          ? t('bookingReview.zeroBalanceToDriver', { defaultValue: 'Zero balance to driver' })
                          : t('bookingReview.restToDriverLater', { amount: balanceAmount.toLocaleString('en-IN'), defaultValue: `Rest ₹${balanceAmount.toLocaleString('en-IN')} to driver later` })}
                      </Text>
                    </View>
                    <Text style={styles.partPaymentPillAmount}>₹ {payableAmount.toLocaleString('en-IN')}</Text>
                  </View>

                  {/* Optional Promo Code Toggle */}
                  <TouchableOpacity
                    style={{ marginTop: 6, alignSelf: 'flex-start' }}
                    activeOpacity={0.7}
                    onPress={() => setShowCouponInput((prev) => !prev)}
                  >
                    <Text style={{ fontSize: 9.5, color: '#2563eb', fontWeight: '700' }}>
                      {couponApplied
                        ? t('bookingReview.promoApplied', { code: couponCode, defaultValue: `Promo Applied: ${couponCode} (Edit)` })
                        : showCouponInput
                        ? t('bookingReview.hidePromoCode', { defaultValue: 'Hide Promo Code' })
                        : t('bookingReview.applyPromoCoupon', { defaultValue: '+ Apply Promo / Coupon Code' })}
                    </Text>
                  </TouchableOpacity>

                  {showCouponInput && (
                    <View style={{ marginTop: 5 }}>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TextInput
                          style={{
                            flex: 1,
                            borderWidth: 1,
                            borderColor: couponApplied ? '#86efac' : '#cbd5e1',
                            borderRadius: 6,
                            paddingHorizontal: 6,
                            paddingVertical: 3,
                            fontSize: 10,
                            fontWeight: '700',
                            backgroundColor: couponApplied ? '#f0fdf4' : '#ffffff',
                            color: 'rgb(22, 34, 50)',
                          }}
                          placeholder={t('bookingReview.tryCouponPlaceholder', { defaultValue: 'Try WELCOME100, KANDY15' })}
                          placeholderTextColor="#94a3b8"
                          autoCapitalize="characters"
                          editable={!couponApplied}
                          value={couponCode}
                          onChangeText={(txt) => {
                            setCouponCode(txt);
                            if (couponApplied) {
                              setCouponApplied(false);
                              setCouponDiscount(0);
                              setCouponMsg('');
                            }
                          }}
                        />
                        {couponApplied ? (
                          <TouchableOpacity
                            style={{
                              backgroundColor: '#fee2e2',
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              justifyContent: 'center',
                              borderWidth: 1,
                              borderColor: '#fca5a5',
                            }}
                            onPress={handleRemoveCoupon}
                          >
                            <Text style={{ color: '#b91c1c', fontSize: 10, fontWeight: '700' }}>
                              ✕ Remove
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={{
                              backgroundColor: isApplyingCoupon ? '#cbd5e1' : 'rgb(240, 117, 15)',
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              justifyContent: 'center',
                            }}
                            disabled={isApplyingCoupon}
                            onPress={handleApplyCoupon}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }}>
                              {isApplyingCoupon ? '...' : t('bookingReview.apply', { defaultValue: 'Apply' })}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {couponMsg ? (
                        <Text style={{ fontSize: 8.5, color: couponApplied ? '#16a34a' : '#dc2626', marginTop: 2, fontWeight: couponApplied ? '700' : '500' }}>
                          {couponMsg}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>

                {/* Right Column: Includes & Excludes Card */}
                <View style={styles.includesExcludesCol}>
                  {/* Includes Section */}
                  <View style={styles.incExcSection}>
                    <View style={styles.incHeaderRow}>
                      <Ionicons name="checkmark-circle" size={15} color="#16a34a" style={{ marginRight: 5 }} />
                      <Text style={styles.incHeaderTitle}>{t('bookingReview.includes', { defaultValue: 'Includes' })}</Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="checkmark" size={13} color="#16a34a" style={styles.bulletIcon} />
                      <Text style={styles.bulletText} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                        {t('bookingReview.fuelCharges', { defaultValue: 'Fuel Charges' })}
                      </Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="checkmark" size={13} color="#16a34a" style={styles.bulletIcon} />
                      <Text style={styles.bulletText} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                        {t('bookingReview.chauffeurAllowance', { defaultValue: 'Chauffeur Allowance' })}
                      </Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="checkmark" size={13} color="#16a34a" style={styles.bulletIcon} />
                      <Text style={styles.bulletText} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                        {t('bookingReview.kmsLimit', { km: Math.max(vehicleInfo.minKm, estimatedKm), defaultValue: `${Math.max(vehicleInfo.minKm, estimatedKm)} Kms Limit` })}
                      </Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="checkmark" size={13} color="#16a34a" style={styles.bulletIcon} />
                      <Text style={styles.bulletText} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                        {t('bookingReview.gstIncluded', { defaultValue: '5% GST Included' })}
                      </Text>
                    </View>
                    {isPetFriendly && (
                      <View style={styles.bulletItem}>
                        <Ionicons name="paw" size={13} color="#16a34a" style={styles.bulletIcon} />
                        <Text style={[styles.bulletText, { color: '#16a34a', fontWeight: '700' }]} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                          {t('bookingReview.petFriendlyRide', { defaultValue: `Pet Friendly Ride (${petLabel})` })}
                        </Text>
                      </View>
                    )}
                    {isSeniorCitizen && (
                      <View style={styles.bulletItem}>
                        <Image
                          source={require('../../assets/images/senior-citizen-icon.png')}
                          style={{ width: 14, height: 14, resizeMode: 'contain', tintColor: '#16a34a', marginRight: 5 }}
                        />
                        <Text style={[styles.bulletText, { color: '#16a34a', fontWeight: '700' }]} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                          {t('bookingReview.seniorCitizenRide', { defaultValue: 'Senior Citizen (60+ Assistance)' })}
                        </Text>
                      </View>
                    )}
                    {isBabyOnBoard && (
                      <View style={styles.bulletItem}>
                        <Image
                          source={require('../../assets/images/baby-on-board-icon.png')}
                          style={{ width: 14, height: 14, resizeMode: 'contain', tintColor: '#16a34a', marginRight: 5 }}
                        />
                        <Text style={[styles.bulletText, { color: '#16a34a', fontWeight: '700' }]} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                          {t('bookingReview.babyOnBoardRide', { defaultValue: 'Baby on Board (Child Safety)' })}
                        </Text>
                      </View>
                    )}
                    {isPregnancyFriendly && (
                      <View style={styles.bulletItem}>
                        <Image
                          source={require('../../assets/images/pregnancy-icon.png')}
                          style={{ width: 14, height: 14, resizeMode: 'contain', tintColor: '#16a34a', marginRight: 5 }}
                        />
                        <Text style={[styles.bulletText, { color: '#16a34a', fontWeight: '700' }]} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                          {t('bookingReview.pregnancyRide', { defaultValue: 'Pregnancy Care (Smooth Drive)' })}
                        </Text>
                      </View>
                    )}
                    {isHandicapped && (
                      <View style={styles.bulletItem}>
                        <FontAwesome5 name="wheelchair" size={13} color="#16a34a" style={{ marginRight: 5 }} />
                        <Text style={[styles.bulletText, { color: '#16a34a', fontWeight: '700' }]} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                          {t('bookingReview.handicapRide', { defaultValue: 'Accessibility Assistance' })}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.twoColDivider} />

                  {/* Excludes Section */}
                  <View style={styles.incExcSection}>
                    <View style={styles.excHeaderRow}>
                      <Ionicons name="alert-circle" size={15} color="#dc2626" style={{ marginRight: 5 }} />
                      <Text style={styles.excHeaderTitle}>{t('bookingReview.excludes', { defaultValue: 'Excludes' })}</Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="close" size={13} color="#dc2626" style={styles.bulletIcon} />
                      <Text style={styles.bulletText} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                        {t('bookingReview.extraKmsRate', { rate: customRatePerKm, defaultValue: `Extra Kms @ ₹${customRatePerKm}/km` })}
                      </Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="close" size={13} color="#dc2626" style={styles.bulletIcon} />
                      <Text style={styles.bulletText} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                        {t('bookingReview.tollAndParking', { defaultValue: 'Toll & Parking' })}
                      </Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="close" size={13} color="#dc2626" style={styles.bulletIcon} />
                      <Text style={styles.bulletText} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                        {t('bookingReview.nightAllowance', { defaultValue: 'Night Allowance' })}
                      </Text>
                    </View>
                    <View style={styles.bulletItem}>
                      <Ionicons name="close" size={13} color="#dc2626" style={styles.bulletIcon} />
                      <Text style={styles.bulletText} numberOfLines={2} adjustsFontSizeToFit={true} minimumFontScale={0.82}>
                        {t('bookingReview.multiCityEntries', { defaultValue: 'Multi-City Entries' })}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Large Fleet Availability Notice for Tempo Traveller / Force Urbania */}
              {isLargeFleetApproval && (
                <View style={styles.fleetApprovalReviewCard}>
                  <View style={styles.fleetApprovalHeaderRow}>
                    <View style={styles.fleetApprovalIconCircle}>
                      <Ionicons name="bus" size={18} color="#b45309" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fleetApprovalTitle}>No Advance Payment Required Now</Text>
                      <Text style={styles.fleetApprovalSub}>Zero upfront charge at checkout</Text>
                    </View>
                  </View>
                  <Text style={styles.fleetApprovalBodyText}>
                    Because this is a large group vehicle ({vehicleInfo.name}), we will verify fleet availability with our manager.
                    Once approved by Admin, you will be notified to pay the advance of ₹{advanceAmount.toLocaleString('en-IN')} directly from your <Text style={{ fontWeight: '700', color: 'rgb(240, 117, 15)' }}>My Bookings</Text> page.
                  </Text>
                </View>
              )}

              {/* Terms & Conditions Checkbox & Trust Badge */}
              <View style={styles.reviewTermsContainer}>
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
                    {agreedToTerms && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                  </View>
                  <Text style={styles.termsText}>
                    {t('bookingReview.iAgreeToThe', { defaultValue: 'I agree to the' })}{' '}
                    <Text
                      style={{ color: 'rgb(240, 117, 15)', fontWeight: '700', textDecorationLine: 'underline' }}
                      onPress={() => router.push('/terms')}
                    >
                      {t('bookingReview.termsAndConditions', { defaultValue: 'Terms & Conditions' })}
                    </Text>{' '}
                    {t('bookingReview.and', { defaultValue: 'and' })}{' '}
                    <Text
                      style={{ color: 'rgb(240, 117, 15)', fontWeight: '700', textDecorationLine: 'underline' }}
                      onPress={() => router.push('/terms')}
                    >
                      {t('bookingReview.cancellationPolicy', { defaultValue: 'Cancellation Policy' })}
                    </Text>
                    .
                  </Text>
                </TouchableOpacity>

                <View style={styles.trustBadgeRow}>
                  <Ionicons name="shield-checkmark" size={15} color="#2563eb" style={{ marginRight: 6 }} />
                  <Text style={styles.trustBadgeText}>
                    {t('bookingReview.safeAndSecureCheckout', { defaultValue: 'Safe & Secure 256-bit SSL encrypted checkout' })}
                  </Text>
                </View>
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
                  {/* Celebration Icon */}
                  <View style={styles.celebrationWrapper}>
                    <View style={styles.successIconCircle}>
                      <Ionicons name="checkmark" size={24} color="#ffffff" />
                    </View>
                  </View>

                  {/* Booking Reference Pill */}
                  <View style={styles.refContainer}>
                    <Text style={styles.refPillLabel}>
                      {t('bookingConfirmation.referenceLabel', { defaultValue: 'Booking Reference' })}
                    </Text>
                    <View style={styles.refPill}>
                      <Text style={styles.refPillValue} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                        {confirmedBooking.humanReadableRef}
                      </Text>
                    </View>
                  </View>

                  {/* 4-Digit Pickup OTP Card (Matching Reference Layout) */}
                  {confirmedBooking.pickupOtp && (
                    <View style={styles.pickupOtpBox}>
                      <View style={styles.otpHeaderRow}>
                        <Ionicons name="key" size={17} color="rgb(240, 117, 15)" />
                        <Text style={styles.otpHeaderTitle}>
                          {t('bookingConfirmation.otpHeaderTitle', { defaultValue: 'Your 4-Digit Pickup OTP' })}
                        </Text>
                      </View>

                      <View style={styles.otpBoxesRow}>
                        {String(confirmedBooking.pickupOtp)
                          .replace(/\D/g, '')
                          .padEnd(4, '0')
                          .slice(0, 4)
                          .split('')
                          .map((digit, idx) => (
                            <View key={idx} style={[styles.otpDigitCard, isSmallDevice && { width: 44, height: 50 }]}>
                              <Text style={styles.otpDigitValue}>{digit}</Text>
                            </View>
                          ))}
                      </View>

                      <Text style={styles.otpInstructions}>
                        {t('bookingConfirmation.otpInstructions', {
                          defaultValue: 'Please share this code with your driver partner only when they arrive at pickup.',
                        })}
                      </Text>
                    </View>
                  )}

                  {/* Trip Details Summary */}
                  <View style={styles.confirmedDetailsBox}>
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>
                        {t('bookingConfirmation.vehicleLabel', { defaultValue: 'Vehicle:' })}
                      </Text>
                      <Text style={styles.confirmedValue} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                        {vehicleInfo.name}
                      </Text>
                    </View>
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>
                        {t('bookingConfirmation.routeLabel', { defaultValue: 'Route:' })}
                      </Text>
                      <Text style={styles.confirmedValue} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                        {pickup} ➔ {drop}
                      </Text>
                    </View>
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>
                        {t('bookingConfirmation.scheduledDateLabel', { defaultValue: 'Scheduled Date:' })}
                      </Text>
                      <Text style={styles.confirmedValue} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                        {pickupDate} {t('bookingConfirmation.at', { defaultValue: 'at' })} {pickupTime}
                      </Text>
                    </View>
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>
                        {t('bookingConfirmation.passengerLabel', { defaultValue: 'Passenger:' })}
                      </Text>
                      <Text style={styles.confirmedValue} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                        {passengerName ? `${passengerName} (${passengerPhone.replace(/^\+91\s*/, '').replace(/^\+91/, '').trim() ? `+91 ${passengerPhone.replace(/^\+91\s*/, '').replace(/^\+91/, '').trim()}` : ''})` : passengerPhone}
                      </Text>
                    </View>
                    <View style={styles.confirmedDivider} />
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>
                        {t('bookingConfirmation.advanceStatusLabel', { defaultValue: 'Advance Status:' })}
                      </Text>
                      <Text style={[styles.confirmedValue, { color: isLargeFleetApproval ? '#b45309' : '#16a34a', fontWeight: '800' }]} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                        {isLargeFleetApproval
                          ? `₹${confirmedBooking.advanceAmount} (Pay after Admin Approval)`
                          : (confirmedBooking.advanceAmount > 0
                            ? `₹${confirmedBooking.advanceAmount} ${t('bookingConfirmation.paid', { defaultValue: '(PAID)' })}`
                            : t('bookingConfirmation.payAtDrop', { defaultValue: 'Pay at Drop' }))}
                      </Text>
                    </View>
                    <View style={styles.confirmedRow}>
                      <Text style={styles.confirmedLabel}>
                        {t('bookingConfirmation.balanceDueLabel', { defaultValue: 'Balance Due on Trip:' })}
                      </Text>
                      <Text style={[styles.confirmedValue, { fontWeight: '800', color: 'rgb(22, 34, 50)' }]} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                        ₹{confirmedBooking.balanceAmount}
                      </Text>
                    </View>
                  </View>

                  {/* Dispatch Status Notice */}
                  <View style={[styles.dispatchNoticeBox, isLargeFleetApproval && { backgroundColor: '#fffbeb', borderColor: '#fef3c7' }]}>
                    <Ionicons name={isLargeFleetApproval ? 'hourglass-outline' : 'navigate'} size={18} color={isLargeFleetApproval ? '#b45309' : 'rgb(22, 34, 50)'} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dispatchNoticeTitle, isLargeFleetApproval && { color: '#92400e' }]}>
                        {isLargeFleetApproval
                          ? 'Checking Fleet Availability'
                          : t('bookingConfirmation.dispatchTitle', { defaultValue: 'Driver Partner Assignment' })}
                      </Text>
                      <Text style={[styles.dispatchNoticeDesc, isLargeFleetApproval && { color: '#78350f' }]}>
                        {isLargeFleetApproval
                          ? 'Kindly await admin verification. Once fleet availability is approved, you will be notified to complete payment from My Bookings.'
                          : t('bookingConfirmation.dispatchDesc', {
                              defaultValue: 'Our dispatch system has notified admin. Driver details & vehicle plate number will appear in your rides dashboard.',
                            })}
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
                    <Text style={styles.viewMyRidesBtnText} numberOfLines={1} adjustsFontSizeToFit={true}>
                      {t('bookingConfirmation.trackRideInMyBookings', { defaultValue: 'Track Ride in My Bookings' })}
                    </Text>
                    <Ionicons name="arrow-forward" size={15} color="#ffffff" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.backHomeBtn}
                    onPress={() => router.replace('/')}
                  >
                    <Text style={styles.backHomeBtnText} numberOfLines={1} adjustsFontSizeToFit={true}>
                      {t('bookingConfirmation.backToHome', { defaultValue: 'Back to Home' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {step === 1 && <View style={{ height: 16 }} />}
        </ScrollView>

        {/* Sticky Bottom Bar for Step 1: Info Notice + Continue CTA */}
        {step === 1 && (
          <View style={[styles.stickyBottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {/* Info Notice Banner */}
            <View style={[styles.infoNoticeBanner, isLargeFleetApproval && { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
              <Ionicons
                name={isLargeFleetApproval ? "hourglass-outline" : "information-circle"}
                size={19}
                color={isLargeFleetApproval ? "#b45309" : "#2563eb"}
                style={styles.infoNoticeIcon}
              />
              <Text style={[styles.infoNoticeText, isLargeFleetApproval && { color: '#92400e' }]}>
                {isLargeFleetApproval
                  ? 'No advance payment needed now. Verify your passenger details to send booking approval request.'
                  : t('passengerDetails.passengerNotice', { defaultValue: 'Please ensure all passenger details are correct. These details will be used for communication regarding your booking.' })}
              </Text>
            </View>

            {/* Bottom CTA: Continue to Review & Pay / Send Booking Approval Request */}
            <TouchableOpacity
              style={styles.continueToReviewBtn}
              activeOpacity={0.85}
              onPress={handleProceedToStep2}
            >
              <Text style={styles.continueToReviewText} numberOfLines={1} adjustsFontSizeToFit={true}>
                {isLargeFleetApproval
                  ? t('passengerDetails.sendBookingApproval', { defaultValue: 'Send Booking Approval Request' })
                  : t('passengerDetails.continueToReview', { defaultValue: 'Continue to Review & Pay' })}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        )}

        {/* Sticky Bottom Bar for Step 2: MakeMyTrip / Savaari style with Top Info Strip, 2 Payment Options & Orange PAY NOW */}
        {step === 2 && (
          <View style={styles.stickyBottomWrapper}>
            {/* Top Info Strip: Mint / Teal bar */}
            <View style={styles.stickyTopStrip}>
              <Text style={styles.stickyTopStripText} numberOfLines={1}>
                {isLargeFleetApproval
                  ? 'No advance required now • Pay from My Bookings upon admin approval'
                  : (paymentOption === 'FULL'
                    ? t('bookingReview.payNowZeroBalance', { amount: totalFare.toLocaleString('en-IN'), defaultValue: `Pay ₹${totalFare.toLocaleString('en-IN')} now, zero balance to the driver` })
                    : t('bookingReview.payNowRestToDriver', { advance: advanceAmount.toLocaleString('en-IN'), balance: balanceAmount.toLocaleString('en-IN'), defaultValue: `Pay ₹${advanceAmount.toLocaleString('en-IN')} now, to reserve, rest ₹${balanceAmount.toLocaleString('en-IN')} to the driver` }))}
              </Text>
              <TouchableOpacity
                style={styles.stickyFareBreakupBtn}
                activeOpacity={0.7}
                onPress={() => {
                  scrollRef.current?.scrollTo({ y: 260, animated: true });
                }}
              >
                <Text style={styles.stickyFareBreakupText}>{t('bookingReview.fareBreakup', { defaultValue: 'Fare breakup' })}</Text>
                <Ionicons name="chevron-up" size={13} color="#0284c7" />
              </TouchableOpacity>
            </View>

            {/* Bottom Actions Row */}
            <View style={[styles.stickyBottomBarMmt, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              {isLargeFleetApproval ? (
                <View style={styles.stickyActionsRow}>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="hourglass" size={12} color="#b45309" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309' }}>
                        Advance on Approval
                      </Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: 'rgb(22, 34, 50)' }}>
                      ₹{advanceAmount.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.stickyPayNowBtn,
                      !agreedToTerms && styles.stickyPayNowBtnDisabled,
                      submitting && { opacity: 0.7 },
                      { flex: 1.8, backgroundColor: '#16a34a', shadowColor: '#16a34a' }
                    ]}
                    activeOpacity={agreedToTerms ? 0.85 : 0.6}
                    onPress={handleConfirmBooking}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Text style={styles.stickyPayNowTitle} numberOfLines={1}>
                          Submit Request
                        </Text>
                        <Ionicons name="arrow-forward" size={15} color="#ffffff" />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.stickyActionsRow}>
                  {/* Option 1: 30% Advance */}
                  <TouchableOpacity
                    style={[
                      styles.stickyOptionBtn,
                      paymentOption === 'PART' && styles.stickyOptionBtnActive,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => setPaymentOption('PART')}
                  >
                    <Text
                      style={[
                        styles.stickyOptionLabel,
                        paymentOption === 'PART' && styles.stickyOptionLabelActive,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.75}
                    >
                      {t('bookingReview.payAdvance', { defaultValue: 'Pay Advance' })}
                    </Text>
                    <Text
                      style={[
                        styles.stickyOptionAmount,
                        paymentOption === 'PART' && styles.stickyOptionAmountActive,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.75}
                    >
                      ₹{advanceAmount.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>

                  {/* Option 2: Full Amount */}
                  <TouchableOpacity
                    style={[
                      styles.stickyOptionBtn,
                      paymentOption === 'FULL' && styles.stickyOptionBtnActive,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => setPaymentOption('FULL')}
                  >
                    <Text
                      style={[
                        styles.stickyOptionLabel,
                        paymentOption === 'FULL' && styles.stickyOptionLabelActive,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.75}
                    >
                      {t('bookingReview.payFull', { defaultValue: 'Pay Full' })}
                    </Text>
                    <Text
                      style={[
                        styles.stickyOptionAmount,
                        paymentOption === 'FULL' && styles.stickyOptionAmountActive,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.75}
                    >
                      ₹{totalFare.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>

                  {/* PAY NOW CTA Button */}
                  <TouchableOpacity
                    style={[
                      styles.stickyPayNowBtn,
                      !agreedToTerms && styles.stickyPayNowBtnDisabled,
                      submitting && { opacity: 0.7 },
                    ]}
                    activeOpacity={agreedToTerms ? 0.85 : 0.6}
                    onPress={handleConfirmBooking}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <View style={styles.stickyPayNowInner}>
                        <Text style={styles.stickyPayNowTitle} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                          {t('bookingReview.payNow', { defaultValue: 'PAY NOW' })}
                        </Text>
                        <Text style={styles.stickyPayNowAmount} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                          ₹{payableAmount.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
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
              <Ionicons name="briefcase" size={20} color="rgb(240, 117, 15)" />
              <Text style={styles.modalTitle}>Luggage Details</Text>
            </View>
            <Text style={styles.modalSub}>Select estimated luggage for your trip</Text>

            {['No Luggage', 'Small', 'Medium', 'Large', 'Extra Large'].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.luggageOptionItem,
                  (opt === 'No Luggage' ? totalLuggageBags === 0 : selectedLuggageSummary.includes(opt)) &&
                    styles.luggageOptionSelected,
                ]}
                onPress={() => {
                  if (opt === 'No Luggage') {
                    handleClearAllLuggage();
                  } else {
                    const optId =
                      opt === 'Small'
                        ? 'small'
                        : opt === 'Medium'
                        ? 'medium'
                        : opt === 'Large'
                        ? 'large'
                        : 'extraLarge';
                    handleIncrementLuggage(optId);
                  }
                  setShowLuggageModal(false);
                }}
              >
                <Text
                  style={[
                    styles.luggageOptionText,
                    (opt === 'No Luggage' ? totalLuggageBags === 0 : selectedLuggageSummary.includes(opt)) &&
                      styles.luggageOptionTextSelected,
                  ]}
                >
                  {opt}
                </Text>
                {(opt === 'No Luggage' ? totalLuggageBags === 0 : selectedLuggageSummary.includes(opt)) && (
                  <Ionicons name="checkmark-circle" size={18} color="rgb(240, 117, 15)" />
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

      {/* Additional Requirements Slide-Up Bottom Sheet Modal (Matching Reference Mockups) */}
      <Modal
        visible={showRequirementsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRequirementsModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetOverlay}
        >
          {/* Semi-transparent backdrop */}
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowRequirementsModal(false)}
          />

          {/* Slide-Up Bottom Sheet Container */}
          <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandleBar} />

            {/* Modal Header */}
            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetHeaderTitle}>{t('additionalRequirements.title', { defaultValue: 'Additional Requirements' })}</Text>
                <Text style={styles.sheetHeaderSub}>
                  {t('additionalRequirements.subtitle', { defaultValue: 'Select travellers, luggage & ride preferences' })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setShowRequirementsModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Modal Content */}
            <ScrollView
              ref={sheetScrollRef}
              style={styles.sheetScrollView}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Passengers & Luggage Card (Matching Reference Image 1) */}
              <View style={styles.sheetCardSection}>
                {/* Passengers Row */}
                <View style={styles.passengerRow}>
                  <View style={styles.passengerTextGroup}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="people" size={18} color="rgb(240, 117, 15)" />
                      <Text style={styles.cardSectionTitle}>{t('additionalRequirements.passengers', { defaultValue: 'Travellers' })}</Text>
                    </View>
                    <Text style={styles.cardSectionSubtitle}>
                      {t('additionalRequirements.seatsSelected', {
                        count: passengerCount,
                        max: maxSeatsParam,
                        defaultValue: `${passengerCount} of max ${maxSeatsParam} seats selected`
                      })}
                    </Text>
                  </View>

                  <View style={styles.passengerStepperContainer}>
                    <TouchableOpacity
                      style={[styles.stepperBtn, passengerCount <= 0 && styles.stepperBtnDisabled]}
                      onPress={handleDecrementPassengers}
                      disabled={passengerCount <= 0}
                      activeOpacity={0.6}
                    >
                      <Ionicons
                        name="remove"
                        size={16}
                        color={passengerCount <= 0 ? '#cbd5e1' : '#64748b'}
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
                        color={passengerCount >= maxSeatsParam ? '#cbd5e1' : 'rgb(240, 117, 15)'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                {/* Luggage 2x2 Grid: Small, Medium, Large, Extra Large */}
                <View style={styles.luggageSection}>
                  {/* Top Block: Big Icon on the Left, [Luggage Load + Dropdown Bar] on the Right */}
                  <View style={styles.luggageTopRowContainer}>
                    {/* Big Luggage Icon on the Left (Matching Reference Image) */}
                    <TouchableOpacity
                      style={styles.luggageBigIconBox}
                      onPress={() => setIsLuggageDropdownOpen((prev) => !prev)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={require('../../assets/images/luggage-two-suitcases.png')}
                        style={styles.luggageBigIcon}
                      />
                    </TouchableOpacity>

                    {/* Right Side: Luggage Load Header + Dropdown Bar */}
                    <View style={styles.luggageRightCol}>
                      {/* Header Row: Luggage Load + Clear Button */}
                      <View style={styles.luggageHeaderRowCompact}>
                        <Text style={styles.cardSectionTitle}>{t('additionalRequirements.luggageLoad', { defaultValue: 'Luggage Load' })}</Text>
                        {totalLuggageBags > 0 && (
                          <TouchableOpacity
                            onPress={handleClearAllLuggage}
                            style={styles.clearLuggageBtn}
                            activeOpacity={0.7}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={styles.clearLuggageBtnText}>{t('additionalRequirements.clear', { defaultValue: 'Clear' })}</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Dropdown Bar */}
                      <TouchableOpacity
                        style={[
                          styles.luggageDropdownBar,
                          isLuggageDropdownOpen && styles.luggageDropdownBarActive,
                        ]}
                        onPress={() => setIsLuggageDropdownOpen((prev) => !prev)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1, paddingRight: 4 }}>
                          <Text
                            style={styles.luggageDropdownBarMainText}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {selectedLuggageList.length > 0
                              ? selectedLuggageList
                                  .map((s) => `${luggageCounts[s.id]} ${t(`additionalRequirements.luggage.${s.id}.short`, { defaultValue: s.shortLabel })}`)
                                  .join(', ')
                              : t('additionalRequirements.selectBagsPlaceholder', { defaultValue: 'Select Bags (Small, Medium, Large...)' })}
                          </Text>
                          <Text style={styles.luggageDropdownBarSubText} numberOfLines={1}>
                            {selectedLuggageList.length > 0
                              ? t('additionalRequirements.bagsSelectedCount', {
                                  count: totalLuggageBags,
                                  defaultValue: `Total ${totalLuggageBags} ${totalLuggageBags === 1 ? 'bag' : 'bags'} selected • Tap to edit`
                                })
                              : t('additionalRequirements.selectBagsSub', { defaultValue: 'Tap to choose multiple bag types & quantities' })}
                          </Text>
                        </View>
                        <Ionicons
                          name={isLuggageDropdownOpen ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color="rgb(22, 34, 50)"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Exceeded Luggage Warning Banner */}
                  {currentLuggageCheck.exceeded && (
                    <TouchableOpacity
                      style={styles.luggageExceededBanner}
                      onPress={handleGoToSpecialNotes}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="alert-circle" size={18} color="#c2410c" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.luggageExceededBannerTitle}>
                          {t('additionalRequirements.luggageExceededBannerTitle', { defaultValue: 'Extra Luggage Notice' })}
                        </Text>
                        <Text style={styles.luggageExceededBannerText}>
                          {t('additionalRequirements.luggageExceededBanner', { defaultValue: 'Selected luggage exceeds cab boot space. Kindly write your requirement in Special Notes so our team can assist.' })}
                        </Text>
                      </View>
                      <Text style={styles.luggageExceededBannerBtn}>
                        {t('additionalRequirements.addNotesBtn', { defaultValue: 'Add Notes' })} →
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Dropdown Options List */}
                  {isLuggageDropdownOpen && (
                    <View style={styles.luggageDropdownListCard}>
                      {LUGGAGE_OPTIONS.map((item) => {
                        const count = luggageCounts[item.id];
                        const isSelected = count > 0;
                        return (
                          <View
                            key={item.id}
                            style={[
                              styles.luggageDropdownItemRow,
                              isSelected && styles.luggageDropdownItemRowSelected,
                            ]}
                          >
                            <TouchableOpacity
                              style={styles.luggageDropdownImageTouchable}
                              onPress={() => {
                                if (count === 0) {
                                  handleIncrementLuggage(item.id);
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={[styles.luggageVectorBadge, isSelected && styles.luggageVectorBadgeSelected]}>
                                {item.image ? (
                                  <Image
                                    source={item.image}
                                    style={styles.luggageBadgeIcon}
                                    resizeMode="contain"
                                  />
                                ) : (
                                  <MaterialCommunityIcons
                                    name={item.iconName}
                                    size={28}
                                    color={isSelected ? '#ea580c' : 'rgb(240, 117, 15)'}
                                  />
                                )}
                              </View>
                            </TouchableOpacity>

                            <View style={styles.luggageDropdownDetailsCol}>
                              <TouchableOpacity
                                onPress={() => {
                                  if (count === 0) {
                                    handleIncrementLuggage(item.id);
                                  }
                                }}
                                activeOpacity={0.8}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text
                                    style={[
                                      styles.luggageDropdownItemTitle,
                                      isSelected && styles.luggageDropdownItemTitleSelected,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {t(`additionalRequirements.luggage.${item.id}.label`, { defaultValue: item.label })}
                                  </Text>
                                  {isSelected && (
                                    <Ionicons name="checkmark-circle" size={15} color="#16a34a" />
                                  )}
                                </View>
                                <Text style={styles.luggageDropdownItemDesc}>
                                  {t(`additionalRequirements.luggage.${item.id}.desc`, { defaultValue: item.description })}
                                </Text>
                              </TouchableOpacity>

                              {/* Action: "+ Add" button or Stepper below the content */}
                              <View style={styles.luggageDropdownActionRow}>
                                {isSelected ? (
                                  <View style={styles.dropdownStepperGroup}>
                                    <TouchableOpacity
                                      style={styles.stepperMiniBtn}
                                      onPress={() => handleDecrementLuggage(item.id)}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      activeOpacity={0.6}
                                    >
                                      <Ionicons name="remove" size={14} color="#334155" />
                                    </TouchableOpacity>

                                    <View style={styles.stepperMiniCountBox}>
                                      <Text style={styles.stepperMiniCountText}>{count}</Text>
                                      <Text style={styles.stepperMiniCountUnit}>
                                        {count === 1 ? t('additionalRequirements.bag', { defaultValue: 'bag' }) : t('additionalRequirements.bags', { defaultValue: 'bags' })}
                                      </Text>
                                    </View>

                                    <TouchableOpacity
                                      style={[
                                        styles.stepperMiniBtn,
                                        totalLuggageBags >= MAX_LUGGAGE_BAGS &&
                                          styles.stepperMiniBtnDisabled,
                                      ]}
                                      onPress={() => handleIncrementLuggage(item.id)}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      activeOpacity={0.6}
                                    >
                                      <Ionicons
                                        name="add"
                                        size={14}
                                        color={
                                          totalLuggageBags >= MAX_LUGGAGE_BAGS
                                            ? '#cbd5e1'
                                            : '#334155'
                                        }
                                      />
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <TouchableOpacity
                                    style={[
                                      styles.addLuggageMiniBtn,
                                      totalLuggageBags >= MAX_LUGGAGE_BAGS &&
                                        styles.addLuggageMiniBtnDisabled,
                                    ]}
                                    onPress={() => handleIncrementLuggage(item.id)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons
                                      name="add"
                                      size={13}
                                      color={
                                        totalLuggageBags >= MAX_LUGGAGE_BAGS
                                          ? '#94a3b8'
                                          : 'rgb(22, 34, 50)'
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
                                      {t('additionalRequirements.add', { defaultValue: 'Add' })}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })}

                      {/* Done / Collapse Button */}
                      <TouchableOpacity
                        style={styles.closeLuggageDropdownBtn}
                        onPress={() => setIsLuggageDropdownOpen(false)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.closeLuggageDropdownBtnText}>{t('common.done', { defaultValue: 'Done' })}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Viewable in 1 Row: Selected Bags with Divider Lines (No square blue bg) */}
                  {!isLuggageDropdownOpen && selectedLuggageList.length > 0 && (
                    <View style={styles.selectedLuggageItemsRow}>
                      {selectedLuggageList.map((item, index) => {
                        const count = luggageCounts[item.id];
                        return (
                          <React.Fragment key={`sel-row-${item.id}`}>
                            {index > 0 && <View style={styles.selectedLuggageDivider} />}
                            <TouchableOpacity
                              style={styles.selectedLuggageItemCol}
                              onPress={() => setIsLuggageDropdownOpen(true)}
                              activeOpacity={0.7}
                            >
                              {/* Big Luggage Icon (Orange) */}
                              <Image
                                source={item.image}
                                style={styles.selectedLuggageSquareIcon}
                              />

                              {/* Bag Label */}
                              <Text
                                style={styles.selectedLuggageSquareLabel}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                              >
                                {t(`additionalRequirements.luggage.${item.id}.short`, { defaultValue: item.shortLabel })}
                              </Text>

                              {/* Bag Count */}
                              <Text style={styles.selectedLuggageSquareCount} numberOfLines={1}>
                                <Text style={styles.selectedLuggageSquareCountNum}>{count}</Text>{' '}
                                {count === 1 ? t('additionalRequirements.bag', { defaultValue: 'bag' }) : t('additionalRequirements.bags', { defaultValue: 'bags' })}
                              </Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
                  )}
                </View>

                <View style={styles.cardDivider} />

                {/* Additional Travel Options (Image 1 Mockup) */}
                <View style={styles.travelTogglesSection}>
                  {/* Senior Citizens / Elders (Above Age 60) - FIRST TOGGLE */}
                  <View style={styles.travelToggleItemRow}>
                    <TouchableOpacity
                      style={styles.travelToggleItemInfo}
                      onPress={() => setIsSeniorCitizen((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.travelToggleIconCircle}>
                        <MaterialCommunityIcons
                          name="human-cane"
                          size={24}
                          color="rgb(240, 117, 15)"
                        />
                      </View>
                      <View style={styles.travelToggleTextGroup}>
                        <Text style={styles.travelToggleTitle}>
                          {t('additionalRequirements.seniorCitizenTitle', { defaultValue: 'Senior Citizens (Above Age 60)?' })}
                        </Text>
                        <Text style={styles.travelToggleDesc}>
                          {t('additionalRequirements.seniorCitizenDesc', {
                            defaultValue: 'Enable this for easy access seating, gentle driving & driver assistance.',
                          })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <Switch
                      value={isSeniorCitizen}
                      onValueChange={setIsSeniorCitizen}
                      trackColor={{ false: '#cbd5e1', true: 'rgb(240, 117, 15)' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#cbd5e1"
                    />
                  </View>

                  <View style={styles.travelToggleDivider} />

                  {/* Need a Return Journey Later? */}
                  <View style={styles.travelToggleItemRow}>
                    <TouchableOpacity
                      style={styles.travelToggleItemInfo}
                      onPress={() => setNeedReturnJourney((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.travelToggleIconCircle}>
                        <Ionicons name="swap-horizontal" size={20} color="rgb(240, 117, 15)" />
                      </View>
                      <View style={styles.travelToggleTextGroup}>
                        <Text style={styles.travelToggleTitle}>{t('additionalRequirements.returnJourneyTitle', { defaultValue: 'Need a Return Journey Later?' })}</Text>
                        <Text style={styles.travelToggleDesc}>
                          {t('additionalRequirements.returnJourneyDesc', { defaultValue: 'Enable this if you may need a return trip on a later date.' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <Switch
                      value={needReturnJourney}
                      onValueChange={setNeedReturnJourney}
                      trackColor={{ false: '#cbd5e1', true: 'rgb(240, 117, 15)' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#cbd5e1"
                    />
                  </View>

                  <View style={styles.travelToggleDivider} />

                  {/* Need an Airport Drop? */}
                  <View style={styles.travelToggleItemRow}>
                    <TouchableOpacity
                      style={styles.travelToggleItemInfo}
                      onPress={() => setNeedAirportDrop((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.travelToggleIconCircle}>
                        <Ionicons name="airplane" size={20} color="rgb(240, 117, 15)" />
                      </View>
                      <View style={styles.travelToggleTextGroup}>
                        <Text style={styles.travelToggleTitle}>{t('additionalRequirements.airportDropTitle', { defaultValue: 'Need an Airport Drop?' })}</Text>
                        <Text style={styles.travelToggleDesc}>
                          {t('additionalRequirements.airportDropDesc', { defaultValue: 'Enable this if you need to be dropped at the airport.' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <Switch
                      value={needAirportDrop}
                      onValueChange={setNeedAirportDrop}
                      trackColor={{ false: '#cbd5e1', true: 'rgb(240, 117, 15)' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#cbd5e1"
                    />
                  </View>

                  <View style={styles.travelToggleDivider} />

                  {/* Need an Airport Pickup? */}
                  <View style={styles.travelToggleItemRow}>
                    <TouchableOpacity
                      style={styles.travelToggleItemInfo}
                      onPress={() => setNeedAirportPickup((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.travelToggleIconCircle}>
                        <Ionicons name="airplane" size={20} color="rgb(240, 117, 15)" />
                      </View>
                      <View style={styles.travelToggleTextGroup}>
                        <Text style={styles.travelToggleTitle}>{t('additionalRequirements.airportPickupTitle', { defaultValue: 'Need an Airport Pickup?' })}</Text>
                        <Text style={styles.travelToggleDesc}>
                          {t('additionalRequirements.airportPickupDesc', { defaultValue: 'Enable this if you need to be picked up from the airport.' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <Switch
                      value={needAirportPickup}
                      onValueChange={setNeedAirportPickup}
                      trackColor={{ false: '#cbd5e1', true: 'rgb(240, 117, 15)' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#cbd5e1"
                    />
                  </View>

                  <View style={styles.travelToggleDivider} />

                  {/* Pet Friendly */}
                  <View style={styles.travelToggleItemRow}>
                    <TouchableOpacity
                      style={styles.travelToggleItemInfo}
                      onPress={() => setIsPetFriendly((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.travelToggleIconCircle}>
                        <Ionicons name="paw" size={20} color="rgb(240, 117, 15)" />
                      </View>
                      <View style={styles.travelToggleTextGroup}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.travelToggleTitle}>{t('additionalRequirements.petFriendlyTitle', { defaultValue: 'Pet Friendly' })}</Text>
                          {isPetFriendly && (
                            <View style={styles.petSelectedHeaderBadge}>
                              <Text style={styles.petSelectedHeaderBadgeText}>
                                {selectedPetType === 'cat' ? 'Cat' : selectedPetType === 'bird' ? 'Bird' : 'Dog'}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.travelToggleDesc}>
                          {t('additionalRequirements.petFriendlyDesc', { defaultValue: 'Enable this if you are traveling with pets.' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <Switch
                      value={isPetFriendly}
                      onValueChange={setIsPetFriendly}
                      trackColor={{ false: '#cbd5e1', true: 'rgb(240, 117, 15)' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#cbd5e1"
                    />
                  </View>

                  {/* Dropdown / Pet Type Selector when Pet Friendly is switched ON */}
                  {isPetFriendly && (
                    <View style={styles.petSelectorContainer}>
                      <View style={styles.petSelectorHeaderRow}>
                        <Text style={styles.petSelectorHeaderLabel}>
                          Select Pet Type:
                        </Text>
                      </View>
                      <View style={styles.petOptionsRow}>
                        {([
                          { type: 'cat' as const, label: 'Cat', image: require('../../assets/images/pet-cat-icon.png') },
                          { type: 'dog' as const, label: 'Dog', image: require('../../assets/images/pet-dog-icon.png') },
                          { type: 'bird' as const, label: 'Bird', image: require('../../assets/images/pet-bird-icon.png') },
                        ]).map((item) => {
                          const isSelected = selectedPetType === item.type;
                          return (
                            <TouchableOpacity
                              key={item.type}
                              style={[
                                styles.petOptionCard,
                                isSelected && styles.petOptionCardSelected,
                              ]}
                              onPress={() => setSelectedPetType(item.type)}
                              activeOpacity={0.75}
                            >
                              <View style={styles.petOptionTopRow}>
                                <Image
                                  source={item.image}
                                  style={[
                                    styles.petOptionIconImage,
                                    { tintColor: isSelected ? 'rgb(240, 117, 15)' : 'rgb(30, 41, 59)' },
                                  ]}
                                />
                                {isSelected && (
                                  <View style={styles.petCheckBadge}>
                                    <Ionicons name="checkmark-circle" size={14} color="rgb(240, 117, 15)" />
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.petOptionName, isSelected && styles.petOptionNameSelected]}>
                                {item.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  <View style={styles.travelToggleDivider} />

                  {/* Baby on Board */}
                  <View style={styles.travelToggleItemRow}>
                    <TouchableOpacity
                      style={styles.travelToggleItemInfo}
                      onPress={() => setIsBabyOnBoard((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.travelToggleIconCircle}>
                        <MaterialCommunityIcons
                          name="baby-carriage"
                          size={22}
                          color="rgb(240, 117, 15)"
                        />
                      </View>
                      <View style={styles.travelToggleTextGroup}>
                        <Text style={styles.travelToggleTitle}>
                          {t('additionalRequirements.babyOnBoardTitle', { defaultValue: 'Baby on Board' })}
                        </Text>
                        <Text style={styles.travelToggleDesc}>
                          {t('additionalRequirements.babyOnBoardDesc', { defaultValue: 'Enable this if traveling with an infant or child for safer driving.' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <Switch
                      value={isBabyOnBoard}
                      onValueChange={setIsBabyOnBoard}
                      trackColor={{ false: '#cbd5e1', true: 'rgb(240, 117, 15)' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#cbd5e1"
                    />
                  </View>

                  <View style={styles.travelToggleDivider} />

                  {/* Pregnancy Friendly */}
                  <View style={styles.travelToggleItemRow}>
                    <TouchableOpacity
                      style={styles.travelToggleItemInfo}
                      onPress={() => setIsPregnancyFriendly((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.travelToggleIconCircle}>
                        <MaterialCommunityIcons
                          name="human-pregnant"
                          size={24}
                          color="rgb(240, 117, 15)"
                        />
                      </View>
                      <View style={styles.travelToggleTextGroup}>
                        <Text style={styles.travelToggleTitle}>
                          {t('additionalRequirements.pregnancyTitle', { defaultValue: 'Pregnancy Friendly' })}
                        </Text>
                        <Text style={styles.travelToggleDesc}>
                          {t('additionalRequirements.pregnancyDesc', { defaultValue: 'Enable this if traveling with a pregnant passenger for extra gentle driving.' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <Switch
                      value={isPregnancyFriendly}
                      onValueChange={setIsPregnancyFriendly}
                      trackColor={{ false: '#cbd5e1', true: 'rgb(240, 117, 15)' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#cbd5e1"
                    />
                  </View>

                  <View style={styles.travelToggleDivider} />

                  {/* Handicap / Disability Assistance */}
                  <View style={styles.travelToggleItemRow}>
                    <TouchableOpacity
                      style={styles.travelToggleItemInfo}
                      onPress={() => setIsHandicapped((prev) => !prev)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.travelToggleIconCircle}>
                        <FontAwesome5
                          name="wheelchair"
                          size={20}
                          color="rgb(240, 117, 15)"
                        />
                      </View>
                      <View style={styles.travelToggleTextGroup}>
                        <Text style={styles.travelToggleTitle}>
                          {t('additionalRequirements.handicapTitle', { defaultValue: 'Accessibility Assistance' })}
                        </Text>
                        <Text style={styles.travelToggleDesc}>
                          {t('additionalRequirements.handicapDesc', { defaultValue: 'Enable this for wheelchair support, easy boarding & driver assistance.' })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <Switch
                      value={isHandicapped}
                      onValueChange={setIsHandicapped}
                      trackColor={{ false: '#cbd5e1', true: 'rgb(240, 117, 15)' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#cbd5e1"
                    />
                  </View>

                  {/* Roof Carrier */}
                  {params.hasCarrier !== 'false' && (
                    <>
                      <View style={styles.travelToggleDivider} />
                      <View style={styles.travelToggleItemRow}>
                        <TouchableOpacity
                          style={styles.travelToggleItemInfo}
                          onPress={() => setRequestCarrier((prev) => !prev)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.travelToggleIconCircle}>
                            <Image
                              source={require('../../assets/images/roof-carrier-icon.png')}
                              style={{
                                width: 22,
                                height: 22,
                                resizeMode: 'contain',
                                tintColor: 'rgb(240, 117, 15)',
                              }}
                            />
                          </View>
                          <View style={styles.travelToggleTextGroup}>
                            <Text style={styles.travelToggleTitle}>
                              {t('additionalRequirements.roofCarrierTitle', { defaultValue: 'Roof Carrier?' })}
                            </Text>
                            <Text style={styles.travelToggleDesc}>
                              {t('additionalRequirements.roofCarrierDesc', { defaultValue: 'Enable this for rooftop luggage carrier for excess bags.' })}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <Switch
                          value={requestCarrier}
                          onValueChange={setRequestCarrier}
                          trackColor={{ false: '#cbd5e1', true: 'rgb(240, 117, 15)' }}
                          thumbColor="#ffffff"
                          ios_backgroundColor="#cbd5e1"
                        />
                      </View>
                    </>
                  )}
                </View>

                <View style={styles.cardDivider} />

                {/* Ride Preferences & Special Notes (Below Pet Friendly, same section) */}
                <View style={styles.preferencesHeader}>
                  <Ionicons name="options-outline" size={17} color="rgb(22, 34, 50)" />
                  <Text style={styles.cardSectionTitle}>{t('additionalRequirements.ridePreferences', { defaultValue: 'Ride Preferences' })}</Text>
                  <Text style={styles.optionalHint}>{t('additionalRequirements.optional', { defaultValue: '(Optional)' })}</Text>
                </View>

                {/* Refined Text Input with Left Icon */}
                <View style={[styles.notesInputContainer, isNotesHighlighted && styles.notesInputContainerHighlighted]}>
                  <Ionicons name="create-outline" size={15} color={isNotesHighlighted ? "rgb(240, 117, 15)" : "#94a3b8"} style={styles.notesInputIcon} />
                  <TextInput
                    ref={notesInputRef}
                    style={styles.notesInputField}
                    placeholder={t('additionalRequirements.notesPlaceholder', { defaultValue: 'Any special notes (e.g. child seat, extra stops, elderly assistance)...' })}
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={2}
                    value={pickupNotes}
                    onChangeText={setPickupNotes}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Bottom Sticky Action Bar */}
            <View style={styles.sheetBottomBar}>
              <TouchableOpacity
                style={styles.sheetApplyBtn}
                onPress={() => {
                  if (passengerCount <= 0) {
                    Alert.alert(
                      t('additionalRequirements.travellersRequiredTitle', { defaultValue: 'Select Travellers' }),
                      t('additionalRequirements.atLeastOnePassenger', { defaultValue: 'Please select at least 1 traveller.' })
                    );
                    return;
                  }
                  if (!isLuggageOptionalTrip && totalLuggageBags <= 0) {
                    Alert.alert(
                      t('additionalRequirements.travellersRequiredTitle', { defaultValue: 'Select Travellers' }),
                      'Please select the number of travellers and luggage before continuing.'
                    );
                    setIsLuggageDropdownOpen(true);
                    return;
                  }
                  setShowRequirementsModal(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.sheetApplyBtnText}>{t('additionalRequirements.saveAndApply', { defaultValue: 'Save & Apply Requirements' })}</Text>
                <Ionicons name="checkmark-circle" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>

            {/* Luggage Exceeded / Special Notes Popup Modal Overlay */}
            {showLuggageAlertModal && (
              <View style={styles.sheetAlertOverlay}>
                <View style={styles.luggageModalCard}>
                  {/* Top Icon Badge */}
                  <View style={styles.luggageModalIconCircle}>
                    <Ionicons name="briefcase" size={30} color="rgb(240, 117, 15)" />
                  </View>

                  {/* Title */}
                  <Text style={styles.luggageModalTitle}>
                    {t('additionalRequirements.luggageAlertTitle', { defaultValue: 'Luggage Limit Reached' })}
                  </Text>

                  {/* Specific Reason / Vehicle Info */}
                  <View style={styles.luggageModalReasonBox}>
                    <Ionicons name="information-circle" size={16} color="#c2410c" style={{ marginTop: 1 }} />
                    <Text style={styles.luggageModalReasonText}>
                      {luggageAlertReason || `${vehicleInfo.name} has a standard boot capacity of ${vehicleInfo.luggage} bags.`}
                    </Text>
                  </View>

                  {/* User Requested Prompt Text */}
                  <Text style={styles.luggageModalPrompt}>
                    {t('additionalRequirements.luggageAlertPrompt', {
                      defaultValue:
                        'If you have any more luggage, kindly write in the special notes what your requirements are. Our team will contact you to help your journey.',
                    })}
                  </Text>

                  {/* Primary Action Button: "Write in Special Notes" */}
                  <TouchableOpacity
                    style={styles.luggageModalPrimaryBtn}
                    onPress={handleGoToSpecialNotes}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="create-outline" size={18} color="#ffffff" />
                    <Text style={styles.luggageModalPrimaryBtnText}>
                      {t('additionalRequirements.writeSpecialNotesBtn', { defaultValue: 'Write in Special Notes' })}
                    </Text>
                  </TouchableOpacity>

                  {/* Secondary Dismiss Button */}
                  <TouchableOpacity
                    style={styles.luggageModalSecondaryBtn}
                    onPress={() => setShowLuggageAlertModal(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.luggageModalSecondaryBtnText}>
                      {t('common.cancel', { defaultValue: 'Cancel' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Travellers & Luggage Required Alert Overlay (Non-Modal for 100% Android view tag safety) */}
      {showTravellersRequiredModal && (
        <View style={styles.sheetAlertOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowTravellersRequiredModal(false)}
          />
          <View style={styles.travellersAlertCard}>
            <Text style={styles.travellersAlertTitle}>
              {t('additionalRequirements.travellersRequiredTitle', { defaultValue: 'Select Travellers' })}
            </Text>

            <Text style={styles.travellersAlertBody}>
              {t('additionalRequirements.travellersRequiredPromptPart1', { defaultValue: 'Please select the number of ' })}
              <Text style={styles.travellersAlertBold}>
                {t('additionalRequirements.travellersBoldWord', { defaultValue: 'travellers' })}
              </Text>
              {t('additionalRequirements.andWord', { defaultValue: ' and ' })}
              <Text style={styles.travellersAlertBold}>
                {t('additionalRequirements.luggageBoldWord', { defaultValue: 'luggage' })}
              </Text>
              {t('additionalRequirements.travellersRequiredPromptPart2', { defaultValue: ' before continuing.' })}
            </Text>

            <View style={styles.travellersAlertActions}>
              <TouchableOpacity
                style={styles.travellersAlertCancelBtn}
                onPress={() => setShowTravellersRequiredModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.travellersAlertCancelText}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.travellersAlertSelectBtn}
                onPress={() => {
                  setShowTravellersRequiredModal(false);
                  if (passengerCount > 0 && !isLuggageOptionalTrip && totalLuggageBags <= 0) {
                    setIsLuggageDropdownOpen(true);
                  }
                  setTimeout(() => {
                    setShowRequirementsModal(true);
                  }, 300);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.travellersAlertSelectText}>
                  {t('additionalRequirements.selectBtn', { defaultValue: 'Select' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    color: 'rgb(22, 34, 50)',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgb(240, 117, 15)',
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
    backgroundColor: 'rgb(240, 117, 15)',
    borderColor: 'rgb(240, 117, 15)',
  },
  stepCircleCurrent: {
    backgroundColor: 'rgb(240, 117, 15)',
    borderColor: '#fed7aa',
    shadowColor: 'rgb(240, 117, 15)',
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
    color: 'rgb(240, 117, 15)',
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
    backgroundColor: 'rgb(240, 117, 15)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
  },
  stepSection: {
    gap: 12,
  },
  authNoticeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    shadowColor: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
  },
  authActionBtn: {
    backgroundColor: 'rgb(240, 117, 15)',
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
    borderColor: 'rgb(240, 117, 15)',
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(240, 117, 15)',
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
    backgroundColor: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(240, 117, 15)',
  },
  topSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 0,
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
    width: 96,
    height: 60,
  },
  topSummaryVehicleDetails: {
    flex: 1,
    paddingHorizontal: 8,
  },
  topSummaryVehicleName: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.2,
  },
  topSummaryVehicleModels: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  topSummarySpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    marginTop: 3.5,
  },
  topSummarySpecItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  topSummarySpecText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '700',
  },
  topSummarySpecPipe: {
    fontSize: 11,
    color: '#cbd5e1',
    marginHorizontal: 1,
  },
  topSummaryChangeVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  topSummaryChangeVehicleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  topSummaryVerticalLine: {
    width: 1,
    height: 54,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 6,
  },
  topSummaryPriceCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topSummaryPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.3,
  },
  topSummaryGst: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '500',
  },
  topSummaryLimit: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
    marginTop: 1.5,
  },
  topSummaryHorizontalLine: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
  },
  topSummaryLocationsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  topSummaryLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  topSummaryLocationName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  topSummaryLocationSub: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '600',
  },
  topSummaryArrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  topSummaryArrowLine: {
    fontSize: 9,
    color: '#94a3b8',
    letterSpacing: -1,
  },
  topSummaryInnerDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
  },
  topSummaryScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  topSummaryScheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  topSummaryRouteDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 10,
  },
  topSummaryDateTimeText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
  },
  sectionHeaderSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1.5,
  },
  leadPassengerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 0,
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
    marginBottom: 10,
  },
  leadPassengerLeftTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  leadPassengerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
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
    backgroundColor: 'rgb(240, 117, 15)',
    borderColor: 'rgb(240, 117, 15)',
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
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 50,
  },
  inputCardIcon: {
    marginRight: 8,
  },
  inputCardTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  inputCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
    lineHeight: 13,
  },
  inputCardField: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
    textAlignVertical: 'top',
  },
  stickyBottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  infoNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingVertical: 5.5,
    paddingHorizontal: 9,
    marginBottom: 5,
  },
  infoNoticeIcon: {
    marginRight: 6,
  },
  infoNoticeText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 14,
    color: '#1e40af',
    fontWeight: '500',
  },
  continueToReviewBtn: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  continueToReviewText: {
    color: '#ffffff',
    fontSize: 16,
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
  travellersAlertCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 18,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  travellersAlertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  travellersAlertBody: {
    fontSize: 15,
    lineHeight: 23,
    color: '#334155',
    marginBottom: 20,
  },
  travellersAlertBold: {
    fontWeight: '800',
    color: '#0f172a',
  },
  travellersAlertActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  travellersAlertCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  travellersAlertCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  travellersAlertSelectBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  travellersAlertSelectText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    textTransform: 'uppercase',
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
    color: 'rgb(22, 34, 50)',
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
    borderColor: 'rgb(240, 117, 15)',
    backgroundColor: '#fff7ed',
  },
  luggageOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  luggageOptionTextSelected: {
    color: 'rgb(240, 117, 15)',
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
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 0,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerSummaryTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  passengerSummarySub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
  },
  editPassengerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    gap: 4,
  },
  editPassengerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
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
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  passengerBoxLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.3,
  },
  passengerBoxVal: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    marginTop: 3,
  },

  // Middle Two-Column Section
  twoColContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 0,
  },
  fareBreakdownCol: {
    flex: 1.05,
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
    flex: 0.95,
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
    fontSize: 13.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  fareLineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  fareLineLabel: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  fareLineVal: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  fareLineLabelBold: {
    fontSize: 12.5,
    color: 'rgb(22, 34, 50)',
    fontWeight: '800',
  },
  fareLineValBold: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
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
    fontSize: 11,
    fontWeight: '700',
    color: '#9a3412',
  },
  totalPayableAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: 'rgb(240, 117, 15)',
  },
  partPaymentPill: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginTop: 6,
    marginBottom: 4,
  },
  petBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  petBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
    flex: 1,
    lineHeight: 16,
  },
  flightBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  flightBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
    flex: 1,
    lineHeight: 16,
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
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5.5,
  },
  addonPillBtnActive: {
    backgroundColor: '#e2e8f0',
    borderColor: '#cbd5e1',
  },
  addonPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
  },
  altEmailBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  altEmailBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    flex: 1,
    lineHeight: 16,
  },
  gstBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  gstBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338ca',
    flex: 1,
    lineHeight: 16,
  },
  partPaymentPillTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  partPaymentPillSub: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1.5,
  },
  partPaymentPillAmount: {
    fontSize: 15.5,
    fontWeight: '900',
    color: 'rgb(240, 117, 15)',
  },
  advancePaymentBadge: {
    backgroundColor: '#e6f9f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  advancePaymentBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },
  paymentChoiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  paymentChoiceCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  paymentChoiceCardActive: {
    backgroundColor: '#fff7ed',
    borderColor: 'rgb(240, 117, 15)',
  },
  paymentChoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  paymentRadio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  paymentRadioActive: {
    borderColor: 'rgb(240, 117, 15)',
  },
  paymentRadioInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgb(240, 117, 15)',
  },
  paymentChoiceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  paymentChoiceLabelActive: {
    color: 'rgb(22, 34, 50)',
    fontWeight: '800',
  },
  paymentChoiceAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
    marginBottom: 1,
  },
  paymentChoiceAmountActive: {
    color: 'rgb(240, 117, 15)',
  },
  paymentChoiceSubtext: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#64748b',
    lineHeight: 12,
  },

  // Includes & Excludes
  incExcSection: {
    flex: 1,
  },
  incHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  incHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16a34a',
  },
  excHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  excHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  bulletIcon: {
    marginRight: 5,
    marginTop: 2,
  },
  bulletText: {
    fontSize: 11.5,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  paymentGridItemActive: {
    backgroundColor: '#fff7ed',
    borderColor: 'rgb(240, 117, 15)',
    borderWidth: 1.5,
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgb(240, 117, 15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    marginTop: 5,
  },
  paymentItemTitleActive: {
    color: 'rgb(240, 117, 15)',
    fontWeight: '800',
  },
  paymentItemSub: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 1.5,
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
    marginTop: 0,
    paddingHorizontal: 2,
  },
  checkboxSquare: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxSquareActive: {
    borderColor: 'rgb(240, 117, 15)',
    backgroundColor: 'rgb(240, 117, 15)',
  },
  termsText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: '#475569',
    fontWeight: '500',
  },

  // Bottom Action Bar
  bottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
    paddingBottom: 2,
  },
  reviewTermsContainer: {
    marginTop: 2,
    marginBottom: 0,
    paddingHorizontal: 2,
  },
  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    paddingLeft: 2,
  },
  trustBadgeText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  stickyBottomWrapper: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  stickyTopStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e6f7f2',
    paddingVertical: 6.5,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#cbf1e5',
  },
  stickyTopStripText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#065f46',
    marginRight: 6,
  },
  stickyFareBreakupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  stickyFareBreakupText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  stickyBottomBarMmt: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  stickyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stickyOptionBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: 'rgb(22, 34, 50)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stickyOptionBtnActive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#142232',
    borderWidth: 1.5,
    shadowColor: '#142232',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  stickyOptionLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 1,
  },
  stickyOptionLabelActive: {
    color: '#142232',
    fontWeight: '800',
  },
  stickyOptionAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(22, 34, 50, 0.65)',
  },
  stickyOptionAmountActive: {
    fontSize: 13.5,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
  },
  stickyPayNowBtn: {
    flex: 1.3,
    height: 48,
    backgroundColor: '#16a34a',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  stickyPayNowBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  stickyPayNowInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyPayNowTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  stickyPayNowAmount: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 1,
  },
  reviewBackBtn: {
    width: 80,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minHeight: 48,
  },
  reviewBackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  reviewConfirmPayBtn: {
    flex: 1,
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: 'rgb(240, 117, 15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 48,
  },
  reviewConfirmPayInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  reviewConfirmPayText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  reviewConfirmPaySubtext: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffedd5',
    marginTop: 1,
  },
  reviewConfirmPayPrice: {
    fontSize: 14.5,
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
    color: 'rgb(240, 117, 15)',
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
    backgroundColor: 'rgb(240, 117, 15)',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: '100%',
    marginBottom: 9,
  },
  otpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  otpKeyBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
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
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    width: '100%',
    marginBottom: 10,
    gap: 10,
  },
  dispatchIconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  dispatchNoticeDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 14,
  },
  viewMyRidesBtn: {
    backgroundColor: 'rgb(240, 117, 15)',
    paddingVertical: 11,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(240, 117, 15)',
  },
  luggageSection: {},
  luggageTopRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  luggageBigIconBox: {
    width: 48,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  luggageBigIcon: {
    width: 44,
    height: 48,
    resizeMode: 'contain',
    tintColor: 'rgb(22, 34, 50)',
  },
  luggageRightCol: {
    flex: 1,
  },
  luggageHeaderRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionHeaderRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  luggageDropdownBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 44,
  },
  luggageDropdownBarActive: {
    borderColor: 'rgb(240, 117, 15)',
  },
  luggageDropdownBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  luggageDropdownBarIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  luggageDropdownBarCustomIcon: {
    width: 17,
    height: 17,
    resizeMode: 'contain',
    tintColor: 'rgb(240, 117, 15)',
  },
  luggageDropdownBarMainText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  luggageDropdownBarSubText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  luggageDropdownListCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 3,
    paddingHorizontal: 4,
    gap: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  luggageDropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  luggageDropdownImageTouchable: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  luggageVectorBadge: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  luggageVectorBadgeSelected: {
    backgroundColor: 'transparent',
  },
  luggageBadgeIcon: {
    width: 56,
    height: 56,
  },
  luggageDropdownDetailsCol: {
    flex: 1,
    justifyContent: 'center',
  },
  luggageDropdownActionRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  luggageDropdownItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownStepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    width: '100%',
  },
  closeLuggageDropdownBtn: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  closeLuggageDropdownBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  selectedLuggageItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 6,
    width: '100%',
  },
  selectedLuggageItemCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  selectedLuggageDivider: {
    width: 1,
    height: 46,
    backgroundColor: '#e2e8f0',
  },
  selectedLuggageSquareIcon: {
    width: 42,
    height: 42,
    resizeMode: 'contain',
  },
  selectedLuggageSquareLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 3,
    textAlign: 'center',
  },
  selectedLuggageSquareCount: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
    textAlign: 'center',
  },
  selectedLuggageSquareCountNum: {
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
  },
  selectedLuggageContainer: {
    marginTop: 10,
    gap: 8,
  },
  selectedLuggageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgb(240, 117, 15)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectedLuggageIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedLuggageTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  selectedLuggageDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  luggageDropdownItemRowSelected: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  luggageDropdownIconBig: {
    width: 66,
    height: 66,
    resizeMode: 'contain',
  },
  luggageDropdownItemIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  luggageDropdownItemIconCircleSelected: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  luggageDropdownItemTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  luggageDropdownItemTitleSelected: {
    color: 'rgb(22, 34, 50)',
    fontWeight: '700',
  },
  luggageDropdownItemDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
    lineHeight: 13,
  },
  luggageQuantityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  luggageQuantityTextGroup: {
    flex: 1,
  },
  luggageQuantityTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  luggageQuantitySub: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  stepperQuantityUnit: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748b',
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
    borderColor: 'rgb(240, 117, 15)',
  },
  luggageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  clearLuggageBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  clearLuggageBtnText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
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
    color: 'rgb(240, 117, 15)',
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
    borderColor: '#e2e8f0',
    paddingHorizontal: 3,
    paddingVertical: 2,
    width: '100%',
  },
  stepperMiniBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#f1f5f9',
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
    color: 'rgb(240, 117, 15)',
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
    gap: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 4.5,
    paddingHorizontal: 16,
    width: '100%',
  },
  addLuggageMiniBtnDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.6,
  },
  addLuggageMiniBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(240, 117, 15)',
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
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  luggageCustomIcon: {
    width: 17,
    height: 17,
    resizeMode: 'contain',
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
    color: '#334155',
    fontWeight: '700',
  },
  luggageItemDesc: {
    fontSize: 8.5,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1,
  },
  luggageItemDescSelected: {
    color: '#64748b',
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
    color: 'rgb(22, 34, 50)',
  },
  carrierTitleActive: {
    color: 'rgb(240, 117, 15)',
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
  travelTogglesSection: {
    marginTop: 4,
  },
  travelToggleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  travelToggleItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  travelToggleIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  travelToggleTextGroup: {
    flex: 1,
    marginLeft: 12,
  },
  travelToggleTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    lineHeight: 18,
  },
  travelToggleDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  travelToggleDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 54,
  },
  petSelectedHeaderBadge: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  petSelectedHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
  },
  petSelectorContainer: {
    backgroundColor: '#fffaf5',
    borderWidth: 1,
    borderColor: '#ffedd5',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 54,
  },
  petSelectorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  petSelectorHeaderLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  petOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  petOptionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    position: 'relative',
  },
  petOptionCardSelected: {
    borderColor: 'rgb(240, 117, 15)',
    backgroundColor: '#fff7ed',
  },
  petOptionTopRow: {
    width: '100%',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  petOptionIconImage: {
    width: 34,
    height: 28,
    resizeMode: 'contain',
  },
  petCheckBadge: {
    position: 'absolute',
    top: -4,
    right: -2,
  },
  petOptionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  petOptionNameSelected: {
    color: 'rgb(240, 117, 15)',
    fontWeight: '800',
  },
  travelToggleBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  travelToggleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
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
    borderColor: 'rgb(240, 117, 15)',
  },
  quickTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#474D5E',
  },
  quickTagTextSelected: {
    color: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
    fontWeight: '500',
    padding: 0,
    minHeight: 32,
  },

  // Additional Requirements Trigger Card
  requirementsTriggerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  requirementsTriggerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requirementsIconBox: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  requirementsTriggerTextGroup: {
    flex: 1,
  },
  requirementsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requirementsTriggerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.2,
  },
  requirementsTriggerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2.5,
    lineHeight: 16,
  },
  requirementsEditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 3,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  requirementsEditText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  requirementsSummaryContainer: {
    width: '100%',
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    gap: 10,
  },
  summaryChipItem: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 5,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryChipEmptySlot: {
    flex: 1,
  },
  summaryItemDivider: {
    width: 0,
    height: 0,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: -0.2,
  },

  // Slide-Up Bottom Sheet Modal
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '65%',
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  sheetHandleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sheetHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.3,
  },
  sheetHeaderSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sheetScrollView: {
    flexGrow: 0,
  },
  sheetScrollContent: {
    paddingTop: 6,
    paddingBottom: 24,
    gap: 12,
  },
  sheetCardSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  sheetBottomBar: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  sheetApplyBtn: {
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    shadowColor: 'rgb(240, 117, 15)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  sheetApplyBtnText: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sheetAlertOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  luggageModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  luggageModalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  luggageModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  luggageModalReasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 12,
    width: '100%',
  },
  luggageModalReasonText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#c2410c',
    lineHeight: 16,
  },
  luggageModalPrompt: {
    fontSize: 12.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  luggageModalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
    shadowColor: 'rgb(240, 117, 15)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  luggageModalPrimaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  luggageModalSecondaryBtn: {
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  luggageModalSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  notesInputContainerHighlighted: {
    borderColor: 'rgb(240, 117, 15)',
    borderWidth: 1.5,
    backgroundColor: '#fff7ed',
  },
  luggageExceededBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  luggageExceededBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c2410c',
  },
  luggageExceededBannerText: {
    fontSize: 10,
    color: '#9a3412',
    marginTop: 1,
    lineHeight: 13,
  },
  luggageExceededBannerBtn: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
  },
  fleetApprovalReviewCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fef3c7',
    marginBottom: 16,
  },
  fleetApprovalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  fleetApprovalIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetApprovalTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#92400e',
  },
  fleetApprovalSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
  },
  fleetApprovalBodyText: {
    fontSize: 11.5,
    lineHeight: 17,
    color: '#78350f',
  },
});
