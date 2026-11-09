// Refreshed DatePicker
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text as RNText,
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
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AuthModal } from '../components/AuthModal';
import { CustomerBottomDock } from '../components/CustomerBottomDock';
import { LocationPickerModal } from '../components/LocationPickerModal';
import { DatePickerModal } from '../components/DatePickerModal';
import { TimePickerModal } from '../components/TimePickerModal';
import { PlaceLocation, isLocalDistanceRoute, isSameLocation } from '../lib/locations';
import { customerApiClient, customerTokenStorage, getDynamicBaseUrl } from '../lib/api';
import { safeNavigate } from '../lib/safeNav';
import { LanguageSelectionModal } from '../components/LanguageSelectionModal';
import {
  isNewUserLangPromptNeeded,
  markNewUserLangPromptDone,
  clearNewUserFlag,
  changeAppLanguage,
  saveUserLanguagePreference,
} from '../lib/i18n';
import { APP_FONT, resolveRobotoStyle, formatTitleCase } from '../constants/typography';

// Roboto Typography Configuration (Universal Clean Sans-Serif)
const ROBOTO_FONT = APP_FONT;

// Home Screen Roboto Text Wrapper - ensures exact Roboto font variant is applied
const Text = React.forwardRef<any, React.ComponentProps<typeof RNText>>(({ style, ...props }, ref) => {
  const robotoOverride = resolveRobotoStyle(style);
  return <RNText ref={ref} style={robotoOverride ? [style, robotoOverride] : style} {...props} />;
});

const { width, height } = Dimensions.get('window');
const isSmallScreen = height < 700 || width < 380;
const isMediumScreen = height >= 700 && height < 820;

const BANNER_CARD_WIDTH = Math.round(width - 32); // Full width slider card (16px screen padding on sides)
const BANNER_CARD_HEIGHT = 155; // Fixed slider height across all mobile devices

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
    id: 'ev-cab',
    badge: '',
    tagline: '',
    subTagline: '',
    image: require('../assets/images/banner-ev-cab.jpg'),
    btnText: '',
    showTextOverlay: false,
    showCtaButton: false,
  },
  {
    id: '2',
    badge: '',
    tagline: '',
    subTagline: '',
    image: require('../assets/images/banner-airport.jpg'),
    btnText: '',
    showTextOverlay: false,
    showCtaButton: false,
  },
];

const LOCAL_BANNER_ASSETS: Record<string, any> = {
  '/images/banner-deepawali.jpg': require('../assets/images/banner-deepawali.jpg'),
  'banner-deepawali.jpg': require('../assets/images/banner-deepawali.jpg'),
  'banner-deepawali': require('../assets/images/banner-deepawali.jpg'),
  'deepawali': require('../assets/images/banner-deepawali.jpg'),
  '/images/banner-christmas.jpg': require('../assets/images/banner-christmas.jpg'),
  'banner-christmas.jpg': require('../assets/images/banner-christmas.jpg'),
  'banner-christmas': require('../assets/images/banner-christmas.jpg'),
  'christmas': require('../assets/images/banner-christmas.jpg'),
  '/images/banner-ev-cab.jpg': require('../assets/images/banner-ev-cab.jpg'),
  'banner-ev-cab.jpg': require('../assets/images/banner-ev-cab.jpg'),
  'banner-ev-cab': require('../assets/images/banner-ev-cab.jpg'),
  'ev-cab': require('../assets/images/banner-ev-cab.jpg'),
  '/images/banner-coorg.jpg': require('../assets/images/banner-coorg.jpg'),
  'banner-coorg.jpg': require('../assets/images/banner-coorg.jpg'),
  '/images/banner-airport.jpg': require('../assets/images/banner-airport.jpg'),
  'banner-airport.jpg': require('../assets/images/banner-airport.jpg'),
  '/images/banner-coastal-highway.jpg': require('../assets/images/banner-coastal-highway.jpg'),
  'banner-coastal-highway.jpg': require('../assets/images/banner-coastal-highway.jpg'),
  '/images/banner-airport-transfers.jpg': require('../assets/images/banner-airport-transfers.jpg'),
  'banner-airport-transfers.jpg': require('../assets/images/banner-airport-transfers.jpg'),
  '/images/banner-pilgrimage.jpg': require('../assets/images/banner-pilgrimage.jpg'),
  'banner-pilgrimage.jpg': require('../assets/images/banner-pilgrimage.jpg'),
  'banner-1': require('../assets/images/banner-coorg.jpg'),
  'banner-2': require('../assets/images/banner-airport.jpg'),
  'banner-3': require('../assets/images/banner-pilgrimage.jpg'),
  '1': require('../assets/images/banner-coorg.jpg'),
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

    if (cleaned.includes('deepawali') || cleaned.includes('diwali') || cleaned.includes('festival') || cleaned.includes('kcd500')) {
      return LOCAL_BANNER_ASSETS['banner-deepawali.jpg'];
    }
    if (cleaned.includes('christmas') || cleaned.includes('xmas') || cleaned.includes('kcmc25') || cleaned.includes('merry')) {
      return LOCAL_BANNER_ASSETS['banner-christmas.jpg'];
    }
    if (cleaned.includes('ev') || cleaned.includes('electric') || cleaned.includes('smart rides') || cleaned.includes('ev cab')) {
      return LOCAL_BANNER_ASSETS['banner-ev-cab.jpg'];
    }
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
    subtitle: 'Ertiga 6-Seater',
    pax: '6 + 1',
    bags: '3',
    image: require('../assets/images/fleet-4-ertiga.png'),
    startingFare: 'From ₹14/km',
    badge: 'FAMILY CHOICE',
  },
  {
    id: 'innova',
    name: 'Innova',
    subtitle: 'Innova 7-Seater',
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
  const { t } = useTranslation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  console.log('[DIMENSIONS]', { windowWidth, windowHeight, isSmallDevice: windowHeight < 720 || windowWidth < 380 });
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const bottomInset = insets.bottom || 0;
  const screenDimensions = Dimensions.get('screen');
  const screenHeight = Math.max(screenDimensions.height, windowHeight);
  const isLargeScreen = screenHeight >= 830 || windowHeight >= 780;
  const isMediumScreen = !isLargeScreen && (screenHeight >= 720 || windowHeight >= 700);
  const isSmallDevice = windowHeight < 700 || windowWidth < 380;

  const [bookingCardHeight, setBookingCardHeight] = useState(0);
  const [servicesHeight, setServicesHeight] = useState(0);

  // Dynamic responsive sizing for home components across all mobile screen sizes (100vh locked)
  const responsiveSizes = useMemo(() => {
    if (isLargeScreen) {
      // Large screens (Pixel 7/8/9, OnePlus 11/12/13, Galaxy S21/S22/S23+, iPhone 14/15/16 Pro Max, 830dp+)
      return {
        headerPaddingVertical: 9,
        headerLogoWidth: 98,
        headerLogoHeight: 31,
        headerGreetingSize: 15.5,
        headerSubtextSize: 11,
        headerNotifIconSize: 19,
        topSpacing: 8,
        bottomSpacing: 6,
        bottomGroupGap: 9,
        cardToIconsGap: 12,
        searchCardMaxHeight: 385,
        bannerHeight: 165,
        sectionGap: 9,
        cardPadding: 13,
        cardMarginHorizontal: 13,
        tabPaddingVertical: 7.5,
        tabTitleSize: 15,
        tabSubSize: 11.2,
        tabIconSize: 19,
        locationsMarginTop: 8,
        locationsGap: 6.5,
        locationPaddingVertical: 7.5,
        locationIconSize: 20,
        locationLabelSize: 11,
        locationValueSize: 14.2,
        swapButtonSize: 31,
        swapIconSize: 16,
        addStopPaddingVertical: 3.2,
        addStopTextSize: 12,
        addStopIconSize: 15,
        dateTimePaddingVertical: 7,
        dateTimeMinHeight: 46,
        dateTimeMarginTop: 8,
        dateTimeIconSize: 18,
        dateTimeLabelSize: 11,
        dateTimeValueSize: 14.2,
        bookBtnPaddingVertical: 10.5,
        bookBtnMarginTop: 9.5,
        bookBtnTextSize: 16,
        serviceCardPaddingVertical: 8,
        serviceIconCircleSize: 40,
        serviceIconSize: 25,
        serviceTitleSize: 11.5,
        serviceTitleMinHeight: 26,
        helpPaddingVertical: 8.5,
        helpIconSize: 20,
        helpIconCircleSize: 32,
        helpTitleSize: 13,
        helpSubtitleSize: 10.5,
      };
    } else if (isMediumScreen) {
      // Standard / Medium screens (iPhone 13/14/15/16 standard, Pixel 6a/7a, 720-830dp)
      return {
        headerPaddingVertical: 7.5,
        headerLogoWidth: 90,
        headerLogoHeight: 27,
        headerGreetingSize: 14,
        headerSubtextSize: 10,
        headerNotifIconSize: 17,
        topSpacing: 7,
        bottomSpacing: 5,
        bottomGroupGap: 7.5,
        cardToIconsGap: 9.5,
        searchCardMaxHeight: 345,
        bannerHeight: 146,
        sectionGap: 7.5,
        cardPadding: 10,
        cardMarginHorizontal: 11,
        tabPaddingVertical: 5.8,
        tabTitleSize: 14,
        tabSubSize: 10.5,
        tabIconSize: 17,
        locationsMarginTop: 6,
        locationsGap: 5,
        locationPaddingVertical: 5.8,
        locationIconSize: 18,
        locationLabelSize: 10.5,
        locationValueSize: 13.5,
        swapButtonSize: 28,
        swapIconSize: 15,
        addStopPaddingVertical: 2.8,
        addStopTextSize: 11.5,
        addStopIconSize: 14,
        dateTimePaddingVertical: 5.5,
        dateTimeMinHeight: 39,
        dateTimeMarginTop: 6,
        dateTimeIconSize: 17,
        dateTimeLabelSize: 10.5,
        dateTimeValueSize: 13.5,
        bookBtnPaddingVertical: 8.5,
        bookBtnMarginTop: 7.5,
        bookBtnTextSize: 15,
        serviceCardPaddingVertical: 6.5,
        serviceIconCircleSize: 34,
        serviceIconSize: 21,
        serviceTitleSize: 10.8,
        serviceTitleMinHeight: 22,
        helpPaddingVertical: 6.5,
        helpIconSize: 18,
        helpIconCircleSize: 29,
        helpTitleSize: 11.8,
        helpSubtitleSize: 9.5,
      };
    } else {
      // Compact / Small screens (<720dp, e.g. 720x1280 physical / 360x640 dp, iPhone SE)
      return {
        headerPaddingVertical: 4,
        headerLogoWidth: 76,
        headerLogoHeight: 22,
        headerGreetingSize: 12.2,
        headerSubtextSize: 8.8,
        headerNotifIconSize: 15,
        topSpacing: 4,
        bottomSpacing: 4,
        bottomGroupGap: 5,
        cardToIconsGap: 6,
        searchCardMaxHeight: 310,
        bannerHeight: 136,
        sectionGap: 5,
        cardPadding: 6,
        cardMarginHorizontal: 8,
        tabPaddingVertical: 3.5,
        tabTitleSize: 12.2,
        tabSubSize: 8.8,
        tabIconSize: 14,
        locationsMarginTop: 3.5,
        locationsGap: 2.5,
        locationPaddingVertical: 3.2,
        locationIconSize: 15,
        locationLabelSize: 9,
        locationValueSize: 11.8,
        swapButtonSize: 24,
        swapIconSize: 12,
        addStopPaddingVertical: 1.8,
        addStopTextSize: 10,
        addStopIconSize: 12,
        dateTimePaddingVertical: 3,
        dateTimeMinHeight: 30,
        dateTimeMarginTop: 3.2,
        dateTimeIconSize: 14,
        dateTimeLabelSize: 9,
        dateTimeValueSize: 11.8,
        bookBtnPaddingVertical: 5.5,
        bookBtnMarginTop: 4,
        bookBtnTextSize: 13,
        serviceCardPaddingVertical: 3.8,
        serviceIconCircleSize: 26,
        serviceIconSize: 16,
        serviceTitleSize: 9,
        serviceTitleMinHeight: 16,
        helpPaddingVertical: 4,
        helpIconSize: 15,
        helpIconCircleSize: 24,
        helpTitleSize: 10.5,
        helpSubtitleSize: 8.5,
      };
    }
  }, [windowHeight, isLargeScreen, isMediumScreen]);

  const headerInnerHeight = (responsiveSizes.headerPaddingVertical * 2) + responsiveSizes.headerLogoHeight;
  const totalHeaderHeight = headerInnerHeight + topInset;
  const dockHeight = Math.max(50, 44 + bottomInset);
  const availableBodyHeight = Math.max(380, Math.floor(windowHeight - totalHeaderHeight - dockHeight));

  const [carouselList, setCarouselList] = useState<CarouselItem[]>(CAROUSEL_DATA);
  const carouselRef = useRef<FlatList>(null);

  const params = useLocalSearchParams<{ showLangModal?: string }>();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('sedan');

  const [isAuthChecking, setIsAuthChecking] = useState(() => !customerTokenStorage.getToken());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLangPromptModalOpen, setIsLangPromptModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(customerTokenStorage.getUser());
  const [userName, setUserName] = useState<string>(formatTitleCase(customerTokenStorage.getUser()?.fullName) || '');
  const [userPhone, setUserPhone] = useState<string>(customerTokenStorage.getUser()?.phone || '');

  const [refreshing, setRefreshing] = useState(false);

  // Quick Booking State (One Way / Round Trip Card)
  const [selectedTripType, setSelectedTripType] = useState<'ONEWAY' | 'ROUND'>('ONEWAY');
  const [pickupLocation, setPickupLocation] = useState<PlaceLocation | null>(null);
  const [dropLocation, setDropLocation] = useState<PlaceLocation | null>(null);
  const [viaStops, setViaStops] = useState<PlaceLocation[]>([]);
  const [pickupDate, setPickupDate] = useState<string>('');
  const [pickupDateDisplay, setPickupDateDisplay] = useState<string>('');
  const [pickupTime, setPickupTime] = useState<string>('');
  const [returnDate, setReturnDate] = useState<string>('');
  const [returnDateDisplay, setReturnDateDisplay] = useState<string>('');

  // Exact 16:9 widescreen ratio (1792 × 1024 / 1.75 : 1) so full banner graphic is viewable without cropping
  const idealBannerWidth = Math.round(windowWidth - 24);
  const idealBannerHeight = Math.round(idealBannerWidth * (1024 / 1792));

  // Dynamically calculate available space so entire 100vh fits comfortably without scrolling
  const estimatedCard1Height =
    (responsiveSizes.cardPadding * 2) +
    (responsiveSizes.tabPaddingVertical * 2 + 28) +
    (responsiveSizes.locationsMarginTop + (responsiveSizes.locationPaddingVertical * 2 + 30) * 2 + responsiveSizes.locationsGap) +
    (viaStops.length > 0 ? Math.min(viaStops.length * 40, 80) : 0) +
    (viaStops.length < 12 ? 26 : 0) +
    (responsiveSizes.dateTimeMarginTop + responsiveSizes.dateTimeMinHeight) +
    (responsiveSizes.bookBtnMarginTop + responsiveSizes.bookBtnPaddingVertical * 2 + 26);

  const estimatedCard2Height =
    (responsiveSizes.serviceCardPaddingVertical * 2) +
    responsiveSizes.serviceIconCircleSize +
    responsiveSizes.serviceTitleMinHeight + 10;

  const estimatedCard4Height = (responsiveSizes.helpPaddingVertical * 2) + 38;

  const dynamicBannerHeight = responsiveSizes.bannerHeight;
  const bannerCardWidth = Math.round(windowWidth - (responsiveSizes.cardMarginHorizontal * 2));

  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [routeModalTarget, setRouteModalTarget] = useState<'PICKUP' | 'STOP' | 'DROP'>('PICKUP');
  const [routeModalStopIndex, setRouteModalStopIndex] = useState<number>(0);

  const openLocationModal = (target: 'PICKUP' | 'STOP' | 'DROP', stopIdx: number = 0) => {
    setRouteModalTarget(target);
    setRouteModalStopIndex(stopIdx);
    setIsRouteModalOpen(true);
  };

  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [isReturnDateModalOpen, setIsReturnDateModalOpen] = useState(false);

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

      const fetchWithTimeout = async (fn: () => Promise<any>) => {
        return Promise.race([
          fn(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
        ]);
      };

      for (const fn of endpoints) {
        try {
          const res = await fetchWithTimeout(fn);
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
                : false,
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
    setIsAuthChecking(false);

    const cached = customerTokenStorage.getUser();
    if (cached) {
      setCurrentUser(cached);
      setUserName(formatTitleCase(cached.fullName) || 'Valued Customer');
      setUserPhone(cached.phone || '');
    }

    try {
      const res = await customerApiClient.fetch('/api/auth/me');
      const cleanName = formatTitleCase(res.user.fullName === 'Kandy Customer' ? '' : (res.user.fullName || ''));
      customerTokenStorage.setUser({ ...res.user, fullName: cleanName });
      setCurrentUser({ ...res.user, fullName: cleanName });
      setUserName(cleanName);
      setUserPhone(res.user.phone || '');

      // Restore user's saved language preference if present
      if (res.user?.preferredLanguage && (res.user.preferredLanguage === 'en' || res.user.preferredLanguage === 'kn' || res.user.preferredLanguage === 'hi')) {
        await changeAppLanguage(res.user.preferredLanguage);
        if (res.user.phone) {
          await saveUserLanguagePreference(res.user.phone, res.user.preferredLanguage);
        }
      }
    } catch {
      // ignore network error
    }
  }, [router]);

  useEffect(() => {
    syncAuth();
    const unsub = customerTokenStorage.subscribe(() => {
      const u = customerTokenStorage.getUser();
      setCurrentUser(u);
      setUserName(formatTitleCase(u?.fullName) || '');
      setUserPhone(u?.phone || '');
    });
    return () => unsub();
  }, [syncAuth]);

  // Check if initial language selection popup is needed (shown once after registration/login)
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const checkLangPrompt = async () => {
        try {
          const token = customerTokenStorage.getToken() || (await customerTokenStorage.getTokenAsync());
          if (!token) return;

          // 1. Direct param trigger from registration/login navigation
          if (params?.showLangModal === '1' && active) {
            setTimeout(() => {
              if (active) {
                setIsLangPromptModalOpen(true);
              }
            }, 300);
            return;
          }

          // 2. Persistent check for new registrations
          const activeUser = customerTokenStorage.getUser() || currentUser;
          const needed = await isNewUserLangPromptNeeded(activeUser);
          if (needed && active) {
            // Delay briefly to allow home screen layout and transitions to finish smoothly
            setTimeout(() => {
              if (active) {
                setIsLangPromptModalOpen(true);
              }
            }, 300);
          }
        } catch (err) {
          console.warn('Language prompt check error:', err);
        }
      };

      checkLangPrompt();
      return () => {
        active = false;
      };
    }, [currentUser, params?.showLangModal])
  );

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

  const advanceSlide = useCallback(() => {
    if (carouselList.length <= 1 || isInteractingRef.current) return;
    const nextIndex = (activeIndexRef.current + 1) % carouselList.length;
    activeIndexRef.current = nextIndex;
    try {
      carouselRef.current?.scrollToOffset({
        offset: nextIndex * windowWidth,
        animated: true,
      });
    } catch {
      // fallback
    }
  }, [carouselList.length, windowWidth]);

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
    const index = Math.round(scrollPosition / windowWidth);
    if (index >= 0 && index < carouselList.length) {
      activeIndexRef.current = index;
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
    if (!timeStr) return '';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr.replace(/ /g, '\u00A0');
    if (!timeStr.includes(':')) return timeStr;
    const [hourStr, minStr] = timeStr.split(':');
    const hourNum = parseInt(hourStr, 10);
    if (isNaN(hourNum)) return timeStr;
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
    const padHour = String(displayHour).padStart(2, '0');
    return `${padHour}:${minStr}\u00A0${ampm}`;
  };

  const formatDateDisplay = (dateStr?: string, compact?: boolean) => {
    if (!dateStr) {
      return '';
    }
    if (/[a-zA-Z]/.test(dateStr) && dateStr.includes(' ')) {
      const parts = dateStr.trim().split(/\s+/);
      if (compact && parts.length >= 2) {
        return `${parts[0]}\u00A0${parts[1]}`;
      }
      return dateStr.replace(/ /g, '\u00A0');
    }
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(d.getTime())) {
          return compact
            ? `${String(d.getDate()).padStart(2, '0')}\u00A0${months[d.getMonth()]}`
            : `${String(d.getDate()).padStart(2, '0')}\u00A0${months[d.getMonth()]}\u00A0${d.getFullYear()}`;
        }
      } else {
        // DD-MM-YYYY
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        if (!isNaN(d.getTime())) {
          return compact
            ? `${String(d.getDate()).padStart(2, '0')}\u00A0${months[d.getMonth()]}`
            : `${String(d.getDate()).padStart(2, '0')}\u00A0${months[d.getMonth()]}\u00A0${d.getFullYear()}`;
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
    if (!pickupLocation) {
      openLocationModal('PICKUP');
      return;
    }
    if (!dropLocation) {
      openLocationModal('DROP');
      return;
    }

    if (isSameLocation(pickupLocation, dropLocation)) {
      Alert.alert(
        t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
        t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
      );
      openLocationModal('DROP');
      return;
    }

    if (isLocalDistanceRoute(pickupLocation, dropLocation, viaStops)) {
      Alert.alert(
        'Local Rental Switched',
        "Since your pickup and drop location is same city we've switched to local rental",
        [
          {
            text: 'OK',
            onPress: () => {
              safeNavigate(() => {
                router.push({
                  pathname: '/trip-details',
                  params: {
                    tripType: 'LOCAL',
                    category: 'LOCAL',
                    pickup: pickupLocation.label,
                    pickupJson: JSON.stringify(pickupLocation),
                    pickupDate: pickupDate || '',
                    pickupTime: pickupTime || '',
                  },
                });
              });
            },
          },
        ]
      );
      return;
    }

    if (!pickupDate) {
      setIsDateModalOpen(true);
      return;
    }
    if (!pickupTime) {
      setIsTimeModalOpen(true);
      return;
    }
    if (selectedTripType === 'ROUND' && !returnDate) {
      setIsReturnDateModalOpen(true);
      return;
    }

    const activePickup = pickupLocation;
    const activeDrop = dropLocation;
    const activeDate = pickupDateDisplay || formatDateDisplay(pickupDate);
    const activeTime = pickupTime;
    const activeReturnDate = returnDateDisplay || (returnDate ? formatDateDisplay(returnDate) : undefined);

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
          returnDate: activeReturnDate,
        },
      });
    });
  };

  const handleSearchCabs = () => {
    if (!pickupLocation) {
      openLocationModal('PICKUP');
      return;
    }
    if (!dropLocation) {
      openLocationModal('DROP');
      return;
    }

    if (isSameLocation(pickupLocation, dropLocation)) {
      Alert.alert(
        t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
        t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
      );
      openLocationModal('DROP');
      return;
    }

    if (isLocalDistanceRoute(pickupLocation, dropLocation, viaStops)) {
      Alert.alert(
        'Local Rental Switched',
        "Since your pickup and drop location is same city we've switched to local rental",
        [
          {
            text: 'OK',
            onPress: () => {
              safeNavigate(() => {
                router.push({
                  pathname: '/trip-details',
                  params: {
                    tripType: 'LOCAL',
                    category: 'LOCAL',
                    pickup: pickupLocation.label,
                    pickupJson: JSON.stringify(pickupLocation),
                    pickupDate: pickupDate || '',
                    pickupTime: pickupTime || '',
                  },
                });
              });
            },
          },
        ]
      );
      return;
    }

    safeNavigate(() => {
      router.push({
        pathname: '/trip-details',
        params: {
          tripType: selectedTripType || 'ONEWAY',
          pickup: pickupLocation.label,
          drop: dropLocation.label,
          pickupJson: JSON.stringify(pickupLocation),
          dropJson: JSON.stringify(dropLocation),
          pickupDate: pickupDate || '',
          pickupTime: pickupTime || '',
          returnDate: returnDate || '',
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
    router.push('/notifications');
  };

  if (isAuthChecking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Top Header (Dark Blue) */}
      <View style={[styles.headerWrapper, { paddingTop: topInset }]}>
        <View style={[styles.header, { paddingVertical: responsiveSizes.headerPaddingVertical }]}>
          {/* Left: Brand Logo (White version for dark blue background) */}
          <Image
            source={require('../assets/images/logo-white.png')}
            style={[
              styles.headerLogo,
              {
                width: responsiveSizes.headerLogoWidth,
                height: responsiveSizes.headerLogoHeight,
              },
            ]}
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
                  <Text style={[styles.greetingSubtext, { fontSize: responsiveSizes.headerSubtextSize }]}>{greeting}</Text>
                  <Text
                    style={[styles.greetingName, { fontSize: responsiveSizes.headerGreetingSize }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.75}
                  >
                    {formatTitleCase(userName)}
                  </Text>
                </>
              ) : (
                <Text style={[styles.greetingOnlyText, { fontSize: responsiveSizes.headerGreetingSize }]}>{greeting}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Right: Notification Bell */}
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={handleNotificationPress}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications" size={responsiveSizes.headerNotifIconSize} color="#ffffff" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content - Normal Clean Natural Flow */}
      <ScrollView
        style={styles.mainContainer}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 8,
            paddingBottom: 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        {/* 1. Quick Trip Search Card (ONE WAY / ROUND TRIP) */}
        <View
          style={[
            styles.quickSearchCard,
            {
              marginHorizontal: responsiveSizes.cardMarginHorizontal,
              padding: responsiveSizes.cardPadding,
              marginBottom: 10,
            },
          ]}
        >
            {/* Top Toggle Tabs: ONE WAY / ROUND TRIP */}
            <View style={styles.tripTypeTabsRow}>
              {/* One Way Tab */}
              <TouchableOpacity
                style={[
                  styles.tripTypeTab,
                  { paddingVertical: responsiveSizes.tabPaddingVertical },
                  selectedTripType === 'ONEWAY' ? styles.tripTypeTabActive : styles.tripTypeTabInactive,
                ]}
                onPress={() => setSelectedTripType('ONEWAY')}
                activeOpacity={0.8}
              >
                <View style={styles.tripTypeIconWrapper}>
                  <Ionicons
                    name="arrow-forward"
                    size={responsiveSizes.tabIconSize}
                    color={selectedTripType === 'ONEWAY' ? '#ffffff' : 'rgb(22, 34, 50)'}
                  />
                </View>
                <View style={styles.tripTypeTextCol}>
                  <Text
                    style={[
                      styles.tripTypeTabTitle,
                      { fontSize: responsiveSizes.tabTitleSize },
                      selectedTripType === 'ONEWAY' ? styles.tripTypeTabTitleActive : styles.tripTypeTabTitleInactive,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.65}
                  >
                    {t('home.oneWay')}
                  </Text>
                  <Text
                    style={[
                      styles.tripTypeTabSub,
                      { fontSize: responsiveSizes.tabSubSize },
                      selectedTripType === 'ONEWAY' ? styles.tripTypeTabSubActive : styles.tripTypeTabSubInactive,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.65}
                  >
                    {t('home.oneWaySub')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Round Trip Tab */}
              <TouchableOpacity
                style={[
                  styles.tripTypeTab,
                  { paddingVertical: responsiveSizes.tabPaddingVertical },
                  selectedTripType === 'ROUND' ? styles.tripTypeTabActive : styles.tripTypeTabInactive,
                ]}
                onPress={() => {
                  setSelectedTripType('ROUND');
                  if (pickupDate && pickupTime && !returnDate) {
                    setTimeout(() => {
                      setIsReturnDateModalOpen(true);
                    }, 300);
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={styles.tripTypeIconWrapper}>
                  <Ionicons
                    name="sync"
                    size={responsiveSizes.tabIconSize}
                    color={selectedTripType === 'ROUND' ? '#ffffff' : 'rgb(22, 34, 50)'}
                  />
                </View>
                <View style={styles.tripTypeTextCol}>
                  <Text
                    style={[
                      styles.tripTypeTabTitle,
                      { fontSize: responsiveSizes.tabTitleSize },
                      selectedTripType === 'ROUND' ? styles.tripTypeTabTitleActive : styles.tripTypeTabTitleInactive,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.65}
                  >
                    {t('home.roundTrip')}
                  </Text>
                  <Text
                    style={[
                      styles.tripTypeTabSub,
                      { fontSize: responsiveSizes.tabSubSize },
                      selectedTripType === 'ROUND' ? styles.tripTypeTabSubActive : styles.tripTypeTabSubInactive,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.65}
                  >
                    {t('home.roundTripSub')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Locations Box Container (Pickup, Drop & Floating Swap) */}
            <View style={[styles.locationsContainer, { marginTop: responsiveSizes.locationsMarginTop, gap: responsiveSizes.locationsGap }]}>
              {/* Pickup Location Box */}
              <TouchableOpacity
                style={[styles.locationInputBox, { paddingVertical: responsiveSizes.locationPaddingVertical }]}
                onPress={() => openLocationModal('PICKUP')}
                activeOpacity={0.75}
              >
                <Ionicons name="location-sharp" size={responsiveSizes.locationIconSize} color="#16a34a" style={styles.locationPinIcon} />
                <View style={styles.locationInfoCol}>
                  <Text style={[styles.locationFieldLabel, { fontSize: responsiveSizes.locationLabelSize }]}>{t('home.pickupLocation')}</Text>
                  <Text
                    style={[
                      styles.locationFieldValue,
                      { fontSize: responsiveSizes.locationValueSize },
                      !pickupLocation && styles.locationFieldPlaceholder,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.8}
                  >
                    {pickupLocation?.label || t('home.pickupPlaceholder')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Via Stops (if any, supporting up to 12 stops) */}
              {viaStops.length > 0 && (
                <ScrollView
                  style={[styles.viaStopsScroll, isSmallDevice && { maxHeight: 75 }]}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={viaStops.length > 2}
                >
                  {viaStops.map((stop, index) => (
                    <TouchableOpacity
                      key={`stop-${index}`}
                      style={[styles.viaStopBox, { paddingVertical: responsiveSizes.locationPaddingVertical }]}
                      onPress={() => openLocationModal('STOP', index)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.stopCircleBadge}>
                        <Text style={styles.stopCircleText}>{index + 1}</Text>
                      </View>
                      <View style={styles.locationInfoCol}>
                        <Text style={[styles.locationFieldLabel, { fontSize: responsiveSizes.locationLabelSize }]}>
                          {t('home.stopN', { defaultValue: `STOP ${index + 1}`, index: index + 1 })}
                        </Text>
                        <Text
                          style={[styles.locationFieldValue, { fontSize: responsiveSizes.locationValueSize }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit={true}
                          minimumFontScale={0.8}
                        >
                          {stop.label}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setViaStops((prev) => prev.filter((_, i) => i !== index));
                        }}
                        style={styles.removeStopBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Drop Location Box */}
              <TouchableOpacity
                style={[styles.locationInputBox, { paddingVertical: responsiveSizes.locationPaddingVertical }]}
                onPress={() => openLocationModal('DROP')}
                activeOpacity={0.75}
              >
                <Ionicons name="location-sharp" size={responsiveSizes.locationIconSize} color="#ef4444" style={styles.locationPinIcon} />
                <View style={styles.locationInfoCol}>
                  <Text style={[styles.locationFieldLabel, { fontSize: responsiveSizes.locationLabelSize }]}>{t('home.dropLocation')}</Text>
                  <Text
                    style={[
                      styles.locationFieldValue,
                      { fontSize: responsiveSizes.locationValueSize },
                      !dropLocation && styles.locationFieldPlaceholder,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.8}
                  >
                    {dropLocation?.label || t('home.dropPlaceholder')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Floating Swap Button */}
              {viaStops.length === 0 && (
                <TouchableOpacity
                  style={[
                    styles.swapButton,
                    {
                      width: responsiveSizes.swapButtonSize,
                      height: responsiveSizes.swapButtonSize,
                      borderRadius: responsiveSizes.swapButtonSize / 2,
                      marginTop: -(responsiveSizes.swapButtonSize / 2),
                    },
                  ]}
                  onPress={handleSwapLocations}
                  activeOpacity={0.8}
                >
                  <Ionicons name="swap-vertical" size={responsiveSizes.swapIconSize} color="rgb(22, 34, 50)" />
                </TouchableOpacity>
              )}
            </View>

            {/* Add a Stop Pill Button (up to 12 stops) */}
            {viaStops.length < 12 && (
              <TouchableOpacity
                style={[styles.addStopPill, { paddingVertical: responsiveSizes.addStopPaddingVertical }]}
                onPress={() => openLocationModal('STOP', viaStops.length)}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={responsiveSizes.addStopIconSize} color="rgb(22, 34, 50)" />
                <Text style={[styles.addStopPillText, { fontSize: responsiveSizes.addStopTextSize }]}>
                  {viaStops.length === 0 ? t('home.addAStop') : t('home.addStopN', { num: viaStops.length + 1 })}
                </Text>
              </TouchableOpacity>
            )}

            {/* Date & Time Row */}
            <View style={[
              styles.dateTimeRow,
              {
                marginTop: responsiveSizes.dateTimeMarginTop,
                paddingVertical: responsiveSizes.dateTimePaddingVertical,
                minHeight: responsiveSizes.dateTimeMinHeight,
              },
              selectedTripType === 'ROUND' && styles.dateTimeRow3Col,
            ]}>
              {/* Trip Start Date */}
              <TouchableOpacity
                style={[styles.dateTimeCol, selectedTripType === 'ROUND' && styles.dateTimeCol1_3Col]}
                onPress={() => setIsDateModalOpen(true)}
                activeOpacity={0.75}
              >
                {selectedTripType === 'ONEWAY' ? (
                  <>
                    <Ionicons
                      name="calendar-outline"
                      size={responsiveSizes.dateTimeIconSize}
                      color="rgb(22, 34, 50)"
                      style={styles.dateTimeIcon}
                    />
                    <View style={styles.dateTimeTextCol}>
                      <Text
                        style={[styles.dateTimeLabel, { fontSize: responsiveSizes.dateTimeLabelSize }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {t('home.tripStartDate')}
                      </Text>
                      <Text
                        style={[styles.dateTimeValue, { fontSize: responsiveSizes.dateTimeValueSize }, !pickupDate && styles.dateTimePlaceholder]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {pickupDate ? formatDateDisplay(pickupDate) : t('home.selectDate')}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="calendar-outline"
                      size={Math.max(13, responsiveSizes.dateTimeIconSize - 2)}
                      color="rgb(22, 34, 50)"
                      style={styles.dateTimeIcon3Col}
                    />
                    <View style={styles.dateTimeTextCol}>
                      <Text
                        style={[styles.dateTimeLabel3Col, { fontSize: Math.min(responsiveSizes.dateTimeLabelSize, 9.5) }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {t('home.startDate')}
                      </Text>
                      <Text
                        style={[
                          styles.dateTimeValue3Col,
                          { fontSize: Math.min(responsiveSizes.dateTimeValueSize, 12) },
                          !pickupDate && styles.dateTimePlaceholder,
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {pickupDate ? formatDateDisplay(pickupDate, true) : t('home.selectDate')}
                      </Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={[styles.dateTimeDivider, selectedTripType === 'ROUND' && styles.dateTimeDivider3Col]} />

              {/* Pickup Time */}
              <TouchableOpacity
                style={[styles.dateTimeCol, selectedTripType === 'ROUND' && styles.dateTimeCol2_3Col]}
                onPress={() => {
                  if (!pickupDate) {
                    setIsDateModalOpen(true);
                  } else {
                    setIsTimeModalOpen(true);
                  }
                }}
                activeOpacity={0.75}
              >
                {selectedTripType === 'ONEWAY' ? (
                  <>
                    <Ionicons
                      name="time-outline"
                      size={responsiveSizes.dateTimeIconSize}
                      color="rgb(22, 34, 50)"
                      style={styles.dateTimeIcon}
                    />
                    <View style={styles.dateTimeTextCol}>
                      <Text
                        style={[styles.dateTimeLabel, { fontSize: responsiveSizes.dateTimeLabelSize }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {t('home.pickupTime')}
                      </Text>
                      <Text
                        style={[styles.dateTimeValue, { fontSize: responsiveSizes.dateTimeValueSize }, !pickupTime && styles.dateTimePlaceholder]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {pickupTime ? formatTime12Display(pickupTime) : t('home.selectTime')}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="time-outline"
                      size={Math.max(13, responsiveSizes.dateTimeIconSize - 2)}
                      color="rgb(22, 34, 50)"
                      style={styles.dateTimeIcon3Col}
                    />
                    <View style={styles.dateTimeTextCol}>
                      <Text
                        style={[styles.dateTimeLabel3Col, { fontSize: Math.min(responsiveSizes.dateTimeLabelSize, 9.5) }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {t('home.pickupTime')}
                      </Text>
                      <Text
                        style={[
                          styles.dateTimeValue3Col,
                          { fontSize: Math.min(responsiveSizes.dateTimeValueSize, 12) },
                          !pickupTime && styles.dateTimePlaceholder,
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {pickupTime ? formatTime12Display(pickupTime) : t('home.selectTime')}
                      </Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>

              {/* Return Date (Round Trip Only) */}
              {selectedTripType === 'ROUND' && (
                <>
                  <View style={[styles.dateTimeDivider, styles.dateTimeDivider3Col]} />
                  <TouchableOpacity
                    style={[styles.dateTimeCol, styles.dateTimeCol3_3Col]}
                    onPress={() => {
                      if (!pickupDate) {
                        setIsDateModalOpen(true);
                      } else if (!pickupTime) {
                        setIsTimeModalOpen(true);
                      } else {
                        setIsReturnDateModalOpen(true);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={Math.max(13, responsiveSizes.dateTimeIconSize - 2)}
                      color="rgb(22, 34, 50)"
                      style={styles.dateTimeIcon3Col}
                    />
                    <View style={styles.dateTimeTextCol}>
                      <Text
                        style={[styles.dateTimeLabel3Col, { fontSize: Math.min(responsiveSizes.dateTimeLabelSize, 9.5) }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {t('home.returnDate')}
                      </Text>
                      <Text
                        style={[
                          styles.dateTimeValue3Col,
                          { fontSize: Math.min(responsiveSizes.dateTimeValueSize, 12) },
                          !returnDate && styles.dateTimePlaceholder,
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit={true}
                        minimumFontScale={0.8}
                      >
                        {returnDate ? formatDateDisplay(returnDate, true) : t('home.selectDate')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* CTA Button: BOOK YOUR RIDE ➔ */}
            <TouchableOpacity
              style={[
                styles.exploreCabsBtn,
                {
                  marginTop: responsiveSizes.bookBtnMarginTop,
                  paddingVertical: responsiveSizes.bookBtnPaddingVertical,
                },
              ]}
              onPress={handleExploreCabs}
              activeOpacity={0.85}
            >
              <Text style={[styles.exploreCabsBtnText, { fontSize: responsiveSizes.bookBtnTextSize }]}>{t('home.bookYourRide')}</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" style={styles.exploreCabsArrow} />
            </TouchableOpacity>
          </View>

          {/* 2. Specialized Travel Services in 1 Single Row */}
          <View style={[styles.servicesSection, { paddingHorizontal: responsiveSizes.cardMarginHorizontal, marginBottom: 10 }]}>
            <View style={styles.servicesSingleRow}>
              {SERVICE_CATEGORIES.map((cat) => {
                const localizedTitle =
                  cat.category === 'AIRPORT'
                    ? t('home.airportTransfer', { defaultValue: cat.title })
                    : cat.category === 'LOCAL'
                    ? t('home.localRental', { defaultValue: cat.title })
                    : cat.category === 'CORPORATE'
                    ? t('home.corporateTravel', { defaultValue: cat.title })
                    : cat.category === 'TOUR'
                    ? t('home.tourPilgrimage', { defaultValue: cat.title })
                    : cat.title;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.serviceRowCard,
                      { paddingVertical: responsiveSizes.serviceCardPaddingVertical },
                    ]}
                    onPress={() => handleSelectCategory(cat)}
                    activeOpacity={0.75}
                  >
                    <View style={[
                      styles.serviceRowIconCircle,
                      {
                        width: responsiveSizes.serviceIconCircleSize,
                        height: responsiveSizes.serviceIconCircleSize,
                      },
                    ]}>
                      {cat.iconFamily === 'MaterialCommunityIcons' ? (
                        <MaterialCommunityIcons name={cat.iconName as any} size={responsiveSizes.serviceIconSize} color="rgb(240, 117, 15)" />
                      ) : (
                        <Ionicons name={cat.iconName as any} size={responsiveSizes.serviceIconSize} color="rgb(240, 117, 15)" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.serviceRowCardTitle,
                        {
                          fontSize: responsiveSizes.serviceTitleSize,
                          minHeight: responsiveSizes.serviceTitleMinHeight,
                        },
                      ]}
                      numberOfLines={2}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.8}
                    >
                      {localizedTitle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 3. Promotional Banner Carousel Slider */}
          <View
            style={[styles.promoSliderSection, { marginBottom: 10 }]}
            onTouchStart={pauseAutoSlide}
            onTouchEnd={() => scheduleResumeAutoSlide(4000)}
            onTouchCancel={() => scheduleResumeAutoSlide(4000)}
          >
            <FlatList
              ref={carouselRef}
              data={carouselList}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled={true}
              nestedScrollEnabled={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.promoSliderContent}
              snapToInterval={windowWidth}
              decelerationRate="fast"
              snapToAlignment="center"
              getItemLayout={(_, index) => ({
                length: windowWidth,
                offset: windowWidth * index,
                index,
              })}
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
                  <View style={[styles.promoSlidePage, { width: windowWidth }]}>
                    <TouchableOpacity
                      style={[
                        styles.promoCardContainer,
                        { width: bannerCardWidth, height: dynamicBannerHeight },
                      ]}
                      activeOpacity={0.9}
                      onPress={handleBannerPress}
                    >
                      <Image
                        source={resolveBannerImage(item.image, item.id)}
                        style={styles.promoCardBackground}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </View>

          {/* 4. Quick Help & Support Bar */}
          <TouchableOpacity
            style={[
              styles.helpSupportCard,
              {
                marginHorizontal: responsiveSizes.cardMarginHorizontal,
                paddingVertical: responsiveSizes.helpPaddingVertical,
                marginBottom: 4,
              },
            ]}
            onPress={() => {
              safeNavigate(() => {
                router.push('/support');
              });
            }}
            activeOpacity={0.85}
          >
            <View style={styles.helpSupportLeftCol}>
              <View style={[styles.helpSupportIconCircle, { width: responsiveSizes.helpIconCircleSize, height: responsiveSizes.helpIconCircleSize, borderRadius: responsiveSizes.helpIconCircleSize / 2 }]}>
                <Ionicons name="call" size={responsiveSizes.helpIconSize} color="#16a34a" />
              </View>
              <View style={styles.helpSupportTextCol}>
                <Text style={[styles.helpSupportTitle, { fontSize: responsiveSizes.helpTitleSize }]}>24/7 Help & Support</Text>
                <Text style={[styles.helpSupportSubtitle, { fontSize: responsiveSizes.helpSubtitleSize }]}>Need assistance with your ride?</Text>
              </View>
            </View>

            <View style={styles.helpSupportPill}>
              <Text style={styles.helpSupportPillText}>Get Help</Text>
              <Ionicons name="chevron-forward" size={12} color="#ffffff" />
            </View>
          </TouchableOpacity>
      </ScrollView>

      {/* Persistent Bottom Navigation Dock (In-flow flex layout to guarantee 0% overlap with Help & Support) */}
      <CustomerBottomDock
        activeTab="HOME"
        isAbsolute={false}
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

      {/* Unified Route Location Picker Modal */}
      <LocationPickerModal
        visible={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        title="Select Location"
        initialTarget={routeModalTarget}
        initialStopIndex={routeModalStopIndex}
        pickupValue={pickupLocation?.label}
        dropValue={dropLocation?.label}
        pickupLocation={pickupLocation}
        dropLocation={dropLocation}
        viaStops={viaStops}
        onSelectPickup={(loc) => setPickupLocation(loc)}
        onSelectDrop={(loc) => setDropLocation(loc)}
        onConfirmRoute={({ pickup, drop, stops }) => {
          if (pickup && drop && isSameLocation(pickup, drop)) {
            Alert.alert(
              t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
              t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
            );
            return;
          }
          if (pickup) setPickupLocation(pickup);
          if (drop) setDropLocation(drop);
          setViaStops(stops);
          setIsRouteModalOpen(false);

          if (pickup && drop && isLocalDistanceRoute(pickup, drop, stops)) {
            setDropLocation(null);
            setViaStops([]);
            setTimeout(() => {
              Alert.alert(
                'Local Rental Switched',
                "Since your pickup and drop location is same city we've switched to local rental",
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      safeNavigate(() => {
                        router.push({
                          pathname: '/trip-details',
                          params: {
                            tripType: 'LOCAL',
                            category: 'LOCAL',
                            pickup: pickup.label,
                            pickupJson: JSON.stringify(pickup),
                            pickupDate: pickupDate || '',
                            pickupTime: pickupTime || '',
                          },
                        });
                      });
                    },
                  },
                ]
              );
            }, 300);
            return;
          }

          // Auto open date/time if not selected after route is picked
          if (pickup && drop) {
            if (!pickupDate) {
              setTimeout(() => {
                setIsDateModalOpen(true);
              }, 350);
            } else if (!pickupTime) {
              setTimeout(() => {
                setIsTimeModalOpen(true);
              }, 350);
            } else if (selectedTripType === 'ROUND' && !returnDate) {
              setTimeout(() => {
                setIsReturnDateModalOpen(true);
              }, 350);
            }
          }
        }}
      />

      <DatePickerModal
        visible={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onSelect={(dateKey, displayFormatted) => {
          setPickupDate(displayFormatted);
          setPickupDateDisplay(displayFormatted);
          setIsDateModalOpen(false);

          if (!pickupTime) {
            setTimeout(() => {
              setIsTimeModalOpen(true);
            }, 300);
          } else if (selectedTripType === 'ROUND' && !returnDate) {
            setTimeout(() => {
              setIsReturnDateModalOpen(true);
            }, 300);
          }
        }}
        currentDate={pickupDate}
      />

      <DatePickerModal
        visible={isReturnDateModalOpen}
        onClose={() => setIsReturnDateModalOpen(false)}
        onSelect={(dateKey, displayFormatted) => {
          setReturnDate(displayFormatted);
          setReturnDateDisplay(displayFormatted);
          setIsReturnDateModalOpen(false);
        }}
        currentDate={returnDate}
        minDate={pickupDate || undefined}
        title={t('modals.datePicker.selectReturnDate', { defaultValue: 'Select Return Date' })}
      />

      <TimePickerModal
        visible={isTimeModalOpen}
        onClose={() => setIsTimeModalOpen(false)}
        onSelect={(timeStr) => {
          setPickupTime(timeStr);
          setIsTimeModalOpen(false);
          if (selectedTripType === 'ROUND' && !returnDate) {
            setTimeout(() => {
              setIsReturnDateModalOpen(true);
            }, 300);
          }
        }}
        currentTime={pickupTime}
        selectedDate={pickupDate}
        title={t('modals.timePicker.title', { defaultValue: 'Select Pickup Time' })}
      />

      {/* New User Initial Language Selection Modal (Shown Once) */}
      <LanguageSelectionModal
        visible={isLangPromptModalOpen}
        onClose={() => {
          const activeUser = customerTokenStorage.getUser() || currentUser;
          markNewUserLangPromptDone(activeUser?.id);
          clearNewUserFlag(activeUser?.id);
          setIsLangPromptModalOpen(false);
        }}
        onLanguageSelected={() => {
          const activeUser = customerTokenStorage.getUser() || currentUser;
          markNewUserLangPromptDone(activeUser?.id);
          clearNewUserFlag(activeUser?.id);
          setIsLangPromptModalOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerWrapper: {
    backgroundColor: 'rgb(22, 34, 50)', // Deep Navy Container
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'rgb(22, 34, 50)', // Deep Navy
    borderBottomWidth: 1,
    borderBottomColor: '#101925',
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
    alignItems: 'flex-start',
    justifyContent: 'center',
    maxWidth: '56%',
  },
  greetingOnlyText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  greetingSubtext: {
    fontSize: 12.5,
    color: '#ffffff', // Crisp White
    fontWeight: '700',
    textAlign: 'left',
    marginBottom: 1,
  },
  greetingName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff', // Crisp White
    textAlign: 'left',
    letterSpacing: -0.3,
  },
  notificationButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 2,
  },
  notificationDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgb(240, 117, 15)',
    borderWidth: 1.5,
    borderColor: 'rgb(22, 34, 50)',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
    paddingBottom: 0,
  },
  promoSliderSection: {
    marginTop: 0,
    marginBottom: 0,
    width: '100%',
  },
  promoSliderContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  promoSlidePage: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoCardContainer: {
    width: BANNER_CARD_WIDTH,
    height: BANNER_CARD_HEIGHT,
    borderRadius: 14,
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
    borderRadius: 14,
  },
  promoCardOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    paddingTop: 12,
    paddingLeft: 14,
    paddingRight: 14,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  posterCtaContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  promoCardTextGroup: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 2,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  promoCardTopBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgb(240, 117, 15)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    marginBottom: 3,
  },
  promoCardBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  promoCardTagline: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.1,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  promoCardSubTagline: {
    fontSize: 11.5,
    color: '#f8fafc',
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  promoCardCtaRow: {
    alignSelf: 'flex-end',
  },
  promoCardCtaBtn: {
    backgroundColor: 'rgb(240, 117, 15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
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
    fontSize: 12,
    fontWeight: '800',
  },
  helpSupportCard: {
    marginHorizontal: 12,
    marginTop: 0,
    marginBottom: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  helpSupportLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  helpSupportIconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  helpSupportTextCol: {
    flex: 1,
  },
  helpSupportTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.1,
  },
  helpSupportSubtitle: {
    fontSize: 11.2,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
  },
  helpSupportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgb(22, 34, 50)',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
    gap: 3.5,
  },
  helpSupportPillText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
  },
  homeBodyCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
    marginTop: 0,
    paddingTop: 0,
    paddingBottom: 0,
    zIndex: 10,
  },
  bottomSectionsGroup: {
    width: '100%',
  },
  quickSearchCard: {
    marginHorizontal: 12,
    marginTop: 0,
    marginBottom: 0,
    backgroundColor: '#ffffff',
    borderRadius: 16,
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
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  tripTypeTabActive: {
    backgroundColor: 'rgb(240, 117, 15)',
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
    fontSize: isSmallScreen ? 14.5 : 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  tripTypeTabTitleActive: {
    color: '#ffffff',
  },
  tripTypeTabTitleInactive: {
    color: 'rgb(22, 34, 50)',
  },
  tripTypeTabSub: {
    fontSize: isSmallScreen ? 11 : 12,
    fontWeight: '600',
    marginTop: 1,
  },
  tripTypeTabSubActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  tripTypeTabSubInactive: {
    color: 'rgb(22, 34, 50)',
    opacity: 0.8,
  },
  locationsContainer: {
    position: 'relative',
    marginTop: 6,
    gap: 4.5,
  },
  locationInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 11,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  viaStopsScroll: {
    maxHeight: 185,
  },
  viaStopBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 11,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginBottom: 5,
  },
  stopCircleBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginLeft: 2,
  },
  stopCircleText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  removeStopBtn: {
    padding: 3,
    marginLeft: 5,
  },
  locationPinIcon: {
    marginRight: 8,
  },
  locationInfoCol: {
    flex: 1,
    paddingRight: 34,
  },
  locationFieldLabel: {
    fontSize: 11.2,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  locationFieldValue: {
    fontSize: 14.8,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  locationFieldPlaceholder: {
    color: 'rgb(22, 34, 50)',
    opacity: 0.75,
    fontWeight: '600',
  },
  swapButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    gap: 3,
  },
  addStopPillText: {
    color: 'rgb(22, 34, 50)',
    fontSize: 12,
    fontWeight: '800',
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 11,
    marginTop: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    minHeight: 38,
  },
  dateTimeCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeIcon: {
    marginRight: 7,
  },
  dateTimeTextCol: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 11.2,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  dateTimeValue: {
    fontSize: 14.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  dateTimePlaceholder: {
    color: 'rgb(22, 34, 50)',
    opacity: 0.75,
    fontWeight: '600',
  },
  dateTimeDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 6,
  },
  dateTimeRow3Col: {
    minHeight: 46,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 5,
    borderRadius: 11,
  },
  dateTimeCol1_3Col: {
    flex: 1,
    paddingHorizontal: 2,
  },
  dateTimeCol2_3Col: {
    flex: 1,
    paddingHorizontal: 2,
  },
  dateTimeCol3_3Col: {
    flex: 1,
    paddingHorizontal: 2,
    paddingLeft: 2,
  },
  dateTimeCol3ColInner: {
    width: '100%',
    justifyContent: 'center',
  },
  dateTimeHeaderRow3Col: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  dateTimeIcon3Col: {
    marginRight: 4,
  },
  dateTimeLabel3Col: {
    fontSize: isSmallScreen ? 9.5 : 10,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.2,
    marginBottom: 1,
  },
  dateTimeValue3Col: {
    fontSize: isSmallScreen ? 12.5 : 13.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.2,
  },
  dateTimeDivider3Col: {
    marginHorizontal: 2,
    height: 26,
    backgroundColor: '#e2e8f0',
  },
  exploreCabsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 11,
    marginTop: 6,
    paddingVertical: 8,
    ...Platform.select({
      ios: {
        shadowColor: 'rgb(240, 117, 15)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: 'rgb(240, 117, 15)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
    }),
  },
  exploreCabsBtnText: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  exploreCabsArrow: {
    marginLeft: 8,
  },
  servicesSection: {
    paddingHorizontal: 12,
    marginTop: 0,
    marginBottom: 0,
  },
  servicesSingleRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  serviceRowCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 13,
    paddingVertical: 6,
    paddingHorizontal: 3,
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
    width: isSmallScreen ? 34 : 38,
    height: isSmallScreen ? 34 : 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2.5,
  },
  serviceRowCardTitle: {
    fontSize: isSmallScreen ? 10.5 : 11.2,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    textAlign: 'center',
    lineHeight: 14.5,
    minHeight: isSmallScreen ? 23 : 26,
  },
  servicePopularBadge: {
    position: 'absolute',
    top: -5,
    right: 4,
    backgroundColor: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
    marginTop: 1,
  },

  // Search Cabs Primary Button
  searchCabsBtn: {
    flexDirection: 'row',
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 12,
    paddingVertical: isSmallScreen ? 11 : 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: 'rgb(240, 117, 15)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.32,
        shadowRadius: 7,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
  },
  popularRouteBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    borderColor: 'rgb(240, 117, 15)',
    backgroundColor: '#fffdfa',
  },
  modernFleetBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(240, 117, 15)',
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
    color: 'rgb(240, 117, 15)',
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
    color: 'rgb(22, 34, 50)',
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
    color: 'rgb(22, 34, 50)',
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
