'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  TripType,
  VehicleCategory,
  QuoteResponse,
  UserRole,
} from '@kandy-cabs/shared';
import { useAuth } from '@/lib/AuthContext';
import { ALL_LOCATIONS, PlaceLocation } from '@/lib/locations';

import { DriverAppModal } from '@/components/DriverAppModal';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { trackWebEvent, WebAnalyticsEventType } from '@/lib/analytics';

const POPULAR_LOCATIONS = ALL_LOCATIONS.map((l) => ({ name: l.label, lat: l.lat, lng: l.lng }));

const HERO_FLEET_SLIDES = [
  {
    id: 'hatchback',
    name: 'Economy Hatchback',
    models: 'Baleno • WagonR • Tiago',
    image: '/images/fleet-hatchback.webp',
    rate: '₹11 / km',
    capacity: '4 Passengers',
  },
  {
    id: 'sedan',
    name: 'Prime Sedan',
    models: 'Dzire • Etios • Honda Amaze',
    image: '/images/fleet-sedan.webp',
    rate: '₹13 / km',
    capacity: '4 Passengers',
  },
  {
    id: 'suv',
    name: 'Prime SUV (6+1)',
    models: 'Ertiga • Carens • Triber',
    image: '/images/fleet-suv.webp',
    rate: '₹18 / km',
    capacity: '6 Passengers',
  },
  {
    id: 'crysta',
    name: 'Innova Crysta Luxury',
    models: 'Innova Crysta • Hycross',
    image: '/images/fleet-crysta.webp',
    rate: '₹22 / km',
    capacity: '7 Passengers',
  },
  {
    id: 'traveller',
    name: 'Tempo Traveller (12+1)',
    models: 'Force Traveller 3350 AC',
    image: '/images/fleet-traveller.webp',
    rate: '₹26 / km',
    capacity: '12-17 Passengers',
    sizeClass: 'w-[88%] sm:w-[84%] max-w-[510px]',
  },
];

const SLIDE_TO_CATEGORY: Record<string, VehicleCategory> = {
  hatchback: VehicleCategory.HATCHBACK,
  sedan: VehicleCategory.SEDAN,
  suv: VehicleCategory.SUV,
  crysta: VehicleCategory.SUV_PREMIUM,
  traveller: VehicleCategory.TEMPO_TRAVELER,
};

const FLEET_DATA = [
  {
    category: VehicleCategory.HATCHBACK,
    name: 'Hatchback',
    models: 'WagonR • Tiago • Celerio',
    image: '/images/fleet-hatchback.webp',
    ratePerKm: '₹11',
    ratePerKmUnit: '/ km',
    capacity: '4 Passengers',
    luggage: '2 Luggage Bags',
    idealFor: 'Budget city & short outstation trips',
    badge: 'ECONOMY',
    badgeBg: 'bg-emerald-100/80 text-emerald-800 border border-emerald-300/80',
    cardBg: 'bg-[#F0FBF7]',
    cardBorder: 'border-emerald-200/80 hover:border-emerald-400',
    rateBadge: 'bg-emerald-100/70 text-emerald-800',
    iconBg: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    idealForBg: 'bg-emerald-50/60 text-emerald-800 border border-emerald-100',
    checkColor: 'text-emerald-600',
    badgeIcon: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
      </svg>
    ),
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="9" rx="3" />
        <path d="M5 11l2-6h10l2 6" />
        <circle cx="7" cy="15.5" r="1.5" />
        <circle cx="17" cy="15.5" r="1.5" />
        <path d="M10 15.5h4" />
      </svg>
    ),
  },
  {
    category: VehicleCategory.SEDAN,
    name: 'Prime Sedan',
    models: 'Dzire • Etios • Honda Amaze',
    image: '/images/fleet-sedan.webp',
    ratePerKm: '₹13',
    ratePerKmUnit: '/ km',
    capacity: '4 Passengers',
    luggage: '3 Luggage Bags',
    idealFor: 'Comfortable family & business highway rides',
    badge: 'MOST POPULAR',
    badgeBg: 'bg-blue-100/80 text-blue-800 border border-blue-300/80',
    cardBg: 'bg-[#F3F7FF]',
    cardBorder: 'border-blue-200/80 hover:border-blue-400',
    rateBadge: 'bg-blue-100/70 text-blue-800',
    iconBg: 'bg-blue-100 text-blue-700 border border-blue-200',
    idealForBg: 'bg-blue-50/60 text-blue-800 border border-blue-100',
    checkColor: 'text-blue-600',
    badgeIcon: (
      <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
        <path d="M5 16l-2-9 5.5 3.5L12 4l3.5 6.5L21 7l-2 9H5z" />
      </svg>
    ),
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="9" rx="3" />
        <path d="M5 11l2-6h10l2 6" />
        <circle cx="7" cy="15.5" r="1.5" />
        <circle cx="17" cy="15.5" r="1.5" />
        <path d="M10 15.5h4" />
      </svg>
    ),
  },
  {
    category: VehicleCategory.SUV,
    name: 'Prime SUV (6+1)',
    models: 'Ertiga • Carens • Triber',
    image: '/images/fleet-suv.webp',
    ratePerKm: '₹18',
    ratePerKmUnit: '/ km',
    capacity: '6 Passengers',
    luggage: '4 Luggage Bags',
    idealFor: 'Family vacations, hill stations & extra luggage',
    badge: 'EXTRA SPACE',
    badgeBg: 'bg-purple-100/80 text-purple-800 border border-purple-300/80',
    cardBg: 'bg-[#FAF5FF]',
    cardBorder: 'border-purple-200/80 hover:border-purple-400',
    rateBadge: 'bg-purple-100/70 text-purple-800',
    iconBg: 'bg-purple-100 text-purple-700 border border-purple-200',
    idealForBg: 'bg-purple-50/60 text-purple-800 border border-purple-100',
    checkColor: 'text-purple-600',
    badgeIcon: (
      <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>
    ),
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.1 2 11.5 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    ),
  },
  {
    category: VehicleCategory.SUV_PREMIUM,
    name: 'Innova Crysta',
    models: '7 Seater • Spacious • Comfortable',
    image: '/images/fleet-crysta.webp',
    ratePerKm: '₹23',
    ratePerKmUnit: '/ km',
    capacity: '7 Passengers',
    luggage: '4 Luggage Bags',
    idealFor: 'VIP travel, long distance hill tours & unmatched comfort',
    badge: 'PREMIUM',
    badgeBg: 'bg-amber-100/80 text-amber-800 border border-amber-300/80',
    cardBg: 'bg-[#FFFAF2]',
    cardBorder: 'border-amber-200/80 hover:border-amber-400',
    rateBadge: 'bg-amber-100/70 text-amber-800',
    iconBg: 'bg-amber-100 text-amber-700 border border-amber-200',
    idealForBg: 'bg-amber-50/60 text-amber-800 border border-amber-100',
    checkColor: 'text-amber-600',
    badgeIcon: (
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l4 7-10 11L2 10l4-7z" />
      </svg>
    ),
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
  {
    category: VehicleCategory.TEMPO_TRAVELER,
    name: 'Tempo Traveller',
    models: '12 / 17 Seater • Group Travel',
    image: '/images/fleet-traveller.webp',
    ratePerKm: '₹28',
    ratePerKmUnit: '/ km',
    capacity: '12-17 Passengers',
    luggage: 'Bags as per seats',
    idealFor: 'Corporate outings, wedding parties & large groups',
    badge: 'GROUP TRAVEL',
    badgeBg: 'bg-slate-200/80 text-slate-800 border border-slate-300',
    cardBg: 'bg-[#F6F8FC]',
    cardBorder: 'border-slate-200/90 hover:border-slate-400',
    rateBadge: 'bg-slate-200/70 text-slate-800',
    iconBg: 'bg-slate-200 text-slate-700 border border-slate-300',
    idealForBg: 'bg-slate-100/60 text-slate-800 border border-slate-200',
    checkColor: 'text-slate-700',
    badgeIcon: (
      <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>
    ),
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, sendOtp, verifyOtp, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Customer Sign In / Sign Up Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [driverAppModalOpen, setDriverAppModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentFleetSlide, setCurrentFleetSlide] = useState(0);
  const [prevFleetSlide, setPrevFleetSlide] = useState<number | null>(null);
  const [expandedFleetCategory, setExpandedFleetCategory] = useState<VehicleCategory | null>(null);

  const goToSlide = (nextIndex: number) => {
    setPrevFleetSlide(currentFleetSlide);
    setCurrentFleetSlide(nextIndex);
  };

  useEffect(() => {
    if (HERO_FLEET_SLIDES.length <= 1) return;
    const interval = setInterval(() => {
      setPrevFleetSlide(currentFleetSlide);
      setCurrentFleetSlide((prev) => (prev + 1) % HERO_FLEET_SLIDES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [currentFleetSlide]);

  const [showMobileDock, setShowMobileDock] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = Math.max(
        window.scrollY || 0,
        window.pageYOffset || 0,
        document.documentElement?.scrollTop || 0,
        document.body?.scrollTop || 0
      );
      // Show bottom dock when user scrolls (scrollY > 20px)
      setShowMobileDock(scrollY > 20);
      // Toggle header background to solid white on any scroll movement (scrollY > 5px)
      setIsScrolled(scrollY > 5);
    };

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true } as any);
      document.removeEventListener('scroll', handleScroll, { capture: true } as any);
    };
  }, []);

  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authPhone, setAuthPhone] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authAgreeTerms, setAuthAgreeTerms] = useState(true);
  const [authOtp, setAuthOtp] = useState('');
  const [authStep, setAuthStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authDebugOtp, setAuthDebugOtp] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [existingName, setExistingName] = useState<string | null>(null);
  const [existingRoles, setExistingRoles] = useState<string[]>([]);

  const handleAuthSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authPhone.length !== 10) {
      setAuthError('Please enter a valid 10-digit mobile number');
      return;
    }
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await sendOtp(authPhone);
      if (res.success) {
        setAuthStep('OTP');
        setIsRegistered(!!res.isRegistered);
        setExistingName(res.existingName || null);
        setExistingRoles(res.roles || []);
        if (res.existingName) {
          setAuthFullName(res.existingName);
        } else {
          setAuthFullName('');
        }
        if (res.debugOtp) {
          setAuthDebugOtp(res.debugOtp);
          setAuthOtp(res.debugOtp);
        }
      } else {
        setAuthError(res.message);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to send verification code');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authOtp.length !== 4) {
      setAuthError('Please enter the 4-digit OTP');
      return;
    }
    if (!isRegistered && !authFullName.trim()) {
      setAuthError('Please enter your full name to complete registration');
      return;
    }
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await verifyOtp(authPhone, authOtp, authFullName);
      if (res.success) {
        setAuthModalOpen(false);
        setAuthStep('PHONE');
        setAuthOtp('');
        setAuthPhone('');
        setAuthFullName('');
      } else {
        setAuthError(res.message || 'Invalid verification code');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Verification failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Booking Widget State
  const [tripType, setTripType] = useState<TripType>(TripType.ONEWAY);
  const [airportTransferType, setAirportTransferType] = useState<'PICKUP' | 'DROP'>('PICKUP');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState(0);
  const [pickupLng, setPickupLng] = useState(0);

  const [dropAddress, setDropAddress] = useState('');
  const [dropLat, setDropLat] = useState(0);
  const [dropLng, setDropLng] = useState(0);

  const handleAirportTransferSelect = (type: 'PICKUP' | 'DROP') => {
    setAirportTransferType(type);
    setQuoteData(null);
    const airportLoc = ALL_LOCATIONS.find((l) => l.category === 'AIRPORTS') || {
      label: 'Mangaluru Airport (IXE)',
      lat: 12.9613,
      lng: 74.8901,
    };
    const cityLoc = ALL_LOCATIONS.find((l) => l.category === 'MANGALURU') || {
      label: 'Mangaluru Central Railway Station',
      lat: 12.8634,
      lng: 74.8436,
    };

    if (type === 'PICKUP') {
      setPickupAddress(airportLoc.label);
      setPickupLat(airportLoc.lat);
      setPickupLng(airportLoc.lng);
      setDropAddress(cityLoc.label);
      setDropLat(cityLoc.lat);
      setDropLng(cityLoc.lng);
    } else {
      setPickupAddress(cityLoc.label);
      setPickupLat(cityLoc.lat);
      setPickupLng(cityLoc.lng);
      setDropAddress(airportLoc.label);
      setDropLat(airportLoc.lat);
      setDropLng(airportLoc.lng);
    }
  };

  // Interactive OpenStreetMap Location Picker Modal State
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTarget, setLocationModalTarget] = useState<'PICKUP' | 'DROP' | string>('PICKUP');

  const handleSelectLocation = (place: PlaceLocation) => {
    if (locationModalTarget === 'PICKUP') {
      setPickupAddress(place.label);
      setPickupLat(place.lat);
      setPickupLng(place.lng);
    } else if (locationModalTarget === 'DROP') {
      setDropAddress(place.label);
      setDropLat(place.lat);
      setDropLng(place.lng);
    } else {
      setStops((prev) =>
        prev.map((s) => (s.id === locationModalTarget ? { ...s, address: place.label, lat: place.lat, lng: place.lng } : s))
      );
    }
    setQuoteData(null);
  };

  // Round Trip Multiple Stops State (ONLY for Round Trip)
  interface TripStop {
    id: string;
    address: string;
    lat: number;
    lng: number;
  }
  const [stops, setStops] = useState<TripStop[]>([]);

  const handleAddStop = () => {
    const available = POPULAR_LOCATIONS.find(
      (l) => l.name !== pickupAddress && l.name !== dropAddress && !stops.some((s) => s.address === l.name)
    ) || POPULAR_LOCATIONS[6];
    setStops((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        address: available.name,
        lat: available.lat,
        lng: available.lng,
      },
    ]);
    setQuoteData(null);
  };

  const handleRemoveStop = (id: string) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
    setQuoteData(null);
  };

  const handleUpdateStop = (id: string, name: string) => {
    const loc = POPULAR_LOCATIONS.find((l) => l.name === name);
    if (loc) {
      setStops((prev) =>
        prev.map((s) => (s.id === id ? { ...s, address: loc.name, lat: loc.lat, lng: loc.lng } : s))
      );
      setQuoteData(null);
    }
  };

  const [scheduledDate, setScheduledDate] = useState('2026-09-26');
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setScheduledDate(d.toISOString().split('T')[0]);
    trackWebEvent('VISIT');
  }, []);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [durationDays, setDurationDays] = useState(1);
  const [packageHours, setPackageHours] = useState(8);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>(VehicleCategory.SEDAN);

  // Live estimate calculation
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteData, setQuoteData] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState('');

  // In-browser client quote cache & abort controller
  const clientQuoteCache = useRef<Map<string, QuoteResponse>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchQuickQuote = async () => {
    const scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
    const stopsKey = tripType === TripType.ROUND ? stops.map((s) => `${s.lat?.toFixed(4)},${s.lng?.toFixed(4)}`).join('|') : '';
    const cacheKey = `${pickupLat?.toFixed(4)}_${pickupLng?.toFixed(4)}_${dropLat?.toFixed(4)}_${dropLng?.toFixed(4)}_${tripType}_${scheduledAt}_${durationDays}_${packageHours}_${stopsKey}`;

    // 0ms instant browser cache hit
    const cached = clientQuoteCache.current.get(cacheKey);
    if (cached) {
      setQuoteData(cached);
      setQuoteError('');
      setIsQuoting(false);
      trackWebEvent('VIEW_RATES', {
        tripType,
        pickup: pickupAddress,
        drop: dropAddress,
        category: selectedCategory,
      });
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsQuoting(true);
    setQuoteError('');
    try {
      const res = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          pickupAddress,
          pickupLat,
          pickupLng,
          dropAddress,
          dropLat,
          dropLng,
          stops: tripType === TripType.ROUND ? stops.map((s) => ({ address: s.address, lat: s.lat, lng: s.lng })) : [],
          tripType,
          scheduledAt,
          durationDays,
          packageHours,
        }),
      });

      if (res.ok) {
        const data: QuoteResponse = await res.json();
        clientQuoteCache.current.set(cacheKey, data);
        setQuoteData(data);
        trackWebEvent('VIEW_RATES', {
          tripType,
          pickup: pickupAddress,
          drop: dropAddress,
          category: selectedCategory,
        });
      } else {
        const err = await res.json();
        setQuoteError(err.error || 'Failed to calculate quote');
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setQuoteError(e.message || 'Error connecting to pricing engine');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsQuoting(false);
      }
    }
  };

  const handleSwapLocations = () => {
    const tempAddr = pickupAddress;
    const tempLt = pickupLat;
    const tempLg = pickupLng;
    setPickupAddress(dropAddress);
    setPickupLat(dropLat);
    setPickupLng(dropLng);
    setDropAddress(tempAddr);
    setDropLat(tempLt);
    setDropLng(tempLg);
    setQuoteData(null);
  };

  const handleStartBooking = (category?: VehicleCategory) => {
    const cat = category || selectedCategory;
    if (category) {
      setSelectedCategory(category);
    }

    trackWebEvent('STARTED_BOOKING', {
      category: cat,
      tripType,
      pickup: pickupAddress,
      drop: dropAddress,
    });

    if (!pickupAddress || !dropAddress) {
      scrollToBookingEngine(cat);
      return;
    }
    const params = new URLSearchParams({
      step: '2',
      tripType,
      pickup: pickupAddress,
      pickupLat: pickupLat.toString(),
      pickupLng: pickupLng.toString(),
      drop: dropAddress,
      dropLat: dropLat.toString(),
      dropLng: dropLng.toString(),
      date: scheduledDate,
      time: scheduledTime,
      category: cat,
      durationDays: durationDays.toString(),
      packageHours: packageHours.toString(),
    });
    if (tripType === TripType.ROUND && stops.length > 0) {
      params.set('stops', JSON.stringify(stops));
    }
    router.push(`/booking?${params.toString()}`);
  };

  const scrollToBookingEngine = (category?: VehicleCategory) => {
    if (category) {
      setSelectedCategory(category);
    }
    const el = document.getElementById('booking-engine');
    if (el) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
      const rect = el.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const targetY = scrollTop + rect.top - (isMobile ? 82 : 90);
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Main Navigation Bar - Completely transparent at top, solid white on scroll */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-md text-slate-800'
            : 'bg-transparent border-b border-transparent shadow-none'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center group py-1.5">
            <Image
              src={isScrolled ? '/images/logo.webp' : '/images/logo-white.webp'}
              alt="Kandy Cabs - Safe | Reliable | Hassle Free"
              width={180}
              height={56}
              priority
              className="h-9 sm:h-11 lg:h-14 w-auto object-contain transition-transform group-hover:scale-[1.02]"
            />
          </Link>

          <nav
            className={`hidden lg:flex items-center space-x-8 font-semibold text-sm transition-colors duration-300 ${
              isScrolled ? 'text-slate-700' : 'text-white drop-shadow-sm'
            }`}
          >
            <a
              href="#booking-engine"
              onClick={(e) => {
                e.preventDefault();
                scrollToBookingEngine();
              }}
              className="hover:text-orange-500 transition cursor-pointer"
            >
              Book Cab
            </a>
            <a href="#fleet" className="hover:text-orange-500 transition">Fleet & Rates</a>
            <a href="#why-kandy" className="hover:text-orange-500 transition">Why Choose Us</a>
            <a href="#how-it-works" className="hover:text-orange-500 transition">How It Works</a>
          </nav>

          <div className="flex items-center gap-3">
            {mounted && isAuthenticated ? (
              <div className="flex items-center gap-2">
                {user?.roles?.includes(UserRole.ADMIN) && (
                  <a
                    href={process.env.NEXT_PUBLIC_ADMIN_URL || '/admin'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden lg:inline-flex items-center px-3 py-1.5 sm:py-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-lg sm:rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    Admin Dashboard
                  </a>
                )}
                {user?.roles?.includes(UserRole.DRIVER) && (
                  <button
                    type="button"
                    onClick={() => setDriverAppModalOpen(true)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50/90 border border-orange-200 text-orange-900 rounded-xl text-xs font-bold hover:bg-orange-100 transition shadow-xs"
                  >
                    <span>Driver Partner</span>
                    <span className="text-[10px] bg-orange-600 text-white px-1.5 py-0.5 rounded font-black">App</span>
                  </button>
                )}
                <Link
                  href="/customer/dashboard"
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border transition font-bold text-[11px] sm:text-xs flex items-center gap-1.5 shadow-xs ${
                    isScrolled
                      ? 'border-slate-300 text-slate-800 bg-slate-50 hover:bg-slate-100'
                      : 'border-white/30 text-white bg-black/40 hover:bg-black/60 backdrop-blur-md'
                  }`}
                >
                  <div className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center font-black">
                    {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                  </div>
                  <span className="hidden xs:inline">My Bookings</span>
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className={`hidden lg:inline-flex px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-lg sm:rounded-xl transition ${
                    isScrolled
                      ? 'text-slate-500 hover:text-red-600 hover:bg-slate-100'
                      : 'text-slate-300 hover:text-red-400 hover:bg-white/10'
                  }`}
                  title="Sign Out"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthError('');
                  setAuthStep('PHONE');
                  setAuthModalOpen(true);
                }}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border transition font-bold text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 shadow-xs ${
                  isScrolled
                    ? 'border-slate-300 bg-slate-50 hover:border-orange-500 hover:bg-orange-50 text-slate-800'
                    : 'border-white/30 bg-black/40 hover:bg-black/60 text-white backdrop-blur-md hover:border-orange-400'
                }`}
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>Sign In</span>
              </button>
            )}

            {/* Hamburger Button for Mobile and Tablet (<lg) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle Navigation Menu"
              className={`lg:hidden p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-xs ${
                isScrolled
                  ? 'border-slate-300 bg-slate-50 text-slate-800 hover:text-orange-600 hover:bg-slate-100'
                  : 'border-white/30 bg-black/40 text-white hover:bg-black/60 backdrop-blur-md hover:text-orange-400'
              }`}
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Dropdown Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mx-3 sm:mx-6 rounded-2xl border border-slate-200 bg-white/98 backdrop-blur-2xl px-3 py-3 shadow-2xl animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col space-y-1 font-semibold text-slate-800 text-sm">
              <a
                href="#booking-engine"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  scrollToBookingEngine();
                }}
                className="flex items-center justify-between px-3 py-2 bg-orange-600 text-white rounded-xl shadow-xs font-bold hover:bg-orange-700 transition text-xs sm:text-sm"
              >
                <span>Book Cab Online</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">Instant</span>
              </a>

              <a
                href="#fleet"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-slate-100 text-slate-800 hover:text-orange-600 transition text-xs sm:text-sm"
              >
                <span>Fleet &amp; Rates</span>
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>

              <a
                href="#why-kandy"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-slate-100 text-slate-800 hover:text-orange-600 transition text-xs sm:text-sm"
              >
                <span>Why Choose Us</span>
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>

              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-slate-100 text-slate-800 hover:text-orange-600 transition text-xs sm:text-sm"
              >
                <span>How It Works</span>
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>

              <div className="pt-1.5 border-t border-slate-200 flex flex-col gap-1.5">
                {mounted && user?.roles?.includes(UserRole.ADMIN) && (
                  <a
                    href={process.env.NEXT_PUBLIC_ADMIN_URL || '/admin'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg hover:bg-slate-50 transition font-bold text-xs text-left shadow-xs"
                  >
                    <span>Admin Dashboard</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setDriverAppModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 bg-orange-50 border border-orange-200 text-orange-950 rounded-lg hover:bg-orange-100 transition font-bold text-xs text-left"
                >
                  <span>Download KandyCabs App</span>
                  <span className="text-[9px] bg-orange-600 text-white px-1.5 py-0.5 rounded font-black">Download</span>
                </button>

                <a
                  href="tel:+918045689000"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 font-bold text-xs transition"
                >
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>24/7 Support: +91 80456 89000</span>
                </a>

                {mounted && isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs transition"
                  >
                    <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* 3. Hero Header Section with Scenic Mountain Drive Visual & Value Proposition */}
      <section className="relative text-white overflow-hidden bg-slate-950">
        {/* MOBILE & TABLET (100vh Full Screen Image with Text Overlaid at Top) */}
        <div className="lg:hidden relative h-[100svh] min-h-[640px] max-h-[950px] sm:min-h-[780px] w-full flex flex-col justify-between pt-24 sm:pt-24 pb-4 sm:pb-6 px-4 sm:px-6 overflow-hidden">
          {/* 100vh Full Background Image */}
          <Image
            src="/images/hero-mountain-road.webp"
            alt="Kandy Cabs Scenic Western Ghats Mountain Highway"
            fill
            priority
            sizes="100vw"
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
          />
          {/* Subtle Top & Bottom Gradient Overlay for contrast */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/20 to-slate-950/90 pointer-events-none" />

          {/* Top Text Content Inside Image */}
          <div className="relative z-10 pt-0 text-center flex flex-col items-center space-y-2.5 px-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.12] drop-shadow-md text-white">
              Reliable <br />
              Outstation Cabs <br />
              from{' '}
              <span className="bg-gradient-to-r from-[#F05323] via-orange-500 to-[#FF7A3D] bg-clip-text text-transparent">
                Mangaluru
              </span>
            </h1>

            <div className="text-sm sm:text-base md:text-lg font-bold text-amber-300 leading-snug space-y-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] tracking-wide">
              <p>One-Way Drops <span className="text-orange-400 font-extrabold mx-1">|</span> Round Trips</p>
              <p>Airport Transfers <span className="text-orange-400 font-extrabold mx-1">|</span> Corporate Travel</p>
              <p className="font-extrabold tracking-wide">Tour & Pilgrimage Trips</p>
            </div>
          </div>

          {/* Animated Fleet Slider on the Scenic Mountain Road */}
          <div className="absolute inset-0 flex items-end justify-end pr-1 sm:pr-4 pointer-events-none pb-64 sm:pb-56 overflow-hidden">
            {HERO_FLEET_SLIDES.map((slide, idx) => {
              const isActive = idx === currentFleetSlide;
              const isExiting = idx === prevFleetSlide;

              let animClasses = 'opacity-0 -translate-x-full scale-95 pointer-events-none transition-none';
              if (isActive) {
                animClasses = 'opacity-100 translate-x-0 scale-100 transition-all duration-1000 ease-out z-10';
              } else if (isExiting) {
                animClasses = 'opacity-0 translate-x-full scale-95 pointer-events-none transition-all duration-1000 ease-out z-0';
              }

              const mobileSize = slide.id === 'traveller'
                ? 'w-[114%] -right-4 sm:w-[96%] sm:right-2 max-w-[720px]'
                : 'w-[92%] sm:w-[86%] max-w-[580px] right-0 sm:right-2';

              const mobileBottom = slide.id === 'traveller'
                ? 'bottom-20 sm:bottom-20'
                : 'bottom-24 sm:bottom-20';

              return (
                <div
                  key={slide.id}
                  className={`absolute ${mobileBottom} ${mobileSize} transform ${animClasses}`}
                >
                  <div className="relative">
                    <Image
                      src={slide.image}
                      alt={slide.name}
                      width={580}
                      height={320}
                      priority={idx === 0}
                      className="w-full h-auto object-contain filter drop-shadow-[0_24px_28px_rgba(0,0,0,0.92)] select-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Fleet Info Badge with Centered Book Cab CTA Button at Top Middle Border */}
          <div className="relative z-30 w-full max-w-xl mx-auto pb-4 sm:pb-5">
            <div className="relative bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 pt-5 pb-3.5 px-4 sm:pt-5.5 sm:pb-4 sm:px-5 rounded-2xl flex items-center justify-between shadow-2xl">
              {/* Floating Centered Book Cab Button at Top Middle of the Border */}
              <div className="absolute -top-4 sm:-top-4.5 left-1/2 -translate-x-1/2 z-20">
                <button
                  type="button"
                  onClick={() => {
                    const slideId = HERO_FLEET_SLIDES[currentFleetSlide]?.id;
                    const cat = slideId ? SLIDE_TO_CATEGORY[slideId] : undefined;
                    scrollToBookingEngine(cat);
                  }}
                  className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-xs sm:text-sm px-5 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-lg shadow-orange-600/40 flex items-center gap-1.5 transition-all transform hover:scale-105 active:scale-95 shrink-0 border border-orange-400/40 cursor-pointer"
                >
                  <span>Book Cab</span>
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>

              {/* Left: Vehicle Details */}
              <div className="min-w-0 text-left pr-2">
                <div className="text-[10px] sm:text-[11px] text-orange-400 font-bold uppercase tracking-wider truncate">
                  {HERO_FLEET_SLIDES[currentFleetSlide]?.name || 'Verified Fleet & Drivers'}
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-white mt-0.5 truncate">
                  {HERO_FLEET_SLIDES[currentFleetSlide]?.models || 'Sedan • SUV • Innova Crysta • Tempo'}
                </div>
              </div>

              {/* Right: Starting Price */}
              <div className="text-right pl-2 shrink-0">
                <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium">Starting from</div>
                <div className="text-xs sm:text-sm md:text-base font-black text-orange-400">
                  {HERO_FLEET_SLIDES[currentFleetSlide]?.rate || '₹11 / km'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DESKTOP VIEW (lg: 2-Column Side-by-Side Layout) */}
        <div className="hidden lg:block relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-28 pb-20 px-4 sm:px-6 lg:px-8">
          {/* Subtle decorative glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(234,88,12,0.18),transparent_50%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(30,41,59,0.7),transparent_50%)] pointer-events-none" />

          <div className="max-w-7xl mx-auto grid grid-cols-12 gap-10 items-center relative z-10">
            {/* Left Column: Headline & Value Proposition */}
            <div className="col-span-6 space-y-5 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold tracking-wide uppercase">
                🚖 Safe • Reliable • Hassle Free
              </div>

              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight leading-[1.12] text-white">
                Reliable Outstation Cabs <br />
                from{' '}
                <span className="bg-gradient-to-r from-[#F05323] via-orange-500 to-[#FF7A3D] bg-clip-text text-transparent">
                  Mangaluru
                </span>
              </h1>

              <div className="space-y-1.5 text-base sm:text-lg font-bold text-amber-300 border-l-4 border-orange-500 pl-4 py-0.5">
                <p>One-Way Drops <span className="text-orange-400 font-extrabold mx-1.5">|</span> Round Trips</p>
                <p>Airport Transfers <span className="text-orange-400 font-extrabold mx-1.5">|</span> Corporate Travel</p>
                <p className="font-extrabold">Tour & Pilgrimage Trips</p>
              </div>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl font-normal">
                Karnataka&apos;s premier intercity chauffeur cab service. Travel smoothly across Mangalore, Bangalore, Mysore, Coorg, Chikmagalur & Western Ghats with verified commercial drivers, zero surge pricing, and 20% advance booking.
              </p>

              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800">
                <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 backdrop-blur-xs">
                  <div className="text-2xl font-black text-orange-400">0%</div>
                  <div className="text-xs text-slate-300 mt-0.5 font-medium">Surge Pricing</div>
                </div>
                <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 backdrop-blur-xs">
                  <div className="text-2xl font-black text-orange-400">4.9 ★</div>
                  <div className="text-xs text-slate-300 mt-0.5 font-medium">50k+ Happy Trips</div>
                </div>
                <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 backdrop-blur-xs">
                  <div className="text-2xl font-black text-orange-400">20%</div>
                  <div className="text-xs text-slate-300 mt-0.5 font-medium">Advance Only</div>
                </div>
              </div>
            </div>

            {/* Right Column: Option A Scenic Mountain Drive Visual Card */}
            <div className="col-span-6 relative pb-6 sm:pb-8">
              <div className="relative rounded-3xl shadow-2xl border-2 border-slate-800/80 group">
                {/* Mountain Drive Road Background Image */}
                <div className="relative rounded-[22px] overflow-hidden min-h-[340px] sm:min-h-[400px]">
                  <Image
                    src="/images/hero-mountain-road.webp"
                    alt="Kandy Cabs Scenic Western Ghats Mountain Highway"
                    width={800}
                    height={400}
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="w-full h-[340px] sm:h-[400px] object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />

                  {/* Animated Fleet Slider (Coming Smoothly on the Mountain Road) */}
                  <div className="absolute inset-0 flex items-end justify-end pr-2 sm:pr-6 pointer-events-none pb-1 sm:pb-2 overflow-hidden">
                    {HERO_FLEET_SLIDES.map((slide, idx) => {
                      const isActive = idx === currentFleetSlide;
                      const isExiting = idx === prevFleetSlide;

                      let animClasses = 'opacity-0 -translate-x-full scale-95 pointer-events-none transition-none';
                      if (isActive) {
                        animClasses = 'opacity-100 translate-x-0 scale-100 transition-all duration-1000 ease-out z-10';
                      } else if (isExiting) {
                        animClasses = 'opacity-0 translate-x-full scale-95 pointer-events-none transition-all duration-1000 ease-out z-0';
                      }

                      return (
                        <div
                          key={slide.id}
                          className={`absolute bottom-0 sm:bottom-0.5 right-1 sm:right-4 ${slide.sizeClass || 'w-[74%] sm:w-[70%] max-w-[420px]'} transform ${animClasses}`}
                        >
                          <div className="relative">
                            <Image
                              src={slide.image}
                              alt={slide.name}
                              width={480}
                              height={260}
                              priority={idx === 0}
                              className="w-full h-auto object-contain filter drop-shadow-[0_18px_20px_rgba(0,0,0,0.85)] select-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Fleet Info Badge with Centered Book Cab CTA Button at Top Middle Border */}
                <div className="absolute -bottom-5 sm:-bottom-6 left-3 right-3 sm:left-4 sm:right-4 z-30">
                  <div className="relative bg-slate-950/95 backdrop-blur-md border border-slate-800/90 pt-5 pb-3.5 px-4 sm:pt-5.5 sm:pb-4 sm:px-5 rounded-2xl flex items-center justify-between shadow-2xl">
                    {/* Floating Centered Book Cab Button at Top Middle of the Border */}
                    <div className="absolute -top-4 sm:-top-4.5 left-1/2 -translate-x-1/2 z-20">
                      <button
                        type="button"
                        onClick={() => {
                          const slideId = HERO_FLEET_SLIDES[currentFleetSlide]?.id;
                          const cat = slideId ? SLIDE_TO_CATEGORY[slideId] : undefined;
                          scrollToBookingEngine(cat);
                        }}
                        className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-xs sm:text-sm px-5 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-lg shadow-orange-600/40 flex items-center gap-1.5 transition-all transform hover:scale-105 active:scale-95 shrink-0 border border-orange-400/40 cursor-pointer"
                      >
                        <span>Book Cab</span>
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>

                    {/* Left: Vehicle Details */}
                    <div className="min-w-0 text-left pr-2">
                      <div className="text-[10px] sm:text-[11px] text-orange-400 font-bold uppercase tracking-wider truncate">
                        {HERO_FLEET_SLIDES[currentFleetSlide]?.name || 'Verified Fleet & Drivers'}
                      </div>
                      <div className="text-xs sm:text-sm font-extrabold text-white mt-0.5 truncate">
                        {HERO_FLEET_SLIDES[currentFleetSlide]?.models || 'Sedan • SUV • Innova Crysta • Tempo'}
                      </div>
                    </div>

                    {/* Right: Starting Price */}
                    <div className="text-right pl-2 shrink-0">
                      <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium">Starting from</div>
                      <div className="text-xs sm:text-sm md:text-base font-black text-orange-400">
                        {HERO_FLEET_SLIDES[currentFleetSlide]?.rate || '₹11 / km'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Floating Main Booking Engine Card */}
      <section id="booking-engine" className="relative mt-6 lg:-mt-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-20 w-full mb-6 sm:mb-8 lg:mb-14 scroll-mt-24 sm:scroll-mt-28">
        <div className="bg-white text-slate-900 rounded-3xl shadow-2xl p-4 sm:p-8 border border-slate-200">
          {/* Trip Type / Package Tabs */}
          {/* MOBILE ONLY (<sm): Dynamic sub-tabs for Local, Airport, and Outstation */}
          <div className="sm:hidden">
            {tripType === TripType.LOCAL ? (
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-2.5">
                {[
                  { hours: 4, label: '4 hrs (40 km)' },
                  { hours: 8, label: '8 hrs (80 km)' },
                  { hours: 12, label: '12 hrs (120 km)' },
                ].map((pkg) => (
                  <button
                    key={pkg.hours}
                    type="button"
                    onClick={() => {
                      setPackageHours(pkg.hours);
                      setQuoteData(null);
                    }}
                    className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                      packageHours === pkg.hours
                        ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {pkg.label}
                  </button>
                ))}
              </div>
            ) : tripType === TripType.AIRPORT ? (
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-2.5">
                {[
                  { type: 'PICKUP' as const, label: 'Pickup (From Airport)' },
                  { type: 'DROP' as const, label: 'Drop (To Airport)' },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleAirportTransferSelect(item.type)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                      airportTransferType === item.type
                        ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-2.5">
                {[
                  { id: TripType.ONEWAY, label: 'Outstation One-Way' },
                  { id: TripType.ROUND, label: 'Round Trip' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTripType(t.id);
                      setQuoteData(null);
                    }}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all text-center ${
                      tripType === t.id
                        ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TABLET, LAPTOP & DESKTOP (>=sm): Always display standard 4 Trip Type tabs */}
          <div className="hidden sm:grid sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl mb-4 sm:mb-5">
            {[
              { id: TripType.ONEWAY, label: 'Outstation One-Way' },
              { id: TripType.ROUND, label: 'Round Trip' },
              { id: TripType.AIRPORT, label: 'Airport Taxi' },
              { id: TripType.LOCAL, label: 'Local Rental' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTripType(t.id);
                  setQuoteData(null);
                }}
                className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all text-center ${
                  tripType === t.id
                    ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/25'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Form Controls */}
          <div className="space-y-3 sm:space-y-4">
            {/* Pickup, Swap & Drop inputs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 md:gap-4 items-center relative">
              {/* Pickup Location Trigger */}
              <div className="md:col-span-5">
                <div className="flex justify-between items-center mb-1 sm:mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {tripType === TripType.AIRPORT
                      ? airportTransferType === 'PICKUP'
                        ? 'Airport Pickup Point'
                        : 'Pickup Location'
                      : 'Pickup Location'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationModalTarget('PICKUP');
                      setLocationModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 transition"
                  >
                    <span>⚡ Live GPS</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocationModalTarget('PICKUP');
                    setLocationModalOpen(true);
                  }}
                  className="w-full bg-slate-50 hover:bg-slate-100/90 border border-slate-300 rounded-xl px-3.5 py-2.5 sm:py-3 text-sm font-medium text-slate-900 text-left flex items-center justify-between transition focus:ring-2 focus:ring-orange-500 shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-base flex-shrink-0">{pickupAddress ? '🟢' : '⚪'}</span>
                    <span className={`truncate ${pickupAddress ? 'font-semibold text-slate-900 group-hover:text-orange-600' : 'text-slate-400 font-medium'}`}>
                      {pickupAddress || 'Select pickup location'}
                    </span>
                  </div>
                  <span className="text-slate-400 text-xs font-bold pl-2 flex-shrink-0">▾</span>
                </button>
              </div>

              {/* 1-Click Interactive Swap Button */}
              <div className="md:col-span-2 flex justify-center -my-2 md:my-0 pt-0 md:pt-5 z-10">
                <button
                  type="button"
                  onClick={handleSwapLocations}
                  className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full md:rounded-xl bg-orange-50 hover:bg-orange-600 text-orange-600 hover:text-white border border-orange-300 hover:border-orange-600 transition flex items-center justify-center font-bold text-xs sm:text-sm md:text-lg shadow-xs group"
                  title="Swap Pickup & Drop Locations"
                >
                  <span className="group-hover:rotate-180 transition-transform duration-300">⇅</span>
                </button>
              </div>

              {/* Drop Destination Trigger */}
              <div className="md:col-span-5">
                <div className="flex justify-between items-center mb-1 sm:mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {tripType === TripType.LOCAL
                      ? 'Drop / Service Area'
                      : tripType === TripType.AIRPORT
                      ? airportTransferType === 'DROP'
                        ? 'Airport Drop Point'
                        : 'Drop Destination'
                      : 'Drop Destination'}
                  </label>
                  {/* ONLY in Round Trip: + Add Stop button */}
                  {tripType === TripType.ROUND && (
                    <button
                      type="button"
                      onClick={handleAddStop}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-700 hover:text-white bg-orange-100 hover:bg-orange-600 border border-orange-300 px-2 py-0.5 rounded-lg transition duration-150 shadow-xs"
                    >
                      <span className="text-sm font-extrabold leading-none">+</span>
                      <span>Add Stop</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocationModalTarget('DROP');
                    setLocationModalOpen(true);
                  }}
                  className="w-full bg-slate-50 hover:bg-slate-100/90 border border-slate-300 rounded-xl px-3.5 py-2.5 sm:py-3 text-sm font-medium text-slate-900 text-left flex items-center justify-between transition focus:ring-2 focus:ring-orange-500 shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-base flex-shrink-0">{dropAddress ? '🔴' : '⚪'}</span>
                    <span className={`truncate ${dropAddress ? 'font-semibold text-slate-900 group-hover:text-orange-600' : 'text-slate-400 font-medium'}`}>
                      {dropAddress || 'Select drop destination'}
                    </span>
                  </div>
                  <span className="text-slate-400 text-xs font-bold pl-2 flex-shrink-0">▾</span>
                </button>
              </div>
            </div>

            {/* ONLY in Round Trip: Multiple Intermediate Stops List */}
            {tripType === TripType.ROUND && stops.length > 0 && (
              <div className="p-3.5 bg-orange-50/70 border border-orange-200/80 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-orange-950">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-600"></span>
                    Multiple Route Stops ({stops.length})
                  </span>
                  <span className="text-[11px] font-normal text-slate-600">
                    Chauffeur covers all stops & returns to pickup
                  </span>
                </div>

                <div className="space-y-2.5">
                  {stops.map((stop, index) => (
                    <div
                      key={stop.id}
                      className="p-2.5 bg-white border border-orange-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shadow-xs"
                    >
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="w-5 h-5 rounded-full bg-orange-600 text-white font-black text-[10px] flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                          Via Stop {index + 1}:
                        </span>
                      </div>

                      <div className="flex-1 w-full">
                        <button
                          type="button"
                          onClick={() => {
                            setLocationModalTarget(stop.id);
                            setLocationModalOpen(true);
                          }}
                          className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 text-left flex items-center justify-between transition"
                        >
                          <span className="truncate">{stop.address}</span>
                          <span className="text-slate-400 text-[10px] font-bold pl-1">▾</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveStop(stop.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition flex items-center gap-1 text-xs font-bold self-end sm:self-center"
                        title="Remove this stop"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="sm:hidden text-[11px]">Remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Date, Time & Trip Specifics */}
            <div
              className={`grid gap-3 sm:gap-4 ${
                tripType === TripType.ROUND
                  ? 'grid-cols-2 sm:grid-cols-3'
                  : tripType === TripType.LOCAL
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2'
              }`}
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pickup Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setScheduledDate(e.target.value);
                    setQuoteData(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              {tripType === TripType.ROUND && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Duration (Days)
                  </label>
                  <select
                    value={durationDays}
                    onChange={(e) => {
                      setDurationDays(Number(e.target.value));
                      setQuoteData(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 7, 10].map((d) => (
                      <option key={d} value={d}>
                        {d} {d === 1 ? 'Day' : 'Days'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {tripType === TripType.LOCAL && (
                <div className="hidden sm:block">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Package Hours
                  </label>
                  <select
                    value={packageHours}
                    onChange={(e) => {
                      setPackageHours(Number(e.target.value));
                      setQuoteData(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value={4}>4 Hours (40 km)</option>
                    <option value={8}>8 Hours (80 km)</option>
                    <option value={12}>12 Hours (120 km)</option>
                  </select>
                </div>
              )}

              <div className={tripType === TripType.ROUND ? 'col-span-2 sm:col-span-1' : ''}>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Pickup Time
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => {
                    setScheduledTime(e.target.value);
                    setQuoteData(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Estimate Result Box (if fetched) */}
            {quoteData && (
              <div className="mt-4 p-4 rounded-2xl bg-orange-50 border border-orange-200">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-orange-900 bg-orange-200/80 px-2 py-0.5 rounded">
                      Calculated Distance: {quoteData.distanceKm} km
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 font-medium">Includes 5% GST & Driver Allowance</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {quoteData.quotes.map((q) => {
                    const isSelected = selectedCategory === q.category;
                    return (
                      <div
                        key={q.category}
                        onClick={() => {
                          setSelectedCategory(q.category);
                          let eventType: WebAnalyticsEventType = 'VIEW_RATES';
                          if (q.category === VehicleCategory.HATCHBACK) eventType = 'VIEW_HATCHBACK';
                          else if (q.category === VehicleCategory.SEDAN) eventType = 'VIEW_SEDAN';
                          else if (q.category === VehicleCategory.SUV) eventType = 'VIEW_SUV';
                          else if (q.category === VehicleCategory.SUV_PREMIUM) eventType = 'VIEW_SUV_PREMIUM';
                          else if (q.category === VehicleCategory.TEMPO_TRAVELER) eventType = 'VIEW_TEMPO_TRAVELER';

                          trackWebEvent(eventType, {
                            category: q.category,
                            tripType,
                            pickup: pickupAddress,
                            drop: dropAddress,
                          });
                        }}
                        className={`p-2.5 rounded-xl border cursor-pointer transition text-center ${
                          isSelected
                            ? 'bg-orange-600 text-white border-orange-700 shadow-sm font-bold'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-orange-400'
                        }`}
                      >
                        <div className="text-xs font-bold truncate">{q.name}</div>
                        <div className="text-sm font-extrabold mt-1">₹{q.pricing.totalFare}</div>
                        <div className={`text-[10px] ${isSelected ? 'text-orange-100' : 'text-slate-500'}`}>
                          Advance: ₹{q.pricing.advanceAmount}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-orange-200 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleStartBooking()}
                    className="w-full sm:w-auto py-2.5 px-6 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs sm:text-sm rounded-xl transition shadow-md shadow-orange-600/25 flex items-center justify-center gap-1.5"
                  >
                    <span>Proceed to Book {quoteData.quotes.find((q) => q.category === selectedCategory)?.name || 'Cab'} →</span>
                  </button>
                </div>
              </div>
            )}

            {quoteError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                ⚠️ {quoteError}
              </div>
            )}

            {/* Action CTA Button */}
            <div className="pt-2">
              {(!pickupAddress || !dropAddress) && (
                <p className="text-center text-[11px] text-slate-400 mb-1.5">
                  Please select both pickup and drop locations to continue
                </p>
              )}
              <button
                type="button"
                onClick={() => handleStartBooking()}
                disabled={!pickupAddress || !dropAddress}
                className="w-full py-2.5 sm:py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs sm:text-sm rounded-xl transition shadow-md shadow-orange-600/25 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>⚡ Explore Cabs</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Fleet & Live Rates Showcase */}
      <section id="fleet" className="py-4 sm:py-8 lg:py-14 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="text-left sm:text-center max-w-3xl sm:mx-auto mb-3 sm:mb-6 lg:mb-10">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#F36B21]">
            OUR VEHICLES
          </span>
          <h2 className="text-[17px] sm:text-2xl lg:text-3xl font-black text-[#0B1730] tracking-tight mt-0.5 sm:mt-1">
            Choose Your Travel Comfort
          </h2>
        </div>

        {/* MOBILE ONLY (< sm): Collapsible Accordion Fleet Cards */}
        <div className="sm:hidden space-y-2.5">
          {FLEET_DATA.map((car) => {
            const isExpanded = expandedFleetCategory === car.category;

            if (!isExpanded) {
              return (
                <div
                  key={car.category}
                  onClick={() => setExpandedFleetCategory(car.category)}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-orange-300 hover:shadow-xs p-2.5 transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 group"
                >
                  {/* Left: Car Image */}
                  <div className="w-20 h-14 shrink-0 flex items-center justify-center">
                    <Image
                      src={car.image}
                      alt={car.name}
                      width={120}
                      height={75}
                      className="w-auto h-12 max-w-full object-contain filter drop-shadow-sm select-none pointer-events-none group-hover:scale-105 transition-transform"
                    />
                  </div>

                  {/* Middle: Name & Specs (without icons) */}
                  <div className="min-w-0 flex-1 text-left">
                    <h3 className="text-xs font-extrabold text-[#0B1730] tracking-tight leading-snug">
                      {car.name}
                    </h3>
                    <p className="text-[10.5px] text-slate-500 font-medium mt-0.5 leading-snug">
                      {car.capacity.replace(' Passengers', ' Seats')} | {car.luggage.replace(' Luggage Bags', ' Bags').replace(' Bags as per seats', 'Luggage')} | A/C
                    </p>
                  </div>

                  {/* Right: Expand Icon */}
                  <div className="shrink-0 flex items-center">
                    <div className="w-6 h-6 rounded-full border border-slate-200 bg-slate-50 text-slate-400 group-hover:bg-orange-50 group-hover:text-[#F36B21] group-hover:border-orange-200 flex items-center justify-center transition">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={car.category}
                className={`${car.cardBg} rounded-2xl border-2 ${car.cardBorder} shadow-sm transition-all duration-200 p-3.5 flex flex-col gap-3`}
              >
                {/* Top Row: Badge & Collapse Button */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${car.badgeBg}`}>
                    {car.badgeIcon}
                    <span>{car.badge}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedFleetCategory(null)}
                    className="w-6 h-6 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 border border-slate-200/80 flex items-center justify-center transition"
                    aria-label="Collapse"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                </div>

                {/* Car Large Image Container */}
                <div className="w-full flex items-center justify-center py-3 bg-white/85 rounded-xl border border-white/70">
                  <Image
                    src={car.image}
                    alt={car.name}
                    width={260}
                    height={130}
                    className="w-auto h-28 max-w-full object-contain filter drop-shadow-md select-none pointer-events-none"
                  />
                </div>

                {/* Details: Title & Price */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-[#0B1730] tracking-tight leading-tight">
                      {car.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {car.models}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-baseline justify-end gap-0.5">
                      <span className="text-xl font-black text-[#0B1730] tracking-tight">
                        {car.ratePerKm}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {car.ratePerKmUnit}
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                      BASE OUTSTATION RATE
                    </div>
                  </div>
                </div>

                {/* Specs Row with Icons */}
                <div className="flex items-center gap-3 text-[11px] text-slate-600 font-medium pt-2 border-t border-slate-200/60 flex-wrap">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-slate-400 text-xs">👤</span>
                    <span className="truncate">{car.capacity}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-slate-400 text-xs">🧳</span>
                    <span className="truncate">{car.luggage}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-slate-400 text-xs">❄️</span>
                    <span className="truncate">AC • Clean Interiors</span>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleStartBooking(car.category)}
                    className="w-full py-2.5 bg-[#0B1730] hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl transition duration-150 flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Select {car.name}</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* TABLET & DESKTOP (>= sm): Full Horizontal Cards matching Reference */}
        <div className="hidden sm:flex sm:flex-col space-y-3 sm:space-y-4">
          {FLEET_DATA.map((car) => (
            <div
              key={car.category}
              className={`${car.cardBg} rounded-2xl border ${car.cardBorder} shadow-2xs hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-row items-stretch gap-4 sm:gap-6 group`}
            >
              {/* Left Column: Badge + Centered Car Image */}
              <div className="w-2/5 sm:w-[280px] md:w-[320px] lg:w-[360px] flex flex-col justify-between items-start relative shrink-0">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase ${car.badgeBg}`}>
                  {car.badgeIcon}
                  <span>{car.badge}</span>
                </span>
                <div className="w-full flex items-center justify-center my-auto py-2 sm:py-3">
                  <Image
                    src={car.image}
                    alt={car.name}
                    width={360}
                    height={180}
                    className="w-auto h-32 sm:h-36 md:h-40 lg:h-44 max-w-full object-contain filter drop-shadow-md select-none group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                  />
                </div>
              </div>

              {/* Vertical Divider */}
              <div className="w-px bg-slate-200/80 my-1 self-stretch shrink-0" />

              {/* Right Column: Title, Price, 2-Column Specs, CTA Button */}
              <div className="flex-1 flex flex-col justify-between gap-3 py-0.5">
                {/* Top Row: Name & Rate */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-[#0B1730] tracking-tight leading-tight">
                      {car.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {car.models}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-baseline justify-end gap-0.5">
                      <span className="text-xl sm:text-2xl font-black text-[#0B1730] tracking-tight">
                        {car.ratePerKm}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-500">
                        {car.ratePerKmUnit}
                      </span>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                      BASE OUTSTATION RATE
                    </div>
                  </div>
                </div>

                {/* Middle Row: Specs Grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600 font-medium">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-400 text-sm">👤</span>
                    <span className="truncate">{car.capacity}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-400 text-sm">🧳</span>
                    <span className="truncate">{car.luggage}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-slate-400 text-sm">❄️</span>
                    <span className="truncate">AC • Clean Interiors</span>
                  </div>
                </div>

                {/* Bottom Row: Select Button */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleStartBooking(car.category)}
                    className="px-6 py-2.5 bg-[#0B1730] hover:bg-slate-800 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl transition duration-150 flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Select →</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Why Choose Kandy Cabs */}
      {/* 6. Why Travelers Choose Kandy Cabs Section */}
      <section id="why-kandy" className="py-6 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="text-left sm:text-center max-w-3xl sm:mx-auto mb-4 sm:mb-6">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#F36B21]">
            WHY KANDY CABS
          </span>
          <h2 className="text-[17px] sm:text-2xl lg:text-3xl font-black text-[#0B1730] tracking-tight mt-1">
            Why Travelers Choose Kandy Cabs
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Card 1 */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-sm transition text-left flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-orange-50 text-[#F36B21] border border-orange-100 flex items-center justify-center font-bold text-sm sm:text-base mb-2 sm:mb-2.5">
                ₹
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-[#0B1730] leading-tight">
                Zero Surge Fares
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug mt-1.5 sm:mt-2">
                Know your fare before you travel. No hidden surge charges.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-sm transition text-left flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-orange-50 text-[#F36B21] border border-orange-100 flex items-center justify-center font-bold text-sm sm:text-base mb-2 sm:mb-2.5">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-[#0B1730] leading-tight">
                24/7 Safety &amp; Support
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug mt-1.5 sm:mt-2">
                Help whenever you need it with live route monitoring.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-sm transition text-left flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-orange-50 text-[#F36B21] border border-orange-100 flex items-center justify-center font-bold text-sm sm:text-base mb-2 sm:mb-2.5">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="10" r="3" />
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                </svg>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-[#0B1730] leading-tight">
                Real-Time Tracking
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug mt-1.5 sm:mt-2">
                Track your journey from pickup to destination securely.
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs hover:shadow-sm transition text-left flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-orange-50 text-[#F36B21] border border-orange-100 flex items-center justify-center font-bold text-sm sm:text-base mb-2 sm:mb-2.5">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-[#0B1730] leading-tight">
                Verified Drivers
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug mt-1.5 sm:mt-2">
                Experienced commercial chauffeurs for comfortable journeys.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. How Booking Works Section */}
      <section id="how-it-works" className="py-6 sm:py-10 bg-slate-50 border-t border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-left sm:text-center max-w-3xl sm:mx-auto mb-4 sm:mb-6">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#F36B21]">
              HOW BOOKING WORKS
            </span>
            <h2 className="text-[17px] sm:text-2xl lg:text-3xl font-black text-[#0B1730] tracking-tight mt-1">
              Book Your Ride in 4 Simple Steps
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* Step 01 */}
            <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-sm transition text-left flex flex-col justify-between">
              <div>
                <div className="mb-1.5 sm:mb-2">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#F36B21] text-white font-bold text-[10px] sm:text-xs flex items-center justify-center">
                    01
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#0B1730] leading-tight">
                  Choose Trip
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug mt-1.5 sm:mt-2">
                  Select your pickup and destination
                </p>
              </div>
            </div>

            {/* Step 02 */}
            <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-sm transition text-left flex flex-col justify-between">
              <div>
                <div className="mb-1.5 sm:mb-2">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#F36B21] text-white font-bold text-[10px] sm:text-xs flex items-center justify-center">
                    02
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#0B1730] leading-tight">
                  Select Vehicle
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug mt-1.5 sm:mt-2">
                  Pick your preferred car category
                </p>
              </div>
            </div>

            {/* Step 03 */}
            <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-sm transition text-left flex flex-col justify-between">
              <div>
                <div className="mb-1.5 sm:mb-2">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#F36B21] text-white font-bold text-[10px] sm:text-xs flex items-center justify-center">
                    03
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#0B1730] leading-tight">
                  Enter Details
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug mt-1.5 sm:mt-2">
                  Add date, time &amp; passenger info
                </p>
              </div>
            </div>

            {/* Step 04 */}
            <div className="bg-white rounded-xl p-2.5 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-sm transition text-left flex flex-col justify-between">
              <div>
                <div className="mb-1.5 sm:mb-2">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#F36B21] text-white font-bold text-[10px] sm:text-xs flex items-center justify-center">
                    04
                  </span>
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#0B1730] leading-tight">
                  Confirm &amp; Pay
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug mt-1.5 sm:mt-2">
                  Complete your booking securely
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Call to Action Banner */}
      <section className="py-3 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="relative overflow-hidden rounded-xl bg-[#0B1730] text-white py-3.5 px-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 shadow-md">
          <div className="relative z-10 text-center sm:text-left space-y-0.5 sm:space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#F36B21]">
              READY FOR YOUR NEXT JOURNEY?
            </span>
            <h2 className="text-base sm:text-xl font-black text-white tracking-tight">
              Book Your Cab Today
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-300 font-normal">
              Comfortable rides. Transparent fares. Anywhere in Karnataka &amp; beyond.
            </p>
          </div>

          <div className="relative z-10 shrink-0">
            <button
              type="button"
              onClick={() => scrollToBookingEngine()}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-[#F36B21] hover:bg-orange-600 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-lg transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>Search Cabs</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-slate-950 text-slate-400 pt-16 pb-20 sm:pb-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="bg-white rounded-xl p-2 inline-block">
                  <Image
                    src="/images/logo.webp"
                    alt="Kandy Cabs"
                    width={150}
                    height={40}
                    className="h-10 w-auto object-contain"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Karnataka’s premier chauffeur-driven taxi service. Specializing in outstation round-trips, one-way drops, and airport transfers.
              </p>
              <div className="text-xs font-mono text-orange-400">
                Support: support@kandycabs.com
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Quick Links</h4>
              <ul className="space-y-2 text-xs">
                <li><Link href="/booking" className="hover:text-orange-400 transition">Book Online</Link></li>
                <li><Link href="/customer/dashboard" className="hover:text-orange-400 transition">Customer Dashboard</Link></li>
                <li><a href="#fleet" className="hover:text-orange-400 transition">Vehicle Fleet & Per-Km Rates</a></li>
                <li><a href="#why-kandy" className="hover:text-orange-400 transition">Why Choose Kandy Cabs</a></li>
                <li><a href={process.env.NEXT_PUBLIC_ADMIN_URL || '/admin'} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition text-orange-400 font-semibold">Admin Dispatch Portal ↗</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Security & Trust</h4>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-orange-400 font-bold block mb-1">Razorpay Verified</span>
                  <span className="text-[11px] text-slate-400">256-bit SSL encrypted advance payments and instant refunds.</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 font-bold block mb-1">Live GPS & OTP Safety</span>
                  <span className="text-[11px] text-slate-400">Dual-tier location streaming and driver verification.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <div>
              © {new Date().getFullYear()} Kandy Cabs India. All rights reserved.
            </div>
            <div className="flex gap-6">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Refund Policy</span>
              <span>Driver Onboarding</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Customer Sign In / Sign Up Modal */}
      {authModalOpen && (
        <>
          {/* MOBILE & TABLET FULL-SCREEN VIEW (<lg) */}
          <div className="lg:hidden fixed inset-0 z-50 bg-white flex flex-col justify-between px-6 py-6 sm:px-8 sm:py-8 overflow-y-auto animate-in fade-in duration-200">
            {/* Top Navigation Bar: Back Arrow */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (authStep === 'OTP') {
                    setAuthStep('PHONE');
                    setAuthError('');
                  } else {
                    setAuthModalOpen(false);
                    setAuthError('');
                  }
                }}
                aria-label="Back"
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 transition active:scale-95"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Main Content Area */}
            <div className="max-w-sm w-full mx-auto my-auto py-4 space-y-5">
              {/* Centered Logo */}
              <div className="text-center">
                <Image
                  src="/images/logo.webp"
                  alt="Kandy Cabs"
                  width={150}
                  height={48}
                  priority
                  className="h-10 sm:h-12 w-auto object-contain mx-auto"
                />
              </div>

              {/* Step: Phone / Credentials Input */}
              {authStep === 'PHONE' ? (
                <>
                  {/* Headings */}
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {authMode === 'LOGIN' ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">
                      {authMode === 'LOGIN' ? 'Login to book your next journey' : 'Register to book your journey'}
                    </p>
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                      ⚠️ {authError}
                    </div>
                  )}

                  {/* Form: LOGIN Mode (OTP Only) */}
                  {authMode === 'LOGIN' ? (
                    <form onSubmit={handleAuthSendOtp} className="space-y-4">
                      {/* Mobile Number Field */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                          <svg className="w-5 h-5 mr-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="text-slate-500 font-bold">+91</span>
                        </div>
                        <input
                          type="tel"
                          maxLength={10}
                          required
                          autoFocus
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="Mobile Number"
                          className="w-full pl-20 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition tracking-wide"
                        />
                      </div>

                      {/* Primary Login Button */}
                      <button
                        type="submit"
                        disabled={authLoading || authPhone.length !== 10}
                        className="w-full py-3.5 rounded-2xl bg-[#F05323] hover:bg-orange-600 active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-orange-500/25 disabled:opacity-50 transition flex items-center justify-center gap-2"
                      >
                        {authLoading ? 'Sending OTP...' : 'Login'}
                      </button>
                    </form>
                  ) : (
                    /* Form: REGISTER Mode (Create Account - OTP Only) */
                    <form onSubmit={handleAuthSendOtp} className="space-y-3.5">
                      {/* Full Name */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          required
                          value={authFullName}
                          onChange={(e) => setAuthFullName(e.target.value)}
                          placeholder="Full Name"
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition"
                        />
                      </div>

                      {/* Mobile Number */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                          <svg className="w-5 h-5 mr-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="text-slate-500 font-bold">+91</span>
                        </div>
                        <input
                          type="tel"
                          maxLength={10}
                          required
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="Mobile Number"
                          className="w-full pl-20 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition tracking-wide"
                        />
                      </div>

                      {/* Email Address */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="Email Address (Optional)"
                          className="w-full pl-12 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition"
                        />
                      </div>

                      {/* Terms and Conditions Checkbox */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="terms-mobile"
                          checked={authAgreeTerms}
                          onChange={(e) => setAuthAgreeTerms(e.target.checked)}
                          className="w-4 h-4 rounded text-[#F05323] focus:ring-orange-500 border-slate-300 accent-[#F05323]"
                        />
                        <label htmlFor="terms-mobile" className="text-xs font-semibold text-slate-700 select-none">
                          I agree to the <span className="text-slate-900 font-bold">Terms &amp; Conditions</span>
                        </label>
                      </div>

                      {/* Sign Up Button */}
                      <button
                        type="submit"
                        disabled={authLoading || authPhone.length !== 10 || !authFullName.trim() || !authAgreeTerms}
                        className="w-full py-3.5 rounded-2xl bg-[#F05323] hover:bg-orange-600 active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-orange-500/25 disabled:opacity-50 transition flex items-center justify-center gap-2"
                      >
                        {authLoading ? 'Sending OTP...' : 'Sign Up'}
                      </button>
                    </form>
                  )}
                </>
              ) : (
                /* Step: OTP VERIFICATION */
                <form onSubmit={handleAuthVerifyOtp} className="space-y-4">
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      Enter OTP Code
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">
                      We sent a 4-digit code to <strong className="text-slate-900">+91 {authPhone}</strong>
                    </p>
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                      ⚠️ {authError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <input
                      type="text"
                      maxLength={4}
                      autoFocus
                      value={authOtp}
                      onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full text-center text-3xl tracking-[0.5em] font-mono font-black rounded-2xl border border-slate-300 py-3.5 text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition bg-slate-50"
                    />

                    {authDebugOtp && (
                      <div className="text-center">
                        <span className="inline-flex items-center gap-1.5 bg-orange-100 border border-orange-300 text-orange-900 text-xs font-bold px-3 py-1 rounded-full">
                          <span>⚡ Dev Code: {authDebugOtp}</span>
                          <span className="text-[10px] font-normal text-orange-700">(Auto-filled)</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading || authOtp.length !== 4}
                    className="w-full py-3.5 rounded-2xl bg-[#F05323] text-white font-bold text-base hover:bg-orange-600 active:scale-[0.99] transition shadow-lg shadow-orange-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {authLoading ? 'Verifying...' : 'Verify & Continue →'}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setAuthStep('PHONE')}
                      className="text-xs font-semibold text-orange-600 hover:text-orange-800 transition"
                    >
                      Change Mobile Number
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Bottom Switch Link */}
            {authStep === 'PHONE' && (
              <div className="text-center pt-3 pb-2 text-sm text-slate-600 font-medium">
                {authMode === 'LOGIN' ? (
                  <>
                    New to Kandy Cabs?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('REGISTER');
                        setAuthError('');
                      }}
                      className="text-[#F05323] font-bold hover:underline"
                    >
                      Sign Up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('LOGIN');
                        setAuthError('');
                      }}
                      className="text-[#F05323] font-bold hover:underline"
                    >
                      Login
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* DESKTOP VIEW (>=lg): Centered Floating Dialog Modal */}
          <div className="hidden lg:flex fixed inset-0 z-50 bg-black/60 backdrop-blur-sm items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-5 border border-slate-100 animate-fade-in relative max-h-[92vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition text-lg font-bold"
              >
                ✕
              </button>

              <div className="text-center space-y-1">
                <Image
                  src="/images/logo.webp"
                  alt="Kandy Cabs"
                  width={140}
                  height={44}
                  className="h-11 w-auto object-contain mx-auto mb-2"
                />
                <h3 className="text-xl font-black text-slate-900">
                  {authStep === 'PHONE'
                    ? authMode === 'LOGIN'
                      ? 'Welcome Back'
                      : 'Create Account'
                    : 'Enter Verification Code'}
                </h3>
                <p className="text-xs text-slate-500">
                  {authStep === 'PHONE'
                    ? authMode === 'LOGIN'
                      ? 'Login to book your next journey'
                      : 'Register to book your journey'
                    : `We sent a 4-digit code to +91 ${authPhone}`}
                </p>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                  ⚠️ {authError}
                </div>
              )}

              {authStep === 'PHONE' ? (
                authMode === 'LOGIN' ? (
                  <form onSubmit={handleAuthSendOtp} className="space-y-4">
                    {/* Mobile Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Mobile Number *
                      </label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 text-slate-700 text-sm font-bold">
                          +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          required
                          autoFocus
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="9876543210"
                          className="w-full rounded-r-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition tracking-wider"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading || authPhone.length !== 10}
                      className="w-full py-3 rounded-xl bg-[#F05323] hover:bg-orange-600 text-white font-bold text-sm shadow-md shadow-orange-600/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                      {authLoading ? 'Sending OTP...' : 'Login →'}
                    </button>

                    <div className="pt-2 text-center text-xs text-slate-600 border-t border-slate-100">
                      New to Kandy Cabs?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('REGISTER');
                          setAuthError('');
                        }}
                        className="text-orange-600 font-bold hover:underline"
                      >
                        Create an Account
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleAuthSendOtp} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Mobile Number *
                      </label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 text-slate-700 text-sm font-bold">
                          +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          required
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="9876543210"
                          className="w-full rounded-r-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition tracking-wider"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="terms-desktop"
                        checked={authAgreeTerms}
                        onChange={(e) => setAuthAgreeTerms(e.target.checked)}
                        className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300 accent-orange-600"
                      />
                      <label htmlFor="terms-desktop" className="text-xs font-semibold text-slate-700 select-none">
                        I agree to the <span className="text-slate-900 font-bold">Terms &amp; Conditions</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading || authPhone.length !== 10 || !authFullName.trim() || !authAgreeTerms}
                      className="w-full py-3 rounded-xl bg-[#F05323] hover:bg-orange-600 text-white font-bold text-sm shadow-md shadow-orange-600/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                      {authLoading ? 'Sending OTP...' : 'Sign Up →'}
                    </button>

                    <div className="pt-2 text-center text-xs text-slate-600 border-t border-slate-100">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('LOGIN');
                          setAuthError('');
                        }}
                        className="text-orange-600 font-bold hover:underline"
                      >
                        Login
                      </button>
                    </div>
                  </form>
                )
              ) : (
                <form onSubmit={handleAuthVerifyOtp} className="space-y-4">
                  {isRegistered ? (
                    existingRoles.includes('DRIVER') ? (
                      <div className="p-3 bg-orange-50 border border-orange-300 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-black flex items-center justify-center text-sm shadow-xs flex-shrink-0">
                            🚕
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-orange-900 bg-orange-200/80 px-2 py-0.5 rounded inline-block">
                              Registered Driver Partner
                            </div>
                            <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                              Welcome back, {existingName || 'Driver Partner'}!
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          To receive live trip requests &amp; toggle duty status, please use the <strong>Kandy Driver App</strong>.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                          ✓
                        </div>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                            {existingRoles.includes('ADMIN') ? 'Kandy Administrator' : 'Registered Customer'}
                          </div>
                          <div className="text-sm font-extrabold text-slate-900">
                            Welcome back, {existingName || 'Customer'}!
                          </div>
                        </div>
                      </div>
                    )
                  ) : null}

                  <div>
                    <div className="flex justify-between items-center mb-1.5 gap-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider shrink-0">
                        4-Digit OTP Code
                      </label>
                      <button
                        type="button"
                        onClick={() => setAuthStep('PHONE')}
                        className="text-xs font-semibold text-orange-600 hover:text-orange-800 underline transition truncate"
                      >
                        Change (+91 {authPhone})
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={4}
                      autoFocus={isRegistered}
                      value={authOtp}
                      onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full text-center text-3xl tracking-[0.5em] font-mono font-black rounded-xl border border-slate-300 py-3 text-slate-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition bg-slate-50"
                    />
                    {authDebugOtp && (
                      <div className="mt-2 text-center">
                        <span className="inline-flex items-center gap-1.5 bg-orange-100 border border-orange-300 text-orange-900 text-xs font-bold px-3 py-1 rounded-full">
                          <span>⚡ Dev Code: {authDebugOtp}</span>
                          <span className="text-[10px] font-normal text-orange-700">(Auto-filled)</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading || authOtp.length !== 4 || (!isRegistered && !authFullName.trim())}
                    className="w-full py-3 rounded-xl bg-[#F05323] text-white font-bold text-base hover:bg-orange-600 transition shadow-md shadow-orange-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {authLoading
                      ? 'Verifying...'
                      : existingRoles.includes('DRIVER')
                      ? 'Verify & Continue as Customer →'
                      : 'Verify & Continue →'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}

      {/* Driver App Download / Information Modal */}
      {mounted && driverAppModalOpen && (
        <DriverAppModal
          isOpen={driverAppModalOpen}
          onClose={() => setDriverAppModalOpen(false)}
          driverName={user?.fullName || existingName}
        />
      )}

      {/* Interactive OpenStreetMap Location Picker Modal */}
      {mounted && locationModalOpen && (
        <LocationPickerModal
          isOpen={locationModalOpen}
          onClose={() => setLocationModalOpen(false)}
          title={
            locationModalTarget === 'PICKUP'
              ? 'Select Pickup Location'
              : locationModalTarget === 'DROP'
              ? 'Select Drop Destination'
              : 'Select Intermediate Stop'
          }
          targetType={
            locationModalTarget === 'PICKUP'
              ? 'PICKUP'
              : locationModalTarget === 'DROP'
              ? 'DROP'
              : 'STOP'
          }
          selectedAddress={
            locationModalTarget === 'PICKUP'
              ? pickupAddress
              : locationModalTarget === 'DROP'
              ? dropAddress
              : stops.find((s) => s.id === locationModalTarget)?.address || ''
          }
          onSelectLocation={handleSelectLocation}
        />
      )}

      {/* Mobile-Only Fixed Bottom Trip-Type Navigation Bar (Visible only when scrolling down) */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 py-1.5 px-3 sm:hidden shadow-[0_-4px_24px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out transform ${
          showMobileDock
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="grid grid-cols-4 gap-1.5 items-center">
          {[
            {
              id: TripType.ONEWAY,
              label: 'ONE WAY',
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="18" r="2.5" />
                  <path d="M8.5 18H15a4 4 0 004-4v0a4 4 0 00-4-4H8" />
                  <path d="M11 6l-3 4 3 4" />
                </svg>
              ),
            },
            {
              id: TripType.ROUND,
              label: 'ROUND TRIP',
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="6" width="14" height="15" rx="3" />
                  <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
                  <path d="M9 11v6" />
                  <path d="M15 11v6" />
                </svg>
              ),
            },
            {
              id: TripType.LOCAL,
              label: 'LOCAL',
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              ),
            },
            {
              id: TripType.AIRPORT,
              label: 'AIRPORT',
              icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.5.3-1.7 1.1-.1.5.1 1 .5 1.4l5.6 4.6-2.5 2.5-2.8-.7c-.4-.1-.8.1-1 .4l-.4.5 2.7 1.9 1.9 2.7.5-.4c.3-.2.5-.6.4-1l-.7-2.8 2.5-2.5 4.6 5.6c.4.4.9.6 1.4.5.8-.2 1.3-.9 1.1-1.7z" />
                </svg>
              ),
            },
          ].map((item) => {
            const isActive = tripType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTripType(item.id);
                  setQuoteData(null);
                  scrollToBookingEngine();
                }}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
                  isActive
                    ? 'bg-orange-50 text-[#F36B21] border border-orange-200 font-bold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 font-semibold'
                }`}
              >
                <div className={`${isActive ? 'text-[#F36B21]' : 'text-slate-400'}`}>
                  {item.icon}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
