'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TripType, VehicleCategory } from '@kandy-cabs/shared';
import { useAuth } from '@/lib/AuthContext';
import { ALL_LOCATIONS, PlaceLocation } from '@/lib/locations';
import { CustomerHeader } from '@/components/CustomerHeader';
import { CustomerBottomDock } from '@/components/CustomerBottomDock';
import { WebAuthModal } from '@/components/WebAuthModal';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { DriverAppModal } from '@/components/DriverAppModal';

const POPULAR_LOCATIONS = ALL_LOCATIONS.map((l) => ({ name: l.label, lat: l.lat, lng: l.lng }));

const SERVICE_CATEGORIES = [
  {
    id: 'AIRPORT',
    title: 'Airport Transfer',
    icon: (
      <svg className="w-6 h-6 text-[#f0750f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'LOCAL',
    title: 'Local Rental',
    icon: (
      <svg className="w-6 h-6 text-[#f0750f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'CORPORATE',
    title: 'Corporate Travel',
    icon: (
      <svg className="w-6 h-6 text-[#f0750f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'TOUR',
    title: 'Tour & Pilgrimage',
    icon: (
      <svg className="w-6 h-6 text-[#f0750f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
];

const FLEET_SHOWCASE = [
  {
    id: 'hatchback',
    category: VehicleCategory.HATCHBACK,
    name: 'Sedan – Compact',
    models: 'Toyota Glanza • Swift • Tiago',
    image: '/images/fleet-hatchback.webp',
    rate: '₹11 / km',
    capacity: '4+1 Passengers',
    luggage: '2 Bags',
    badge: 'ECONOMY',
  },
  {
    id: 'sedan',
    category: VehicleCategory.SEDAN,
    name: 'Sedan – Swift Dzire',
    models: 'Dzire • Etios • Honda Amaze',
    image: '/images/fleet-sedan.webp',
    rate: '₹13 / km',
    capacity: '4+1 Passengers',
    luggage: '3 Bags',
    badge: 'MOST BOOKED',
  },
  {
    id: 'suv',
    category: VehicleCategory.SUV,
    name: 'Prime SUV (6+1)',
    models: 'Ertiga • Carens • Triber',
    image: '/images/fleet-suv.webp',
    rate: '₹18 / km',
    capacity: '6+1 Passengers',
    luggage: '4 Bags',
    badge: 'EXTRA SPACE',
  },
  {
    id: 'crysta',
    category: VehicleCategory.SUV_PREMIUM,
    name: 'Innova Crysta Luxury',
    models: 'Innova Crysta • Hycross',
    image: '/images/fleet-crysta.webp',
    rate: '₹22 / km',
    capacity: '7+1 Passengers',
    luggage: '4 Bags',
    badge: 'PREMIUM COMFORT',
  },
  {
    id: 'traveller',
    category: VehicleCategory.TEMPO_TRAVELER,
    name: 'Tempo Traveller',
    models: 'Force Traveller 3350 AC (12+1)',
    image: '/images/fleet-traveller.webp',
    rate: '₹26 / km',
    capacity: '12-17 Passengers',
    luggage: 'Bags as per seats',
    badge: 'GROUP TRAVEL',
  },
  {
    id: 'urbania',
    category: VehicleCategory.URBANIA,
    name: 'Force Urbania Luxury Van',
    models: '10 / 13 / 17 Seater Ultra Van',
    image: '/images/fleet-urbania.webp',
    rate: '₹32 / km',
    capacity: '10-17 Passengers',
    luggage: '10+ Bags',
    badge: 'VIP LUXURY',
  },
];

export default function CustomerHomePage() {
  const router = useRouter();
  const { user } = useAuth();

  // Search Widget State
  const [tripType, setTripType] = useState<TripType>(TripType.ONEWAY);
  const [pickupAddress, setPickupAddress] = useState('Mangaluru Airport (IXE)');
  const [pickupLat, setPickupLat] = useState(12.9613);
  const [pickupLng, setPickupLng] = useState(74.8901);

  const [dropAddress, setDropAddress] = useState('Kannur Intl Airport (CNN)');
  const [dropLat, setDropLat] = useState(11.9189);
  const [dropLng, setDropLng] = useState(75.5489);

  // Scheduled date & time
  const [scheduledDate, setScheduledDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [returnDate, setReturnDate] = useState(() => {
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    return dayAfter.toISOString().split('T')[0];
  });

  // Waypoints
  const [stops, setStops] = useState<{ id: string; address: string; lat: number; lng: number }[]>([]);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTarget, setLocationModalTarget] = useState<'PICKUP' | 'DROP' | string>('PICKUP');

  // Autocomplete suggestions
  const [pickupQuery, setPickupQuery] = useState('');
  const [dropQuery, setDropQuery] = useState('');
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropSuggestions, setShowDropSuggestions] = useState(false);

  const pickupWrapperRef = useRef<HTMLDivElement>(null);
  const dropWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickupWrapperRef.current && !pickupWrapperRef.current.contains(event.target as Node)) {
        setShowPickupSuggestions(false);
      }
      if (dropWrapperRef.current && !dropWrapperRef.current.contains(event.target as Node)) {
        setShowDropSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLocation = (place: PlaceLocation) => {
    if (locationModalTarget === 'PICKUP') {
      setPickupAddress(place.label);
      setPickupLat(place.lat);
      setPickupLng(place.lng);
      setPickupQuery('');
      setShowPickupSuggestions(false);
    } else if (locationModalTarget === 'DROP') {
      setDropAddress(place.label);
      setDropLat(place.lat);
      setDropLng(place.lng);
      setDropQuery('');
      setShowDropSuggestions(false);
    } else {
      setStops((prev) =>
        prev.map((s) => (s.id === locationModalTarget ? { ...s, address: place.label, lat: place.lat, lng: place.lng } : s))
      );
    }
  };

  const handleSwapLocations = () => {
    const tempAddr = pickupAddress;
    const tempLat = pickupLat;
    const tempLng = pickupLng;

    setPickupAddress(dropAddress);
    setPickupLat(dropLat);
    setPickupLng(dropLng);

    setDropAddress(tempAddr);
    setDropLat(tempLat);
    setDropLng(tempLng);
  };

  const handleAddStop = () => {
    const newId = `stop_${Date.now()}`;
    setStops((prev) => [...prev, { id: newId, address: '', lat: 0, lng: 0 }]);
    setLocationModalTarget(newId);
    setLocationModalOpen(true);
  };

  const handleRemoveStop = (id: string) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
  };

  const handleBookYourRide = (selectedCat?: VehicleCategory) => {
    if (!pickupAddress.trim()) {
      alert('Please enter a pickup location');
      return;
    }
    if (!dropAddress.trim()) {
      alert('Please enter a destination or drop location');
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
      category: selectedCat || VehicleCategory.SEDAN,
    });

    if (tripType === TripType.ROUND) {
      params.set('returnDate', returnDate);
    }

    if (stops.length > 0) {
      params.set('stops', JSON.stringify(stops));
    }

    router.push(`/booking?${params.toString()}`);
  };

  const handleCategorySelect = (catId: string) => {
    if (catId === 'AIRPORT') {
      setPickupAddress('Mangaluru Airport (IXE)');
      setPickupLat(12.9613);
      setPickupLng(74.8901);
      setDropAddress('Mangaluru Central Railway Station');
      setDropLat(12.8634);
      setDropLng(74.8436);
      setTripType(TripType.ONEWAY);
    } else if (catId === 'LOCAL') {
      setTripType(TripType.ROUND);
    } else if (catId === 'CORPORATE') {
      setTripType(TripType.ONEWAY);
    } else if (catId === 'TOUR') {
      setPickupAddress('Mangaluru Central Railway Station');
      setPickupLat(12.8634);
      setPickupLng(74.8436);
      setDropAddress('Kollur Mookambika Temple');
      setDropLat(13.8655);
      setDropLng(74.8142);
      setTripType(TripType.ROUND);
    }
  };

  const filteredPickupLocations = ALL_LOCATIONS.filter((l) =>
    l.label.toLowerCase().includes((pickupQuery || '').toLowerCase())
  ).slice(0, 6);

  const filteredDropLocations = ALL_LOCATIONS.filter((l) =>
    l.label.toLowerCase().includes((dropQuery || '').toLowerCase())
  ).slice(0, 6);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-24 md:pb-12">
      {/* Top Header Matching Customer App */}
      <CustomerHeader onOpenAuth={() => setAuthModalOpen(true)} activeNav="home" />

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        {/* Floating White Booking Search Card (Matching Mobile App Exact Layout) */}
        <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-4 sm:p-6 transition-all">
          {/* Trip Type Tabs (ONE WAY vs ROUND TRIP) */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {/* ONE WAY Tab */}
            <button
              type="button"
              onClick={() => setTripType(TripType.ONEWAY)}
              className={`flex items-center gap-2.5 p-3 sm:p-3.5 rounded-2xl text-left transition-all ${
                tripType === TripType.ONEWAY
                  ? 'bg-[#f0750f] text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                  tripType === TripType.ONEWAY ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                →
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold tracking-wide uppercase">
                  ONE WAY
                </p>
                <p
                  className={`text-[10px] sm:text-xs font-medium ${
                    tripType === TripType.ONEWAY ? 'text-white/85' : 'text-slate-400'
                  }`}
                >
                  Drop-off only
                </p>
              </div>
            </button>

            {/* ROUND TRIP Tab */}
            <button
              type="button"
              onClick={() => setTripType(TripType.ROUND)}
              className={`flex items-center gap-2.5 p-3 sm:p-3.5 rounded-2xl text-left transition-all ${
                tripType === TripType.ROUND
                  ? 'bg-[#f0750f] text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                  tripType === TripType.ROUND ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                ↻
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold tracking-wide uppercase">
                  ROUND TRIP
                </p>
                <p
                  className={`text-[10px] sm:text-xs font-medium ${
                    tripType === TripType.ROUND ? 'text-white/85' : 'text-slate-400'
                  }`}
                >
                  Return with same cab
                </p>
              </div>
            </button>
          </div>

          {/* Locations Container with Integrated Swap Button */}
          <div className="relative space-y-2 mb-3">
            {/* Pickup Location Box */}
            <div ref={pickupWrapperRef} className="relative">
              <div className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f] focus-within:border-transparent transition-all">
                {/* Green Pin */}
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    PICKUP LOCATION
                  </span>
                  <input
                    type="text"
                    value={pickupAddress}
                    onChange={(e) => {
                      setPickupAddress(e.target.value);
                      setPickupQuery(e.target.value);
                      setShowPickupSuggestions(true);
                    }}
                    onFocus={() => setShowPickupSuggestions(true)}
                    placeholder="Enter pickup city or location"
                    className="w-full bg-transparent text-sm sm:text-base font-semibold text-slate-900 focus:outline-none truncate placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocationModalTarget('PICKUP');
                    setLocationModalOpen(true);
                  }}
                  className="text-xs text-[#f0750f] font-semibold hover:underline flex-shrink-0"
                >
                  Map
                </button>
              </div>

              {/* Autocomplete Suggestions Dropdown */}
              {showPickupSuggestions && filteredPickupLocations.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden divide-y divide-slate-50">
                  {filteredPickupLocations.map((loc) => (
                    <button
                      key={loc.label}
                      type="button"
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-900 truncate">{loc.label}</p>
                        {loc.sublabel && <p className="text-[11px] text-slate-400 truncate">{loc.sublabel}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Swap Button (Floating Circle Between Pickup & Drop) */}
            <div className="absolute right-4 top-[50%] -translate-y-1/2 z-20">
              <button
                type="button"
                onClick={handleSwapLocations}
                className="w-9 h-9 rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:text-[#f0750f] transition-all active:scale-95"
                title="Swap Pickup and Drop"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* Drop Location Box */}
            <div ref={dropWrapperRef} className="relative">
              <div className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f] focus-within:border-transparent transition-all">
                {/* Red Pin */}
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    DROP LOCATION
                  </span>
                  <input
                    type="text"
                    value={dropAddress}
                    onChange={(e) => {
                      setDropAddress(e.target.value);
                      setDropQuery(e.target.value);
                      setShowDropSuggestions(true);
                    }}
                    onFocus={() => setShowDropSuggestions(true)}
                    placeholder="Enter destination or drop location"
                    className="w-full bg-transparent text-sm sm:text-base font-semibold text-slate-900 focus:outline-none truncate placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocationModalTarget('DROP');
                    setLocationModalOpen(true);
                  }}
                  className="text-xs text-[#f0750f] font-semibold hover:underline flex-shrink-0"
                >
                  Map
                </button>
              </div>

              {/* Drop Autocomplete Suggestions */}
              {showDropSuggestions && filteredDropLocations.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden divide-y divide-slate-50">
                  {filteredDropLocations.map((loc) => (
                    <button
                      key={loc.label}
                      type="button"
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-900 truncate">{loc.label}</p>
                        {loc.sublabel && <p className="text-[11px] text-slate-400 truncate">{loc.sublabel}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stops / Waypoints List (if added) */}
          {stops.map((stop, index) => (
            <div
              key={stop.id}
              className="flex items-center gap-2 p-2.5 mb-2 rounded-xl bg-orange-50/70 border border-orange-100 text-xs"
            >
              <span className="font-bold text-[#f0750f]">{index + 1}. Stop:</span>
              <span className="flex-1 truncate font-medium text-slate-800">
                {stop.address || 'Click to select location'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLocationModalTarget(stop.id);
                  setLocationModalOpen(true);
                }}
                className="text-[#f0750f] font-semibold hover:underline"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => handleRemoveStop(stop.id)}
                className="text-red-500 hover:text-red-700 font-bold ml-1"
              >
                ✕
              </button>
            </div>
          ))}

          {/* + Add a Stop Button */}
          <div className="mb-4">
            <button
              type="button"
              onClick={handleAddStop}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-all"
            >
              <span className="text-[#f0750f] font-bold text-sm">+</span> Add a Stop
            </button>
          </div>

          {/* Schedule Row (Date & Time) */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* Trip Start Date */}
            <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  TRIP START DATE
                </span>
              </div>
              <input
                type="date"
                value={scheduledDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Pickup Time */}
            <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  PICKUP TIME
                </span>
              </div>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer"
              />
            </div>

            {/* If Round Trip: Return Date Row */}
            {tripType === TripType.ROUND && (
              <div className="col-span-2 p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    RETURN JOURNEY DATE
                  </span>
                </div>
                <input
                  type="date"
                  value={returnDate}
                  min={scheduledDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* BOOK YOUR RIDE Button */}
          <button
            type="button"
            onClick={() => handleBookYourRide()}
            className="w-full py-4 px-6 rounded-2xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 text-base tracking-wide uppercase"
          >
            <span>BOOK YOUR RIDE</span>
            <span className="text-xl leading-none">→</span>
          </button>
        </section>

        {/* 4-Card Quick Category Grid (Matching Screenshot) */}
        <section className="grid grid-cols-4 gap-2 sm:gap-3">
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className="bg-white hover:bg-slate-50 active:scale-95 transition-all p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center group"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center mb-2 transition-colors">
                {cat.icon}
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight">
                {cat.title}
              </span>
            </button>
          ))}
        </section>

        {/* Promotional Banner: COMING SOON EV CAB SERVICE (Matching Screenshot) */}
        <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-md border border-slate-100 aspect-[2.4/1] w-full">
          <Image
            src="/images/banner-ev-cab.jpg"
            alt="Coming Soon EV Cab Service - Smart Rides Happy Rides"
            fill
            className="object-cover"
            priority
          />
        </section>

        {/* 24/7 Help & Support Card (Matching Screenshot) */}
        <section className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                24/7 Help & Support
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Need assistance with your ride?
              </p>
            </div>
          </div>
          <a
            href="tel:+919481086058"
            className="bg-[#162232] hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1 flex-shrink-0"
          >
            Get Help &gt;
          </a>
        </section>

        {/* Fleet Showcase Section ("Our Fleets") */}
        <section id="fleets" className="pt-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Our Fleets & Per-Km Rates
            </h3>
            <span className="text-xs text-[#f0750f] font-semibold">
              All AC • Verified Drivers
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {FLEET_SHOWCASE.map((fleet) => (
              <div
                key={fleet.id}
                className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-orange-50 text-[#f0750f] border border-orange-100">
                      {fleet.badge}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {fleet.rate}
                    </span>
                  </div>

                  <div className="relative h-28 w-full mb-3">
                    <Image
                      src={fleet.image}
                      alt={fleet.name}
                      fill
                      className="object-contain"
                    />
                  </div>

                  <h4 className="text-sm font-bold text-slate-900">{fleet.name}</h4>
                  <p className="text-xs text-slate-400 mb-2 truncate">{fleet.models}</p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-3">
                    <span>👥 {fleet.capacity}</span>
                    <span>🧳 {fleet.luggage}</span>
                    <span>❄️ AC</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleBookYourRide(fleet.category)}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-[#f0750f] hover:bg-[#ea580c] transition-colors flex items-center justify-center gap-1 shadow-sm"
                >
                  Book {fleet.name.split('–')[0]} →
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Why Choose Kandy Cabs Value Props */}
        <section className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 mb-3 text-center sm:text-left">
            Why Travel With Kandy Cabs?
          </h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-slate-50">
              <span className="block text-lg font-black text-[#f0750f]">0%</span>
              <span className="text-[11px] font-semibold text-slate-600">Surge Pricing</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50">
              <span className="block text-lg font-black text-[#f0750f]">4.9 ★</span>
              <span className="text-[11px] font-semibold text-slate-600">50k+ Happy Trips</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50">
              <span className="block text-lg font-black text-[#f0750f]">20%</span>
              <span className="text-[11px] font-semibold text-slate-600">Advance Only</span>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile Bottom Dock (Matching Customer App) */}
      <CustomerBottomDock onOpenAuth={() => setAuthModalOpen(true)} />

      {/* OpenStreetMap Interactive Modal */}
      <LocationPickerModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        targetType={locationModalTarget === 'PICKUP' ? 'PICKUP' : locationModalTarget === 'DROP' ? 'DROP' : 'STOP'}
        selectedAddress={locationModalTarget === 'PICKUP' ? pickupAddress : dropAddress}
        onSelectLocation={handleSelectLocation}
        title={
          locationModalTarget === 'PICKUP'
            ? 'Select Pickup Location'
            : locationModalTarget === 'DROP'
            ? 'Select Destination Location'
            : 'Select Stop Location'
        }
      />

      {/* Web Auth Modal */}
      <WebAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Driver App Download Modal */}
      <DriverAppModal
        isOpen={driverModalOpen}
        onClose={() => setDriverModalOpen(false)}
      />
    </div>
  );
}
