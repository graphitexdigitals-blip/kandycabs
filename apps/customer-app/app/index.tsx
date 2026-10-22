import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
  Alert,
  Image,
  ImageBackground,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  RefreshControl,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthModal } from '../components/AuthModal';
import { CustomerBottomDock } from '../components/CustomerBottomDock';
import { LocationPickerModal } from '../components/LocationPickerModal';
import { DatePickerModal } from '../components/DatePickerModal';
import { TimePickerModal } from '../components/TimePickerModal';
import { PlaceLocation } from '../lib/locations';
import { customerApiClient, customerTokenStorage, getDynamicBaseUrl } from '../lib/api';
import { safeNavigate } from '../lib/safeNav';

const { width, height } = Dimensions.get('window');
const isSmallScreen = height < 700 || width < 380;
const isMediumScreen = height >= 700 && height < 820;

const BANNER_CARD_GAP = 12;
const BANNER_CARD_WIDTH = Math.round(width * 0.82);
const BANNER_CARD_HEIGHT = isSmallScreen ? 130 : 148;

interface ServiceCategory {
  id: string;
  title: string;
  iconName: string;
  iconFamily?: 'Ionicons' | 'MaterialCommunityIcons';
  category: 'ONEWAY' | 'ROUND' | 'AIRPORT' | 'LOCAL' | 'CORPORATE' | 'TOUR';
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'AIRPORT', title: 'Airport Transfer', iconFamily: 'Ionicons', iconName: 'airplane', category: 'AIRPORT' },
  { id: 'LOCAL', title: 'Local Rental', iconFamily: 'Ionicons', iconName: 'time', category: 'LOCAL' },
  { id: 'CORPORATE', title: 'Corporate Travel', iconFamily: 'Ionicons', iconName: 'briefcase', category: 'CORPORATE' },
  { id: 'TOUR', title: 'Tour & Pilgrimage', iconFamily: 'Ionicons', iconName: 'business', category: 'TOUR' },
];

interface CarouselItem {
  id: string;
  badge?: string;
  tagline?: string;
  subTagline?: string;
  image: any;
  btnText: string;
  category?: 'ONEWAY' | 'ROUND' | 'AIRPORT' | 'LOCAL' | 'CORPORATE' | 'TOUR';
  bannerType?: 'APP_BANNER' | 'PROMO_GRAPHIC';
  showTextOverlay?: boolean;
  showCtaButton?: boolean;
  linkUrl?: string;
}

const CAROUSEL_DATA: CarouselItem[] = [
  {
    id: '1',
    badge: 'INTERCITY CABS',
    tagline: 'Safe • Reliable • Transparent',
    subTagline: 'ಕನ್ನಡ ನಾಡಿನ ನಂಬಿಕಸ್ಥ ಕ್ಯಾಬ್ ಸೇವೆ',
    image: require('../assets/images/banner-coastal-highway.jpg'),
    btnText: 'Book Outstation',
  },
  {
    id: '2',
    badge: 'AIRPORT TRANSFERS',
    tagline: 'Mangaluru & Bengaluru Airports',
    subTagline: 'Zero Surge • 24/7 Guaranteed Pickup',
    image: require('../assets/images/banner-airport.jpg'),
    btnText: 'Book Airport Cab',
  },
  {
    id: '3',
    badge: 'PILGRIMAGE & TOURS',
    tagline: 'Coastal Karnataka Temple Tours',
    subTagline: 'Dharmasthala • Udupi • Murudeshwar',
    image: require('../assets/images/banner-pilgrimage.jpg'),
    btnText: 'Explore Tours',
  },
];

const LOCAL_BANNER_ASSETS: Record<string, any> = {
  '/images/banner-coastal-highway.jpg': require('../assets/images/banner-coastal-highway.jpg'),
  '/images/banner-airport.jpg': require('../assets/images/banner-airport.jpg'),
  '/images/banner-pilgrimage.jpg': require('../assets/images/banner-pilgrimage.jpg'),
  'banner-coastal-highway.jpg': require('../assets/images/banner-coastal-highway.jpg'),
  'banner-airport.jpg': require('../assets/images/banner-airport.jpg'),
  'banner-pilgrimage.jpg': require('../assets/images/banner-pilgrimage.jpg'),
  'banner-1': require('../assets/images/banner-coastal-highway.jpg'),
  'banner-2': require('../assets/images/banner-airport.jpg'),
  'banner-3': require('../assets/images/banner-pilgrimage.jpg'),
  '1': require('../assets/images/banner-coastal-highway.jpg'),
  '2': require('../assets/images/banner-airport.jpg'),
  '3': require('../assets/images/banner-pilgrimage.jpg'),
};

function resolveBannerImage(image: any, fallbackId?: string): any {
  // 1. If it's a number (React Native bundled require asset), return immediately
  if (typeof image === 'number') {
    return image;
  }

  // 2. Extract string if wrapped in { uri: ... }
  let str = '';
  if (typeof image === 'string') {
    str = image;
  } else if (typeof image === 'object' && image?.uri) {
    str = image.uri;
  }

  if (str) {
    const cleaned = str.toLowerCase().trim();

    // Check pre-bundled local asset dictionary
    if (LOCAL_BANNER_ASSETS[str]) return LOCAL_BANNER_ASSETS[str];
    if (LOCAL_BANNER_ASSETS[cleaned]) return LOCAL_BANNER_ASSETS[cleaned];

    if (cleaned.includes('highway') || cleaned.includes('coastal') || cleaned.includes('intercity')) {
      return LOCAL_BANNER_ASSETS['banner-coastal-highway.jpg'];
    }
    if (cleaned.includes('airport') || cleaned.includes('mangaluru') || cleaned.includes('bengaluru')) {
      return LOCAL_BANNER_ASSETS['banner-airport.jpg'];
    }
    if (cleaned.includes('pilgrim') || cleaned.includes('temple') || cleaned.includes('dharmasthala')) {
      return LOCAL_BANNER_ASSETS['banner-pilgrimage.jpg'];
    }

    // Base64 upload from Admin
    if (str.startsWith('data:image/')) {
      return { uri: str };
    }

    // Full remote public URL
    if (str.startsWith('http://') || str.startsWith('https://')) {
      // If localhost was passed on mobile, rewrite localhost to LAN IP host
      if (str.includes('localhost') || str.includes('127.0.0.1')) {
        const baseUrl = getDynamicBaseUrl().replace(/\/+$/, '');
        const pathPart = str.replace(/^https?:\/\/[^/]+/, '');
        return { uri: `${baseUrl}${pathPart}` };
      }
      return { uri: str };
    }

    // Relative path like /images/foo.jpg
    if (str.startsWith('/')) {
      const baseUrl = getDynamicBaseUrl().replace(/\/+$/, '');
      return { uri: `${baseUrl}${str}` };
    }

    return { uri: str };
  }

  // 3. Fallback based on fallbackId
  if (fallbackId && LOCAL_BANNER_ASSETS[fallbackId]) {
    return LOCAL_BANNER_ASSETS[fallbackId];
  }

  return require('../assets/images/banner-pilgrimage.jpg');
}

interface VehicleFleetItem {
  id: string;
  name: string;
  subtitle: string;
  pax: string;
  bags: string;
  image: any;
  startingFare: string;
  badge?: string;
}

const VEHICLE_FLEET: VehicleFleetItem[] = [
  {
    id: 'sedan',
    name: 'Sedan',
    subtitle: 'Dzire, Etios or equivalent',
    pax: '4 + 1',
    bags: '2',
    image: require('../assets/images/fleet-4-sedan.png'),
    startingFare: 'From ₹11/km',
    badge: 'BEST VALUE',
  },
  {
    id: 'ertiga',
    name: 'Ertiga',
    subtitle: 'Maruti Ertiga 6-Seater',
    pax: '6 + 1',
    bags: '3',
    image: require('../assets/images/fleet-4-ertiga.png'),
    startingFare: 'From ₹14/km',
    badge: 'FAMILY CHOICE',
  },
  {
    id: 'innova',
    name: 'Innova',
    subtitle: 'Toyota Innova 7-Seater',
    pax: '7 + 1',
    bags: '4',
    image: require('../assets/images/fleet-4-innova.png'),
    startingFare: 'From ₹17/km',
    badge: 'POPULAR SUV',
  },
  {
    id: 'crysta',
    name: 'Innova Crysta',
    subtitle: 'Premium Luxury SUV',
    pax: '7 + 1',
    bags: '4',
    image: require('../assets/images/fleet-4-crysta.png'),
    startingFare: 'From ₹20/km',
    badge: 'EXECUTIVE VIP',
  },
];

interface PopularRouteItem {
  id: string;
  from: string;
  to: string;
  fromLocation: PlaceLocation;
  toLocation: PlaceLocation;
  fare: string;
  distance: string;
  tag: string;
  tripType: 'ONEWAY' | 'ROUND';
}

const POPULAR_ROUTES: PopularRouteItem[] = [
  {
    id: 'blr',
    from: 'Mangaluru',
    to: 'Bengaluru',
    fromLocation: { label: 'Mangaluru Central Railway Station', sublabel: 'MAQ, Hampankatta', lat: 12.8634, lng: 74.8436, category: 'MANGALURU' },
    toLocation: { label: 'Bengaluru (Bangalore)', sublabel: 'Majestic / Indiranagar / Whitefield', lat: 12.9716, lng: 77.5946, category: 'OUTSTATION' },
    fare: '₹6,499',
    distance: '350 km • 7 hrs',
    tag: 'MOST POPULAR',
    tripType: 'ONEWAY',
  },
  {
    id: 'dharmasthala',
    from: 'Mangaluru',
    to: 'Dharmasthala',
    fromLocation: { label: 'Mangaluru Central Railway Station', sublabel: 'MAQ, Hampankatta', lat: 12.8634, lng: 74.8436, category: 'MANGALURU' },
    toLocation: { label: 'Dharmasthala', sublabel: 'Manjunatha Swamy Temple', lat: 12.9463, lng: 75.3789, category: 'OUTSTATION' },
    fare: '₹2,199',
    distance: '75 km • 2 hrs',
    tag: 'TEMPLE SPECIAL',
    tripType: 'ONEWAY',
  },
  {
    id: 'udupi',
    from: 'Mangaluru',
    to: 'Udupi / Manipal',
    fromLocation: { label: 'Mangaluru Central Railway Station', sublabel: 'MAQ, Hampankatta', lat: 12.8634, lng: 74.8436, category: 'MANGALURU' },
    toLocation: { label: 'Udupi Sri Krishna Matha', sublabel: 'Car Street, Sri Krishna Temple & Service Bus Stand', lat: 13.3409, lng: 74.7421, category: 'OUTSTATION' },
    fare: '₹1,399',
    distance: '58 km • 1 hr 15m',
    tag: 'COASTAL EXPRESS',
    tripType: 'ONEWAY',
  },
  {
    id: 'ixe-manipal',
    from: 'Mangaluru Airport (IXE)',
    to: 'Manipal',
    fromLocation: { label: 'Mangaluru Airport (IXE)', sublabel: 'Bajpe Terminal, Mangaluru', lat: 12.9613, lng: 74.8901, category: 'AIRPORTS' },
    toLocation: { label: 'Manipal', sublabel: 'MAHE University & Tiger Circle', lat: 13.3525, lng: 74.7865, category: 'OUTSTATION' },
    fare: '₹1,699',
    distance: '62 km • 1 hr 20m',
    tag: 'AIRPORT DIRECT',
    tripType: 'ONEWAY',
  },
];

interface QuickDestChip {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  location: PlaceLocation;
}

const QUICK_DEST_CHIPS: QuickDestChip[] = [
  {
    id: 'ixe',
    label: 'Mangaluru Airport',
    icon: 'airplane',
    location: { label: 'Mangaluru Airport (IXE)', sublabel: 'Bajpe Terminal, Mangaluru', lat: 12.9613, lng: 74.8901, category: 'AIRPORTS' },
  },
  {
    id: 'blr',
    label: 'Bengaluru',
    icon: 'business',
    location: { label: 'Bengaluru (Bangalore)', sublabel: 'Majestic / Indiranagar / Whitefield', lat: 12.9716, lng: 77.5946, category: 'OUTSTATION' },
  },
  {
    id: 'udupi',
    label: 'Udupi / Manipal',
    icon: 'location',
    location: { label: 'Udupi Sri Krishna Matha', sublabel: 'Car Street, Sri Krishna Temple', lat: 13.3409, lng: 74.7421, category: 'OUTSTATION' },
  },
  {
    id: 'dharmasthala',
    label: 'Dharmasthala',
    icon: 'heart',
    location: { label: 'Dharmasthala', sublabel: 'Manjunatha Swamy Temple', lat: 12.9463, lng: 75.3789, category: 'OUTSTATION' },
  },
  {
    id: 'subrahmanya',
    label: 'Kukke Subrahmanya',
    icon: 'trail-sign',
    location: { label: 'Kukke Subrahmanya', sublabel: 'Subrahmanya Temple Foothills', lat: 12.6631, lng: 75.6148, category: 'OUTSTATION' },
  },
];

const DEFAULT_PICKUP_LOCATION: PlaceLocation = {
  label: 'Mangaluru, Mangaluru, Karnataka, India',
  sublabel: 'Mangaluru City & Surrounds',
  lat: 12.8634,
  lng: 74.8436,
  category: 'MANGALURU',
};

const DEFAULT_DROP_LOCATION: PlaceLocation = {
  label: 'Bekal, Bekal, Kerala, India',
  sublabel: 'Bekal Beach & Fort, Kasaragod',
  lat: 12.3927,
  lng: 75.0322,
  category: 'OUTSTATION',
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const [carouselList, setCarouselList] = useState<CarouselItem[]>(CAROUSEL_DATA);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const carouselRef = useRef<FlatList>(null);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('sedan');

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(customerTokenStorage.getUser());
  const [userName, setUserName] = useState<string>(customerTokenStorage.getUser()?.fullName || '');
  const [userPhone, setUserPhone] = useState<string>(customerTokenStorage.getUser()?.phone || '');

  const [refreshing, setRefreshing] = useState(false);

  // Quick Booking State (One Way / Round Trip Card)
  const [selectedTripType, setSelectedTripType] = useState<'ONEWAY' | 'ROUND'>('ONEWAY');
  const [pickupLocation, setPickupLocation] = useState<PlaceLocation | null>(DEFAULT_PICKUP_LOCATION);
  const [dropLocation, setDropLocation] = useState<PlaceLocation | null>(DEFAULT_DROP_LOCATION);
  const [viaStops, setViaStops] = useState<PlaceLocation[]>([]);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState<string>(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}-${month}-${year}`;
  });
  const [pickupDateDisplay, setPickupDateDisplay] = useState<string>('');
  const [pickupTime, setPickupTime] = useState<string>('07:00');

  const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
  const [isDropModalOpen, setIsDropModalOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);

  // Load dynamic promotional banners from Admin / Backend
  const loadDynamicBanners = useCallback(async () => {
    try {
      let bannersData: any[] = [];
      const endpoints = [
        () => customerApiClient.fetch('/api/banners'),
        () => fetch(`${getDynamicBaseUrl().replace(/\/+$/, '')}/api/banners`).then((r) => r.json()),
        () => fetch('http://10.73.0.146:3000/api/banners').then((r) => r.json()),
        () => fetch('http://localhost:3000/api/banners').then((r) => r.json()),
        () => fetch('http://10.0.2.2:3000/api/banners').then((r) => r.json()),
      ];

      for (const fn of endpoints) {
        try {
          const res = await fn();
          if (res && Array.isArray(res.banners) && res.banners.length > 0) {
            bannersData = res.banners;
            break;
          }
        } catch {
          // try next candidate
        }
      }

      if (bannersData.length > 0) {
        const active = bannersData
          .filter((b: any) => b.isActive)
          .map((b: any) => ({
            id: b.id,
            badge: b.badge || '',
            tagline: b.tagline || '',
            subTagline: b.subTagline || '',
            image: b.image,
            btnText: b.btnText || '',
            category: b.category,
            bannerType: b.bannerType || (b.tagline ? 'APP_BANNER' : 'PROMO_GRAPHIC'),
            showTextOverlay:
              b.showTextOverlay !== undefined
                ? b.showTextOverlay
                : b.bannerType !== 'PROMO_GRAPHIC' && Boolean(b.tagline),
            showCtaButton:
              b.showCtaButton !== undefined
                ? b.showCtaButton
                : Boolean(b.btnText && b.btnText.trim()),
            linkUrl: (b.linkUrl || '').trim(),
          }));

        if (active.length > 0) {
          setCarouselList(active);
        }
      }
    } catch {
      // Fallback to default CAROUSEL_DATA
    }
  }, []);

  useEffect(() => {
    loadDynamicBanners();
    const interval = setInterval(loadDynamicBanners, 8000);
    return () => clearInterval(interval);
  }, [loadDynamicBanners]);

  useFocusEffect(
    useCallback(() => {
      loadDynamicBanners();
    }, [loadDynamicBanners])
  );

  // Dynamic greeting based on time of day
  const greeting = (() => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  // Sync auth state & load user profile
  const syncAuth = useCallback(async () => {
    let token = customerTokenStorage.getToken();
    if (!token) {
      token = await customerTokenStorage.getTokenAsync();
    }
    if (!token) {
      router.replace('/login');
      return;
    }

    const cached = customerTokenStorage.getUser();
    if (cached) {
      setCurrentUser(cached);
      setUserName(cached.fullName || 'Valued Customer');
      setUserPhone(cached.phone || '');
    }

    try {
      const res = await customerApiClient.fetch('/api/auth/me');
      const cleanName = (res.user.fullName === 'Kandy Customer' ? '' : (res.user.fullName || '')).trim();
      customerTokenStorage.setUser({ ...res.user, fullName: cleanName });
      setCurrentUser({ ...res.user, fullName: cleanName });
      setUserName(cleanName);
      setUserPhone(res.user.phone || '');
    } catch {
      // ignore network error
    }
  }, [router]);

  useEffect(() => {
    syncAuth();
    const unsub = customerTokenStorage.subscribe(() => {
      const u = customerTokenStorage.getUser();
      setCurrentUser(u);
      setUserName(u?.fullName || '');
      setUserPhone(u?.phone || '');
    });
    return () => unsub();
  }, [syncAuth]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDynamicBanners(), syncAuth()]);
    setRefreshing(false);
  }, [loadDynamicBanners, syncAuth]);

  // Auto-scroll Top Banner Carousel with Touch-Pause & Auto-Resume
  const activeIndexRef = useRef(0);
  const isInteractingRef = useRef(false);
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    activeIndexRef.current = activeCarouselIndex;
  }, [activeCarouselIndex]);

  const advanceSlide = useCallback(() => {
    if (carouselList.length <= 1 || isInteractingRef.current) return;
    const nextIndex = (activeIndexRef.current + 1) % carouselList.length;
    activeIndexRef.current = nextIndex;
    setActiveCarouselIndex(nextIndex);
    try {
      carouselRef.current?.scrollToOffset({
        offset: nextIndex * (BANNER_CARD_WIDTH + BANNER_CARD_GAP),
        animated: true,
      });
    } catch {
      // fallback
    }
  }, [carouselList.length]);

  const startAutoSlide = useCallback(() => {
    if (slideTimerRef.current) {
      clearInterval(slideTimerRef.current);
      slideTimerRef.current = null;
    }
    if (carouselList.length <= 1) return;
    slideTimerRef.current = setInterval(() => {
      if (!isInteractingRef.current) {
        advanceSlide();
      }
    }, 4500);
  }, [carouselList.length, advanceSlide]);

  const pauseAutoSlide = useCallback(() => {
    isInteractingRef.current = true;
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    if (slideTimerRef.current) {
      clearInterval(slideTimerRef.current);
      slideTimerRef.current = null;
    }
  }, []);

  const scheduleResumeAutoSlide = useCallback((delayMs = 4000) => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    resumeTimerRef.current = setTimeout(() => {
      isInteractingRef.current = false;
      startAutoSlide();
    }, delayMs);
  }, [startAutoSlide]);

  useEffect(() => {
    startAutoSlide();
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [startAutoSlide]);

  const handleCarouselScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / (BANNER_CARD_WIDTH + BANNER_CARD_GAP));
    if (index >= 0 && index < carouselList.length) {
      activeIndexRef.current = index;
      setActiveCarouselIndex(index);
    }
  };

  const handleSelectCategory = (cat: ServiceCategory) => {
    safeNavigate(() => {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      router.push({
        pathname: '/trip-details',
        params: {
          tripType: cat.id,
          category: cat.category,
          pickup: pickupLocation?.label || '',
          drop: dropLocation?.label || '',
          pickupJson: pickupLocation ? JSON.stringify(pickupLocation) : undefined,
          dropJson: dropLocation ? JSON.stringify(dropLocation) : undefined,
          pickupDate: pickupDate || '',
          pickupTime: pickupTime || '',
        },
      });
    });
  };

  const handleBookVehicle = (vehicleId?: string) => {
    safeNavigate(() => {
      router.push({
        pathname: '/trip-details',
        params: {
          tripType: 'ONEWAY',
          category: 'ONEWAY',
          vehicle: vehicleId,
          pickup: pickupLocation?.label || '',
          drop: dropLocation?.label || '',
          pickupJson: pickupLocation ? JSON.stringify(pickupLocation) : undefined,
          dropJson: dropLocation ? JSON.stringify(dropLocation) : undefined,
          pickupDate: pickupDate || '',
          pickupTime: pickupTime || '',
        },
      });
    });
  };

  const formatTime12Display = (timeStr?: string) => {
    if (!timeStr) return '07:00 AM';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    if (!timeStr.includes(':')) return timeStr;
    const [hourStr, minStr] = timeStr.split(':');
    const hourNum = parseInt(hourStr, 10);
    if (isNaN(hourNum)) return timeStr;
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
    const padHour = String(displayHour).padStart(2, '0');
    return `${padHour}:${minStr} ${ampm}`;
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[today.getMonth()]} ${today.getFullYear()}`;
    }
    if (/[a-zA-Z]/.test(dateStr) && dateStr.includes(' ')) {
      return dateStr;
    }
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(d.getTime())) {
          return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
        }
      } else {
        // DD-MM-YYYY
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        if (!isNaN(d.getTime())) {
          return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
        }
      }
    }
    return dateStr;
  };

  const handleSwapLocations = () => {
    const temp = pickupLocation;
    setPickupLocation(dropLocation);
    setDropLocation(temp);
    if (viaStops.length > 1) {
      setViaStops([...viaStops].reverse());
    }
  };

  const handleExploreCabs = () => {
    const activePickup = pickupLocation || DEFAULT_PICKUP_LOCATION;
    const activeDrop = dropLocation || DEFAULT_DROP_LOCATION;
    const activeDate = pickupDateDisplay || formatDateDisplay(pickupDate);
    const activeTime = pickupTime || '07:00';

    safeNavigate(() => {
      router.push({
        pathname: '/select-cab',
        params: {
          tripType: selectedTripType,
          category: selectedTripType,
          pickup: activePickup.label,
          drop: activeDrop.label,
          pickupLat: activePickup.lat,
          pickupLng: activePickup.lng,
          dropLat: activeDrop.lat,
          dropLng: activeDrop.lng,
          pickupJson: JSON.stringify(activePickup),
          dropJson: JSON.stringify(activeDrop),
          viaStops: JSON.stringify(viaStops),
          date: activeDate,
          time: activeTime,
        },
      });
    });
  };

  const handleSearchCabs = () => {
    if (!pickupLocation) {
      setIsPickupModalOpen(true);
      return;
    }
    if (!dropLocation) {
      setIsDropModalOpen(true);
      return;
    }

    safeNavigate(() => {
      router.push({
        pathname: '/trip-details',
        params: {
          tripType: 'ONEWAY',
          pickup: pickupLocation.label,
          drop: dropLocation.label,
          pickupJson: JSON.stringify(pickupLocation),
          dropJson: JSON.stringify(dropLocation),
          pickupDate: pickupDate || '',
          pickupTime: pickupTime || '',
        },
      });
    });
  };

  const handleQuickChipPress = (chip: QuickDestChip) => {
    if (!pickupLocation) {
      setPickupLocation({
        label: 'Mangaluru Central Railway Station',
        sublabel: 'MAQ, Hampankatta',
        lat: 12.8634,
        lng: 74.8436,
        category: 'MANGALURU',
      });
    }
    setDropLocation(chip.location);
  };

  const handleSelectPopularRoute = (route: PopularRouteItem) => {
    setPickupLocation(route.fromLocation);
    setDropLocation(route.toLocation);
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const defaultDate = `${day}-${month}-${year}`;

    safeNavigate(() => {
      router.push({
        pathname: '/trip-details',
        params: {
          tripType: route.tripType,
          pickup: route.fromLocation.label,
          drop: route.toLocation.label,
          pickupJson: JSON.stringify(route.fromLocation),
          dropJson: JSON.stringify(route.toLocation),
          pickupDate: pickupDate || defaultDate,
          pickupTime: pickupTime || '09:00',
        },
      });
    });
  };

  const handleNotificationPress = () => {
    Alert.alert(
      'Kandy Cabs Notifications',
      '🎉 Welcome to Kandy Cabs! Book your outstation and airport rides with transparent pricing and top-rated chauffeurs.'
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: topInset }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Header */}
      <View style={styles.header}>
        {/* Left: Brand Logo */}
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />

        {/* Center: Greeting & User Name (Exactly Centered in Middle of Screen) */}
        <View style={styles.headerCenterAbsolute} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.greetingContainer}
            activeOpacity={0.7}
            onPress={() => {
              safeNavigate(() => {
                if (userName || currentUser) {
                  router.push('/profile');
                } else {
                  setIsAuthModalOpen(true);
                }
              });
            }}
          >
            {userName ? (
              <>
                <Text style={styles.greetingSubtext}>{greeting}</Text>
                <Text style={styles.greetingName} numberOfLines={1}>
                  {userName}
                </Text>
              </>
            ) : (
              <Text style={styles.greetingOnlyText}>{greeting}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Right: Notification Bell */}
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={handleNotificationPress}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications" size={18} color="#103A75" />
          <View style={styles.notificationDot} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.mainContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#EE5C21']}
            tintColor="#EE5C21"
          />
        }
      >
        {/* Main Body */}
        <View style={styles.homeBodyCard}>
          {/* 1. Quick Trip Search Card (ONE WAY / ROUND TRIP) */}
          <View style={styles.quickSearchCard}>
            {/* Top Toggle Tabs: ONE WAY / ROUND TRIP */}
            <View style={styles.tripTypeTabsRow}>
              {/* One Way Tab */}
              <TouchableOpacity
                style={[
                  styles.tripTypeTab,
                  selectedTripType === 'ONEWAY' ? styles.tripTypeTabActive : styles.tripTypeTabInactive,
                ]}
                onPress={() => setSelectedTripType('ONEWAY')}
                activeOpacity={0.8}
              >
                <View style={styles.tripTypeIconWrapper}>
                  <Ionicons
                    name="arrow-forward"
                    size={22}
                    color={selectedTripType === 'ONEWAY' ? '#ffffff' : '#0f294a'}
                  />
                </View>
                <View style={styles.tripTypeTextCol}>
                  <Text
                    style={[
                      styles.tripTypeTabTitle,
                      selectedTripType === 'ONEWAY' ? styles.tripTypeTabTitleActive : styles.tripTypeTabTitleInactive,
                    ]}
                  >
                    ONE WAY
                  </Text>
                  <Text
                    style={[
                      styles.tripTypeTabSub,
                      selectedTripType === 'ONEWAY' ? styles.tripTypeTabSubActive : styles.tripTypeTabSubInactive,
                    ]}
                  >
                    Drop-off only
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Round Trip Tab */}
              <TouchableOpacity
                style={[
                  styles.tripTypeTab,
                  selectedTripType === 'ROUND' ? styles.tripTypeTabActive : styles.tripTypeTabInactive,
                ]}
                onPress={() => setSelectedTripType('ROUND')}
                activeOpacity={0.8}
              >
                <View style={styles.tripTypeIconWrapper}>
                  <Ionicons
                    name="sync"
                    size={22}
                    color={selectedTripType === 'ROUND' ? '#ffffff' : '#0f294a'}
                  />
                </View>
                <View style={styles.tripTypeTextCol}>
                  <Text
                    style={[
                      styles.tripTypeTabTitle,
                      selectedTripType === 'ROUND' ? styles.tripTypeTabTitleActive : styles.tripTypeTabTitleInactive,
                    ]}
                  >
                    ROUND TRIP
                  </Text>
                  <Text
                    style={[
                      styles.tripTypeTabSub,
                      selectedTripType === 'ROUND' ? styles.tripTypeTabSubActive : styles.tripTypeTabSubInactive,
                    ]}
                  >
                    Return with same cab
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Locations Box Container (Pickup, Drop & Floating Swap) */}
            <View style={styles.locationsContainer}>
              {/* Pickup Location Box */}
              <TouchableOpacity
                style={styles.locationInputBox}
                onPress={() => setIsPickupModalOpen(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="location-sharp" size={24} color="#ff5400" style={styles.locationPinIcon} />
                <View style={styles.locationInfoCol}>
                  <Text style={styles.locationFieldLabel}>PICKUP LOCATION</Text>
                  <Text style={styles.locationFieldValue} numberOfLines={1}>
                    {pickupLocation?.label || DEFAULT_PICKUP_LOCATION.label}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Via Stops (if any) */}
              {viaStops.map((stop, index) => (
                <View key={`stop-${index}`} style={styles.viaStopBox}>
                  <Ionicons name="radio-button-on" size={18} color="#f97316" style={styles.locationPinIcon} />
                  <View style={styles.locationInfoCol}>
                    <Text style={styles.locationFieldLabel}>STOP {index + 1}</Text>
                    <Text style={styles.locationFieldValue} numberOfLines={1}>
                      {stop.label}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setViaStops((prev) => prev.filter((_, i) => i !== index))}
                    style={styles.removeStopBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Drop Location Box */}
              <TouchableOpacity
                style={styles.locationInputBox}
                onPress={() => setIsDropModalOpen(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="location-sharp" size={24} color="#0284c7" style={styles.locationPinIcon} />
                <View style={styles.locationInfoCol}>
                  <Text style={styles.locationFieldLabel}>DROP LOCATION</Text>
                  <Text style={styles.locationFieldValue} numberOfLines={1}>
                    {dropLocation?.label || DEFAULT_DROP_LOCATION.label}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Floating Swap Button */}
              {viaStops.length === 0 && (
                <TouchableOpacity
                  style={styles.swapButton}
                  onPress={handleSwapLocations}
                  activeOpacity={0.8}
                >
                  <Ionicons name="swap-vertical" size={20} color="#0f294a" />
                </TouchableOpacity>
              )}
            </View>

            {/* Add a Stop Pill Button */}
            {viaStops.length < 3 && (
              <TouchableOpacity
                style={styles.addStopPill}
                onPress={() => setIsStopModalOpen(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.addStopPillText}>+ Add a Stop</Text>
              </TouchableOpacity>
            )}

            {/* Date & Time Row */}
            <View style={styles.dateTimeRow}>
              {/* Trip Start Date */}
              <TouchableOpacity
                style={styles.dateTimeCol}
                onPress={() => setIsDateModalOpen(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="calendar-outline" size={22} color="#0f294a" style={styles.dateTimeIcon} />
                <View style={styles.dateTimeTextCol}>
                  <Text style={styles.dateTimeLabel}>TRIP START DATE</Text>
                  <Text style={styles.dateTimeValue}>
                    {formatDateDisplay(pickupDate)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dateTimeDivider} />

              {/* Pickup Time */}
              <TouchableOpacity
                style={styles.dateTimeCol}
                onPress={() => setIsTimeModalOpen(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="time-outline" size={22} color="#0f294a" style={styles.dateTimeIcon} />
                <View style={styles.dateTimeTextCol}>
                  <Text style={styles.dateTimeLabel}>PICKUP TIME</Text>
                  <Text style={styles.dateTimeValue}>
                    {formatTime12Display(pickupTime)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* CTA Button: EXPLORE CABS ➔ */}
            <TouchableOpacity
              style={styles.exploreCabsBtn}
              onPress={handleExploreCabs}
              activeOpacity={0.85}
            >
              <Text style={styles.exploreCabsBtnText}>EXPLORE CABS</Text>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" style={styles.exploreCabsArrow} />
            </TouchableOpacity>
          </View>

          {/* 2. Specialized Travel Services in 1 Single Row */}
          <View style={styles.servicesSection}>
            <View style={styles.servicesSingleRow}>
              {SERVICE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.serviceRowCard}
                  onPress={() => handleSelectCategory(cat)}
                  activeOpacity={0.75}
                >
                  <View style={styles.serviceRowIconCircle}>
                    {cat.iconFamily === 'MaterialCommunityIcons' ? (
                      <MaterialCommunityIcons name={cat.iconName as any} size={isSmallScreen ? 19 : 22} color="#EE5C21" />
                    ) : (
                      <Ionicons name={cat.iconName as any} size={isSmallScreen ? 18 : 21} color="#EE5C21" />
                    )}
                  </View>
                  <Text style={styles.serviceRowCardTitle} numberOfLines={2}>
                    {cat.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 3. Promotional Banner Carousel Slider (Above Our Vehicles) */}
          <View
            style={styles.promoSliderSection}
            onTouchStart={pauseAutoSlide}
            onTouchEnd={() => scheduleResumeAutoSlide(4000)}
            onTouchCancel={() => scheduleResumeAutoSlide(4000)}
          >
            <FlatList
              ref={carouselRef}
              data={carouselList}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.promoSliderContent}
              snapToInterval={BANNER_CARD_WIDTH + BANNER_CARD_GAP}
              decelerationRate="fast"
              snapToAlignment="start"
              onScroll={handleCarouselScroll}
              scrollEventThrottle={16}
              onTouchStart={pauseAutoSlide}
              onTouchEnd={() => scheduleResumeAutoSlide(4000)}
              onTouchCancel={() => scheduleResumeAutoSlide(4000)}
              onScrollBeginDrag={pauseAutoSlide}
              onScrollEndDrag={() => scheduleResumeAutoSlide(4000)}
              onMomentumScrollEnd={(e) => {
                handleCarouselScroll(e);
                scheduleResumeAutoSlide(4000);
              }}
              renderItem={({ item }) => {
                const isPosterMode = item.showTextOverlay === false;
                const shouldShowCta = item.showCtaButton !== false && Boolean(item.btnText && item.btnText.trim());

                const handleBannerPress = () => {
                  if (item.linkUrl && item.linkUrl.trim()) {
                    let url = item.linkUrl.trim();
                    if (!/^https?:\/\//i.test(url) && !/^(tel|mailto|whatsapp):/i.test(url)) {
                      url = 'https://' + url;
                    }
                    Linking.openURL(url).catch((err) => {
                      console.error('Failed to open banner link URL:', err);
                      Alert.alert('Unable to open link', url);
                    });
                    return;
                  }

                  safeNavigate(() => {
                    const targetType = item.category || 'ONEWAY';
                    router.push({
                      pathname: '/trip-details',
                      params: {
                        tripType: targetType,
                        category: targetType,
                      },
                    });
                  });
                };

                return (
                  <TouchableOpacity
                    style={styles.promoCardContainer}
                    activeOpacity={0.9}
                    onPress={handleBannerPress}
                  >
                    <ImageBackground
                      source={resolveBannerImage(item.image, item.id)}
                      style={styles.promoCardBackground}
                      imageStyle={styles.promoCardImageStyle}
                      resizeMode="cover"
                    >
                      {isPosterMode ? (
                        shouldShowCta ? (
                          <View style={styles.posterCtaContainer}>
                            <View style={styles.promoCardCtaBtn}>
                              <Text style={styles.promoCardCtaText}>{item.btnText}</Text>
                            </View>
                          </View>
                        ) : null
                      ) : (
                        <View style={styles.promoCardOverlay}>
                          <View style={styles.promoCardTextGroup}>
                            {item.badge ? (
                              <View style={styles.promoCardTopBadge}>
                                <Text style={styles.promoCardBadgeText}>{item.badge}</Text>
                              </View>
                            ) : null}
                            {item.tagline ? (
                              <Text style={styles.promoCardTagline} numberOfLines={1}>{item.tagline}</Text>
                            ) : null}
                            {item.subTagline ? (
                              <Text style={styles.promoCardSubTagline} numberOfLines={1}>{item.subTagline}</Text>
                            ) : null}
                          </View>
                          {shouldShowCta ? (
                            <View style={styles.promoCardCtaRow}>
                              <View style={styles.promoCardCtaBtn}>
                                <Text style={styles.promoCardCtaText}>{item.btnText}</Text>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </ImageBackground>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* 4. Upgraded Fleet Showcase */}
          <View style={styles.fleetSection}>
            <View style={styles.fleetHeaderRow}>
              <View style={styles.fleetHeaderTitleCol}>
                <Text style={styles.fleetSectionTitle}>Our Vehicles</Text>
                <Text style={styles.fleetSectionSubtitle}>Choose the right vehicle for your journey</Text>
              </View>
              <View style={styles.fleetAllAcBadge}>
                <Ionicons name="snow" size={11} color="#0284c7" style={{ marginRight: 3 }} />
                <Text style={styles.fleetAllAcText}>All Cabs 100% A/C</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fleetScrollContainer}
            >
              {VEHICLE_FLEET.map((item) => {
                const isSelected = selectedVehicleId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.modernFleetCard, isSelected && styles.modernFleetCardSelected]}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedVehicleId(item.id);
                      handleBookVehicle(item.id);
                    }}
                  >
                    {item.badge ? (
                      <View style={styles.modernFleetBadge}>
                        <Text style={styles.modernFleetBadgeText}>{item.badge}</Text>
                      </View>
                    ) : null}

                    <View style={styles.modernFleetImageWrapper}>
                      <Image
                        source={item.image}
                        style={styles.modernFleetCardImage}
                        resizeMode="contain"
                      />
                    </View>

                    <Text style={styles.modernFleetName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.modernFleetSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>

                    <View style={styles.modernFleetSpecsRow}>
                      <View style={styles.modernFleetSpecPill}>
                        <Ionicons name="people" size={10} color="#475569" style={{ marginRight: 2 }} />
                        <Text style={styles.modernFleetSpecText}>{item.pax}</Text>
                      </View>
                      <View style={styles.modernFleetSpecPill}>
                        <Ionicons name="briefcase" size={10} color="#475569" style={{ marginRight: 2 }} />
                        <Text style={styles.modernFleetSpecText}>{item.bags} Bags</Text>
                      </View>
                    </View>

                    <View style={styles.modernFleetFooter}>
                      <Text style={styles.modernFleetFare}>{item.startingFare}</Text>
                      <View style={styles.modernFleetSelectPill}>
                        <Text style={styles.modernFleetSelectText}>Select</Text>
                        <Ionicons name="chevron-forward" size={11} color="#EE5C21" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* 4. The Kandy Cabs Promise (Trust & Quality) */}
          <View style={styles.trustSection}>
            <View style={styles.trustHeaderRow}>
              <Text style={styles.trustSectionTitle}>The Kandy Cabs Promise</Text>
              <Text style={styles.trustSectionSubtitle}>Trusted by 50,000+ travelers across Karnataka</Text>
            </View>

            <View style={styles.trustGrid}>
              <View style={styles.trustCard}>
                <View style={[styles.trustIconWrap, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                  <Ionicons name="shield-checkmark" size={16} color="#2563eb" />
                </View>
                <View style={styles.trustTextCol}>
                  <Text style={styles.trustCardTitle}>Zero Surge Pricing</Text>
                  <Text style={styles.trustCardDesc}>Fixed upfront pricing with no sudden surge spikes.</Text>
                </View>
              </View>

              <View style={styles.trustCard}>
                <View style={[styles.trustIconWrap, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <Ionicons name="ribbon" size={16} color="#16a34a" />
                </View>
                <View style={styles.trustTextCol}>
                  <Text style={styles.trustCardTitle}>Verified Drivers</Text>
                  <Text style={styles.trustCardDesc}>Background-checked, polite Kannada & English chauffeurs.</Text>
                </View>
              </View>

              <View style={styles.trustCard}>
                <View style={[styles.trustIconWrap, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
                  <Ionicons name="time" size={16} color="#EE5C21" />
                </View>
                <View style={styles.trustTextCol}>
                  <Text style={styles.trustCardTitle}>Guaranteed On-Time</Text>
                  <Text style={styles.trustCardDesc}>Cab arrives 15 mins early for airport & outstation rides.</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.trustCard}
                onPress={() => safeNavigate(() => router.push('/support'))}
                activeOpacity={0.8}
              >
                <View style={[styles.trustIconWrap, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                  <Ionicons name="headset" size={16} color="#9333ea" />
                </View>
                <View style={styles.trustTextCol}>
                  <Text style={styles.trustCardTitle}>24/7 Live Support</Text>
                  <Text style={styles.trustCardDesc}>Direct customer care and WhatsApp roadside assistance.</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Persistent Bottom Navigation Dock */}
      <CustomerBottomDock
        activeTab="HOME"
        onPressProfile={() => {
          if (userName || currentUser) {
            router.push('/profile');
          } else {
            setIsAuthModalOpen(true);
          }
        }}
      />

      {/* Authentication Modal */}
      <AuthModal
        visible={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(userData) => {
          setIsAuthModalOpen(false);
          if (userData) {
            const cleanName = (userData.fullName === 'Kandy Customer' ? '' : (userData.fullName || '')).trim();
            setCurrentUser({ ...userData, fullName: cleanName });
            setUserName(cleanName);
            if (userData.phone) {
              setUserPhone(userData.phone);
            }
          }
        }}
      />

      {/* Quick Booking Modals */}
      <LocationPickerModal
        visible={isPickupModalOpen}
        onClose={() => setIsPickupModalOpen(false)}
        onSelect={(loc) => {
          setPickupLocation(loc);
          setIsPickupModalOpen(false);
        }}
        title="Select Pickup Location"
        currentValue={pickupLocation?.label}
        isPickup={true}
      />

      <LocationPickerModal
        visible={isDropModalOpen}
        onClose={() => setIsDropModalOpen(false)}
        onSelect={(loc) => {
          setDropLocation(loc);
          setIsDropModalOpen(false);
        }}
        title="Select Drop Location"
        currentValue={dropLocation?.label}
        isPickup={false}
      />

      <LocationPickerModal
        visible={isStopModalOpen}
        onClose={() => setIsStopModalOpen(false)}
        onSelect={(loc) => {
          setViaStops((prev) => [...prev, loc]);
          setIsStopModalOpen(false);
        }}
        title="Add Intermediate Stop"
        isPickup={false}
      />

      <DatePickerModal
        visible={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onSelect={(dateKey, displayFormatted) => {
          setPickupDate(displayFormatted);
          setPickupDateDisplay(displayFormatted);
          setIsDateModalOpen(false);
        }}
        currentDate={pickupDate}
      />

      <TimePickerModal
        visible={isTimeModalOpen}
        onClose={() => setIsTimeModalOpen(false)}
        onSelect={(timeStr) => {
          setPickupTime(timeStr);
          setIsTimeModalOpen(false);
        }}
        currentTime={pickupTime}
        selectedDate={pickupDate}
        title="Select Pickup Time"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    position: 'relative',
  },
  headerLogo: {
    width: 95,
    height: 32,
    zIndex: 2,
  },
  headerCenterAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '52%',
  },
  greetingOnlyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#103A75',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  greetingSubtext: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },
  greetingName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#103A75',
    textAlign: 'center',
  },
  notificationButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EE5C21',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
    paddingBottom: 105,
  },
  promoSliderSection: {
    marginVertical: 14,
    width: '100%',
  },
  promoSliderContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  promoCardContainer: {
    width: BANNER_CARD_WIDTH,
    height: BANNER_CARD_HEIGHT,
    marginRight: BANNER_CARD_GAP,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
    }),
  },
  promoCardBackground: {
    width: '100%',
    height: '100%',
  },
  promoCardImageStyle: {
    borderRadius: 18,
  },
  promoCardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    paddingTop: 10,
    paddingLeft: 12,
    paddingRight: 12,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  posterCtaContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  promoCardTextGroup: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 2,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  promoCardTopBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EE5C21',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  promoCardBadgeText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  promoCardTagline: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.1,
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  promoCardSubTagline: {
    fontSize: 10,
    color: '#f8fafc',
    fontWeight: '600',
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  promoCardCtaRow: {
    alignSelf: 'flex-end',
  },
  promoCardCtaBtn: {
    backgroundColor: '#EE5C21',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  promoCardCtaText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  homeBodyCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginTop: 0,
    paddingTop: 4,
    paddingBottom: 0,
    zIndex: 10,
  },
  quickSearchCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
    }),
  },
  tripTypeTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  tripTypeTabActive: {
    backgroundColor: '#ff5400',
  },
  tripTypeTabInactive: {
    backgroundColor: '#f1f5f9',
  },
  tripTypeIconWrapper: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripTypeTextCol: {
    flex: 1,
  },
  tripTypeTabTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tripTypeTabTitleActive: {
    color: '#ffffff',
  },
  tripTypeTabTitleInactive: {
    color: '#0f294a',
  },
  tripTypeTabSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  tripTypeTabSubActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  tripTypeTabSubInactive: {
    color: '#64748b',
  },
  locationsContainer: {
    position: 'relative',
    marginTop: 12,
    gap: 8,
  },
  locationInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  viaStopBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  removeStopBtn: {
    padding: 4,
    marginLeft: 6,
  },
  locationPinIcon: {
    marginRight: 10,
  },
  locationInfoCol: {
    flex: 1,
    paddingRight: 36,
  },
  locationFieldLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationFieldValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f294a',
  },
  swapButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
      },
    }),
  },
  addStopPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#ff5400',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addStopPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ff5400',
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  dateTimeCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeIcon: {
    marginRight: 8,
  },
  dateTimeTextCol: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dateTimeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f294a',
  },
  dateTimeDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  exploreCabsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff5400',
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#ff5400',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: '#ff5400',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
    }),
  },
  exploreCabsBtnText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  exploreCabsArrow: {
    marginLeft: 8,
  },
  servicesSection: {
    paddingHorizontal: 12,
    marginTop: 0,
    marginBottom: 14,
  },
  servicesSingleRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  serviceRowCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: isSmallScreen ? 10 : 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
    }),
  },
  serviceRowIconCircle: {
    width: isSmallScreen ? 38 : 42,
    height: isSmallScreen ? 38 : 42,
    borderRadius: isSmallScreen ? 19 : 21,
    backgroundColor: '#FFF4EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  serviceRowCardTitle: {
    fontSize: isSmallScreen ? 10 : 11,
    fontWeight: '700',
    color: '#103A75',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 13 : 14,
    minHeight: isSmallScreen ? 26 : 28,
  },
  servicePopularBadge: {
    position: 'absolute',
    top: -5,
    right: 4,
    backgroundColor: '#EE5C21',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    zIndex: 5,
  },
  servicePopularBadgeText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  serviceValueBadge: {
    backgroundColor: '#16a34a',
  },
  serviceValueBadgeText: {
    color: '#ffffff',
  },
  serviceIconCircle: {
    width: isSmallScreen ? 42 : 48,
    height: isSmallScreen ? 42 : 48,
    borderRadius: isSmallScreen ? 21 : 24,
    backgroundColor: '#fff7ed',
    borderWidth: 1.2,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isSmallScreen ? 5 : 6,
  },
  serviceCardTitle: {
    fontSize: isSmallScreen ? 10.8 : 11.8,
    fontWeight: '700',
    color: '#103A75',
    textAlign: 'center',
    lineHeight: isSmallScreen ? 13 : 14.5,
  },
  // Quick Booking Card
  quickBookingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: isSmallScreen ? 10 : 13,
    paddingHorizontal: isSmallScreen ? 10 : 13,
    marginHorizontal: 10,
    marginTop: isSmallScreen ? 12 : 15,
    marginBottom: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
    }),
  },
  quickBookingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: isSmallScreen ? 8 : 10,
    paddingHorizontal: 2,
  },
  quickBookingTitle: {
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '800',
    color: '#103A75',
    letterSpacing: -0.3,
  },
  quickBookingSubtitle: {
    fontSize: isSmallScreen ? 10 : 10.8,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  quickBookingLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  liveDotText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#16a34a',
  },

  // Connected Route Journey
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  routeTrackCol: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  routeOriginDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#16a34a',
    backgroundColor: '#ffffff',
  },
  routeConnectorLine: {
    width: 1.5,
    height: isSmallScreen ? 24 : 28,
    backgroundColor: '#cbd5e1',
    marginVertical: 2,
  },
  routeDestPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeInputsCol: {
    flex: 1,
    paddingLeft: 4,
  },
  routeInputBox: {
    paddingVertical: isSmallScreen ? 6 : 8,
    justifyContent: 'center',
  },
  routeInputLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  routeInputValue: {
    fontSize: isSmallScreen ? 11.5 : 12.5,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 1,
  },
  routeInputValueActive: {
    color: '#103A75',
    fontWeight: '700',
  },
  routeInputSeparator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginRight: 6,
  },

  // Quick Destination Chips
  quickDestSection: {
    marginBottom: 10,
  },
  quickDestHeader: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 5,
    paddingHorizontal: 2,
  },
  quickDestScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 6,
  },
  quickDestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
  },
  quickDestChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#EE5C21',
  },

  // Date & Time Row
  scheduleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  schedulePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: isSmallScreen ? 6 : 8,
  },
  scheduleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  scheduleTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  scheduleLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.4,
  },
  scheduleValue: {
    fontSize: isSmallScreen ? 11 : 12,
    fontWeight: '700',
    color: '#103A75',
    marginTop: 1,
  },

  // Search Cabs Primary Button
  searchCabsBtn: {
    flexDirection: 'row',
    backgroundColor: '#EE5C21',
    borderRadius: 12,
    paddingVertical: isSmallScreen ? 11 : 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#EE5C21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.32,
        shadowRadius: 7,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: '#EE5C21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.32,
        shadowRadius: 7,
      },
    }),
  },
  searchCabsBtnText: {
    color: '#ffffff',
    fontSize: isSmallScreen ? 13 : 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Popular Outstation Routes Section
  popularRoutesSection: {
    marginTop: isSmallScreen ? 14 : 18,
    paddingHorizontal: 10,
  },
  popularRoutesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  popularRoutesTitle: {
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '800',
    color: '#103A75',
    letterSpacing: -0.3,
  },
  popularRoutesSubtitle: {
    fontSize: isSmallScreen ? 10 : 10.8,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  popularRoutesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  popularRoutesBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#16a34a',
    letterSpacing: 0.3,
  },
  popularRoutesScroll: {
    paddingRight: 10,
    gap: 10,
    paddingVertical: 2,
  },
  popularRouteCard: {
    width: width * 0.65,
    maxWidth: 240,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 11,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  popularRouteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  popularRouteTagWrap: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  popularRouteTagText: {
    fontSize: 7.8,
    fontWeight: '800',
    color: '#EE5C21',
    letterSpacing: 0.2,
  },
  popularRouteDistance: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748b',
  },
  popularRoutePathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  popularRouteCity: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#103A75',
    flexShrink: 1,
  },
  popularRouteBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  popularRouteFromLabel: {
    fontSize: 8.5,
    color: '#64748b',
    fontWeight: '500',
  },
  popularRoutePrice: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#103A75',
  },
  popularRouteBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EE5C21',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 8,
    gap: 2,
  },
  popularRouteBookText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Fleet Section Styles
  fleetSection: {
    marginTop: isSmallScreen ? 14 : 18,
    paddingHorizontal: 10,
  },
  fleetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  fleetHeaderTitleCol: {
    flex: 1,
  },
  fleetSectionTitle: {
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '800',
    color: '#103A75',
    letterSpacing: -0.3,
  },
  fleetSectionSubtitle: {
    fontSize: isSmallScreen ? 10 : 10.8,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  fleetAllAcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  fleetAllAcText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0284c7',
  },
  fleetScrollContainer: {
    paddingRight: 10,
    gap: 10,
    paddingVertical: 2,
  },
  modernFleetCard: {
    width: width * 0.58,
    maxWidth: 220,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    padding: 10,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modernFleetCardSelected: {
    borderColor: '#EE5C21',
    backgroundColor: '#fffdfa',
  },
  modernFleetBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EE5C21',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    zIndex: 5,
  },
  modernFleetBadgeText: {
    color: '#ffffff',
    fontSize: 7.2,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modernFleetImageWrapper: {
    width: '100%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  modernFleetCardImage: {
    width: '92%',
    height: 56,
  },
  modernFleetName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#103A75',
    letterSpacing: -0.2,
  },
  modernFleetSubtitle: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
    marginBottom: 6,
  },
  modernFleetSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  modernFleetSpecPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  modernFleetSpecText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  modernFleetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  modernFleetFare: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EE5C21',
  },
  modernFleetSelectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  modernFleetSelectText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#EE5C21',
  },

  // Trust & Safety Section
  trustSection: {
    marginTop: isSmallScreen ? 14 : 18,
    marginHorizontal: 10,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  trustHeaderRow: {
    marginBottom: 10,
    alignItems: 'center',
  },
  trustSectionTitle: {
    fontSize: isSmallScreen ? 13.5 : 14.5,
    fontWeight: '800',
    color: '#103A75',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  trustSectionSubtitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  trustCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    gap: 7,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  trustIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  trustTextCol: {
    flex: 1,
  },
  trustCardTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#103A75',
    marginBottom: 2,
    lineHeight: 13.5,
  },
  trustCardDesc: {
    fontSize: 8.5,
    color: '#64748b',
    lineHeight: 11.5,
    fontWeight: '500',
  },
});
