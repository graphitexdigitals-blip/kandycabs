'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export interface AdditionalRequirementsData {
  travellers: number;
  luggageType: string;
  seniorCitizens: boolean;
  returnJourneyLater: boolean;
  needAirportDrop: boolean;
  needAirportPickup: boolean;
  petFriendly: boolean;
  babyOnBoard: boolean;
}

interface AdditionalRequirementsModalProps {
  isOpen: boolean;
  maxSeats: number;
  initialData: AdditionalRequirementsData;
  onClose: () => void;
  onApply: (data: AdditionalRequirementsData) => void;
}

const LUGGAGE_OPTIONS = [
  { id: 'NONE', label: 'No Luggage (Cabin Only)', count: 0 },
  { id: 'NORMAL', label: '1 - 2 Normal Luggage Bags (Suitcase)', count: 2 },
  { id: 'MEDIUM', label: '3 - 4 Medium / Large Bags', count: 4 },
  { id: 'HEAVY', label: '5+ Heavy / Extra Luggage', count: 5 },
];

export function AdditionalRequirementsModal({
  isOpen,
  maxSeats,
  initialData,
  onClose,
  onApply,
}: AdditionalRequirementsModalProps) {
  const [travellers, setTravellers] = useState(initialData.travellers || 0);
  const [luggageType, setLuggageType] = useState(initialData.luggageType || 'NORMAL');
  const [seniorCitizens, setSeniorCitizens] = useState(initialData.seniorCitizens || false);
  const [returnJourneyLater, setReturnJourneyLater] = useState(initialData.returnJourneyLater || false);
  const [needAirportDrop, setNeedAirportDrop] = useState(initialData.needAirportDrop || false);
  const [needAirportPickup, setNeedAirportPickup] = useState(initialData.needAirportPickup || false);
  const [petFriendly, setPetFriendly] = useState(initialData.petFriendly || false);
  const [babyOnBoard, setBabyOnBoard] = useState(initialData.babyOnBoard || false);

  if (!isOpen) return null;

  const handleSave = () => {
    onApply({
      travellers,
      luggageType,
      seniorCitizens,
      returnJourneyLater,
      needAirportDrop,
      needAirportPickup,
      petFriendly,
      babyOnBoard,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative border border-slate-100">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Additional Requirements</h3>
            <p className="text-xs text-slate-500">Select travellers, luggage & ride preferences</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
          >
            ✕
          </button>
        </div>

        <div className="py-4 space-y-5">
          {/* Travellers Stepper */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#f0750f] flex items-center justify-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Travellers</p>
                <p className="text-xs text-slate-500">
                  {travellers} of max {maxSeats} seats selected
                </p>
              </div>
            </div>

            {/* Stepper buttons */}
            <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setTravellers((prev) => Math.max(0, prev - 1))}
                className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold text-lg"
              >
                −
              </button>
              <span className="w-9 text-center font-bold text-sm text-slate-900">
                {travellers}
              </span>
              <button
                type="button"
                onClick={() => setTravellers((prev) => Math.min(maxSeats, prev + 1))}
                className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold text-lg"
              >
                +
              </button>
            </div>
          </div>

          {/* Luggage Load Section */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#f0750f] flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Luggage Load</p>
                <p className="text-xs text-slate-500">Tap to select baggage estimate</p>
              </div>
            </div>

            <select
              value={luggageType}
              onChange={(e) => setLuggageType(e.target.value)}
              className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#f0750f]"
            >
              {LUGGAGE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Ride Preference Toggles */}
          <div className="space-y-3 pt-1">
            {/* 1. Senior Citizens */}
            <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
                  👴
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Senior Citizens (Above Age 60)?</p>
                  <p className="text-xs text-slate-500">Enable this for easy access seating & driver assistance.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={seniorCitizens}
                onChange={(e) => setSeniorCitizens(e.target.checked)}
                className="w-5 h-5 accent-[#f0750f] rounded cursor-pointer"
              />
            </div>

            {/* 2. Need a Return Journey */}
            <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                  🔄
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Need a Return Journey Later?</p>
                  <p className="text-xs text-slate-500">Enable this if you may need a return trip on a later date.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={returnJourneyLater}
                onChange={(e) => setReturnJourneyLater(e.target.checked)}
                className="w-5 h-5 accent-[#f0750f] rounded cursor-pointer"
              />
            </div>

            {/* 3. Need an Airport Drop */}
            <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-lg">
                  🛫
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Need an Airport Drop?</p>
                  <p className="text-xs text-slate-500">Enable this if you need to be dropped at the airport.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={needAirportDrop}
                onChange={(e) => setNeedAirportDrop(e.target.checked)}
                className="w-5 h-5 accent-[#f0750f] rounded cursor-pointer"
              />
            </div>

            {/* 4. Need an Airport Pickup */}
            <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-lg">
                  🛬
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Need an Airport Pickup?</p>
                  <p className="text-xs text-slate-500">Enable this if you need to be picked up from the airport.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={needAirportPickup}
                onChange={(e) => setNeedAirportPickup(e.target.checked)}
                className="w-5 h-5 accent-[#f0750f] rounded cursor-pointer"
              />
            </div>

            {/* 5. Pet Friendly */}
            <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                  🐾
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Pet Friendly</p>
                  <p className="text-xs text-slate-500">Enable this if you are traveling with pets.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={petFriendly}
                onChange={(e) => setPetFriendly(e.target.checked)}
                className="w-5 h-5 accent-[#f0750f] rounded cursor-pointer"
              />
            </div>

            {/* 6. Baby on Board */}
            <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center font-bold text-lg">
                  👶
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Baby on Board</p>
                  <p className="text-xs text-slate-500">Enable this if traveling with an infant or child.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={babyOnBoard}
                onChange={(e) => setBabyOnBoard(e.target.checked)}
                className="w-5 h-5 accent-[#f0750f] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="pt-3 border-t border-slate-100">
          <button
            onClick={handleSave}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-[#f0750f] hover:bg-[#ea580c] transition-colors shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 text-sm"
          >
            Save & Apply Requirements ✓
          </button>
        </div>
      </div>
    </div>
  );
}
