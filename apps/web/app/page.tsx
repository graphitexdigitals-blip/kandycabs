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



type TabCategory = 'ONEWAY' | 'ROUND' | 'LOCAL' | 'AIRPORT' | 'CORPORATE' | 'TOUR';

const DESKTOP_TABS = [
  { id: 'ONEWAY' as const, title: 'ONE WAY' },
  { id: 'ROUND' as const, title: 'ROUND TRIP' },
  { id: 'LOCAL' as const, title: 'LOCAL RENTAL' },
  { id: 'AIRPORT' as const, title: 'AIRPORT' },
  { id: 'CORPORATE' as const, title: 'CORPORATE' },
  { id: 'TOUR' as const, title: 'TOUR' },
];

const POPULAR_AIRPORTS = [
  'Mangaluru Airport (IXE)',
  'Kempegowda Intl Airport Bengaluru (BLR)',
  'Kannur International Airport (CNN)',
  'Calicut International Airport (CCJ)',
  'Cochin International Airport (COK)',
  'Manohar Intl Airport, Goa (GOX)',
  'Dabolim Airport, Goa (GOI)',
];

const LOCAL_RENTAL_PACKAGES = [
  { id: '4_40', hours: 4, km: 40, label: '4 Hours', sublabel: '40 km included' },
  { id: '8_80', hours: 8, km: 80, label: '8 Hours', sublabel: '80 km included' },
  { id: '12_120', hours: 12, km: 120, label: '12 Hours', sublabel: '120 km included' },
];

export default function CustomerHomePage() {
  const router = useRouter();
  const { user } = useAuth();

  // Search Widget State
  const [activeTab, setActiveTab] = useState<TabCategory>('ONEWAY');
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
  const [returnTime, setReturnTime] = useState('');

  // Specialized Service States
  const [flightNumber, setFlightNumber] = useState('');
  const [selectedAirport, setSelectedAirport] = useState('Mangaluru Airport (IXE)');
  const [airportDropdownOpen, setAirportDropdownOpen] = useState(false);
  const [localPackage, setLocalPackage] = useState<'4_40' | '8_80' | '12_120'>('8_80');

  // Waypoints
  const [stops, setStops] = useState<{ id: string; address: string; lat: number; lng: number }[]>([]);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTarget, setLocationModalTarget] = useState<'PICKUP' | 'DROP' | string>('PICKUP');
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [returnTimeModalOpen, setReturnTimeModalOpen] = useState(false);

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
    const effectiveDrop =
      activeTab === 'AIRPORT'
        ? selectedAirport
        : activeTab === 'LOCAL'
        ? `Local Rental (${localPackage === '4_40' ? '4 Hrs / 40 km' : localPackage === '12_120' ? '12 Hrs / 120 km' : '8 Hrs / 80 km'})`
        : dropAddress;

    if (!effectiveDrop.trim()) {
      alert('Please enter a destination or drop location');
      return;
    }

    const params = new URLSearchParams({
      step: '2',
      tripType: activeTab === 'CORPORATE' ? 'CORPORATE' : tripType,
      pickup: pickupAddress,
      pickupLat: (pickupLat ?? 0).toString(),
      pickupLng: (pickupLng ?? 0).toString(),
      drop: effectiveDrop,
      dropLat: (dropLat ?? 0).toString(),
      dropLng: (dropLng ?? 0).toString(),
      date: scheduledDate || new Date().toISOString().split('T')[0],
      time: scheduledTime || '09:00',
      category: selectedCat || VehicleCategory.SEDAN,
    });

    if (flightNumber) {
      params.set('flightNumber', flightNumber);
    }
    if (activeTab === 'LOCAL') {
      params.set('localPackage', localPackage);
    }
    if (tripType === TripType.ROUND || tripType === TripType.PACKAGE || activeTab === 'ROUND' || activeTab === 'TOUR') {
      params.set('returnDate', returnDate);
      if (returnTime) params.set('returnTime', returnTime);
    }

    if (stops.length > 0) {
      params.set('stops', JSON.stringify(stops));
    }

    router.push(`/booking?${params.toString()}`);
  };

  const handleTabClick = (tabId: TabCategory) => {
    setActiveTab(tabId);
    if (tabId === 'ONEWAY') {
      setTripType(TripType.ONEWAY);
    } else if (tabId === 'ROUND') {
      setTripType(TripType.ROUND);
    } else {
      handleCategorySelect(tabId);
    }
  };

  const handleCategorySelect = (catId: string) => {
    setActiveTab(catId as TabCategory);
    if (catId === 'AIRPORT') {
      setSelectedAirport('Mangaluru Airport (IXE)');
      setTripType(TripType.AIRPORT);
    } else if (catId === 'LOCAL') {
      setTripType(TripType.LOCAL);
    } else if (catId === 'CORPORATE') {
      setTripType(TripType.ONEWAY);
    } else if (catId === 'TOUR') {
      if (!dropAddress || dropAddress.includes('Airport') || dropAddress.includes('Local')) {
        setDropAddress('Kollur Mookambika Temple');
        setDropLat(13.8655);
        setDropLng(74.8142);
      }
      setTripType(TripType.PACKAGE);
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
      <main className="max-w-6xl xl:max-w-7xl mx-auto px-2 sm:px-4 md:px-6 pt-1.5 sm:pt-3 space-y-2.5 sm:space-y-4">
        
        {/* ======================================================== */}
        {/* DESKTOP VIEW (Excluding Mobile): Unified 6-Tab Single Card */}
        {/* ======================================================== */}
        <section id="booking-card" className="hidden md:block relative bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 p-5 pb-8 mb-8 transition-all">
          {/* Merged Single-Bar Segmented Tabs */}
          <div className="flex w-full rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-3 bg-white">
            {DESKTOP_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex-1 py-3 px-2 text-center font-extrabold uppercase tracking-wide text-xs lg:text-sm whitespace-nowrap transition-all border-r last:border-r-0 ${
                    isActive
                      ? 'bg-[#f0750f] text-white border-[#f0750f]'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {tab.title}
                </button>
              );
            })}
          </div>

          {/* Locations Container with Integrated Swap Button */}
          <div className="relative space-y-1.5 mb-2">
            {/* Pickup Location Box */}
            <div ref={pickupWrapperRef} className="relative">
              <div className="flex items-center gap-2 p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f] focus-within:border-transparent transition-all">
                <div className="text-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <span className="block text-[10px] font-extrabold text-black uppercase tracking-wider">
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
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none truncate placeholder:text-slate-400"
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

            {/* Swap Button */}
            <div className="absolute right-4 top-[50%] -translate-y-1/2 z-20">
              <button
                type="button"
                onClick={handleSwapLocations}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:text-[#f0750f] transition-all active:scale-95"
                title="Swap Pickup and Drop"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* Drop Location Box */}
            <div ref={dropWrapperRef} className="relative">
              <div className="flex items-center gap-2 p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f] focus-within:border-transparent transition-all">
                <div className="text-red-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <span className="block text-[10px] font-extrabold text-black uppercase tracking-wider">
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
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none truncate placeholder:text-slate-400"
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

          {/* Stops List */}
          {stops.map((stop, index) => (
            <div
              key={stop.id}
              className="flex items-center gap-2 p-2 mb-1.5 rounded-xl bg-orange-50/70 border border-orange-100 text-xs"
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

          {/* Add Stop Button */}
          <div className="mb-2">
            <button
              type="button"
              onClick={handleAddStop}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-all"
            >
              <span className="text-[#f0750f] font-bold text-sm">+</span> Add a Stop
            </button>
          </div>

          {/* Schedule Row */}
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div className="p-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
              <div className="flex items-center gap-1 text-black mb-0.5">
                <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-black">
                  TRIP START DATE
                </span>
              </div>
              <input
                type="date"
                value={scheduledDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={`w-full bg-transparent text-sm font-semibold focus:outline-none cursor-pointer ${
                  scheduledDate ? 'text-slate-900 font-semibold' : 'text-slate-400'
                }`}
              />
            </div>

            <div
              onClick={() => setTimeModalOpen(true)}
              className="p-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-[#f0750f]/50 cursor-pointer focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f] transition-all select-none"
            >
              <div className="flex items-center gap-1 text-black mb-0.5">
                <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-black">
                  PICKUP TIME
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold truncate ${scheduledTime ? 'text-slate-900' : 'text-slate-400'}`}>
                  {scheduledTime ? format12HourTime(scheduledTime) : 'Select Time'}
                </span>
                <span className="text-[10px] text-[#f0750f] font-bold uppercase ml-1 flex-shrink-0">
                  {scheduledTime ? 'Change' : 'Set'}
                </span>
              </div>
            </div>

            {(tripType === TripType.ROUND || tripType === TripType.PACKAGE || activeTab === 'ROUND' || activeTab === 'TOUR') && (
              <div className="col-span-2 p-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                <div className="flex items-center gap-1 text-black mb-0.5">
                  <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-black">
                    RETURN JOURNEY DATE
                  </span>
                </div>
                <input
                  type="date"
                  value={returnDate}
                  min={scheduledDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className={`w-full bg-transparent text-sm font-semibold focus:outline-none cursor-pointer ${
                    returnDate ? 'text-slate-900 font-semibold' : 'text-slate-400'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Centered Straddling Button */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20">
            <button
              type="button"
              onClick={() => handleBookYourRide()}
              className="py-3 px-10 rounded-xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 text-sm tracking-wider uppercase whitespace-nowrap"
            >
              <span>BOOK YOUR RIDE</span>
              <span className="text-xl leading-none">→</span>
            </button>
          </div>
        </section>

        {/* ======================================================== */}
        {/* MOBILE VIEW (Excluding Desktop): Dedicated Custom Cards  */}
        {/* ======================================================== */}
        <div className="md:hidden space-y-3 mb-6">
          {/* Top 2 Tabs (ONE WAY vs ROUND TRIP) */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleTabClick('ONEWAY')}
              className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all ${
                activeTab === 'ONEWAY'
                  ? 'bg-[#f0750f] text-white shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <div className={`flex items-center justify-center flex-shrink-0 ${activeTab === 'ONEWAY' ? 'text-white' : 'text-slate-500'}`}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase">ONE WAY</p>
                <p className={`text-[9px] font-medium ${activeTab === 'ONEWAY' ? 'text-white/85' : 'text-slate-400'}`}>Drop-off only</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTabClick('ROUND')}
              className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all ${
                activeTab === 'ROUND'
                  ? 'bg-[#f0750f] text-white shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <div className={`flex items-center justify-center flex-shrink-0 ${activeTab === 'ROUND' ? 'text-white' : 'text-slate-500'}`}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12a8 8 0 0 1 14.93-4M20 4v5h-5" />
                  <path d="M20 12a8 8 0 0 1-14.93 4M4 20v-5h5" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase">ROUND TRIP</p>
                <p className={`text-[9px] font-medium ${activeTab === 'ROUND' ? 'text-white/85' : 'text-slate-400'}`}>Return same cab</p>
              </div>
            </button>
          </div>

          {/* 1. AIRPORT TRANSFER MOBILE VIEW (Matches Reference Image 1) */}
          {activeTab === 'AIRPORT' && (
            <div className="space-y-3">
              {/* Card 1: Details */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 space-y-3">
                <div className="flex items-center gap-2 text-[#f0750f]">
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                  </svg>
                  <h3 className="text-sm font-extrabold text-[#f0750f]">Airport Transfer</h3>
                </div>

                {/* Pickup Location */}
                <div>
                  <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    PICKUP LOCATION
                  </span>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                    <div className="text-emerald-500 flex-shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      placeholder="Enter pickup location"
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400 truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLocationModalTarget('PICKUP');
                        setLocationModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-[#f0750f] p-0.5 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Destination Airport */}
                <div className="relative">
                  <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    DESTINATION AIRPORT
                  </span>
                  <div
                    onClick={() => setAirportDropdownOpen(!airportDropdownOpen)}
                    className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white cursor-pointer select-none"
                  >
                    <div className="text-red-500 flex-shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                      </svg>
                    </div>
                    <span className="flex-1 text-xs font-semibold text-slate-800 truncate">
                      {selectedAirport || 'Select destination airport'}
                    </span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${airportDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {airportDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      {POPULAR_AIRPORTS.map((airport) => (
                        <button
                          key={airport}
                          type="button"
                          onClick={() => {
                            setSelectedAirport(airport);
                            setAirportDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 transition-colors ${
                            selectedAirport === airport ? 'bg-orange-50 text-[#f0750f]' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                          </svg>
                          <span className="truncate">{airport}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Flight No + Add Stop Row */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={flightNumber}
                    onChange={(e) => setFlightNumber(e.target.value)}
                    placeholder="Flight no. (optional)"
                    className="flex-1 min-w-0 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#f0750f]"
                  />
                  <button
                    type="button"
                    onClick={handleAddStop}
                    className="bg-[#162232] hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1 flex-shrink-0 transition-all shadow-sm"
                  >
                    <span>+</span> Add a Stop
                  </button>
                </div>

                {/* Stops Display if any */}
                {stops.map((stop, index) => (
                  <div key={stop.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-orange-50 border border-orange-100 text-xs">
                    <span className="font-bold text-[#f0750f]">{index + 1}. Stop:</span>
                    <span className="flex-1 truncate text-slate-800">{stop.address || 'Select Stop'}</span>
                    <button type="button" onClick={() => handleRemoveStop(stop.id)} className="text-red-500 font-bold ml-1">✕</button>
                  </div>
                ))}
              </div>

              {/* Card 2: Trip Schedule + Straddling Book Button */}
              <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 pb-8">
                <div className="flex items-center gap-1.5 text-[#f0750f] mb-3">
                  <svg className="w-4 h-4 text-[#f0750f]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                  </svg>
                  <h4 className="text-xs font-extrabold text-[#f0750f]">Trip Schedule</h4>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  {/* Pickup Date */}
                  <div className="relative">
                    <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      PICKUP DATE
                    </span>
                    <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/70">
                      <div className="flex items-center gap-1.5 truncate">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className={`text-xs font-semibold truncate ${scheduledDate ? 'text-slate-900' : 'text-slate-400'}`}>
                          {scheduledDate || 'Select Date'}
                        </span>
                      </div>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <input
                        type="date"
                        value={scheduledDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Pickup Time */}
                  <div>
                    <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      PICKUP TIME
                    </span>
                    <div
                      onClick={() => setTimeModalOpen(true)}
                      className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className={`text-xs font-semibold truncate ${scheduledTime ? 'text-slate-900' : 'text-slate-400'}`}>
                          {scheduledTime ? format12HourTime(scheduledTime) : 'Select Time'}
                        </span>
                      </div>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Straddling Button */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20">
                  <button
                    type="button"
                    onClick={() => handleBookYourRide()}
                    className="py-2.5 px-8 rounded-xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 text-xs tracking-wider uppercase whitespace-nowrap"
                  >
                    <span>BOOK YOUR RIDE</span>
                    <span className="text-base leading-none">→</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. LOCAL RENTAL MOBILE VIEW (Matches Reference Image 2) */}
          {activeTab === 'LOCAL' && (
            <div className="space-y-3">
              {/* Card 1: Details */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 space-y-3">
                <div className="flex items-center gap-2 text-[#f0750f]">
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 512 512" fill="currentColor">
                    <path d="M256 48C141.13 48 48 141.13 48 256s93.13 208 208 208s208-93.13 208-208S370.87 48 256 48m96 240h-96a16 16 0 0 1-16-16V128a16 16 0 0 1 32 0v128h80a16 16 0 0 1 0 32" />
                  </svg>
                  <h3 className="text-sm font-extrabold text-[#f0750f]">Local Rental</h3>
                </div>

                {/* Pickup Location */}
                <div>
                  <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    PICKUP LOCATION
                  </span>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                    <div className="text-emerald-500 flex-shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      placeholder="Enter pickup location"
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400 truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLocationModalTarget('PICKUP');
                        setLocationModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-[#f0750f] p-0.5 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Rental Duration & Distance Segmented Options */}
                <div>
                  <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    RENTAL DURATION & DISTANCE
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: '4_40', label: '4 Hours / 40 km' },
                      { id: '8_80', label: '8 Hours / 80 km' },
                      { id: '12_120', label: '12 Hours / 120 km' },
                    ].map((pkg) => {
                      const isSelected = localPackage === pkg.id;
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setLocalPackage(pkg.id as any)}
                          className={`p-2 rounded-xl text-center text-[10px] font-bold leading-tight transition-all border ${
                            isSelected
                              ? 'bg-[#f0750f] text-white border-[#f0750f] shadow-sm'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {pkg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Card 2: Trip Schedule + Straddling Button */}
              <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 pb-8">
                <div className="flex items-center gap-1.5 text-[#f0750f] mb-3">
                  <svg className="w-4 h-4 text-[#f0750f]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                  </svg>
                  <h4 className="text-xs font-extrabold text-[#f0750f]">Trip Schedule</h4>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="relative">
                    <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      PICKUP DATE
                    </span>
                    <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/70">
                      <div className="flex items-center gap-1.5 truncate">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className={`text-xs font-semibold truncate ${scheduledDate ? 'text-slate-900' : 'text-slate-400'}`}>
                          {scheduledDate || 'Select Date'}
                        </span>
                      </div>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <input
                        type="date"
                        value={scheduledDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      PICKUP TIME
                    </span>
                    <div
                      onClick={() => setTimeModalOpen(true)}
                      className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className={`text-xs font-semibold truncate ${scheduledTime ? 'text-slate-900' : 'text-slate-400'}`}>
                          {scheduledTime ? format12HourTime(scheduledTime) : 'Select Time'}
                        </span>
                      </div>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Straddling Button */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20">
                  <button
                    type="button"
                    onClick={() => handleBookYourRide()}
                    className="py-2.5 px-8 rounded-xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 text-xs tracking-wider uppercase whitespace-nowrap"
                  >
                    <span>BOOK YOUR RIDE</span>
                    <span className="text-base leading-none">→</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. CORPORATE TRAVEL MOBILE VIEW (Matches Reference Image 3) */}
          {activeTab === 'CORPORATE' && (
            <div className="space-y-3">
              {/* Card 1: Details */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#f0750f]">
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 512 512" fill="currentColor">
                      <path d="M432 112h-48V96a48.05 48.05 0 0 0-48-48H176a48.05 48.05 0 0 0-48 48v16H80a48.05 48.05 0 0 0-48 48v64h448v-64a48.05 48.05 0 0 0-48-48zM160 96a16 16 0 0 1 16-16h160a16 16 0 0 1 16 16v16H160zM32 256v144a48.05 48.05 0 0 0 48 48h352a48.05 48.05 0 0 0 48-48V256H336a16 16 0 0 1-16 16H192a16 16 0 0 1-16-16z" />
                    </svg>
                    <h3 className="text-sm font-extrabold text-[#f0750f]">Corporate Travel</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwapLocations}
                    className="w-7 h-7 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#f0750f] active:scale-95 transition-all shadow-xs"
                    title="Swap"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                </div>

                {/* Pickup Location */}
                <div>
                  <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    PICKUP LOCATION
                  </span>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                    <div className="text-emerald-500 flex-shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      placeholder="Enter pickup location"
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400 truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLocationModalTarget('PICKUP');
                        setLocationModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-[#f0750f] p-0.5 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Destination Drop */}
                <div>
                  <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    DESTINATION DROP
                  </span>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                    <div className="text-red-500 flex-shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={dropAddress}
                      onChange={(e) => setDropAddress(e.target.value)}
                      placeholder="Enter drop location"
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400 truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLocationModalTarget('DROP');
                        setLocationModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-[#f0750f] p-0.5 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Add a Stop */}
                <div>
                  <button
                    type="button"
                    onClick={handleAddStop}
                    className="inline-flex items-center gap-1 text-slate-700 text-xs font-semibold hover:text-[#f0750f]"
                  >
                    <span className="text-[#f0750f] font-bold">+</span> Add a Stop
                  </button>
                </div>
              </div>

              {/* Card 2: Schedule + Straddling Button */}
              <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 pb-8 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[#f0750f]">
                  <svg className="w-4 h-4 text-[#f0750f]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                  </svg>
                  <h4 className="text-xs font-extrabold text-[#f0750f]">Schedule</h4>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      PICKUP DATE
                    </span>
                    <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/70">
                      <div className="flex items-center gap-1.5 truncate">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className={`text-xs font-semibold truncate ${scheduledDate ? 'text-slate-900' : 'text-slate-400'}`}>
                          {scheduledDate || 'Select Date'}
                        </span>
                      </div>
                      <input
                        type="date"
                        value={scheduledDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      ADD PICKUP TIME
                    </span>
                    <div
                      onClick={() => setTimeModalOpen(true)}
                      className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className={`text-xs font-semibold truncate ${scheduledTime ? 'text-slate-900' : 'text-slate-400'}`}>
                          {scheduledTime ? format12HourTime(scheduledTime) : 'Select Time'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Pickup Indicator */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-orange-50/60 border border-orange-100 text-xs">
                  <span className="font-semibold text-slate-700">Primary Pickup</span>
                  <span className="font-bold text-[#f0750f]">
                    {scheduledTime ? format12HourTime(scheduledTime) : '9:00 AM'}
                  </span>
                </div>

                {/* Straddling Button */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20">
                  <button
                    type="button"
                    onClick={() => handleBookYourRide()}
                    className="py-2.5 px-8 rounded-xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 text-xs tracking-wider uppercase whitespace-nowrap"
                  >
                    <span>BOOK YOUR RIDE</span>
                    <span className="text-base leading-none">→</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. TOUR & PILGRIMAGE MOBILE VIEW (Matches Reference Image 4) */}
          {activeTab === 'TOUR' && (
            <div className="space-y-3">
              {/* Card 1: Details */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#f0750f]">
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 512 512" fill="currentColor">
                      <path d="M432 176H320V64a48 48 0 0 0-48-48H80a48 48 0 0 0-48 48v416a16 16 0 0 0 16 16h104a8 8 0 0 0 8-8v-71.55c0-8.61 6.62-16 15.23-16.43A16 16 0 0 1 192 416v72a8 8 0 0 0 8 8h264a16 16 0 0 0 16-16V224a48 48 0 0 0-48-48" />
                    </svg>
                    <h3 className="text-sm font-extrabold text-[#f0750f]">Tour & Pilgrimage</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwapLocations}
                    className="w-7 h-7 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#f0750f] active:scale-95 transition-all shadow-xs"
                    title="Swap"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                </div>

                {/* Pickup Location */}
                <div>
                  <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    PICKUP LOCATION
                  </span>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                    <div className="text-emerald-500 flex-shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      placeholder="Enter pickup location"
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400 truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLocationModalTarget('PICKUP');
                        setLocationModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-[#f0750f] p-0.5 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Destination Drop */}
                <div>
                  <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    DESTINATION DROP
                  </span>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                    <div className="text-red-500 flex-shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={dropAddress}
                      onChange={(e) => setDropAddress(e.target.value)}
                      placeholder="Enter drop location"
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400 truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLocationModalTarget('DROP');
                        setLocationModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-[#f0750f] p-0.5 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Add a Stop */}
                <div>
                  <button
                    type="button"
                    onClick={handleAddStop}
                    className="inline-flex items-center gap-1 text-slate-700 text-xs font-semibold hover:text-[#f0750f]"
                  >
                    <span className="text-[#f0750f] font-bold">+</span> Add a Stop
                  </button>
                </div>
              </div>

              {/* Card 2: Schedule (Departure & Return Rows) + Straddling Button */}
              <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 pb-8 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[#f0750f]">
                  <svg className="w-4 h-4 text-[#f0750f]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                  </svg>
                  <h4 className="text-xs font-extrabold text-[#f0750f]">Trip Schedule</h4>
                </div>

                {/* Row 1: Departure Date & Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      DEPARTURE DATE
                    </span>
                    <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/70">
                      <div className="flex items-center gap-1.5 truncate">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className={`text-xs font-semibold truncate ${scheduledDate ? 'text-slate-900' : 'text-slate-400'}`}>
                          {scheduledDate || 'Select Date'}
                        </span>
                      </div>
                      <input
                        type="date"
                        value={scheduledDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      DEPARTURE TIME
                    </span>
                    <div
                      onClick={() => setTimeModalOpen(true)}
                      className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className={`text-xs font-semibold truncate ${scheduledTime ? 'text-slate-900' : 'text-slate-400'}`}>
                          {scheduledTime ? format12HourTime(scheduledTime) : 'Select Time'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Return Date & Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      RETURN DATE
                    </span>
                    <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/70">
                      <div className="flex items-center gap-1.5 truncate">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className={`text-xs font-semibold truncate ${returnDate ? 'text-slate-900' : 'text-slate-400'}`}>
                          {returnDate || 'Select Date'}
                        </span>
                      </div>
                      <input
                        type="date"
                        value={returnDate}
                        min={scheduledDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      RETURN TIME
                    </span>
                    <div
                      onClick={() => setReturnTimeModalOpen(true)}
                      className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className={`text-xs font-semibold truncate ${returnTime ? format12HourTime(returnTime) : 'Select Time'}`}>
                          {returnTime ? format12HourTime(returnTime) : 'Select Time'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Straddling Button */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20">
                  <button
                    type="button"
                    onClick={() => handleBookYourRide()}
                    className="py-2.5 px-8 rounded-xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 text-xs tracking-wider uppercase whitespace-nowrap"
                  >
                    <span>BOOK YOUR RIDE</span>
                    <span className="text-base leading-none">→</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. DEFAULT MOBILE VIEW: ONE WAY & ROUND TRIP */}
          {(activeTab === 'ONEWAY' || activeTab === 'ROUND') && (
            <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 pb-8 space-y-2.5">
              {/* Pickup & Drop with Swap */}
              <div className="relative space-y-1.5">
                {/* Pickup */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                  <div className="text-emerald-500 flex-shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 pr-1">
                    <span className="block text-[9px] font-extrabold text-black uppercase tracking-wider">
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
                      placeholder="Enter pickup location"
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none truncate placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationModalTarget('PICKUP');
                      setLocationModalOpen(true);
                    }}
                    className="p-1 text-[#f0750f] hover:bg-orange-50 rounded-lg flex-shrink-0"
                  >
                    <svg className="w-4 h-4 text-[#f0750f]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21.43 2.57a1 1 0 00-1-.24l-18 6a1 1 0 00-.06 1.87l7.55 3.32 3.32 7.55a1 1 0 001.87-.06l6-18a1 1 0 00-.68-1.44z" />
                    </svg>
                  </button>
                </div>

                {/* Floating Swap Button */}
                <div className="absolute right-2 top-[50%] -translate-y-1/2 z-20">
                  <button
                    type="button"
                    onClick={handleSwapLocations}
                    className="w-7 h-7 rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:text-[#f0750f] active:scale-95 transition-all"
                    title="Swap"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                </div>

                {/* Drop */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
                  <div className="text-red-500 flex-shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 pr-1">
                    <span className="block text-[9px] font-extrabold text-black uppercase tracking-wider">
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
                      placeholder="Enter drop location"
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none truncate placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationModalTarget('DROP');
                      setLocationModalOpen(true);
                    }}
                    className="p-1 text-[#f0750f] hover:bg-orange-50 rounded-lg flex-shrink-0"
                  >
                    <svg className="w-4 h-4 text-[#f0750f]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21.43 2.57a1 1 0 00-1-.24l-18 6a1 1 0 00-.06 1.87l7.55 3.32 3.32 7.55a1 1 0 001.87-.06l6-18a1 1 0 00-.68-1.44z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Add a Stop */}
              <div>
                <button
                  type="button"
                  onClick={handleAddStop}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold shadow-sm transition-all"
                >
                  <span className="text-[#f0750f] font-bold text-xs">+</span> Add a Stop
                </button>
              </div>

              {/* Stops list if any */}
              {stops.map((stop, index) => (
                <div key={stop.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-orange-50 border border-orange-100 text-xs">
                  <span className="font-bold text-[#f0750f]">{index + 1}. Stop:</span>
                  <span className="flex-1 truncate text-slate-800">{stop.address || 'Select Stop'}</span>
                  <button type="button" onClick={() => handleRemoveStop(stop.id)} className="text-red-500 font-bold ml-1">✕</button>
                </div>
              ))}

              {/* Dates & Times */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="p-2 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="flex items-center gap-1 text-black mb-0.5">
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-black">
                      TRIP START DATE
                    </span>
                  </div>
                  <input
                    type="date"
                    value={scheduledDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className={`w-full bg-transparent text-xs font-semibold focus:outline-none cursor-pointer ${
                      scheduledDate ? 'text-slate-900 font-semibold' : 'text-slate-400'
                    }`}
                  />
                </div>

                <div
                  onClick={() => setTimeModalOpen(true)}
                  className="p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1 text-black mb-0.5">
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-black">
                      PICKUP TIME
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold truncate ${scheduledTime ? 'text-slate-900' : 'text-slate-400'}`}>
                      {scheduledTime ? format12HourTime(scheduledTime) : 'Select Time'}
                    </span>
                    <span className="text-[9px] text-[#f0750f] font-bold uppercase ml-1 flex-shrink-0">
                      {scheduledTime ? 'Change' : 'Set'}
                    </span>
                  </div>
                </div>

                {activeTab === 'ROUND' && (
                  <div className="col-span-2 p-2 rounded-xl border border-slate-200 bg-slate-50/70">
                    <div className="flex items-center gap-1 text-black mb-0.5">
                      <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-black">
                        RETURN JOURNEY DATE
                      </span>
                    </div>
                    <input
                      type="date"
                      value={returnDate}
                      min={scheduledDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className={`w-full bg-transparent text-xs font-semibold focus:outline-none cursor-pointer ${
                        returnDate ? 'text-slate-900 font-semibold' : 'text-slate-400'
                      }`}
                    />
                  </div>
                )}
              </div>

              {/* Centered Straddling Button */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20">
                <button
                  type="button"
                  onClick={() => handleBookYourRide()}
                  className="py-2.5 px-8 rounded-xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 text-xs tracking-wider uppercase whitespace-nowrap"
                >
                  <span>BOOK YOUR RIDE</span>
                  <span className="text-base leading-none">→</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4-Card Quick Category Grid (Mobile Only - Hidden on Desktop/Tablet, Matching Reference Image 5) */}
        <section className="grid grid-cols-4 gap-1.5 sm:gap-2.5 md:hidden">
          {SERVICE_CATEGORIES.map((cat) => {
            const isSelected = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`bg-white hover:bg-slate-50 active:scale-95 transition-all p-2 sm:p-3 rounded-xl sm:rounded-2xl border shadow-sm flex flex-col items-center justify-center text-center group ${
                  isSelected ? 'border-[#f0750f] ring-2 ring-[#f0750f]/20' : 'border-slate-100'
                }`}
              >
                <div className="text-xl sm:text-3xl flex items-center justify-center mb-1">
                  {cat.icon}
                </div>
                <span className={`text-[10px] sm:text-xs font-bold leading-tight ${isSelected ? 'text-[#f0750f]' : 'text-slate-800'}`}>
                  {cat.title}
                </span>
              </button>
            );
          })}
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

      {/* 12-Hour Time Picker Modal (Pickup) */}
      <TimePickerModal
        isOpen={timeModalOpen}
        onClose={() => setTimeModalOpen(false)}
        onSelectTime={(t) => setScheduledTime(t)}
        currentTime={scheduledTime}
        title="Select Pickup Time"
      />

      {/* 12-Hour Time Picker Modal (Return) */}
      <TimePickerModal
        isOpen={returnTimeModalOpen}
        onClose={() => setReturnTimeModalOpen(false)}
        onSelectTime={(t) => setReturnTime(t)}
        currentTime={returnTime}
        title="Select Return Time"
      />
    </div>
  );
}
