'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  IconTicket,
  IconImage,
  IconFileText,
  IconLogout,
  IconMenu,
  IconX,
  IconXCircle,
  IconSteeringWheel,
  IconScale,
  IconWallet,
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [expiringDocsCount, setExpiringDocsCount] = useState<number>(0);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      href: '/chauffeur',
      label: 'Chauffeur Allowance',
      description: 'Driver bata, duty hours (6 AM-8 PM) & trip rules',
      icon: IconSteeringWheel,
      section: 'FLEET & DRIVERS',
    },
    {
      href: '/cancellation',
      label: 'Cancellation Rules',
      description: 'Fleet & trip-wise cancellation charges & policies',
      icon: IconXCircle,
      section: 'FLEET & DRIVERS',
    },
    {
      href: '/deposits-fines',
      label: 'Security Deposit & Fines',
      description: 'Driver security deposits, violation penalties & deductions',
      icon: IconScale,
      section: 'FLEET & DRIVERS',
    },
    {
      href: '/driver-payouts',
      label: 'Driver Wallet & Payouts',
      description: 'Fleet driver wallet balances, earnings & settlements',
      icon: IconWallet,
      section: 'FLEET & DRIVERS',
    },
    {
      href: '/coupons',
      label: 'Coupons & Promos',
      description: 'Flat amount (₹) & percentage (%) discount promo codes',
      icon: IconTicket,
      section: 'SYSTEM & ANALYTICS',
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
      if (e.key === 'Escape') {
        setIsMobileOpen(false);
        setIsHovered(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close on route change
  useEffect(() => {
    setIsMobileOpen(false);
    setIsHovered(false);
  }, [pathname]);

  const activeItem = navLinks.find(
    (item) => pathname === item.href || (item.href !== '/bookings' && pathname.startsWith(item.href))
  );

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  return (
    <>
      {/* 1. Top Header Bar - Full Width with Reduced Side Padding */}
      <header className="bg-white border-b border-[#E2E8F0] text-[#0F172A] sticky top-0 z-30 shadow-2xs transition-all w-full">
        <div className="w-full px-3 sm:px-6 lg:pl-6 lg:pr-24">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Left: Brand Logo + ADMIN Pill + Breadcrumbs */}
            <div className="flex items-center space-x-3 shrink-0">
              <Link href="/dashboard" className="flex items-center group shrink-0">
                <img
                  src="/images/logo.png"
                  alt="Kandy Cabs"
                  className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-102"
                  style={{ height: 32, maxHeight: 36, width: 'auto', display: 'block' }}
                />
              </Link>

              {activeItem && (
                <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-[#E2E8F0] truncate">
                  <span className="text-xs font-semibold text-slate-300">/</span>
                  <span className="text-xs font-bold text-[#0F172A] truncate">{activeItem.label}</span>
                </div>
              )}
            </div>

            {/* Right: Logout & Mobile Toggle */}
            <div className="flex items-center space-x-2.5 shrink-0">
              {user ? (
                <button
                  type="button"
                  onClick={() => logout()}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-[#E2E8F0] transition-colors shadow-2xs cursor-pointer"
                  title="Sign out of Admin"
                >
                  <IconLogout className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#F95700] hover:bg-[#e04e00] rounded-xl transition shadow-xs"
                >
                  Login
                </Link>
              )}

              {/* Mobile menu button (screens < lg) */}
              <button
                type="button"
                onClick={() => setIsMobileOpen(true)}
                className="lg:hidden inline-flex items-center justify-center p-1.5 rounded-lg text-slate-700 hover:text-[#F95700] hover:bg-slate-100/80 transition active:scale-95 cursor-pointer"
                aria-label="Open Navigation Menu"
              >
                <IconMenu className="w-6 h-6 text-[#0F172A] hover:text-[#F95700] transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Desktop/Laptop Right-Side Menu: Slim Icon Dock that Expands on Hover */}
      <div
        className="hidden lg:block fixed top-0 bottom-0 right-0 z-50 pointer-events-auto"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <aside
          className={`h-full bg-[#0F172A] text-white shadow-2xl border-l border-slate-800 flex flex-col transition-all duration-300 ease-out overflow-hidden ${
            isHovered ? 'w-72 shadow-[0_0_50px_rgba(0,0,0,0.5)]' : 'w-[68px]'
          }`}
        >
          {/* Top Brand Area of the Right Dock */}
          <div className="h-16 border-b border-slate-800/90 flex items-center px-2.5 shrink-0 bg-[#0b1120]">
            <Link
              href="/dashboard"
              className="flex items-center space-x-2.5 w-full group overflow-hidden"
              title="Kandy Cabs Admin"
            >
              {isHovered ? (
                <div className="flex items-center space-x-2.5 min-w-0 transition-opacity duration-200">
                  <img
                    src="/images/logo-white.png"
                    alt="Kandy Cabs"
                    className="h-8 w-auto object-contain shrink-0"
                    style={{ maxHeight: 32 }}
                  />
                  <span className="text-[9px] font-extrabold bg-[#F95700]/20 text-[#F95700] border border-[#F95700]/30 px-1.5 py-0.5 rounded uppercase shrink-0">
                    Admin
                  </span>
                </div>
              ) : (
                <div className="w-full flex items-center justify-center">
                  <img
                    src="/images/logo-white.png"
                    alt="Kandy Cabs"
                    className="h-6 w-auto max-w-[48px] object-contain shrink-0"
                  />
                </div>
              )}
            </Link>
          </div>

          {/* Navigation Links Column */}
          <div className="flex-1 overflow-y-auto py-3 space-y-4 no-scrollbar px-2">
            {(['OPERATIONS', 'FLEET & DRIVERS', 'SYSTEM & ANALYTICS'] as const).map((section) => {
              const sectionLinks = navLinks.filter((l) => l.section === section);

              return (
                <div key={section} className="space-y-1">
                  {isHovered && (
                    <div className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 pb-1 truncate animate-fadeIn">
                      {section}
                    </div>
                  )}

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
                          prefetch={false}
                          title={!isHovered ? link.label : undefined}
                          className={`flex items-center rounded-xl transition-all duration-150 group cursor-pointer ${
                            isHovered ? 'px-3 py-2 space-x-3 w-full' : 'w-11 h-11 justify-center mx-auto'
                          } ${
                            isActive
                              ? 'bg-[#F95700] text-white font-bold shadow-md shadow-[#F95700]/30'
                              : 'text-slate-400 hover:text-white hover:bg-white/[0.08] font-medium'
                          }`}
                        >
                          <div className="relative shrink-0 flex items-center justify-center">
                            <IconComponent
                              className={`w-5 h-5 transition-colors ${
                                isActive ? 'text-white' : 'text-slate-400 group-hover:text-[#F95700]'
                              }`}
                            />
                            {!isHovered && link.href === '/vehicle-evidence' && expiringDocsCount > 0 && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-[#0F172A] animate-pulse" />
                            )}
                          </div>

                          {isHovered && (
                            <div className="min-w-0 flex-1 truncate animate-fadeIn">
                              <div className="text-xs font-semibold leading-tight flex items-center justify-between">
                                <span className="truncate">{link.label}</span>
                                {link.href === '/vehicle-evidence' && expiringDocsCount > 0 && (
                                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white shadow-2xs">
                                    {expiringDocsCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Drawer Bottom Profile Area */}
          {user && (
            <div className={`border-t border-slate-800 bg-[#0b1120] transition-all ${isHovered ? 'p-3' : 'p-2'}`}>
              <div className="flex items-center justify-between min-w-0">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#F95700] to-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 mx-auto">
                    {user.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'MA'}
                  </div>
                  {isHovered && (
                    <div className="min-w-0 flex-1 truncate">
                      <div className="text-xs font-bold text-white truncate">
                        {user.fullName || 'Master Admin'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{user.phone}</div>
                    </div>
                  )}
                </div>
                {isHovered && (
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition shrink-0 cursor-pointer"
                    title="Sign out of Admin"
                  >
                    <IconLogout className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* 3. Mobile Slide-Over Drawer (< lg screens) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />

          <aside className="fixed top-0 bottom-0 right-0 w-72 sm:w-80 bg-[#0F172A] text-white shadow-2xl border-l border-slate-800 flex flex-col z-50 animate-in slide-in-from-right duration-200">
            <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-[#0b1120]">
              <div className="flex items-center space-x-2.5">
                <img
                  src="/images/logo-white.png"
                  alt="Kandy Cabs"
                  className="h-7 w-auto object-contain"
                  style={{ maxHeight: 28 }}
                />
                <span className="text-[9px] font-extrabold bg-[#F95700]/20 text-[#F95700] border border-[#F95700]/30 px-1.5 py-0.5 rounded uppercase">
                  Admin
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
              {(['OPERATIONS', 'FLEET & DRIVERS', 'SYSTEM & ANALYTICS'] as const).map((section) => {
                const sectionLinks = navLinks.filter((l) => l.section === section);

                return (
                  <div key={section} className="space-y-1">
                    <div className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 pb-1">
                      {section}
                    </div>

                    <div className="space-y-0.5">
                      {sectionLinks.map((link) => {
                        const isActive =
                          pathname === link.href ||
                          (link.href !== '/bookings' && pathname.startsWith(link.href));
                        const IconComponent = link.icon;

                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            prefetch={false}
                            onClick={() => setIsMobileOpen(false)}
                            className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                              isActive
                                ? 'bg-[#F95700] text-white shadow-md shadow-[#F95700]/30'
                                : 'text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <IconComponent className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span className="truncate">{link.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {user && (
              <div className="p-4 border-t border-slate-800 bg-[#0b1120] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white truncate">{user.fullName || 'Master Admin'}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{user.phone}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileOpen(false);
                    logout();
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-600/20 rounded-lg border border-rose-500/30"
                >
                  Sign Out
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
