import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { safeNavigate } from '../lib/safeNav';
import { LocationPickerModal } from '../components/LocationPickerModal';
import { DatePickerModal } from '../components/DatePickerModal';
import { TimePickerModal, isDateToday } from '../components/TimePickerModal';
import BookingFlowHeader from '../components/BookingFlowHeader';
import { ALL_LOCATIONS, PlaceLocation, isAirportLocation, isSameLocation } from '../lib/locations';

type TripType = 'ONEWAY' | 'ROUND' | 'LOCAL' | 'AIRPORT' | 'CORPORATE' | 'TOUR';

interface TripTypeMeta {
  id: TripType;
  label: string;
  subtitle: string;
  iconName: string;
  iconFamily?: 'Ionicons' | 'MaterialCommunityIcons';
}

function getUpcomingPickupTime(dateStr?: string, currentVal?: string): string {
  const isToday = isDateToday(dateStr);
  if (!isToday) {
    return currentVal || '09:00';
  }
  const now = new Date();
  let h = now.getHours();
  let m = now.getMinutes();
  
  if (m < 30) {
    m = 30;
  } else {
    h += 1;
    m = 0;
  }
  
  if (h >= 24) return '23:30';

  const defaultSlot = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (currentVal && currentVal.includes(':')) {
    const [ch, cm] = currentVal.split(':').map(Number);
    const currTotal = ch * 60 + cm;
    const nowTotal = now.getHours() * 60 + now.getMinutes();
    if (currTotal >= nowTotal) {
      return currentVal;
    }
  }
  return defaultSlot;
}

const TRIP_TYPES_META: TripTypeMeta[] = [
  { id: 'ONEWAY', label: 'One-Way Drop', subtitle: 'Inter-city & inter-state travel', iconFamily: 'MaterialCommunityIcons', iconName: 'arrow-right-bold' },
  { id: 'ROUND', label: 'Round Trip', subtitle: 'Multi-day journeys', iconFamily: 'MaterialCommunityIcons', iconName: 'swap-horizontal-bold' },
  { id: 'AIRPORT', label: 'Airport Transfer', subtitle: 'Pickup & drop to airport', iconFamily: 'Ionicons', iconName: 'airplane' },
  { id: 'LOCAL', label: 'Local Rental', subtitle: 'Hourly packages', iconFamily: 'Ionicons', iconName: 'time' },
  { id: 'CORPORATE', label: 'Corporate Travel', subtitle: 'Business & official travel', iconFamily: 'Ionicons', iconName: 'briefcase' },
  { id: 'TOUR', label: 'Tour & Pilgrimage', subtitle: 'Family tours and pilgrimages', iconFamily: 'Ionicons', iconName: 'business' },
];

const AIRPORT_LIST: PlaceLocation[] = [
  { label: 'Mangaluru Airport (IXE)', sublabel: 'Bajpe Terminal, Mangaluru', category: 'AIRPORTS', lat: 12.9613, lng: 74.8901 },
  { label: 'Kempegowda Intl Airport (BLR)', sublabel: 'Devanahalli Airport, Bengaluru', category: 'AIRPORTS', lat: 13.1986, lng: 77.7066 },
  { label: 'Mysuru Airport (MYQ)', sublabel: 'Mandakalli, Mysuru', category: 'AIRPORTS', lat: 12.2289, lng: 76.6543 },
  { label: 'Goa Dabolim Airport (GOI)', sublabel: 'Dabolim, South Goa', category: 'AIRPORTS', lat: 15.3808, lng: 73.8314 },
];

function parseDdMmYyyy(str: string): Date {
  if (!str) return new Date();
  const parts = str.split('-').map(Number);
  if (parts.length === 3) {
    if (parts[0] > 1000) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
  }
  return new Date();
}

function formatDdMmYyyy(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatTime12Display(timeStr: string): string {
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  const [hourStr, minStr] = timeStr.split(':');
  const hourNum = parseInt(hourStr, 10);
  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
  return `${displayHour}:${minStr} ${ampm}`;
}

function formatFriendlyDate(str: string): string {
  if (!str) return '';
  const d = parseDdMmYyyy(str);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const day = d.getDate();
  const month = monthNames[d.getMonth()];

  if (isToday) {
    return `Today, ${day} ${month}`;
  }
  if (isTomorrow) {
    return `Tomorrow, ${day} ${month}`;
  }
  return `${dayName}, ${day} ${month}`;
}

export default function TripDetailsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  // Active Trip Type
  const initialType = ((params.tripType as string) || (params.category as string) || 'ONEWAY') as TripType;
  const [tripType, setTripType] = useState<TripType>(initialType);
  const [showTypePickerModal, setShowTypePickerModal] = useState(false);

  // Locations (Default to null so customer explicitly selects them)
  const [pickupLocation, setPickupLocation] = useState<PlaceLocation | null>(() => {
    if (params.pickupJson) {
      try {
        return JSON.parse(params.pickupJson as string);
      } catch {}
    }
    if (params.pickup) {
      const found = ALL_LOCATIONS.find((l) => l.label.toLowerCase().includes((params.pickup as string).toLowerCase()));
      if (found) return found;
      return { label: params.pickup as string, sublabel: 'Selected Location', category: 'OUTSTATION', lat: 12.9141, lng: 74.8560 };
    }
    return null;
  });

  const [dropLocation, setDropLocation] = useState<PlaceLocation | null>(() => {
    if (params.dropJson) {
      try {
        return JSON.parse(params.dropJson as string);
      } catch {}
    }
    if (params.drop) {
      const found = ALL_LOCATIONS.find((l) => l.label.toLowerCase().includes((params.drop as string).toLowerCase()));
      if (found) return found;
      return { label: params.drop as string, sublabel: 'Selected Location', category: 'OUTSTATION', lat: 12.9141, lng: 74.8560 };
    }
    return null;
  });

  // Intermediate / Via Stops
  const [viaStops, setViaStops] = useState<PlaceLocation[]>([]);

  // Unified Route Location Picker Modal
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [routeModalTarget, setRouteModalTarget] = useState<'PICKUP' | 'STOP' | 'DROP'>('PICKUP');
  const [routeModalStopIndex, setRouteModalStopIndex] = useState<number>(0);

  const openRouteModal = (target: 'PICKUP' | 'STOP' | 'DROP', stopIdx: number = 0) => {
    setRouteModalTarget(target);
    setRouteModalStopIndex(stopIdx);
    setIsRouteModalOpen(true);
  };

  const handleAddStop = () => {
    if (viaStops.length >= 12) {
      Alert.alert('Maximum Stops', 'You can add up to 12 intermediate stops.');
      return;
    }
    openRouteModal('STOP', viaStops.length);
  };

  const handleEditStop = (index: number) => {
    openRouteModal('STOP', index);
  };

  const handleRemoveStop = (index: number) => {
    setViaStops((prev) => prev.filter((_, i) => i !== index));
  };

  // Modals
  const [isReturnDropModalOpen, setIsReturnDropModalOpen] = useState(false);
  const [returnDropLocation, setReturnDropLocation] = useState<PlaceLocation | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isReturnDatePickerOpen, setIsReturnDatePickerOpen] = useState(false);
  const [isReturnTimePickerOpen, setIsReturnTimePickerOpen] = useState(false);

  // Date & Time
  const todayStr = useMemo(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }, []);

  const [pickupDate, setPickupDate] = useState<string>((params.pickupDate as string) || '');
  const [pickupDateError, setPickupDateError] = useState(false);
  const [pickupTime, setPickupTime] = useState<string>((params.pickupTime as string) || '');

  // Return Date & Time for Round trips
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }, []);

  const [returnDate, setReturnDate] = useState<string>(tomorrowStr);
  const [returnTime, setReturnTime] = useState<string>((params.returnTime as string) || '');
  const [pickupTimeError, setPickupTimeError] = useState(false);
  const [returnTimeError, setReturnTimeError] = useState(false);


  const handleSetLeaveNow = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes() >= 30 ? 30 : 0).padStart(2, '0');
    setPickupDate(todayStr);
    setPickupDateError(false);
    setPickupTime(`${h}:${m}`);
    setPickupTimeError(false);
  };

  // Airport transfer direction & airport
  const [airportDirection, setAirportDirection] = useState<'TO_AIRPORT' | 'FROM_AIRPORT'>(
    (params.airportDirection as 'TO_AIRPORT' | 'FROM_AIRPORT') || 'TO_AIRPORT'
  );
  const [selectedAirport, setSelectedAirport] = useState<PlaceLocation | null>(() => {
    const dir = (params.airportDirection as 'TO_AIRPORT' | 'FROM_AIRPORT') || 'TO_AIRPORT';
    if (initialType === 'AIRPORT') {
      if (dir === 'TO_AIRPORT') {
        if (params.dropJson) {
          try {
            const parsed = JSON.parse(params.dropJson as string);
            if (parsed) return parsed;
          } catch {}
        }
        if (params.drop) {
          const found = ALL_LOCATIONS.find((l) => l.label.toLowerCase().includes((params.drop as string).toLowerCase()));
          if (found) return found;
          return { label: params.drop as string, sublabel: 'Airport Terminal', category: 'AIRPORTS', lat: 12.9613, lng: 74.8901 };
        }
      } else {
        if (params.pickupJson) {
          try {
            const parsed = JSON.parse(params.pickupJson as string);
            if (parsed) return parsed;
          } catch {}
        }
        if (params.pickup) {
          const found = ALL_LOCATIONS.find((l) => l.label.toLowerCase().includes((params.pickup as string).toLowerCase()));
          if (found) return found;
          return { label: params.pickup as string, sublabel: 'Airport Terminal', category: 'AIRPORTS', lat: 12.9613, lng: 74.8901 };
        }
      }
    }
    return null;
  });

  const handleSetAirportDirection = (dir: 'TO_AIRPORT' | 'FROM_AIRPORT') => {
    if (dir === airportDirection) return;
    setAirportDirection(dir);
    if (dir === 'FROM_AIRPORT') {
      if (!dropLocation && pickupLocation && !isAirportLocation(pickupLocation)) {
        setDropLocation(pickupLocation);
      }
    } else {
      if (!pickupLocation && dropLocation && !isAirportLocation(dropLocation)) {
        setPickupLocation(dropLocation);
      }
    }
  };
  const [flightNumber, setFlightNumber] = useState<string>((params.flightNumber as string) || '');

  // Local rental package
  const [localHours, setLocalHours] = useState<number>(8);

  // Corporate Travel State: "Book Once" vs "Daily Rides"
  const [corporateMode, setCorporateMode] = useState<'ONCE' | 'DAILY'>('ONCE');

  // Daily Rides Date Range ("from - to")
  const [corporateStartDate, setCorporateStartDate] = useState<string>((params.pickupDate as string) || todayStr);
  const corporateDefaultEndDate = useMemo(() => {
    const s = parseDdMmYyyy((params.pickupDate as string) || todayStr);
    const d = new Date(s);
    d.setDate(d.getDate() + 6); // 7 days default
    return formatDdMmYyyy(d);
  }, [params.pickupDate, todayStr]);
  const [corporateEndDate, setCorporateEndDate] = useState<string>(corporateDefaultEndDate);

  // Excluded dates within the from-to range
  const [corporateExcludedDates, setCorporateExcludedDates] = useState<string[]>([]);

  // Modals for Corporate Date Range
  const [isCorpStartDatePickerOpen, setIsCorpStartDatePickerOpen] = useState(false);
  const [isCorpEndDatePickerOpen, setIsCorpEndDatePickerOpen] = useState(false);

  // Corporate Multiple Pickup Times (with (+) button)
  const [corporatePickupTimes, setCorporatePickupTimes] = useState<string[]>(() => {
    if (params.pickupTime) return [params.pickupTime as string];
    return ['09:00'];
  });
  const [activeEditingTimeIndex, setActiveEditingTimeIndex] = useState<number | null>(null);
  const [isCorpTimePickerOpen, setIsCorpTimePickerOpen] = useState(false);

  // Compute list of all dates in the [from - to] range
  const corporateDatesList = useMemo(() => {
    const start = parseDdMmYyyy(corporateStartDate);
    const end = parseDdMmYyyy(corporateEndDate);
    if (end < start) {
      return [{
        formatted: corporateStartDate,
        dayName: start.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: String(start.getDate()).padStart(2, '0'),
        monthName: start.toLocaleDateString('en-US', { month: 'short' }),
        isWeekend: start.getDay() === 0 || start.getDay() === 6,
      }];
    }

    const list: {
      formatted: string;
      dayName: string;
      dayNum: string;
      monthName: string;
      isWeekend: boolean;
    }[] = [];

    const current = new Date(start);
    let count = 0;
    while (current <= end && count < 60) {
      const formatted = formatDdMmYyyy(current);
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      list.push({
        formatted,
        dayName: current.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: String(current.getDate()).padStart(2, '0'),
        monthName: current.toLocaleDateString('en-US', { month: 'short' }),
        isWeekend,
      });
      current.setDate(current.getDate() + 1);
      count++;
    }
    return list;
  }, [corporateStartDate, corporateEndDate]);

  const activeDatesCount = useMemo(() => {
    return corporateDatesList.filter((d) => !corporateExcludedDates.includes(d.formatted)).length;
  }, [corporateDatesList, corporateExcludedDates]);

  const hasWeekendExcluded = useMemo(() => {
    const weekends = corporateDatesList.filter((d) => d.isWeekend).map((d) => d.formatted);
    return weekends.length > 0 && weekends.every((w) => corporateExcludedDates.includes(w));
  }, [corporateDatesList, corporateExcludedDates]);

  const handleToggleExcludeDate = (dateStr: string) => {
    setCorporateExcludedDates((prev) => {
      if (prev.includes(dateStr)) {
        return prev.filter((d) => d !== dateStr);
      } else {
        return [...prev, dateStr];
      }
    });
  };

  const handleExcludeWeekends = () => {
    const weekends = corporateDatesList.filter((d) => d.isWeekend).map((d) => d.formatted);
    if (weekends.length === 0) return;
    setCorporateExcludedDates((prev) => {
      const allWeekendsExcluded = weekends.every((w) => prev.includes(w));
      if (allWeekendsExcluded) {
        return prev.filter((d) => !weekends.includes(d));
      } else {
        return Array.from(new Set([...prev, ...weekends]));
      }
    });
  };

  const handleIncludeAllDates = () => {
    setCorporateExcludedDates([]);
  };

  const handleAddPickupTime = () => {
    if (corporatePickupTimes.length >= 4) {
      Alert.alert(t('tripDetails.maxPickupTimes', { defaultValue: 'Maximum Pickup Times' }), t('tripDetails.maxPickupTimesMsg', { defaultValue: 'You can schedule up to 4 pickup times per day.' }));
      return;
    }
    const nextSlot = corporatePickupTimes.length === 1 ? '18:00' : '21:00';
    setCorporatePickupTimes((prev) => [...prev, nextSlot]);
    setActiveEditingTimeIndex(corporatePickupTimes.length);
    setIsCorpTimePickerOpen(true);
  };

  const handleRemovePickupTime = (index: number) => {
    if (corporatePickupTimes.length <= 1) return;
    setCorporatePickupTimes((prev) => prev.filter((_, i) => i !== index));
  };

  const activeTypeMeta = useMemo(() => {
    return TRIP_TYPES_META.find((t) => t.id === tripType) || TRIP_TYPES_META[0];
  }, [tripType]);

  const handleSwapLocations = () => {
    const temp = pickupLocation;
    setPickupLocation(dropLocation);
    setDropLocation(temp);
  };

  const handleProceed = () => {
    let finalPickup = pickupLocation?.label || '';
    let finalDrop = dropLocation?.label || '';
    let pLat = pickupLocation?.lat || 12.8634;
    let pLng = pickupLocation?.lng || 74.8436;
    let dLat = dropLocation?.lat || 12.9716;
    let dLng = dropLocation?.lng || 77.5946;

    if (tripType === 'AIRPORT') {
      if (airportDirection === 'TO_AIRPORT') {
        if (!pickupLocation) {
          Alert.alert(t('tripDetails.pickupLocationRequired', { defaultValue: 'Pickup Location Required' }), t('tripDetails.pleaseSelectPickup', { defaultValue: 'Please select your pickup location.' }));
          return;
        }
        if (!selectedAirport) {
          Alert.alert(t('tripDetails.airportRequired', { defaultValue: 'Airport Required' }), t('tripDetails.pleaseSelectAirport', { defaultValue: 'Please select a destination airport.' }));
          return;
        }
        finalPickup = pickupLocation.label;
        pLat = pickupLocation.lat;
        pLng = pickupLocation.lng;
        finalDrop = selectedAirport.label;
        dLat = selectedAirport.lat;
        dLng = selectedAirport.lng;
      } else {
        if (!selectedAirport) {
          Alert.alert('Airport Required', 'Please select a pickup airport.');
          return;
        }
        if (!dropLocation) {
          Alert.alert('Drop Location Required', 'Please select your drop location.');
          return;
        }
        finalPickup = selectedAirport.label;
        pLat = selectedAirport.lat;
        pLng = selectedAirport.lng;
        finalDrop = dropLocation.label;
        dLat = dropLocation.lat;
        dLng = dropLocation.lng;
      }
    } else if (tripType === 'LOCAL') {
      if (!pickupLocation) {
        Alert.alert(t('tripDetails.pickupLocationRequired', { defaultValue: 'Pickup Location Required' }), t('tripDetails.pleaseSelectPickup', { defaultValue: 'Please select your pickup location.' }));
        return;
      }
      finalDrop = `${localHours} Hours Package Area`;
      dLat = pLat + 0.05;
      dLng = pLng + 0.05;
    } else {
      if (!finalPickup) {
        Alert.alert(t('tripDetails.pickupLocationRequired', { defaultValue: 'Pickup Location Required' }), t('tripDetails.pleaseSelectPickupAlt', { defaultValue: 'Please select a pickup location.' }));
        return;
      }
      if (!finalDrop) {
        Alert.alert('Drop Location Required', 'Please select a drop location.');
        return;
      }
    }

    if (tripType !== 'CORPORATE') {
      if (!pickupDate) {
        setPickupDateError(true);
        setIsDatePickerOpen(true);
        return;
      }
      if (!pickupTime) {
        setPickupTimeError(true);
        setIsTimePickerOpen(true);
        return;
      }
      if ((tripType === 'ROUND' || tripType === 'TOUR') && !returnTime) {
        setReturnTimeError(true);
        setIsReturnTimePickerOpen(true);
        return;
      }
    }

    if (tripType === 'CORPORATE' && corporateMode === 'ONCE') {
      if (!pickupDate) {
        setPickupDateError(true);
        setIsDatePickerOpen(true);
        return;
      }
    }

    if (tripType === 'CORPORATE' && corporateMode === 'DAILY') {
      if (activeDatesCount === 0) {
        Alert.alert('No Dates Selected', 'Please include at least 1 date for your daily corporate rides.');
        return;
      }
    }

    const validViaStops = viaStops.filter((s) => s && s.label);
    const activeDates = corporateDatesList.filter((d) => !corporateExcludedDates.includes(d.formatted));

    const finalDate = tripType === 'CORPORATE' && corporateMode === 'DAILY'
      ? `${corporateStartDate} to ${corporateEndDate} (${activeDates.length} days)`
      : pickupDate;

    const finalTime = tripType === 'CORPORATE'
      ? corporatePickupTimes.map(formatTime12Display).join(', ')
      : formatTime12Display(pickupTime);

    // Navigate to Page 4 (Select a Cab) with all trip details
    safeNavigate(() => {
      router.push({
        pathname: '/select-cab',
        params: {
          tripType,
          pickup: finalPickup,
          drop: finalDrop,
          viaStops: JSON.stringify(validViaStops),
          date: finalDate,
          time: finalTime,
          flightNumber: tripType === 'AIRPORT' ? flightNumber.trim() : undefined,
          airportDirection: tripType === 'AIRPORT' ? airportDirection : undefined,
          returnDate: tripType === 'ROUND' || tripType === 'TOUR' ? returnDate : '',
          returnTime: tripType === 'ROUND' || tripType === 'TOUR' ? returnTime : '',
          returnDrop: tripType === 'ROUND' ? (returnDropLocation?.label || finalPickup) : undefined,
          localHours: String(localHours),
          pickupLat: String(pLat),
          pickupLng: String(pLng),
          dropLat: String(dLat),
          dropLng: String(dLng),
          corporateMode: tripType === 'CORPORATE' ? corporateMode : undefined,
          corporateStartDate: tripType === 'CORPORATE' && corporateMode === 'DAILY' ? corporateStartDate : undefined,
          corporateEndDate: tripType === 'CORPORATE' && corporateMode === 'DAILY' ? corporateEndDate : undefined,
          corporateTotalDays: tripType === 'CORPORATE' && corporateMode === 'DAILY' ? String(activeDates.length) : undefined,
          corporateActiveDatesJson: tripType === 'CORPORATE' && corporateMode === 'DAILY' ? JSON.stringify(activeDates.map((d) => d.formatted)) : undefined,
          corporateExcludedDatesJson: tripType === 'CORPORATE' && corporateMode === 'DAILY' ? JSON.stringify(corporateExcludedDates) : undefined,
          corporatePickupTimesJson: tripType === 'CORPORATE' ? JSON.stringify(corporatePickupTimes) : undefined,
        },
      });
    });
  };

  const getSelectedOptionHeader = () => {
    switch (tripType) {
      case 'AIRPORT':
        return { title: t('tripDetails.airportTransferTitle', { defaultValue: 'Airport Transfer' }), icon: 'airplane' as const };
      case 'LOCAL':
        return { title: t('tripDetails.localRentalTitle', { defaultValue: 'Local Rental' }), icon: 'time' as const };
      case 'CORPORATE':
        return { title: t('tripDetails.corporateTravelTitle', { defaultValue: 'Corporate Travel' }), icon: 'briefcase' as const };
      case 'TOUR':
        return { title: t('tripDetails.tourPilgrimageTitle', { defaultValue: 'Tour & Pilgrimage' }), icon: 'business' as const };
      case 'ROUND':
        return { title: t('tripDetails.roundTripTitle', { defaultValue: 'Round Trip' }), icon: 'repeat' as const };
      case 'ONEWAY':
      default:
        return { title: t('tripDetails.oneWayDropTitle', { defaultValue: 'One-Way Drop' }), icon: 'navigate' as const };
    }
  };
  const selectedHeader = getSelectedOptionHeader();

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={true} />

      {/* Unified 3-Step Funnel Header */}
      <BookingFlowHeader
        currentStep={1}
        title={t('tripDetails.enterTripDetails', { defaultValue: 'Enter Trip Details' })}
        subStepLabel={t('tripDetails.routeAndSchedule', { defaultValue: 'Route & Schedule' })}
        topInset={topInset}
        onBack={() => router.back()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Corporate Travel Booking Option: "Book Once" vs "Daily Rides" */}
        {tripType === 'CORPORATE' && (
          <View style={styles.corporateModeGroup}>
            <View style={styles.corporateModeRow}>
              <TouchableOpacity
                style={[
                  styles.corporateModeCard,
                  corporateMode === 'ONCE' && styles.corporateModeCardActive,
                ]}
                onPress={() => setCorporateMode('ONCE')}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.corporateCheckbox,
                    corporateMode === 'ONCE' && styles.corporateCheckboxActive,
                  ]}
                >
                  {corporateMode === 'ONCE' && (
                    <Ionicons name="checkmark" size={13} color="#ffffff" />
                  )}
                </View>
                <View style={styles.corporateModeTextCol}>
                  <Text
                    style={[
                      styles.corporateModeTitle,
                      corporateMode === 'ONCE' && styles.corporateModeTitleActive,
                    ]}
                  >
                    {t('tripDetails.bookOnce', { defaultValue: 'Book Once' })}
                  </Text>
                  <Text style={styles.corporateModeSub}>{t('tripDetails.bookOnceSub', { defaultValue: 'Single day ride' })}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.corporateModeCard,
                  corporateMode === 'DAILY' && styles.corporateModeCardActive,
                ]}
                onPress={() => setCorporateMode('DAILY')}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.corporateCheckbox,
                    corporateMode === 'DAILY' && styles.corporateCheckboxActive,
                  ]}
                >
                  {corporateMode === 'DAILY' && (
                    <Ionicons name="checkmark" size={13} color="#ffffff" />
                  )}
                </View>
                <View style={styles.corporateModeTextCol}>
                  <Text
                    style={[
                      styles.corporateModeTitle,
                      corporateMode === 'DAILY' && styles.corporateModeTitleActive,
                    ]}
                  >
                    {t('tripDetails.dailyRides', { defaultValue: 'Daily Rides' })}
                  </Text>
                  <Text style={styles.corporateModeSub}>{t('tripDetails.dailyRidesSub', { defaultValue: 'Daily commute' })}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Airport Transfer Direction Toggle */}
        {tripType === 'AIRPORT' && (
          <View style={styles.airportToggleGroup}>
            <TouchableOpacity
              style={[
                styles.airportToggleBtn,
                airportDirection === 'TO_AIRPORT' && styles.airportToggleBtnActive,
              ]}
              onPress={() => handleSetAirportDirection('TO_AIRPORT')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="airplane-outline"
                size={16}
                color={airportDirection === 'TO_AIRPORT' ? '#ffffff' : '#475569'}
              />
              <Text
                style={[
                  styles.airportToggleText,
                  airportDirection === 'TO_AIRPORT' && styles.airportToggleTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.85}
              >
                {t('tripDetails.goingToAirport', { defaultValue: 'Going to Airport' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.airportToggleBtn,
                airportDirection === 'FROM_AIRPORT' && styles.airportToggleBtnActive,
              ]}
              onPress={() => handleSetAirportDirection('FROM_AIRPORT')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="car-outline"
                size={16}
                color={airportDirection === 'FROM_AIRPORT' ? '#ffffff' : '#475569'}
              />
              <Text
                style={[
                  styles.airportToggleText,
                  airportDirection === 'FROM_AIRPORT' && styles.airportToggleTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.85}
              >
                {t('tripDetails.pickupFromAirport', { defaultValue: 'Pickup from Airport' })}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ============================================================== */}
        {/* SECTION: UNIFIED ROUTE JOURNEY TIMELINE CARD                  */}
        {/* ============================================================== */}
        <View style={styles.routeTimelineCard}>
          {/* Card Header: Route Title + Swap Button */}
          <View style={styles.routeCardHeader}>
            <View style={styles.routeHeaderLeft}>
              <Ionicons name={selectedHeader.icon} size={17} color="rgb(240, 117, 15)" />
              <Text style={styles.routeCardTitle}>{selectedHeader.title}</Text>
            </View>

            {/* Quick Swap Button for inter-city when no intermediate stops exist */}
            {tripType !== 'LOCAL' && tripType !== 'AIRPORT' && viaStops.length === 0 && (
              <TouchableOpacity
                style={styles.swapBadgeBtn}
                onPress={handleSwapLocations}
                activeOpacity={0.7}
              >
                <Ionicons name="swap-vertical" size={15} color="rgb(22, 34, 50)" />
                <Text style={styles.swapBadgeText}>Swap</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 1. PICKUP LOCATION */}
          <View style={styles.timelineRow}>
            <View style={styles.timelineContentCol}>
              <Text style={styles.microLabelPickup}>{t('tripDetails.pickupLocation', { defaultValue: 'PICKUP LOCATION' })}</Text>
              {tripType === 'AIRPORT' && airportDirection === 'FROM_AIRPORT' ? (
                <TouchableOpacity
                  style={styles.routeInputBox}
                  onPress={() => openRouteModal('PICKUP')}
                  activeOpacity={0.7}
                >
                  <View style={styles.routeInputIconCirclePickup}>
                    <Ionicons name="airplane" size={20} color="#16a34a" />
                  </View>
                  <View style={styles.inputTextContainer}>
                    <Text
                      style={[
                        styles.inputText,
                        !selectedAirport && styles.placeholderText,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedAirport ? selectedAirport.label : t('tripDetails.selectPickupAirport', { defaultValue: 'Select pickup airport' })}
                    </Text>
                    {selectedAirport && (
                      <Text style={styles.inputSubtext}>
                        {selectedAirport.sublabel || t('tripDetails.terminalPickup', { defaultValue: 'Terminal pickup point' })}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-down" size={16} color="#94a3b8" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.routeInputBox}
                  onPress={() => openRouteModal('PICKUP')}
                  activeOpacity={0.7}
                >
                  <View style={styles.routeInputIconCirclePickup}>
                    <Ionicons name="location" size={20} color="#16a34a" />
                  </View>
                  <View style={styles.inputTextContainer}>
                    <Text
                      style={[
                        styles.inputText,
                        !pickupLocation && styles.placeholderText,
                      ]}
                      numberOfLines={1}
                    >
                      {pickupLocation ? pickupLocation.label : t('tripDetails.enterPickupLocationPlaceholder', { defaultValue: 'Enter pickup location' })}
                    </Text>
                    {pickupLocation && (
                      <Text style={styles.inputSubtext}>
                        {pickupLocation.sublabel || pickupLocation.category || t('tripDetails.selectedLocation', { defaultValue: 'Selected Location' })}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="search" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}

            </View>
          </View>

          {/* 2. DYNAMIC VIA STOPS (IN BETWEEN PICKUP & DESTINATION DROP) */}
          {viaStops.map((stop, index) => (
            <View key={`via-stop-${index}`} style={styles.timelineRow}>
              <View style={styles.timelineContentCol}>
                <View style={styles.viaHeaderRow}>
                  <Text style={styles.microLabelVia}>STOP {index + 1} (VIA)</Text>
                  <TouchableOpacity
                    style={styles.removeViaInlineBtn}
                    onPress={() => handleRemoveStop(index)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={13} color="#ef4444" />
                    <Text style={styles.removeViaInlineText}>Remove</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.routeInputBox}
                  onPress={() => handleEditStop(index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.routeInputIconCircleVia}>
                    <Ionicons name="pin" size={18} color="rgb(22, 34, 50)" />
                  </View>
                  <View style={styles.inputTextContainer}>
                    <Text
                      style={[
                        styles.inputText,
                        !stop?.label && styles.placeholderText,
                      ]}
                      numberOfLines={1}
                    >
                      {stop?.label || `Select Stop ${index + 1}`}
                    </Text>
                    {stop?.sublabel ? (
                      <Text style={styles.inputSubtext}>{stop.sublabel}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="search" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* 3. DESTINATION DROP (OR LOCAL RENTAL PACKAGES) */}
          {tripType === 'LOCAL' ? (
            <View style={styles.timelineRow}>
              <View style={[styles.timelineContentCol, { paddingBottom: 0 }]}>
                <Text style={styles.microLabelDrop}>RENTAL DURATION & DISTANCE</Text>
                <View style={styles.packageRow}>
                  {[
                    { h: 4, km: 40, label: '4 hrs / 40 km' },
                    { h: 8, km: 80, label: '8 hrs / 80 km' },
                    { h: 12, km: 120, label: '12 hrs / 120 km' },
                  ].map((pkg) => {
                    const isActive = localHours === pkg.h;
                    return (
                      <TouchableOpacity
                        key={pkg.h}
                        style={[styles.packageCard, isActive && styles.packageCardActive]}
                        onPress={() => setLocalHours(pkg.h)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.packageHourText, isActive && styles.packageTextActive]}>
                          {pkg.h} Hours
                        </Text>
                        <Text style={[styles.packageKmText, isActive && styles.packageSubtextActive]}>
                          {pkg.km} km included
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.timelineRow}>
                <View style={[
                  styles.timelineContentCol,
                  !(tripType === 'ROUND' && pickupLocation && dropLocation) && { paddingBottom: 0 },
                ]}>
                <Text style={styles.microLabelDrop}>
                  {tripType === 'AIRPORT' && airportDirection === 'TO_AIRPORT'
                    ? t('tripDetails.destinationAirport', { defaultValue: 'DESTINATION AIRPORT' })
                    : t('tripDetails.destinationDrop', { defaultValue: 'DESTINATION DROP' })}
                </Text>

                {tripType === 'AIRPORT' && airportDirection === 'TO_AIRPORT' ? (
                  <TouchableOpacity
                    style={styles.routeInputBox}
                    onPress={() => openRouteModal('DROP')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.routeInputIconCircleDrop}>
                      <Ionicons name="airplane" size={20} color="#ef4444" />
                    </View>
                    <View style={styles.inputTextContainer}>
                      <Text
                        style={[
                          styles.inputText,
                          !selectedAirport && styles.placeholderText,
                        ]}
                        numberOfLines={1}
                      >
                        {selectedAirport ? selectedAirport.label : t('tripDetails.selectDestAirportPlaceholder', { defaultValue: 'Select destination airport' })}
                      </Text>
                      {selectedAirport && (
                        <Text style={styles.inputSubtext}>
                          {selectedAirport.sublabel || t('tripDetails.directDepartureDrop', { defaultValue: 'Direct Departure Drop' })}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-down" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.routeInputBox}
                    onPress={() => openRouteModal('DROP')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.routeInputIconCircleDrop}>
                      <Ionicons name="location" size={20} color="#ef4444" />
                    </View>
                    <View style={styles.inputTextContainer}>
                      <Text
                        style={[
                          styles.inputText,
                          !dropLocation && styles.placeholderText,
                        ]}
                        numberOfLines={1}
                      >
                        {dropLocation ? dropLocation.label : t('tripDetails.enterDestDropPlaceholder', { defaultValue: 'Enter destination drop' })}
                      </Text>
                      {dropLocation && (
                        <Text style={styles.inputSubtext}>
                          {dropLocation.sublabel || dropLocation.category || t('tripDetails.selectedLocation', { defaultValue: 'Selected Location' })}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="search" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}

                {/* 5. AIRPORT: Flight Number (first) & Add a Stop (last, in small) in ONE ROW / OTHER TRIPS: Add a Stop */}
                {tripType === 'AIRPORT' ? (
                  <View style={styles.flightAndStopRow}>
                    <View style={styles.flightInputBoxFlex}>
                      <TextInput
                        style={styles.flightInputField}
                        placeholder={t('tripDetails.flightNumberOptional', { defaultValue: 'Flight no. (optional)' })}
                        placeholderTextColor="#94a3b8"
                        value={flightNumber}
                        onChangeText={(text: string) => setFlightNumber(text.toUpperCase())}
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />
                      {flightNumber.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setFlightNumber('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {viaStops.length < 12 && (
                      <TouchableOpacity
                        style={styles.addViaPillBtnSmall}
                        onPress={handleAddStop}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={12} color="#ffffff" />
                        <Text style={styles.addViaPillTextSmall}>
                          {viaStops.length === 0 ? t('tripDetails.addStop', { defaultValue: 'Add a Stop' }) : t('tripDetails.addStopNum', { defaultValue: `Add Stop ${viaStops.length + 1}`, index: viaStops.length + 1 })}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  viaStops.length < 12 && (
                    <View style={styles.addViaRow}>
                      <TouchableOpacity
                        style={styles.addViaPillBtn}
                        onPress={handleAddStop}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={14} color="#ffffff" />
                        <Text style={styles.addViaPillText}>
                          {viaStops.length === 0 ? t('tripDetails.addStop', { defaultValue: 'Add a Stop' }) : t('tripDetails.addStopNum', { defaultValue: `Add Stop ${viaStops.length + 1}`, index: viaStops.length + 1 })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </View>
            </View>
          </>
        )}

          {/* 5. RETURN DROP (ROUND TRIP ONLY - SHOWN ONCE PICKUP & DROP SELECTED) */}
          {tripType === 'ROUND' && pickupLocation && dropLocation && (
            <View style={styles.timelineRow}>
              <View style={[styles.timelineContentCol, { paddingBottom: 0 }]}>
                <View style={styles.viaHeaderRow}>
                  <Text style={styles.microLabelReturn}>
                    BACK TO ({pickupLocation.label.split(',')[0].trim()})
                  </Text>
                  <View style={styles.roundTripPill}>
                    <Text style={styles.roundTripPillText}>ROUND TRIP RETURN</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.routeInputBox, styles.returnInputBox]}
                  onPress={() => setIsReturnDropModalOpen(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.routeInputIconCircleReturn}>
                    <Ionicons name="arrow-undo" size={15} color="rgb(22, 34, 50)" />
                  </View>
                  <View style={styles.inputTextContainer}>
                    <Text style={styles.inputText} numberOfLines={1}>
                      {returnDropLocation ? returnDropLocation.label : pickupLocation.label}
                    </Text>
                    <Text style={styles.inputSubtext}>
                      {returnDropLocation
                        ? (returnDropLocation.sublabel || 'Custom return drop point')
                        : 'Cab will drop you back at pickup point (Tap to change)'}
                    </Text>
                  </View>
                  <Ionicons name="search" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ============================================================== */}
        {/* SECTION: SCHEDULE (DATE & TIME)                                */}
        {/* ============================================================== */}
        {tripType === 'CORPORATE' && corporateMode === 'DAILY' ? (
          <View style={styles.scheduleCard}>
            <View style={styles.scheduleCardHeader}>
              <View style={styles.scheduleHeaderLeft}>
                <Ionicons name="calendar-outline" size={17} color="rgb(240, 117, 15)" />
                <Text style={styles.scheduleCardTitle}>{t('tripDetails.dailyRidesSchedule', { defaultValue: 'Daily Rides Schedule' })}</Text>
              </View>
            </View>

            {/* From - To Range Pickers */}
            <View style={styles.dateRangeRow}>
              <View style={styles.dateRangeCol}>
                <Text style={styles.dateRangeSubLabel}>{t('tripDetails.fromDate', { defaultValue: 'From Date' })}</Text>
                <TouchableOpacity
                  style={styles.dateRangeCard}
                  onPress={() => setIsCorpStartDatePickerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={18} color="rgb(22, 34, 50)" />
                  <Text style={styles.dateRangeCardText} numberOfLines={1}>
                    {corporateStartDate}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dateRangeArrow}>
                <Ionicons name="arrow-forward" size={18} color="#989daf" />
              </View>

              <View style={styles.dateRangeCol}>
                <Text style={styles.dateRangeSubLabel}>{t('tripDetails.toDate', { defaultValue: 'To Date' })}</Text>
                <TouchableOpacity
                  style={styles.dateRangeCard}
                  onPress={() => setIsCorpEndDatePickerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={18} color="rgb(22, 34, 50)" />
                  <Text style={styles.dateRangeCardText} numberOfLines={1}>
                    {corporateEndDate}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Interactive Dates Grid: Tap to Exclude / Include */}
            <View style={styles.dateGridContainer}>
              <View style={styles.dateGridHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.dateGridTitle}>
                    {t('tripDetails.includedDatesCount', { defaultValue: `Included Dates (${activeDatesCount})`, count: activeDatesCount })}
                  </Text>
                  <Text style={styles.dateGridSubtitle}>
                    {t('tripDetails.tapToExclude', { defaultValue: 'Tap any date below to exclude it from schedule' })}
                  </Text>
                </View>
                <View style={styles.dateGridBadge}>
                  <Text style={styles.dateGridBadgeText}>
                    {t('tripDetails.ridesBadge', {
                      defaultValue: `${activeDatesCount} ${activeDatesCount === 1 ? 'Ride' : 'Rides'}`,
                      count: activeDatesCount,
                      unit: activeDatesCount === 1 ? t('tripDetails.rideUnit', { defaultValue: 'Ride' }) : t('tripDetails.ridesUnit', { defaultValue: 'Rides' }),
                    })}
                  </Text>
                </View>
              </View>

              {/* Quick Actions (Exclude Weekends / Select All) */}
              <View style={styles.dateQuickActionsRow}>
                <TouchableOpacity
                  style={styles.quickActionBtn}
                  onPress={handleExcludeWeekends}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={13} color="rgb(22, 34, 50)" />
                  <Text style={styles.quickActionBtnText}>
                    {hasWeekendExcluded
                      ? t('tripDetails.includeWeekends', { defaultValue: 'Include Weekends' })
                      : t('tripDetails.excludeWeekends', { defaultValue: 'Exclude Weekends (Sat/Sun)' })}
                  </Text>
                </TouchableOpacity>

                {corporateExcludedDates.length > 0 && (
                  <TouchableOpacity
                    style={[styles.quickActionBtn, styles.quickActionBtnSecondary]}
                    onPress={handleIncludeAllDates}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-done" size={13} color="#475569" />
                    <Text style={styles.quickActionBtnTextSecondary}>
                      {t('tripDetails.includeAll', { defaultValue: 'Include All' })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Dates Cards Grid */}
              <View style={styles.datesGrid}>
                {corporateDatesList.map((item) => {
                  const isExcluded = corporateExcludedDates.includes(item.formatted);
                  return (
                    <TouchableOpacity
                      key={item.formatted}
                      style={[
                        styles.corpDateCard,
                        isExcluded ? styles.corpDateCardExcluded : styles.corpDateCardActive,
                      ]}
                      onPress={() => handleToggleExcludeDate(item.formatted)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.corpDateDayName,
                          isExcluded ? styles.corpTextExcluded : styles.corpTextActive,
                        ]}
                      >
                        {item.dayName}
                      </Text>
                      <Text
                        style={[
                          styles.corpDateDayNum,
                          isExcluded ? styles.corpTextExcluded : styles.corpTextActive,
                        ]}
                      >
                        {item.dayNum}
                      </Text>
                      <Text
                        style={[
                          styles.corpDateMonthName,
                          isExcluded ? styles.corpTextExcluded : styles.corpTextActive,
                        ]}
                      >
                        {item.monthName}
                      </Text>

                      {isExcluded ? (
                        <View style={styles.excludedBadge}>
                          <Text style={styles.excludedBadgeText}>Excluded</Text>
                        </View>
                      ) : (
                        <View style={styles.includedBadge}>
                          <Ionicons name="checkmark" size={10} color="#ffffff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Corporate Multiple Pickup Times */}
            <View style={{ marginTop: 6 }}>
              <View style={styles.pickupTimeHeaderRow}>
                <Text style={styles.dateTimeFieldLabel}>
                  {corporatePickupTimes.length > 1
                    ? t('tripDetails.pickupTimesCount', { defaultValue: `Pickup Times (${corporatePickupTimes.length})`, count: corporatePickupTimes.length })
                    : t('tripDetails.addPickupTime', { defaultValue: 'Pickup Time' })}
                </Text>
                <TouchableOpacity
                  style={styles.addTimeBtn}
                  onPress={handleAddPickupTime}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle" size={15} color="rgb(22, 34, 50)" />
                  <Text style={styles.addTimeBtnText}>{t('tripDetails.addPickupTime', { defaultValue: 'Add Pickup Time' })}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.corporateTimesList}>
                {corporatePickupTimes.map((time, idx) => (
                  <View key={idx} style={styles.corporateTimeRow}>
                    <TouchableOpacity
                      style={styles.corporateTimeBox}
                      onPress={() => {
                        setActiveEditingTimeIndex(idx);
                        setIsCorpTimePickerOpen(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="time-outline" size={18} color="rgb(22, 34, 50)" style={styles.inputIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.corporateTimeLabel}>
                          {idx === 0
                            ? t('tripDetails.morningPrimaryPickup', { defaultValue: 'Morning / Primary Pickup' })
                            : idx === 1
                            ? t('tripDetails.eveningReturnPickup', { defaultValue: 'Evening / Return Pickup' })
                            : t('tripDetails.pickupTimeN', { defaultValue: `Pickup Time ${idx + 1}`, n: idx + 1 })}
                        </Text>
                        <Text style={styles.inputText}>{formatTime12Display(time)}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#989daf" />
                    </TouchableOpacity>

                    {corporatePickupTimes.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeTimeBtn}
                        onPress={() => handleRemovePickupTime(idx)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : tripType === 'CORPORATE' ? (
          /* Corporate "Book Once" */
          <View style={styles.scheduleCard}>
            <View style={styles.scheduleCardHeader}>
              <View style={styles.scheduleHeaderLeft}>
                <Ionicons name="calendar-outline" size={17} color="rgb(240, 117, 15)" />
                <Text style={styles.scheduleCardTitle}>{t('tripDetails.schedule', { defaultValue: 'Schedule' })}</Text>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.dateTimeFieldLabel}>{t('tripDetails.pickupDate', { defaultValue: 'Pickup Date' })}</Text>
              <TouchableOpacity
                style={[
                  styles.dateTimeBox,
                  pickupDateError && styles.dateTimeBoxError,
                ]}
                onPress={() => {
                  setPickupDateError(false);
                  setIsDatePickerOpen(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.dateTimeBoxLeft}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={pickupDateError ? '#ef4444' : 'rgb(22, 34, 50)'}
                  />
                  <Text
                    style={[
                      styles.dateTimeBoxText,
                      !pickupDate && styles.dateTimePlaceholderText,
                      pickupDateError && styles.dateTimeTextError,
                    ]}
                  >
                    {pickupDate ? formatFriendlyDate(pickupDate) : t('tripDetails.selectDate', { defaultValue: 'Select Date' })}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-down"
                  size={15}
                  color={pickupDateError ? '#ef4444' : '#64748b'}
                />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 4 }}>
              <View style={styles.pickupTimeHeaderRow}>
                <Text style={styles.dateTimeFieldLabel}>
                  {corporatePickupTimes.length > 1
                    ? t('tripDetails.pickupTimesCount', { defaultValue: `Pickup Times (${corporatePickupTimes.length})`, count: corporatePickupTimes.length })
                    : t('tripDetails.addPickupTime', { defaultValue: 'Pickup Time' })}
                </Text>
                <TouchableOpacity
                  style={styles.addTimeBtn}
                  onPress={handleAddPickupTime}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle" size={15} color="rgb(22, 34, 50)" />
                  <Text style={styles.addTimeBtnText}>{t('tripDetails.addPickupTime', { defaultValue: 'Add Pickup Time' })}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.corporateTimesList}>
                {corporatePickupTimes.map((time, idx) => (
                  <View key={idx} style={styles.corporateTimeRow}>
                    <TouchableOpacity
                      style={styles.corporateTimeBox}
                      onPress={() => {
                        setActiveEditingTimeIndex(idx);
                        setIsCorpTimePickerOpen(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="time-outline" size={18} color="rgb(22, 34, 50)" style={styles.inputIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.corporateTimeLabel}>
                          {idx === 0
                            ? t('tripDetails.primaryPickup', { defaultValue: 'Primary Pickup' })
                            : t('tripDetails.pickupTimeN', { defaultValue: `Pickup Time ${idx + 1}`, n: idx + 1 })}
                        </Text>
                        <Text style={styles.inputText}>{formatTime12Display(time)}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#989daf" />
                    </TouchableOpacity>

                    {corporatePickupTimes.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeTimeBtn}
                        onPress={() => handleRemovePickupTime(idx)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          /* Standard Trip Schedule: 2-Column Side-by-Side Grid */
          <View style={styles.scheduleCard}>
            <View style={styles.scheduleCardHeader}>
              <View style={styles.scheduleHeaderLeft}>
                <Ionicons name="calendar" size={17} color="rgb(240, 117, 15)" />
                <Text style={styles.scheduleCardTitle}>{t('tripDetails.tripSchedule', { defaultValue: 'Trip Schedule' })}</Text>
              </View>
            </View>

            {/* Departure Date & Time (Side-by-Side 2 Columns) */}
            <View style={styles.dateTimeGridRow}>
              <View style={styles.dateTimeCol}>
                <Text style={styles.dateTimeFieldLabel}>
                  {(tripType === 'ROUND' || tripType === 'TOUR') ? t('tripDetails.departureDateLabel', { defaultValue: 'DEPARTURE DATE' }) : t('tripDetails.pickupDateLabel', { defaultValue: 'PICKUP DATE' })}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.dateTimeBox,
                    pickupDateError && styles.dateTimeBoxError,
                  ]}
                  onPress={() => {
                    setPickupDateError(false);
                    setIsDatePickerOpen(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.dateTimeBoxLeft}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={pickupDateError ? '#ef4444' : 'rgb(22, 34, 50)'}
                    />
                    <Text
                      style={[
                        styles.dateTimeBoxText,
                        !pickupDate && styles.dateTimePlaceholderText,
                        pickupDateError && styles.dateTimeTextError,
                      ]}
                      numberOfLines={1}
                    >
                      {pickupDate ? formatFriendlyDate(pickupDate) : t('tripDetails.selectDate', { defaultValue: 'Select Date' })}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-down"
                    size={15}
                    color={pickupDateError ? '#ef4444' : '#64748b'}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.dateTimeCol}>
                <Text style={styles.dateTimeFieldLabel}>
                  {(tripType === 'ROUND' || tripType === 'TOUR') ? t('tripDetails.departureTimeLabel', { defaultValue: 'DEPARTURE TIME' }) : t('tripDetails.pickupTimeLabel', { defaultValue: 'PICKUP TIME' })}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.dateTimeBox,
                    pickupTimeError && styles.dateTimeBoxError,
                  ]}
                  onPress={() => {
                    setPickupTimeError(false);
                    setIsTimePickerOpen(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.dateTimeBoxLeft}>
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={pickupTimeError ? '#ef4444' : 'rgb(22, 34, 50)'}
                    />
                    <Text
                      style={[
                        styles.dateTimeBoxText,
                        !pickupTime && styles.dateTimePlaceholderText,
                        pickupTimeError && styles.dateTimeTextError,
                      ]}
                      numberOfLines={1}
                    >
                      {pickupTime ? formatTime12Display(pickupTime) : t('tripDetails.selectTime', { defaultValue: 'Select Time' })}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-down"
                    size={15}
                    color={pickupTimeError ? '#ef4444' : '#64748b'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Return Date & Time for Round Trip / Tour (Side-by-Side 2 Columns) */}
            {(tripType === 'ROUND' || tripType === 'TOUR') && (
              <View style={[styles.dateTimeGridRow, { marginTop: 10 }]}>
                <View style={styles.dateTimeCol}>
                  <Text style={styles.dateTimeFieldLabel}>{t('tripDetails.returnDateLabel', { defaultValue: 'RETURN DATE' })}</Text>
                  <TouchableOpacity
                    style={styles.dateTimeBox}
                    onPress={() => setIsReturnDatePickerOpen(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dateTimeBoxLeft}>
                      <Ionicons name="calendar" size={16} color="rgb(22, 34, 50)" />
                      <Text style={styles.dateTimeBoxText} numberOfLines={1}>
                        {formatFriendlyDate(returnDate)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={15} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <View style={styles.dateTimeCol}>
                  <Text style={styles.dateTimeFieldLabel}>{t('tripDetails.returnTimeLabel', { defaultValue: 'RETURN TIME' })}</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateTimeBox,
                      returnTimeError && styles.dateTimeBoxError,
                    ]}
                    onPress={() => {
                      setReturnTimeError(false);
                      setIsReturnTimePickerOpen(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dateTimeBoxLeft}>
                      <Ionicons
                        name="time"
                        size={16}
                        color={returnTimeError ? '#ef4444' : 'rgb(22, 34, 50)'}
                      />
                      <Text
                        style={[
                          styles.dateTimeBoxText,
                          !returnTime && styles.dateTimePlaceholderText,
                          returnTimeError && styles.dateTimeTextError,
                        ]}
                        numberOfLines={1}
                      >
                        {returnTime ? formatTime12Display(returnTime) : t('tripDetails.selectTime', { defaultValue: 'Select Time' })}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={15}
                      color={returnTimeError ? '#ef4444' : '#64748b'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}


        {/* SECTION: KANDY CABS ASSURED (IN SCROLLVIEW) */}
        <View style={styles.trustSection}>
          <View style={styles.trustSectionHeader}>
            <View style={styles.trustHeaderLeft}>
              <Ionicons name="shield-checkmark" size={16} color="#16a34a" />
              <Text style={styles.trustCardTitle}>Kandy Cabs Assured</Text>
            </View>
            <View style={styles.trustBadge}>
              <Ionicons name="checkmark-circle" size={10} color="#16a34a" />
              <Text style={styles.trustBadgeText}>VERIFIED FLEET</Text>
            </View>
          </View>

          {/* Row 1: Zero Cancellation + Free 15-Min Wait */}
          <View style={styles.trustTilesRow}>
            <View style={styles.trustTile}>
              <View style={styles.trustTileIconBox}>
                <Ionicons name="shield-checkmark-outline" size={19} color="#2563eb" />
              </View>
              <View style={styles.trustTileTextCol}>
                <Text style={styles.trustTileTitle} numberOfLines={1}>Zero Cancellation</Text>
                <Text style={styles.trustTileSub} numberOfLines={1}>100% refund before pickup</Text>
              </View>
            </View>

            <View style={styles.trustTile}>
              <View style={styles.trustTileIconBox}>
                <Ionicons name="time-outline" size={19} color="#9333ea" />
              </View>
              <View style={styles.trustTileTextCol}>
                <Text style={styles.trustTileTitle} numberOfLines={1}>Free 15-Min Wait</Text>
                <Text style={styles.trustTileSub} numberOfLines={1}>No rush at doorstep / airport</Text>
              </View>
            </View>
          </View>

          {/* Row 2: Commercial Cabs + Transparent Fares */}
          <View style={[styles.trustTilesRow, { marginTop: 8 }]}>
            <View style={styles.trustTile}>
              <View style={styles.trustTileIconBox}>
                <Ionicons name="car-sport-outline" size={19} color="#16a34a" />
              </View>
              <View style={styles.trustTileTextCol}>
                <Text style={styles.trustTileTitle} numberOfLines={1}>Commercial Cabs</Text>
                <Text style={styles.trustTileSub} numberOfLines={1}>Clean AC & top chauffeurs</Text>
              </View>
            </View>

            <View style={styles.trustTile}>
              <View style={styles.trustTileIconBox}>
                <Ionicons name="receipt-outline" size={19} color="rgb(240, 117, 15)" />
              </View>
              <View style={styles.trustTileTextCol}>
                <Text style={styles.trustTileTitle} numberOfLines={1}>All-Inclusive Fares</Text>
                <Text style={styles.trustTileSub} numberOfLines={1}>Tolls & GST transparent</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Pinned Bottom Action Bar (Clean Full-Width Next CTA) */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleProceed}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>{t('tripDetails.selectCabFares', { defaultValue: 'Next: Select Cab' })}</Text>
          <Ionicons name="arrow-forward" size={19} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Trip Type Selector Modal */}
      <Modal
        visible={showTypePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTypePickerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTypePickerModal(false)}
        >
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Change Trip Type</Text>
            {TRIP_TYPES_META.map((item) => {
              const isSelected = tripType === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.typeOptionRow, isSelected && styles.typeOptionRowSelected]}
                  onPress={() => {
                    const newType = item.id;
                    setTripType(newType);
                    setShowTypePickerModal(false);
                    if (newType === 'AIRPORT') {
                      if (airportDirection === 'TO_AIRPORT') {
                        if (!selectedAirport && dropLocation && isAirportLocation(dropLocation)) {
                          setSelectedAirport(dropLocation);
                        }
                      } else {
                        if (!selectedAirport && pickupLocation && isAirportLocation(pickupLocation)) {
                          setSelectedAirport(pickupLocation);
                        }
                      }
                    } else if (newType !== 'LOCAL') {
                      if (selectedAirport) {
                        if (airportDirection === 'TO_AIRPORT' && !dropLocation) {
                          setDropLocation(selectedAirport);
                        } else if (airportDirection === 'FROM_AIRPORT' && !pickupLocation) {
                          setPickupLocation(selectedAirport);
                        }
                      }
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.typeIconBox, isSelected && styles.typeIconBoxSelected]}>
                    {item.iconFamily === 'MaterialCommunityIcons' ? (
                      <MaterialCommunityIcons
                        name={item.iconName as any}
                        size={20}
                        color={isSelected ? '#ffffff' : '#64748b'}
                      />
                    ) : (
                      <Ionicons
                        name={item.iconName as any}
                        size={20}
                        color={isSelected ? '#ffffff' : '#64748b'}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.typeOptionText, isSelected && styles.typeOptionTextSelected]}>
                      {item.label}
                    </Text>
                    <Text style={styles.typeOptionSubtext}>{item.subtitle}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color="rgb(240, 117, 15)" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Location Picker Modals */}
      <LocationPickerModal
        visible={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        title={
          tripType === 'AIRPORT'
            ? airportDirection === 'TO_AIRPORT'
              ? routeModalTarget === 'DROP'
                ? t('tripDetails.selectDestAirport', { defaultValue: 'Select Destination Airport' })
                : t('tripDetails.selectPickupLocation', { defaultValue: 'Select Pickup Location' })
              : routeModalTarget === 'PICKUP'
              ? t('tripDetails.selectPickupAirport', { defaultValue: 'Select Pickup Airport' })
              : t('tripDetails.selectDropLocation', { defaultValue: 'Select Drop Location' })
            : tripType === 'LOCAL'
            ? t('tripDetails.selectPickupLocation', { defaultValue: 'Select Pickup Location' })
            : routeModalTarget === 'PICKUP'
            ? t('tripDetails.selectPickupLocation', { defaultValue: 'Select Pickup Location' })
            : routeModalTarget === 'DROP'
            ? t('tripDetails.selectDropLocation', { defaultValue: 'Select Drop Location' })
            : t('tripDetails.selectStopLocation', { defaultValue: `Select Stop ${routeModalStopIndex + 1}` })
        }
        initialTarget={routeModalTarget}
        initialStopIndex={routeModalStopIndex}
        isPickup={routeModalTarget === 'PICKUP'}
        pickupValue={
          tripType === 'AIRPORT' && airportDirection === 'FROM_AIRPORT'
            ? selectedAirport?.label
            : pickupLocation?.label
        }
        dropValue={
          tripType === 'LOCAL'
            ? undefined
            : tripType === 'AIRPORT' && airportDirection === 'TO_AIRPORT'
            ? selectedAirport?.label
            : dropLocation?.label
        }
        pickupLocation={
          tripType === 'AIRPORT' && airportDirection === 'FROM_AIRPORT'
            ? selectedAirport
            : pickupLocation
        }
        dropLocation={
          tripType === 'LOCAL'
            ? null
            : tripType === 'AIRPORT' && airportDirection === 'TO_AIRPORT'
            ? selectedAirport
            : dropLocation
        }
        viaStops={tripType === 'LOCAL' ? [] : viaStops}
        hideDrop={tripType === 'LOCAL'}
        hideStops={tripType === 'LOCAL'}
        singleLocationOnly={tripType === 'LOCAL'}
        pickupAirportsOnly={tripType === 'AIRPORT' && airportDirection === 'FROM_AIRPORT'}
        dropAirportsOnly={tripType === 'AIRPORT' && airportDirection === 'TO_AIRPORT'}
        onSelectPickup={(loc) => {
          if (tripType === 'AIRPORT' && airportDirection === 'FROM_AIRPORT') {
            setSelectedAirport(loc);
          } else {
            setPickupLocation(loc);
          }
        }}
        onSelectDrop={(loc) => {
          if (tripType === 'AIRPORT' && airportDirection === 'TO_AIRPORT') {
            setSelectedAirport(loc);
            setDropLocation(loc);
          } else {
            setDropLocation(loc);
          }
        }}
        onConfirmRoute={({ pickup, drop, stops }) => {
          if (pickup && drop && isSameLocation(pickup, drop)) {
            Alert.alert(
              t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
              t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
            );
            return;
          }
          if (pickup) {
            if (tripType === 'AIRPORT' && airportDirection === 'FROM_AIRPORT') {
              setSelectedAirport(pickup);
            } else {
              setPickupLocation(pickup);
            }
          }
          if (drop) {
            if (tripType === 'AIRPORT' && airportDirection === 'TO_AIRPORT') {
              setSelectedAirport(drop);
              setDropLocation(drop);
            } else if (tripType !== 'LOCAL') {
              setDropLocation(drop);
            }
          }
          if (stops && tripType !== 'LOCAL') {
            setViaStops(stops);
          }
          setIsRouteModalOpen(false);
        }}
      />

      <LocationPickerModal
        visible={isReturnDropModalOpen}
        title="Select Return Drop Location"
        isPickup={false}
        singleLocationOnly={true}
        hideDrop={false}
        hideStops={true}
        currentValue={returnDropLocation ? returnDropLocation.label : pickupLocation ? pickupLocation.label : undefined}
        onSelect={(loc) => {
          setReturnDropLocation(loc);
          setIsReturnDropModalOpen(false);
        }}
        onClose={() => setIsReturnDropModalOpen(false)}
      />

      {/* Date & Time Modals */}
      <DatePickerModal
        visible={isDatePickerOpen}
        currentDate={pickupDate}
        onSelect={(key, formatted) => {
          const newDate = formatted || key;
          setPickupDate(newDate);
          setPickupDateError(false);
          setPickupTime((prev) => (prev ? getUpcomingPickupTime(newDate, prev) : ''));
          setIsDatePickerOpen(false);
        }}
        onClose={() => setIsDatePickerOpen(false)}
      />

      <TimePickerModal
        visible={isTimePickerOpen}
        currentTime={pickupTime || '09:00'}
        selectedDate={pickupDate}
        title={t('tripDetails.selectPickupTime', { defaultValue: 'Select Pickup Time' })}
        onSelect={(time) => {
          setPickupTime(time);
          setPickupTimeError(false);
          setIsTimePickerOpen(false);
        }}
        onClose={() => setIsTimePickerOpen(false)}
      />

      <DatePickerModal
        visible={isReturnDatePickerOpen}
        currentDate={returnDate}
        onSelect={(key, formatted) => {
          const newReturnDate = formatted || key;
          setReturnDate(newReturnDate);
          setIsReturnDatePickerOpen(false);
        }}
        onClose={() => setIsReturnDatePickerOpen(false)}
      />

      <TimePickerModal
        visible={isReturnTimePickerOpen}
        currentTime={returnTime || '18:00'}
        selectedDate={returnDate}
        minTime={returnDate === pickupDate ? (pickupTime || undefined) : undefined}
        title={t('tripDetails.selectReturnTime', { defaultValue: 'Select Return Time' })}
        onSelect={(time) => {
          setReturnTime(time);
          setReturnTimeError(false);
          setIsReturnTimePickerOpen(false);
        }}
        onClose={() => setIsReturnTimePickerOpen(false)}
      />

      {/* Corporate Travel Modals */}
      <DatePickerModal
        visible={isCorpStartDatePickerOpen}
        title="Select Start Date (From)"
        currentDate={corporateStartDate}
        onSelect={(key, formatted) => {
          const newStart = formatted || key;
          setCorporateStartDate(newStart);
          setIsCorpStartDatePickerOpen(false);
          const s = parseDdMmYyyy(newStart);
          const e = parseDdMmYyyy(corporateEndDate);
          if (e < s) {
            const nextEnd = new Date(s);
            nextEnd.setDate(nextEnd.getDate() + 6);
            setCorporateEndDate(formatDdMmYyyy(nextEnd));
          }
        }}
        onClose={() => setIsCorpStartDatePickerOpen(false)}
      />

      <DatePickerModal
        visible={isCorpEndDatePickerOpen}
        title="Select End Date (To)"
        currentDate={corporateEndDate}
        onSelect={(key, formatted) => {
          const newEnd = formatted || key;
          setCorporateEndDate(newEnd);
          setIsCorpEndDatePickerOpen(false);
          const s = parseDdMmYyyy(corporateStartDate);
          const e = parseDdMmYyyy(newEnd);
          if (e < s) {
            setCorporateStartDate(newEnd);
          }
        }}
        onClose={() => setIsCorpEndDatePickerOpen(false)}
      />

      <TimePickerModal
        visible={isCorpTimePickerOpen}
        currentTime={activeEditingTimeIndex !== null ? corporatePickupTimes[activeEditingTimeIndex] : '09:00'}
        selectedDate={corporateStartDate}
        title={activeEditingTimeIndex !== null 
          ? t('tripDetails.selectPickupTimeN', { defaultValue: `Select Pickup Time ${activeEditingTimeIndex + 1}`, n: activeEditingTimeIndex + 1 })
          : t('tripDetails.selectPickupTime', { defaultValue: 'Select Pickup Time' })}
        onSelect={(time) => {
          if (activeEditingTimeIndex !== null) {
            setCorporatePickupTimes((prev) => {
              const next = [...prev];
              next[activeEditingTimeIndex] = time;
              return next;
            });
          }
          setIsCorpTimePickerOpen(false);
          setActiveEditingTimeIndex(null);
        }}
        onClose={() => {
          setIsCorpTimePickerOpen(false);
          setActiveEditingTimeIndex(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6fa',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  headerStepSub: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1,
  },
  stepProgressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 6,
  },
  stepTrackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDotActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgb(240, 117, 15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumActive: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  stepNameActive: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  stepDotInactive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumInactive: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  stepNameInactive: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94a3b8',
  },
  stepConnector: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  formGroup: {
    marginBottom: 10,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  fieldActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
  },
  dropdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  typeTextCol: {
    flex: 1,
  },
  dropdownText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  dropdownSubtitle: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  typeChangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeChangePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  typeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  typeIconBoxSelected: {
    backgroundColor: 'rgb(240, 117, 15)',
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#ebedf2',
    backgroundColor: '#ffffff',
  },
  inputIcon: {
    marginRight: 12,
  },
  inputTextContainer: {
    flex: 1,
  },
  inputText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  inputSubtext: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  placeholderText: {
    color: '#989daf',
    fontWeight: '400',
  },
  swapContainer: {
    alignItems: 'center',
    marginVertical: -6,
    zIndex: 10,
  },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#ebedf2',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  airportToggleGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  airportToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  airportToggleBtnActive: {
    backgroundColor: 'rgb(240, 117, 15)',
    borderColor: 'rgb(240, 117, 15)',
  },
  airportToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  airportToggleTextActive: {
    color: '#ffffff',
  },
  packageRow: {
    flexDirection: 'row',
    gap: 8,
  },
  packageCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ebedf2',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  packageCardActive: {
    borderColor: 'rgb(22, 34, 50)',
    backgroundColor: '#eaf1f9',
  },
  packageHourText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  packageKmText: {
    fontSize: 11,
    color: '#7b8196',
    marginTop: 2,
  },
  packageTextActive: {
    color: 'rgb(22, 34, 50)',
  },
  packageSubtextActive: {
    color: 'rgb(22, 34, 50)',
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    ...Platform.select({
      ios: {
        shadowColor: 'rgb(22, 34, 50)',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgb(240, 117, 15)',
    paddingVertical: 14,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: 'rgb(240, 117, 15)',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    marginBottom: 16,
  },
  typeOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  typeOptionRowSelected: {
    backgroundColor: '#fff7ed',
  },
  typeOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgb(22, 34, 50)',
  },
  typeOptionTextSelected: {
    color: 'rgb(22, 34, 50)',
    fontWeight: '800',
  },
  typeOptionSubtext: {
    fontSize: 12,
    color: '#7b8196',
    marginTop: 1,
  },
  // Unified Route Journey Timeline Card
  routeTimelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: 'rgb(22, 34, 50)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  routeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  routeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeCardTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
    letterSpacing: -0.2,
  },
  swapBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  swapBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineTrackCol: {
    width: 20,
    alignItems: 'center',
    marginRight: 8,
  },
  timelineNodeContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timelineNodeViaPlus: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  nodeReturnCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: 'rgb(22, 34, 50)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: '#cbd5e1',
    marginVertical: 2,
  },
  timelineLineDashed: {
    flex: 1,
    width: 0,
    borderLeftWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    marginVertical: 2,
  },
  timelineContentCol: {
    flex: 1,
    paddingBottom: 10,
  },
  microLabelPickup: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  microLabelVia: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.5,
  },
  microLabelDrop: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  microLabelReturn: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.5,
  },
  viaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  removeViaInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  removeViaInlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  roundTripPill: {
    backgroundColor: '#eaf1f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roundTripPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.3,
  },
  routeInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeInputIcon: {
    marginRight: 10,
  },
  routeInputIconCirclePickup: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  routeInputIconCircleDrop: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  routeInputIconCircleVia: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  routeInputIconCircleReturn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  returnInputBox: {
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  flightNumberSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  flightInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  flightInputIcon: {
    marginRight: 10,
  },
  flightInputField: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgb(22, 34, 50)',
    paddingVertical: 0,
  },
  addViaRow: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  addViaPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgb(22, 34, 50)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addViaPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  flightAndStopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  flightInputBoxFlex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
  },
  addViaPillBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgb(22, 34, 50)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 3.5,
    height: 38,
    justifyContent: 'center',
  },
  addViaPillTextSmall: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  quickLocationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  quickLocationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  quickLocationText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
  },

  // Side-by-Side Schedule Card
  scheduleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: 'rgb(22, 34, 50)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  scheduleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  scheduleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleCardTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
    letterSpacing: -0.2,
  },
  leaveNowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  leaveNowChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
  },
  dateTimeGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTimeCol: {
    flex: 1,
  },
  dateTimeFieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dateTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dateTimeBoxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dateTimeBoxText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  dateTimePlaceholderText: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  dateTimeBoxError: {
    borderColor: '#ef4444',
    borderWidth: 1.5,
    backgroundColor: '#fef2f2',
  },
  dateTimeTextError: {
    color: '#ef4444',
    fontWeight: '600',
  },

  // Corporate Travel Booking Options
  corporateModeGroup: {
    marginBottom: 16,
  },
  corporateModeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  corporateModeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#ebedf2',
    backgroundColor: '#ffffff',
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  corporateModeCardActive: {
    borderColor: 'rgb(22, 34, 50)',
    backgroundColor: '#eaf1f9',
  },
  corporateCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#989daf',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  corporateCheckboxActive: {
    borderColor: 'rgb(22, 34, 50)',
    backgroundColor: 'rgb(22, 34, 50)',
  },
  corporateModeTextCol: {
    flex: 1,
  },
  corporateModeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  corporateModeTitleActive: {
    color: 'rgb(22, 34, 50)',
    fontWeight: '800',
  },
  corporateModeSub: {
    fontSize: 10.5,
    color: '#7b8196',
    marginTop: 1,
  },

  // Date Range (From - To)
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateRangeCol: {
    flex: 1,
  },
  dateRangeSubLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7b8196',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dateRangeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ebedf2',
    backgroundColor: '#ffffff',
  },
  dateRangeCardText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    flex: 1,
  },
  dateRangeArrow: {
    paddingTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Date Grid & Exclude
  dateGridContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ebedf2',
  },
  dateGridHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateGridTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  dateGridSubtitle: {
    fontSize: 11,
    color: '#7b8196',
    marginTop: 2,
  },
  dateGridBadge: {
    backgroundColor: 'rgb(22, 34, 50)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  dateGridBadgeText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  dateQuickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    marginTop: 2,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#ebedf2',
  },
  quickActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  quickActionBtnSecondary: {
    backgroundColor: '#ebedf2',
    borderColor: '#cbd5e1',
  },
  quickActionBtnTextSecondary: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  datesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  corpDateCard: {
    width: '23%',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corpDateCardActive: {
    backgroundColor: '#ffffff',
    borderColor: 'rgb(22, 34, 50)',
    ...Platform.select({
      ios: {
        shadowColor: 'rgb(22, 34, 50)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  corpDateCardExcluded: {
    backgroundColor: '#f1f5f9',
    borderColor: '#ebedf2',
    opacity: 0.55,
  },
  corpDateDayName: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  corpDateDayNum: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 19,
  },
  corpDateMonthName: {
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 1,
  },
  corpTextActive: {
    color: 'rgb(22, 34, 50)',
    fontWeight: '800',
  },
  corpTextExcluded: {
    color: '#989daf',
    textDecorationLine: 'line-through',
  },
  includedBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgb(22, 34, 50)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  excludedBadge: {
    position: 'absolute',
    bottom: 2,
    backgroundColor: '#ef4444',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  excludedBadgeText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '800',
  },

  // Pickup Times with (+)
  pickupTimeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  addTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  addTimeBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  corporateTimesList: {
    gap: 6,
  },
  corporateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  corporateTimeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#f8fafc',
  },
  corporateTimeLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
  },
  removeTimeBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Kandy Cabs Assured Trust Section
  trustSection: {
    marginTop: 6,
    marginBottom: 16,
  },
  trustSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  trustHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustCardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.2,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trustBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16a34a',
    letterSpacing: 0.3,
  },
  trustTilesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  trustTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  trustTileIconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTileTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  trustTileTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    marginBottom: 2,
    textAlign: 'left',
  },
  trustTileSub: {
    fontSize: 9.5,
    color: '#64748b',
    lineHeight: 13,
    textAlign: 'left',
  },

  // Special Offer / Promo Card
  offerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: 'rgb(240, 117, 15)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  offerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerContent: {
    flex: 1,
  },
  offerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  offerTagBadge: {
    backgroundColor: 'rgb(240, 117, 15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  offerTagBadgeText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  offerCodeText: {
    color: 'rgb(240, 117, 15)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  offerTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    marginBottom: 1,
  },
  offerSub: {
    fontSize: 10,
    color: '#78350f',
  },

});
