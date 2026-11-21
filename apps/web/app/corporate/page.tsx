'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TripType, VehicleCategory } from '@kandy-cabs/shared';
import { PlaceLocation } from '@/lib/locations';
import { CustomerHeader } from '@/components/CustomerHeader';
import { LocationPickerModal } from '@/components/LocationPickerModal';
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

export default function CorporateTravelPage() {
  const router = useRouter();

  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);

  const [dropAddress, setDropAddress] = useState('');
  const [dropLat, setDropLat] = useState<number | null>(null);
  const [dropLng, setDropLng] = useState<number | null>(null);

  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  const [stops, setStops] = useState<{ id: string; address: string; lat: number; lng: number }[]>([]);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTarget, setLocationModalTarget] = useState<'PICKUP' | 'DROP' | string>('PICKUP');
  const [timeModalOpen, setTimeModalOpen] = useState(false);

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

  const handleBookYourRide = () => {
    if (!pickupAddress.trim()) {
      alert('Please enter a pickup location');
      return;
    }
    if (!dropAddress.trim()) {
      alert('Please enter a destination drop location');
      return;
    }

    const params = new URLSearchParams({
      step: '2',
      tripType: 'CORPORATE',
      pickup: pickupAddress,
      pickupLat: (pickupLat ?? 0).toString(),
      pickupLng: (pickupLng ?? 0).toString(),
      drop: dropAddress,
      dropLat: (dropLat ?? 0).toString(),
      dropLng: (dropLng ?? 0).toString(),
      date: scheduledDate || new Date().toISOString().split('T')[0],
      time: scheduledTime || '09:00',
      category: VehicleCategory.SEDAN,
    });

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
      <CustomerHeader activeNav="home" />

      <main className="max-w-2xl mx-auto px-3 sm:px-6 pt-3 space-y-4">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="flex items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#f0750f] bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-xs active:scale-95 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Card 1: Details (Matches User Reference Image 3) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#f0750f]">
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 512 512" fill="currentColor">
                <path d="M432 112h-48V96a48.05 48.05 0 0 0-48-48H176a48.05 48.05 0 0 0-48 48v16H80a48.05 48.05 0 0 0-48 48v64h448v-64a48.05 48.05 0 0 0-48-48zM160 96a16 16 0 0 1 16-16h160a16 16 0 0 1 16 16v16H160zM32 256v144a48.05 48.05 0 0 0 48 48h352a48.05 48.05 0 0 0 48-48V256H336a16 16 0 0 1-16 16H192a16 16 0 0 1-16-16z" />
              </svg>
              <h3 className="text-base font-extrabold text-[#f0750f]">Corporate Travel</h3>
            </div>
            <button
              type="button"
              onClick={handleSwapLocations}
              className="w-7 h-7 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-[#f0750f] active:scale-95 transition-all shadow-xs"
              title="Swap Locations"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* Pickup Location */}
          <div>
            <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
              PICKUP LOCATION
            </span>
            <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
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
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400 truncate"
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
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Destination Drop */}
          <div>
            <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
              DESTINATION DROP
            </span>
            <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f]">
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
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400 truncate"
              />
              <button
                type="button"
                onClick={() => {
                  setLocationModalTarget('DROP');
                  setLocationModalOpen(true);
                }}
                className="text-slate-400 hover:text-[#f0750f] p-0.5 flex-shrink-0"
                title="Select on Map"
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
              <span className="text-[#f0750f] font-bold text-sm">+</span> Add a Stop
            </button>
          </div>

          {/* Stops List */}
          {stops.map((stop, index) => (
            <div key={stop.id} className="flex items-center gap-2 p-2 rounded-xl bg-orange-50 border border-orange-100 text-xs">
              <span className="font-bold text-[#f0750f]">{index + 1}. Stop:</span>
              <span className="flex-1 truncate text-slate-800">{stop.address || 'Click to select'}</span>
              <button
                type="button"
                onClick={() => {
                  setLocationModalTarget(stop.id);
                  setLocationModalOpen(true);
                }}
                className="text-[#f0750f] font-semibold underline"
              >
                Change
              </button>
              <button type="button" onClick={() => handleRemoveStop(stop.id)} className="text-red-500 font-bold ml-1">✕</button>
            </div>
          ))}
        </div>

        {/* Card 2: Schedule (Matches User Reference Image 3) */}
        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-4 pb-9 space-y-3">
          <div className="flex items-center gap-1.5 text-[#f0750f]">
            <svg className="w-4 h-4 text-[#f0750f]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
            </svg>
            <h4 className="text-xs sm:text-sm font-extrabold text-[#f0750f]">Schedule</h4>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="block text-[9px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                PICKUP DATE
              </span>
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <div className="flex items-center gap-1.5 truncate">
                  <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className={`text-xs sm:text-sm font-semibold truncate ${scheduledDate ? 'text-slate-900' : 'text-slate-400'}`}>
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
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-xs sm:text-sm font-semibold truncate ${scheduledTime ? 'text-slate-900' : 'text-slate-400'}`}>
                    {scheduledTime ? format12HourTime(scheduledTime) : 'Select Time'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Pickup Indicator Badge */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-orange-50/70 border border-orange-100 text-xs">
            <span className="font-semibold text-slate-700">Primary Pickup</span>
            <span className="font-bold text-[#f0750f]">
              {scheduledTime ? format12HourTime(scheduledTime) : '9:00 AM'}
            </span>
          </div>

          {/* Centered Straddling Book Button */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20">
            <button
              type="button"
              onClick={handleBookYourRide}
              className="py-3 px-10 rounded-xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 text-xs sm:text-sm tracking-wider uppercase whitespace-nowrap"
            >
              <span>BOOK YOUR RIDE</span>
              <span className="text-base sm:text-lg leading-none">→</span>
            </button>
          </div>
        </div>


      </main>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        targetType={locationModalTarget === 'PICKUP' ? 'PICKUP' : locationModalTarget === 'DROP' ? 'DROP' : 'STOP'}
        selectedAddress={locationModalTarget === 'PICKUP' ? pickupAddress : dropAddress}
        onSelectLocation={handleSelectLocation}
        title={locationModalTarget === 'PICKUP' ? 'Select Pickup Location' : 'Select Destination'}
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
