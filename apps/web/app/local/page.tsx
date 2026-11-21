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

export default function LocalRentalPage() {
  const router = useRouter();

  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);

  const [localPackage, setLocalPackage] = useState<'4_40' | '8_80' | '12_120'>('8_80');

  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [timeModalOpen, setTimeModalOpen] = useState(false);

  const handleSelectLocation = (place: PlaceLocation) => {
    setPickupAddress(place.label);
    setPickupLat(place.lat);
    setPickupLng(place.lng);
  };

  const handleBookYourRide = () => {
    if (!pickupAddress.trim()) {
      alert('Please enter a pickup location');
      return;
    }

    const pkgLabel =
      localPackage === '4_40'
        ? 'Local Rental (4 Hrs / 40 km)'
        : localPackage === '12_120'
        ? 'Local Rental (12 Hrs / 120 km)'
        : 'Local Rental (8 Hrs / 80 km)';

    const params = new URLSearchParams({
      step: '2',
      tripType: TripType.LOCAL,
      pickup: pickupAddress,
      pickupLat: (pickupLat ?? 0).toString(),
      pickupLng: (pickupLng ?? 0).toString(),
      drop: pkgLabel,
      dropLat: '0',
      dropLng: '0',
      date: scheduledDate || new Date().toISOString().split('T')[0],
      time: scheduledTime || '09:00',
      category: VehicleCategory.SEDAN,
    });

    router.push(`/booking?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-16">
      <CustomerHeader activeNav="home" />

      <main className="max-w-2xl mx-auto px-3 sm:px-6 pt-3 space-y-4">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#f0750f] bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-xs active:scale-95 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Home</span>
          </Link>
          <span className="text-xs font-extrabold text-[#f0750f] uppercase tracking-wider">
            Local Rental
          </span>
        </div>

        {/* Card 1: Details (Matches User Reference Image 2) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3.5">
          <div className="flex items-center gap-2 text-[#f0750f]">
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 512 512" fill="currentColor">
              <path d="M256 48C141.13 48 48 141.13 48 256s93.13 208 208 208s208-93.13 208-208S370.87 48 256 48m96 240h-96a16 16 0 0 1-16-16V128a16 16 0 0 1 32 0v128h80a16 16 0 0 1 0 32" />
            </svg>
            <h3 className="text-base font-extrabold text-[#f0750f]">Local Rental</h3>
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
                onClick={() => setLocationModalOpen(true)}
                className="text-slate-400 hover:text-[#f0750f] p-0.5 flex-shrink-0"
                title="Select on Map"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Rental Duration & Distance Segmented Options */}
          <div>
            <span className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
              RENTAL DURATION & DISTANCE
            </span>
            <div className="grid grid-cols-3 gap-2">
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
                    className={`py-3 px-2 rounded-xl text-center text-xs font-bold leading-tight transition-all border ${
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
        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-4 pb-9">
          <div className="flex items-center gap-1.5 text-[#f0750f] mb-3">
            <svg className="w-4 h-4 text-[#f0750f]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
            </svg>
            <h4 className="text-xs sm:text-sm font-extrabold text-[#f0750f]">Trip Schedule</h4>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* Pickup Date */}
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
              className="py-3 px-10 rounded-xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 text-xs sm:text-sm tracking-wider uppercase whitespace-nowrap"
            >
              <span>BOOK YOUR RIDE</span>
              <span className="text-base sm:text-lg leading-none">→</span>
            </button>
          </div>
        </div>

        {/* 24/7 Help & Support Card */}
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm flex items-center justify-between mt-6">
          <div className="flex items-center gap-2.5">
            <div className="text-emerald-600 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 leading-tight">Need Hourly Rental Help?</h4>
              <p className="text-[10px] text-slate-500">24/7 Customer support available</p>
            </div>
          </div>
          <a
            href="tel:+919481086058"
            className="bg-[#162232] hover:bg-slate-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all shadow-sm"
          >
            Call Support
          </a>
        </div>
      </main>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        targetType="PICKUP"
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
