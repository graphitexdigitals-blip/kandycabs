'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface CustomerBottomDockProps {
  onOpenAuth?: () => void;
}

export function CustomerBottomDock({ onOpenAuth }: CustomerBottomDockProps) {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isBookings = pathname.includes('/customer/dashboard');

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#162232] border-t border-[#101925] px-2 py-2 flex items-center justify-around shadow-2xl safe-area-bottom">
      {/* 1. Home Tab */}
      <Link
        href="/"
        className="flex flex-col items-center justify-center flex-1 py-1 relative text-center"
      >
        {isHome && (
          <span className="absolute -top-2 w-8 h-1 bg-[#f0750f] rounded-full" />
        )}
        <svg
          className={`w-6 h-6 transition-colors ${
            isHome ? 'text-[#f0750f]' : 'text-slate-300'
          }`}
          fill={isHome ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={isHome ? 0 : 2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        <span
          className={`text-[11px] font-medium mt-0.5 ${
            isHome ? 'text-[#f0750f] font-bold' : 'text-slate-300'
          }`}
        >
          Home
        </span>
      </Link>

      {/* 2. My Bookings Tab */}
      <Link
        href="/customer/dashboard"
        className="flex flex-col items-center justify-center flex-1 py-1 relative text-center"
      >
        {isBookings && (
          <span className="absolute -top-2 w-8 h-1 bg-[#f0750f] rounded-full" />
        )}
        <svg
          className={`w-6 h-6 transition-colors ${
            isBookings ? 'text-[#f0750f]' : 'text-slate-300'
          }`}
          fill={isBookings ? 'currentColor' : 'none'}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={isBookings ? 0 : 2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span
          className={`text-[11px] font-medium mt-0.5 ${
            isBookings ? 'text-[#f0750f] font-bold' : 'text-slate-300'
          }`}
        >
          My Bookings
        </span>
      </Link>

      {/* 3. Support Tab */}
      <a
        href="tel:+919481086058"
        className="flex flex-col items-center justify-center flex-1 py-1 relative text-center"
      >
        <svg
          className="w-6 h-6 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"
          />
        </svg>
        <span className="text-[11px] font-medium mt-0.5 text-slate-300">
          Support
        </span>
      </a>

      {/* 4. Profile Tab */}
      <button
        onClick={onOpenAuth}
        className="flex flex-col items-center justify-center flex-1 py-1 relative text-center"
      >
        <svg
          className="w-6 h-6 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <span className="text-[11px] font-medium mt-0.5 text-slate-300">
          Profile
        </span>
      </button>
    </nav>
  );
}
