'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

interface CustomerHeaderProps {
  onOpenAuth?: () => void;
  activeNav?: 'home' | 'about' | 'support' | 'booking' | 'fleets' | 'bookings';
}

export function CustomerHeader({ onOpenAuth, activeNav = 'home' }: CustomerHeaderProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [greeting, setGreeting] = useState('Good Evening');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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

        {/* Center: Desktop Navigation Links (Home, About, Support) - visible on Desktop (lg+) */}
        <nav className="hidden lg:flex items-center gap-7 xl:gap-9 absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 pointer-events-auto">
          <Link
            href="/"
            className={`text-sm lg:text-base font-bold tracking-wide transition-all py-1 ${
              activeNav === 'home'
                ? 'text-[#f0750f] border-b-2 border-[#f0750f]'
                : 'text-slate-200 hover:text-white hover:text-[#f0750f]'
            }`}
          >
            Home
          </Link>
          <Link
            href="/about"
            className={`text-sm lg:text-base font-bold tracking-wide transition-all py-1 ${
              activeNav === 'about'
                ? 'text-[#f0750f] border-b-2 border-[#f0750f]'
                : 'text-slate-200 hover:text-white hover:text-[#f0750f]'
            }`}
          >
            About
          </Link>
          <Link
            href="/support"
            className={`text-sm lg:text-base font-bold tracking-wide transition-all py-1 ${
              activeNav === 'support'
                ? 'text-[#f0750f] border-b-2 border-[#f0750f]'
                : 'text-slate-200 hover:text-white hover:text-[#f0750f]'
            }`}
          >
            Support
          </Link>
        </nav>

        {/* Right Section: Download App, Good Evening [User] (Desktop), and Hamburger Toggle (Mobile/Tab) */}
        <div className="flex items-center gap-2 sm:gap-3.5 z-10 flex-shrink-0">
          {/* Download App Button */}
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

          {/* User Profile / Greeting: Visible on Desktop (lg+) only */}
          {isAuthenticated && loggedInName ? (
            <div className="relative hidden lg:block">
              <div
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex flex-col items-start cursor-pointer select-none group min-w-0 px-1 py-0.5"
              >
                <span className="text-[10px] sm:text-xs text-slate-300 font-medium leading-tight truncate block">
                  {greeting}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-[#f0750f] tracking-wide flex items-center gap-1 group-hover:text-orange-400 transition-colors truncate">
                  <span className="truncate max-w-[120px] xl:max-w-[160px]">{loggedInName}</span>
                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#f0750f] group-hover:text-orange-400 transition-colors flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </span>
              </div>

              {/* User Dropdown Menu (Desktop) */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl py-2 z-50 text-slate-800 border border-slate-100 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
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
          ) : !isAuthenticated ? (
            <button
              type="button"
              onClick={onOpenAuth}
              className="hidden lg:flex px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl font-semibold text-[11px] sm:text-xs text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-all items-center gap-1 active:scale-95 flex-shrink-0"
            >
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>Sign In</span>
            </button>
          ) : null}

          {/* Mobile & Tablet Menu Hamburger Button (Visible on screens < lg) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="lg:hidden p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center justify-center flex-shrink-0"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Full-Height Slide-Over Drawer (Right-to-Left on Mobile & Tablet) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
          />

          {/* Side Drawer Panel */}
          <div className="fixed top-0 right-0 bottom-0 h-full w-full sm:w-80 md:w-96 max-w-full bg-[#121c2a] text-white z-50 shadow-2xl flex flex-col justify-between p-5 sm:p-6 animate-in slide-in-from-right duration-300 ease-out">
            {/* Top Area: Header, User Profile Card, Nav Links */}
            <div className="flex flex-col space-y-5 overflow-y-auto">
              {/* Drawer Top Bar: Brand Logo & Close Button */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="relative h-7 w-24">
                  <Image
                    src="/images/logo-white.png"
                    alt="Kandy Cabs Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* User Profile Card inside Hamburger Drawer */}
              {isAuthenticated && loggedInName ? (
                <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f0750f]/20 border border-[#f0750f]/40 flex items-center justify-center text-[#f0750f] font-black text-base flex-shrink-0">
                      {loggedInName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-slate-400 font-medium leading-tight">{greeting}</p>
                      <p className="text-sm sm:text-base font-extrabold text-[#f0750f] tracking-wide truncate">{loggedInName}</p>
                      {user?.phone && (
                        <p className="text-xs text-slate-400 mt-0.5">+91 {user.phone.slice(-10)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth?.();
                  }}
                  className="w-full px-4 py-3 rounded-xl font-bold text-sm text-white bg-[#f0750f] hover:bg-[#d96509] transition-colors flex items-center justify-center gap-2 shadow-md active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In / Register
                </button>
              )}

              {/* Navigation Links inside Drawer */}
              <div className="space-y-1.5 pt-1">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors ${
                    activeNav === 'home'
                      ? 'bg-[#f0750f] text-white shadow-md'
                      : 'text-slate-200 hover:bg-slate-800/80'
                  }`}
                >
                  <svg className="w-5 h-5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Home
                </Link>

                <Link
                  href="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors ${
                    activeNav === 'about'
                      ? 'bg-[#f0750f] text-white shadow-md'
                      : 'text-slate-200 hover:bg-slate-800/80'
                  }`}
                >
                  <svg className="w-5 h-5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  About
                </Link>

                <Link
                  href="/support"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors ${
                    activeNav === 'support'
                      ? 'bg-[#f0750f] text-white shadow-md'
                      : 'text-slate-200 hover:bg-slate-800/80'
                  }`}
                >
                  <svg className="w-5 h-5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Support
                </Link>

                {isAuthenticated && (
                  <Link
                    href="/customer/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors ${
                      activeNav === 'bookings'
                        ? 'bg-[#f0750f] text-white shadow-md'
                        : 'text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <svg className="w-5 h-5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    My Bookings
                  </Link>
                )}

                <a
                  href="/kandy-cabs-customer.apk"
                  download="kandy-cabs-customer.apk"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold text-slate-200 hover:bg-slate-800/80 transition-colors"
                >
                  <svg className="w-5 h-5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Mobile App
                </a>
              </div>
            </div>

            {/* Bottom Section: Sign Out Button Pinned at Bottom */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              {isAuthenticated && (
                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await logout();
                    router.push('/');
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 rounded-xl border border-red-800/40 transition-colors active:scale-98"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              )}
              <p className="text-center text-[10px] text-slate-500 font-medium">
                Kandy Cabs • Safe | Reliable | Hassle-Free
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
