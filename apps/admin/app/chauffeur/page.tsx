'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminNavbar } from '@/components/AdminNavbar';
import {
  DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG,
  ChauffeurAllowanceConfig,
} from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export default function ChauffeurAllowancePage() {
  const [chauffeurConfig, setChauffeurConfig] = useState<ChauffeurAllowanceConfig>(DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchChauffeurConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/chauffeur-allowance');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          setChauffeurConfig(data.settings);
        }
      }
    } catch (err) {
      console.error('Failed to load chauffeur allowance settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChauffeurConfig();
  }, [fetchChauffeurConfig]);

  const handleSaveChauffeurConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/chauffeur-allowance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chauffeurConfig),
      });
      if (res.ok) {
        setToastMessage('Saved Chauffeur Allowance & Driver Bata Settings!');
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert('Failed to save chauffeur allowance settings');
      }
    } catch (err) {
      console.error('Error saving chauffeur allowance settings:', err);
      alert('Error saving chauffeur allowance settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminNavbar />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200 shadow-2xs">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Chauffeur Allowance (Driver Bata) Policy
                </h1>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  chauffeurConfig.enabled
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {chauffeurConfig.enabled ? 'Policy Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure day duty hours (6 AM to 8 PM), night duty hours (8 PM to 6 AM), trip-type allowances, and fleet-specific driver bata.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setChauffeurConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className={`px-3.5 py-2 font-bold text-xs rounded-xl transition border cursor-pointer ${
                chauffeurConfig.enabled
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
              }`}
            >
              {chauffeurConfig.enabled ? 'Enabled' : 'Disabled'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveChauffeurConfig}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {saving ? 'Saving...' : 'Save Chauffeur Policy'}
            </button>
          </div>
        </div>

        {/* 1. Duty Windows (Day & Night) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              1. Duty & Timing Windows
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Day Window Setting */}
            <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 flex items-center justify-between gap-3 shadow-2xs">
              <div>
                <span className="text-xs font-black text-slate-800 block">Day Duty Hours</span>
                <span className="text-[11px] text-slate-500">Standard day driving window (6 AM to 8 PM)</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold shrink-0">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={chauffeurConfig.dayWindowStartHour}
                  onChange={(e) => setChauffeurConfig((prev) => ({ ...prev, dayWindowStartHour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) }))}
                  className="w-14 px-2 py-1 text-center font-mono font-bold border border-slate-300 rounded-lg bg-white text-slate-900"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={chauffeurConfig.dayWindowEndHour}
                  onChange={(e) => setChauffeurConfig((prev) => ({ ...prev, dayWindowEndHour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) }))}
                  className="w-14 px-2 py-1 text-center font-mono font-bold border border-slate-300 rounded-lg bg-white text-slate-900"
                />
                <span className="text-[11px] text-slate-500">Hrs</span>
              </div>
            </div>

            {/* Night Window Setting */}
            <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 flex items-center justify-between gap-3 shadow-2xs">
              <div>
                <span className="text-xs font-black text-slate-800 block">Night Duty Hours</span>
                <span className="text-[11px] text-slate-500">Late night window (8 PM to 6 AM)</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold shrink-0">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={chauffeurConfig.nightWindowStartHour}
                  onChange={(e) => setChauffeurConfig((prev) => ({ ...prev, nightWindowStartHour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) }))}
                  className="w-14 px-2 py-1 text-center font-mono font-bold border border-slate-300 rounded-lg bg-white text-slate-900"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={chauffeurConfig.nightWindowEndHour}
                  onChange={(e) => setChauffeurConfig((prev) => ({ ...prev, nightWindowEndHour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) }))}
                  className="w-14 px-2 py-1 text-center font-mono font-bold border border-slate-300 rounded-lg bg-white text-slate-900"
                />
                <span className="text-[11px] text-slate-500">Hrs</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Trip-Wise Rules Grid */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                2. Trip-Wise Allowance Rules
              </h2>
            </div>
            <span className="text-[11px] text-slate-500">Click toggles to customize day or night allowance inclusion per trip type</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[
              {
                key: 'ONEWAY',
                label: 'One Way Outstation',
                desc: 'Point-to-point drop ride',
                ruleBadge: 'Chauffeur Allowance Included',
                ruleBadgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                dayLabel: 'Day Allowance Included',
                nightLabel: 'Night Allowance (8 PM - 6 AM)',
              },
              {
                key: 'ROUND',
                label: 'Round Trip',
                desc: 'Return / multi-day round tour',
                ruleBadge: 'Day 6 AM-8 PM Included • Night 8 PM-6 AM Included',
                ruleBadgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
                dayLabel: 'Day Included (6 AM to 8 PM)',
                nightLabel: 'Night Included (8 PM to 6 AM)',
              },
              {
                key: 'LOCAL',
                label: 'Local Rental Package',
                desc: 'Hourly 4hr/8hr/12hr city packages',
                ruleBadge: 'No Day Allowance • 8 PM - 6 AM Excluded',
                ruleBadgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
                dayLabel: 'Day Allowance',
                nightLabel: '8 PM to 6 AM Night Allowance',
              },
              {
                key: 'AIRPORT',
                label: 'Airport Transfers',
                desc: 'Airport pickups & drops',
                ruleBadge: 'No Allowance',
                ruleBadgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
                dayLabel: 'Day Allowance',
                nightLabel: 'Night Allowance',
              },
              {
                key: 'CORPORATE',
                label: 'Corporate Travel',
                desc: 'Executive & corporate bookings',
                ruleBadge: 'Same as Round Trip',
                ruleBadgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
                dayLabel: 'Day Included (6 AM to 8 PM)',
                nightLabel: 'Night Included (8 PM to 6 AM)',
              },
              {
                key: 'PACKAGE',
                label: 'Pilgrimage Tour / Packages',
                desc: 'Sightseeing & temple tour packages',
                ruleBadge: 'Same as Round Trip',
                ruleBadgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
                dayLabel: 'Day Included (6 AM to 8 PM)',
                nightLabel: 'Night Included (8 PM to 6 AM)',
              },
            ].map((item) => {
              const rule = chauffeurConfig.rules?.[item.key] || {
                tripType: item.key,
                label: item.label,
                dayAllowanceEnabled: item.key === 'ONEWAY' || item.key === 'ROUND' || item.key === 'CORPORATE' || item.key === 'PACKAGE',
                nightAllowanceEnabled: item.key === 'ROUND' || item.key === 'CORPORATE' || item.key === 'PACKAGE',
                notes: '',
              };

              return (
                <div
                  key={item.key}
                  className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition flex flex-col justify-between shadow-2xs space-y-3.5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-black text-slate-900">{item.label}</h3>
                        <span className="text-[10px] text-slate-400">{item.desc}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold border shrink-0 text-center ${item.ruleBadgeColor}`}>
                        {item.ruleBadge}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2.5 border-t border-slate-100 text-xs">
                    {/* Day Allowance Toggle */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-700">{item.dayLabel}:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setChauffeurConfig((prev) => ({
                            ...prev,
                            rules: {
                              ...prev.rules,
                              [item.key]: {
                                ...rule,
                                dayAllowanceEnabled: !rule.dayAllowanceEnabled,
                              },
                            },
                          }));
                        }}
                        className={`px-3 py-1 rounded-lg text-[10.5px] font-bold transition border cursor-pointer ${
                          rule.dayAllowanceEnabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {rule.dayAllowanceEnabled ? '✓ Included' : '✕ Excluded'}
                      </button>
                    </div>

                    {/* Night Allowance Toggle */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-700">{item.nightLabel}:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setChauffeurConfig((prev) => ({
                            ...prev,
                            rules: {
                              ...prev.rules,
                              [item.key]: {
                                ...rule,
                                nightAllowanceEnabled: !rule.nightAllowanceEnabled,
                              },
                            },
                          }));
                        }}
                        className={`px-3 py-1 rounded-lg text-[10.5px] font-bold transition border cursor-pointer ${
                          rule.nightAllowanceEnabled
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {rule.nightAllowanceEnabled ? '✓ Included' : '✕ Excluded'}
                      </button>
                    </div>

                    {/* Optional Flat Rate Override */}
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-50">
                      <div>
                        <span className="text-[10px] text-slate-500 block leading-tight">Flat Day Rate Override (₹):</span>
                        <span className="text-[9px] text-slate-400">Leave blank for fleet default</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        placeholder="Fleet Rate"
                        value={rule.dayRateOverride !== null && rule.dayRateOverride !== undefined ? rule.dayRateOverride : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value) || 0);
                          setChauffeurConfig((prev) => ({
                            ...prev,
                            rules: {
                              ...prev.rules,
                              [item.key]: {
                                ...rule,
                                dayRateOverride: val,
                              },
                            },
                          }));
                        }}
                        className="w-24 px-2 py-1 text-right font-mono text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-amber-500 font-bold"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Fleet Default Driver Bata Rates (Day & Night) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                3. Fleet-Specific Default Driver Bata Rates
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">All amounts in INR (₹)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[
              { key: 'HATCHBACK', name: 'Sedan – Compact', sub: 'Toyota Glanza, WagonR, Tiago' },
              { key: 'SWIFT_DZIRE', name: 'Sedan – Swift Dzire', sub: 'Dzire (4+1, Diesel)' },
              { key: 'TOYOTA_ETIOS', name: 'Sedan – Toyota Etios', sub: 'Etios (4+1, Diesel Boot)' },
              { key: 'SUV_ERTIGA', name: 'SUV – Ertiga', sub: 'Ertiga (6+1, CNG / Petrol)' },
              { key: 'SUV_CARENS', name: 'SUV – Kia Carens', sub: 'Carens Diesel Luxury (6+1)' },
              { key: 'SUV_INNOVA', name: 'SUV – Toyota Innova', sub: 'Innova Diesel (6+1 / 7+1)' },
              { key: 'SUV_CRYSTA', name: 'SUV – Innova Crysta', sub: 'Innova Crysta Luxury (6+1)' },
              { key: 'TEMPO_TRAVELER', name: 'Tempo Traveller', sub: 'Force Traveller 12-17 Seater' },
              { key: 'URBANIA', name: 'Force Urbania Luxury', sub: '10-17 Seater Luxury Van' },
            ].map((fleet) => {
              const currentFleet = chauffeurConfig.fleetRates?.[fleet.key] || { dayAllowance: 350, nightAllowance: 250 };

              return (
                <div
                  key={fleet.key}
                  className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl hover:border-slate-300 transition flex flex-col justify-between shadow-2xs space-y-2.5"
                >
                  <div>
                    <span className="text-xs font-black text-slate-900 block">{fleet.name}</span>
                    <span className="text-[10px] text-slate-400 line-clamp-1">{fleet.sub}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/60">
                    <div>
                      <span className="text-[10px] font-bold text-slate-600 block mb-1">Day Bata (₹):</span>
                      <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                        <span className="text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={currentFleet.dayAllowance}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setChauffeurConfig((prev) => ({
                              ...prev,
                              fleetRates: {
                                ...prev.fleetRates,
                                [fleet.key]: {
                                  ...currentFleet,
                                  dayAllowance: val,
                                },
                              },
                            }));
                          }}
                          className="w-full text-right font-mono font-black text-xs text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-600 block mb-1">Night Bata (₹):</span>
                      <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                        <span className="text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={currentFleet.nightAllowance}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setChauffeurConfig((prev) => ({
                              ...prev,
                              fleetRates: {
                                ...prev.fleetRates,
                                [fleet.key]: {
                                  ...currentFleet,
                                  nightAllowance: val,
                                },
                              },
                            }));
                          }}
                          className="w-full text-right font-mono font-black text-xs text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
