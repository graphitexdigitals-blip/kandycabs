'use client';

import React, { useState, useEffect } from 'react';

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTime: (time24: string) => void;
  currentTime?: string;
  title?: string;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export function TimePickerModal({
  isOpen,
  onClose,
  onSelectTime,
  currentTime,
  title = 'Select Pickup Time',
}: TimePickerModalProps) {
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  useEffect(() => {
    if (!isOpen) return;

    if (currentTime && currentTime.includes(':')) {
      const parts = currentTime.trim().split(':');
      let h = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);

      if (currentTime.toLowerCase().includes('pm')) {
        setPeriod('PM');
        setHour(h > 12 ? h - 12 : h === 0 ? 12 : h);
      } else if (currentTime.toLowerCase().includes('am')) {
        setPeriod('AM');
        setHour(h === 0 ? 12 : h > 12 ? h - 12 : h);
      } else {
        // Assume 24-hour input like "18:26"
        if (h >= 12) {
          setPeriod('PM');
          setHour(h === 12 ? 12 : h - 12);
        } else {
          setPeriod('AM');
          setHour(h === 0 ? 12 : h);
        }
      }
      setMinute(String(isNaN(m) ? 0 : m).padStart(2, '0'));
    } else {
      // Default to next upcoming convenient hour
      const now = new Date();
      const currentH = now.getHours();
      const nextH = (currentH + 1) % 24;
      if (nextH >= 12) {
        setPeriod('PM');
        setHour(nextH === 12 ? 12 : nextH - 12);
      } else {
        setPeriod('AM');
        setHour(nextH === 0 ? 12 : nextH);
      }
      setMinute('00');
    }
  }, [isOpen, currentTime]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    let h24 = hour;
    if (period === 'AM') {
      if (h24 === 12) h24 = 0;
    } else {
      if (h24 !== 12) h24 += 12;
    }
    const time24Str = `${String(h24).padStart(2, '0')}:${minute}`;
    onSelectTime(time24Str);
    onClose();
  };

  const handlePreset = (h: number, m: string, p: 'AM' | 'PM') => {
    setHour(h);
    setMinute(m);
    setPeriod(p);
  };

  const displayTime = `${String(hour).padStart(2, '0')}:${minute} ${period}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-100 space-y-4 relative animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">⏰</span>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition font-bold"
          >
            ✕
          </button>
        </div>

        {/* 12-Hour Formatted Big Display */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-center flex items-center justify-center gap-3 shadow-inner">
          <span className="text-3xl font-black text-slate-900 tracking-tight">
            {String(hour).padStart(2, '0')} : {minute}
          </span>
          <span className="text-sm font-extrabold px-3 py-1 rounded-full bg-[#f0750f] text-white shadow-sm">
            {period}
          </span>
        </div>

        {/* AM / PM Toggle Pills */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPeriod('AM')}
            className={`py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
              period === 'AM'
                ? 'bg-[#f0750f] text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            ☀️ AM (Morning)
          </button>
          <button
            type="button"
            onClick={() => setPeriod('PM')}
            className={`py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
              period === 'PM'
                ? 'bg-[#f0750f] text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            🌙 PM (Evening)
          </button>
        </div>

        {/* Hour Grid (12-hour) */}
        <div>
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Select Hour (12-hr)
          </span>
          <div className="grid grid-cols-6 gap-1.5">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHour(h)}
                className={`py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  hour === h
                    ? 'bg-[#162232] text-white shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Minute Grid */}
        <div>
          <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Select Minutes
          </span>
          <div className="grid grid-cols-6 gap-1.5">
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinute(m)}
                className={`py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  minute === m
                    ? 'bg-[#f0750f] text-white shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
                }`}
              >
                :{m}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Presets */}
        <div>
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Quick Presets
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '06:00 AM', h: 6, m: '00', p: 'AM' as const },
              { label: '09:00 AM', h: 9, m: '00', p: 'AM' as const },
              { label: '12:00 PM', h: 12, m: '00', p: 'PM' as const },
              { label: '03:00 PM', h: 3, m: '00', p: 'PM' as const },
              { label: '06:00 PM', h: 6, m: '00', p: 'PM' as const },
              { label: '09:00 PM', h: 9, m: '00', p: 'PM' as const },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePreset(preset.h, preset.m, preset.p)}
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-[#f0750f] text-[11px] font-medium text-slate-600 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-[#f0750f] hover:bg-[#ea580c] text-white text-xs font-black transition shadow-md flex items-center justify-center gap-1 uppercase tracking-wide"
          >
            <span>Set {displayTime}</span>
            <span>✓</span>
          </button>
        </div>
      </div>
    </div>
  );
}
