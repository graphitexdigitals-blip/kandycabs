'use client';

import React, { useState, useEffect, useRef } from 'react';

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTime: (time24: string) => void;
  currentTime?: string;
  title?: string;
}

const ITEM_HEIGHT = 44;
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'] as const;

function WheelColumn({
  items,
  selectedIndex,
  onSelect,
}: {
  items: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize scroll position when modal opens or selectedIndex updates
  useEffect(() => {
    if (isScrollingRef.current) return;
    const container = containerRef.current;
    if (container) {
      container.scrollTop = selectedIndex * ITEM_HEIGHT;
    }
  }, [selectedIndex]);

  const handleScroll = () => {
    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    scrollTimeoutRef.current = setTimeout(() => {
      const container = containerRef.current;
      if (container) {
        const index = Math.round(container.scrollTop / ITEM_HEIGHT);
        const clamped = Math.max(0, Math.min(items.length - 1, index));
        if (clamped !== selectedIndex) {
          onSelect(clamped);
        }
      }
      isScrollingRef.current = false;
    }, 80);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 h-[308px] overflow-y-auto scroll-smooth snap-y snap-mandatory relative z-20 py-[132px]"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {items.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        const dist = Math.abs(idx - selectedIndex);
        return (
          <div
            key={idx}
            onClick={() => {
              onSelect(idx);
              if (containerRef.current) {
                containerRef.current.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
              }
            }}
            className={`h-[44px] flex items-center justify-center snap-center cursor-pointer select-none transition-all duration-150 ${
              isSelected
                ? 'text-2xl font-black text-slate-900 scale-105'
                : dist === 1
                ? 'text-lg font-bold text-slate-500'
                : dist === 2
                ? 'text-base font-medium text-slate-300'
                : 'text-sm font-light text-slate-200'
            }`}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
}

export function TimePickerModal({
  isOpen,
  onClose,
  onSelectTime,
  currentTime,
  title = 'Select Pickup Time',
}: TimePickerModalProps) {
  const [selectedHourIndex, setSelectedHourIndex] = useState(8); // 9
  const [selectedMinuteIndex, setSelectedMinuteIndex] = useState(0); // 00
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(0); // AM

  useEffect(() => {
    if (!isOpen) return;

    if (currentTime && currentTime.includes(':')) {
      const parts = currentTime.trim().split(':');
      let h = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);

      let p: 'AM' | 'PM' = 'AM';
      let h12 = h;

      if (currentTime.toLowerCase().includes('pm')) {
        p = 'PM';
        h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      } else if (currentTime.toLowerCase().includes('am')) {
        p = 'AM';
        h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      } else {
        // 24-hour format
        if (h >= 12) {
          p = 'PM';
          h12 = h === 12 ? 12 : h - 12;
        } else {
          p = 'AM';
          h12 = h === 0 ? 12 : h;
        }
      }

      const hIdx = Math.max(0, HOURS.indexOf(h12));
      const mIdx = Math.max(0, Math.min(59, isNaN(m) ? 0 : m));
      const pIdx = p === 'AM' ? 0 : 1;

      setSelectedHourIndex(hIdx !== -1 ? hIdx : 8);
      setSelectedMinuteIndex(mIdx);
      setSelectedPeriodIndex(pIdx);
    } else {
      // Default to next upcoming convenient time (e.g. 09:00 AM)
      setSelectedHourIndex(8); // 9
      setSelectedMinuteIndex(0); // 00
      setSelectedPeriodIndex(0); // AM
    }
  }, [isOpen, currentTime]);

  if (!isOpen) return null;

  const selectedHour = HOURS[selectedHourIndex];
  const selectedMinute = MINUTES[selectedMinuteIndex];
  const selectedPeriod = PERIODS[selectedPeriodIndex];

  const handleConfirm = () => {
    let h24 = selectedHour;
    if (selectedPeriod === 'AM') {
      if (h24 === 12) h24 = 0;
    } else {
      if (h24 !== 12) h24 += 12;
    }
    const time24Str = `${String(h24).padStart(2, '0')}:${selectedMinute}`;
    onSelectTime(time24Str);
    onClose();
  };

  const displayTime = `${String(selectedHour).padStart(2, '0')}:${selectedMinute} ${selectedPeriod}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-100 space-y-3 relative animate-scale-in">
        {/* Header matching Customer App */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <svg className="w-[22px] h-[22px] text-[#162232] flex-shrink-0" viewBox="0 0 512 512" fill="currentColor">
              <path d="M256 48C141.13 48 48 141.13 48 256s93.13 208 208 208 208-93.13 208-208S370.87 48 256 48zm96 240h-96a16 16 0 01-16-16V128a16 16 0 0132 0v128h80a16 16 0 010 32z" />
            </svg>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* 3-Column Scrollable Wheel Cylinder Picker */}
        <div className="relative h-[308px] overflow-hidden my-1">
          {/* Center Selection Highlight Bar spanning all columns */}
          <div className="absolute left-2 right-2 top-[132px] h-[44px] bg-[#f1f5f9] rounded-2xl pointer-events-none z-0" />

          {/* Top & Bottom Depth Fade Overlays */}
          <div className="absolute top-0 left-0 right-0 h-[100px] bg-gradient-to-b from-white via-white/80 to-transparent pointer-events-none z-30" />
          <div className="absolute bottom-0 left-0 right-0 h-[100px] bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-30" />

          {/* Columns */}
          <div className="flex items-center h-full relative z-20">
            {/* Column 1: Hour */}
            <WheelColumn
              items={HOURS}
              selectedIndex={selectedHourIndex}
              onSelect={setSelectedHourIndex}
            />

            {/* Column 2: Minute */}
            <WheelColumn
              items={MINUTES}
              selectedIndex={selectedMinuteIndex}
              onSelect={setSelectedMinuteIndex}
            />

            {/* Column 3: Period (AM / PM) */}
            <WheelColumn
              items={PERIODS as unknown as string[]}
              selectedIndex={selectedPeriodIndex}
              onSelect={setSelectedPeriodIndex}
            />
          </div>
        </div>

        {/* Bottom Bar: Selected Time Preview & Confirm Button */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              SELECTED TIME
            </span>
            <span className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              {displayTime}
            </span>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="bg-[#f0750f] hover:bg-[#ea580c] active:scale-95 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all"
          >
            <span>Confirm Time</span>
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
