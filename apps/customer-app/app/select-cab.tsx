import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthModal } from '../components/AuthModal';
import BookingFlowHeader from '../components/BookingFlowHeader';
import { safeNavigate } from '../lib/safeNav';
import { trackAppEvent } from '../lib/analytics';

const { width } = Dimensions.get('window');

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.210.115.146:3000';

export interface SeaterOption {
  id: string;
  wheelbaseName: string;
  wheelbaseMm: number;
  seats: number;
  label: string;
  shortLabel: string;
  badge: string;
  baseRatePerKm: number;
  extraKmRate: number;
  extraKmThreshold?: number | null;
  luggageBags: number;
  minKm: number;
  description: string;
}

export const URBANIA_SEATER_OPTIONS: SeaterOption[] = [
  {
    id: 'SWB_10',
    wheelbaseName: 'Short Wheelbase (3350 mm)',
    wheelbaseMm: 3350,
    seats: 10,
    label: '10-Seater (10 + Driver)',
    shortLabel: '10-Seater • SWB 3350 mm',
    badge: '10 + Driver',
    baseRatePerKm: 28,
    extraKmRate: 28,
    extraKmThreshold: null,
    luggageBags: 8,
    minKm: 150,
    description: 'Compact executive van for comfortable 10 passengers with plush reclining seats',
  },
  {
    id: 'MWB_12',
    wheelbaseName: 'Medium Wheelbase (3615 mm)',
    wheelbaseMm: 3615,
    seats: 12,
    label: '12-Seater (12 + Driver)',
    shortLabel: '12-Seater • MWB 3615 mm',
    badge: '12 + Driver',
    baseRatePerKm: 30,
    extraKmRate: 30,
    extraKmThreshold: null,
    luggageBags: 10,
    minKm: 150,
    description: 'Medium luxury wheelbase with extra legroom for 12 passengers',
  },
  {
    id: 'MWB_13',
    wheelbaseName: 'Medium Wheelbase (3615 mm)',
    wheelbaseMm: 3615,
    seats: 13,
    label: '13-Seater (13 + Driver)',
    shortLabel: '13-Seater • MWB 3615 mm',
    badge: '13 + Driver',
    baseRatePerKm: 32,
    extraKmRate: 32,
    extraKmThreshold: null,
    luggageBags: 10,
    minKm: 150,
    description: 'Optimal 13-passenger luxury seating with gangway aisle and panoramic windows',
  },
  {
    id: 'MWB_14',
    wheelbaseName: 'Medium Wheelbase (3615 mm)',
    wheelbaseMm: 3615,
    seats: 14,
    label: '14-Seater (14 + Driver)',
    shortLabel: '14-Seater • MWB 3615 mm',
    badge: '14 + Driver',
    baseRatePerKm: 34,
    extraKmRate: 34,
    extraKmThreshold: null,
    luggageBags: 10,
    minKm: 150,
    description: '14-passenger medium wheelbase configuration for corporate & family travel',
  },
  {
    id: 'LWB_16',
    wheelbaseName: 'Long Wheelbase (4400 mm)',
    wheelbaseMm: 4400,
    seats: 16,
    label: '16-Seater (16 + Driver)',
    shortLabel: '16-Seater • LWB 4400 mm',
    badge: '16 + Driver',
    baseRatePerKm: 36,
    extraKmRate: 36,
    extraKmThreshold: null,
    luggageBags: 12,
    minKm: 150,
    description: 'Long wheelbase luxury carrier for 16 passengers with heavy luggage boot',
  },
  {
    id: 'LWB_17',
    wheelbaseName: 'Long Wheelbase (4400 mm)',
    wheelbaseMm: 4400,
    seats: 17,
    label: '17-Seater (17 + Driver)',
    shortLabel: '17-Seater • LWB 4400 mm',
    badge: '17 + Driver',
    baseRatePerKm: 38,
    extraKmRate: 38,
    extraKmThreshold: null,
    luggageBags: 12,
    minKm: 150,
    description: 'Maximum capacity 17-passenger long wheelbase flagship luxury cruiser',
  },
];

interface FleetItem {
  id: string;
  name: string;
  models: string;
  ratePerKm: number;
  minKm: number;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  image: any;
  purpose: string;
  passengers: number;
  luggage: number;
  fuelTypes: string[];
  hasCarrier: boolean;
  carrierCapacityText: string;
  carrierExcludedCars?: string;
  carrierExcludedReason?: string;
  features: string[];
}

const DEFAULT_FLEET_DATA: FleetItem[] = [
  {
    id: 'HATCHBACK',
    name: 'WagonR or equivalent',
    models: 'WagonR, Swift, Tiago, Celerio',
    ratePerKm: 11,
    minKm: 50,
    badge: 'ECONOMY CHOICE',
    badgeColor: '#103A75',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-hatchback.png'),
    purpose: 'Budget city & short outstation trips',
    passengers: 4,
    luggage: 2,
    fuelTypes: ['CNG', 'PETROL'],
    hasCarrier: true,
    carrierCapacityText: 'Roof Carrier Available on WagonR & Swift (Up to 45 kg space)',
    carrierExcludedCars: 'Tata Tiago (No Roof Carrier - Boot space only)',
    features: [
      '4 Passengers Capacity',
      '2 Standard Luggage Bags',
      'Roof Carrier on WagonR & Swift',
      'Air Conditioned & Clean Interiors',
      'Real-time GPS Tracking + OTP Gate',
    ],
  },
  {
    id: 'SEDAN',
    name: 'Dzire or equivalent',
    models: 'Dzire, Etios, Aura, Amaze',
    ratePerKm: 13,
    minKm: 60,
    badge: 'MOST POPULAR',
    badgeColor: '#103A75',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-sedan.png'),
    purpose: 'Comfortable sedan for families & business travel',
    passengers: 4,
    luggage: 3,
    fuelTypes: ['CNG', 'PETROL', 'DIESEL'],
    hasCarrier: false,
    carrierCapacityText: '',
    carrierExcludedReason: 'Sedan Class (Large Trunk Boot Space - No Roof Carrier)',
    features: [
      '4 Passengers Capacity',
      '3 Large Trunk Luggage Bags',
      'High Trunk Space & Extra Legroom',
      'Real-time GPS Tracking + OTP Gate',
    ],
  },
  {
    id: 'SUV',
    name: 'Ertiga or equivalent',
    models: 'Ertiga, Carens, XL6, Triber',
    ratePerKm: 16,
    minKm: 80,
    badge: 'FAMILY & GROUP',
    badgeColor: '#103A75',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-suv.png'),
    purpose: 'Spacious 6-7 seater for ghats & family vacations',
    passengers: 6,
    luggage: 4,
    fuelTypes: ['CNG', 'PETROL', 'DIESEL'],
    hasCarrier: true,
    carrierCapacityText: 'Roof Carrier Available (Up to 50 kg space)',
    carrierExcludedCars: '',
    features: [
      '6 Passengers Capacity',
      '4 Large Bags + Roof Carrier Option',
      'Powerful AC & High Ground Clearance',
      'Real-time GPS Tracking + OTP Gate',
    ],
  },
  {
    id: 'SUV_PREMIUM',
    name: 'Innova Crysta or equivalent',
    models: 'Innova Crysta, Hycross, Safari',
    ratePerKm: 20,
    minKm: 100,
    badge: 'EXECUTIVE LUXURY',
    badgeColor: '#103A75',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-crysta.png'),
    purpose: 'VIP highway cruising with premium captain seats',
    passengers: 7,
    luggage: 5,
    fuelTypes: ['PETROL', 'DIESEL'],
    hasCarrier: true,
    carrierCapacityText: 'Roof Carrier Available (Up to 60 kg space)',
    carrierExcludedCars: '',
    features: [
      '7 Passengers Capacity',
      '5 Luggage Bags + Top Carrier',
      'Plush Captain Seats & Smooth Ride',
      'Top-rated Chauffeurs & Highway Expert',
    ],
  },
  {
    id: 'TEMPO_TRAVELER',
    name: 'Tempo Traveller or equivalent',
    models: '12-17 Seater Force Traveller AC Luxury',
    ratePerKm: 26,
    minKm: 150,
    badge: 'LARGE GROUP',
    badgeColor: '#103A75',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-traveller.png'),
    purpose: 'Pilgrimage, marriage & corporate tour outings',
    passengers: 14,
    luggage: 10,
    fuelTypes: ['DIESEL'],
    hasCarrier: true,
    carrierCapacityText: 'Heavy Roof Carrier Available (Up to 150 kg space)',
    carrierExcludedCars: '',
    features: [
      '12 - 17 Passengers Capacity',
      '10+ Heavy Luggage Capacity (Roof Carrier)',
      'Reclining Seats & High Roof Walking Space',
      'Experienced Long-distance Chauffeurs',
    ],
  },
  {
    id: 'URBANIA',
    name: 'Force Urbania Luxury',
    models: '10/13/17 Seater Force Urbania AC Luxury Van',
    ratePerKm: 32,
    minKm: 150,
    badge: 'LUXURY VAN',
    badgeColor: '#103A75',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/vehicle-urbania.jpg'),
    purpose: 'Executive group trips, corporate delegates & VIP tours',
    passengers: 17,
    luggage: 10,
    fuelTypes: ['DIESEL'],
    hasCarrier: true,
    carrierCapacityText: 'Spacious Boot & Roof Luggage Space',
    carrierExcludedCars: '',
    features: [
      '10 - 17 Passengers Capacity',
      '10+ Heavy Luggage Capacity',
      'Ultra Luxury Reclining Push-back Seats',
      'Individual AC Vents & USB Charging Ports',
      'Panoramic Windows & Ambient Cabin Lighting',
    ],
  },
];

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

const getCategoryDisplayName = (item: FleetItem) => {
  if (item.id === 'HATCHBACK') return 'WagonR or Equivalent';
  if (item.id === 'SEDAN') return 'Toyota Etios or Equivalent';
  if (item.id === 'SUV') return 'Maruti Ertiga or Equivalent';
  if (item.id === 'SUV_PREMIUM') return 'Toyota Innova Crysta';
  if (item.id === 'TEMPO_TRAVELER') return 'Tempo Traveller';
  if (item.id === 'URBANIA') return 'Force Urbania';
  return item.name;
};

const getModelsDisplayName = (item: FleetItem) => {
  return '';
};

const getDisplayBadge = (badge: string) => {
  if (!badge) return '';
  if (badge === 'MOST POPULAR') return 'Recommended';
  if (badge === 'ECONOMY CHOICE') return 'Economy';
  if (badge === 'FAMILY & GROUP') return 'Family';
  if (badge === 'EXECUTIVE LUXURY') return 'Luxury';
  if (badge === 'LARGE GROUP') return 'Group';
  if (badge === 'PREMIUM VAN') return 'Flagship';
  return badge;
};

const formatSummaryDate = (dateStr: string) => {
  if (!dateStr) return 'Select Date';
  if (
    dateStr.includes('Jan') ||
    dateStr.includes('Feb') ||
    dateStr.includes('Mar') ||
    dateStr.includes('Apr') ||
    dateStr.includes('May') ||
    dateStr.includes('Jun') ||
    dateStr.includes('Jul') ||
    dateStr.includes('Aug') ||
    dateStr.includes('Sep') ||
    dateStr.includes('Oct') ||
    dateStr.includes('Nov') ||
    dateStr.includes('Dec')
  ) {
    return dateStr;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${day} ${monthNames[month]} ${year} (${dayNames[d.getDay()]})`;
    }
  }
  return dateStr;
};

const formatSummaryTime = (timeStr: string) => {
  if (!timeStr) return '09:00 AM';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let h = parseInt(parts[0], 10);
    const m = parts[1].padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  }
  return timeStr;
};

export default function SelectCabScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const pickup = (params.pickup as string) || 'Mangaluru';
  const drop = (params.drop as string) || 'Udupi';
  const pickupDate = (params.date as string) || 'Today';
  const pickupTime = (params.time as string) || '09:00';
  const tripType = (params.tripType as string) || 'ONEWAY';
  const localHours = Number(params.localHours) || 8;

  const pickupLat = Number(params.pickupLat) || 12.8634;
  const pickupLng = Number(params.pickupLng) || 74.8436;
  const dropLat = Number(params.dropLat) || 13.348;
  const dropLng = Number(params.dropLng) || 74.782;

  const viaStopsRaw = (params.viaStops as string) || '[]';
  const viaStops: any[] = useMemo(() => {
    try {
      return JSON.parse(viaStopsRaw);
    } catch {
      return [];
    }
  }, [viaStopsRaw]);

  const tripTypeSubtitle = useMemo(() => {
    if (tripType === 'CORPORATE') {
      return params.corporateMode === 'DAILY'
        ? `Corporate Daily Rides (${params.corporateTotalDays || 'Multiple'} days)`
        : 'Corporate Travel • Book Once';
    }
    if (tripType === 'ROUND') return 'Round Trip Outstation';
    if (tripType === 'LOCAL') return `Local Rental (${localHours} hrs)`;
    if (tripType === 'AIRPORT') {
      return viaStops.length > 0
        ? `Airport Transfer (${viaStops.length} via stop${viaStops.length > 1 ? 's' : ''})`
        : 'Airport Transfer';
    }
    if (viaStops.length > 0) return `Multi-Stop One-Way (${viaStops.length} via)`;
    return 'Outstation One-Way';
  }, [tripType, params.corporateMode, params.corporateTotalDays, localHours, viaStops.length]);

  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [fleetList, setFleetList] = useState<FleetItem[]>(DEFAULT_FLEET_DATA);
  const [selectedUrbaniaSeaterId, setSelectedUrbaniaSeaterId] = useState<string>('MWB_13');
  const [showSeaterModal, setShowSeaterModal] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default');

  const toggleSort = () => {
    if (sortOrder === 'default') setSortOrder('asc');
    else if (sortOrder === 'asc') setSortOrder('desc');
    else setSortOrder('default');
  };

  const selectedUrbaniaSeater = useMemo(() => {
    return URBANIA_SEATER_OPTIONS.find((s) => s.id === selectedUrbaniaSeaterId) || URBANIA_SEATER_OPTIONS[2];
  }, [selectedUrbaniaSeaterId]);

  // Fetch live fleet specs from Admin Backend
  const loadLiveFleets = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/fleets?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.fleets) && data.fleets.length > 0) {
          const merged = DEFAULT_FLEET_DATA.map((def) => {
            const live = data.fleets.find((f: any) => f.category === def.id || f.id === def.id);
            if (!live) return def;

            const enabledFuels: string[] = [];
            if (Array.isArray(live.fuelTypes)) {
              enabledFuels.push(...live.fuelTypes);
            } else {
              if (live.cngEnabled) enabledFuels.push('CNG');
              if (live.petrolEnabled) enabledFuels.push('PETROL');
              if (live.dieselEnabled) enabledFuels.push('DIESEL');
            }

            return {
              ...def,
              name: live.name || def.name,
              models: live.description || def.models,
              passengers: live.seatCount || def.passengers,
              luggage: live.luggageCount !== undefined ? live.luggageCount : def.luggage,
              fuelTypes: enabledFuels.length > 0 ? enabledFuels : def.fuelTypes,
              hasCarrier: live.hasCarrier !== undefined ? Boolean(live.hasCarrier) : def.hasCarrier,
              carrierCapacityText: live.carrierCapacityText || def.carrierCapacityText,
              carrierExcludedCars: live.carrierExcludedCars || '',
              carrierExcludedReason: live.carrierExcludedReason || def.carrierExcludedReason,
            };
          });
          setFleetList(merged);
        }
      }
    } catch (err) {
      console.log('Using default fleet specs:', err);
    }
  }, []);

  useEffect(() => {
    loadLiveFleets();
    trackAppEvent('VIEW_RATES', {
      tripType,
      pickup: typeof pickup === 'string' ? pickup : '',
      drop: typeof drop === 'string' ? drop : '',
    });
    // Poll every 4 seconds to instantly reflect any Admin Panel changes
    const interval = setInterval(loadLiveFleets, 4000);
    return () => clearInterval(interval);
  }, [loadLiveFleets]);

  // Distance estimate across all waypoints
  const estimatedKm = useMemo(() => {
    if (tripType === 'LOCAL') {
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
  }, [tripType, localHours, pickupLat, pickupLng, dropLat, dropLng, viaStops]);

  const estimatedHours = useMemo(() => {
    if (tripType === 'LOCAL') return `${localHours} hrs`;
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
  }, [tripType, localHours, estimatedKm]);

  const selectedVehicle = useMemo(() => {
    return fleetList.find((f) => f.id === selectedVehicleId) || fleetList[0];
  }, [selectedVehicleId, fleetList]);

  const sortedFleetList = useMemo(() => {
    if (sortOrder === 'default') return fleetList;
    return [...fleetList].sort((a, b) => {
      const isUrbaniaA = a.id === 'URBANIA';
      const isUrbaniaB = b.id === 'URBANIA';
      const rateA = isUrbaniaA ? selectedUrbaniaSeater.baseRatePerKm : a.ratePerKm;
      const rateB = isUrbaniaB ? selectedUrbaniaSeater.baseRatePerKm : b.ratePerKm;
      const fareA = Math.round(Math.max(a.minKm, estimatedKm) * rateA);
      const fareB = Math.round(Math.max(b.minKm, estimatedKm) * rateB);
      return sortOrder === 'asc' ? fareA - fareB : fareB - fareA;
    });
  }, [fleetList, sortOrder, estimatedKm, selectedUrbaniaSeater]);

  const handleBookNow = (item: FleetItem) => {
    trackAppEvent('STARTED_BOOKING', {
      category: item.id,
      tripType,
      pickup: typeof pickup === 'string' ? pickup : '',
      drop: typeof drop === 'string' ? drop : '',
    });

    const isUrbania = item.id === 'URBANIA';
    const effectiveRatePerKm = isUrbania ? selectedUrbaniaSeater.baseRatePerKm : item.ratePerKm;
    const effectiveExtraKmRate = isUrbania ? selectedUrbaniaSeater.extraKmRate : item.ratePerKm;
    const effectiveThreshold = isUrbania ? (selectedUrbaniaSeater.extraKmThreshold || selectedUrbaniaSeater.minKm || 150) : item.minKm;
    const effectiveSeats = isUrbania ? selectedUrbaniaSeater.seats : item.passengers;
    const effectiveLuggage = isUrbania ? selectedUrbaniaSeater.luggageBags : item.luggage;
    const displayName = isUrbania ? `${getCategoryDisplayName(item)} (${selectedUrbaniaSeater.shortLabel})` : getCategoryDisplayName(item);

    safeNavigate(() => {
      router.push({
        pathname: '/booking',
        params: {
          pickup,
          pickupLat: String(pickupLat),
          pickupLng: String(pickupLng),
          drop,
          dropLat: String(dropLat),
          dropLng: String(dropLng),
          viaStops: viaStopsRaw,
          date: pickupDate,
          time: pickupTime,
          tripType,
          flightNumber: (params.flightNumber as string) || '',
          airportDirection: (params.airportDirection as string) || '',
          localHours: String(localHours),
          category: item.id,
          selectedVehicleName: displayName,
          ratePerKm: String(effectiveRatePerKm),
          extraKmRate: String(effectiveExtraKmRate),
          extraKmThreshold: String(effectiveThreshold),
          minKm: String(item.minKm),
          maxSeats: String(effectiveSeats),
          maxLuggage: String(effectiveLuggage),
          hasCarrier: item.hasCarrier ? 'true' : 'false',
          carrierText: item.carrierCapacityText || item.carrierExcludedCars || item.carrierExcludedReason || '',
          seaterVariant: isUrbania ? selectedUrbaniaSeater.id : '',
          seaterLabel: isUrbania ? selectedUrbaniaSeater.label : '',
          wheelbase: isUrbania ? selectedUrbaniaSeater.wheelbaseName : '',
          corporateMode: (params.corporateMode as string) || '',
          corporateStartDate: (params.corporateStartDate as string) || '',
          corporateEndDate: (params.corporateEndDate as string) || '',
          corporateTotalDays: (params.corporateTotalDays as string) || '',
          corporateActiveDatesJson: (params.corporateActiveDatesJson as string) || '',
          corporateExcludedDatesJson: (params.corporateExcludedDatesJson as string) || '',
          corporatePickupTimesJson: (params.corporatePickupTimesJson as string) || '',
        },
      });
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={true} />

      {/* 1. Unified Booking Header & 3-Step Stepper */}
      <BookingFlowHeader
        currentStep={2}
        title="Select a Cab"
        subStepLabel={tripTypeSubtitle}
        topInset={topInset}
        onBack={() => router.back()}
        onStep1Press={() => router.back()}
      />

      {/* 2. Available Cabs List with Scrollable Route & Search Summary Card */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Route & Search Summary Card */}
        <View style={styles.routeSummaryCard}>
          {/* Row 1: Pickup Location on Left, Date on Right */}
          <View style={styles.routeRow}>
            <View style={styles.routePointLeft}>
              <View style={styles.routePinWrapper}>
                <Ionicons name="location" size={15} color="#EE5C21" />
              </View>
              <Text style={styles.routePointText} numberOfLines={1}>{pickup}</Text>
            </View>

            <View style={styles.routeDateTimeItem}>
              <Ionicons name="calendar-outline" size={14} color="#EE5C21" />
              <Text style={styles.routeDateTimeText} numberOfLines={1}>
                {formatSummaryDate(pickupDate)}
              </Text>
            </View>
          </View>

          {/* Dotted Timeline Connector or Via Stops */}
          {viaStops.length > 0 ? (
            viaStops.map((stop: any, i: number) => (
              <View key={`via-${i}`} style={styles.routeRow}>
                <View style={styles.routePointLeft}>
                  <View style={styles.routePinWrapper}>
                    <View style={styles.routeViaDot} />
                  </View>
                  <Text style={[styles.routePointText, { color: '#b45309', fontSize: 11.5 }]} numberOfLines={1}>
                    Via: {stop.label}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.routeConnectorRow}>
              <View style={styles.routePinWrapper}>
                <View style={styles.routeConnectorDotsCol}>
                  <View style={styles.routeConnectorDot} />
                  <View style={styles.routeConnectorDot} />
                  <View style={styles.routeConnectorDot} />
                </View>
              </View>
            </View>
          )}

          {/* Row 2: Destination Drop on Left, Time on Right */}
          <View style={styles.routeRow}>
            <View style={styles.routePointLeft}>
              <View style={styles.routePinWrapper}>
                <Ionicons name="location" size={15} color="#103A75" />
              </View>
              <Text style={styles.routePointText} numberOfLines={1}>{drop}</Text>
            </View>

            <View style={styles.routeDateTimeItem}>
              <Ionicons name="time-outline" size={14} color="#EE5C21" />
              <Text style={styles.routeDateTimeText} numberOfLines={1}>
                {formatSummaryTime(pickupTime)}
              </Text>
            </View>
          </View>

          {/* Row 3: Return Trip Drop (if Round Trip) */}
          {tripType === 'ROUND' && (
            <View style={[styles.routeRow, { marginTop: 4 }]}>
              <View style={styles.routePointLeft}>
                <View style={styles.routePinWrapper}>
                  <Ionicons name="repeat" size={13} color="#2563eb" />
                </View>
                <Text style={[styles.routePointText, { color: '#2563eb', fontSize: 11.5 }]} numberOfLines={1}>
                  Return: {(params.returnDrop as string) || pickup}
                </Text>
              </View>
            </View>
          )}

          {/* Bottom Row: Subtext on Left, Edit Search Button on Right */}
          <View style={styles.routeBottomRow}>
            <View style={styles.routeSubtextCol}>
              <Text style={styles.tripTypeSubtext} numberOfLines={1}>
                {tripType === 'CORPORATE'
                  ? params.corporateMode === 'DAILY'
                    ? `Corporate Daily (${params.corporateTotalDays || 'Multiple'} days)`
                    : 'Corporate Travel'
                  : tripType === 'ROUND'
                  ? 'Round Trip'
                  : tripType === 'LOCAL'
                  ? `Local Rental (${localHours} hrs)`
                  : tripType === 'AIRPORT'
                  ? viaStops.length > 0
                    ? `Airport Transfer (${viaStops.length} via)`
                    : 'Airport Transfer'
                  : 'One Way Drop'}
                {'  |  '}~{estimatedKm} km{'  |  '}1 Passenger{'  |  '}No Luggage
              </Text>
            </View>

            <TouchableOpacity
              style={styles.editSearchBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={11.5} color="#103A75" />
              <Text style={styles.editSearchBtnText}>Edit Search</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Available Vehicles Section Header with Sort by Price (Reference) */}
        <View style={styles.availableVehiclesHeaderRow}>
          <Text style={styles.availableVehiclesTitle}>Available Vehicles</Text>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={toggleSort}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical" size={13} color="#475569" />
            <Text style={styles.sortBtnText}>
              {sortOrder === 'asc' ? 'Price: Low to High' : sortOrder === 'desc' ? 'Price: High to Low' : 'Sort by Price'}
            </Text>
            <Ionicons name="chevron-down" size={11} color="#475569" />
          </TouchableOpacity>
        </View>

        <View style={styles.fleetAccordionList}>
          {sortedFleetList.map((item, index) => {
            const isExpanded = selectedVehicleId === item.id;
            const isRecommended = item.id === 'SEDAN' || item.badge === 'MOST POPULAR' || item.badge?.toUpperCase().includes('RECOMMENDED');
            const isSelected = selectedVehicleId ? selectedVehicleId === item.id : isRecommended;
            const isUrbania = item.id === 'URBANIA';
            const effectiveRatePerKm = isUrbania ? selectedUrbaniaSeater.baseRatePerKm : item.ratePerKm;
            const effectiveExtraKmRate = isUrbania ? selectedUrbaniaSeater.extraKmRate : item.ratePerKm;
            const effectiveSeats = isUrbania ? selectedUrbaniaSeater.seats : item.passengers;
            const effectiveLuggage = isUrbania ? selectedUrbaniaSeater.luggageBags : item.luggage;
            const hasThreshold = isUrbania && typeof selectedUrbaniaSeater.extraKmThreshold === 'number' && selectedUrbaniaSeater.extraKmThreshold > 0;
            const isBeyondThreshold = Boolean(hasThreshold && selectedUrbaniaSeater.extraKmThreshold && estimatedKm > selectedUrbaniaSeater.extraKmThreshold);

            let totalFare: number;
            let calculationBreakdown = '';

            if (isBeyondThreshold && selectedUrbaniaSeater.extraKmThreshold) {
              const threshold = selectedUrbaniaSeater.extraKmThreshold;
              const baseFare = threshold * effectiveRatePerKm;
              const extraKm = estimatedKm - threshold;
              const extraFare = extraKm * effectiveExtraKmRate;
              totalFare = Math.round(baseFare + extraFare);
              calculationBreakdown = `₹${baseFare.toLocaleString('en-IN')} (first ${threshold} km) + ₹${extraFare.toLocaleString('en-IN')} (${extraKm} extra km @ ₹${effectiveExtraKmRate}/km)`;
            } else {
              totalFare = Math.round(
                Math.max(item.minKm, estimatedKm) * effectiveRatePerKm
              );
            }

            const seatsLabel = item.id === 'TEMPO_TRAVELER'
              ? '12 - 17'
              : `${effectiveSeats} + 1`;
            const bagsLabel = `${effectiveLuggage}`;

            return (
              <View
                key={item.id}
                style={[
                  styles.refCabCard,
                  isExpanded && styles.refCabCardActive,
                ]}
              >
                {/* Main Card Content (Exact to Reference Screenshot) */}
                <View style={styles.refCardMainRow}>
                  {/* Left Column: Car Image */}
                  <View style={styles.refCarImageWrap}>
                    <Image
                      source={item.image}
                      style={[styles.refCarImage, isUrbania && styles.refCarImageUrbania]}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Middle Column: Details */}
                  <View style={styles.refInfoCol}>
                    {isRecommended ? (
                      <View style={[styles.refBadgePill, { alignSelf: 'flex-start', marginBottom: 2 }]}>
                        <Text style={styles.refBadgeText} numberOfLines={1}>
                          Recommended
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.refTitleBadgeRow}>
                      <Text style={styles.refVehicleName} numberOfLines={2}>
                        {getCategoryDisplayName(item)}
                      </Text>
                    </View>

                    {!!getModelsDisplayName(item) && (
                      <Text style={styles.refModelsText} numberOfLines={1}>
                        {getModelsDisplayName(item)}
                      </Text>
                    )}

                    {/* Spec Icons Row: 👤 4 + 1   💼 2   ❄️ A/C */}
                    <View style={styles.refSpecsRow}>
                      <View style={styles.refSpecItem}>
                        <Ionicons name="person" size={11} color="#475569" />
                        <Text style={styles.refSpecText}>{seatsLabel}</Text>
                      </View>

                      <View style={styles.refSpecItem}>
                        <Ionicons name="briefcase" size={11} color="#475569" />
                        <Text style={styles.refSpecText}>{bagsLabel}</Text>
                      </View>

                      <View style={styles.refSpecItem}>
                        <Ionicons name="snow" size={11} color="#475569" />
                        <Text style={styles.refSpecText}>A/C</Text>
                      </View>
                    </View>

                    {/* View Details ⌵ / Hide Details ⌃ */}
                    <TouchableOpacity
                      style={styles.refViewDetailsBtn}
                      onPress={() => setSelectedVehicleId(isExpanded ? null : item.id)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.refViewDetailsText}>
                        {isExpanded ? 'Hide Details' : 'View Details'}
                      </Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={11}
                        color="#2563eb"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Right Column: Fare, GST, Km Limit, and Select Button (Small & Compact) */}
                  <View style={styles.refActionCol}>
                    <Text style={styles.refPriceText} numberOfLines={1}>
                      ₹ {totalFare.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.refGstText} numberOfLines={1}>
                      (Inclusive of 5% GST)
                    </Text>
                    <Text style={styles.refKmsLimitText} numberOfLines={1}>
                      {Math.max(item.minKm, Math.round(estimatedKm))} Kms Limit
                    </Text>

                    <TouchableOpacity
                      style={styles.refSelectBtn}
                      onPress={() => handleBookNow(item)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.refSelectBtnText}>Select</Text>
                      <Ionicons name="chevron-forward" size={11} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Expanded Details Drawer (When user taps View Details) */}
                {isExpanded && (
                  <View style={styles.refExpandedSection}>
                    <View style={styles.refDivider} />

                    {/* URBANIA Seater & Wheelbase Clean Single-Layer Card */}
                    {isUrbania && (
                      <TouchableOpacity
                        style={styles.singleSeaterPicker}
                        onPress={() => setShowSeaterModal(true)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.seaterTextGroup}>
                          <View style={styles.seaterTitleRow}>
                            <Text style={styles.seaterPickerMainText}>
                              {selectedUrbaniaSeater.label}
                            </Text>
                            <View style={styles.inlineWheelbaseBadge}>
                              <Text style={styles.inlineWheelbaseBadgeText}>
                                {selectedUrbaniaSeater.wheelbaseName.split('(')[1]?.replace(')', '') || '3615 mm'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.seaterPickerSubText} numberOfLines={1}>
                            {selectedUrbaniaSeater.wheelbaseName.split('(')[0].trim()} • ₹{selectedUrbaniaSeater.baseRatePerKm}/km • {selectedUrbaniaSeater.luggageBags} Bags
                          </Text>
                        </View>

                        <View style={styles.seaterPickerChangePill}>
                          <Text style={styles.seaterPickerChangeText}>Change</Text>
                          <Ionicons name="chevron-down" size={13} color="#ea580c" />
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* Purpose Pill */}
                    <View style={styles.purposePill}>
                      <Text style={styles.purposePillText}>{item.purpose}</Text>
                    </View>

                    {/* Feature Checklist */}
                    <View style={styles.featureList}>
                      {item.features.map((feat, idx) => (
                        <View key={idx} style={styles.featureItem}>
                          <Ionicons name="checkmark" size={16} color="#ea580c" />
                          <Text style={styles.featureItemText}>{feat}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Fuel Types & Roof Carrier Row */}
                    <View style={{ marginBottom: 14, gap: 8 }}>
                      {/* Fuel Options */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>Fuels:</Text>
                        {item.fuelTypes.map((fuel) => (
                          <View
                            key={fuel}
                            style={{
                              backgroundColor: '#f1f5f9',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: '#e2e8f0',
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#334155' }}>{fuel}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Carrier Badge */}
                      {item.hasCarrier ? (
                        <View style={{ gap: 6 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              padding: 8,
                              borderRadius: 10,
                              backgroundColor: '#f0fdf4',
                              borderWidth: 1,
                              borderColor: '#bbf7d0',
                            }}
                          >
                            <Ionicons name="checkbox" size={15} color="#16a34a" />
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: '#15803d',
                                flex: 1,
                              }}
                            >
                              {item.carrierCapacityText || 'Roof Carrier Available'}
                            </Text>
                          </View>

                          {item.carrierExcludedCars ? (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                padding: 8,
                                borderRadius: 10,
                                backgroundColor: '#fffbeb',
                                borderWidth: 1,
                                borderColor: '#fde68a',
                              }}
                            >
                              <Ionicons name="alert-circle" size={15} color="#d97706" />
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  color: '#92400e',
                                  flex: 1,
                                }}
                              >
                                Excluded: {item.carrierExcludedCars}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            padding: 8,
                            borderRadius: 10,
                            backgroundColor: '#f8fafc',
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                          }}
                        >
                          <Ionicons name="alert-circle-outline" size={15} color="#64748b" />
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: '#64748b',
                              flex: 1,
                            }}
                          >
                            {item.carrierExcludedReason || 'No Roof Carrier (Trunk Boot Space Only)'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {calculationBreakdown ? (
                      <View style={{ backgroundColor: '#fff7ed', padding: 8, borderRadius: 8, marginBottom: 12 }}>
                        <Text style={{ fontSize: 11, color: '#c2410c', fontWeight: '600' }}>
                          Rate breakdown: {calculationBreakdown}
                        </Text>
                      </View>
                    ) : null}

                    {/* Book Button */}
                    <TouchableOpacity
                      style={styles.bookCarBtn}
                      onPress={() => handleBookNow(item)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.bookCarBtnText}>
                        Proceed with {isUrbania ? `Urbania (${selectedUrbaniaSeater.shortLabel})` : item.name} →
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Inclusions & Exclusions Card (from reference) */}
        <View style={styles.policyCard}>
          {/* Left Column: Inclusions */}
          <View style={styles.policyColumn}>
            <View style={styles.policyHeaderRow}>
              <View style={styles.policyIconCircle}>
                <Ionicons name="checkmark" size={12} color="#ffffff" />
              </View>
              <Text style={styles.policyHeaderTitle}>Inclusions</Text>
            </View>

            <View style={styles.policyItem}>
              <Ionicons name="checkmark" size={13} color="#ea580c" style={styles.policyCheckIcon} />
              <Text style={styles.policyItemText}>Fuel Charges</Text>
            </View>

            <View style={styles.policyItem}>
              <Ionicons name="checkmark" size={13} color="#ea580c" style={styles.policyCheckIcon} />
              <Text style={styles.policyItemText}>Chauffeur Allowance (6 AM – 8 PM)</Text>
            </View>

            <View style={styles.policyItem}>
              <Ionicons name="checkmark" size={13} color="#ea580c" style={styles.policyCheckIcon} />
              <Text style={styles.policyItemText}>{Math.max(50, Math.round(estimatedKm))} Kms Limit</Text>
            </View>

            <View style={[styles.policyItem, { marginBottom: 0 }]}>
              <Ionicons name="checkmark" size={13} color="#ea580c" style={styles.policyCheckIcon} />
              <Text style={styles.policyItemText}>5% GST</Text>
            </View>
          </View>

          {/* Vertical Divider */}
          <View style={styles.policyDivider} />

          {/* Right Column: Exclusions */}
          <View style={styles.policyColumn}>
            <View style={styles.policyHeaderRow}>
              <View style={styles.policyIconCircle}>
                <Text style={styles.policyExclamationMark}>!</Text>
              </View>
              <Text style={styles.policyHeaderTitle}>Exclusions</Text>
            </View>

            <View style={styles.policyItem}>
              <Ionicons name="checkmark" size={13} color="#ea580c" style={styles.policyCheckIcon} />
              <Text style={styles.policyItemText}>Extra Km charges (as per tariff)</Text>
            </View>

            <View style={styles.policyItem}>
              <Ionicons name="checkmark" size={13} color="#ea580c" style={styles.policyCheckIcon} />
              <Text style={styles.policyItemText}>Toll Charges</Text>
            </View>

            <View style={styles.policyItem}>
              <Ionicons name="checkmark" size={13} color="#ea580c" style={styles.policyCheckIcon} />
              <Text style={styles.policyItemText}>Parking Charges</Text>
            </View>

            <View style={[styles.policyItem, { marginBottom: 0 }]}>
              <Ionicons name="checkmark" size={13} color="#ea580c" style={styles.policyCheckIcon} />
              <Text style={styles.policyItemText}>Chauffeur Night Allowance (after 8 PM)</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Urbania Seater & Wheelbase Selector Modal */}
      <Modal
        visible={showSeaterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSeaterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSeaterModal(false)}
        >
          <View style={styles.seaterModalSheet}>
            <View style={styles.seaterModalHeader}>
              <View>
                <Text style={styles.seaterModalTitle}>Select Seater & Wheelbase</Text>
                <Text style={styles.seaterModalSubtitle}>Choose the optimal Force Urbania configuration</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSeaterModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              {/* Group 1: Short Wheelbase (3350 mm) */}
              <View style={styles.wheelbaseGroupHeader}>
                <Ionicons name="layers-outline" size={14} color="#ea580c" />
                <Text style={styles.wheelbaseGroupTitle}>Short Wheelbase (3350 mm)</Text>
                <Text style={styles.wheelbaseGroupTag}>10-Seater Options</Text>
              </View>
              {URBANIA_SEATER_OPTIONS.filter((s) => s.wheelbaseMm === 3350).map((opt) => {
                const isSelected = selectedUrbaniaSeaterId === opt.id;
                const optTotalFare = Math.round(Math.max(150, estimatedKm) * opt.baseRatePerKm);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.seaterOptionCard, isSelected && styles.seaterOptionCardSelected]}
                    onPress={() => {
                      setSelectedUrbaniaSeaterId(opt.id);
                      setShowSeaterModal(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.seaterOptionLeft}>
                      <View style={[styles.seaterBadgeBox, isSelected && styles.seaterBadgeBoxSelected]}>
                        <Ionicons name="people" size={16} color={isSelected ? '#ffffff' : '#ea580c'} />
                        <Text style={[styles.seaterBadgeText, isSelected && { color: '#ffffff' }]}>
                          {opt.seats}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.seaterOptionLabel, isSelected && styles.seaterOptionLabelSelected]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.seaterOptionDesc}>{opt.description}</Text>
                        <View style={styles.seaterMetaRow}>
                          <Text style={styles.seaterMetaPill}>🧳 {opt.luggageBags} Bags</Text>
                          <Text style={styles.seaterMetaPill}>📏 3350 mm SWB</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.seaterOptionRight}>
                      <Text style={styles.seaterOptionRate}>₹{opt.baseRatePerKm}/km</Text>
                      <Text style={styles.seaterOptionTotal}>Est: ₹{optTotalFare.toLocaleString('en-IN')}</Text>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={22} color="#ea580c" style={{ marginTop: 4 }} />
                      ) : (
                        <Ionicons name="radio-button-off" size={20} color="#cbd5e1" style={{ marginTop: 4 }} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Group 2: Medium Wheelbase (3615 mm) */}
              <View style={[styles.wheelbaseGroupHeader, { marginTop: 14 }]}>
                <Ionicons name="layers-outline" size={14} color="#0284c7" />
                <Text style={styles.wheelbaseGroupTitle}>Medium Wheelbase (3615 mm)</Text>
                <Text style={[styles.wheelbaseGroupTag, { color: '#0369a1', backgroundColor: '#e0f2fe' }]}>
                  12 / 13 / 14-Seater Options
                </Text>
              </View>
              {URBANIA_SEATER_OPTIONS.filter((s) => s.wheelbaseMm === 3615).map((opt) => {
                const isSelected = selectedUrbaniaSeaterId === opt.id;
                const optTotalFare = Math.round(Math.max(150, estimatedKm) * opt.baseRatePerKm);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.seaterOptionCard, isSelected && styles.seaterOptionCardSelected]}
                    onPress={() => {
                      setSelectedUrbaniaSeaterId(opt.id);
                      setShowSeaterModal(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.seaterOptionLeft}>
                      <View style={[styles.seaterBadgeBox, isSelected && styles.seaterBadgeBoxSelected]}>
                        <Ionicons name="people" size={16} color={isSelected ? '#ffffff' : '#0284c7'} />
                        <Text style={[styles.seaterBadgeText, isSelected && { color: '#ffffff' }]}>
                          {opt.seats}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.seaterOptionLabel, isSelected && styles.seaterOptionLabelSelected]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.seaterOptionDesc}>{opt.description}</Text>
                        <View style={styles.seaterMetaRow}>
                          <Text style={styles.seaterMetaPill}>🧳 {opt.luggageBags} Bags</Text>
                          <Text style={styles.seaterMetaPill}>📏 3615 mm MWB</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.seaterOptionRight}>
                      <Text style={styles.seaterOptionRate}>₹{opt.baseRatePerKm}/km</Text>
                      <Text style={styles.seaterOptionTotal}>Est: ₹{optTotalFare.toLocaleString('en-IN')}</Text>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={22} color="#ea580c" style={{ marginTop: 4 }} />
                      ) : (
                        <Ionicons name="radio-button-off" size={20} color="#cbd5e1" style={{ marginTop: 4 }} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Group 3: Long Wheelbase (4400 mm) */}
              <View style={[styles.wheelbaseGroupHeader, { marginTop: 14 }]}>
                <Ionicons name="layers-outline" size={14} color="#7c3aed" />
                <Text style={styles.wheelbaseGroupTitle}>Long Wheelbase (4400 mm)</Text>
                <Text style={[styles.wheelbaseGroupTag, { color: '#6d28d9', backgroundColor: '#ede9fe' }]}>
                  16 / 17-Seater Options
                </Text>
              </View>
              {URBANIA_SEATER_OPTIONS.filter((s) => s.wheelbaseMm === 4400).map((opt) => {
                const isSelected = selectedUrbaniaSeaterId === opt.id;
                const optTotalFare = Math.round(Math.max(150, estimatedKm) * opt.baseRatePerKm);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.seaterOptionCard, isSelected && styles.seaterOptionCardSelected]}
                    onPress={() => {
                      setSelectedUrbaniaSeaterId(opt.id);
                      setShowSeaterModal(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.seaterOptionLeft}>
                      <View style={[styles.seaterBadgeBox, isSelected && styles.seaterBadgeBoxSelected]}>
                        <Ionicons name="people" size={16} color={isSelected ? '#ffffff' : '#7c3aed'} />
                        <Text style={[styles.seaterBadgeText, isSelected && { color: '#ffffff' }]}>
                          {opt.seats}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.seaterOptionLabel, isSelected && styles.seaterOptionLabelSelected]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.seaterOptionDesc}>{opt.description}</Text>
                        <View style={styles.seaterMetaRow}>
                          <Text style={styles.seaterMetaPill}>🧳 {opt.luggageBags} Bags</Text>
                          <Text style={styles.seaterMetaPill}>📏 4400 mm LWB</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.seaterOptionRight}>
                      <Text style={styles.seaterOptionRate}>₹{opt.baseRatePerKm}/km</Text>
                      <Text style={styles.seaterOptionTotal}>Est: ₹{optTotalFare.toLocaleString('en-IN')}</Text>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={22} color="#ea580c" style={{ marginTop: 4 }} />
                      ) : (
                        <Ionicons name="radio-button-off" size={20} color="#cbd5e1" style={{ marginTop: 4 }} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Auth Modal if needed */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={() => {}}
      />
    </View>
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
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#103A75',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ea580c',
    marginTop: 1,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  editBtnText: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '800',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  stepItemActive: {
    alignItems: 'center',
    position: 'relative',
    paddingBottom: 4,
  },
  stepTextActive: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EE5C21',
  },
  stepIndicatorActive: {
    position: 'absolute',
    bottom: -10,
    height: 2.5,
    width: '100%',
    backgroundColor: '#EE5C21',
    borderRadius: 2,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  routeSummaryCard: {
    backgroundColor: '#ffffff',
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routePointLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  routeLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeConnectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1.5,
  },
  routePinWrapper: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  routeConnectorDotsCol: {
    height: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeConnectorDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: '#94a3b8',
  },
  routeViaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  routePointText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#103A75',
    flexShrink: 1,
  },
  routeDateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    width: 126,
    justifyContent: 'flex-start',
    flexShrink: 0,
  },
  routeDateTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  routeBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  routeSubtextCol: {
    flex: 1,
  },
  tripTypeSubtext: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '500',
  },
  editSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    flexShrink: 0,
  },
  editSearchBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#103A75',
  },
  distanceTimeBadgeRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  greenKmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  greenKmBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#059669',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  availableVehiclesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  availableVehiclesTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#103A75',
    letterSpacing: -0.3,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  fleetAccordionList: {
    gap: 10,
    marginBottom: 20,
  },
  refCabCard: {
    backgroundColor: '#ffffff',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 6,
    paddingRight: 8,
    marginBottom: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  refCabCardActive: {
    borderColor: '#fb923c',
    borderWidth: 1.3,
    backgroundColor: '#ffffff',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  refCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refCarImageWrap: {
    width: 120,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  refCarImage: {
    width: '100%',
    height: '100%',
  },
  refCarImageUrbania: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  refInfoCol: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 4,
  },
  refTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 1,
  },
  refVehicleName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#103A75',
    flexShrink: 1,
  },
  refBadgePill: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    flexShrink: 0,
  },
  refBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ea580c',
  },
  refModelsText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 3,
  },
  refSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 3,
  },
  refSpecItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  refSpecText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#334155',
  },
  refViewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
  },
  refViewDetailsText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  refActionCol: {
    width: 92,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  refPriceText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#103A75',
    marginBottom: 0,
    textAlign: 'right',
  },
  refGstText: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 1,
    textAlign: 'right',
  },
  refKmsLimitText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
    textAlign: 'right',
  },
  refSelectBtn: {
    backgroundColor: '#f95711',
    borderRadius: 7,
    paddingVertical: 5.5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: '100%',
  },
  refSelectBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  refExpandedSection: {
    marginTop: 10,
  },
  refDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 12,
  },
  selectedCardSection: {
    marginBottom: 20,
  },
  selectedCardHeading: {
    fontSize: 15,
    fontWeight: '900',
    color: '#103A75',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  fleetCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  fleetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  choiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  choiceBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#103A75',
    letterSpacing: 0.6,
  },
  rateContainer: {
    alignItems: 'flex-end',
  },
  totalFareText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#103A75',
  },
  rateTag: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  rateTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#c2410c',
    letterSpacing: 0.4,
  },
  carImageContainer: {
    height: 125,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  carImage: {
    width: '100%',
    height: '100%',
  },
  vehicleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  vehicleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleTitleTextContainer: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#103A75',
  },
  vehicleModels: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1,
  },
  purposePill: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  purposePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c2410c',
  },
  featureList: {
    gap: 6,
    marginBottom: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  bookCarBtn: {
    backgroundColor: '#EE5C21',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookCarBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  policyCard: {
    flexDirection: 'row',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 13,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 12,
  },
  policyColumn: {
    flex: 1,
  },
  policyDivider: {
    width: 1,
    backgroundColor: '#fed7aa',
    marginHorizontal: 7,
    alignSelf: 'stretch',
  },
  policyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  policyIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#103A75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyExclamationMark: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    marginTop: -1,
  },
  policyHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#103A75',
  },
  policyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 4,
  },
  policyCheckIcon: {
    marginTop: 1,
  },
  policyItemText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#334155',
    flex: 1,
    lineHeight: 13.5,
  },
  singleSeaterPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 12,
  },
  seaterLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  seaterPickerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  seaterTextGroup: {
    flex: 1,
    marginRight: 8,
  },
  seaterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seaterPickerMainText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#103A75',
  },
  inlineWheelbaseBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  inlineWheelbaseBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#c2410c',
    letterSpacing: 0.3,
  },
  seaterPickerSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c2410c',
    marginTop: 2,
  },
  seaterPickerChangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fdba74',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  seaterPickerChangeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  seaterModalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  seaterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },
  seaterModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#103A75',
  },
  seaterModalSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelbaseGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  wheelbaseGroupTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  wheelbaseGroupTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c2410c',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  seaterOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  seaterOptionCardSelected: {
    borderColor: '#ea580c',
    backgroundColor: '#fffdfa',
  },
  seaterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  seaterBadgeBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seaterBadgeBoxSelected: {
    backgroundColor: '#ea580c',
    borderColor: '#c2410c',
  },
  seaterBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#c2410c',
    marginTop: 1,
  },
  seaterOptionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#103A75',
  },
  seaterOptionLabelSelected: {
    color: '#ea580c',
  },
  seaterOptionDesc: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  seaterMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  seaterMetaPill: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  seaterOptionRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  seaterOptionRate: {
    fontSize: 13,
    fontWeight: '900',
    color: '#059669',
  },
  seaterOptionTotal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 1,
  },
});
