'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TripType, VehicleCategory } from '@kandy-cabs/shared';
import { ALL_LOCATIONS, PlaceLocation } from '@/lib/locations';
import { CustomerHeader } from '@/components/CustomerHeader';
import { BookingFlowHeader } from '@/components/BookingFlowHeader';
import { LocationPickerModal } from '@/components/LocationPickerModal';
import { TimePickerModal } from '@/components/TimePickerModal';

const POPULAR_AIRPORTS = [
  'Mangaluru Airport (IXE)',
  'Kempegowda Intl Airport Bengaluru (BLR)',
  'Kannur International Airport (CNN)',
  'Calicut International Airport (CCJ)',
  'Cochin International Airport (COK)',
  'Manohar Intl Airport, Goa (GOX)',
  'Dabolim Airport, Goa (GOI)',
];

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

export default function AirportBookingPage() {
  const router = useRouter();

  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);

  const [selectedAirport, setSelectedAirport] = useState('Mangaluru Airport (IXE)');
  const [airportDropdownOpen, setAirportDropdownOpen] = useState(false);
  const [flightNumber, setFlightNumber] = useState('');

  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const [stops, setStops] = useState<{ id: string; address: string; lat: number; lng: number }[]>([]);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTarget, setLocationModalTarget] = useState<'PICKUP' | string>('PICKUP');
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const pickupWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickupWrapperRef.current && !pickupWrapperRef.current.contains(event.target as Node)) {
        setShowPickupSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPickupLocations = ALL_LOCATIONS.filter((l) => {
    const q = (pickupAddress || '').toLowerCase().trim();
    if (!q) return true;
    return (
      l.label.toLowerCase().includes(q) ||
      (l.sublabel && l.sublabel.toLowerCase().includes(q))
    );
  }).slice(0, 8);

  const handleSelectLocation = (place: PlaceLocation) => {
    if (locationModalTarget === 'PICKUP') {
      setPickupAddress(place.label);
      setPickupLat(place.lat);
      setPickupLng(place.lng);
    } else {
      setStops((prev) =>
        prev.map((s) => (s.id === locationModalTarget ? { ...s, address: place.label, lat: place.lat, lng: place.lng } : s))
      );
    }
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

  const handleBookYourRide = () => {
    if (!pickupAddress.trim()) {
      alert('Please enter a pickup location');
      return;
    }
    if (!selectedAirport.trim()) {
      alert('Please select a destination airport');
      return;
    }

    const params = new URLSearchParams({
      step: '2',
      tripType: TripType.AIRPORT,
      pickup: pickupAddress,
      pickupLat: (pickupLat ?? 0).toString(),
      pickupLng: (pickupLng ?? 0).toString(),
      drop: selectedAirport,
      dropLat: '0',
      dropLng: '0',
      date: scheduledDate || new Date().toISOString().split('T')[0],
      time: scheduledTime || '09:00',
      category: VehicleCategory.SEDAN,
    });

    if (flightNumber) {
      params.set('flightNumber', flightNumber);
    }

    if (stops.length > 0) {
      const validStops = stops.filter((s) => s.address.trim());
      if (validStops.length > 0) {
        params.set('stops', JSON.stringify(validStops));
      }
    }

    router.push(`/booking?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-16">
      {/* Step 1 Booking Flow Header */}
      <BookingFlowHeader
        currentStep={1}
        title="Enter Trip Details"
        subStepLabel="Route & Schedule"
        onBack={() => router.push('/')}
      />

      <main className="max-w-2xl mx-auto px-2.5 sm:px-6 pt-3 sm:pt-4 space-y-2.5">
        {/* Card 1: Details (Matches User Reference Image 1) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2.5 space-y-2">
          <div className="flex items-center gap-2 text-[#f0750f]">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" transform="rotate(45 12 12)" />
            </svg>
            <h3 className="text-sm font-extrabold text-[#f0750f]">Airport Transfer</h3>
          </div>

          {/* Pickup Location */}
          <div ref={pickupWrapperRef} className="relative">
            <span className="block text-[8.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-0.5 leading-none">
              PICKUP LOCATION
            </span>
            <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white">
              <div className="text-emerald-500 flex-shrink-0">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => {
                  setPickupAddress(e.target.value);
                  setShowPickupSuggestions(true);
                }}
                onFocus={() => {
                  if (filteredPickupLocations.length > 0) {
                    setShowPickupSuggestions(true);
                  }
                }}
                placeholder="Enter pickup location"
                className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400 truncate leading-tight"
              />
              <button
                type="button"
                onClick={() => {
                  setLocationModalTarget('PICKUP');
                  setLocationModalOpen(true);
                }}
                className="text-slate-400 hover:text-[#f0750f] p-0.5 flex-shrink-0"
                title="Select on Map"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>

            {showPickupSuggestions && filteredPickupLocations.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden divide-y divide-slate-50 max-h-56 overflow-y-auto">
                {filteredPickupLocations.map((loc) => (
                  <button
                    key={loc.label}
                    type="button"
                    onClick={() => {
                      setPickupAddress(loc.label);
                      setPickupLat(loc.lat);
                      setPickupLng(loc.lng);
                      setShowPickupSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-900 truncate">{loc.label}</p>
                      {loc.sublabel && <p className="text-[10px] text-slate-400 truncate">{loc.sublabel}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Destination Airport */}
          <div className="relative">
            <span className="block text-[8.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-0.5 leading-none">
              DESTINATION AIRPORT
            </span>
            <div
              onClick={() => setAirportDropdownOpen(!airportDropdownOpen)}
              className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white cursor-pointer select-none"
            >
              <div className="text-red-500 flex-shrink-0">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" transform="rotate(45 12 12)" />
                </svg>
              </div>
              <span className="flex-1 text-xs font-semibold text-slate-800 truncate leading-tight">
                {selectedAirport || 'Select destination airport'}
              </span>
              <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${airportDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {airportDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {POPULAR_AIRPORTS.map((airport) => (
                  <button
                    key={airport}
                    type="button"
                    onClick={() => {
                      setSelectedAirport(airport);
                      setAirportDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center gap-2 transition-colors ${
                      selectedAirport === airport ? 'bg-orange-50 text-[#f0750f]' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" transform="rotate(45 12 12)" />
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
              className="flex-1 min-w-0 py-1.5 px-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#f0750f] leading-tight"
            />
            <button
              type="button"
              onClick={handleAddStop}
              className="bg-[#162232] hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 flex-shrink-0 transition-all shadow-xs active:scale-95"
            >
              <span>+</span> Add a Stop
            </button>
          </div>

          {/* Stops List */}
          {stops.map((stop, index) => (
            <div key={stop.id} className="flex items-center gap-1.5 p-1 rounded-lg bg-orange-50 border border-orange-100 text-xs">
              <span className="font-bold text-[#f0750f] text-[10px]">{index + 1}. Stop:</span>
              <span className="flex-1 truncate text-slate-800 text-[11px]">{stop.address || 'Click to select'}</span>
              <button
                type="button"
                onClick={() => {
                  setLocationModalTarget(stop.id);
                  setLocationModalOpen(true);
                }}
                className="text-[#f0750f] font-semibold underline text-[11px]"
              >
                Change
              </button>
              <button type="button" onClick={() => handleRemoveStop(stop.id)} className="text-red-500 font-bold ml-1 text-xs">✕</button>
            </div>
          ))}
        </div>

        {/* Card 2: Trip Schedule + Straddling Button */}
        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-3 pb-8 mb-6">
          <div className="flex items-center gap-1.5 text-[#f0750f] mb-2.5">
            <svg className="w-3.5 h-3.5 text-[#f0750f]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
            </svg>
            <h4 className="text-xs font-extrabold text-[#f0750f]">Trip Schedule</h4>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-1.5">
            {/* Pickup Date */}
            <div className="relative">
              <span className="block text-[8.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-0.5 leading-none">
                PICKUP DATE
              </span>
              <div className="flex items-center justify-between py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
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
              <span className="block text-[8.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-0.5 leading-none">
                PICKUP TIME
              </span>
              <div
                onClick={() => setTimeModalOpen(true)}
                className="flex items-center justify-between py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer"
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

          {/* Centered Straddling Book Button */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20">
            <button
              type="button"
              onClick={handleBookYourRide}
              className="py-2.5 px-8 rounded-xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-xs tracking-wider uppercase whitespace-nowrap"
            >
              <span>BOOK YOUR RIDE</span>
              <span className="text-sm leading-none">→</span>
            </button>
          </div>
        </div>


      </main>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        targetType={locationModalTarget === 'PICKUP' ? 'PICKUP' : 'STOP'}
        selectedAddress={pickupAddress}
        onSelectLocation={handleSelectLocation}
        title="Select Pickup Location"
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
