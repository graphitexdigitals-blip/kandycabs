'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminNavbar } from '@/components/AdminNavbar';
import {
  DEFAULT_CANCELLATION_CONFIG,
  CancellationRatesConfig,
  TripTypeCancellationRule,
  DEFAULT_TRIP_TYPE_CANCELLATION_RULES,
  SUPPORTED_TRIP_TYPES_FOR_CANCELLATION,
  ALL_FLEET_CATEGORIES_FOR_CANCELLATION,
} from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export default function CancellationPage() {
  const [config, setConfig] = useState<CancellationRatesConfig>({
    ...DEFAULT_CANCELLATION_CONFIG,
    rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
    tripTypeRules: { ...DEFAULT_TRIP_TYPE_CANCELLATION_RULES },
  });
  const [selectedTripType, setSelectedTripType] = useState<string>('ONEWAY');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/cancellation-rates');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setConfig({
            windowHours: data.config.windowHours ?? DEFAULT_CANCELLATION_CONFIG.windowHours,
            rates: { ...DEFAULT_CANCELLATION_CONFIG.rates, ...(data.config.rates || {}) },
            tripTypeRules: {
              ...DEFAULT_TRIP_TYPE_CANCELLATION_RULES,
              ...(data.config.tripTypeRules || {}),
            },
          });
        }
      }
    } catch (err) {
      console.error('Failed to load cancellation rules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/cancellation-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setToastMessage('Cancellation Rules saved successfully for all fleets and trip types!');
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        alert('Failed to save cancellation settings');
      }
    } catch (err: any) {
      console.error('Error saving cancellation settings:', err);
      alert('Error saving cancellation settings: ' + (err.message || 'Network error'));
    } finally {
      setSaving(false);
    }
  };

  const currentRule: TripTypeCancellationRule =
    config.tripTypeRules?.[selectedTripType] ??
    DEFAULT_TRIP_TYPE_CANCELLATION_RULES[selectedTripType] ?? {
      enabled: true,
      windowHours: config.windowHours ?? 3,
      rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
    };

  const updateCurrentRule = (updates: Partial<TripTypeCancellationRule>) => {
    setConfig((prev) => {
      const existingRules = prev.tripTypeRules ?? { ...DEFAULT_TRIP_TYPE_CANCELLATION_RULES };
      const current = existingRules[selectedTripType] ?? {
        enabled: true,
        windowHours: prev.windowHours ?? 3,
        rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
      };

      return {
        ...prev,
        tripTypeRules: {
          ...existingRules,
          [selectedTripType]: {
            ...current,
            ...updates,
          },
        },
      };
    });
  };

  const handleFleetRateChange = (category: string, amount: number) => {
    const updatedRates = {
      ...(currentRule.rates || DEFAULT_CANCELLATION_CONFIG.rates),
      [category]: Math.max(0, amount),
    };
    updateCurrentRule({ rates: updatedRates });
  };

  const handleQuickBatch = (type: 'DEFAULT' | 'ALL_500' | 'ALL_1000' | 'ZERO_ALL') => {
    let newRates: Record<string, number> = {};
    if (type === 'DEFAULT') {
      newRates = { ...DEFAULT_CANCELLATION_CONFIG.rates };
    } else if (type === 'ALL_500') {
      ALL_FLEET_CATEGORIES_FOR_CANCELLATION.forEach((f) => {
        newRates[f.category] = 500;
      });
    } else if (type === 'ALL_1000') {
      ALL_FLEET_CATEGORIES_FOR_CANCELLATION.forEach((f) => {
        newRates[f.category] = 1000;
      });
    } else if (type === 'ZERO_ALL') {
      ALL_FLEET_CATEGORIES_FOR_CANCELLATION.forEach((f) => {
        newRates[f.category] = 0;
      });
    }
    updateCurrentRule({ rates: newRates });
  };

  const handleApplyToAllTripTypes = () => {
    if (
      !confirm(
        `Apply the current cancellation configuration for "${SUPPORTED_TRIP_TYPES_FOR_CANCELLATION.find((t) => t.key === selectedTripType)?.label}" across ALL trip types?`
      )
    ) {
      return;
    }

    setConfig((prev) => {
      const newRules: Record<string, TripTypeCancellationRule> = {};
      SUPPORTED_TRIP_TYPES_FOR_CANCELLATION.forEach((t) => {
        newRules[t.key] = {
          enabled: currentRule.enabled,
          windowHours: currentRule.windowHours,
          rates: { ...currentRule.rates },
        };
      });
      return {
        ...prev,
        windowHours: currentRule.windowHours,
        rates: { ...currentRule.rates },
        tripTypeRules: newRules,
      };
    });

    setToastMessage(`Settings applied to all trip types! Click "Save Cancellation Rules" to persist.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const selectedTripMeta =
    SUPPORTED_TRIP_TYPES_FOR_CANCELLATION.find((t) => t.key === selectedTripType) ||
    SUPPORTED_TRIP_TYPES_FOR_CANCELLATION[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <AdminNavbar />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <svg className="w-5 h-5 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Cancellation Rules & Policy
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
              Configure fleet cancellation charges across all trip types (One Way, Round Trip, Airport, Local Rental, Tour). Toggle cancellation charges on or off for any trip type (e.g. Free Cancellation with no charges required).
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={fetchRates}
              disabled={loading || saving}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:scale-98 rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Cancellation Rules</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Trip Type Selector Tabs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {SUPPORTED_TRIP_TYPES_FOR_CANCELLATION.map((trip) => {
              const isSelected = selectedTripType === trip.key;
              const rule = config.tripTypeRules?.[trip.key];
              const isChargesEnabled = rule ? rule.enabled : true;

              return (
                <button
                  key={trip.key}
                  type="button"
                  onClick={() => setSelectedTripType(trip.key)}
                  className={`flex-1 min-w-[150px] p-3 rounded-xl text-left border transition ${
                    isSelected
                      ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                      : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-black ${isSelected ? 'text-rose-900' : 'text-slate-800'}`}>
                      {trip.label}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                        isChargesEnabled
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isChargesEnabled ? 'Fee Active' : 'Free (₹0)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{trip.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Trip Type Configuration Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6">
          {/* Main Toggle: Enable / No Need of Cancellation Charges */}
          <div className={`p-4 sm:p-5 rounded-2xl border-2 transition ${
            currentRule.enabled
              ? 'bg-amber-50/50 border-amber-200'
              : 'bg-emerald-50 border-emerald-300 shadow-xs'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${currentRule.enabled ? 'bg-amber-500' : 'bg-emerald-600'}`} />
                  <span className="text-sm font-black text-slate-900">
                    Require Cancellation Charges for {selectedTripMeta.label}?
                  </span>
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                    currentRule.enabled
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}>
                    {currentRule.enabled ? 'CANCELLATION CHARGES ACTIVE' : 'NO CANCELLATION CHARGES (FREE)'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 max-w-2xl">
                  {currentRule.enabled
                    ? `Cancellations on ${selectedTripMeta.label} will incur the fleet fee below if cancelled within the pickup window (${currentRule.windowHours} hours before pickup). More than ${currentRule.windowHours}h is free.`
                    : `✓ Customers and Admin will enjoy 100% Free Cancellation at all times on ${selectedTripMeta.label} trips. No cancellation charge will ever be deducted.`}
                </p>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-bold text-slate-600">
                  {currentRule.enabled ? 'Charges Enabled' : 'No Charges (Free)'}
                </span>
                <button
                  type="button"
                  onClick={() => updateCurrentRule({ enabled: !currentRule.enabled })}
                  className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    currentRule.enabled ? 'bg-rose-600' : 'bg-emerald-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      currentRule.enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Conditional Fee Settings (Only when Charges are Enabled) */}
          {currentRule.enabled ? (
            <div className="space-y-6 animate-in fade-in">
              {/* Pickup Window Setting */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900">Cancellation Pickup Window</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">Policy Window</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Charges apply only when customer or admin cancels within this timeframe prior to scheduled pickup.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-600 font-medium">Charge within:</span>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    value={currentRule.windowHours}
                    onChange={(e) =>
                      updateCurrentRule({
                        windowHours: Math.max(1, parseInt(e.target.value) || 3),
                      })
                    }
                    className="w-20 px-3 py-1.5 text-xs font-black text-center border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-rose-500 shadow-2xs"
                  />
                  <span className="text-xs font-bold text-slate-700">Hours</span>
                </div>
              </div>

              {/* Quick Batch Actions & Apply to All Trip Types */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500 mr-1">Quick Rates:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickBatch('DEFAULT')}
                    className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition"
                  >
                    Reset Defaults (₹500 / ₹1000)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickBatch('ALL_500')}
                    className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition"
                  >
                    Set All to ₹500
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickBatch('ALL_1000')}
                    className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition"
                  >
                    Set All to ₹1000
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleApplyToAllTripTypes}
                  className="px-3 py-1.5 text-xs font-black bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Apply this configuration to ALL Trip Types</span>
                </button>
              </div>

              {/* Group 1: Compact & Sedans */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Compact & Sedans
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">Default: ₹500</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {ALL_FLEET_CATEGORIES_FOR_CANCELLATION.filter((f) => f.group === 'COMPACT_SEDAN').map(
                    (fleet) => {
                      const currentFee = currentRule.rates?.[fleet.category] ?? fleet.defaultRate;

                      return (
                        <div
                          key={fleet.category}
                          className="p-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition flex flex-col justify-between shadow-2xs gap-3"
                        >
                          <div>
                            <span className="text-xs font-black text-slate-900 line-clamp-1">
                              {fleet.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {fleet.category}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                            <span className="text-[11px] font-bold text-slate-500">Cancel Charge:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-black text-slate-600">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={currentFee}
                                onChange={(e) =>
                                  handleFleetRateChange(fleet.category, parseInt(e.target.value) || 0)
                                }
                                className="w-20 px-2.5 py-1 text-xs font-black text-right border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-rose-500 shadow-2xs"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Group 2: SUVs, MPVs & Luxury Fleets */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      SUVs, MPVs & Luxury Fleets
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">Default: ₹1000</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {ALL_FLEET_CATEGORIES_FOR_CANCELLATION.filter((f) => f.group === 'REST_FLEETS').map(
                    (fleet) => {
                      const currentFee = currentRule.rates?.[fleet.category] ?? fleet.defaultRate;

                      return (
                        <div
                          key={fleet.category}
                          className="p-3.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition flex flex-col justify-between shadow-2xs gap-3"
                        >
                          <div>
                            <span className="text-xs font-black text-slate-900 line-clamp-1">
                              {fleet.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {fleet.category}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                            <span className="text-[11px] font-bold text-slate-500">Cancel Charge:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-black text-slate-600">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={currentFee}
                                onChange={(e) =>
                                  handleFleetRateChange(fleet.category, parseInt(e.target.value) || 0)
                                }
                                className="w-20 px-2.5 py-1 text-xs font-black text-right border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-rose-500 shadow-2xs"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xl font-bold">
                ✓
              </div>
              <h3 className="text-sm font-black text-emerald-950">
                Free Cancellation Active for {selectedTripMeta.label}
              </h3>
              <p className="text-xs text-emerald-800 max-w-md mx-auto">
                No cancellation charges will be billed for {selectedTripMeta.label} trips. If a trip is cancelled at any time by customer or admin, the advance amount will be fully refundable (₹0 fee).
              </p>
              <button
                type="button"
                onClick={() => updateCurrentRule({ enabled: true })}
                className="mt-3 px-4 py-2 text-xs font-bold text-emerald-700 bg-white border border-emerald-300 rounded-xl hover:bg-emerald-100 transition shadow-xs"
              >
                Enable Cancellation Charges for {selectedTripMeta.label}
              </button>
            </div>
          )}

          {/* Footer Save Button */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="px-6 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:scale-98 rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? 'Saving Cancellation Rules...' : 'Save All Cancellation Rules'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

