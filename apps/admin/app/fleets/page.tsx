'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AdminNavbar } from '@/components/AdminNavbar';

export const dynamic = 'force-dynamic';

export default function AdminFleetsPage() {
  const [fleets, setFleets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFleet, setEditingFleet] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchFleets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/fleets');
      if (res.ok) {
        const data = await res.json();
        setFleets(data.fleets || []);
      }
    } catch (err) {
      console.error('Failed to load fleet categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFleets();
  }, [fetchFleets]);

  const handleSaveFleet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFleet) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/fleets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingFleet),
      });

      if (res.ok) {
        setEditingFleet(null);
        await fetchFleets();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save fleet configuration');
      }
    } catch (err) {
      console.error('Error saving fleet:', err);
      alert('Error saving fleet category');
    } finally {
      setSaving(false);
    }
  };

  const displayedFleets = React.useMemo(() => {
    if (!fleets || fleets.length === 0) return [];
    if (!search.trim()) return fleets;
    const q = search.toLowerCase().trim();
    return fleets.filter((f) => {
      const catMatch = f.category?.toLowerCase().includes(q);
      const nameMatch = f.name?.toLowerCase().includes(q);
      const descMatch = f.description?.toLowerCase().includes(q);
      return catMatch || nameMatch || descMatch;
    });
  }, [fleets, search]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-5 space-y-3 sm:space-y-4">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              Fleet Vehicle Categories & Specs
            </h1>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64 min-w-0">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fleets..."
                className="w-full pl-8 pr-3 py-1.5 sm:py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition shadow-2xs"
              />
              <span className="absolute left-2.5 top-2 sm:top-2.5 text-xs text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>

            <Link
              href="/pricing"
              className="px-3 py-1.5 sm:py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs whitespace-nowrap shrink-0"
            >
              Pricing Rules
            </Link>

            <button
              type="button"
              onClick={() => fetchFleets()}
              title="Refresh fleets"
              aria-label="Refresh fleets"
              className="p-2 sm:p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl flex items-center justify-center transition shadow-2xs cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>


        {/* Fleet Categories Grid */}
        {loading && fleets.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
            <div>Loading fleet configuration...</div>
          </div>
        ) : displayedFleets.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200 shadow-xs">
            No fleet categories match "{search}".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {displayedFleets.map((fleet) => (
              <div
                key={fleet.category}
                className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4.5 flex flex-col justify-between hover:border-amber-400 hover:shadow-md transition shadow-xs"
              >
                <div className="space-y-4">
                  {/* Category Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-950 bg-amber-500 px-2 py-0.5 rounded-md shadow-2xs">
                        {fleet.category}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">{fleet.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{fleet.description || 'No description provided'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          fleet.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {fleet.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {(fleet.isContactOnly || fleet.category === 'TEMPO_TRAVELER' || fleet.category === 'URBANIA') && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                          Contact & Book Only
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vehicle Physical Capacities */}
                  <div className="grid grid-cols-2 gap-2 py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px] font-semibold">Seating Capacity:</span>
                      <span className="font-bold text-slate-900 text-sm">{fleet.seatCount} Passengers</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px] font-semibold">Boot Luggage:</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {fleet.luggageCount > 0 ? `${fleet.luggageCount} Standard Bags` : 'No Boot Space'}
                      </span>
                    </div>
                  </div>

                  {/* Fuel Types Enablement */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Supported Fuel Types:
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {/* CNG */}
                      <div
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center ${
                          fleet.cngEnabled
                            ? 'bg-slate-50 border-slate-200 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <span className="font-bold text-xs">CNG</span>
                        <span className={`text-[10px] font-black mt-0.5 ${fleet.cngEnabled ? 'text-slate-900' : 'text-slate-400'}`}>
                          {fleet.cngEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>

                      {/* Petrol */}
                      <div
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center ${
                          fleet.petrolEnabled
                            ? 'bg-slate-50 border-slate-200 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <span className="font-bold text-xs">PETROL</span>
                        <span className={`text-[10px] font-black mt-0.5 ${fleet.petrolEnabled ? 'text-slate-900' : 'text-slate-400'}`}>
                          {fleet.petrolEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>

                      {/* Diesel */}
                      <div
                        className={`p-2 rounded-xl border flex flex-col items-center justify-center ${
                          fleet.dieselEnabled
                            ? 'bg-slate-50 border-slate-200 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <span className="font-bold text-xs">DIESEL</span>
                        <span className={`text-[10px] font-black mt-0.5 ${fleet.dieselEnabled ? 'text-slate-900' : 'text-slate-400'}`}>
                          {fleet.dieselEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Wheelbase & Seater Variants for Urbania / Van Fleets */}
                  {(fleet.category === 'TEMPO_TRAVELER' || fleet.category === 'URBANIA' || fleet.name?.toLowerCase().includes('urbania') || fleet.name?.toLowerCase().includes('traveller')) && (
                    <div className="space-y-2 text-xs rounded-xl border p-3 bg-slate-50 border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold uppercase text-[10px] flex items-center gap-1">
                          Wheelbase & Seater Variants:
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-white text-slate-700 border border-slate-200">
                          3 Wheelbases • 6 Seater Types
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 text-[11px] block">Short Wheelbase (3350 mm)</span>
                            <span className="text-[10px] text-slate-500">10-Seater (10 + Driver) • 8 Bags</span>
                          </div>
                          <span className="font-black text-slate-900 text-xs bg-slate-50 px-2 py-0.5 rounded border border-slate-200">₹28/km</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 text-[11px] block">Medium Wheelbase (3615 mm)</span>
                            <span className="text-[10px] text-slate-500">12, 13 & 14-Seater (plus driver) • 10 Bags</span>
                          </div>
                          <span className="font-black text-slate-900 text-xs bg-slate-50 px-2 py-0.5 rounded border border-slate-200">₹30-34/km</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 text-[11px] block">Long Wheelbase (4400 mm)</span>
                            <span className="text-[10px] text-slate-500">16 & 17-Seater (plus driver) • 12 Bags</span>
                          </div>
                          <span className="font-black text-slate-900 text-xs bg-slate-50 px-2 py-0.5 rounded border border-slate-200">₹36-38/km</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Roof Carrier / Luggage Carriage Status */}
                  <div className="space-y-2 text-xs rounded-xl border p-3 bg-slate-50 border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-bold uppercase text-[10px]">Roof Carrier / Carriage:</span>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold border bg-white text-slate-700 border-slate-200"
                      >
                        {fleet.hasCarrier ? 'Carrier Available' : 'Carrier Excluded / No Carrier'}
                      </span>
                    </div>

                    {fleet.hasCarrier ? (
                      <div className="space-y-1.5 mt-1">
                        <div className="text-[11px] text-slate-900 font-semibold flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                          <span>{fleet.carrierCapacityText || 'Up to 50 kg space'}</span>
                        </div>

                        {fleet.carrierExcludedCars ? (
                          <div className="text-[11px] text-slate-800 font-semibold flex items-start gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                            <div>
                              <span className="font-bold text-slate-900">Excluded Models (No Carrier): </span>
                              <span>{fleet.carrierExcludedCars}</span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-600 font-semibold mt-1 flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                        <span>{fleet.carrierExcludedReason || 'No Roof Carrier Allowed (Boot luggage only)'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Button */}
                <div className="mt-5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setEditingFleet({ ...fleet })}
                    className="w-full py-2 bg-[#162232] hover:bg-[#1f2f45] text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                  >
                    Edit Fleet Specs & Carrier
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Fleet Modal */}
      {editingFleet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white border-0 sm:border border-slate-200 rounded-none sm:rounded-2xl max-w-lg w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4 shadow-xl flex flex-col">
            <div className="flex justify-between items-center pb-2.5 sm:pb-3 border-b border-slate-200 shrink-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                Edit Fleet: {editingFleet.category}
              </h3>
              <button
                type="button"
                onClick={() => setEditingFleet(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 font-bold text-base transition cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFleet} className="space-y-3 sm:space-y-4 text-xs flex-1 flex flex-col justify-between">
              <div className="space-y-3 sm:space-y-4">
                {/* Name & Models */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Display Name</label>
                    <input
                      type="text"
                      value={editingFleet.name}
                      onChange={(e) => setEditingFleet({ ...editingFleet, name: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 sm:p-2 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Description / Models</label>
                    <input
                      type="text"
                      value={editingFleet.description || ''}
                      onChange={(e) => setEditingFleet({ ...editingFleet, description: e.target.value })}
                      placeholder="e.g. Toyota Glanza, WagonR, Swift"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 sm:p-2 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Physical Capacities */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Passenger Seats</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={editingFleet.seatCount}
                      onChange={(e) => setEditingFleet({ ...editingFleet, seatCount: parseInt(e.target.value) || 4 })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 sm:p-2 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Boot Luggage Bags</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={editingFleet.luggageCount}
                      onChange={(e) => setEditingFleet({ ...editingFleet, luggageCount: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 sm:p-2 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {/* Fuel Type Enablement */}
                <div className="p-2.5 sm:p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 sm:space-y-2">
                  <div className="font-bold text-slate-800 uppercase text-xs">Supported Fuel Types</div>
                  <p className="text-[11px] text-slate-500">Enable or disable specific fuels for this category. Disabled fuels will not be shown to customers.</p>
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
                    {/* CNG */}
                    <label className={`p-2 sm:p-2.5 rounded-xl border flex items-center gap-1.5 sm:gap-2 cursor-pointer transition ${editingFleet.cngEnabled ? 'bg-slate-100 border-slate-300 text-slate-900 font-bold' : 'bg-white border-slate-300 text-slate-500'}`}>
                      <input
                        type="checkbox"
                        checked={editingFleet.cngEnabled}
                        onChange={(e) => setEditingFleet({ ...editingFleet, cngEnabled: e.target.checked })}
                        className="w-4 h-4 accent-slate-900 rounded"
                      />
                      <span className="font-bold text-xs">CNG</span>
                    </label>

                    {/* Petrol */}
                    <label className={`p-2 sm:p-2.5 rounded-xl border flex items-center gap-1.5 sm:gap-2 cursor-pointer transition ${editingFleet.petrolEnabled ? 'bg-slate-100 border-slate-300 text-slate-900 font-bold' : 'bg-white border-slate-300 text-slate-500'}`}>
                      <input
                        type="checkbox"
                        checked={editingFleet.petrolEnabled}
                        onChange={(e) => setEditingFleet({ ...editingFleet, petrolEnabled: e.target.checked })}
                        className="w-4 h-4 accent-slate-900 rounded"
                      />
                      <span className="font-bold text-xs">Petrol</span>
                    </label>

                    {/* Diesel */}
                    <label className={`p-2 sm:p-2.5 rounded-xl border flex items-center gap-1.5 sm:gap-2 cursor-pointer transition ${editingFleet.dieselEnabled ? 'bg-slate-100 border-slate-300 text-slate-900 font-bold' : 'bg-white border-slate-300 text-slate-500'}`}>
                      <input
                        type="checkbox"
                        checked={editingFleet.dieselEnabled}
                        onChange={(e) => setEditingFleet({ ...editingFleet, dieselEnabled: e.target.checked })}
                        className="w-4 h-4 accent-slate-900 rounded"
                      />
                      <span className="font-bold text-xs">Diesel</span>
                    </label>
                  </div>
                </div>

                {/* Roof Carrier & Excluded Cars Controls */}
                <div className="p-2.5 sm:p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800 uppercase text-xs">Roof Carrier / Luggage Carriage</div>
                    <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingFleet.hasCarrier}
                        onChange={(e) => setEditingFleet({ ...editingFleet, hasCarrier: e.target.checked })}
                        className="w-4 h-4 accent-slate-900 rounded"
                      />
                      <span className="font-bold text-xs text-slate-800">Carrier Available</span>
                    </label>
                  </div>

                  {editingFleet.hasCarrier ? (
                    <div className="space-y-2.5 sm:space-y-3">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Carrier Capacity & Available Models</label>
                        <input
                          type="text"
                          value={editingFleet.carrierCapacityText || ''}
                          onChange={(e) => setEditingFleet({ ...editingFleet, carrierCapacityText: e.target.value })}
                          placeholder="e.g. Up to 50 kg space (Available on WagonR, Swift, etc.)"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 sm:p-2 text-slate-900 focus:ring-2 focus:ring-slate-400 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">Visible to customers as an available luggage carrier feature.</span>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">
                          Excluded Cars / Models for Carrier (No Carrier)
                        </label>
                        <input
                          type="text"
                          value={editingFleet.carrierExcludedCars || ''}
                          onChange={(e) => setEditingFleet({ ...editingFleet, carrierExcludedCars: e.target.value })}
                          placeholder="e.g. Tata Tiago (No Roof Carrier - Boot space only)"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 sm:p-2 text-slate-900 focus:ring-2 focus:ring-slate-400 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Specify models like <strong>Tata Tiago</strong> where carrier is excluded. Remaining cars in category remain available with carrier.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Carrier Exclusion Reason / Note</label>
                      <input
                        type="text"
                        value={editingFleet.carrierExcludedReason || ''}
                        onChange={(e) => setEditingFleet({ ...editingFleet, carrierExcludedReason: e.target.value })}
                        placeholder="e.g. No Roof Carrier Allowed (Boot Space Only)"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 sm:p-2 text-slate-900 focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">Displayed to customers explaining why carrier is excluded for this category.</span>
                    </div>
                  )}
                </div>

                {/* Contact Only Toggle */}
                <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isContactOnly"
                      checked={editingFleet.isContactOnly || editingFleet.category === 'TEMPO_TRAVELER' || editingFleet.category === 'URBANIA'}
                      onChange={(e) => setEditingFleet({ ...editingFleet, isContactOnly: e.target.checked })}
                      className="w-4 h-4 accent-slate-900 rounded"
                    />
                    <label htmlFor="isContactOnly" className="text-slate-900 font-bold cursor-pointer text-xs flex items-center gap-1">
                      Contact & Book Only (Requires Quote & Phone/WhatsApp Inquiry)
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-500 pl-6">
                    When enabled, customers cannot book directly online. Instead, they will be prompted to contact dispatch via WhatsApp or phone call for tailored quoting and commercial permit scheduling.
                  </p>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editingFleet.isActive}
                    onChange={(e) => setEditingFleet({ ...editingFleet, isActive: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <label htmlFor="isActive" className="text-slate-700 font-semibold cursor-pointer">
                    Vehicle Category Active for Customer Bookings
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditingFleet(null)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-xs cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Fleet Specs'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
