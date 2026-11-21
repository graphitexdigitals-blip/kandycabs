'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

interface CustomerHeaderProps {
  onOpenAuth?: () => void;
  activeNav?: 'home' | 'booking' | 'fleets' | 'bookings' | 'support';
}

export function CustomerHeader({ onOpenAuth }: CustomerHeaderProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [greeting, setGreeting] = useState('Good Morning');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good Morning');
    } else if (hour < 17) {
      setGreeting('Good Afternoon');
    } else {
      setGreeting('Good Evening');
    }
  }, []);

  const loggedInName = isAuthenticated ? (user?.fullName || (user?.phone ? `+91 ${user.phone.slice(-10)}` : '')) : '';

  return (
    <header className="bg-[#162232] text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-6xl xl:max-w-7xl mx-auto px-2.5 sm:px-4 md:px-6 py-2 sm:py-2.5 flex items-center justify-between relative">
        {/* Left: Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group z-10 flex-shrink-0">
          <div className="relative h-7 sm:h-9 w-20 sm:w-28">
            <Image
              src="/images/logo-white.png"
              alt="Kandy Cabs Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Center: Greeting & Logged-in Name (Only displayed when signed in) */}
        {isAuthenticated && loggedInName && (
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 max-w-[36%] sm:max-w-[48%] text-center pointer-events-auto">
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex flex-col items-center justify-center text-center cursor-pointer select-none group min-w-0"
            >
              <span className="text-[10px] sm:text-xs text-slate-300 font-medium leading-tight truncate block max-w-full">
                {greeting}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide flex items-center justify-center gap-1 group-hover:text-orange-400 transition-colors truncate max-w-full">
                <span className="truncate">{loggedInName}</span>
                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 group-hover:text-orange-400 transition-colors flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
            </div>

            {/* User Menu Dropdown (Centered right below the greeting) */}
            {showUserMenu && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-48 bg-white rounded-xl shadow-xl py-2 z-50 text-slate-800 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs text-slate-400">Signed in as</p>
                  <p className="text-sm font-semibold truncate text-slate-800">{user?.fullName || 'User'}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.phone ? `+91 ${user.phone.slice(-10)}` : ''}</p>
                </div>
                <Link
                  href="/customer/dashboard"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#f0750f]"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  My Bookings
                </Link>
                <button
                  onClick={async () => {
                    setShowUserMenu(false);
                    await logout();
                    router.push('/');
                  }}
                  className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}

        {/* Right: Download App Button & Sign In */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 z-10 flex-shrink-0">
          <a
            href="/kandy-cabs-customer.apk"
            download="kandy-cabs-customer.apk"
            className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs text-white hover:text-[#162232] bg-white/10 hover:bg-white border border-white/25 hover:border-white transition-all flex items-center gap-1 active:scale-95 flex-shrink-0"
            title="Download Kandy Cabs Customer App"
          >
            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span><span className="hidden sm:inline">Download </span>App</span>
          </a>

          {!isAuthenticated && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl font-semibold text-[11px] sm:text-xs text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-all flex items-center gap-1 active:scale-95 flex-shrink-0"
            >
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
