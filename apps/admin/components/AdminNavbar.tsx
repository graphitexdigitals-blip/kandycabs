'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
  IconDashboard,
  IconUsers,
  IconBookings,
  IconMap,
  IconPayments,
  IconShield,
  IconCar,
  IconTag,
  IconImage,
  IconFileText,
  IconLogout,
  IconMenu,
  IconX,
} from './Icons';

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  section: 'OPERATIONS' | 'FLEET & DRIVERS' | 'SYSTEM & ANALYTICS';
}

export function AdminNavbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [expiringDocsCount, setExpiringDocsCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const checkExpiring = async () => {
      try {
        const res = await fetch('/api/admin/vehicle-evidence?status=EXPIRING');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.counts?.expiringSoon !== undefined) {
            setExpiringDocsCount(data.counts.expiringSoon);
          }
        }
      } catch (_) {}
    };
    checkExpiring();
    const interval = setInterval(checkExpiring, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navLinks: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Overview',
      description: 'Realtime KPIs & operational control center',
      icon: IconDashboard,
      section: 'OPERATIONS',
    },
    {
      href: '/bookings',
      label: 'Bookings & Dispatch',
      description: 'Fleet bookings, dispatches & ride actions',
      icon: IconBookings,
      section: 'OPERATIONS',
    },
    {
      href: '/live-map',
      label: 'Live GPS Map',
      description: 'Live fleet location tracking on OpenStreetMap',
      icon: IconMap,
      section: 'OPERATIONS',
    },
    {
      href: '/payments',
      label: 'Payments & Ledger',
      description: 'Revenue, collections & driver payouts',
      icon: IconPayments,
      section: 'OPERATIONS',
    },
    {
      href: '/vehicle-evidence',
      label: 'Vehicle & Driver KYC',
      description: 'Driver documents, RC, licenses & verification',
      icon: IconShield,
      section: 'FLEET & DRIVERS',
    },
    {
      href: '/fleets',
      label: 'Fleets & Categories',
      description: 'Sedan, SUV, Crysta & Tempo Traveller configurations',
      icon: IconCar,
      section: 'FLEET & DRIVERS',
    },
    {
      href: '/pricing',
      label: 'Pricing & Tariffs',
      description: 'Per-km rates, min km, night & pet charges',
      icon: IconTag,
      section: 'FLEET & DRIVERS',
    },
    {
      href: '/analytics',
      label: 'Visitors & Funnel',
      description: 'Customer conversion funnels & research log',
      icon: IconUsers,
      section: 'SYSTEM & ANALYTICS',
    },
    {
      href: '/banners',
      label: 'Banners & Offers',
      description: 'Promotional posters & marketing banners',
      icon: IconImage,
      section: 'SYSTEM & ANALYTICS',
    },
    {
      href: '/audit-logs',
      label: 'Audit Trail',
      description: 'Cryptographically preserved activity log',
      icon: IconFileText,
      section: 'SYSTEM & ANALYTICS',
    },
  ];

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Find currently active page title for the header bar
  const activeItem = navLinks.find(
    (item) => pathname === item.href || (item.href !== '/bookings' && pathname.startsWith(item.href))
  );

  return (
    <>
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200/90 text-slate-900 sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
            {/* Left: Brand Logo + ADMIN Pill + Current Page Breadcrumb */}
            <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
              <Link href="/dashboard" className="flex items-center space-x-2 group shrink-0 py-1">
                <img
                  src="/images/logo.png"
                  alt="Kandy Cabs"
                  className="h-8 sm:h-8.5 w-auto object-contain transition-transform group-hover:scale-102"
                  style={{ height: 32, maxHeight: 36, width: 'auto', display: 'block' }}
                />
                <span className="text-[9.5px] sm:text-[10px] font-bold bg-amber-500/15 text-amber-900 border border-amber-500/30 px-2 py-0.5 rounded-md tracking-wider uppercase">
                  Admin
                </span>
              </Link>

              {/* Current Active Page Pill in Header */}
              {activeItem && (
                <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-slate-200 truncate">
                  <span className="text-xs font-semibold text-slate-400">/</span>
                  <span className="text-xs font-bold text-slate-800 truncate">{activeItem.label}</span>
                </div>
              )}
            </div>

            {/* Right: User Profile, Logout & Hamburger Menu Button */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              {user ? (
                <>
                  <div className="hidden md:block text-right pr-1">
                    <div className="text-xs font-bold text-slate-900 leading-tight">
                      {user.fullName || 'Master Admin'}
                    </div>
                    <div className="text-[10.5px] text-slate-500 font-mono font-medium">{user.phone}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => logout()}
                    className="inline-flex items-center space-x-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 rounded-xl border border-slate-200 transition-colors shadow-2xs"
                    title="Sign out of Admin"
                  >
                    <IconLogout className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition shadow-xs"
                >
                  Login
                </Link>
              )}

              {/* Divider */}
              <div className="h-6 w-px bg-slate-200 mx-0.5" />

              {/* Hamburger Menu Button (Right-aligned) */}
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center justify-center space-x-1.5 p-2 lg:px-3 lg:py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 shadow-2xs transition-all active:scale-95 group focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
                aria-label="Open Navigation Menu"
                title="Open Navigation Menu"
              >
                <IconMenu className="w-4 h-4 text-amber-500 transition-transform group-hover:scale-110" />
                <span className="hidden lg:inline text-xs font-bold tracking-wide text-slate-800">Menu</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Slidable Off-Canvas Navigation Drawer (Right to Left) */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out Panel from Right */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-full max-w-sm sm:max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Admin Navigation Drawer"
      >
        {/* Drawer Top Header with generous top padding for logo visibility */}
        <div className="flex items-center justify-between px-6 pt-8 pb-5 border-b border-slate-100 bg-linear-to-b from-slate-50/90 to-white">
          <div className="flex items-center space-x-3">
            <img
              src="/images/logo.png"
              alt="Kandy Cabs"
              className="h-9 w-auto max-h-9 object-contain"
              style={{ height: 36, maxHeight: 36, width: 'auto', display: 'block' }}
            />
            <span className="text-[10px] font-extrabold bg-amber-500/15 text-amber-900 border border-amber-500/30 px-2.5 py-1 rounded-md tracking-wider uppercase shadow-2xs">
              Admin Console
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-950 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition"
            aria-label="Close menu"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Options List */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {(['OPERATIONS', 'FLEET & DRIVERS', 'SYSTEM & ANALYTICS'] as const).map((section) => {
            const sectionLinks = navLinks.filter((l) => l.section === section);

            return (
              <div key={section} className="space-y-1.5">
                <div className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {section}
                </div>

                <div className="space-y-1">
                  {sectionLinks.map((link) => {
                    const isActive =
                      pathname === link.href ||
                      (link.href !== '/bookings' && pathname.startsWith(link.href));
                    const IconComponent = link.icon;

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-xl transition-all duration-150 group ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-600/30 font-bold'
                            : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100/80 font-medium'
                        }`}
                      >
                        <IconComponent
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive ? 'text-slate-950' : 'text-slate-500 group-hover:text-slate-900'
                          }`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold leading-tight flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span>{link.label}</span>
                              {link.href === '/vehicle-evidence' && expiringDocsCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-black bg-amber-500 text-white shadow-2xs">
                                  {expiringDocsCount}
                                </span>
                              )}
                            </span>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 ml-2 shrink-0" />
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Drawer Bottom Profile & Sign Out */}
        {user && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {user.fullName || 'Master Admin'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">{user.phone}</div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 transition"
            >
              <IconLogout className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
