'use client';

import React from 'react';
import Link from 'next/link';

export interface BookingFlowHeaderProps {
  currentStep: 1 | 2 | 3;
  title: string;
  subStepLabel?: string;
  subtitle?: string;
  onBack: () => void;
  onStep1Press?: () => void;
  onStep2Press?: () => void;
}

export function BookingFlowHeader({
  currentStep,
  title,
  subStepLabel,
  subtitle,
  onBack,
  onStep1Press,
  onStep2Press,
}: BookingFlowHeaderProps) {
  const step1Done = currentStep > 1;
  const step2Done = currentStep > 2;

  return (
    <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Top Header Row with Back Button & Centered/Aligned Title */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
            title="Go Back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center flex-1 mx-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {title}
            </h1>
            {(subtitle || subStepLabel) && (
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                {subtitle || (subStepLabel ? `Step ${currentStep} of 3 • ${subStepLabel}` : '')}
              </p>
            )}
          </div>

          <div className="w-9" />
        </div>

        {/* 3-Step Progress Indicator (Trip Details -> Select Cab -> Confirm) */}
        <div className="flex items-center justify-between max-w-md mx-auto px-2">
          {/* Step 1: Trip Details */}
          <button
            onClick={onStep1Press}
            disabled={!step1Done || !onStep1Press}
            className="flex items-center gap-1.5 focus:outline-none group"
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step1Done
                  ? 'bg-[#f0750f] text-white shadow-sm'
                  : currentStep === 1
                  ? 'bg-[#f0750f] text-white ring-2 ring-orange-200'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {step1Done ? (
                <svg className="w-3.5 h-3.5 stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                '1'
              )}
            </div>
            <span
              className={`text-xs font-semibold ${
                currentStep >= 1 ? 'text-[#f0750f]' : 'text-slate-400'
              }`}
            >
              Trip Details
            </span>
          </button>

          {/* Connector Line 1 -> 2 */}
          <div
            className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${
              step1Done ? 'bg-[#f0750f]' : 'bg-slate-200'
            }`}
          />

          {/* Step 2: Select Cab */}
          <button
            onClick={onStep2Press}
            disabled={!step2Done || !onStep2Press}
            className="flex items-center gap-1.5 focus:outline-none group"
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step2Done
                  ? 'bg-[#f0750f] text-white shadow-sm'
                  : currentStep === 2
                  ? 'bg-[#f0750f] text-white ring-2 ring-orange-200'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {step2Done ? (
                <svg className="w-3.5 h-3.5 stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                '2'
              )}
            </div>
            <span
              className={`text-xs font-semibold ${
                currentStep >= 2 ? 'text-[#f0750f]' : 'text-slate-400'
              }`}
            >
              Select Cab
            </span>
          </button>

          {/* Connector Line 2 -> 3 */}
          <div
            className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${
              step2Done ? 'bg-[#f0750f]' : 'bg-slate-200'
            }`}
          />

          {/* Step 3: Confirm */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                currentStep === 3
                  ? 'bg-[#f0750f] text-white ring-2 ring-orange-200'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              3
            </div>
            <span
              className={`text-xs font-semibold ${
                currentStep === 3 ? 'text-[#f0750f]' : 'text-slate-400'
              }`}
            >
              Confirm
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

