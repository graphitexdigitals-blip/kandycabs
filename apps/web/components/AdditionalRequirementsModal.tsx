'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export interface LuggageCounts {
  small: number;
  medium: number;
  large: number;
  xlarge: number;
}

export interface AdditionalRequirementsData {
  travellers: number;
  luggageType: string;
  luggageCounts?: LuggageCounts;
  seniorCitizens: boolean;
  returnJourneyLater: boolean;
  needAirportDrop: boolean;
  needAirportPickup: boolean;
  petFriendly: boolean;
  petType?: 'cat' | 'dog' | 'bird';
  babyOnBoard: boolean;
  pregnancyFriendly?: boolean;
  accessibilityAssistance?: boolean;
  specialNotes?: string;
}

interface AdditionalRequirementsModalProps {
  isOpen: boolean;
  maxSeats: number;
  initialData: AdditionalRequirementsData;
  onClose: () => void;
  onApply: (data: AdditionalRequirementsData) => void;
}

interface LuggageItemDef {
  id: keyof LuggageCounts;
  name: string;
  desc: string;
  image: string;
}

const LUGGAGE_ITEMS: LuggageItemDef[] = [
  {
    id: 'small',
    name: 'Small Bag',
    desc: 'Handbags, laptop bags & small personal bags',
    image: '/images/luggage-small.png',
  },
  {
    id: 'medium',
    name: 'Medium Bag - 10 Kgs',
    desc: 'Cabin-size trolley bags & carry-on suitcases',
    image: '/images/luggage-medium.png',
  },
  {
    id: 'large',
    name: 'Large Bag - 20 Kgs',
    desc: 'Standard check-in suitcases & travel bags',
    image: '/images/luggage-large.png',
  },
  {
    id: 'xlarge',
    name: 'Extra Large Bag - 30 Kgs',
    desc: 'Oversized check-in suitcases & large travel bags',
    image: '/images/luggage-extra-large.png',
  },
];

export function AdditionalRequirementsModal({
  isOpen,
  maxSeats,
  initialData,
  onClose,
  onApply,
}: AdditionalRequirementsModalProps) {
  const [travellers, setTravellers] = useState(initialData.travellers || 0);

  // Luggage state
  const [isLuggageDropdownOpen, setIsLuggageDropdownOpen] = useState(false);
  const [luggageCounts, setLuggageCounts] = useState<LuggageCounts>(
    initialData.luggageCounts || {
      small: initialData.luggageType === 'NORMAL' ? 1 : 0,
      medium: initialData.luggageType === 'MEDIUM' ? 2 : 0,
      large: initialData.luggageType === 'HEAVY' ? 3 : 0,
      xlarge: 0,
    }
  );

  // Toggle options state
  const [seniorCitizens, setSeniorCitizens] = useState(initialData.seniorCitizens || false);
  const [returnJourneyLater, setReturnJourneyLater] = useState(initialData.returnJourneyLater || false);
  const [needAirportDrop, setNeedAirportDrop] = useState(initialData.needAirportDrop || false);
  const [needAirportPickup, setNeedAirportPickup] = useState(initialData.needAirportPickup || false);
  const [petFriendly, setPetFriendly] = useState(initialData.petFriendly || false);
  const [petType, setPetType] = useState<'cat' | 'dog' | 'bird'>(initialData.petType || 'dog');
  const [babyOnBoard, setBabyOnBoard] = useState(initialData.babyOnBoard || false);
  const [pregnancyFriendly, setPregnancyFriendly] = useState(initialData.pregnancyFriendly || false);
  const [accessibilityAssistance, setAccessibilityAssistance] = useState(initialData.accessibilityAssistance || false);

  // Notes state
  const [specialNotes, setSpecialNotes] = useState(initialData.specialNotes || '');

  if (!isOpen) return null;

  const totalBags =
    luggageCounts.small +
    luggageCounts.medium +
    luggageCounts.large +
    luggageCounts.xlarge;

  const handleIncrementBag = (id: keyof LuggageCounts) => {
    setLuggageCounts((prev) => ({
      ...prev,
      [id]: prev[id] + 1,
    }));
  };

  const handleDecrementBag = (id: keyof LuggageCounts) => {
    setLuggageCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, prev[id] - 1),
    }));
  };

  // Convert luggage counts into summary string
  const getLuggageSummary = () => {
    if (totalBags === 0) {
      return {
        title: 'Select Bags (Small, Medium, Large...)',
        desc: 'Tap to choose multiple bag types & quantities',
      };
    }
    const parts: string[] = [];
    if (luggageCounts.small > 0) parts.push(`${luggageCounts.small} Small`);
    if (luggageCounts.medium > 0) parts.push(`${luggageCounts.medium} Medium`);
    if (luggageCounts.large > 0) parts.push(`${luggageCounts.large} Large`);
    if (luggageCounts.xlarge > 0) parts.push(`${luggageCounts.xlarge} Extra Large`);

    return {
      title: `${totalBags} Bag${totalBags > 1 ? 's' : ''} Selected (${parts.join(', ')})`,
      desc: 'Tap to modify bag quantities',
    };
  };

  const luggageSummary = getLuggageSummary();

  const handleSave = () => {
    // Determine legacy luggageType for backwards compatibility
    let legacyType = 'NONE';
    if (totalBags === 0) legacyType = 'NONE';
    else if (totalBags <= 2) legacyType = 'NORMAL';
    else if (totalBags <= 4) legacyType = 'MEDIUM';
    else legacyType = 'HEAVY';

    onApply({
      travellers,
      luggageType: legacyType,
      luggageCounts,
      seniorCitizens,
      returnJourneyLater,
      needAirportDrop,
      needAirportPickup,
      petFriendly,
      petType: petFriendly ? petType : undefined,
      babyOnBoard,
      pregnancyFriendly,
      accessibilityAssistance,
      specialNotes: specialNotes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl relative border border-slate-100 flex flex-col space-y-4">
        {/* Header matching Customer App */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">Additional Requirements</h3>
            <p className="text-xs text-slate-500">Configure options for your ride</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="space-y-4 pb-2">
          {/* ========================================================================= */}
          {/* 1. Travellers Section (Matching Image 2) */}
          {/* ========================================================================= */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 flex items-center justify-center text-[#f0750f]">
                <svg className="w-5 h-5 text-[#f0750f]" viewBox="0 0 20 20" fill="currentColor">
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

            {/* Stepper with Light Gray Minus & Orange Count */}
            <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setTravellers((prev) => Math.max(0, prev - 1))}
                disabled={travellers <= 0}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-base transition-colors"
              >
                −
              </button>
              <span className="w-9 text-center font-black text-sm text-[#f0750f]">
                {travellers}
              </span>
              <button
                type="button"
                onClick={() => setTravellers((prev) => Math.min(maxSeats, prev + 1))}
                disabled={travellers >= maxSeats}
                className="w-8 h-8 rounded-lg bg-white shadow-2xs flex items-center justify-center text-[#f0750f] hover:bg-orange-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-base transition-colors border border-slate-200"
              >
                +
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* ========================================================================= */}
          {/* 2. Luggage Load Section (Matching Image 2 & Image 4) */}
          {/* ========================================================================= */}
          <div>
            <div className="flex items-start gap-3">
              {/* Dual suitcase icon on left */}
              <div className="relative w-11 h-11 flex-shrink-0 mt-3">
                <Image
                  src="/images/luggage-two-suitcases.png"
                  alt="Luggage"
                  fill
                  className="object-contain"
                />
              </div>

              {/* Luggage Dropdown Container */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 mb-1.5">Luggage Load</p>

                {/* Dropdown Header Trigger Pill */}
                <button
                  type="button"
                  onClick={() => setIsLuggageDropdownOpen(!isLuggageDropdownOpen)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all bg-white ${
                    isLuggageDropdownOpen
                      ? 'border-[#f0750f] ring-2 ring-orange-100 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {luggageSummary.title}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {luggageSummary.desc}
                    </p>
                  </div>

                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform duration-200 flex-shrink-0 ${
                      isLuggageDropdownOpen ? 'rotate-180' : ''
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {/* Expanded Multi-Bag Selector (Matching Image 4) */}
                {isLuggageDropdownOpen && (
                  <div className="mt-2.5 p-3 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3 animate-in fade-in duration-150">
                    {LUGGAGE_ITEMS.map((item) => {
                      const count = luggageCounts[item.id];
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-b-0"
                        >
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-contain"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                              {item.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 line-clamp-1">
                              {item.desc}
                            </p>

                            {/* Stepper or + Add Button */}
                            <div className="mt-1.5">
                              {count > 0 ? (
                                <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                  <button
                                    type="button"
                                    onClick={() => handleDecrementBag(item.id)}
                                    className="w-6 h-6 flex items-center justify-center text-slate-700 hover:bg-white rounded font-bold text-xs transition"
                                  >
                                    −
                                  </button>
                                  <span className="px-2 text-xs font-bold text-slate-900">
                                    {count} {count === 1 ? 'bag' : 'bags'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleIncrementBag(item.id)}
                                    className="w-6 h-6 flex items-center justify-center text-slate-700 hover:bg-white rounded font-bold text-xs transition"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleIncrementBag(item.id)}
                                  className="py-1 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 inline-flex items-center gap-1 transition"
                                >
                                  <span>+</span>
                                  <span>Add</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setIsLuggageDropdownOpen(false)}
                      className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition"
                    >
                      Done
                    </button>
                  </div>
                )}

                {/* Collapsed view showing selected bag items in a row (Matching Image 2) */}
                {!isLuggageDropdownOpen && totalBags > 0 && (
                  <div className="flex items-center gap-3 overflow-x-auto py-2 mt-1">
                    {LUGGAGE_ITEMS.filter((item) => luggageCounts[item.id] > 0).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setIsLuggageDropdownOpen(true)}
                        className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-slate-100 flex-shrink-0"
                      >
                        <div className="relative w-6 h-6 flex-shrink-0">
                          <Image src={item.image} alt={item.name} fill className="object-contain" />
                        </div>
                        <span className="text-xs font-bold text-slate-900">
                          {luggageCounts[item.id]}×
                        </span>
                        <span className="text-[11px] font-medium text-slate-600 truncate max-w-[80px]">
                          {item.name.split(' - ')[0]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* ========================================================================= */}
          {/* 3. Toggle List with Smooth iOS Sliders (Matching Image 2 & Image 3) */}
          {/* ========================================================================= */}
          <div className="space-y-3 pt-1">
            {/* 1. Senior Citizens (Above Age 60)? */}
            <ToggleRow
              icon={
                <svg className="w-5 h-5 text-[#f0750f]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7zm10.7 4.1c-.8 0-1.5.7-1.5 1.5v7.5c0 .6.4 1 1 1s1-.4 1-1V14.5c0-.8-.7-1.5-1.5-1.5z" />
                </svg>
              }
              title="Senior Citizens (Above Age 60)?"
              description="Enable this for easy access seating, gentle driving & driver assistance."
              checked={seniorCitizens}
              onChange={setSeniorCitizens}
            />

            <div className="h-px bg-slate-100" />

            {/* 2. Need a Return Journey Later? */}
            <ToggleRow
              icon={
                <svg className="w-5 h-5 text-[#f0750f]" viewBox="0 0 512 512" fill="none">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="36" d="M304 96l112 112-112 112M400 208H96M208 416L96 304l112-112M112 304h304" />
                </svg>
              }
              title="Need a Return Journey Later?"
              description="Enable this if you may need a return trip on a later date."
              checked={returnJourneyLater}
              onChange={setReturnJourneyLater}
            />

            <div className="h-px bg-slate-100" />

            {/* 3. Need an Airport Drop? */}
            <ToggleRow
              icon={
                <svg className="w-5 h-5 text-[#f0750f]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" transform="rotate(-30 12 12)" />
                </svg>
              }
              title="Need an Airport Drop?"
              description="Enable this if you need to be dropped at the airport."
              checked={needAirportDrop}
              onChange={setNeedAirportDrop}
            />

            <div className="h-px bg-slate-100" />

            {/* 4. Need an Airport Pickup? */}
            <ToggleRow
              icon={
                <svg className="w-5 h-5 text-[#f0750f]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" transform="rotate(30 12 12)" />
                </svg>
              }
              title="Need an Airport Pickup?"
              description="Enable this if you need to be picked up from the airport."
              checked={needAirportPickup}
              onChange={setNeedAirportPickup}
            />

            <div className="h-px bg-slate-100" />

            {/* 5. Pet Friendly */}
            <div>
              <ToggleRow
                icon={
                  <svg className="w-5 h-5 text-[#f0750f]" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="4.5" cy="9.5" r="2.5" />
                    <circle cx="9" cy="5.5" r="2.5" />
                    <circle cx="15" cy="5.5" r="2.5" />
                    <circle cx="19.5" cy="9.5" r="2.5" />
                    <path d="M12 11c-3.3 0-6 2.2-6 5 0 2.2 1.8 3 3.5 3 1.2 0 2-.8 2.5-1.2.5.4 1.3 1.2 2.5 1.2 1.7 0 3.5-.8 3.5-3 0-2.8-2.7-5-6-5z" />
                  </svg>
                }
                title="Pet Friendly"
                description="Enable this if you are traveling with pets."
                checked={petFriendly}
                onChange={setPetFriendly}
              />

              {/* Sub-selector when Pet Friendly is switched ON */}
              {petFriendly && (
                <div className="mt-2.5 ml-14 p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 animate-in fade-in duration-150">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Select Pet Type:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'cat' as const, label: 'Cat', image: '/images/pet-cat-icon.png' },
                      { type: 'dog' as const, label: 'Dog', image: '/images/pet-dog-icon.png' },
                      { type: 'bird' as const, label: 'Bird', image: '/images/pet-bird-icon.png' },
                    ].map((item) => {
                      const isSelected = petType === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setPetType(item.type)}
                          className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-white border-[#f0750f] shadow-xs text-[#f0750f]'
                              : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                          }`}
                        >
                          <div className="relative w-7 h-7 mb-1">
                            <Image src={item.image} alt={item.label} fill className="object-contain" />
                          </div>
                          <span className="text-xs font-bold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-slate-100" />

            {/* 6. Baby on Board */}
            <ToggleRow
              icon={
                <svg className="w-5 h-5 text-[#f0750f]" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="8" cy="20" r="1.5" />
                  <circle cx="17" cy="20" r="1.5" />
                  <path d="M4 4h2l2 8h9l2-6H7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="7" r="2.5" />
                </svg>
              }
              title="Baby on Board"
              description="Enable this if traveling with an infant or child for safer driving."
              checked={babyOnBoard}
              onChange={setBabyOnBoard}
            />

            <div className="h-px bg-slate-100" />

            {/* 7. Pregnancy Friendly (New Option from Image 3) */}
            <ToggleRow
              icon={
                <svg className="w-5 h-5 text-[#f0750f]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4a2 2 0 100-4 2 2 0 000 4zm2 18v-7h1a1 1 0 001-1v-4a3 3 0 00-3-3h-2a3 3 0 00-3 3v5a1 1 0 001 1h1v6a1 1 0 001 1h1a1 1 0 001-1z" />
                </svg>
              }
              title="Pregnancy Friendly"
              description="Enable this if traveling with a pregnant passenger for extra gentle driving."
              checked={pregnancyFriendly}
              onChange={setPregnancyFriendly}
            />

            <div className="h-px bg-slate-100" />

            {/* 8. Accessibility Assistance (New Option from Image 3) */}
            <ToggleRow
              icon={
                <svg className="w-5 h-5 text-[#f0750f]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4a2 2 0 100-4 2 2 0 000 4zm7 10.5V11c0-.55-.45-1-1-1h-4.18l-.54-2.17A3.003 3.003 0 0010.36 5H7c-.55 0-1 .45-1 1s.45 1 1 1h3.36c.46 0 .86.31.97.75l1.6 6.4c-.95.53-1.68 1.4-1.88 2.47A4.996 4.996 0 0017 21a5 5 0 004.9-4H20a3.001 3.001 0 01-2.83 2A3 3 0 0114.2 16h3.8c.55 0 1-.45 1-1.5z" />
                </svg>
              }
              title="Accessibility Assistance"
              description="Enable this for wheelchair support, easy boarding & driver assistance."
              checked={accessibilityAssistance}
              onChange={setAccessibilityAssistance}
            />
          </div>

          <div className="h-px bg-slate-100 my-2" />

          {/* ========================================================================= */}
          {/* 4. Ride Preferences & Special Notes (Matching Image 3) */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-800 flex-shrink-0" viewBox="0 0 512 512" fill="none">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="36" d="M368 128h80M64 128h240M368 384h80M64 384h240M208 256h240M64 256h80"/>
                <circle cx="336" cy="128" r="32" stroke="currentColor" strokeWidth="36"/>
                <circle cx="176" cy="256" r="32" stroke="currentColor" strokeWidth="36"/>
                <circle cx="336" cy="384" r="32" stroke="currentColor" strokeWidth="36"/>
              </svg>
              <h4 className="text-sm font-bold text-slate-900">Ride Preferences</h4>
              <span className="text-xs text-slate-400">(Optional)</span>
            </div>

            <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f0750f] focus-within:border-transparent transition-all flex items-start gap-2.5">
              <svg className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <textarea
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Any special notes (e.g. child seat, extra stops, elderly assistance)..."
                rows={2}
                className="w-full bg-transparent text-xs sm:text-sm text-slate-800 focus:outline-none placeholder:text-slate-400 resize-none font-medium"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. Sticky Bottom Action CTA (Matching Image 3) */}
        {/* ========================================================================= */}
        <div className="pt-3 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-2 text-sm tracking-wide"
          >
            <span>Save &amp; Apply Requirements</span>
            <svg className="w-4 h-4 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Reusable iOS-style Toggle Row matching Image 2 & Image 3
interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function ToggleRow({ icon, title, description, checked, onChange }: ToggleRowProps) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 p-1 rounded-2xl hover:bg-slate-50/70 transition-colors cursor-pointer select-none"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Circular Floating Badge */}
        <div className="w-11 h-11 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>

        {/* Text */}
        <div className="min-w-0 pr-1">
          <p className="text-sm font-bold text-slate-900 leading-snug">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</p>
        </div>
      </div>

      {/* Smooth iOS Toggle Bar Slider */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        className={`w-12 h-7 rounded-full transition-colors duration-200 relative flex items-center p-1 cursor-pointer flex-shrink-0 ${
          checked ? 'bg-[#f0750f]' : 'bg-[#e2e8f0]'
        }`}
      >
        <span
          className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
