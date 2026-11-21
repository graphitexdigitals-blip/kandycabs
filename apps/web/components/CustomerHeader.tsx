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
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between relative">
        {/* Left: Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group z-10">
          <div className="relative h-10 w-28 sm:w-32">
            <Image
              src="/images/logo-white.png"
              alt="Kandy Cabs Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Center: Greeting & Logged-in Name (Arranged in Dead-Center, No Guest) */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 max-w-[56%] text-center pointer-events-auto">
          <div
            onClick={() => {
              if (!isAuthenticated && onOpenAuth) {
                onOpenAuth();
              } else if (isAuthenticated) {
                setShowUserMenu(!showUserMenu);
              }
            }}
            className="flex flex-col items-center justify-center text-center cursor-pointer select-none group"
          >
            {loggedInName ? (
              <>
                <span className="text-[11px] sm:text-xs text-slate-300 font-medium leading-tight truncate">
                  {greeting}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide flex items-center justify-center gap-1 group-hover:text-orange-400 transition-colors truncate">
                  {loggedInName}
                  <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-400 transition-colors flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </span>
              </>
            ) : (
              <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide group-hover:text-orange-400 transition-colors">
                {greeting}
              </span>
            )}
          </div>

          {/* User Menu Dropdown (Centered right below the greeting) */}
          {showUserMenu && isAuthenticated && (
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

        {/* Right: Sign In (if not logged in) & Notification Bell */}
        <div className="flex items-center gap-2.5 sm:gap-3 z-10">
          {!isAuthenticated && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#f0750f] hover:bg-[#ea580c] transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>Sign In</span>
            </button>
          )}

          <Link
            href="/customer/dashboard"
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 flex items-center justify-center transition-colors"
            title="Notifications & Bookings"
          >
            <svg
              className="w-5 h-5 text-slate-200"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
            </svg>
            {/* Orange Unread Dot */}
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#f0750f] ring-2 ring-[#162232]" />
          </Link>
        </div>
      </div>
    </header>
  );
}
