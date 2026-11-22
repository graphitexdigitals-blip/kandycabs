'use client';

import React from 'react';

const GOOGLE_MAPS_REVIEW_URL =
  'https://www.google.com/maps/place/Kandy+Cabs/@12.8210633,74.8382611,17z/data=!4m18!1m9!3m8!1s0x3ba35bd4b22d0263:0x6d0d06bc85a432f6!2sKandy+Cabs!8m2!3d12.8204879!4d74.8409326!9m1!1b1!16s%2Fg%2F11rxywzzz8!3m7!1s0x3ba35bd4b22d0263:0x6d0d06bc85a432f6!8m2!3d12.8204879!4d74.8409326!9m1!1b1!16s%2Fg%2F11rxywzzz8?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D';

export function CustomerRatingsCard() {
  return (
    <div className="flex flex-col justify-between h-full select-none relative py-0.5 px-0.5 lg:py-1 lg:px-1.5">
      {/* Top Header: Trust Badge & Overall Rating */}
      <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-100 pb-1.5">
        {/* Rating Pill linking directly to Google Reviews arranged on LEFT */}
        <a
          href={GOOGLE_MAPS_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Rate Kandy Cabs on Google Maps"
          className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full shadow-2xs hover:shadow-xs transition-all cursor-pointer flex-shrink-0"
        >
          <span className="text-[11px] sm:text-xs font-black text-black">4.9</span>
          <div className="flex text-[#F4B400] text-[10px] sm:text-[11px] tracking-tight">
            {'★★★★★'}
          </div>
          <svg
            className="w-2.5 h-2.5 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>

        <h4 className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight truncate">
          Customer Ratings & Reviews
        </h4>
      </div>

      {/* Middle Body: Feedback & Experience Invitation */}
      <div className="py-1 flex-1 flex flex-col justify-center">
        <div className="space-y-0.5">
          <p className="text-[10.5px] sm:text-[11.5px] font-bold text-slate-800 leading-snug">
            Kindly add your valuable feedback and share your experience with Kandy Cabs!
          </p>
          <p className="text-[8.5px] sm:text-[9px] text-slate-500 font-normal leading-normal">
            Your review helps fellow travelers and improves our service.
          </p>
        </div>

        {/* Rating Actions Bar */}
        <div className="mt-1.5 pt-1 border-t border-dashed border-slate-200/70 flex items-center justify-start">
          <a
            href={GOOGLE_MAPS_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] sm:text-[10.5px] font-bold shadow-xs hover:shadow-sm active:scale-95 transition-all group flex-shrink-0"
          >
            {/* Google G logo */}
            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.24v3.15C3.26 21.36 7.33 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.59H1.24C.45 8.16 0 9.97 0 12c0 2.03.45 3.84 1.24 5.41l4.04-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.59l4.04 3.15c.95-2.84 3.6-4.99 6.72-4.99z" />
            </svg>
            <span>Rate Us on Google</span>
            <span className="text-[#F4B400] text-[10px] sm:text-[10.5px] tracking-tight">★★★★★</span>
          </a>
        </div>
      </div>

      {/* Bottom Footer: Trust Pillars */}
      <div className="border-t border-slate-100 pt-1 flex items-center justify-between text-[8.5px] sm:text-[9px] text-slate-500 font-medium">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="inline-flex items-center gap-0.5 text-slate-600">
            <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[#f0750f]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Verified Drivers
          </span>
          <span className="inline-flex items-center gap-0.5 text-slate-600">
            <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[#f0750f]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Zero Surge Cost
          </span>
          <span className="inline-flex items-center gap-0.5 text-slate-600">
            <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[#f0750f]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Clean & Sanitized
          </span>
        </div>
      </div>
    </div>
  );
}
