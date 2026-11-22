'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  TripType,
  VehicleCategory,
  FuelType,
  QuoteResponse,
  PricingBreakdown,
} from '@kandy-cabs/shared';
import { useAuth } from '@/lib/AuthContext';
import { ALL_LOCATIONS, PlaceLocation, isLocalDistanceRoute, isSameLocation } from '@/lib/locations';
import { BookingFlowHeader } from '@/components/BookingFlowHeader';
import {
  AdditionalRequirementsModal,
  AdditionalRequirementsData,
} from '@/components/AdditionalRequirementsModal';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { WebAuthModal } from '@/components/WebAuthModal';
import { TermsAndConditionsModal } from '@/components/TermsAndConditionsModal';

export const dynamic = 'force-dynamic';

interface FleetOption {
  id: string;
  category: VehicleCategory;
  name: string;
  models: string;
  image: string;
  capacity: string;
  luggage: string;
  fuelBadge: string;
  baseRatePerKm: number;
  minKm?: number;
  recommended?: boolean;
  specialBadge?: string;
  roofCarrierAvailable?: boolean;
  hasRoofCarrier?: boolean;
  isContactOnly?: boolean;
}

const FLEET_LIST: FleetOption[] = [
  {
    id: 'HATCHBACK',
    category: VehicleCategory.HATCHBACK,
    name: 'Sedan – Compact',
    models: 'Toyota Glanza, WagonR, Tiago or equivalent',
    image: '/images/fleet-hatchback.webp',
    capacity: '4+1',
    luggage: '2',
    fuelBadge: 'CNG / Petrol',
    baseRatePerKm: 11,
    minKm: 50,
    roofCarrierAvailable: true,
  },
  {
    id: 'SWIFT_DZIRE',
    category: VehicleCategory.SWIFT_DZIRE,
    name: 'Sedan – Swift Dzire',
    models: 'Maruti Suzuki Dzire or equivalent',
    image: '/images/fleet-sedan.webp',
    capacity: '4+1',
    luggage: '3',
    fuelBadge: 'Diesel',
    baseRatePerKm: 13,
    minKm: 60,
    roofCarrierAvailable: false,
  },
  {
    id: 'TOYOTA_ETIOS',
    category: VehicleCategory.TOYOTA_ETIOS,
    name: 'Sedan – Toyota Etios',
    models: 'Toyota Etios Diesel with Large Boot Space',
    image: '/images/fleet-4-sedan.png',
    capacity: '4+1',
    luggage: '4',
    fuelBadge: 'Diesel',
    baseRatePerKm: 14,
    minKm: 60,
    recommended: true,
    specialBadge: 'Diesel with Boot',
    roofCarrierAvailable: false,
  },
  {
    id: 'SUV_ERTIGA',
    category: VehicleCategory.SUV_ERTIGA,
    name: 'SUV – Ertiga',
    models: 'Maruti Suzuki Ertiga or equivalent',
    image: '/images/fleet-suv.webp',
    capacity: '6+1',
    luggage: '4',
    fuelBadge: 'CNG / Petrol',
    baseRatePerKm: 16,
    minKm: 80,
    roofCarrierAvailable: true,
  },
  {
    id: 'SUV_CARENS',
    category: VehicleCategory.SUV_CARENS,
    name: 'SUV – Kia Carens',
    models: 'Kia Carens Diesel Luxury 6+1',
    image: '/images/fleet-carens.webp',
    capacity: '6+1',
    luggage: '4',
    fuelBadge: 'Diesel',
    baseRatePerKm: 18,
    minKm: 80,
    specialBadge: '6-Seater',
    roofCarrierAvailable: true,
  },
  {
    id: 'SUV_INNOVA',
    category: VehicleCategory.SUV_INNOVA,
    name: 'SUV – Toyota Innova',
    models: 'Toyota Innova Diesel 7+1 Touring',
    image: '/images/fleet-innova.webp',
    capacity: '7+1',
    luggage: '5',
    fuelBadge: 'Diesel',
    baseRatePerKm: 19,
    minKm: 90,
    specialBadge: '7-Seater',
    roofCarrierAvailable: true,
  },
  {
    id: 'SUV_CRYSTA',
    category: VehicleCategory.SUV_CRYSTA,
    name: 'SUV – Innova Crysta',
    models: 'Toyota Innova Crysta Diesel Luxury',
    image: '/images/fleet-crysta.webp',
    capacity: '7+1',
    luggage: '5',
    fuelBadge: 'Diesel',
    baseRatePerKm: 20,
    minKm: 100,
    specialBadge: 'Executive Luxury',
    roofCarrierAvailable: true,
  },
  {
    id: 'TEMPO_TRAVELER',
    category: VehicleCategory.TEMPO_TRAVELER,
    name: 'Tempo Traveller',
    models: '12-17 Seater Force Traveller AC Luxury',
    image: '/images/fleet-traveller.webp',
    capacity: '12-17',
    luggage: '10',
    fuelBadge: 'Diesel',
    baseRatePerKm: 26,
    minKm: 150,
    specialBadge: 'Group',
    roofCarrierAvailable: true,
    isContactOnly: true,
  },
  {
    id: 'URBANIA',
    category: VehicleCategory.URBANIA,
    name: 'Force Urbania',
    models: '10/13/17 Seater Force Urbania AC Luxury Van',
    image: '/images/fleet-urbania.webp',
    capacity: '10-17',
    luggage: '10',
    fuelBadge: 'Diesel',
    baseRatePerKm: 32,
    minKm: 150,
    specialBadge: 'Flagship Luxury',
    roofCarrierAvailable: true,
    isContactOnly: true,
  },
];

export default function BookingFunnelPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  // Wizard Step State
  // 1: Route Summary / Edit
  // 2: Select Your Cab (media_1795240412931_a227f139.jpg)
  // 3: Passenger Contact & Additional Details (media_1795240423537_36a85c99.jpg)
  // 4: Review & Confirm Booking (media_1795240460079_d94c25ef.jpg)
  // 5: Booking Confirmed! (media_1795240479649_916194f3.png)
  const [step, setStep] = useState<2 | 3 | 4 | 5>(2);

  // Route & Schedule State
  const [tripType, setTripType] = useState<TripType>(TripType.ONEWAY);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState(0);
  const [pickupLng, setPickupLng] = useState(0);

  const [dropAddress, setDropAddress] = useState('');
  const [dropLat, setDropLat] = useState(0);
  const [dropLng, setDropLng] = useState(0);

  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [localPackage, setLocalPackage] = useState('8_80');

  const [distanceKm, setDistanceKm] = useState(0);

  // Selected Cab State
  const [selectedFleet, setSelectedFleet] = useState<FleetOption>(FLEET_LIST[0]);
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);
  const [roofCarrierEnabled, setRoofCarrierEnabled] = useState<Record<string, boolean>>({});

  // Passenger Contact State
  const [passengerName, setPassengerName] = useState(user?.fullName || '');
  const [passengerPhone, setPassengerPhone] = useState(user?.phone?.replace(/^\+91/, '') || '');
  const [passengerEmail, setPassengerEmail] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [showAlternateEmail, setShowAlternateEmail] = useState(false);
  const [alternateEmail, setAlternateEmail] = useState('');
  const [showGst, setShowGst] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [gstCompanyName, setGstCompanyName] = useState('');

  // Additional Requirements State
  const [additionalReqs, setAdditionalReqs] = useState<AdditionalRequirementsData>({
    travellers: 0,
    luggageType: 'NONE',
    luggageCounts: { small: 0, medium: 0, large: 0, xlarge: 0 },
    seniorCitizens: false,
    returnJourneyLater: false,
    needAirportDrop: false,
    needAirportPickup: false,
    petFriendly: false,
    petType: 'dog',
    babyOnBoard: false,
    pregnancyFriendly: false,
    accessibilityAssistance: false,
    specialNotes: '',
  });

  // Payment Selection State in Review (Advance vs Full)
  const [paymentMode, setPaymentMode] = useState<'ADVANCE' | 'FULL'>('ADVANCE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);

  // Modals & Terms
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [showTravellersRequiredModal, setShowTravellersRequiredModal] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTarget, setLocationModalTarget] = useState<'PICKUP' | 'DROP'>('PICKUP');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [tempoNoticeModalOpen, setTempoNoticeModalOpen] = useState(false);
  const [selectedLargeFleet, setSelectedLargeFleet] = useState<FleetOption | null>(null);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [couponModalOpen, setCouponModalOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  // Corporate Travel Booking Details
  const [corporateMode, setCorporateMode] = useState<'ONCE' | 'DAILY' | null>(null);
  const [corporateTotalDays, setCorporateTotalDays] = useState<number | null>(null);
  const [corporatePickupTimes, setCorporatePickupTimes] = useState<string[]>([]);

  // Sync user profile when user logs in
  useEffect(() => {
    if (user?.fullName && !passengerName) {
      setPassengerName(user.fullName);
    }
    if (user?.phone && !passengerPhone) {
      setPassengerPhone(user.phone.replace(/^\+91/, ''));
    }
  }, [user]);

  // Read search query params on client load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const trip = sp.get('tripType') as TripType;
      const pkgParam = sp.get('localPackage') || '8_80';
      setLocalPackage(pkgParam);

      const p = sp.get('pickup');
      if (p) setPickupAddress(p);
      const pLat = Number(sp.get('pickupLat'));
      const pLng = Number(sp.get('pickupLng'));
      if (pLat && pLng) {
        setPickupLat(pLat);
        setPickupLng(pLng);
      }

      const d = sp.get('drop');
      if (d) setDropAddress(d);
      const dLat = Number(sp.get('dropLat'));
      const dLng = Number(sp.get('dropLng'));
      if (dLat && dLng) {
        setDropLat(dLat);
        setDropLng(dLng);
      }

      const dateP = sp.get('date');
      if (dateP) setScheduledDate(dateP);
      const timeP = sp.get('time');
      if (timeP) setScheduledTime(timeP);
      const retDateP = sp.get('returnDate');
      if (retDateP) setReturnDate(retDateP);

      const catP = sp.get('category');
      if (catP) {
        const found = FLEET_LIST.find((f) => f.category === catP || f.id === catP);
        if (found) setSelectedFleet(found);
      }

      // Read Corporate travel parameters
      const corpMode = sp.get('corporateMode') as 'ONCE' | 'DAILY' | null;
      if (corpMode) setCorporateMode(corpMode);
      const corpTotalDays = sp.get('corporateTotalDays');
      if (corpTotalDays) setCorporateTotalDays(Number(corpTotalDays));
      const corpTimesJson = sp.get('corporatePickupTimesJson');
      if (corpTimesJson) {
        try {
          setCorporatePickupTimes(JSON.parse(corpTimesJson));
        } catch {}
      }

      // Check if this route is within same city / local distance (< 22 km) (never convert corporate bookings)
      let effectiveTrip = trip;
      const isCorporate = Boolean(corpMode || (trip as string) === 'CORPORATE');
      if (p && d && trip !== TripType.LOCAL && !isCorporate) {
        const pLoc = ALL_LOCATIONS.find((l) => l.label.toLowerCase() === p.toLowerCase().trim()) || {
          label: p,
          lat: pLat || 12.9613,
          lng: pLng || 74.8901,
          category: 'MANGALURU' as const,
        };
        const dLoc = ALL_LOCATIONS.find((l) => l.label.toLowerCase() === d.toLowerCase().trim()) || {
          label: d,
          lat: dLat || 12.8634,
          lng: dLng || 74.8436,
          category: 'MANGALURU' as const,
        };
        if (isLocalDistanceRoute(pLoc, dLoc)) {
          effectiveTrip = TripType.LOCAL;
          setDropAddress('Local Rental (8 Hrs / 80 km)');
        }
      }

      if (effectiveTrip && Object.values(TripType).includes(effectiveTrip)) {
        setTripType(effectiveTrip);
      }

      if (effectiveTrip === TripType.LOCAL) {
        const pkgKm = pkgParam === '4_40' ? 40 : pkgParam === '12_120' ? 120 : 80;
        setDistanceKm(pkgKm);
      } else if (pLat && dLat && pLng && dLng) {
        const rad = (x: number) => (x * Math.PI) / 180;
        const R = 6371; // km
        const dLatRad = rad(dLat - pLat);
        const dLngRad = rad(dLng - pLng);
        const a =
          Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
          Math.cos(rad(pLat)) * Math.cos(rad(dLat)) * Math.sin(dLngRad / 2) * Math.sin(dLngRad / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const straightKm = Math.round(R * c);
        // Multiply by 1.25 road curvature multiplier
        const roadKm = Math.max(50, Math.round(straightKm * 1.25));
        setDistanceKm(roadKm);
      }
    }
  }, []);

  // Pricing Calculation Helper for any Fleet
  const calculateFare = (fleet: FleetOption) => {
    if (tripType === TripType.LOCAL) {
      const packageKm = localPackage === '4_40' ? 40 : localPackage === '12_120' ? 120 : 80;
      const effectiveKm = Math.max(fleet.minKm || 0, packageKm);
      const baseDistanceFare = Math.round(effectiveKm * fleet.baseRatePerKm);
      const chauffeurAllowance = 0; // Local rental package includes driver
      const tollStateTax = 'Included';
      const subtotal = baseDistanceFare;
      const gst = Math.round(subtotal * 0.05);
      const totalFare = subtotal + gst;
      const advancePayable = Math.round(totalFare * 0.3); // 30% advance deposit
      const balanceToDriver = totalFare - advancePayable;

      return {
        billedKm: effectiveKm,
        baseDistanceFare,
        chauffeurAllowance,
        tollStateTax,
        subtotal,
        gst,
        totalFare,
        advancePayable,
        balanceToDriver,
      };
    }

    const isRound = tripType === TripType.ROUND;
    const billedKm = isRound ? distanceKm * 2 : distanceKm;
    const effectiveKm = Math.max(fleet.minKm || 0, billedKm);
    const baseDistanceFare = Math.round(effectiveKm * fleet.baseRatePerKm);
    const chauffeurAllowance = isRound ? 600 : 300;
    const tollStateTax = 'Included';
    const subtotal = baseDistanceFare + chauffeurAllowance;
    const gst = Math.round(subtotal * 0.05);
    const totalFare = subtotal + gst;
    const advancePayable = Math.round(totalFare * 0.3); // 30% advance deposit
    const balanceToDriver = totalFare - advancePayable;

    return {
      billedKm: effectiveKm,
      baseDistanceFare,
      chauffeurAllowance,
      tollStateTax,
      subtotal,
      gst,
      totalFare,
      advancePayable,
      balanceToDriver,
    };
  };

  const selectedPricing = calculateFare(selectedFleet);

  // Filter fleets according to Customer App rules:
  // Tempo Traveller and Force Urbania are NOT available on One-Way drops (Round Trip only)
  const displayedFleets = FLEET_LIST.filter((f) => {
    const isOneWay = tripType === TripType.ONEWAY;
    if (isOneWay && (f.id === 'TEMPO_TRAVELER' || f.id === 'URBANIA')) {
      return false;
    }
    return true;
  });

  // Formatter for Date display (e.g., "22 Nov 2026 (Sun)")
  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr || !dateStr.trim()) return 'Select Date';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} (${days[d.getDay()]})`;
    } catch {
      return dateStr;
    }
  };

  // Formatter for Time display (e.g., "09:00 AM")
  const formatFriendlyTime = (timeStr: string) => {
    if (!timeStr || !timeStr.trim()) return 'Select Time';
    try {
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return timeStr;
      const period = h >= 12 ? 'PM' : 'AM';
      const formattedH = h % 12 === 0 ? 12 : h % 12;
      return `${String(formattedH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
    } catch {
      return timeStr;
    }
  };

  const handleSelectCab = (fleet: FleetOption) => {
    if (fleet.isContactOnly || fleet.id === 'TEMPO_TRAVELER' || fleet.id === 'URBANIA') {
      setSelectedLargeFleet(fleet);
      setTempoNoticeModalOpen(true);
      return;
    }
    setSelectedFleet(fleet);
    setStep(3); // Navigate to Step 3: Passenger Contact
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmLargeFleet = () => {
    if (selectedLargeFleet) {
      setSelectedFleet(selectedLargeFleet);
    }
    setTempoNoticeModalOpen(false);
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContinueToReview = () => {
    if (!scheduledDate) {
      alert('Please select your trip date before proceeding');
      return;
    }
    if (!scheduledTime) {
      alert('Please select your pickup time before proceeding');
      return;
    }
    if (!passengerName.trim()) {
      alert('Please enter Lead Passenger Name');
      return;
    }
    const cleaned = passengerPhone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      alert('Please enter a valid 10-digit Indian Mobile Number');
      return;
    }

    // Validate travellers and luggage (matching customer app Image 1)
    const isLuggageOptional =
      tripType === TripType.LOCAL ||
      corporateMode !== null ||
      (tripType as string) === 'CORPORATE';

    const totalLuggageBags = additionalReqs.luggageCounts
      ? (additionalReqs.luggageCounts.small || 0) +
        (additionalReqs.luggageCounts.medium || 0) +
        (additionalReqs.luggageCounts.large || 0) +
        (additionalReqs.luggageCounts.xlarge || 0)
      : additionalReqs.luggageType === 'NONE'
      ? 0
      : 1;

    const isTravellersMissing = (additionalReqs.travellers || 0) <= 0;
    const isLuggageMissing = !isLuggageOptional && totalLuggageBags <= 0;

    if (isTravellersMissing || isLuggageMissing) {
      setShowTravellersRequiredModal(true);
      return;
    }

    setStep(4); // Navigate to Step 4: Review & Confirm Booking
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePayNow = async () => {
    if (isSubmitting) return;
    if (!scheduledDate || !scheduledTime) {
      alert('Trip date and time are required to complete booking.');
      return;
    }
    if (!agreedToTerms) {
      setTermsModalOpen(true);
      return;
    }
    setIsSubmitting(true);

    try {
      const scheduledAt = `${scheduledDate}T${scheduledTime}:00`;
      const bookingRef = `KC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const pickupOtp = `${Math.floor(1000 + Math.random() * 9000)}`;

      // Try creating booking on server
      try {
        await fetch('/api/customer/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pickupAddress,
            pickupLat,
            pickupLng,
            dropAddress,
            dropLat,
            dropLng,
            category: selectedFleet.category,
            tripType,
            scheduledAt,
            passengerName,
            passengerPhone: `+91${passengerPhone.replace(/\D/g, '')}`,
            passengerEmail,
            bookingRef,
            pickupOtp,
            additionalRequirements: additionalReqs,
            totalFare: selectedPricing.totalFare,
            advancePayable: selectedPricing.advancePayable,
            paymentMode,
          }),
        });
      } catch (err) {
        console.warn('Backend booking log warning:', err);
      }

      setBookingResult({
        bookingRef,
        pickupOtp,
        scheduledAt,
        totalFare: selectedPricing.totalFare,
        advancePayable: selectedPricing.advancePayable,
        balanceToDriver: selectedPricing.balanceToDriver,
        passengerName,
        passengerPhone: `+91 ${passengerPhone.replace(/\D/g, '')}`,
        vehicleName: selectedFleet.name,
      });

      setStep(5); // Navigate to Step 5: Booking Confirmed!
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-20">
      {/* 3-Step Booking Flow Header Matching Mobile Screenshots */}
      <BookingFlowHeader
        currentStep={step === 2 ? 2 : step === 3 || step === 4 ? 3 : 3}
        title={
          step === 2
            ? 'Select Your Cab'
            : step === 3
            ? 'Passenger Contact'
            : step === 4
            ? 'Review & Confirm Booking'
            : 'Booking Confirmed!'
        }
        subStepLabel={
          step === 2
            ? undefined
            : step === 3
            ? 'Passenger Info'
            : step === 4
            ? 'Review & Pay'
            : 'Scheduled'
        }
        onBack={() => {
          if (step === 2) router.push('/');
          else if (step === 3) setStep(2);
          else if (step === 4) setStep(3);
          else router.push('/');
        }}
        onStep1Press={() => router.push('/')}
        onStep2Press={() => setStep(2)}
      />

      <div className="max-w-3xl mx-auto px-2 sm:px-4 py-2 sm:py-3.5 space-y-2.5 sm:space-y-3.5">
        {/* ========================================================================= */}
        {/* STEP 2: SELECT YOUR CAB (Matching Customer App Mobile Layout) */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="space-y-2.5 sm:space-y-3 animate-in fade-in duration-200">
            {/* Route Summary Card with Edit Button (Matching Customer App) */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-slate-100 shadow-xs relative space-y-2">
              <div className="flex items-start justify-between gap-2">
                {/* Left: Pickup & Drop Location Line with Dotted Connector */}
                <div className="space-y-1.5 flex-1 min-w-0 pr-1">
                  {/* Pickup Line */}
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 ring-2 ring-emerald-100" />
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {pickupAddress}
                    </span>
                  </div>

                  {/* Vertical Dotted Connector */}
                  <div className="w-2.5 flex justify-center py-0.5">
                    <div className="w-0.5 h-2 border-l border-dashed border-slate-300" />
                  </div>

                  {/* Drop Line */}
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 ring-2 ring-red-100" />
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {tripType === TripType.LOCAL && (!dropAddress || dropAddress.includes('Local') || dropAddress.includes('Railway') || dropAddress.includes('Airport'))
                        ? `${localPackage === '4_40' ? '4 Hours' : localPackage === '12_120' ? '12 Hours' : '8 Hours'} Package Area`
                        : dropAddress}
                    </span>
                  </div>
                </div>

                {/* Right: Date & Time Badges */}
                <div className="flex flex-col items-end text-right text-xs font-semibold text-slate-700 space-y-1 pl-2 flex-shrink-0">
                  <p className="flex items-center gap-1.5 text-[10.5px] sm:text-xs text-slate-700">
                    <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span className="whitespace-nowrap">{formatFriendlyDate(scheduledDate)}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-[10.5px] sm:text-xs text-slate-700">
                    <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="whitespace-nowrap">{formatFriendlyTime(scheduledTime)}</span>
                  </p>
                </div>
              </div>

              {/* Bottom Row: Trip Type & Distance on Left, Edit Button on Right */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
                <span className="font-semibold text-slate-500 text-[10.5px] sm:text-xs">
                  {corporateMode
                    ? corporateMode === 'DAILY'
                      ? `Corporate Daily Rides (${corporateTotalDays || 1} days) • ${distanceKm} km/day`
                      : `Corporate Travel • Book Once • ${distanceKm} km`
                    : tripType === TripType.LOCAL
                    ? `Local Rental • ${localPackage === '4_40' ? '4 Hrs / 40 km' : localPackage === '12_120' ? '12 Hrs / 120 km' : '8 Hrs / 80 km'}`
                    : tripType === TripType.PACKAGE || (tripType as any) === 'TOUR'
                    ? `Tour & Pilgrimage • ${distanceKm} km`
                    : `${tripType === TripType.ROUND ? 'Round Trip' : 'One Way Drop'} • ${distanceKm} km`}
                </span>

                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <svg className="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span>Edit</span>
                </button>
              </div>
            </div>

            {/* Our Fleets Header with Sort */}
            <div className="flex items-center justify-between px-0.5 pt-0.5">
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Our Fleets
              </h2>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700 transition-colors">
                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span>Sort by Price</span>
                <svg className="w-3 h-3 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>

            {/* List of Fleet Cards */}
            <div className="space-y-2.5 sm:space-y-3">
              {displayedFleets.map((fleet) => {
                const fare = calculateFare(fleet);
                const isExpanded = expandedDetailsId === fleet.id;
                const carrierOn = !!roofCarrierEnabled[fleet.id];

                return (
                  <div
                    key={fleet.id}
                    className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden"
                  >
                    {/* Top Badges (e.g. Recommended, Diesel with Boot) */}
                    {(fleet.recommended || fleet.specialBadge) && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {fleet.recommended && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-[#f0750f] border border-orange-200">
                            Recommended
                          </span>
                        )}
                        {fleet.specialBadge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {fleet.specialBadge}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Main Row: Car Image (Left) + Details (Center) + Fare/Action (Right) */}
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      {/* Left: Car Image - Compact on mobile */}
                      <div className="relative w-16 sm:w-24 h-12 sm:h-18 flex-shrink-0">
                        <Image
                          src={fleet.image}
                          alt={fleet.name}
                          fill
                          className="object-contain"
                          priority
                        />
                      </div>

                      {/* Center: Title & Specs Column */}
                      <div className="flex-1 min-w-0 pr-1">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                          {fleet.name}
                        </h3>

                        {/* Specs Row with Vector Icons */}
                        <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-slate-600 my-0.5 font-medium whitespace-nowrap">
                          <span className="flex items-center gap-0.5 sm:gap-1">
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            {fleet.capacity}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center gap-0.5 sm:gap-1">
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="6" width="18" height="15" rx="2" />
                              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                            </svg>
                            {fleet.luggage}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="flex items-center gap-0.5 sm:gap-1">
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="2" x2="12" y2="22" />
                              <line x1="2" y1="12" x2="22" y2="12" />
                              <path d="M17 7l-5 5-5-5" />
                              <path d="M17 17l-5-5-5 5" />
                            </svg>
                            AC
                          </span>
                        </div>

                        <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium whitespace-nowrap">
                          {fare.billedKm} km included
                        </p>
                      </div>

                      {/* Right: Fare Amount & Select Button (Compact matching Customer App) */}
                      <div className="flex-shrink-0 flex flex-col items-end justify-center text-right pl-1">
                        <span className="text-sm sm:text-base font-black text-slate-900 block leading-tight mb-1 whitespace-nowrap">
                          ₹ {fare.totalFare.toLocaleString('en-IN')}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleSelectCab(fleet)}
                          className="h-7 py-1 px-2.5 sm:px-3 rounded-lg font-bold text-xs text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-95 transition-all shadow-xs flex items-center justify-center gap-1"
                        >
                          <span>Select</span>
                          <span className="text-sm font-bold">&gt;</span>
                        </button>
                      </div>
                    </div>

                    {/* Fuel Badge Row - Located below Main Row on its own line */}
                    <div className="flex items-center gap-1.5 mt-1.5 px-0.5 text-[10.5px] sm:text-[11px] font-semibold text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-[#f0750f] inline-block flex-shrink-0" />
                      <span>{fleet.fuelBadge}</span>
                    </div>

                    {/* Action Buttons: + Add Requirements & Roof Carrier */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 pt-1.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFleet(fleet);
                          setReqModalOpen(true);
                        }}
                        className={`${
                          fleet.roofCarrierAvailable ? 'flex-1' : 'w-auto'
                        } py-1 px-2 sm:py-1.5 sm:px-3 rounded-lg sm:rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[10.5px] sm:text-xs font-semibold text-slate-700 flex items-center justify-center gap-1 shadow-2xs transition-colors whitespace-nowrap`}
                      >
                        <span className="text-[#f0750f] font-bold text-xs sm:text-sm leading-none">+</span>
                        <span>Add Requirements</span>
                      </button>

                      {fleet.roofCarrierAvailable && (
                        <button
                          type="button"
                          onClick={() =>
                            setRoofCarrierEnabled((prev) => ({
                              ...prev,
                              [fleet.id]: !prev[fleet.id],
                            }))
                          }
                          className={`flex-1 py-1 px-2 sm:py-1.5 sm:px-3 rounded-lg sm:rounded-xl border text-[10.5px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                            carrierOn
                              ? 'border-[#f0750f] bg-orange-50 text-[#f0750f]'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                              carrierOn ? 'border-[#f0750f] bg-[#f0750f]' : 'border-slate-400'
                            }`}
                          >
                            {carrierOn && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span>Roof Carrier</span>
                        </button>
                      )}
                    </div>

                    {/* Accordion: View Details */}
                    <div className="mt-1 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDetailsId(isExpanded ? null : fleet.id)
                        }
                        className="text-[10.5px] sm:text-xs font-semibold text-[#f0750f] hover:underline inline-flex items-center gap-1 py-0.5"
                      >
                        <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                        <svg className={`w-3 h-3 text-[#f0750f] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    </div>

                    {/* Expanded Details Pane */}
                    {isExpanded && (
                      <div className="mt-2 p-3.5 rounded-2xl bg-slate-50 text-xs space-y-2 border border-slate-100 animate-in fade-in duration-150">
                        <div className="flex justify-between text-slate-600">
                          <span>Base Outstation Rate:</span>
                          <span className="font-semibold text-slate-800">₹{fleet.baseRatePerKm} / km</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Extra Km Charges:</span>
                          <span className="font-semibold text-slate-800">₹{fleet.baseRatePerKm} / km beyond included</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Chauffeur Allowance:</span>
                          <span className="font-semibold text-slate-800">₹{fare.chauffeurAllowance} Included</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Toll & State Permits:</span>
                          <span className="font-semibold text-emerald-600">Included</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>GST (5%):</span>
                          <span className="font-semibold text-slate-800">₹{fare.gst} Included</span>
                        </div>
                        <div className="pt-1.5 border-t border-slate-200 text-[11px] text-slate-400">
                          Free cancellation up to 6 hours before scheduled departure.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: PASSENGER CONTACT (Matching screenshot media_1795240423537_36a85c99.jpg) */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Selected Vehicle Card */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-12 flex-shrink-0">
                    <Image
                      src={selectedFleet.image}
                      alt={selectedFleet.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selectedFleet.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        {selectedFleet.capacity}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="6" width="18" height="15" rx="2" />
                          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                        </svg>
                        {selectedFleet.luggage}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="2" x2="12" y2="22" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M17 7l-5 5-5-5" />
                          <path d="M17 17l-5-5-5 5" />
                        </svg>
                        A/C
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs font-semibold text-[#f0750f] hover:underline flex items-center gap-0.5 mt-0.5"
                    >
                      <span>Change Vehicle</span>
                      <svg className="w-2.5 h-2.5 text-[#f0750f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-base font-black text-slate-900">
                    ₹ {selectedPricing.totalFare.toLocaleString('en-IN')}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Full Payment (Total Fare)
                  </p>
                </div>
              </div>

              {/* Route & Schedule Row */}
              <div className="pt-3 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold truncate">{pickupAddress}</span>
                  <span className="text-slate-400">→</span>
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="font-semibold truncate">{dropAddress}</span>
                </div>
                <div className="flex items-center gap-4 text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {formatFriendlyDate(scheduledDate)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {formatFriendlyTime(scheduledTime)}
                  </span>
                </div>
              </div>
            </div>

            {/* Lead Passenger Card */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2 text-slate-900">
                <svg className="w-4 h-4 text-[#f0750f] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <h3 className="text-sm font-bold">Lead Passenger</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    FULL NAME *
                  </span>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <input
                      type="text"
                      value={passengerName}
                      onChange={(e) => setPassengerName(e.target.value)}
                      placeholder="Enter full name"
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    MOBILE NUMBER *
                  </span>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span className="text-xs font-semibold text-slate-600">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={passengerPhone}
                      onChange={(e) => setPassengerPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 10-digit number"
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Email ID */}
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    EMAIL ID
                  </span>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <input
                      type="email"
                      value={passengerEmail}
                      onChange={(e) => setPassengerEmail(e.target.value)}
                      placeholder="Enter email address"
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Alternate Mobile Number */}
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    ALTERNATE MOBILE NUMBER
                  </span>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <input
                      type="tel"
                      maxLength={10}
                      value={alternatePhone}
                      onChange={(e) => setAlternatePhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter alternate number"
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Action Chips: + Alternate Email, + Add GST */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAlternateEmail(!showAlternateEmail)}
                  className="px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
                >
                  <span className="text-[#f0750f] font-bold">+</span> Alternate Email
                </button>
                <button
                  type="button"
                  onClick={() => setShowGst(!showGst)}
                  className="px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs"
                >
                  <span className="text-[#f0750f] font-bold">+</span> Add GST
                </button>
              </div>

              {/* Optional Alternate Email Input */}
              {showAlternateEmail && (
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 animate-in fade-in">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    ALTERNATE EMAIL ADDRESS
                  </span>
                  <input
                    type="email"
                    value={alternateEmail}
                    onChange={(e) => setAlternateEmail(e.target.value)}
                    placeholder="e.g. travel@company.com"
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                  />
                </div>
              )}

              {/* Optional GST Inputs */}
              {showGst && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50/70 animate-in fade-in">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      GSTIN (15-DIGIT)
                    </span>
                    <input
                      type="text"
                      maxLength={15}
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. 29AAAAA0000A1Z5"
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      COMPANY NAME
                    </span>
                    <input
                      type="text"
                      value={gstCompanyName}
                      onChange={(e) => setGstCompanyName(e.target.value)}
                      placeholder="Company Legal Name"
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Additional Details Card (Pill Boxes) */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#f0750f] flex-shrink-0" viewBox="0 0 512 512" fill="none">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32" d="M368 128h80M64 128h240M368 384h80M64 384h240M208 256h240M64 256h80" />
                    <circle cx="336" cy="128" r="32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32" />
                    <circle cx="176" cy="256" r="32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32" />
                    <circle cx="336" cy="384" r="32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Additional Details</h3>
                    <p className="text-xs text-slate-400">Add your requirements for a better travel experience.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setReqModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-xs flex items-center gap-1"
                >
                  <span>Configure</span>
                  <span>&gt;</span>
                </button>
              </div>

              {/* Two Big Pill Boxes for Travellers & Luggage (Matching Customer App Image 1) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {(() => {
                  const totalLuggage = additionalReqs.luggageCounts
                    ? (additionalReqs.luggageCounts.small || 0) +
                      (additionalReqs.luggageCounts.medium || 0) +
                      (additionalReqs.luggageCounts.large || 0) +
                      (additionalReqs.luggageCounts.xlarge || 0)
                    : additionalReqs.luggageType === 'NONE'
                    ? 0
                    : 1;

                  const isTravellersZero = (additionalReqs.travellers || 0) <= 0;
                  const isLuggageZero = totalLuggage <= 0;

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setReqModalOpen(true)}
                        className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isTravellersZero
                            ? 'border-orange-200 bg-orange-50/50 hover:bg-orange-100/60 shadow-2xs'
                            : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                        }`}
                      >
                        <svg
                          className={`w-6 h-6 mb-1 ${isTravellersZero ? 'text-[#c2410c]' : 'text-slate-600'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        <span className={`block text-xs font-bold ${isTravellersZero ? 'text-[#c2410c]' : 'text-slate-800'}`}>
                          {additionalReqs.travellers || 0} Travellers
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReqModalOpen(true)}
                        className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isLuggageZero
                            ? 'border-orange-200 bg-orange-50/50 hover:bg-orange-100/60 shadow-2xs'
                            : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                        }`}
                      >
                        <svg
                          className={`w-6 h-6 mb-1 ${isLuggageZero ? 'text-[#c2410c]' : 'text-slate-600'}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="6" width="18" height="15" rx="2" />
                          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span className={`block text-xs font-bold ${isLuggageZero ? 'text-[#c2410c]' : 'text-slate-800'}`}>
                          {isLuggageZero ? '0 Luggage' : `${totalLuggage} Luggage Bag${totalLuggage > 1 ? 's' : ''}`}
                        </span>
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Info Helper Note */}
            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-xs text-blue-700 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <p className="font-medium">
                Please ensure all passenger details are correct. These details will be used for communication regarding your booking.
              </p>
            </div>

            {/* Bottom Green Continue Button (Matching Customer App #16a34a) */}
            <button
              type="button"
              onClick={handleContinueToReview}
              className="w-full py-4 px-6 rounded-2xl font-bold text-white bg-[#16a34a] hover:bg-[#15803d] active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 text-base tracking-wide"
            >
              <span>Continue to Review &amp; Pay</span>
              <svg className="w-4 h-4 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: REVIEW & CONFIRM BOOKING (Matching customer app screenshots 1 & 2) */}
        {/* ========================================================================= */}
        {step === 4 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header with Stepper Progress (Matching Image 1) */}
            <div className="space-y-3 pb-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition font-bold"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">Review &amp; Confirm Booking</h2>
                  <p className="text-xs text-slate-500">Step 3 of 3 • Review &amp; Pay</p>
                </div>
              </div>

              {/* Horizontal Stepper Progress Bar */}
              <div className="flex items-center justify-between max-w-md mx-auto pt-1 px-2 text-xs font-bold select-none">
                <div className="flex items-center gap-1.5 text-[#f0750f]">
                  <span className="w-5 h-5 rounded-full bg-[#f0750f] text-white text-[10px] flex items-center justify-center font-bold">✓</span>
                  <span>Trip Details</span>
                </div>
                <div className="flex-1 h-0.5 bg-[#f0750f] mx-2" />
                <div className="flex items-center gap-1.5 text-[#f0750f]">
                  <span className="w-5 h-5 rounded-full bg-[#f0750f] text-white text-[10px] flex items-center justify-center font-bold">✓</span>
                  <span>Select Cab</span>
                </div>
                <div className="flex-1 h-0.5 bg-[#f0750f] mx-2" />
                <div className="flex items-center gap-1.5 text-[#f0750f]">
                  <span className="w-5 h-5 rounded-full bg-[#f0750f] text-white text-[10px] flex items-center justify-center font-bold">3</span>
                  <span>Review &amp; Pay</span>
                </div>
              </div>
            </div>

            {/* Selected Vehicle Card (Matching Image 1) */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="relative w-20 h-14 flex-shrink-0">
                    <Image
                      src={selectedFleet.image}
                      alt={selectedFleet.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">{selectedFleet.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 my-0.5 font-medium">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        {selectedFleet.capacity}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="6" width="18" height="15" rx="2" />
                          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                        </svg>
                        {selectedFleet.luggage}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="2" x2="12" y2="22" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M17 7l-5 5-5-5" />
                          <path d="M17 17l-5-5-5 5" />
                        </svg>
                        A/C
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs font-semibold text-[#f0750f] hover:underline flex items-center gap-0.5 mt-0.5"
                    >
                      <span>Change Vehicle</span>
                      <svg className="w-3 h-3 text-[#f0750f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-base sm:text-lg font-black text-slate-900">
                    ₹ {selectedPricing.totalFare.toLocaleString('en-IN')}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Full Payment (Total Fare)
                  </p>
                </div>
              </div>

              {/* Route & Schedule Rows (Matching Image 1) */}
              <div className="space-y-2.5 text-xs">
                {/* Pickup & Drop Points */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 ring-4 ring-emerald-100" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{pickupAddress}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Pickup Location</p>
                    </div>
                  </div>

                  <span className="text-slate-300 hidden sm:inline">→</span>

                  <div className="flex items-center gap-2 min-w-0 flex-1 sm:justify-end">
                    <span className="w-3 h-3 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 ring-4 ring-red-100" />
                    <div className="min-w-0 sm:text-right">
                      <p className="font-bold text-slate-900 truncate">{dropAddress}</p>
                      <p className="text-[10px] text-slate-400 font-medium">Drop Location</p>
                    </div>
                  </div>
                </div>

                {/* Pickup Date & Time Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <div>
                      <p className="font-bold text-slate-800">{formatFriendlyDate(scheduledDate)}</p>
                      <p className="text-[10px] text-slate-400">Pickup Date</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <svg className="w-4 h-4 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <div>
                      <p className="font-bold text-slate-800">{formatFriendlyTime(scheduledTime)}</p>
                      <p className="text-[10px] text-slate-400">Pickup Time</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Passenger Details Card (2x2 Grid with Edit Button - Matching Image 1) */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#f0750f] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Passenger Details</h3>
                    <p className="text-[11px] text-slate-400">Primary Contact</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-3 py-1 rounded-xl border border-orange-200 text-xs font-bold text-[#f0750f] bg-orange-50 hover:bg-orange-100 flex items-center gap-1.5 shadow-2xs transition"
                >
                  <svg className="w-3.5 h-3.5 text-[#f0750f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span>Edit</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    PASSENGER NAME
                  </span>
                  <span className="font-bold text-slate-900 truncate block">
                    {passengerName || 'Not Provided'}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    PHONE NUMBER
                  </span>
                  <span className="font-bold text-slate-900 truncate block">
                    +91 {passengerPhone}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    EMAIL ADDRESS
                  </span>
                  <span className="font-bold text-slate-900 truncate block">
                    {passengerEmail || 'Not Provided'}
                  </span>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    ALTERNATE PHONE
                  </span>
                  <span className="font-bold text-slate-900 truncate block">
                    {alternatePhone ? `+91 ${alternatePhone}` : 'Not Provided'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2-Column Pricing Card: Left Fare Breakdown vs Right Includes / Excludes (Matching Images 1 & 2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Fare Breakdown */}
              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <svg className="w-4 h-4 text-[#f0750f] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <h3 className="text-sm font-bold text-slate-900">Fare Breakdown</h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>
                      {tripType === TripType.LOCAL
                        ? `Local Package Fare (${selectedPricing.billedKm} km included)`
                        : `Distance Fare (${selectedPricing.billedKm} km)`}
                    </span>
                    <span className="font-semibold text-slate-900">
                      ₹ {selectedPricing.baseDistanceFare.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Chauffeur Allowance</span>
                    <span className="font-semibold text-slate-900">
                      {tripType === TripType.LOCAL ? 'Included in package' : `₹ ${selectedPricing.chauffeurAllowance}`}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Toll &amp; State Tax</span>
                    <span className="font-semibold text-emerald-600">Included</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-800">
                    <span>Subtotal</span>
                    <span>₹ {selectedPricing.subtotal.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>GST (5%)</span>
                    <span className="font-semibold text-slate-900">₹ {selectedPricing.gst}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-between font-black text-sm text-slate-900">
                    <span>Total Ride Fare</span>
                    <span className="text-[#f0750f]">
                      ₹ {selectedPricing.totalFare.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Payable Now Advance Box */}
                <div className="p-3 rounded-2xl bg-orange-50/70 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        Payable Now (Advance):
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Rest ₹{selectedPricing.balanceToDriver.toLocaleString('en-IN')} to driver later
                      </p>
                    </div>
                    <span className="text-sm sm:text-base font-black text-[#f0750f]">
                      ₹ {selectedPricing.advancePayable.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Driver Payment Section (Matching Image 2) */}
                <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-amber-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="8" width="20" height="10" rx="2" />
                        <path d="M6 8l2-4h8l2 4" />
                        <circle cx="7" cy="14" r="1.5" />
                        <circle cx="17" cy="14" r="1.5" />
                      </svg>
                      <span>Driver Payment Section</span>
                    </div>
                    <span>₹{selectedPricing.balanceToDriver.toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 mt-1">
                    Payable to driver upon drop: ₹{selectedPricing.balanceToDriver.toLocaleString('en-IN')} cash / UPI.
                  </p>
                </div>

                {/* Apply Coupon Button (Matching Image 2) */}
                <button
                  type="button"
                  onClick={() => setCouponModalOpen((prev) => !prev)}
                  className="w-full py-2.5 px-3 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/70 text-xs font-bold text-blue-700 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <svg className="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>{appliedCoupon ? `Promo Applied: ${appliedCoupon} (Edit)` : '+ Apply Coupon'}</span>
                </button>

                {couponModalOpen && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 animate-in fade-in">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Try WELCOME100, KANDY15"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl uppercase font-mono tracking-wider focus:outline-none focus:border-[#f0750f]"
                      />
                      {appliedCoupon ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedCoupon(null);
                            setCouponCode('');
                          }}
                          className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200"
                        >
                          ✕ Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!couponCode.trim()) return;
                            setAppliedCoupon(couponCode.trim());
                          }}
                          className="px-4 py-2 text-xs font-bold text-white bg-[#162232] hover:bg-slate-800 rounded-xl"
                        >
                          Apply
                        </button>
                      )}
                    </div>
                    {appliedCoupon && (
                      <p className="text-[11px] font-semibold text-emerald-600">
                        🎉 Promo &ldquo;{appliedCoupon}&rdquo; applied successfully!
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Includes vs Excludes (Matching Images 1 & 2) */}
              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-4">
                {/* Includes */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">✓</span>
                    <span>Includes</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 font-medium">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>Fuel Charges</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>Chauffeur Allowance</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{selectedPricing.billedKm} Kms Limit</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>5% GST Included</span>
                    </li>
                  </ul>
                </div>

                {/* Excludes */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 mb-2">
                    <span className="w-4 h-4 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-bold">✕</span>
                    <span>Excludes</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 font-medium">
                    <li className="flex items-center gap-2">
                      <span className="text-red-500 font-bold">✕</span>
                      <span>Extra Kms @ ₹{selectedFleet.baseRatePerKm}/km</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-red-500 font-bold">✕</span>
                      <span>Toll &amp; Parking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-red-500 font-bold">✕</span>
                      <span>Night Allowance</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-red-500 font-bold">✕</span>
                      <span>Multi-City Entries</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Cancellation Policy Banner (Matching Image 2) */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <span className="w-4 h-4 rounded-full bg-amber-700 text-white flex items-center justify-center text-[10px] font-black">!</span>
                <span>Cancellation Policy: Advance Non-Refundable</span>
              </div>
              <p className="text-amber-900/80 text-[11px] leading-relaxed pl-5.5">
                Free cancellation up to 3 hours before pickup. If cancelled within 3 hours, advance payment is non-refundable.
              </p>
            </div>

            {/* Terms & Conditions Agreement Checkbox & Trust Badge (Matching Image 2) */}
            <div className="space-y-2 pt-1 px-1">
              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 accent-[#f0750f] rounded cursor-pointer"
                />
                <span>
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsModalOpen(true);
                    }}
                    className="text-[#f0750f] font-bold hover:underline"
                  >
                    Terms &amp; Conditions
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsModalOpen(true);
                    }}
                    className="text-[#f0750f] font-bold hover:underline"
                  >
                    Cancellation Policy
                  </button>.
                </span>
              </label>

              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 pl-6.5">
                <svg className="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
                <span>Safe &amp; Secure 256-bit SSL encrypted checkout</span>
              </div>
            </div>

            {/* Sticky Bottom Payment Bar (Matching Image 2) */}
            <div className="sticky bottom-2 z-30 pt-2">
              {/* Top Mint Strip */}
              <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-t-2xl px-4 py-2 flex items-center justify-between text-xs font-semibold text-emerald-900 shadow-sm">
                <span className="truncate pr-2">
                  {paymentMode === 'ADVANCE'
                    ? `Pay ₹${selectedPricing.advancePayable.toLocaleString('en-IN')} now, to reserve, rest ₹${selectedPricing.balanceToDriver.toLocaleString('en-IN')} to the driver`
                    : `Pay ₹${selectedPricing.totalFare.toLocaleString('en-IN')} now, zero balance to the driver`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    window.scrollTo({ top: 380, behavior: 'smooth' });
                  }}
                  className="text-emerald-700 font-bold hover:underline flex items-center gap-0.5 flex-shrink-0"
                >
                  <span>Fare breakup</span>
                  <span>⌃</span>
                </button>
              </div>

              {/* Bottom Buttons Row */}
              <div className="bg-white rounded-b-2xl p-3 border-x border-b border-slate-200 shadow-xl flex items-center gap-2.5">
                {/* Pay Advance Pill */}
                <button
                  type="button"
                  onClick={() => setPaymentMode('ADVANCE')}
                  className={`flex-1 p-2 rounded-xl border text-center transition-all ${
                    paymentMode === 'ADVANCE'
                      ? 'border-[#162232] bg-slate-50 text-slate-900 ring-1 ring-[#162232]'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-[11px] font-bold">Pay Advance</span>
                  <span className="block text-xs sm:text-sm font-black text-slate-900">
                    ₹{selectedPricing.advancePayable.toLocaleString('en-IN')}
                  </span>
                </button>

                {/* Pay Full Pill */}
                <button
                  type="button"
                  onClick={() => setPaymentMode('FULL')}
                  className={`flex-1 p-2 rounded-xl border text-center transition-all ${
                    paymentMode === 'FULL'
                      ? 'border-[#162232] bg-slate-50 text-slate-900 ring-1 ring-[#162232]'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-[11px] font-bold">Pay Full</span>
                  <span className="block text-xs sm:text-sm font-black text-slate-900">
                    ₹{selectedPricing.totalFare.toLocaleString('en-IN')}
                  </span>
                </button>

                {/* PAY NOW CTA Button */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handlePayNow}
                  className="flex-[1.3] py-3 px-3 rounded-xl font-black text-white bg-[#64748b] hover:bg-[#475569] active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 uppercase tracking-wide text-xs sm:text-sm disabled:opacity-50"
                  style={{
                    backgroundColor: agreedToTerms ? '#f0750f' : '#64748b',
                  }}
                >
                  <span>PAY NOW</span>
                  <span>
                    ₹{paymentMode === 'ADVANCE'
                      ? selectedPricing.advancePayable.toLocaleString('en-IN')
                      : selectedPricing.totalFare.toLocaleString('en-IN')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 5: BOOKING CONFIRMED (Matching screenshot media_1795240479649_916194f3.png) */}
        {/* ========================================================================= */}
        {step === 5 && bookingResult && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-md text-center space-y-5">
              {/* Green Checkmark Circle */}
              <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Booking Reference Pill */}
              <div>
                <p className="text-xs text-slate-400 font-semibold mb-1">Booking Reference</p>
                <div className="inline-block px-5 py-2 rounded-2xl bg-emerald-50 text-emerald-800 font-mono font-bold text-base border border-emerald-200">
                  {bookingResult.bookingRef}
                </div>
              </div>

              {/* 4-Digit Pickup OTP Box */}
              <div className="py-2">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                  <svg className="w-3.5 h-3.5 text-[#f0750f] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-1.5 1.5L16 7l-2-2m-1.5 1.5L11 8l-2-2m-1.5 1.5L6 9l-2-2" />
                    <circle cx="7.5" cy="15.5" r="5.5" />
                    <path d="M11.5 11.5L22 2" />
                  </svg>
                  <span>Your 4-Digit Pickup OTP</span>
                </div>

                <div className="flex items-center justify-center gap-3">
                  {bookingResult.pickupOtp.split('').map((digit: string, idx: number) => (
                    <div
                      key={idx}
                      className="w-12 h-14 rounded-2xl border-2 border-orange-200 bg-orange-50/50 flex items-center justify-center font-black text-xl text-[#f0750f] shadow-xs"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-[#ea580c] mt-2 max-w-sm mx-auto font-medium">
                  Please share this code with your driver partner only when they arrive at pickup.
                </p>
              </div>

              {/* Trip Specs Summary Table */}
              <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2.5 text-left border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Vehicle:</span>
                  <span className="font-bold text-slate-900">{bookingResult.vehicleName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Route:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[200px]">
                    {pickupAddress} → {dropAddress}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Scheduled Date:</span>
                  <span className="font-bold text-slate-900">
                    {formatFriendlyDate(scheduledDate)} at {scheduledTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Passenger:</span>
                  <span className="font-bold text-slate-900">
                    {bookingResult.passengerName} ({bookingResult.passengerPhone})
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between">
                  <span className="text-slate-500 font-medium">Advance Status:</span>
                  <span className="font-bold text-emerald-600">
                    ₹{bookingResult.advancePayable.toLocaleString('en-IN')} (PAID)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Balance Due on Trip:</span>
                  <span className="font-bold text-slate-900">
                    ₹{bookingResult.balanceToDriver.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Driver Partner Assignment Notification Card */}
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-left flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h2" />
                  <circle cx="7" cy="17" r="2" />
                  <path d="M9 17h6" />
                  <circle cx="17" cy="17" r="2" />
                </svg>
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Driver Partner Assignment</p>
                  <p className="text-slate-500 mt-0.5">
                    Our dispatch system has notified admin. Driver details &amp; vehicle plate number will appear in your rides dashboard.
                  </p>
                </div>
              </div>

              {/* Track Ride in My Bookings Button */}
              <Link
                href="/customer/dashboard"
                className="w-full py-4 px-6 rounded-2xl font-bold text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 text-sm tracking-wide"
              >
                <svg className="w-4 h-4 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h2" />
                  <circle cx="7" cy="17" r="2" />
                  <path d="M9 17h6" />
                  <circle cx="17" cy="17" r="2" />
                </svg>
                <span>Track Ride in My Bookings</span>
                <span>→</span>
              </Link>

              {/* Back to Home Link */}
              <div>
                <Link
                  href="/"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Additional Requirements Modal */}
      <AdditionalRequirementsModal
        isOpen={reqModalOpen}
        maxSeats={4}
        initialData={additionalReqs}
        onClose={() => setReqModalOpen(false)}
        onApply={(data) => setAdditionalReqs(data)}
      />

      {/* Travellers & Luggage Required Alert Modal (Exact replica of Customer App Image 1) */}
      {showTravellersRequiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={() => setShowTravellersRequiredModal(false)}
          />
          <div className="relative bg-white rounded-3xl p-6 sm:p-7 max-w-[360px] w-full shadow-2xl border border-slate-100 z-10 animate-in zoom-in-95 duration-150">
            <h3 className="text-xl font-bold text-[#0f172a] mb-3">
              Select Travellers
            </h3>
            <p className="text-[15px] leading-relaxed text-[#334155] mb-6">
              Please select the number of <strong className="font-extrabold text-[#0f172a]">travellers</strong> and{' '}
              <strong className="font-extrabold text-[#0f172a]">luggage</strong> before continuing.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTravellersRequiredModal(false)}
                className="px-3.5 py-2 text-sm font-bold text-[#64748b] hover:text-[#0f172a] tracking-wider uppercase transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTravellersRequiredModal(false);
                  setReqModalOpen(true);
                }}
                className="px-3.5 py-2 text-sm font-black text-black hover:text-[#f0750f] tracking-wider uppercase transition-colors"
              >
                SELECT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        targetType={locationModalTarget === 'PICKUP' ? 'PICKUP' : 'DROP'}
        selectedAddress={locationModalTarget === 'PICKUP' ? pickupAddress : dropAddress}
        onSelectLocation={(place: PlaceLocation) => {
          if (locationModalTarget === 'PICKUP') {
            setPickupAddress(place.label);
            setPickupLat(place.lat);
            setPickupLng(place.lng);
          } else {
            setDropAddress(place.label);
            setDropLat(place.lat);
            setDropLng(place.lng);
          }
        }}
        title={
          locationModalTarget === 'PICKUP'
            ? 'Select Pickup Location'
            : 'Select Destination Location'
        }
      />

      {/* Web Auth Modal */}
      <WebAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Terms and Conditions Modal */}
      <TermsAndConditionsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        onAgree={() => setAgreedToTerms(true)}
      />

      {/* Tempo Traveller & Force Urbania Fleet Availability Notice Modal */}
      {tempoNoticeModalOpen && selectedLargeFleet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative border border-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#f0750f] flex items-center justify-center font-bold">
                  <svg className="w-6 h-6 text-[#f0750f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h2" />
                    <circle cx="7" cy="17" r="2" />
                    <path d="M9 17h6" />
                    <circle cx="17" cy="17" r="2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Large Fleet Availability</h3>
                  <p className="text-xs text-slate-500">Commercial Group Charter</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTempoNoticeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            {/* Vehicle Preview Box */}
            <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-2xl mb-4 border border-slate-100">
              <div className="relative w-20 h-16 flex-shrink-0">
                <Image
                  src={selectedLargeFleet.image}
                  alt={selectedLargeFleet.name}
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900 truncate">{selectedLargeFleet.name}</h4>
                <p className="text-xs text-slate-500 truncate">{selectedLargeFleet.models}</p>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 mt-1">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    {selectedLargeFleet.capacity} Travellers
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="6" width="18" height="15" rx="2" />
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
                    {selectedLargeFleet.luggage} Bags
                  </span>
                </div>
              </div>
            </div>

            {/* Informational Process Points */}
            <div className="space-y-3 mb-5 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#f0750f] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-bold text-slate-900">Kindly Book Your Trip</p>
                  <p className="text-slate-500 mt-0.5">
                    Place your booking request online. Our operations team verifies vehicle permit and allocation.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#f0750f] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-bold text-slate-900">Confirmed Within 15 Minutes</p>
                  <p className="text-slate-500 mt-0.5">
                    We assign a verified commercial driver and send confirmation directly to your dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleConfirmLargeFleet}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>Proceed with Booking Request</span>
                <span>→</span>
              </button>
              <a
                href="tel:+919481086058"
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>Call Fleet Operations: +91 94810 86058</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
