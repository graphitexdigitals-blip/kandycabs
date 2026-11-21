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
import { ALL_LOCATIONS, PlaceLocation } from '@/lib/locations';
import { BookingFlowHeader } from '@/components/BookingFlowHeader';
import {
  AdditionalRequirementsModal,
  AdditionalRequirementsData,
} from '@/components/AdditionalRequirementsModal';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { WebAuthModal } from '@/components/WebAuthModal';

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
  recommended?: boolean;
  specialBadge?: string;
  roofCarrierAvailable?: boolean;
  hasRoofCarrier?: boolean;
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
    roofCarrierAvailable: true,
  },
  {
    id: 'SWIFT_DZIRE',
    category: VehicleCategory.SEDAN,
    name: 'Sedan – Swift Dzire',
    models: 'Maruti Suzuki Dzire or equivalent',
    image: '/images/fleet-sedan.webp',
    capacity: '4+1',
    luggage: '3',
    fuelBadge: 'Diesel',
    baseRatePerKm: 13,
    roofCarrierAvailable: true,
  },
  {
    id: 'TOYOTA_ETIOS',
    category: VehicleCategory.SEDAN,
    name: 'Sedan – Toyota Etios',
    models: 'Toyota Etios Diesel with Large Boot Space',
    image: '/images/fleet-sedan.webp',
    capacity: '4+1',
    luggage: '4',
    fuelBadge: 'Diesel',
    baseRatePerKm: 14,
    recommended: true,
    specialBadge: 'Diesel with Boot',
    roofCarrierAvailable: true,
  },
  {
    id: 'SUV_ERTIGA',
    category: VehicleCategory.SUV,
    name: 'Prime SUV – Ertiga (6+1)',
    models: 'Maruti Suzuki Ertiga, Kia Carens, Triber',
    image: '/images/fleet-suv.webp',
    capacity: '6+1',
    luggage: '4',
    fuelBadge: 'Diesel / CNG',
    baseRatePerKm: 18,
    roofCarrierAvailable: true,
  },
  {
    id: 'INNOVA_CRYSTA',
    category: VehicleCategory.SUV_PREMIUM,
    name: 'Innova Crysta Luxury',
    models: 'Toyota Innova Crysta, Hycross Luxury',
    image: '/images/fleet-crysta.webp',
    capacity: '7+1',
    luggage: '4',
    fuelBadge: 'Diesel',
    baseRatePerKm: 22,
    recommended: true,
    specialBadge: 'VIP Comfort',
    roofCarrierAvailable: true,
  },
  {
    id: 'TEMPO_TRAVELLER',
    category: VehicleCategory.TEMPO_TRAVELER,
    name: 'Tempo Traveller (12+1)',
    models: 'Force Traveller 3350 AC Executive',
    image: '/images/fleet-traveller.webp',
    capacity: '12-17',
    luggage: '8',
    fuelBadge: 'Diesel',
    baseRatePerKm: 26,
    roofCarrierAvailable: true,
  },
  {
    id: 'URBANIA',
    category: VehicleCategory.URBANIA,
    name: 'Force Urbania Luxury Van',
    models: '10 / 13 / 17 Seater Ultra Cruiser',
    image: '/images/fleet-urbania.webp',
    capacity: '10-17',
    luggage: '12',
    fuelBadge: 'Diesel',
    baseRatePerKm: 32,
    specialBadge: 'Ultra Luxury',
    roofCarrierAvailable: true,
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
  const [pickupAddress, setPickupAddress] = useState('Mangaluru Airport (IXE)');
  const [pickupLat, setPickupLat] = useState(12.9613);
  const [pickupLng, setPickupLng] = useState(74.8901);

  const [dropAddress, setDropAddress] = useState('Kannur Intl Airport (CNN)');
  const [dropLat, setDropLat] = useState(11.9189);
  const [dropLng, setDropLng] = useState(75.5489);

  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });

  const [distanceKm, setDistanceKm] = useState(177);

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
    luggageType: 'NORMAL',
    seniorCitizens: false,
    returnJourneyLater: false,
    needAirportDrop: false,
    needAirportPickup: false,
    petFriendly: false,
    babyOnBoard: false,
  });

  // Payment Selection State in Review (Advance vs Full)
  const [paymentMode, setPaymentMode] = useState<'ADVANCE' | 'FULL'>('ADVANCE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);

  // Modals
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTarget, setLocationModalTarget] = useState<'PICKUP' | 'DROP'>('PICKUP');
  const [authModalOpen, setAuthModalOpen] = useState(false);

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
      if (trip && Object.values(TripType).includes(trip)) setTripType(trip);

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

      // Calculate approximate road distance between lat/lng if available
      if (pLat && dLat && pLng && dLng) {
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
    const isRound = tripType === TripType.ROUND;
    const billedKm = isRound ? distanceKm * 2 : distanceKm;
    const baseDistanceFare = Math.round(billedKm * fleet.baseRatePerKm);
    const chauffeurAllowance = isRound ? 600 : 300;
    const tollStateTax = 'Included';
    const subtotal = baseDistanceFare + chauffeurAllowance;
    const gst = Math.round(subtotal * 0.05);
    const totalFare = subtotal + gst;
    const advancePayable = Math.round(totalFare * 0.3); // 30% advance deposit
    const balanceToDriver = totalFare - advancePayable;

    return {
      billedKm,
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

  // Formatter for Date display (e.g., "22 Nov 2026 (Sun)")
  const formatFriendlyDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} (${days[d.getDay()]})`;
    } catch {
      return dateStr;
    }
  };

  // Formatter for Time display (e.g., "09:00 AM")
  const formatFriendlyTime = (timeStr: string) => {
    try {
      const [h, m] = timeStr.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const formattedH = h % 12 === 0 ? 12 : h % 12;
      return `${String(formattedH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
    } catch {
      return timeStr;
    }
  };

  const handleSelectCab = (fleet: FleetOption) => {
    setSelectedFleet(fleet);
    setStep(3); // Navigate to Step 3: Passenger Contact
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContinueToReview = () => {
    if (!passengerName.trim()) {
      alert('Please enter Lead Passenger Name');
      return;
    }
    const cleaned = passengerPhone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      alert('Please enter a valid 10-digit Indian Mobile Number');
      return;
    }
    setStep(4); // Navigate to Step 4: Review & Confirm Booking
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePayNow = async () => {
    if (isSubmitting) return;
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
            ? tripType === TripType.ROUND
              ? 'Round Trip'
              : 'Outstation One-Way'
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

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* ========================================================================= */}
        {/* STEP 2: SELECT YOUR CAB (Matching screenshot media_1795240412931_a227f139.jpg) */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Route Summary Card with Edit Button */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm relative">
              <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1 min-w-0 pr-4">
                  {/* Pickup Line */}
                  <div className="flex items-center gap-2.5">
                    <div className="text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm font-bold text-slate-900 truncate">
                      {pickupAddress}
                    </span>
                  </div>

                  {/* Drop Line */}
                  <div className="flex items-center gap-2.5">
                    <div className="text-red-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-sm font-bold text-slate-900 truncate">
                      {dropAddress}
                    </span>
                  </div>

                  {/* Distance & Trip Type Info */}
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 pt-1 border-t border-slate-100">
                    <span>
                      {tripType === TripType.ROUND ? 'Round Trip' : 'One Way Drop'} • {distanceKm} km
                    </span>
                  </div>
                </div>

                {/* Right Side: Schedule & Edit Button */}
                <div className="flex flex-col items-end justify-between self-stretch text-right">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700 flex items-center justify-end gap-1">
                      <span>📅</span> {formatFriendlyDate(scheduledDate)}
                    </p>
                    <p className="text-xs font-semibold text-slate-700 flex items-center justify-end gap-1">
                      <span>⏰</span> {formatFriendlyTime(scheduledTime)}
                    </p>
                  </div>

                  <button
                    onClick={() => router.push('/')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                  >
                    <span>✏️</span> Edit
                  </button>
                </div>
              </div>
            </div>

            {/* Our Fleets Header with Sort */}
            <div className="flex items-center justify-between px-1 pt-1">
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Our Fleets
              </h2>
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 cursor-pointer">
                <span>⇅ Sort by Price</span>
                <span>▾</span>
              </div>
            </div>

            {/* List of Fleet Cards */}
            <div className="space-y-3.5">
              {FLEET_LIST.map((fleet) => {
                const fare = calculateFare(fleet);
                const isExpanded = expandedDetailsId === fleet.id;
                const carrierOn = !!roofCarrierEnabled[fleet.id];

                return (
                  <div
                    key={fleet.id}
                    className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                  >
                    {/* Top Badges (e.g. Recommended, Diesel with Boot) */}
                    {(fleet.recommended || fleet.specialBadge) && (
                      <div className="flex items-center gap-1.5 mb-2">
                        {fleet.recommended && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#f0750f] border border-orange-200">
                            Recommended
                          </span>
                        )}
                        {fleet.specialBadge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {fleet.specialBadge}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Main Row: Car Image (Left) + Details & Price (Right) */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Car Image */}
                      <div className="relative w-28 sm:w-36 h-20 sm:h-24 flex-shrink-0">
                        <Image
                          src={fleet.image}
                          alt={fleet.name}
                          fill
                          className="object-contain"
                          priority
                        />
                      </div>

                      {/* Center: Title & Specs */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {fleet.name}
                        </h3>

                        {/* Specs Row */}
                        <div className="flex items-center gap-2.5 text-xs text-slate-500 my-1 font-medium">
                          <span>👤 {fleet.capacity}</span>
                          <span>🧳 {fleet.luggage}</span>
                          <span>❄️ A/C</span>
                        </div>

                        <p className="text-[11px] text-slate-400 font-medium">
                          {fare.billedKm} km included
                        </p>

                        {/* Fuel Badge */}
                        <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-slate-700">
                          <span className="w-2 h-2 rounded-full bg-[#f0750f]" />
                          <span>{fleet.fuelBadge}</span>
                        </div>
                      </div>

                      {/* Right: Fare Amount & Select Button */}
                      <div className="flex flex-col items-end justify-center flex-shrink-0">
                        <div className="text-right mb-1.5">
                          <span className="text-base sm:text-lg font-black text-slate-900">
                            ₹ {fare.totalFare.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectCab(fleet)}
                          className="py-2 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-95 transition-all shadow-sm flex items-center gap-1"
                        >
                          <span>Select</span>
                          <span>&gt;</span>
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons: + Add Requirements & Roof Carrier */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFleet(fleet);
                          setReqModalOpen(true);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                      >
                        <span className="text-[#f0750f] font-bold text-sm">+</span>
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
                          className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                            carrierOn
                              ? 'border-[#f0750f] bg-orange-50 text-[#f0750f]'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
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
                    <div className="mt-2 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDetailsId(isExpanded ? null : fleet.id)
                        }
                        className="text-xs font-semibold text-[#f0750f] hover:underline inline-flex items-center gap-1 py-1"
                      >
                        <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                        <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
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
                      <span>👥 {selectedFleet.capacity}</span>
                      <span>🧳 {selectedFleet.luggage}</span>
                      <span>❄️ A/C</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs font-semibold text-[#f0750f] hover:underline flex items-center gap-0.5 mt-0.5"
                    >
                      <span>Change Vehicle</span>
                      <span className="text-[10px]">▾</span>
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
                  <span>📅 {formatFriendlyDate(scheduledDate)}</span>
                  <span>⏰ {formatFriendlyTime(scheduledTime)}</span>
                </div>
              </div>
            </div>

            {/* Lead Passenger Card */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2 text-slate-900">
                <span className="text-lg text-[#f0750f]">👤</span>
                <h3 className="text-sm font-bold">Lead Passenger</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Full Name */}
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    FULL NAME *
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">👤</span>
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
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    MOBILE NUMBER *
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">📞</span>
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
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    EMAIL ID
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">✉️</span>
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
                <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    ALTERNATE MOBILE NUMBER
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">📞</span>
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
                  <span className="text-lg text-[#f0750f]">⚙️</span>
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

              {/* Two Big Pill Boxes for Travellers & Luggage */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setReqModalOpen(true)}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-center transition-colors"
                >
                  <span className="block text-xl mb-1">👥</span>
                  <span className="block text-xs font-bold text-slate-800">
                    {additionalReqs.travellers} Travellers
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setReqModalOpen(true)}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-center transition-colors"
                >
                  <span className="block text-xl mb-1">🧳</span>
                  <span className="block text-xs font-bold text-slate-800">
                    {additionalReqs.luggageType === 'NONE'
                      ? 'No Luggage'
                      : additionalReqs.luggageType === 'NORMAL'
                      ? 'Normal Luggage'
                      : additionalReqs.luggageType === 'MEDIUM'
                      ? 'Medium Bags'
                      : 'Heavy Luggage'}
                  </span>
                </button>
              </div>
            </div>

            {/* Info Helper Note */}
            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-xs text-blue-700 flex items-start gap-2.5">
              <span className="text-base flex-shrink-0">ℹ️</span>
              <p className="font-medium">
                Please ensure all passenger details are correct. These details will be used for communication regarding your booking.
              </p>
            </div>

            {/* Bottom Green Continue Button */}
            <button
              type="button"
              onClick={handleContinueToReview}
              className="w-full py-4 px-6 rounded-2xl font-bold text-white bg-[#10b981] hover:bg-[#059669] active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 text-base tracking-wide"
            >
              <span>Continue to Review &amp; Pay</span>
              <span>&gt;</span>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: REVIEW & CONFIRM BOOKING (Matching screenshot media_1795240460079_d94c25ef.jpg) */}
        {/* ========================================================================= */}
        {step === 4 && (
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
                      <span>👥 {selectedFleet.capacity}</span>
                      <span>🧳 {selectedFleet.luggage}</span>
                      <span>❄️ A/C</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-xs font-semibold text-[#f0750f] hover:underline flex items-center gap-0.5 mt-0.5"
                    >
                      <span>Change Vehicle</span>
                      <span className="text-[10px]">▾</span>
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

              {/* Route & Schedule */}
              <div className="pt-3 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold truncate">{pickupAddress}</span>
                  <span className="text-slate-400">→</span>
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="font-semibold truncate">{dropAddress}</span>
                </div>
                <div className="flex items-center gap-4 text-slate-500 font-medium">
                  <span>📅 {formatFriendlyDate(scheduledDate)}</span>
                  <span>⏰ {formatFriendlyTime(scheduledTime)}</span>
                </div>
              </div>
            </div>

            {/* Passenger Details Card (2x2 Grid with Edit Button) */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-lg text-[#f0750f]">👤</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Passenger Details</h3>
                    <p className="text-[11px] text-slate-400">Primary Contact</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-3 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-xs"
                >
                  <span>✏️</span> Edit
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

            {/* 2-Column Pricing Card: Left Fare Breakdown vs Right Includes / Excludes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Fare Breakdown */}
              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <span className="text-base text-[#f0750f]">📄</span>
                  <h3 className="text-sm font-bold text-slate-900">Fare Breakdown</h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Distance Fare ({selectedPricing.billedKm} km)</span>
                    <span className="font-semibold text-slate-900">
                      ₹ {selectedPricing.baseDistanceFare.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Chauffeur Allowance</span>
                    <span className="font-semibold text-slate-900">
                      ₹ {selectedPricing.chauffeurAllowance}
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
                    <span className="text-sm font-black text-[#f0750f]">
                      ₹ {selectedPricing.advancePayable.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Driver Payment Section */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Driver Payment Section</span>
                    <span className="font-bold text-slate-900">
                      ₹ {selectedPricing.balanceToDriver.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Includes vs Excludes */}
              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-4">
                {/* Includes */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-2">
                    <span>✓</span>
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
                    <span>✕</span>
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
                  </ul>
                </div>
              </div>
            </div>

            {/* Sticky Bottom Payment Bar (Matching Screenshot) */}
            <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-lg sticky bottom-2 z-30 space-y-3">
              {/* Hint Note */}
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  Pay ₹{selectedPricing.advancePayable.toLocaleString('en-IN')} now to reserve, rest ₹
                  {selectedPricing.balanceToDriver.toLocaleString('en-IN')} to the driver
                </span>
                <span className="text-[#f0750f] font-semibold">Fare breakup ⌃</span>
              </div>

              {/* Tabs: Pay Advance vs Pay Full */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode('ADVANCE')}
                  className={`flex-1 p-2.5 rounded-2xl border text-center transition-all ${
                    paymentMode === 'ADVANCE'
                      ? 'border-[#162232] bg-slate-50 text-slate-900 shadow-sm'
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  <span className="block text-[11px] font-bold">Pay Advance</span>
                  <span className="block text-sm font-black text-slate-900">
                    ₹ {selectedPricing.advancePayable.toLocaleString('en-IN')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('FULL')}
                  className={`flex-1 p-2.5 rounded-2xl border text-center transition-all ${
                    paymentMode === 'FULL'
                      ? 'border-[#162232] bg-slate-50 text-slate-900 shadow-sm'
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  <span className="block text-[11px] font-bold">Pay Full</span>
                  <span className="block text-sm font-black text-slate-900">
                    ₹ {selectedPricing.totalFare.toLocaleString('en-IN')}
                  </span>
                </button>

                {/* PAY NOW CTA Button */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handlePayNow}
                  className="flex-[1.4] py-3.5 px-4 rounded-2xl font-black text-white bg-[#162232] hover:bg-slate-800 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 uppercase tracking-wide text-xs sm:text-sm disabled:opacity-50"
                >
                  <span>PAY NOW</span>
                  <span>
                    ₹{' '}
                    {paymentMode === 'ADVANCE'
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
                  <span>🔑</span>
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
                    {pickupAddress} ➔ {dropAddress}
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
                <span className="text-lg text-blue-600 flex-shrink-0">✈️</span>
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
                <span>🚗</span>
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
    </div>
  );
}
