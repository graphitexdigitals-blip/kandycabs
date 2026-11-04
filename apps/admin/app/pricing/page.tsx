'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminNavbar } from '@/components/AdminNavbar';
import { VehicleCategory, TripType, FuelType } from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

const TRIP_TYPES_LIST = [
  { id: 'ONEWAY', label: 'One-Way Drop', icon: '🚗', desc: 'Point-to-point intercity drops' },
  { id: 'ROUND', label: 'Round Trip', icon: '🔄', desc: 'Outstation multi-day returns' },
  { id: 'AIRPORT', label: 'Airport Transfer', icon: '✈️', desc: 'Airport pickup and drops' },
  { id: 'LOCAL', label: 'Local Rental', icon: '⏱️', desc: 'Hourly city packages' },
  { id: 'PACKAGE', label: 'Tour & Package', icon: '🌴', desc: 'Sightseeing & pilgrimage' },
  { id: 'ALL', label: 'All Trips', icon: '🌐', desc: 'View all trip types' },
];

const FUEL_TYPES_LIST = [
  { id: 'ALL', label: 'All Fuels', icon: '⚡' },
  { id: 'DIESEL', label: 'Diesel', icon: '⛽' },
  { id: 'PETROL', label: 'Petrol', icon: '⛽' },
  { id: 'CNG', label: 'CNG', icon: '🌿' },
];

const CATEGORY_META: Record<string, { name: string; sample: string; icon: string; bg: string; border: string }> = {
  [VehicleCategory.HATCHBACK]: {
    name: 'Hatchback',
    sample: 'WagonR, Swift, Tiago',
    icon: '🚗',
    bg: 'bg-amber-50/60',
    border: 'border-amber-200',
  },
  [VehicleCategory.SEDAN]: {
    name: 'Sedan',
    sample: 'Dzire, Etios, Amaze',
    icon: '🚙',
    bg: 'bg-blue-50/60',
    border: 'border-blue-200',
  },
  [VehicleCategory.SUV]: {
    name: 'SUV (6+1)',
    sample: 'Ertiga, Triber, Carens',
    icon: '🚐',
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-200',
  },
  [VehicleCategory.SUV_PREMIUM]: {
    name: 'Premium SUV',
    sample: 'Innova Crysta, Safari',
    icon: '👑',
    bg: 'bg-purple-50/60',
    border: 'border-purple-200',
  },
  [VehicleCategory.TEMPO_TRAVELER]: {
    name: 'Tempo Traveller',
    sample: 'Force Traveller 12-16 Seater',
    icon: '🚌',
    bg: 'bg-rose-50/60',
    border: 'border-rose-200',
  },
  URBANIA: {
    name: 'Force Urbania Luxury',
    sample: '10/12/13/14/16/17-Seater Luxury Van',
    icon: '🚐',
    bg: 'bg-amber-50/60',
    border: 'border-amber-200',
  },
};

export default function AdminPricingPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTripType, setActiveTripType] = useState<string>('ONEWAY');
  const [activeFuelType, setActiveFuelType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [testDistanceKm, setTestDistanceKm] = useState<number>(250);
  const [seaterRates, setSeaterRates] = useState<Array<{
    id: string;
    wheelbaseName: string;
    seats: number;
    label: string;
    rate: number;
    extraKm: number;
    extraKmThreshold: number | null;
    luggage: number;
    minKm: number;
  }>>([
    { id: 'SWB_10', wheelbaseName: 'Short Wheelbase (3350 mm)', seats: 10, label: '10-Seater (10 + Driver)', rate: 28, extraKm: 28, extraKmThreshold: null, luggage: 8, minKm: 150 },
    { id: 'MWB_12', wheelbaseName: 'Medium Wheelbase (3615 mm)', seats: 12, label: '12-Seater (12 + Driver)', rate: 30, extraKm: 30, extraKmThreshold: null, luggage: 10, minKm: 150 },
    { id: 'MWB_13', wheelbaseName: 'Medium Wheelbase (3615 mm)', seats: 13, label: '13-Seater (13 + Driver)', rate: 32, extraKm: 32, extraKmThreshold: null, luggage: 10, minKm: 150 },
    { id: 'MWB_14', wheelbaseName: 'Medium Wheelbase (3615 mm)', seats: 14, label: '14-Seater (14 + Driver)', rate: 34, extraKm: 34, extraKmThreshold: null, luggage: 10, minKm: 150 },
    { id: 'LWB_16', wheelbaseName: 'Long Wheelbase (4400 mm)', seats: 16, label: '16-Seater (16 + Driver)', rate: 36, extraKm: 36, extraKmThreshold: null, luggage: 12, minKm: 150 },
    { id: 'LWB_17', wheelbaseName: 'Long Wheelbase (4400 mm)', seats: 17, label: '17-Seater (17 + Driver)', rate: 38, extraKm: 38, extraKmThreshold: null, luggage: 12, minKm: 150 },
  ]);
  const [savingSeaterRates, setSavingSeaterRates] = useState(false);

  // Dynamic Pet Friendly Surcharge Rates (Cat: 200, Dog: 500, Bird: 100)
  const [petRates, setPetRates] = useState<{ cat: number; dog: number; bird: number }>({
    cat: 200,
    dog: 500,
    bird: 100,
  });
  const [savingPetRates, setSavingPetRates] = useState(false);

  const fetchPetRates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings/pet-rates');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.rates) {
          setPetRates({
            cat: Number(data.rates.cat) || 200,
            dog: Number(data.rates.dog) || 500,
            bird: Number(data.rates.bird) || 100,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load pet rates:', err);
    }
  }, []);

  useEffect(() => {
    fetchPetRates();
  }, [fetchPetRates]);

  const handleSavePetRates = async () => {
    setSavingPetRates(true);
    try {
      const res = await fetch('/api/admin/settings/pet-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(petRates),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rates) {
          setPetRates(data.rates);
        }
        setSuccessToast(`Saved Pet Surcharge Rates: Cat ₹${petRates.cat}, Dog ₹${petRates.dog}, Bird ₹${petRates.bird}!`);
        setTimeout(() => setSuccessToast(null), 3500);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update pet rates');
      }
    } catch (err) {
      console.error('Error saving pet rates:', err);
      alert('Error saving pet rates');
    } finally {
      setSavingPetRates(false);
    }
  };

  const handleUpdateSeaterField = (id: string, field: 'rate' | 'extraKm' | 'extraKmThreshold', value: number | null) => {
    setSeaterRates((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveAllSeaterRates = () => {
    setSavingSeaterRates(true);
    setTimeout(() => {
      setSavingSeaterRates(false);
      setSuccessToast('Updated Force Urbania / Van seater rates & extra KM calculations!');
      setTimeout(() => setSuccessToast(null), 3500);
    }, 400);
  };

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (activeTripType !== 'ALL') queryParams.set('tripType', activeTripType);

      const res = await fetch(`/api/admin/pricing?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error('Failed to load pricing rules:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTripType]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Filter rules by Fuel Type & Search
  const filteredRules = rules.filter((r) => {
    if (activeFuelType !== 'ALL' && r.fuelType !== activeFuelType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCat = r.category.toLowerCase().includes(q);
      const matchFuel = r.fuelType.toLowerCase().includes(q);
      const matchTrip = r.tripType.toLowerCase().includes(q);
      if (!matchCat && !matchFuel && !matchTrip) return false;
    }
    return true;
  });

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule),
      });

      if (res.ok) {
        const saved = editingRule;
        setEditingRule(null);
        setSuccessToast(`Saved pricing for ${saved.category} • ${saved.tripType} • ${saved.fuelType}`);
        setTimeout(() => setSuccessToast(null), 3500);
        await fetchRules();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save pricing rule');
      }
    } catch (err) {
      console.error('Error saving pricing rule:', err);
      alert('Error saving rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: any) => {
    const updated = { ...rule, isActive: !rule.isActive };
    try {
      // Optimistic update
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));

      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (!res.ok) {
        await fetchRules();
      }
    } catch {
      await fetchRules();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏷️</span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Fare Rules & Pricing Matrix
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Separate pricing cards per <span className="font-semibold text-slate-800">Trip Type</span> and <span className="font-semibold text-slate-800">Fuel Type</span>. Updates take effect immediately on live quotes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchRules()}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5 text-slate-700 transition shadow-2xs"
            >
              <span>🔄</span> Refresh Rates
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-600 hover:text-emerald-900">
              ✕
            </button>
          </div>
        )}

        {/* 1. Trip Type Pill Tabs */}
        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block px-1">
            1. Select Trip Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {TRIP_TYPES_LIST.map((tt) => {
              const isSelected = activeTripType === tt.id;
              return (
                <button
                  key={tt.id}
                  onClick={() => setActiveTripType(tt.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                    isSelected
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-400/40'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="text-lg mb-1">{tt.icon}</span>
                  <span className="text-xs font-black">{tt.label}</span>
                  <span className={`text-[10px] mt-0.5 line-clamp-1 ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>
                    {tt.id === 'ALL' ? 'All types' : tt.id}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Fuel Type Filter Bar & Search */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-2">Fuel Type:</span>
            {FUEL_TYPES_LIST.map((ft) => {
              const isSelected = activeFuelType === ft.id;
              return (
                <button
                  key={ft.id}
                  onClick={() => setActiveFuelType(ft.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>{ft.icon}</span>
                  <span>{ft.label}</span>
                </button>
              );
            })}
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search category or fuel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 2.5 Force Urbania / Van Wheelbase & Seater Pricing Matrix */}
        <div className="bg-white border-2 border-amber-300/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🚐</span>
                <h3 className="text-base font-black text-slate-900">
                  Force Urbania & Van Wheelbase & Seater Pricing Matrix
                </h3>
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                  Live Rule Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure rates per km, extra km rates, and <strong>Extra KM After</strong> distance threshold for <strong>Short (3350 mm)</strong>, <strong>Medium (3615 mm)</strong>, and <strong>Long (4400 mm)</strong> wheelbase seater options.
              </p>
            </div>

            <button
              onClick={handleSaveAllSeaterRates}
              disabled={savingSeaterRates}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 self-start sm:self-auto"
            >
              <span>💾</span>
              <span>{savingSeaterRates ? 'Saving Matrix...' : 'Save Matrix Rates'}</span>
            </button>
          </div>

          {/* Live Interactive Distance Simulator Controls */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-amber-950 flex items-center gap-1">
                <span>⚡</span> Live Calculation Simulator:
              </span>
              <span className="text-[11px] text-amber-800">
                Test simulated trip distance against Extra KM After thresholds:
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-amber-300 shadow-2xs">
                <span className="text-xs font-bold text-slate-500">Trip Distance:</span>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  step="10"
                  value={testDistanceKm}
                  onChange={(e) => setTestDistanceKm(Math.max(1, parseInt(e.target.value) || 150))}
                  className="w-16 font-black text-xs text-amber-950 bg-transparent text-center focus:outline-none"
                />
                <span className="text-xs font-bold text-amber-700">km</span>
              </div>

              {[150, 200, 250, 350, 500].map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => setTestDistanceKm(km)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    testDistanceKm === km
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-200'
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {seaterRates.map((variant) => {
              const hasThreshold = typeof variant.extraKmThreshold === 'number' && variant.extraKmThreshold > 0;
              const threshold = hasThreshold ? variant.extraKmThreshold! : null;
              const isBeyondThreshold = Boolean(threshold && testDistanceKm > threshold);

              let baseKm = testDistanceKm;
              let extraKm = 0;
              let baseFare = 0;
              let extraKmFare = 0;

              if (threshold && isBeyondThreshold) {
                baseKm = threshold;
                extraKm = testDistanceKm - threshold;
                baseFare = baseKm * variant.rate;
                extraKmFare = extraKm * variant.extraKm;
              } else {
                baseKm = testDistanceKm;
                extraKm = 0;
                baseFare = baseKm * variant.rate;
                extraKmFare = 0;
              }

              const subtotalFare = baseFare + extraKmFare;
              const gstAmount = Math.round(subtotalFare * 0.05);
              const totalFareWithGst = subtotalFare + gstAmount;
              const advance25 = Math.round(totalFareWithGst * 0.25);
              const balance75 = totalFareWithGst - advance25;

              return (
                <div
                  key={variant.id}
                  className="bg-slate-50 border-2 border-slate-200 hover:border-amber-400 rounded-2xl p-4 space-y-3.5 transition flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                          {variant.wheelbaseName.includes('3350') ? 'SWB 3350 MM' : variant.wheelbaseName.includes('3615') ? 'MWB 3615 MM' : 'LWB 4400 MM'}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-1.5">{variant.label}</h4>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          👥 {variant.seats} Seats • 🧳 {variant.luggage} Bags • Min {variant.minKm} km
                        </span>
                      </div>
                    </div>

                    {/* 3 Inputs Grid: Rate, Extra KM Rate, Extra KM After */}
                    <div className="grid grid-cols-3 gap-2 pt-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          Rate / KM (₹)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-xs font-bold text-slate-400">₹</span>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={variant.rate}
                            onChange={(e) => handleUpdateSeaterField(variant.id, 'rate', parseFloat(e.target.value) || 0)}
                            className="w-full pl-5 pr-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          Extra KM Rate (₹)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-xs font-bold text-slate-400">₹</span>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={variant.extraKm}
                            onChange={(e) => handleUpdateSeaterField(variant.id, 'extraKm', parseFloat(e.target.value) || 0)}
                            className="w-full pl-5 pr-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                          Extra KM After
                        </label>
                        <span className="text-[9px] text-amber-600 block mb-0.5">(Optional)</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="e.g. 50, 250, 80"
                          value={variant.extraKmThreshold ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleUpdateSeaterField(variant.id, 'extraKmThreshold', val === '' ? null : parseFloat(val) || 0);
                          }}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculations & Formula Breakdown Box */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 text-xs shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        🧮 Calculation ({testDistanceKm} km):
                      </span>
                      <span className="font-black text-xs text-emerald-700">
                        ₹{totalFareWithGst.toLocaleString('en-IN')} <span className="text-[9.5px] text-slate-400 font-normal">incl. GST</span>
                      </span>
                    </div>

                    {/* Step-by-step Math Formula */}
                    <div className="space-y-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {threshold && isBeyondThreshold ? (
                        <>
                          <div className="flex justify-between">
                            <span>Base ({threshold} km @ ₹{variant.rate}/km):</span>
                            <span className="font-bold text-slate-800">₹{baseFare.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between text-amber-800 font-semibold">
                            <span>Extra ({extraKm} km @ ₹{variant.extraKm}/km):</span>
                            <span className="font-bold">+ ₹{extraKmFare.toLocaleString('en-IN')}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span>Base ({testDistanceKm} km @ ₹{variant.rate}/km):</span>
                            <span className="font-bold text-slate-800">₹{baseFare.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 pt-0.5">
                            Extra KM rate: <strong>₹{variant.extraKm}/km</strong> if exceeded beyond booked distance
                          </div>
                        </>
                      )}

                      <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-800">
                        <span>Subtotal Fare:</span>
                        <span>₹{subtotalFare.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>GST (5%):</span>
                        <span>+ ₹{gstAmount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Split 25% Advance / 75% Balance */}
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[10.5px]">
                      <div className="bg-amber-50/80 border border-amber-200 px-2 py-1 rounded text-center">
                        <span className="text-[9.5px] text-amber-800 font-bold block">Advance (25%)</span>
                        <span className="font-black text-amber-950">₹{advance25.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-center">
                        <span className="text-[9.5px] text-slate-600 font-bold block">Balance on Drop</span>
                        <span className="font-black text-slate-900">₹{balance75.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pet-Friendly Surcharge Rates Card */}
        <div className="bg-white border border-amber-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🐾</span>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Pet-Friendly Surcharge Rates (Mobile App & Web)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  Live Pricing
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure per-trip pet sanitization and convenience surcharges for <strong>Cat</strong>, <strong>Dog</strong>, and <strong>Bird</strong>. When customers enable "Pet Friendly" in the app, these rates are dynamically presented and added to the trip fare.
              </p>
            </div>

            <button
              onClick={handleSavePetRates}
              disabled={savingPetRates}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 self-start sm:self-auto shrink-0"
            >
              <span>{savingPetRates ? '⏳' : '💾'}</span>
              <span>{savingPetRates ? 'Saving Rates...' : 'Save Pet Rates'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cat */}
            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 flex flex-col justify-between hover:border-amber-300 transition shadow-2xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🐱</span>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Cat / Feline</h4>
                      <p className="text-[11px] text-slate-500">Cats, kittens & small felines</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                    Per Trip
                  </span>
                </div>

                <div className="mt-3">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Surcharge Amount (₹):
                  </label>
                  <div className="flex items-center bg-white border border-slate-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 rounded-lg px-2.5 py-1.5 shadow-2xs transition">
                    <span className="text-xs font-black text-slate-400 mr-1.5">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={petRates.cat}
                      onChange={(e) => setPetRates((prev) => ({ ...prev, cat: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-full text-sm font-black text-slate-900 bg-transparent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Customer App Fee:</span>
                <span className="font-extrabold text-amber-900">+₹{petRates.cat}</span>
              </div>
            </div>

            {/* Dog */}
            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 flex flex-col justify-between hover:border-amber-300 transition shadow-2xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🐶</span>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Dog / Canine</h4>
                      <p className="text-[11px] text-slate-500">Dogs, puppies & large canines</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                    Per Trip
                  </span>
                </div>

                <div className="mt-3">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Surcharge Amount (₹):
                  </label>
                  <div className="flex items-center bg-white border border-slate-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 rounded-lg px-2.5 py-1.5 shadow-2xs transition">
                    <span className="text-xs font-black text-slate-400 mr-1.5">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={petRates.dog}
                      onChange={(e) => setPetRates((prev) => ({ ...prev, dog: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-full text-sm font-black text-slate-900 bg-transparent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Customer App Fee:</span>
                <span className="font-extrabold text-amber-900">+₹{petRates.dog}</span>
              </div>
            </div>

            {/* Bird */}
            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 flex flex-col justify-between hover:border-amber-300 transition shadow-2xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🦜</span>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Bird / Caged Pet</h4>
                      <p className="text-[11px] text-slate-500">Parrots, canaries & caged birds</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                    Per Trip
                  </span>
                </div>

                <div className="mt-3">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Surcharge Amount (₹):
                  </label>
                  <div className="flex items-center bg-white border border-slate-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 rounded-lg px-2.5 py-1.5 shadow-2xs transition">
                    <span className="text-xs font-black text-slate-400 mr-1.5">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={petRates.bird}
                      onChange={(e) => setPetRates((prev) => ({ ...prev, bird: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-full text-sm font-black text-slate-900 bg-transparent focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Customer App Fee:</span>
                <span className="font-extrabold text-amber-900">+₹{petRates.bird}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Cards Grid for Vehicle Categories */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-20 text-center text-slate-400 text-sm shadow-xs">
            <div className="inline-block animate-spin text-3xl mb-3">🔄</div>
            <div className="font-bold text-slate-600">Loading pricing cards...</div>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center text-slate-500 shadow-xs">
            <div className="text-4xl mb-2">🏷️</div>
            <div className="text-base font-bold text-slate-800">No pricing rules found</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No rules matched the selected Trip Type ({activeTripType}) and Fuel Type ({activeFuelType}).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRules.map((rule) => {
              const meta = CATEGORY_META[rule.category] || {
                name: rule.category,
                sample: 'Standard Cab',
                icon: '🚕',
                bg: 'bg-slate-50',
                border: 'border-slate-200',
              };

              return (
                <div
                  key={rule.id}
                  className={`bg-white rounded-2xl border-2 transition hover:shadow-md flex flex-col justify-between overflow-hidden ${
                    rule.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'
                  }`}
                >
                  {/* Card Header */}
                  <div className={`p-4 border-b border-slate-100 flex items-start justify-between ${meta.bg}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-xl">
                        {meta.icon}
                      </div>
                      <div>
                        <div className="font-black text-slate-900 text-sm leading-tight flex items-center gap-1.5">
                          <span>{meta.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{meta.sample}</div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-bold uppercase tracking-wider">
                        {rule.fuelType}
                      </span>
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9.5px] font-bold">
                        {rule.tripType}
                      </span>
                    </div>
                  </div>

                  {/* Card Main Price Highlight */}
                  <div className="p-4 space-y-4 flex-1">
                    {rule.tripType === 'LOCAL' || rule.tripType === 'PACKAGE' ? (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                            ⏱️ Local Rental Packages
                          </span>
                          <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                            Extra: ₹{rule.extraKmRate}/km
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-xs">
                          <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                            <div className="text-[9.5px] font-bold text-slate-400">4h / {rule.localPackage4hrKm || 40}km</div>
                            <div className="font-black text-emerald-700 text-xs sm:text-sm mt-0.5">
                              ₹{rule.localPackage4hrBase || (rule.category === 'HATCHBACK' ? 1000 : rule.category === 'SEDAN' ? 1200 : rule.category === 'SUV' ? 1600 : rule.category === 'SUV_PREMIUM' ? 2200 : 3000)}
                            </div>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                            <div className="text-[9.5px] font-bold text-slate-400">8h / {rule.localPackage8hrKm || 80}km</div>
                            <div className="font-black text-emerald-700 text-xs sm:text-sm mt-0.5">
                              ₹{rule.localPackage8hrBase || (rule.category === 'HATCHBACK' ? 1800 : rule.category === 'SEDAN' ? 2200 : rule.category === 'SUV' ? 2800 : rule.category === 'SUV_PREMIUM' ? 3800 : 5500)}
                            </div>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                            <div className="text-[9.5px] font-bold text-slate-400">12h / {rule.localPackage12hrKm || 120}km</div>
                            <div className="font-black text-emerald-700 text-xs sm:text-sm mt-0.5">
                              ₹{rule.localPackage12hrBase || (rule.category === 'HATCHBACK' ? 2600 : rule.category === 'SEDAN' ? 3200 : rule.category === 'SUV' ? 4000 : rule.category === 'SUV_PREMIUM' ? 5200 : 7500)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                            Base Rate
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-2xl font-black text-emerald-700">₹{rule.baseRatePerKm}</span>
                            <span className="text-xs font-bold text-slate-500">/ km</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                            Extra KM Rate
                          </span>
                          <span className="text-sm font-black text-slate-800">₹{rule.extraKmRate}/km</span>
                          <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                            {rule.extraKmThreshold ? `After ${rule.extraKmThreshold} km` : 'Beyond booked route'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Parameters 2x2 Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white border border-slate-100 rounded-lg p-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">👨‍✈️ Driver Allowance</div>
                        <div className="font-black text-slate-800 mt-0.5">₹{rule.driverAllowance} / day</div>
                      </div>

                      <div className="bg-white border border-slate-100 rounded-lg p-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">🌙 Night Surcharge</div>
                        <div className="font-black text-slate-800 mt-0.5">
                          ₹{rule.nightCharge}{' '}
                          <span className="text-[10px] text-slate-500 font-normal">
                            ({rule.nightWindowStartHour}:00 - {rule.nightWindowEndHour}:00)
                          </span>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-100 rounded-lg p-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">🧾 GST Rate</div>
                        <div className="font-black text-blue-700 mt-0.5">{rule.gstRatePercent}%</div>
                      </div>

                      <div className="bg-white border border-slate-100 rounded-lg p-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Status</div>
                        <div className={`font-black mt-0.5 ${rule.isActive ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {rule.isActive ? '● Active' : '○ Inactive'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(rule)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        rule.isActive
                          ? 'bg-white hover:bg-rose-50 text-rose-700 border-slate-200'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-700'
                      }`}
                    >
                      {rule.isActive ? 'Disable' : 'Enable'}
                    </button>

                    <button
                      onClick={() => setEditingRule({ ...rule })}
                      className="flex-1 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
                    >
                      <span>✏️</span> Edit Rates
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏷️</span>
                  <h3 className="text-base font-black text-slate-900">
                    Edit {editingRule.category} Rates
                  </h3>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-bold">
                    {editingRule.fuelType}
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">
                    {editingRule.tripType}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditingRule(null)}
                className="text-slate-400 hover:text-slate-700 p-1 font-bold text-base"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              {editingRule.tripType === 'LOCAL' || editingRule.tripType === 'PACKAGE' ? (
                <div className="space-y-3 bg-amber-50/60 border border-amber-200 p-3.5 rounded-xl">
                  <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                    <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <span>⏱️</span> Local Rental Packages (Hourly & KM)
                    </span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      Editable Packages
                    </span>
                  </div>

                  {/* 4 Hours Package */}
                  <div className="grid grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">4 Hours Price (₹)</label>
                      <input
                        type="number"
                        step="10"
                        min="0"
                        placeholder="e.g. 1200"
                        value={editingRule.localPackage4hrBase ?? ''}
                        onChange={(e) => setEditingRule({ ...editingRule, localPackage4hrBase: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Price for 4 hrs</span>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">4 Hours KM</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="40"
                        value={editingRule.localPackage4hrKm ?? 40}
                        onChange={(e) => setEditingRule({ ...editingRule, localPackage4hrKm: parseFloat(e.target.value) || 40 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Included KM</span>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Extra KM Rate (₹)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="13"
                        value={editingRule.localPackage4hrExtraKmRate ?? editingRule.extraKmRate ?? 13}
                        onChange={(e) => setEditingRule({ ...editingRule, localPackage4hrExtraKmRate: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">₹ / extra km</span>
                    </div>
                  </div>

                  {/* 8 Hours Package */}
                  <div className="grid grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">8 Hours Price (₹)</label>
                      <input
                        type="number"
                        step="10"
                        min="0"
                        placeholder="e.g. 2200"
                        value={editingRule.localPackage8hrBase ?? ''}
                        onChange={(e) => setEditingRule({ ...editingRule, localPackage8hrBase: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Price for 8 hrs</span>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">8 Hours KM</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="80"
                        value={editingRule.localPackage8hrKm ?? 80}
                        onChange={(e) => setEditingRule({ ...editingRule, localPackage8hrKm: parseFloat(e.target.value) || 80 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Included KM</span>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Extra KM Rate (₹)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="13"
                        value={editingRule.localPackage8hrExtraKmRate ?? editingRule.extraKmRate ?? 13}
                        onChange={(e) => setEditingRule({ ...editingRule, localPackage8hrExtraKmRate: parseFloat(e.target.value) || 0, extraKmRate: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        required
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">₹ / extra km</span>
                    </div>
                  </div>

                  {/* 12 Hours Package */}
                  <div className="grid grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">12 Hours Price (₹)</label>
                      <input
                        type="number"
                        step="10"
                        min="0"
                        placeholder="e.g. 3200"
                        value={editingRule.localPackage12hrBase ?? ''}
                        onChange={(e) => setEditingRule({ ...editingRule, localPackage12hrBase: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Price for 12 hrs</span>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">12 Hours KM</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="120"
                        value={editingRule.localPackage12hrKm ?? 120}
                        onChange={(e) => setEditingRule({ ...editingRule, localPackage12hrKm: parseFloat(e.target.value) || 120 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Included KM</span>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Extra KM Rate (₹)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="13"
                        value={editingRule.localPackage12hrExtraKmRate ?? editingRule.extraKmRate ?? 13}
                        onChange={(e) => setEditingRule({ ...editingRule, localPackage12hrExtraKmRate: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">₹ / extra km</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Base Rate / KM (₹)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editingRule.baseRatePerKm}
                      onChange={(e) => setEditingRule({ ...editingRule, baseRatePerKm: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Standard per km rate</span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Extra KM Rate (₹)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editingRule.extraKmRate}
                      onChange={(e) => setEditingRule({ ...editingRule, extraKmRate: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Rate per extra km</span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Extra KM After (KM) <span className="text-[10px] font-normal text-amber-600">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="e.g. 50, 250, 80"
                      value={editingRule.extraKmThreshold ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingRule({ ...editingRule, extraKmThreshold: val === '' ? null : parseFloat(val) || 0 });
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Distance threshold</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Driver Allowance / Day (₹)</label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    value={editingRule.driverAllowance}
                    onChange={(e) => setEditingRule({ ...editingRule, driverAllowance: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Night Charge (₹)</label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    value={editingRule.nightCharge}
                    onChange={(e) => setEditingRule({ ...editingRule, nightCharge: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Night Start (Hour)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={editingRule.nightWindowStartHour}
                    onChange={(e) => setEditingRule({ ...editingRule, nightWindowStartHour: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Night End (Hour)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={editingRule.nightWindowEndHour}
                    onChange={(e) => setEditingRule({ ...editingRule, nightWindowEndHour: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">GST Tax (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="28"
                    value={editingRule.gstRatePercent}
                    onChange={(e) => setEditingRule({ ...editingRule, gstRatePercent: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={editingRule.isActive}
                    onChange={(e) => setEditingRule({ ...editingRule, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                  />
                  <span>Rule is Active (Available for customer quotes)</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black transition shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? 'Saving Rates...' : 'Save Pricing Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
