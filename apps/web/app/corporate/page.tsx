'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TripType, VehicleCategory } from '@kandy-cabs/shared';
import { ALL_LOCATIONS, PlaceLocation } from '@/lib/locations';
import { BookingFlowHeader } from '@/components/BookingFlowHeader';
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

  // Mode: "Book Once" vs "Daily Rides" (Matching Customer App Image 2)
  const [corporateMode, setCorporateMode] = useState<'ONCE' | 'DAILY'>('ONCE');

  // Locations
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [pickupQuery, setPickupQuery] = useState('');
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);

  const [dropAddress, setDropAddress] = useState('');
  const [dropLat, setDropLat] = useState<number | null>(null);
  const [dropLng, setDropLng] = useState<number | null>(null);
  const [dropQuery, setDropQuery] = useState('');
  const [showDropSuggestions, setShowDropSuggestions] = useState(false);

  const [stops, setStops] = useState<{ id: string; address: string; lat: number; lng: number }[]>([]);

  // Modals
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationModalTarget, setLocationModalTarget] = useState<'PICKUP' | 'DROP' | string>('PICKUP');
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [activeEditingTimeIndex, setActiveEditingTimeIndex] = useState<number | null>(null);

  // Single Ride Date
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Daily Rides Dates
  const [corporateStartDate, setCorporateStartDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 1 ? 0 : (day === 0 ? 1 : 8 - day);
    const d = new Date(now);
    d.setDate(now.getDate() + diff);
    return d.toISOString().split('T')[0];
  });
  const [corporateEndDate, setCorporateEndDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 1 ? 0 : (day === 0 ? 1 : 8 - day);
    const d = new Date(now);
    d.setDate(now.getDate() + diff + 6);
    return d.toISOString().split('T')[0];
  });
  const [corporateExcludedDates, setCorporateExcludedDates] = useState<string[]>([]);

  // Helper for Monday-based column positioning
  const getColStartClass = (colIndex: number) => {
    switch (colIndex) {
      case 1: return 'col-start-1';
      case 2: return 'col-start-2';
      case 3: return 'col-start-3';
      case 4: return 'col-start-4';
      case 5: return 'col-start-5';
      case 6: return 'col-start-6';
      case 7: return 'col-start-7';
      default: return '';
    }
  };

  // Multiple Pickup Times (Matching Customer App)
  const [corporatePickupTimes, setCorporatePickupTimes] = useState<string[]>(['09:00']);

  // Suggestions
  const filteredPickupLocations = useMemo(() => {
    if (!pickupQuery.trim()) return ALL_LOCATIONS.slice(0, 5);
    return ALL_LOCATIONS.filter((loc) =>
      loc.label.toLowerCase().includes(pickupQuery.toLowerCase()) ||
      (loc.sublabel && loc.sublabel.toLowerCase().includes(pickupQuery.toLowerCase()))
    ).slice(0, 6);
  }, [pickupQuery]);

  const filteredDropLocations = useMemo(() => {
    if (!dropQuery.trim()) return ALL_LOCATIONS.slice(0, 5);
    return ALL_LOCATIONS.filter((loc) =>
      loc.label.toLowerCase().includes(dropQuery.toLowerCase()) ||
      (loc.sublabel && loc.sublabel.toLowerCase().includes(dropQuery.toLowerCase()))
    ).slice(0, 6);
  }, [dropQuery]);

  // Compute Daily Rides list
  const corporateDatesList = useMemo(() => {
    const start = new Date(corporateStartDate);
    const end = new Date(corporateEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      const day = isNaN(start.getTime()) ? 1 : start.getDay();
      return [{
        formatted: corporateStartDate,
        dayName: 'Day',
        dayNum: corporateStartDate.slice(8, 10),
        monthName: 'Date',
        isWeekend: false,
        monColIndex: day === 0 ? 7 : day,
      }];
    }
    const list: {
      formatted: string;
      dayName: string;
      dayNum: string;
      monthName: string;
      isWeekend: boolean;
      monColIndex: number;
    }[] = [];
    const cur = new Date(start);
    let count = 0;
    while (cur <= end && count < 60) {
      const formatted = cur.toISOString().split('T')[0];
      const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;
      const day = cur.getDay();
      const monColIndex = day === 0 ? 7 : day;
      list.push({
        formatted,
        dayName: cur.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: String(cur.getDate()).padStart(2, '0'),
        monthName: cur.toLocaleDateString('en-US', { month: 'short' }),
        isWeekend,
        monColIndex,
      });
      cur.setDate(cur.getDate() + 1);
      count++;
    }
    return list;
  }, [corporateStartDate, corporateEndDate]);

  const activeDatesCount = useMemo(() => {
    return corporateDatesList.filter((d) => !corporateExcludedDates.includes(d.formatted)).length;
  }, [corporateDatesList, corporateExcludedDates]);

  const hasWeekendExcluded = useMemo(() => {
    const weekends = corporateDatesList.filter((d) => d.isWeekend).map((d) => d.formatted);
    return weekends.length > 0 && weekends.every((w) => corporateExcludedDates.includes(w));
  }, [corporateDatesList, corporateExcludedDates]);

  const handleToggleExcludeDate = (dateStr: string) => {
    setCorporateExcludedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleExcludeWeekends = () => {
    const weekends = corporateDatesList.filter((d) => d.isWeekend).map((d) => d.formatted);
    if (weekends.length === 0) return;
    setCorporateExcludedDates((prev) => {
      const allWeekendsExcluded = weekends.every((w) => prev.includes(w));
      return allWeekendsExcluded ? prev.filter((d) => !weekends.includes(d)) : Array.from(new Set([...prev, ...weekends]));
    });
  };

  const handleAddPickupTime = () => {
    if (corporatePickupTimes.length >= 6) return;
    setCorporatePickupTimes((prev) => [...prev, '18:00']);
  };

  const handleRemovePickupTime = (index: number) => {
    if (corporatePickupTimes.length <= 1) return;
    setCorporatePickupTimes((prev) => prev.filter((_, i) => i !== index));
  };

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
    setLocationModalOpen(false);
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
    if (corporateMode === 'ONCE' && !scheduledDate) {
      alert('Please select your pickup date');
      return;
    }
    if (corporateMode === 'DAILY' && activeDatesCount <= 0) {
      alert('Please select at least 1 ride date in your schedule');
      return;
    }

    const finalDate = corporateMode === 'DAILY'
      ? `${corporateStartDate} to ${corporateEndDate} (${activeDatesCount} days)`
      : scheduledDate;

    const finalTime = corporatePickupTimes.map(format12HourTime).join(', ');

    const params = new URLSearchParams({
      step: '2',
      tripType: 'CORPORATE',
      pickup: pickupAddress,
      pickupLat: (pickupLat ?? 0).toString(),
      pickupLng: (pickupLng ?? 0).toString(),
      drop: dropAddress,
      dropLat: (dropLat ?? 0).toString(),
      dropLng: (dropLng ?? 0).toString(),
      date: finalDate,
      time: finalTime,
      category: VehicleCategory.SEDAN,
      corporateMode,
      corporateStartDate: corporateMode === 'DAILY' ? corporateStartDate : '',
      corporateEndDate: corporateMode === 'DAILY' ? corporateEndDate : '',
      corporateTotalDays: corporateMode === 'DAILY' ? String(activeDatesCount) : '1',
      corporateExcludedDatesJson: JSON.stringify(corporateExcludedDates),
      corporatePickupTimesJson: JSON.stringify(corporatePickupTimes),
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
      {/* Step 1 Booking Flow Header (Matching Customer App Image 2) */}
      <BookingFlowHeader
        currentStep={1}
        title="Enter Trip Details"
        subStepLabel="Route & Schedule"
        onBack={() => router.push('/')}
      />

      <main className="max-w-2xl mx-auto px-2.5 sm:px-6 pt-3 sm:pt-4 space-y-3">
        {/* Top Corporate Mode Row: "Book Once" vs "Daily Rides" (Image 2) */}
        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
          {/* Option 1: Book Once */}
          <button
            type="button"
            onClick={() => setCorporateMode('ONCE')}
            className={`py-1 px-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              corporateMode === 'ONCE'
                ? 'border-2 border-slate-900 bg-[#eef2f6]'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all flex-shrink-0 ${
                corporateMode === 'ONCE'
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-300'
              }`}
            >
              {corporateMode === 'ONCE' && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">Book Once</p>
              <p className="text-[9.5px] sm:text-[10px] text-slate-500 font-medium mt-0.5 leading-tight">Single day ride</p>
            </div>
          </button>

          {/* Option 2: Daily Rides */}
          <button
            type="button"
            onClick={() => setCorporateMode('DAILY')}
            className={`py-1 px-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
              corporateMode === 'DAILY'
                ? 'border-2 border-slate-900 bg-[#eef2f6]'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all flex-shrink-0 ${
                corporateMode === 'DAILY'
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-300'
              }`}
            >
              {corporateMode === 'DAILY' && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">Daily Rides</p>
              <p className="text-[9.5px] sm:text-[10px] text-slate-500 font-medium mt-0.5 leading-tight">Daily commute</p>
            </div>
          </button>
        </div>

        {/* Card 1: Corporate Travel (Matching Image 2) */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#f0750f]">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 512 512" fill="currentColor">
                <path d="M432 112h-48V96a48.05 48.05 0 0 0-48-48H176a48.05 48.05 0 0 0-48 48v16H80a48.05 48.05 0 0 0-48 48v64h448v-64a48.05 48.05 0 0 0-48-48zM160 96a16 16 0 0 1 16-16h160a16 16 0 0 1 16 16v16H160zM32 256v144a48.05 48.05 0 0 0 48 48h352a48.05 48.05 0 0 0 48-48V256H336a16 16 0 0 1-16 16H192a16 16 0 0 1-16-16z" />
              </svg>
              <h3 className="text-sm font-extrabold text-[#f0750f]">Corporate Travel</h3>
            </div>
            <button
              type="button"
              onClick={handleSwapLocations}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center gap-1 text-slate-700 text-xs font-bold transition-all shadow-xs"
              title="Swap Locations"
            >
              <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              <span>Swap</span>
            </button>
          </div>

          {/* Pickup Location */}
          <div className="relative">
            <span className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-0.5 leading-none">
              PICKUP LOCATION
            </span>
            <div className="flex items-center gap-2 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white">
              <div className="text-emerald-500 flex-shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => {
                  setPickupAddress(e.target.value);
                  setPickupQuery(e.target.value);
                  setShowPickupSuggestions(true);
                }}
                onFocus={() => {
                  if (filteredPickupLocations.length > 0) setShowPickupSuggestions(true);
                }}
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

          {/* Destination Drop */}
          <div className="relative">
            <span className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-0.5 leading-none">
              DESTINATION DROP
            </span>
            <div className="flex items-center gap-2 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50/70 focus-within:bg-white">
              <div className="text-red-500 flex-shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                value={dropAddress}
                onChange={(e) => {
                  setDropAddress(e.target.value);
                  setDropQuery(e.target.value);
                  setShowDropSuggestions(true);
                }}
                onFocus={() => {
                  if (filteredDropLocations.length > 0) setShowDropSuggestions(true);
                }}
                placeholder="Enter destination drop"
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

            {showDropSuggestions && filteredDropLocations.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden divide-y divide-slate-50 max-h-56 overflow-y-auto">
                {filteredDropLocations.map((loc) => (
                  <button
                    key={loc.label}
                    type="button"
                    onClick={() => {
                      setDropAddress(loc.label);
                      setDropLat(loc.lat);
                      setDropLng(loc.lng);
                      setShowDropSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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

          {/* Add a Stop (Dark pill button matching Customer App Image 2) */}
          <div>
            <button
              type="button"
              onClick={handleAddStop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#162232] hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
            >
              <span className="text-white font-black text-sm">+</span>
              <span>Add a Stop</span>
            </button>
          </div>

          {/* Stops List */}
          {stops.map((stop, index) => (
            <div key={stop.id} className="flex items-center gap-2 p-1.5 rounded-xl bg-orange-50 border border-orange-100 text-[11px]">
              <span className="font-bold text-[#f0750f]">{index + 1}. Stop:</span>
              <span className="flex-1 truncate text-slate-800">{stop.address || 'Click to select location'}</span>
              <button
                type="button"
                onClick={() => {
                  setLocationModalTarget(stop.id);
                  setLocationModalOpen(true);
                }}
                className="text-[#f0750f] font-semibold underline text-xs"
              >
                Change
              </button>
              <button type="button" onClick={() => handleRemoveStop(stop.id)} className="text-red-500 font-bold ml-1 text-xs">✕</button>
            </div>
          ))}
        </div>

        {/* Card 2: Schedule (Matching Customer App Image 2) */}
        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 pb-8 mb-6 space-y-3">
          <div className="flex items-center gap-1.5 text-[#f0750f]">
            <svg className="w-4 h-4 text-[#f0750f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h4 className="text-xs font-extrabold text-[#f0750f]">
              {corporateMode === 'DAILY' ? 'Daily Rides Schedule' : 'Schedule'}
            </h4>
          </div>

          {corporateMode === 'ONCE' ? (
            /* Mode 1: Book Once Schedule (Image 2) */
            <div className="space-y-2.5">
              {/* Pickup Date */}
              <div>
                <span className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-0.5 leading-none">
                  PICKUP DATE
                </span>
                <div className="relative flex items-center justify-between py-2 px-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="flex items-center gap-2 truncate">
                    <svg className="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className={`text-xs font-semibold truncate ${scheduledDate ? 'text-slate-900' : 'text-slate-400'}`}>
                      {scheduledDate || 'Select Date'}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

              {/* Add Pickup Time Header with Button (Image 2) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider leading-none">
                    {corporatePickupTimes.length > 1 ? `PICKUP TIMES (${corporatePickupTimes.length})` : 'ADD PICKUP TIME'}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddPickupTime}
                    className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#162232] hover:text-[#f0750f]"
                  >
                    <span className="w-4 h-4 rounded-full bg-[#162232] text-white flex items-center justify-center text-xs font-black leading-none">+</span>
                    <span>Add Pickup Time</span>
                  </button>
                </div>

                {/* Multiple Pickup Times Cards List */}
                <div className="space-y-1.5">
                  {corporatePickupTimes.map((time, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div
                        onClick={() => {
                          setActiveEditingTimeIndex(idx);
                          setTimeModalOpen(true);
                        }}
                        className="flex-1 flex items-center justify-between py-2 px-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-slate-500 leading-tight">
                              {idx === 0
                                ? 'Primary Pickup'
                                : idx === 1
                                ? 'Evening / Return Pickup'
                                : `Pickup Time ${idx + 1}`}
                            </p>
                            <p className="text-xs font-bold text-slate-900 leading-tight">
                              {format12HourTime(time)}
                            </p>
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>

                      {corporatePickupTimes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePickupTime(idx)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                          title="Remove time"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: Daily Rides Schedule */
            <div className="space-y-3">
              {/* Date Range Row */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div>
                  <span className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-0.5 leading-none">
                    FROM DATE
                  </span>
                  <input
                    type="date"
                    value={corporateStartDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setCorporateStartDate(e.target.value)}
                    className="w-full py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-900 focus:outline-none"
                  />
                </div>
                <div className="pt-3 text-slate-400">→</div>
                <div>
                  <span className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider mb-0.5 leading-none">
                    TO DATE
                  </span>
                  <input
                    type="date"
                    value={corporateEndDate}
                    min={corporateStartDate}
                    onChange={(e) => setCorporateEndDate(e.target.value)}
                    className="w-full py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Included Dates Count & Exclude Weekends Button */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">
                      Included Dates ({activeDatesCount})
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Tap any date below to exclude it from schedule
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#162232] text-white text-[10px] font-bold">
                    {activeDatesCount} {activeDatesCount === 1 ? 'Ride' : 'Rides'}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExcludeWeekends}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold transition-all shadow-2xs"
                  >
                    {hasWeekendExcluded ? 'Include Weekends' : 'Exclude Weekends (Sat/Sun)'}
                  </button>
                  {corporateExcludedDates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCorporateExcludedDates([])}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold transition-all shadow-2xs"
                    >
                      Include All
                    </button>
                  )}
                </div>

                {/* Dates Grid Cards */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-1 max-h-48 overflow-y-auto">
                  {corporateDatesList.map((item, idx) => {
                    const isExcluded = corporateExcludedDates.includes(item.formatted);
                    return (
                      <button
                        key={item.formatted}
                        type="button"
                        onClick={() => handleToggleExcludeDate(item.formatted)}
                        className={`py-1 sm:py-1.5 px-0.5 sm:px-1 rounded-lg sm:rounded-xl border text-center transition-all cursor-pointer ${
                          idx === 0 ? getColStartClass(item.monColIndex) : ''
                        } ${
                          isExcluded
                            ? 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-60'
                            : 'bg-white border-slate-900/40 text-slate-900 shadow-2xs'
                        }`}
                      >
                        <p className="text-[8px] sm:text-[10px] font-bold uppercase leading-none">{item.dayName}</p>
                        <p className="text-[11px] sm:text-sm font-black my-0.5 leading-none">{item.dayNum}</p>
                        <p className="hidden sm:block text-[9px] font-medium leading-none">{item.monthName}</p>
                        <span className={`inline-block sm:mt-1 text-[7px] sm:text-[9px] font-bold px-0.5 sm:px-1 py-0.2 rounded leading-tight ${isExcluded ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'}`}>
                          {isExcluded ? 'Skip' : 'Ride'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Daily Pickup Times */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider leading-none">
                    DAILY PICKUP TIMES ({corporatePickupTimes.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddPickupTime}
                    className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#162232] hover:text-[#f0750f]"
                  >
                    <span className="w-4 h-4 rounded-full bg-[#162232] text-white flex items-center justify-center text-xs font-black leading-none">+</span>
                    <span>Add Pickup Time</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {corporatePickupTimes.map((time, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div
                        onClick={() => {
                          setActiveEditingTimeIndex(idx);
                          setTimeModalOpen(true);
                        }}
                        className="flex-1 flex items-center justify-between py-2 px-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-slate-500 leading-tight">
                              {idx === 0 ? 'Morning / Primary Pickup' : idx === 1 ? 'Evening / Return Pickup' : `Pickup Time ${idx + 1}`}
                            </p>
                            <p className="text-xs font-bold text-slate-900 leading-tight">
                              {format12HourTime(time)}
                            </p>
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>

                      {corporatePickupTimes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePickupTime(idx)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                          title="Remove time"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Centered Straddling Book Button */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20">
            <button
              type="button"
              onClick={handleBookYourRide}
              className="py-2.5 px-8 rounded-xl font-black text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-xs tracking-wider uppercase whitespace-nowrap shadow-md"
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
        targetType={locationModalTarget === 'PICKUP' ? 'PICKUP' : locationModalTarget === 'DROP' ? 'DROP' : 'STOP'}
        selectedAddress={locationModalTarget === 'PICKUP' ? pickupAddress : dropAddress}
        onSelectLocation={handleSelectLocation}
        title={locationModalTarget === 'PICKUP' ? 'Select Pickup Location' : 'Select Destination'}
      />

      {/* 12-Hour Time Picker Modal */}
      <TimePickerModal
        isOpen={timeModalOpen}
        onClose={() => {
          setTimeModalOpen(false);
          setActiveEditingTimeIndex(null);
        }}
        onSelectTime={(t) => {
          if (activeEditingTimeIndex !== null) {
            setCorporatePickupTimes((prev) =>
              prev.map((time, i) => (i === activeEditingTimeIndex ? t : time))
            );
          } else {
            setCorporatePickupTimes((prev) => (prev.length > 0 ? [t, ...prev.slice(1)] : [t]));
          }
          setTimeModalOpen(false);
          setActiveEditingTimeIndex(null);
        }}
        currentTime={
          activeEditingTimeIndex !== null && corporatePickupTimes[activeEditingTimeIndex]
            ? corporatePickupTimes[activeEditingTimeIndex]
            : corporatePickupTimes[0] || '09:00'
        }
        title="Select Pickup Time"
      />
    </div>
  );
}
