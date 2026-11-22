'use client';

import React from 'react';

interface LocalSwitchModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export function LocalSwitchModal({ isOpen, onConfirm }: LocalSwitchModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center transform transition-all animate-in zoom-in-95 duration-150 border border-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="local-switch-title"
      >
        <h3
          id="local-switch-title"
          className="text-lg font-bold text-slate-900 tracking-tight"
        >
          Local Rental Switched
        </h3>

        <p className="mt-2.5 text-sm text-slate-600 leading-normal font-medium">
          Since your pickup and drop location is same city we&apos;ve switched to local rental
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-2.5 px-4 bg-[#f0750f] hover:bg-[#ea580c] active:scale-[0.98] text-white font-bold rounded-xl transition-all shadow-sm text-sm cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
