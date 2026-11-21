'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

interface CustomerHeaderProps {
  onOpenAuth?: () => void;
  activeNav?: 'home' | 'bookings' | 'support' | 'profile';
}

export function CustomerHeader({ onOpenAuth, activeNav = 'home' }: CustomerHeaderProps) {
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

  const displayName = user?.fullName || (user?.phone ? `+91 ${user.phone.slice(-10)}` : 'Guest');

  return (
    <header className="bg-[#162232] text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative h-10 w-28 sm:w-32">
            <Image
              src="/images/logo.png"
              alt="Kandy Cabs Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Desktop Navigation Links (Home, My Bookings, Support, Profile) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold">
          <Link
            href="/"
            className={`transition-colors hover:text-[#f0750f] ${
              activeNav === 'home' ? 'text-[#f0750f]' : 'text-slate-300'
            }`}
          >
            Home
          </Link>
          <Link
            href="/customer/dashboard"
            className={`transition-colors hover:text-[#f0750f] ${
              activeNav === 'bookings' ? 'text-[#f0750f]' : 'text-slate-300'
            }`}
          >
            My Bookings
          </Link>
          <a
            href="tel:+919481086058"
            className={`transition-colors hover:text-[#f0750f] ${
              activeNav === 'support' ? 'text-[#f0750f]' : 'text-slate-300'
            }`}
          >
            Support
          </a>
          <button
            type="button"
            onClick={() => {
              if (isAuthenticated) {
                setShowUserMenu(!showUserMenu);
              } else if (onOpenAuth) {
                onOpenAuth();
              }
            }}
            className={`transition-colors hover:text-[#f0750f] ${
              activeNav === 'profile' ? 'text-[#f0750f]' : 'text-slate-300'
            }`}
          >
            Profile
          </button>
        </nav>

        {/* User Greeting & Notification Bell (Matching App Header) */}
        <div className="flex items-center gap-3">
          {/* Greeting Box */}
          <div
            onClick={() => {
              if (!isAuthenticated && onOpenAuth) {
                onOpenAuth();
              } else if (isAuthenticated) {
                setShowUserMenu(!showUserMenu);
              }
            }}
            className="flex flex-col text-right cursor-pointer select-none"
          >
            <span className="text-[11px] sm:text-xs text-slate-300 font-normal leading-tight">
              {greeting}
            </span>
            <span className="text-xs sm:text-sm font-bold text-white tracking-wide flex items-center justify-end gap-1">
              {displayName}
              {isAuthenticated && (
                <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </span>
          </div>

          {/* User Menu Dropdown */}
          {showUserMenu && isAuthenticated && (
            <div className="absolute right-12 top-14 mt-1 w-48 bg-white rounded-xl shadow-xl py-2 z-50 text-slate-800 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
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

          {/* Notification Bell (Circular with Orange Indicator Dot) */}
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
