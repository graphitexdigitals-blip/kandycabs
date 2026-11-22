'use client';

import React from 'react';

const GOOGLE_MAPS_REVIEW_URL =
  'https://www.google.com/maps/place/Kandy+Cabs/@12.8210633,74.8382611,17z/data=!4m18!1m9!3m8!1s0x3ba35bd4b22d0263:0x6d0d06bc85a432f6!2sKandy+Cabs!8m2!3d12.8204879!4d74.8409326!9m1!1b1!16s%2Fg%2F11rxywzzz8!3m7!1s0x3ba35bd4b22d0263:0x6d0d06bc85a432f6!8m2!3d12.8204879!4d74.8409326!9m1!1b1!16s%2Fg%2F11rxywzzz8?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D';

export function AppRatingsBanner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`w-full max-w-3xl mx-auto bg-white/95 backdrop-blur-xs rounded-full border border-slate-200/90 shadow-xs hover:shadow-sm transition-all py-2 px-3 sm:py-2.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 select-none ${className}`}
    >
      {/* 1. App Store Item */}
      <a
        href="/kandy-cabs-customer.apk"
        download="kandy-cabs-customer.apk"
        title="Download Kandy Cabs on App Store"
        className="flex items-center gap-2 sm:gap-2.5 hover:opacity-90 transition-opacity flex-1 justify-center sm:justify-start"
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#007AFF] flex items-center justify-center flex-shrink-0 shadow-2xs">
          {/* Apple App Store A Logo */}
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.64-.78 1.08-1.87.96-2.96-.93.04-2.07.62-2.73 1.4-.58.67-1.09 1.77-.96 2.83 1.04.08 2.1-.5 2.73-1.27z" />
          </svg>
        </div>
        <div className="leading-tight">
          <span className="block text-[11px] sm:text-xs font-bold text-slate-900 truncate">
            App Store
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[#F59E0B] text-[10px] sm:text-xs tracking-tight">★★★★★</span>
            <span className="hidden xs:inline text-[9.5px] sm:text-[11px] text-slate-500 font-semibold truncate">
              (4.2K+ Reviews)
            </span>
          </div>
        </div>
      </a>

      {/* Divider 1 */}
      <div className="h-6 sm:h-7 w-px bg-slate-200/90 flex-shrink-0" />

      {/* 2. Google Reviews Item */}
      <a
        href={GOOGLE_MAPS_REVIEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="View Google Reviews"
        className="flex items-center gap-2 sm:gap-2.5 hover:opacity-90 transition-opacity flex-1 justify-center sm:justify-start"
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 shadow-2xs">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.24v3.15C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.59H1.24C.45 8.16 0 9.97 0 12c0 2.03.45 3.84 1.24 5.41l4.04-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.59l4.04 3.15c.95-2.84 3.6-4.99 6.72-4.99z"
            />
          </svg>
        </div>
        <div className="leading-tight">
          <span className="block text-[11px] sm:text-xs font-bold text-slate-900 truncate">
            Google
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[#F59E0B] text-[10px] sm:text-xs tracking-tight">★★★★★</span>
            <span className="hidden xs:inline text-[9.5px] sm:text-[11px] text-slate-500 font-semibold truncate">
              (6.1K+ Reviews)
            </span>
          </div>
        </div>
      </a>

      {/* Divider 2 */}
      <div className="h-6 sm:h-7 w-px bg-slate-200/90 flex-shrink-0" />

      {/* 3. Play Store Item */}
      <a
        href="/kandy-cabs-customer.apk"
        download="kandy-cabs-customer.apk"
        title="Download Kandy Cabs on Google Play"
        className="flex items-center gap-2 sm:gap-2.5 hover:opacity-90 transition-opacity flex-1 justify-center sm:justify-start"
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0">
          {/* Google Play Store Triangle Icon */}
          <svg className="w-5 h-5 sm:w-5.5 sm:h-5.5 flex-shrink-0" viewBox="0 0 512 512">
            <path
              fill="#00D3FF"
              d="M50.4 20.3C38.7 32.7 32 52.4 32 77.2v357.5c0 24.8 6.7 44.5 18.4 56.9l3.1 3.1 200.2-200.2v-4.7L53.5 17.2l-3.1 3.1z"
            />
            <path
              fill="#00F076"
              d="M320.5 357.7l-66.8-66.8v-4.7l66.8-66.8 2.2 1.3 79.1 44.9c22.6 12.8 22.6 33.9 0 46.8l-79.1 44.9-2.2 1.4z"
            />
            <path
              fill="#FF3A44"
              d="M322.7 356.4L253.7 287.4 50.4 490.7c7.4 7.9 19.8 8.8 33.6 1l238.7-135.3z"
            />
            <path
              fill="#FFC400"
              d="M322.7 155.6L84 20.3c-13.8-7.8-26.2-6.9-33.6 1l203.3 203.3 69-69z"
            />
          </svg>
        </div>
        <div className="leading-tight">
          <span className="block text-[11px] sm:text-xs font-bold text-slate-900 truncate">
            Play Store
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[#F59E0B] text-[10px] sm:text-xs tracking-tight">★★★★★</span>
            <span className="hidden xs:inline text-[9.5px] sm:text-[11px] text-slate-500 font-semibold truncate">
              (15.5K+ Reviews)
            </span>
          </div>
        </div>
      </a>
    </div>
  );
}
