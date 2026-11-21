'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TripType, VehicleCategory } from '@kandy-cabs/shared';
import { useAuth } from '@/lib/AuthContext';
import { ALL_LOCATIONS, PlaceLocation } from '@/lib/locations';
import { CustomerHeader } from '@/components/CustomerHeader';
import { WebAuthModal } from '@/components/WebAuthModal';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { DriverAppModal } from '@/components/DriverAppModal';
import { PromoBannerSlider } from '@/components/PromoBannerSlider';
import { TimePickerModal } from '@/components/TimePickerModal';

function format12HourTime(timeStr: string): string {
  if (!timeStr) return '';
  try {
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  } catch {
    return timeStr;
  }
}

const POPULAR_LOCATIONS = ALL_LOCATIONS.map((l) => ({ name: l.label, lat: l.lat, lng: l.lng }));

const SERVICE_CATEGORIES = [
  {
    id: 'AIRPORT',
    title: 'Airport Transfer',
    icon: (
      <svg className="w-7 h-7 text-[#f0750f]" viewBox="0 0 512 512" fill="currentColor">
        <g transform="rotate(-45 256 256)">
          <path d="M186.62 464H160a16 16 0 0 1-14.57-22.6l64.46-142.25L113.1 297l-35.3 42.77C71.07 348.23 65.7 352 52 352H34.08a17.66 17.66 0 0 1-14.7-7.06c-2.38-3.21-4.72-8.65-2.44-16.41l19.82-71c.15-.53.33-1.06.53-1.58a.4.4 0 0 0 0-.15 15 15 0 0 1-.53-1.59l-19.84-71.45c-2.15-7.61.2-12.93 2.56-16.06a16.83 16.83 0 0 1 13.6-6.7H52c10.23 0 20.16 4.59 26 12l34.57 42.05l97.32-1.44l-64.44-142A16 16 0 0 1 160 48h26.91a25 25 0 0 1 19.35 9.8l125.05 152l57.77-1.52c4.23-.23 15.95-.31 18.66-.31C463 208 496 225.94 496 256c0 9.46-3.78 27-29.07 38.16c-14.93 6.6-34.85 9.94-59.21 9.94-2.68 0-14.37-.08-18.66-.31l-57.76-1.54l-125.36 152a25 25 0 0 1-19.32 9.75" />
        </g>
      </svg>
    ),
  },
  {
    id: 'LOCAL',
    title: 'Local Rental',
    icon: (
      <svg className="w-7 h-7 text-[#f0750f]" viewBox="0 0 512 512" fill="currentColor">
        <path d="M256 48C141.13 48 48 141.13 48 256s93.13 208 208 208s208-93.13 208-208S370.87 48 256 48m96 240h-96a16 16 0 0 1-16-16V128a16 16 0 0 1 32 0v128h80a16 16 0 0 1 0 32" />
      </svg>
    ),
  },
  {
    id: 'CORPORATE',
    title: 'Corporate Travel',
    icon: (
      <svg className="w-7 h-7 text-[#f0750f]" viewBox="0 0 512 512" fill="currentColor">
        <path d="M432 112h-48V96a48.05 48.05 0 0 0-48-48H176a48.05 48.05 0 0 0-48 48v16H80a48.05 48.05 0 0 0-48 48v64h448v-64a48.05 48.05 0 0 0-48-48zM160 96a16 16 0 0 1 16-16h160a16 16 0 0 1 16 16v16H160zM32 256v144a48.05 48.05 0 0 0 48 48h352a48.05 48.05 0 0 0 48-48V256H336a16 16 0 0 1-16 16H192a16 16 0 0 1-16-16z" />
      </svg>
    ),
  },
  {
    id: 'TOUR',
    title: 'Tour & Pilgrimage',
    icon: (
      <svg className="w-7 h-7 text-[#f0750f]" viewBox="0 0 512 512" fill="currentColor">
        <path d="M432 176H320V64a48 48 0 0 0-48-48H80a48 48 0 0 0-48 48v416a16 16 0 0 0 16 16h104a8 8 0 0 0 8-8v-71.55c0-8.61 6.62-16 15.23-16.43A16 16 0 0 1 192 416v72a8 8 0 0 0 8 8h264a16 16 0 0 0 16-16V224a48 48 0 0 0-48-48M98.08 431.87a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m0-80a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m0-80a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m0-80a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m0-80a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m80 240a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m0-80a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m0-80a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m0-80a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m80 320a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m0-80a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m0-80a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m0-80a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79m0-80a16 16 0 1 1 13.79-13.79a16 16 0 0 1-13.79 13.79M444 464H320V208h112a16 16 0 0 1 16 16v236a4 4 0 0 1-4 4" />
        <path d="M400 400a16 16 0 1 0 16 16a16 16 0 0 0-16-16m0-80a16 16 0 1 0 16 16a16 16 0 0 0-16-16m0-80a16 16 0 1 0 16 16a16 16 0 0 0-16-16m-64 160a16 16 0 1 0 16 16a16 16 0 0 0-16-16m0-80a16 16 0 1 0 16 16a16 16 0 0 0-16-16m0-80a16 16 0 1 0 16 16a16 16 0 0 0-16-16" />
      </svg>
    ),
  },
];



export default function CustomerHomePage() {
  const router = useRouter();
  const { user } = useAuth();

  // Search Widget State
  const [tripType, setTripType] = useState<TripType>(TripType.ONEWAY);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);

  const [dropAddress, setDropAddress] = useState('');
  const [dropLat, setDropLat] = useState<number | null>(null);
  const [dropLng, setDropLng] = useState<number | null>(null);

  // Scheduled date & time (default empty)
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [returnDate, setReturnDate] = useState('');

  // Waypoints
  const [stops, setStops] = useState<{ id: string; address: string; lat: number; lng: number }[]>([]);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTarget, setLocationModalTarget] = useState<'PICKUP' | 'DROP' | string>('PICKUP');
  const [timeModalOpen, setTimeModalOpen] = useState(false);

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

  const handleSelectPickup = (place: PlaceLocation) => {
    setPickupAddress(place.label);
    setPickupLat(place.lat);
    setPickupLng(place.lng);
    setPickupQuery('');
    setShowPickupSuggestions(false);
  };

  const handleSelectDrop = (place: PlaceLocation) => {
    setDropAddress(place.label);
    setDropLat(place.lat);
    setDropLng(place.lng);
    setDropQuery('');
    setShowDropSuggestions(false);
  };

  const handleSelectLocation = (place: PlaceLocation) => {
    if (locationModalTarget === 'PICKUP') {
      handleSelectPickup(place);
    } else if (locationModalTarget === 'DROP') {
      handleSelectDrop(place);
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
      pickupLat: (pickupLat ?? 0).toString(),
      pickupLng: (pickupLng ?? 0).toString(),
      drop: dropAddress,
      dropLat: (dropLat ?? 0).toString(),
      dropLng: (dropLng ?? 0).toString(),
      date: scheduledDate || new Date().toISOString().split('T')[0],
      time: scheduledTime || '09:00',
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-12 sm:pb-16">
      {/* Top Header Matching Customer App */}
      <CustomerHeader onOpenAuth={() => setAuthModalOpen(true)} activeNav="home" />

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-2 sm:px-4 pt-1.5 sm:pt-3 space-y-2.5 sm:space-y-3.5">
        {/* Floating White Booking Search Card (Matching Mobile App Exact Layout) */}
        <section id="booking-card" className="bg-white rounded-2xl sm:rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 p-2.5 sm:p-4 transition-all">
          {/* Trip Type Tabs (ONE WAY vs ROUND TRIP) */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-2">
            {/* ONE WAY Tab */}
            <button
              type="button"
              onClick={() => setTripType(TripType.ONEWAY)}
              className={`flex items-center gap-2 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl text-left transition-all ${
                tripType === TripType.ONEWAY
                  ? 'bg-[#f0750f] text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
              }`}
            >
              <div
                className={`flex items-center justify-center transition-colors flex-shrink-0 ${
                  tripType === TripType.ONEWAY ? 'text-white' : 'text-slate-500'
                }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] sm:text-sm font-extrabold tracking-wide uppercase">
                  ONE WAY
                </p>
                <p
                  className={`text-[9px] sm:text-xs font-medium ${
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
              className={`flex items-center gap-2 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl text-left transition-all ${
                tripType === TripType.ROUND
                  ? 'bg-[#f0750f] text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
              }`}
            >
              <div
                className={`flex items-center justify-center transition-colors flex-shrink-0 ${
                  tripType === TripType.ROUND ? 'text-white' : 'text-slate-500'
                }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12a8 8 0 0 1 14.93-4M20 4v5h-5" />
                  <path d="M20 12a8 8 0 0 1-14.93 4M4 20v-5h5" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] sm:text-sm font-extrabold tracking-wide uppercase">
                  ROUND TRIP
                </p>
                <p
                  className={`text-[9px] sm:text-xs font-medium ${
                    tripType === TripType.ROUND ? 'text-white/85' : 'text-slate-400'
                  }`}
                >
                  Return with same cab
                </p>
              </div>
            </button>
          </div>

          {/* Locations Container with Integrated Swap Button */}
          <div className="relative space-y-1.5 mb-2">
            {/* Pickup Location Box */}
            <div ref={pickupWrapperRef} className="relative">
              <div className="flex items-center gap-2 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f] focus-within:border-transparent transition-all">
                {/* Green Pin */}
                <div className="text-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 pr-1 sm:pr-2">
                  <span className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                    onFocus={() => {
                      setLocationModalTarget('PICKUP');
                      setShowPickupSuggestions(true);
                    }}
                    placeholder="Enter pickup location"
                    className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none truncate placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocationModalTarget('PICKUP');
                    setLocationModalOpen(true);
                  }}
                  className="p-1 text-[#f0750f] hover:bg-orange-50 rounded-lg transition-colors flex-shrink-0"
                  title="Select on Map"
                  aria-label="Select on Map"
                >
                  <svg className="w-4 h-4 text-[#f0750f]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.43 2.57a1 1 0 00-1-.24l-18 6a1 1 0 00-.06 1.87l7.55 3.32 3.32 7.55a1 1 0 001.87-.06l6-18a1 1 0 00-.68-1.44z" />
                  </svg>
                </button>
              </div>

              {/* Autocomplete Suggestions Dropdown */}
              {showPickupSuggestions && filteredPickupLocations.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden divide-y divide-slate-50">
                  {filteredPickupLocations.map((loc) => (
                    <button
                      key={loc.label}
                      type="button"
                      onClick={() => handleSelectPickup(loc)}
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
            <div className="absolute right-2 sm:right-4 top-[50%] -translate-y-1/2 z-20">
              <button
                type="button"
                onClick={handleSwapLocations}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:text-[#f0750f] transition-all active:scale-95"
                title="Swap Pickup and Drop"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* Drop Location Box */}
            <div ref={dropWrapperRef} className="relative">
              <div className="flex items-center gap-2 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f] focus-within:border-transparent transition-all">
                {/* Red Pin */}
                <div className="text-red-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 pr-1 sm:pr-2">
                  <span className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
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
                    onFocus={() => {
                      setLocationModalTarget('DROP');
                      setShowDropSuggestions(true);
                    }}
                    placeholder="Enter drop location"
                    className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none truncate placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLocationModalTarget('DROP');
                    setLocationModalOpen(true);
                  }}
                  className="p-1 text-[#f0750f] hover:bg-orange-50 rounded-lg transition-colors flex-shrink-0"
                  title="Select on Map"
                  aria-label="Select on Map"
                >
                  <svg className="w-4 h-4 text-[#f0750f]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.43 2.57a1 1 0 00-1-.24l-18 6a1 1 0 00-.06 1.87l7.55 3.32 3.32 7.55a1 1 0 001.87-.06l6-18a1 1 0 00-.68-1.44z" />
                  </svg>
                </button>
              </div>

              {/* Drop Autocomplete Suggestions */}
              {showDropSuggestions && filteredDropLocations.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden divide-y divide-slate-50">
                  {filteredDropLocations.map((loc) => (
                    <button
                      key={loc.label}
                      type="button"
                      onClick={() => handleSelectDrop(loc)}
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
              className="flex items-center gap-2 p-1.5 sm:p-2 mb-1.5 rounded-xl bg-orange-50/70 border border-orange-100 text-xs"
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
          <div className="mb-2">
            <button
              type="button"
              onClick={handleAddStop}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] sm:text-xs font-semibold shadow-sm transition-all"
            >
              <span className="text-[#f0750f] font-bold text-xs sm:text-sm">+</span> Add a Stop
            </button>
          </div>

          {/* Schedule Row (Date & Time) */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-2.5">
            {/* Trip Start Date */}
            <div className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
              <div className="flex items-center gap-1 text-slate-400 mb-0.5">
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
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

            {/* Pickup Time (12-Hour) */}
            <div
              onClick={() => setTimeModalOpen(true)}
              className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-[#f0750f]/50 cursor-pointer focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f] transition-all select-none"
            >
              <div className="flex items-center gap-1 text-slate-400 mb-0.5">
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                  PICKUP TIME
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-xs sm:text-sm font-semibold truncate ${scheduledTime ? 'text-slate-900' : 'text-slate-400'}`}>
                  {scheduledTime ? format12HourTime(scheduledTime) : 'Select Time'}
                </span>
                <span className="text-[9px] sm:text-[10px] text-[#f0750f] font-bold uppercase ml-1 flex-shrink-0">
                  {scheduledTime ? 'Change' : 'Set'}
                </span>
              </div>
            </div>

            {/* If Round Trip: Return Date Row */}
            {tripType === TripType.ROUND && (
              <div className="col-span-2 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                <div className="flex items-center gap-1 text-slate-400 mb-0.5">
                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
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
            className="w-full py-2.5 sm:py-3 px-4 rounded-xl sm:rounded-2xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 text-xs sm:text-base tracking-wide uppercase"
          >
            <span>BOOK YOUR RIDE</span>
            <span className="text-base sm:text-xl leading-none">→</span>
          </button>
        </section>

        {/* 4-Card Quick Category Grid (Matching Screenshot) */}
        <section className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className="bg-white hover:bg-slate-50 active:scale-95 transition-all p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center group"
            >
              <div className="text-xl sm:text-3xl flex items-center justify-center mb-1">
                {cat.icon}
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-800 leading-tight">
                {cat.title}
              </span>
            </button>
          ))}
        </section>

        {/* Interactive Promotional Banner Carousel Slider */}
        <PromoBannerSlider onSelectCategory={handleCategorySelect} />

        {/* 24/7 Help & Support Card (Matching Screenshot) */}
        <section className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-emerald-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                24/7 Help & Support
              </h4>
              <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                Need assistance with your ride?
              </p>
            </div>
          </div>
          <a
            href="tel:+919481086058"
            className="bg-[#162232] hover:bg-slate-800 text-white text-[11px] sm:text-xs font-bold px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl transition-all shadow-sm flex items-center gap-1 flex-shrink-0"
          >
            Get Help &gt;
          </a>
        </section>


      </main>



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

      {/* 12-Hour Time Picker Modal */}
      <TimePickerModal
        isOpen={timeModalOpen}
        onClose={() => setTimeModalOpen(false)}
        onSelectTime={(t) => setScheduledTime(t)}
        currentTime={scheduledTime}
        title="Select Pickup Time"
      />
    </div>
  );
}
