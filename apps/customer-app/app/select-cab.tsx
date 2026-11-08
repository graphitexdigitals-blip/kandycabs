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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AuthModal } from '../components/AuthModal';
import BookingFlowHeader from '../components/BookingFlowHeader';
import { safeNavigate } from '../lib/safeNav';
import { trackAppEvent } from '../lib/analytics';
import { APP_FONT } from '../constants/typography';

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
    name: 'Compact',
    models: 'Toyota Glanza, WagonR, Tiago or equivalent',
    ratePerKm: 11,
    minKm: 50,
    badge: 'ECONOMY CHOICE',
    badgeColor: 'rgb(22, 34, 50)',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-hatchback.png'),
    purpose: 'Budget city & short outstation trips',
    passengers: 4,
    luggage: 2,
    fuelTypes: ['CNG'],
    hasCarrier: true,
    carrierCapacityText: 'Roof Carrier Available',
    carrierExcludedCars: 'Tata Tiago (No Roof Carrier - Boot space only)',
    features: [
      '4 Passengers Capacity',
      '2 Standard Luggage Bags',
      'Air Conditioned & Clean Interiors',
      'Real-time GPS Tracking + OTP Gate',
    ],
  },
  {
    id: 'SWIFT_DZIRE',
    name: 'Sedan Swift Dzire',
    models: 'Maruti Suzuki Dzire or equivalent',
    ratePerKm: 13,
    minKm: 60,
    badge: '',
    badgeColor: 'rgb(22, 34, 50)',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-sedan.png'),
    purpose: 'Comfortable sedan for families & business travel',
    passengers: 4,
    luggage: 3,
    fuelTypes: ['DIESEL'],
    hasCarrier: false,
    carrierCapacityText: '',
    carrierExcludedReason: 'Sedan Class (Large Dedicated Boot Trunk - No Roof Carrier)',
    features: [
      '4 Passengers Capacity',
      '3 Large Trunk Luggage Bags',
      'High Trunk Space & Extra Legroom',
      'Real-time GPS Tracking + OTP Gate',
    ],
  },
  {
    id: 'TOYOTA_ETIOS',
    name: 'Sedan Toyota Etios',
    models: 'Toyota Etios Diesel with Large Boot Space',
    ratePerKm: 14,
    minKm: 60,
    badge: 'DIESEL WITH BOOT',
    badgeColor: 'rgb(22, 34, 50)',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-4-sedan.png'),
    purpose: 'Long-distance highway travel with dedicated large boot space',
    passengers: 4,
    luggage: 4,
    fuelTypes: ['DIESEL'],
    hasCarrier: false,
    carrierCapacityText: '',
    carrierExcludedReason: 'Sedan Class (Large Dedicated Boot Trunk - No Roof Carrier)',
    features: [
      '4 Passengers Capacity',
      '4 Large Bags Dedicated Boot Space',
      'Powerful Highway Diesel Engine',
      'Real-time GPS Tracking + OTP Gate',
    ],
  },
  {
    id: 'SUV_ERTIGA',
    name: 'SUVs Ertiga',
    models: 'Maruti Suzuki Ertiga or equivalent',
    ratePerKm: 16,
    minKm: 80,
    badge: 'FAMILY & GROUP',
    badgeColor: 'rgb(22, 34, 50)',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-suv.png'),
    purpose: 'Spacious 6-seater for ghats & family vacations',
    passengers: 6,
    luggage: 4,
    fuelTypes: ['CNG'],
    hasCarrier: true,
    carrierCapacityText: 'Roof Carrier Available',
    carrierExcludedCars: '',
    features: [
      '6 Passengers Capacity',
      '4 Large Bags + Roof Carrier Option',
      'Powerful AC & High Ground Clearance',
      'Real-time GPS Tracking + OTP Gate',
    ],
  },
  {
    id: 'SUV_CARENS',
    name: 'SUVs Kia Carens',
    models: 'Kia Carens Diesel Luxury 6+1',
    ratePerKm: 18,
    minKm: 80,
    badge: 'PREMIUM 6-SEATER',
    badgeColor: 'rgb(22, 34, 50)',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-carens.png'),
    purpose: 'Refined 6-seater diesel ride with premium comfort & features',
    passengers: 6,
    luggage: 4,
    fuelTypes: ['DIESEL'],
    hasCarrier: true,
    carrierCapacityText: 'Roof Carrier Available',
    carrierExcludedCars: '',
    features: [
      '6 Passengers Capacity',
      '4 Large Bags + Roof Carrier Option',
      'Plush 3-Row Seating & Dual AC',
      'Real-time GPS Tracking + OTP Gate',
    ],
  },
  {
    id: 'SUV_INNOVA',
    name: 'SUVs Toyota Innova',
    models: 'Toyota Innova Diesel 7+1 Touring',
    ratePerKm: 19,
    minKm: 90,
    badge: 'POPULAR 7-SEATER',
    badgeColor: 'rgb(22, 34, 50)',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-innova.png'),
    purpose: 'Legendary reliable 7-seater for ghats, temples & long tours',
    passengers: 7,
    luggage: 5,
    fuelTypes: [],
    hasCarrier: true,
    carrierCapacityText: 'Roof Carrier Available',
    carrierExcludedCars: '',
    features: [
      '7 Passengers Capacity',
      '5 Luggage Bags + Top Carrier Option',
      'Reliable Western Ghats & Highway Performer',
      'Top-rated Long-distance Chauffeurs',
    ],
  },
  {
    id: 'SUV_CRYSTA',
    name: 'SUVs Innova Crysta',
    models: 'Toyota Innova Crysta Diesel Luxury',
    ratePerKm: 20,
    minKm: 100,
    badge: 'EXECUTIVE LUXURY',
    badgeColor: 'rgb(22, 34, 50)',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-crysta.png'),
    purpose: 'VIP highway cruising with premium captain seats',
    passengers: 7,
    luggage: 5,
    fuelTypes: [],
    hasCarrier: true,
    carrierCapacityText: 'Roof Carrier Available',
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
    name: 'Tempo Traveller',
    models: '12-17 Seater Force Traveller AC Luxury',
    ratePerKm: 26,
    minKm: 150,
    badge: 'LARGE GROUP',
    badgeColor: 'rgb(22, 34, 50)',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-traveller.png'),
    purpose: 'Pilgrimage, marriage & corporate tour outings',
    passengers: 14,
    luggage: 10,
    fuelTypes: [],
    hasCarrier: true,
    carrierCapacityText: 'Roof Carrier Available',
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
    name: 'Force Urbania',
    models: '10/13/17 Seater Force Urbania AC Luxury Van',
    ratePerKm: 32,
    minKm: 150,
    badge: 'LUXURY VAN',
    badgeColor: 'rgb(22, 34, 50)',
    badgeBg: '#f1f5f9',
    image: require('../assets/images/fleet-urbania.png'),
    purpose: 'Executive group trips, corporate delegates & VIP tours',
    passengers: 17,
    luggage: 10,
    fuelTypes: [],
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
  if (item.id === 'HATCHBACK') return 'Compact';
  if (item.id === 'SWIFT_DZIRE' || item.id === 'DZIRE') return 'Sedan – Swift Dzire';
  if (item.id === 'TOYOTA_ETIOS' || item.id === 'ETIOS' || item.id === 'SEDAN') return 'Sedan – Toyota Etios';
  if (item.id === 'SUV_ERTIGA' || item.id === 'ERTIGA' || item.id === 'SUV') return 'SUV – Ertiga';
  if (item.id === 'SUV_CARENS' || item.id === 'CARENS') return 'SUV – Kia Carens';
  if (item.id === 'SUV_INNOVA' || item.id === 'INNOVA') return 'SUV – Toyota Innova';
  if (item.id === 'SUV_CRYSTA' || item.id === 'CRYSTA' || item.id === 'SUV_PREMIUM') return 'SUV – Innova Crysta';
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
  if (badge === 'DIESEL WITH BOOT') return 'Diesel with Boot';
  if (badge === 'FAMILY & GROUP') return 'Family';
  if (badge === 'PREMIUM 6-SEATER') return '6-Seater';
  if (badge === 'POPULAR 7-SEATER') return '7-Seater';
  if (badge === 'EXECUTIVE LUXURY') return 'Luxury';
  if (badge === 'LARGE GROUP') return 'Group';
  if (badge === 'LUXURY VAN') return 'Flagship';
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
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isSmallDevice = windowWidth < 380 || windowHeight < 700;
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
  const [selectedCarriers, setSelectedCarriers] = useState<Record<string, boolean>>({});
  const [selectedFuels, setSelectedFuels] = useState<Record<string, string>>({});
  const [fleetList, setFleetList] = useState<FleetItem[]>(DEFAULT_FLEET_DATA);

  const toggleCarrier = (id: string) => {
    setSelectedCarriers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };
  const [selectedUrbaniaSeaterId, setSelectedUrbaniaSeaterId] = useState<string>('MWB_13');
  const [showSeaterModal, setShowSeaterModal] = useState<boolean>(false);
  const [pendingFleetItem, setPendingFleetItem] = useState<{ item: FleetItem; openRequirements: boolean } | null>(null);
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
            const live = data.fleets.find(
              (f: any) => f.category === def.id || f.id === def.id || (def.id === 'SWIFT_DZIRE' && f.category === 'SEDAN')
            );
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
              fuelTypes: def.id === 'HATCHBACK' ? ['CNG'] : def.id === 'SWIFT_DZIRE' ? ['DIESEL'] : def.fuelTypes,
              hasCarrier: def.id === 'SWIFT_DZIRE' ? false : (live.hasCarrier !== undefined ? Boolean(live.hasCarrier) : def.hasCarrier),
              carrierCapacityText: def.id === 'SWIFT_DZIRE' ? '' : (live.carrierCapacityText || def.carrierCapacityText),
              carrierExcludedCars: live.carrierExcludedCars || '',
              carrierExcludedReason: def.id === 'SWIFT_DZIRE' ? 'Sedan Class (Large Dedicated Boot Trunk - No Roof Carrier)' : (live.carrierExcludedReason || def.carrierExcludedReason),
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

  const onSelectCabItem = (item: FleetItem, openRequirements: boolean = false) => {
    const isTempoOrUrbania = item.id === 'TEMPO_TRAVELER' || item.id === 'TRAVELLER' || item.id === 'URBANIA';
    if (isTempoOrUrbania) {
      setPendingFleetItem({ item, openRequirements });
    } else {
      handleBookNow(item, openRequirements);
    }
  };

  const handleBookNow = (item: FleetItem, openRequirements: boolean = false) => {
    trackAppEvent('STARTED_BOOKING', {
      category: item.id,
      tripType,
      pickup: typeof pickup === 'string' ? pickup : '',
      drop: typeof drop === 'string' ? drop : '',
    });

    const isUrbania = item.id === 'URBANIA';
    const isTempoOrUrbania = item.id === 'TEMPO_TRAVELER' || item.id === 'TRAVELLER' || item.id === 'URBANIA';
    const effectiveRatePerKm = isUrbania ? selectedUrbaniaSeater.baseRatePerKm : item.ratePerKm;
    const effectiveExtraKmRate = isUrbania ? selectedUrbaniaSeater.extraKmRate : item.ratePerKm;
    const effectiveThreshold = isUrbania ? (selectedUrbaniaSeater.extraKmThreshold || selectedUrbaniaSeater.minKm || 150) : item.minKm;
    const effectiveSeats = isUrbania ? selectedUrbaniaSeater.seats : item.passengers;
    const effectiveLuggage = isUrbania ? selectedUrbaniaSeater.luggageBags : item.luggage;
    const displayName = isUrbania ? `${getCategoryDisplayName(item)} (${selectedUrbaniaSeater.shortLabel})` : getCategoryDisplayName(item);
    const chosenFuel = (selectedFuels[item.id] || (item.fuelTypes && item.fuelTypes[0]) || 'DIESEL').toUpperCase();
    const isDzireDiesel = item.id === 'SWIFT_DZIRE' && chosenFuel === 'DIESEL';
    const effectiveHasCarrier = item.hasCarrier && !isDzireDiesel;
    const effectiveCarrierText = isDzireDiesel
      ? 'Sedan Class (Large Dedicated Boot Trunk - No Roof Carrier)'
      : item.carrierCapacityText || item.carrierExcludedCars || item.carrierExcludedReason || '';

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
          fuelType: selectedFuels[item.id] || (item.fuelTypes && item.fuelTypes[0]) || 'DIESEL',
          hasCarrier: effectiveHasCarrier ? 'true' : 'false',
          requestCarrier: effectiveHasCarrier && !!selectedCarriers[item.id] ? 'true' : 'false',
          carrierText: effectiveCarrierText,
          openRequirements: openRequirements ? 'true' : 'false',
          isFleetApprovalRequired: isTempoOrUrbania ? 'true' : 'false',
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
        title={t('selectCab.selectCabTitle', { defaultValue: 'Select a Cab' })}
        subStepLabel={tripTypeSubtitle}
        topInset={topInset}
        onBack={() => router.back()}
        onStep1Press={() => router.back()}
      />

      {/* 2. Available Cabs List with Scrollable Route & Search Summary Card */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Route & Search Summary Card */}
        <View style={styles.routeSummaryCard}>
          {/* Row 1: Pickup Location on Left, Date on Right */}
          <View style={styles.routeRow}>
            <View style={styles.routePointLeft}>
              <View style={styles.routePinWrapper}>
                <Ionicons name="location" size={17} color="#16a34a" />
              </View>
              <Text
                style={[styles.routePointText, isSmallDevice && { fontSize: 13.5 }]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {pickup}
              </Text>
            </View>

            <View style={[styles.routeDateTimeItem, isSmallDevice && { width: 115 }]}>
              <Ionicons name="calendar-outline" size={isSmallDevice ? 14 : 16} color="rgb(240, 117, 15)" />
              <Text
                style={[styles.routeDateTimeText, isSmallDevice && { fontSize: 11.5 }]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
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
                  <Text
                    style={[styles.routePointText, { color: '#b45309', fontSize: isSmallDevice ? 12 : 13.5 }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.8}
                  >
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
                <Ionicons name="location" size={17} color="#ef4444" />
              </View>
              <Text
                style={[styles.routePointText, isSmallDevice && { fontSize: 13.5 }]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {drop}
              </Text>
            </View>

            <View style={[styles.routeDateTimeItem, isSmallDevice && { width: 115 }]}>
              <Ionicons name="time-outline" size={isSmallDevice ? 14 : 16} color="rgb(240, 117, 15)" />
              <Text
                style={[styles.routeDateTimeText, isSmallDevice && { fontSize: 11.5 }]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {formatSummaryTime(pickupTime)}
              </Text>
            </View>
          </View>

          {/* Bottom Row: Subtext on Left, Edit Search Button on Right */}
          <View style={styles.routeBottomRow}>
            <View style={styles.routeSubtextCol}>
              <Text style={[styles.tripTypeSubtext, isSmallDevice && { fontSize: 11, lineHeight: 15 }]} numberOfLines={2}>
                {tripType === 'CORPORATE'
                  ? params.corporateMode === 'DAILY'
                    ? t('selectCab.corporateDaily', { days: params.corporateTotalDays || 'Multiple', defaultValue: `Corporate Daily (${params.corporateTotalDays || 'Multiple'} days)` })
                    : t('selectCab.corporateTravel', { defaultValue: 'Corporate Travel' })
                  : tripType === 'ROUND'
                    ? t('selectCab.roundTrip', { defaultValue: 'Round Trip' })
                    : tripType === 'LOCAL'
                      ? t('selectCab.localRental', { hours: localHours, defaultValue: `Local Rental (${localHours} hrs)` })
                      : tripType === 'AIRPORT'
                        ? viaStops.length > 0
                          ? t('selectCab.airportTransferVia', { count: viaStops.length, defaultValue: `Airport Transfer (${viaStops.length} via)` })
                          : t('selectCab.airportTransfer', { defaultValue: 'Airport Transfer' })
                        : t('selectCab.oneWayDrop', { defaultValue: 'One Way Drop' })}
                {' • '}~{estimatedKm} {t('common.km', { defaultValue: 'km' })}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.editSearchBtn, isSmallDevice && { paddingHorizontal: 7, paddingVertical: 4.5 }]}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={isSmallDevice ? 12 : 13.5} color="rgb(22, 34, 50)" />
              <Text style={[styles.editSearchBtnText, isSmallDevice && { fontSize: 11 }]}>{t('common.edit', { defaultValue: 'Edit Search' })}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Available Vehicles Section Header with Sort by Price (Reference) */}
        <View style={styles.availableVehiclesHeaderRow}>
          <Text
            style={styles.availableVehiclesTitle}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.8}
          >
            {t('selectCab.availableCabs', { defaultValue: 'Our Fleets' })}
          </Text>
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={toggleSort}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical" size={13} color="#475569" />
            <Text style={styles.sortBtnText}>
              {sortOrder === 'asc'
                ? t('selectCab.sortPriceAsc', { defaultValue: 'Price: Low to High' })
                : sortOrder === 'desc'
                  ? t('selectCab.sortPriceDesc', { defaultValue: 'Price: High to Low' })
                  : t('selectCab.sortByPrice', { defaultValue: 'Sort by Price' })}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#475569" />
          </TouchableOpacity>
        </View>

        <View style={styles.fleetAccordionList}>
          {sortedFleetList.map((item, index) => {
            const isExpanded = selectedVehicleId === item.id;
            const isRecommended = item.id === 'TOYOTA_ETIOS' || item.badge?.toUpperCase().includes('RECOMMENDED');
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
              ? '12-17'
              : `${effectiveSeats}+1`;
            const bagsLabel = `${effectiveLuggage}`;
            const isDzireDiesel = item.id === 'SWIFT_DZIRE' && (selectedFuels[item.id] || item.fuelTypes[0])?.toUpperCase() === 'DIESEL';
            const showRoofCarrier = item.hasCarrier && !isDzireDiesel;

            return (
              <View
                key={item.id}
                style={[
                  styles.refCabCard,
                  isExpanded && styles.refCabCardActive,
                ]}
              >
                {/* Main Card Content Row: Car Image Section on LEFT, Contents on RIGHT */}
                <View style={styles.refCardMainRow}>
                  {/* LEFT: Dedicated Car Image Section (Reduced paddings, maximized car) */}
                  <View style={[styles.carImageSectionLeft, isSmallDevice && styles.carImageSectionLeftSmall]}>
                    <View style={[styles.carImageWrapperLeft, isSmallDevice && styles.carImageWrapperLeftSmall]}>
                      {item.image ? (
                        <Image
                          source={item.image}
                          style={[
                            styles.carImage,
                            isUrbania && styles.refCarImageUrbania,
                          ]}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={[styles.carImage, { alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="car-outline" size={24} color="#cbd5e1" />
                        </View>
                      )}
                    </View>
                  </View>

                  {/* RIGHT: Contents Section */}
                  <View style={styles.cardContentsRight}>
                    {/* Optional Badges row at top (e.g. Recommended, Diesel with Boot) */}
                    {(isRecommended || item.badge === 'DIESEL WITH BOOT') ? (
                      <View style={styles.refTopBadgesRow}>
                        {isRecommended ? (
                          <View style={styles.refBadgePill}>
                            <Text style={styles.refBadgeText}>Recommended</Text>
                          </View>
                        ) : null}
                        {item.badge === 'DIESEL WITH BOOT' ? (
                          <View style={[styles.refBadgePill, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                            <Text style={[styles.refBadgeText, { color: '#166534' }]}>Diesel with Boot</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Columns Row: Info Column on LEFT, Action Column on RIGHT */}
                    <View style={styles.refColumnsRow}>
                      {/* Details Column */}
                      <View style={styles.refInfoCol}>
                        {/* Car Name */}
                        <Text
                          style={[styles.refVehicleName, isSmallDevice && styles.refVehicleNameSmall]}
                          numberOfLines={1}
                          adjustsFontSizeToFit={true}
                          minimumFontScale={0.8}
                        >
                          {getCategoryDisplayName(item)}
                        </Text>

                        {!!getModelsDisplayName(item) && (
                          <Text
                            style={[styles.refModelsText, isSmallDevice && styles.refModelsTextSmall]}
                            numberOfLines={1}
                            adjustsFontSizeToFit={true}
                            minimumFontScale={0.8}
                          >
                            {getModelsDisplayName(item)}
                          </Text>
                        )}

                        {/* Spec Icons Row: 👤 4+1 | 💼 3 | ❄️ A/C */}
                        <View style={[styles.refSpecsRow, isSmallDevice && styles.refSpecsRowSmall]}>
                          <View style={styles.refSpecItem}>
                            <Ionicons name="person" size={isSmallDevice ? 11.5 : 13} color="#475569" />
                            <Text style={[styles.refSpecText, isSmallDevice && styles.refSpecTextSmall]}>{seatsLabel}</Text>
                          </View>

                          <Text style={styles.refSpecDivider}>|</Text>

                          <View style={styles.refSpecItem}>
                            <Ionicons name="briefcase" size={isSmallDevice ? 11.5 : 13} color="#475569" />
                            <Text style={[styles.refSpecText, isSmallDevice && styles.refSpecTextSmall]}>{bagsLabel}</Text>
                          </View>

                          <Text style={styles.refSpecDivider}>|</Text>

                          <View style={styles.refSpecItem}>
                            <Ionicons name="snow" size={isSmallDevice ? 11.5 : 13} color="#475569" />
                            <Text style={[styles.refSpecText, isSmallDevice && styles.refSpecTextSmall]}>A/C</Text>
                          </View>
                        </View>

                        {/* Included KM: e.g. 628 km included */}
                        <Text style={[styles.refKmsLimitText, isSmallDevice && styles.refKmsLimitTextSmall]} numberOfLines={1}>
                          {t('selectCab.kmIncluded', {
                            km: Math.max(item.minKm, Math.round(estimatedKm)),
                            defaultValue: `${Math.max(item.minKm, Math.round(estimatedKm))} km included`,
                          })}
                        </Text>
                      </View>

                      {/* Right Column: Fare and Select Button */}
                      <View style={[styles.refActionCol, isSmallDevice && styles.refActionColSmall]}>
                        <Text
                          style={[styles.refPriceText, isSmallDevice && styles.refPriceTextSmall]}
                          numberOfLines={1}
                          adjustsFontSizeToFit={true}
                          minimumFontScale={0.8}
                        >
                          ₹ {totalFare.toLocaleString('en-IN')}
                        </Text>

                        <TouchableOpacity
                          style={[styles.refSelectBtn, isSmallDevice && styles.refSelectBtnSmall]}
                          onPress={() => onSelectCabItem(item, false)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.refSelectBtnText, isSmallDevice && styles.refSelectBtnTextSmall]}>
                            {t('selectCab.selectBtn', { defaultValue: 'Select' })}
                          </Text>
                          <Ionicons name="chevron-forward" size={isSmallDevice ? 11 : 12.5} color="#ffffff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Fuel Option Selection: Radio-style row */}
                {item.fuelTypes && item.fuelTypes.length > 0 && (
                  <View style={[styles.refFuelRow, isSmallDevice && styles.refFuelRowSmall]}>
                    {item.fuelTypes.map((fuel) => {
                      const isSelectedFuel = (selectedFuels[item.id] || item.fuelTypes[0]) === fuel;
                      const isDiesel = fuel.toUpperCase() === 'DIESEL';
                      const displayFuel =
                        fuel.toUpperCase() === 'CNG' || fuel.toUpperCase().includes('CNG')
                          ? 'CNG / Petrol'
                          : fuel.toUpperCase() === 'PETROL'
                            ? 'Petrol'
                            : 'Diesel';
                      return (
                        <TouchableOpacity
                          key={fuel}
                          style={[styles.refFuelCheckboxBtn, isSelectedFuel && styles.refFuelCheckboxBtnActive]}
                          onPress={() => {
                            setSelectedFuels((prev) => ({ ...prev, [item.id]: fuel }));
                            if (item.id === 'SWIFT_DZIRE' && fuel.toUpperCase() === 'DIESEL') {
                              setSelectedCarriers((prev) => ({ ...prev, [item.id]: false }));
                            }
                          }}
                          activeOpacity={0.7}
                          hitSlop={{ top: 4, bottom: 4, left: 3, right: 3 }}
                        >
                          <Ionicons
                            name={isSelectedFuel ? 'radio-button-on' : 'radio-button-off'}
                            size={isSmallDevice ? 13.5 : 15.5}
                            color={isSelectedFuel ? 'rgb(240, 117, 15)' : '#64748b'}
                          />
                          <Text
                            style={[
                              styles.refFuelText,
                              isSmallDevice && styles.refFuelTextSmall,
                              isSelectedFuel && styles.refFuelTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {displayFuel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* TOP ADD-ONS ROW: Add Requirements (left) & Roof Carrier (right) */}
                <View style={styles.refAddReqRowSection}>
                  {/* Add Requirements Button */}
                  <TouchableOpacity
                    style={[
                      styles.refCardAddReqBtn,
                      !showRoofCarrier && { flex: undefined, alignSelf: 'flex-start' },
                      isSmallDevice && styles.refCardAddReqBtnSmall,
                    ]}
                    onPress={() => onSelectCabItem(item, true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Ionicons
                      name="add"
                      size={isSmallDevice ? 15 : 17}
                      color="rgb(240, 117, 15)"
                    />
                    <Text
                      style={[styles.refCardAddReqText, isSmallDevice && styles.refCardAddReqTextSmall]}
                      numberOfLines={1}
                    >
                      {t('selectCab.addRequirements', { defaultValue: 'Add Requirements' })}
                    </Text>
                  </TouchableOpacity>

                  {/* Roof Carrier (No line separator, widened box) */}
                  {showRoofCarrier ? (
                    <TouchableOpacity
                      style={[
                        styles.refCarrierCheckBtn,
                        isSmallDevice && styles.refCarrierCheckBtnSmall,
                        selectedCarriers[item.id] && styles.refCarrierCheckBtnActive,
                        !item.hasCarrier && styles.refCarrierCheckBtnDisabled,
                      ]}
                      onPress={() => {
                        if (item.hasCarrier) {
                          toggleCarrier(item.id);
                        }
                      }}
                      activeOpacity={item.hasCarrier ? 0.7 : 1}
                      disabled={!item.hasCarrier}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Ionicons
                        name={
                          !item.hasCarrier
                            ? 'radio-button-off'
                            : selectedCarriers[item.id]
                              ? 'radio-button-on'
                              : 'radio-button-off'
                        }
                        size={isSmallDevice ? 14 : 16}
                        color={
                          !item.hasCarrier
                            ? '#cbd5e1'
                            : selectedCarriers[item.id]
                              ? 'rgb(240, 117, 15)'
                              : '#64748b'
                        }
                      />
                      <Text
                        style={[
                          styles.refCarrierLabel,
                          isSmallDevice && styles.refCarrierLabelSmall,
                          selectedCarriers[item.id] && styles.refCarrierLabelActive,
                          !item.hasCarrier && styles.refCarrierLabelDisabled,
                        ]}
                        numberOfLines={1}
                      >
                        Roof Carrier
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* BOTTOM DETAILS ROW: View Details ⌵ / Hide Details ⌃ */}
                <View style={styles.refCardBottomRow}>
                  <TouchableOpacity
                    style={styles.refViewDetailsBtn}
                    onPress={() => setSelectedVehicleId(isExpanded ? null : item.id)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={[styles.refViewDetailsText, isSmallDevice && styles.refViewDetailsTextSmall]}>
                      {isExpanded
                        ? t('selectCab.hideDetails', { defaultValue: 'Hide Details' })
                        : t('selectCab.viewDetails', { defaultValue: 'View Details' })}
                    </Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={isSmallDevice ? 13 : 15}
                      color="#2563eb"
                      style={{ marginLeft: 2 }}
                    />
                  </TouchableOpacity>
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
                          <Text style={styles.seaterPickerChangeText}>
                            {t('selectCab.change', { defaultValue: 'Change' })}
                          </Text>
                          <Ionicons name="chevron-down" size={13} color="rgb(240, 117, 15)" />
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* Purpose Pill */}
                    <View style={styles.purposePill}>
                      <Text style={styles.purposePillText}>
                        {t(`selectCab.fleets.${item.id}.purpose`, { defaultValue: item.purpose })}
                      </Text>
                    </View>

                    {/* Feature Checklist */}
                    <View style={styles.featureList}>
                      {(() => {
                        const localizedFeatures = t(`selectCab.fleets.${item.id}.features`, { returnObjects: true });
                        const featuresList: string[] =
                          Array.isArray(localizedFeatures) && localizedFeatures.length > 0
                            ? (localizedFeatures as string[])
                            : item.features;
                        return featuresList.map((feat, idx) => (
                          <View key={idx} style={styles.featureItem}>
                            <Ionicons name="checkmark" size={14} color="rgb(240, 117, 15)" />
                            <Text style={styles.featureItemText}>{feat}</Text>
                          </View>
                        ));
                      })()}
                    </View>

                    {/* Fuel Types & Roof Carrier Row */}
                    <View style={{ marginBottom: 8, gap: 5 }}>
                      {/* Fuel Options */}
                      {item.fuelTypes && item.fuelTypes.length > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b' }}>
                            {t('selectCab.fuelsLabel', { defaultValue: 'Fuels:' })}
                          </Text>
                          {item.fuelTypes.map((fuel) => (
                            <View
                              key={fuel}
                              style={{
                                backgroundColor: '#f1f5f9',
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 5,
                                borderWidth: 1,
                                borderColor: '#e2e8f0',
                              }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: '800', color: '#334155' }}>{fuel}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {/* Carrier Badge */}
                      {showRoofCarrier ? (
                        <View style={{ gap: 5 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              paddingVertical: 5,
                              paddingHorizontal: 8,
                              borderRadius: 8,
                              backgroundColor: '#f0fdf4',
                              borderWidth: 1,
                              borderColor: '#bbf7d0',
                            }}
                          >
                            <Ionicons name="checkbox" size={14} color="#16a34a" />
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: '#15803d',
                                flex: 1,
                              }}
                            >
                              {t('selectCab.carrierAvailable', { defaultValue: 'Roof Carrier Available' })}
                            </Text>
                          </View>

                          {item.carrierExcludedCars ? (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingVertical: 5,
                                paddingHorizontal: 8,
                                borderRadius: 8,
                                backgroundColor: '#fffbeb',
                                borderWidth: 1,
                                borderColor: '#fde68a',
                              }}
                            >
                              <Ionicons name="alert-circle" size={14} color="#d97706" />
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  color: '#92400e',
                                  flex: 1,
                                }}
                              >
                                {t('selectCab.excludedPrefix', { defaultValue: 'Excluded: ' })}
                                {t(`selectCab.fleets.${item.id}.carrierExcludedCars`, {
                                  defaultValue: item.carrierExcludedCars,
                                })}
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
                            paddingVertical: 5,
                            paddingHorizontal: 8,
                            borderRadius: 8,
                            backgroundColor: '#f8fafc',
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                          }}
                        >
                          <Ionicons name="alert-circle-outline" size={14} color="#64748b" />
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: '#64748b',
                              flex: 1,
                            }}
                          >
                            {isDzireDiesel
                              ? 'Sedan Class (Large Dedicated Boot Trunk - No Roof Carrier)'
                              : item.carrierExcludedReason
                                ? t(`selectCab.fleets.${item.id}.carrierExcludedReason`, {
                                    defaultValue: item.carrierExcludedReason,
                                  })
                                : t('selectCab.noRoofCarrier', {
                                    defaultValue: 'No Roof Carrier (Trunk Boot Space Only)',
                                  })}
                          </Text>
                        </View>
                      )}
                    </View>

                    {calculationBreakdown ? (
                      <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, marginBottom: 8 }}>
                        <Text style={{ fontSize: 11, color: '#c2410c', fontWeight: '600' }}>
                          Rate breakdown: {calculationBreakdown}
                        </Text>
                      </View>
                    ) : null}


                  </View>
                )}
              </View>
            );
          })}
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
                <Ionicons name="layers-outline" size={14} color="rgb(240, 117, 15)" />
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
                        <Ionicons name="people" size={16} color={isSelected ? '#ffffff' : 'rgb(240, 117, 15)'} />
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
                        <Ionicons name="checkmark-circle" size={22} color="rgb(240, 117, 15)" style={{ marginTop: 4 }} />
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
                        <Ionicons name="checkmark-circle" size={22} color="rgb(240, 117, 15)" style={{ marginTop: 4 }} />
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
                        <Ionicons name="checkmark-circle" size={22} color="rgb(240, 117, 15)" style={{ marginTop: 4 }} />
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

      {/* Tempo Traveller & Force Urbania Fleet Availability Notice Modal */}
      <Modal
        visible={!!pendingFleetItem}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPendingFleetItem(null)}
      >
        <TouchableOpacity
          style={styles.fleetNoticeOverlay}
          activeOpacity={1}
          onPress={() => setPendingFleetItem(null)}
        >
          <TouchableOpacity
            style={styles.fleetNoticeCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.fleetNoticeHeader}>
              <View style={styles.fleetNoticeIconBox}>
                <Ionicons name="bus" size={24} color="rgb(240, 117, 15)" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.fleetNoticeTitle}>Fleet Availability Check</Text>
                <Text style={styles.fleetNoticeSub}>
                  {pendingFleetItem?.item.name || 'Group Vehicle'} (Large Fleet)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.fleetNoticeCloseBtn}
                onPress={() => setPendingFleetItem(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Vehicle Preview Card */}
            {pendingFleetItem && (
              <View style={styles.fleetNoticePreviewBox}>
                <Image
                  source={pendingFleetItem.item.image}
                  style={styles.fleetNoticeImage}
                  resizeMode="contain"
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.fleetNoticeVehicleName}>{pendingFleetItem.item.name}</Text>
                  <Text style={styles.fleetNoticeVehicleModel} numberOfLines={1}>
                    {pendingFleetItem.item.models}
                  </Text>
                  <View style={styles.fleetNoticeBadgeRow}>
                    <Text style={styles.fleetNoticeBadge}>
                      👥 {pendingFleetItem.item.passengers} Travellers
                    </Text>
                    <Text style={styles.fleetNoticeBadge}>
                      🧳 {pendingFleetItem.item.luggage} Bags
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Informational Message Steps */}
            <View style={styles.fleetNoticeInfoBox}>
              <View style={styles.fleetNoticePoint}>
                <View style={styles.fleetPointNumber}>
                  <Text style={styles.fleetPointNumberText}>1</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fleetPointTitle}>Kindly Book Your Trip</Text>
                  <Text style={styles.fleetPointDesc}>
                    Place your booking request. Our team will verify fleet availability with our operations manager.
                  </Text>
                </View>
              </View>

              <View style={styles.fleetNoticePoint}>
                <View style={[styles.fleetPointNumber, { backgroundColor: '#dcfce7' }]}>
                  <Text style={[styles.fleetPointNumberText, { color: '#15803d' }]}>✓</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fleetPointTitle}>No Need to Pay Right Now</Text>
                  <Text style={styles.fleetPointDesc}>
                    Zero advance payment is required at checkout. Your booking request will be submitted instantly.
                  </Text>
                </View>
              </View>

              <View style={styles.fleetNoticePoint}>
                <View style={[styles.fleetPointNumber, { backgroundColor: '#e0e7ff' }]}>
                  <Text style={[styles.fleetPointNumberText, { color: '#4338ca' }]}>2</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fleetPointTitle}>Pay from "My Bookings" After Approval</Text>
                  <Text style={styles.fleetPointDesc}>
                    Admin will review and approve availability in the admin panel. Once approved, you can easily pay directly from your My Bookings page.
                  </Text>
                </View>
              </View>
            </View>

            {/* Bottom Actions */}
            <View style={styles.fleetNoticeActions}>
              <TouchableOpacity
                style={styles.fleetNoticeProceedBtn}
                onPress={() => {
                  if (pendingFleetItem) {
                    const item = pendingFleetItem.item;
                    const openReq = pendingFleetItem.openRequirements;
                    setPendingFleetItem(null);
                    handleBookNow(item, openReq);
                  }
                }}
                activeOpacity={0.88}
              >
                <Text style={styles.fleetNoticeProceedText}>Book Now (Pay on Approval) →</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.fleetNoticeCancelBtn}
                onPress={() => setPendingFleetItem(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.fleetNoticeCancelText}>Choose Another Cab</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Auth Modal if needed */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={() => { }}
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
    color: 'rgb(22, 34, 50)',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgb(240, 117, 15)',
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
    color: 'rgb(240, 117, 15)',
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
    color: 'rgb(240, 117, 15)',
  },
  stepIndicatorActive: {
    position: 'absolute',
    bottom: -10,
    height: 2.5,
    width: '100%',
    backgroundColor: 'rgb(240, 117, 15)',
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
    fontSize: 15,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    flexShrink: 1,
    lineHeight: 20,
  },
  routeDateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 140,
    justifyContent: 'flex-start',
    flexShrink: 0,
  },
  routeDateTimeText: {
    fontSize: 13,
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
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '600',
    lineHeight: 16,
  },
  editSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    flexShrink: 0,
  },
  editSearchBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
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
    paddingHorizontal: 13,
    paddingTop: 6,
  },
  availableVehiclesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 2,
    gap: 10,
  },
  availableVehiclesTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.3,
    marginLeft: 6,
    flex: 1,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingVertical: 4,
    paddingHorizontal: 4,
    flexShrink: 0,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 8,
    paddingBottom: 6,
    paddingLeft: 10,
    paddingRight: 10,
    marginBottom: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    overflow: 'hidden',
  },
  refCabCardActive: {
    borderColor: '#fb923c',
    borderWidth: 1.3,
    backgroundColor: '#ffffff',
    shadowColor: 'rgb(240, 117, 15)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  refCardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingBottom: 0,
  },

  /* ============================================================
     CAR IMAGE SECTION (Positioned to the LEFT of contents)
     Separated so width, height & paddings can be adjusted freely
     ============================================================ */
  carImageSectionLeft: {
    width: 82,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 8,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  carImageSectionLeftSmall: {
    width: 74,
    marginRight: 6,
  },
  carImageWrapperLeft: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carImageWrapperLeftSmall: {
    height: 48,
  },
  carImage: {
    width: '100%',
    height: '100%',
  },
  refCarImage: {
    width: '100%',
    height: '100%',
  },
  refCarImageUrbania: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  refImageBadge: {
    position: 'absolute',
    top: -4,
    left: 0,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    zIndex: 2,
  },
  refImageBadgeText: {
    fontFamily: APP_FONT,
    fontSize: 9.5,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
    letterSpacing: 0.2,
  },

  /* ============================================================
     CONTENTS SECTION (To the RIGHT of car image)
     ============================================================ */
  cardContentsRight: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  refTopBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
    alignSelf: 'flex-start',
    flexWrap: 'wrap',
  },
  refColumnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  refInfoCol: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 4,
    paddingVertical: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  refTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  refVehicleName: {
    fontFamily: APP_FONT,
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 20,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  refVehicleNameSmall: {
    fontSize: 14.5,
    lineHeight: 18,
  },
  refBadgePill: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'center',
    flexShrink: 0,
  },
  refBadgeText: {
    fontFamily: APP_FONT,
    fontSize: 9,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
    letterSpacing: 0.1,
  },
  refModelsText: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  refModelsTextSmall: {
    fontSize: 10.5,
    marginBottom: 1,
  },
  refSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
    marginBottom: 1,
    maxWidth: '100%',
  },
  refSpecsRowSmall: {
    gap: 3,
    marginTop: 1,
    marginBottom: 1,
    maxWidth: '100%',
  },
  refSpecDivider: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '400',
    marginHorizontal: 1,
  },
  refSpecItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  refSpecText: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0,
  },
  refSpecTextSmall: {
    fontSize: 10.5,
  },
  refFuelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 12,
    paddingHorizontal: 2,
    marginTop: 4,
    marginBottom: 3,
  },
  refFuelRowSmall: {
    gap: 8,
    marginTop: 3,
    marginBottom: 2,
  },
  refFuelCheckboxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingVertical: 2,
    paddingHorizontal: 1,
  },
  refFuelCheckboxBtnActive: {},
  refFuelText: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: -0.1,
  },
  refFuelTextSmall: {
    fontSize: 11,
  },
  refFuelTextActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  refCarrierCheckBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 8,
    minHeight: 34,
  },
  refCarrierCheckBtnSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    gap: 4,
    minHeight: 30,
  },
  refCarrierCheckBtnActive: {
    borderColor: 'rgba(240, 117, 15, 0.45)',
    backgroundColor: '#fffaf5',
  },
  refActionCarrierCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    paddingVertical: 3,
    marginTop: 3,
  },
  refActionCarrierCheckBtnSmall: {
    paddingVertical: 2,
    marginTop: 2,
  },
  refCarrierCheckBtnDisabled: {
    opacity: 0.55,
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
  },
  refCarrierLabel: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: 0.1,
  },
  refCarrierLabelSmall: {
    fontSize: 11,
  },
  refCarrierLabelActive: {
    color: 'rgb(240, 117, 15)',
    fontWeight: '800',
  },
  refCarrierLabelDisabled: {
    color: '#94a3b8',
  },
  refCardAddReqBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 8,
    minHeight: 34,
  },
  refCardAddReqBtnSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    gap: 4,
    minHeight: 30,
  },
  refCardAddReqText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: 0.1,
  },
  refCardAddReqTextSmall: {
    fontSize: 11,
  },
  refAddReqRowSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    paddingTop: 5,
    paddingBottom: 3,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 3,
  },
  refAddReqDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  refCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 2,
    marginTop: 1,
  },
  refViewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  refViewDetailsText: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 0.3,
  },
  refViewDetailsTextSmall: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  refActionCol: {
    width: 86,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    paddingVertical: 0,
    marginLeft: 4,
  },
  refActionColSmall: {
    width: 78,
    marginLeft: 2,
  },
  refPriceBlock: {
    alignItems: 'flex-end',
    marginBottom: 3,
  },
  refPriceText: {
    fontFamily: APP_FONT,
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 20,
    letterSpacing: 0.1,
    textAlign: 'right',
    marginBottom: 3,
  },
  refPriceTextSmall: {
    fontSize: 15,
    lineHeight: 18,
    marginBottom: 2,
  },
  refGstText: {
    fontFamily: APP_FONT,
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 1,
    textAlign: 'right',
    letterSpacing: 0.1,
    fontWeight: '600',
  },
  refKmsLimitText: {
    fontFamily: APP_FONT,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'left',
    letterSpacing: 0.1,
    marginTop: 2,
    marginBottom: 0,
  },
  refKmsLimitTextSmall: {
    fontSize: 10.5,
    marginTop: 1,
  },
  refSelectBtn: {
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 7,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: '100%',
    height: 27,
  },
  refSelectBtnSmall: {
    height: 25,
    paddingHorizontal: 6,
  },
  refSelectBtnText: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
  refSelectBtnTextSmall: {
    fontSize: 11,
  },
  refExpandedSection: {
    marginTop: 6,
  },
  refDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 8,
  },
  selectedCardSection: {
    marginBottom: 20,
  },
  selectedCardHeading: {
    fontSize: 15,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.6,
  },
  rateContainer: {
    alignItems: 'flex-end',
  },
  totalFareText: {
    fontSize: 22,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
  },
  vehicleModels: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1,
  },
  purposePill: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    marginBottom: 8,
  },
  purposePillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#c2410c',
  },
  featureList: {
    gap: 5,
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureItemText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  refAddReqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  refAddReqBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  bookCarBtn: {
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookCarBtnText: {
    color: '#ffffff',
    fontSize: 15,
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
    backgroundColor: 'rgb(22, 34, 50)',
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
    fontSize: 14,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
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
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    flex: 1,
    lineHeight: 16,
  },
  singleSeaterPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 8,
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
    fontSize: 14.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
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
    fontSize: 10.5,
    fontWeight: '800',
    color: '#c2410c',
    letterSpacing: 0.3,
  },
  seaterPickerSubText: {
    fontSize: 12,
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
    color: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    borderColor: 'rgb(240, 117, 15)',
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
    backgroundColor: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
  },
  seaterOptionLabelSelected: {
    color: 'rgb(240, 117, 15)',
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
  // Fleet Notice Modal Styles
  fleetNoticeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fleetNoticeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  fleetNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  fleetNoticeIconBox: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetNoticeTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.2,
  },
  fleetNoticeSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  fleetNoticeCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetNoticePreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 16,
  },
  fleetNoticeImage: {
    width: 80,
    height: 52,
  },
  fleetNoticeVehicleName: {
    fontSize: 15,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  fleetNoticeVehicleModel: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  fleetNoticeBadgeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  fleetNoticeBadge: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  fleetNoticeInfoBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fleetNoticePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  fleetPointNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  fleetPointNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
  },
  fleetPointTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    marginBottom: 2,
  },
  fleetPointDesc: {
    fontSize: 11,
    lineHeight: 16,
    color: '#475569',
  },
  fleetNoticeActions: {
    gap: 8,
  },
  fleetNoticeProceedBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  fleetNoticeProceedText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  fleetNoticeCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleetNoticeCancelText: {
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '600',
  },
});
