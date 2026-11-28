'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AdminNavbar } from '@/components/AdminNavbar';
import { BookingStatus, DriverVerificationStatus, getSupabaseClient } from '@kandy-cabs/shared';
import { parseIntermediateStops } from '@/lib/bookingHelpers';
import {
  IconDashboard,
  IconBookings,
  IconMap,
  IconPayments,
  IconShield,
  IconCar,
  IconTag,
  IconFileText,
  IconRefresh,
  IconAlert,
  IconSparkles,
  IconPinPickup,
  IconPinDropoff,
  IconWallet,
  IconClock,
} from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scheduleTab, setScheduleTab] = useState<'TODAY' | 'TOMORROW' | 'NOT_ACCEPTED' | 'MISSED'>('TODAY');

  useEffect(() => {
    setMounted(true);
    setLastRefreshed(new Date());
  }, []);

  const fetchDashboardStats = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch('/api/admin/dashboard/stats');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch and Realtime subscription with adaptive fallback polling
  useEffect(() => {
    fetchDashboardStats();

    const supabase = getSupabaseClient();
    let channel: any = null;
    let fallbackPollInterval: NodeJS.Timeout | null = null;

    const startFallbackPolling = (intervalMs = 30000) => {
      if (fallbackPollInterval) clearInterval(fallbackPollInterval);
      fallbackPollInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchDashboardStats(true);
        }
      }, intervalMs);
    };

    if (supabase) {
      try {
        channel = supabase
          .channel(`admin-dashboard-stats-${Date.now()}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'Booking' },
            () => {
              setRealtimeActive(true);
              fetchDashboardStats(true);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'Driver' },
            () => {
              fetchDashboardStats(true);
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              setRealtimeActive(true);
              // Relax polling to 60s when Realtime is active
              startFallbackPolling(60000);
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              setRealtimeActive(false);
              // Fallback to 30s polling when Realtime is disconnected
              startFallbackPolling(30000);
            }
          });
      } catch (err) {
        console.warn('Realtime subscription error:', err);
        setRealtimeActive(false);
        startFallbackPolling(30000);
      }
    } else {
      setRealtimeActive(false);
      startFallbackPolling(30000);
    }

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      } else if (channel) {
        channel.unsubscribe();
      }
      if (fallbackPollInterval) {
        clearInterval(fallbackPollInterval);
      }
    };
  }, [fetchDashboardStats]);

  const stats = data?.stats || {
    bookings: { total: 0, pendingAdmin: 0, dispatched: 0, active: 0, completed: 0, cancelled: 0 },
    financials: { grossRevenue: 0, advanceCollected: 0 },
    drivers: { total: 0, online: 0, pendingKyc: 0, approved: 0 },
    fleets: { categoriesCount: 0, pricingRulesCount: 0 },
  };

  const recentBookings = data?.recentBookings || [];
  const recentAuditLogs = data?.recentAuditLogs || [];

  const operationalSchedule = data?.operationalSchedule || {
    todayTrips: [],
    tomorrowTrips: [],
    missedPickups: [],
    driverNotAccepted: [],
  };

  const operationalWatch = data?.stats?.operationalWatch || {
    todayCount: 0,
    tomorrowCount: 0,
    missedPickupCount: 0,
    driverNotAcceptedCount: 0,
    atRiskCount: 0,
  };

  const formatBookingDateTime = (dateStr: string | Date | undefined) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[d.getMonth()];
      const hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      return `${day} ${month}, ${formattedHours}:${minutes} ${ampm}`;
    } catch {
      return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case BookingStatus.PENDING_ADMIN:
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case BookingStatus.DISPATCHED:
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case BookingStatus.DRIVER_ACCEPTED:
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case BookingStatus.DRIVER_EN_ROUTE:
      case BookingStatus.TRIP_STARTED:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case BookingStatus.TRIP_COMPLETED:
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case BookingStatus.CANCELLED:
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    if (
      status === BookingStatus.DRIVER_EN_ROUTE ||
      status === BookingStatus.TRIP_STARTED ||
      status === 'ON_TRIP' ||
      status === 'ON TRIP'
    ) {
      return 'ON TRIP';
    }
    return String(status).replace(/_/g, ' ');
  };

  return (
    <div className="min-h-screen bg-[#f4f7fc] text-slate-900 flex flex-col font-sans">
      <AdminNavbar />

      <main className="flex-1 w-full px-4 sm:px-6 lg:pl-6 lg:pr-24 py-5 sm:py-6 space-y-4">
        {/* Top Header & Quick Action Bar */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center space-x-2 min-w-0">
              <IconSparkles className="w-4 h-4 text-[#F95700] shrink-0" />
              <h1 className="text-[13.5px] sm:text-base font-bold text-[#0F172A] tracking-tight truncate">Operations Control Center</h1>
            </div>

            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-slate-100/90 border border-[#E2E8F0] text-slate-700 text-[10px] sm:text-xs font-mono font-medium shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${realtimeActive ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'}`} />
              <span suppressHydrationWarning>
                {mounted && lastRefreshed ? lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : 'Syncing...'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 sm:gap-2 mt-2 sm:mt-2.5 text-xs">
            <button
              onClick={() => fetchDashboardStats(false)}
              disabled={loading || refreshing}
              className="px-2.5 py-1 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] sm:text-xs flex items-center space-x-1.5 shadow-2xs transition disabled:opacity-50"
            >
              <IconRefresh className={`w-3 h-3 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? '...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchDashboardStats(true)}
              className="px-2.5 py-1 rounded-lg bg-[#F95700] hover:bg-[#e04e00] text-white font-semibold text-[11px] sm:text-xs flex items-center space-x-1.5 shadow-xs transition"
            >
              <IconRefresh className="w-3 h-3 text-white" />
              <span>Realtime</span>
            </button>
          </div>
        </div>

        {/* Document Expiry Urgent Alert Banner */}
        {((data as any)?.stats?.drivers?.expiringDocumentsCount || 0) > 0 && (
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-400/50 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <IconAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-tight">
                    Document Expiry Notice: {(data as any)?.stats?.drivers?.expiringDocumentsCount} Driver{((data as any)?.stats?.drivers?.expiringDocumentsCount || 0) > 1 ? 's' : ''} Require Attention
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white uppercase tracking-wider">
                    ≤ 5 Days Expiry Warning
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-amber-900/80 mt-0.5">
                  Vehicles or licenses have documents expiring within 5 days or expired (Insurance, FC, Tax, Permit, PUC, DL). Push & in-app alerts are active until updated.
                </p>
              </div>
            </div>
            <Link
              href="/vehicle-evidence?status=EXPIRING"
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs"
            >
              <span>Review Expiring Documents</span>
              <span>→</span>
            </Link>
          </div>
        )}

        {/* 4 Primary Top KPI Cards (Compact and responsive for mobile & tablet) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {/* Card 1: Needs Dispatch */}
          <Link
            href="/bookings?status=PENDING_ADMIN"
            className="group bg-white hover:bg-slate-50/50 border border-slate-200/80 hover:border-slate-300 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center space-x-1 sm:space-x-1.5 text-slate-700 mb-0.5">
                <IconAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-tight truncate">Needs Dispatch</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 my-0.5 sm:my-1">
                {loading ? '...' : stats.bookings.pendingAdmin}
              </div>
            </div>
            <div className="flex items-center justify-between text-[9.5px] sm:text-[11px] pt-1.5 border-t border-slate-100 text-slate-500 gap-1">
              <span className="truncate">Awaiting dispatch</span>
              <span className="text-[#ea580c] font-bold shrink-0 group-hover:translate-x-0.5 transition-transform">Action →</span>
            </div>
          </Link>

          {/* Card 2: Active Rides */}
          <Link
            href="/live-map"
            className="group bg-white hover:bg-slate-50/50 border border-slate-200/80 hover:border-slate-300 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center space-x-1 sm:space-x-1.5 text-slate-700 mb-0.5">
                <IconCar className="w-3.5 h-3.5 text-slate-800 shrink-0" />
                <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-tight truncate">Active Rides</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 my-0.5 sm:my-1">
                {loading ? '...' : stats.bookings.active}
              </div>
            </div>
            <div className="flex items-center justify-between text-[9.5px] sm:text-[11px] pt-1.5 border-t border-slate-100 text-slate-500 gap-1">
              <span className="truncate flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{stats.drivers.online} Online</span>
              </span>
              <span className="text-[#1e293b] font-bold shrink-0 group-hover:translate-x-0.5 transition-transform">Live Map →</span>
            </div>
          </Link>

          {/* Card 3: Total Volume */}
          <Link
            href="/payments"
            className="group bg-white hover:bg-slate-50/50 border border-slate-200/80 hover:border-slate-300 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center space-x-1 sm:space-x-1.5 text-slate-700 mb-0.5">
                <IconWallet className="w-3.5 h-3.5 text-slate-800 shrink-0" />
                <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-tight truncate">Total Volume</span>
              </div>
              <div className="text-[15px] sm:text-xl font-black text-slate-900 my-0.5 sm:my-1 truncate">
                {loading ? '...' : `₹${stats.financials.grossRevenue.toLocaleString('en-IN')}`}
              </div>
            </div>
            <div className="flex items-center justify-between text-[9.5px] sm:text-[11px] pt-1.5 border-t border-slate-100 text-slate-500 gap-1">
              <span className="truncate text-emerald-600 font-semibold">
                ↑ ₹{stats.financials.advanceCollected.toLocaleString('en-IN')} Adv.
              </span>
              <span className="text-[#1e293b] font-bold shrink-0 group-hover:translate-x-0.5 transition-transform">Payouts →</span>
            </div>
          </Link>

          {/* Card 4: Pending KYC & Payouts */}
          <Link
            href="/vehicle-evidence?status=PENDING"
            className="group bg-white hover:bg-slate-50/50 border border-slate-200/80 hover:border-slate-300 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center space-x-1 sm:space-x-1.5 text-slate-700 mb-0.5">
                <IconClock className="w-3.5 h-3.5 text-slate-800 shrink-0" />
                <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-tight truncate">Pending Review</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 my-0.5 sm:my-1">
                {loading ? '...' : stats.drivers.pendingKyc}
              </div>
            </div>
            <div className="flex items-center justify-between text-[9.5px] sm:text-[11px] pt-1.5 border-t border-slate-100 text-slate-500 gap-1">
              <span className="truncate flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                <span>{stats.drivers.approved} Approved</span>
              </span>
              <span className="text-[#1e293b] font-bold shrink-0 group-hover:translate-x-0.5 transition-transform">Review →</span>
            </div>
          </Link>
        </div>

        {/* Operational Modules Quick Access Grid (Horizontal swipe on mobile, 7-col grid on desktop) */}
        <div>
          <div className="flex items-center space-x-2 mb-1.5 sm:mb-2">
            <IconDashboard className="w-3.5 h-3.5 text-slate-800 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Operational Modules</h2>
          </div>

          <div className="flex lg:grid overflow-x-auto lg:overflow-visible gap-2 pb-1.5 -mx-2.5 px-2.5 sm:mx-0 sm:px-0 lg:grid-cols-7 no-scrollbar">
            {/* 1. Bookings Management */}
            <Link
              href="/bookings"
              className="bg-white border border-[#E2E8F0] hover:border-[#F95700]/40 px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl transition duration-150 group shadow-xs hover:shadow-md flex items-center space-x-3 shrink-0 min-w-[130px] lg:min-w-0 flex-1"
              title="Bookings & Dispatch"
            >
              <IconBookings className="w-7 h-7 sm:w-8 sm:h-8 text-[#0F172A] group-hover:text-[#F95700] shrink-0 transition-all duration-200 group-hover:scale-110" />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-[13px] font-bold text-[#0F172A] group-hover:text-[#F95700] transition-colors truncate">Bookings</h4>
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">{stats.bookings.total} total</p>
              </div>
            </Link>

            {/* 2. Live Map */}
            <Link
              href="/live-map"
              className="bg-white border border-[#E2E8F0] hover:border-[#F95700]/40 px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl transition duration-150 group shadow-xs hover:shadow-md flex items-center space-x-3 shrink-0 min-w-[130px] lg:min-w-0 flex-1"
              title="Live GPS Fleet Map"
            >
              <IconMap className="w-7 h-7 sm:w-8 sm:h-8 text-[#0F172A] group-hover:text-[#F95700] shrink-0 transition-all duration-200 group-hover:scale-110" />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-[13px] font-bold text-[#0F172A] group-hover:text-[#F95700] transition-colors truncate">Live Map</h4>
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">{stats.drivers.online} online</p>
              </div>
            </Link>

            {/* 3. Payments */}
            <Link
              href="/payments"
              className="bg-white border border-[#E2E8F0] hover:border-[#F95700]/40 px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl transition duration-150 group shadow-xs hover:shadow-md flex items-center space-x-3 shrink-0 min-w-[130px] lg:min-w-0 flex-1"
              title="Payments & Settlements"
            >
              <IconPayments className="w-7 h-7 sm:w-8 sm:h-8 text-[#0F172A] group-hover:text-[#F95700] shrink-0 transition-all duration-200 group-hover:scale-110" />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-[13px] font-bold text-[#0F172A] group-hover:text-[#F95700] transition-colors truncate">Payments</h4>
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">Ledger</p>
              </div>
            </Link>

            {/* 4. Vehicle KYC */}
            <Link
              href="/vehicle-evidence?status=PENDING"
              className="bg-white border border-[#E2E8F0] hover:border-[#F95700]/40 px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl transition duration-150 group shadow-xs hover:shadow-md flex items-center space-x-3 shrink-0 min-w-[130px] lg:min-w-0 flex-1"
              title="Vehicle & Driver KYC"
            >
              <IconShield className="w-7 h-7 sm:w-8 sm:h-8 text-[#0F172A] group-hover:text-[#F95700] shrink-0 transition-all duration-200 group-hover:scale-110" />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-[13px] font-bold text-[#0F172A] group-hover:text-[#F95700] transition-colors truncate">Driver KYC & Payout</h4>
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">{stats.drivers.pendingKyc} pending</p>
              </div>
            </Link>

            {/* 5. Fleets */}
            <Link
              href="/fleets"
              className="bg-white border border-[#E2E8F0] hover:border-[#F95700]/40 px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl transition duration-150 group shadow-xs hover:shadow-md flex items-center space-x-3 shrink-0 min-w-[130px] lg:min-w-0 flex-1"
              title="Fleet Categories"
            >
              <IconCar className="w-7 h-7 sm:w-8 sm:h-8 text-[#0F172A] group-hover:text-[#F95700] shrink-0 transition-all duration-200 group-hover:scale-110" />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-[13px] font-bold text-[#0F172A] group-hover:text-[#F95700] transition-colors truncate">Fleets</h4>
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">{stats.fleets.categoriesCount} fleets</p>
              </div>
            </Link>

            {/* 6. Pricing Rules */}
            <Link
              href="/pricing"
              className="bg-white border border-[#E2E8F0] hover:border-[#F95700]/40 px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl transition duration-150 group shadow-xs hover:shadow-md flex items-center space-x-3 shrink-0 min-w-[130px] lg:min-w-0 flex-1"
              title="Pricing Rules"
            >
              <IconTag className="w-7 h-7 sm:w-8 sm:h-8 text-[#0F172A] group-hover:text-[#F95700] shrink-0 transition-all duration-200 group-hover:scale-110" />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-[13px] font-bold text-[#0F172A] group-hover:text-[#F95700] transition-colors truncate">Pricing</h4>
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">{stats.fleets.pricingRulesCount} tariffs</p>
              </div>
            </Link>

            {/* 7. Audit Logs */}
            <Link
              href="/audit-logs"
              className="bg-white border border-[#E2E8F0] hover:border-[#F95700]/40 px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl transition duration-150 group shadow-xs hover:shadow-md flex items-center space-x-3 shrink-0 min-w-[130px] lg:min-w-0 flex-1"
              title="Audit Trail"
            >
              <IconFileText className="w-7 h-7 sm:w-8 sm:h-8 text-[#0F172A] group-hover:text-[#F95700] shrink-0 transition-all duration-200 group-hover:scale-110" />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-[13px] font-bold text-[#0F172A] group-hover:text-[#F95700] transition-colors truncate">Audit Trail</h4>
                <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">Logs</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Operational Schedule & Risk Radar: Today, Tomorrow, Driver Not Accepted, Missed Pickups */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-4">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-[#F95700] flex items-center justify-center shrink-0">
                <IconClock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                    Trip Dispatch & Schedule Radar
                  </h2>
                  {operationalWatch.missedPickupCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                      {operationalWatch.missedPickupCount} Missed Pickup{operationalWatch.missedPickupCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {operationalWatch.atRiskCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                      {operationalWatch.atRiskCount} At Risk
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Real-time monitor for today & tomorrow trips, driver acceptance, and pickup risk alerts
                </p>
              </div>
            </div>

            <Link
              href="/bookings"
              className="text-xs font-semibold text-[#ea580c] hover:text-[#c2410c] transition flex items-center gap-1 self-start sm:self-auto"
            >
              All Bookings →
            </Link>
          </div>

          {/* Urgent Alert Banner if Missed Pickup or At-Risk Pickups exist */}
          {operationalWatch.missedPickupCount > 0 && (
            <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-rose-900 font-bold">
                <IconAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Action Required: {operationalWatch.missedPickupCount} scheduled pickup{operationalWatch.missedPickupCount > 1 ? 's have' : ' has'} passed pickup time without the driver starting the trip!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setScheduleTab('MISSED')}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-2xs transition shrink-0"
              >
                Review Missed Pickups ({operationalWatch.missedPickupCount})
              </button>
            </div>
          )}

          {/* 4 Interactive Filter Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Tab 1: Today's Trips */}
            <button
              type="button"
              onClick={() => setScheduleTab('TODAY')}
              className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                scheduleTab === 'TODAY'
                  ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-400/20 shadow-xs'
                  : 'bg-slate-50/80 hover:bg-slate-100/70 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] sm:text-xs font-bold uppercase tracking-tight ${
                  scheduleTab === 'TODAY' ? 'text-orange-950' : 'text-slate-600'
                }`}>
                  Today&apos;s Trips
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  scheduleTab === 'TODAY' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {operationalWatch.todayCount}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                {operationalWatch.atRiskCount > 0 ? (
                  <span className="text-amber-700 font-bold">⚠️ {operationalWatch.atRiskCount} at-risk</span>
                ) : (
                  <span>Scheduled for today</span>
                )}
              </div>
            </button>

            {/* Tab 2: Tomorrow's Trips */}
            <button
              type="button"
              onClick={() => setScheduleTab('TOMORROW')}
              className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                scheduleTab === 'TOMORROW'
                  ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-400/20 shadow-xs'
                  : 'bg-slate-50/80 hover:bg-slate-100/70 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] sm:text-xs font-bold uppercase tracking-tight ${
                  scheduleTab === 'TOMORROW' ? 'text-blue-950' : 'text-slate-600'
                }`}>
                  Tomorrow&apos;s Trips
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  scheduleTab === 'TOMORROW' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {operationalWatch.tomorrowCount}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
                Advance planning
              </div>
            </button>

            {/* Tab 3: Driver Not Accepted */}
            <button
              type="button"
              onClick={() => setScheduleTab('NOT_ACCEPTED')}
              className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                scheduleTab === 'NOT_ACCEPTED'
                  ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/20 shadow-xs'
                  : 'bg-slate-50/80 hover:bg-slate-100/70 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] sm:text-xs font-bold uppercase tracking-tight ${
                  scheduleTab === 'NOT_ACCEPTED' ? 'text-amber-950' : 'text-slate-600'
                }`}>
                  Driver Not Accepted
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  operationalWatch.driverNotAcceptedCount > 0
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {operationalWatch.driverNotAcceptedCount}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
                Pending acceptance
              </div>
            </button>

            {/* Tab 4: Missed Pickups */}
            <button
              type="button"
              onClick={() => setScheduleTab('MISSED')}
              className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                scheduleTab === 'MISSED'
                  ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-400/20 shadow-xs'
                  : 'bg-slate-50/80 hover:bg-slate-100/70 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] sm:text-xs font-bold uppercase tracking-tight ${
                  scheduleTab === 'MISSED' ? 'text-rose-950' : 'text-slate-600'
                }`}>
                  Missed / Overdue
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  operationalWatch.missedPickupCount > 0
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {operationalWatch.missedPickupCount}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
                {operationalWatch.missedPickupCount > 0 ? (
                  <span className="text-rose-600 font-bold">Driver missed pickup</span>
                ) : (
                  <span>All pickups on time</span>
                )}
              </div>
            </button>
          </div>

          {/* Active Tab Trip Cards List */}
          <div className="space-y-2.5 pt-1">
            {(() => {
              const currentList =
                scheduleTab === 'TODAY'
                  ? operationalSchedule.todayTrips
                  : scheduleTab === 'TOMORROW'
                  ? operationalSchedule.tomorrowTrips
                  : scheduleTab === 'NOT_ACCEPTED'
                  ? operationalSchedule.driverNotAccepted
                  : operationalSchedule.missedPickups;

              if (currentList.length === 0) {
                return (
                  <div className="text-center py-8 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs sm:text-sm">
                    {loading ? (
                      'Loading operational radar...'
                    ) : scheduleTab === 'MISSED' ? (
                      <div className="space-y-1">
                        <span className="text-base">✅</span>
                        <p className="font-semibold text-slate-700">No Missed Pickups</p>
                        <p className="text-xs text-slate-400">All scheduled pickups are on schedule or already started/completed.</p>
                      </div>
                    ) : scheduleTab === 'NOT_ACCEPTED' ? (
                      <div className="space-y-1">
                        <span className="text-base">✅</span>
                        <p className="font-semibold text-slate-700">All Dispatches Accepted</p>
                        <p className="text-xs text-slate-400">There are no pending driver acceptances right now.</p>
                      </div>
                    ) : scheduleTab === 'TODAY' ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-700">No Trips Scheduled for Today</p>
                        <p className="text-xs text-slate-400">New bookings for today will appear here in real-time.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-700">No Trips Scheduled for Tomorrow</p>
                        <p className="text-xs text-slate-400">Upcoming advance bookings will appear here.</p>
                      </div>
                    )}
                  </div>
                );
              }

              return currentList.map((t: any) => (
                <div
                  key={t.id}
                  className={`p-3 sm:p-4 rounded-xl border transition-all duration-200 ${
                    t.riskLevel === 'MISSED_PICKUP'
                      ? 'bg-rose-50/50 border-rose-300 shadow-xs'
                      : t.riskLevel === 'AT_RISK'
                      ? 'bg-amber-50/50 border-amber-300 shadow-xs'
                      : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Top Bar: Ref, Type, Status Pill, Scheduled Pickup Time */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/bookings?search=${t.humanReadableRef}`}
                        className="font-mono font-bold text-xs sm:text-sm text-[#F95700] hover:underline"
                      >
                        {t.humanReadableRef}
                      </Link>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                        {t.tripType || 'CAB'}
                      </span>

                      {/* Prominent Risk / Status Badge */}
                      {t.riskLevel === 'MISSED_PICKUP' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-rose-600 text-white shadow-2xs flex items-center gap-1 animate-pulse">
                          <span>🚨 MISSED PICKUP</span>
                          <span>({t.diffMinutes < 0 ? `${Math.abs(t.diffMinutes)}m overdue` : 'Delayed'})</span>
                        </span>
                      ) : t.riskLevel === 'AT_RISK' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-amber-500 text-white shadow-2xs flex items-center gap-1">
                          <span>⚠️ AT RISK</span>
                          <span>(Pickup in {t.diffMinutes}m • Driver not en route)</span>
                        </span>
                      ) : t.status === BookingStatus.DISPATCHED ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
                          ⏳ Dispatched — Pending Driver Acceptance
                        </span>
                      ) : t.status === BookingStatus.PENDING_ADMIN ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          ⚡ Needs Driver Dispatch
                        </span>
                      ) : t.status === BookingStatus.DRIVER_EN_ROUTE ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          🚗 Driver En Route
                        </span>
                      ) : t.status === BookingStatus.TRIP_STARTED ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          🟢 Trip In Progress
                        </span>
                      ) : (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${getStatusBadge(t.status)}`}>
                          {getStatusLabel(t.status)}
                        </span>
                      )}
                    </div>

                    {/* Scheduled Pickup Date & Time */}
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <IconClock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Pickup: {formatBookingDateTime(t.scheduledAt)}</span>
                      {t.diffMinutes > 0 && t.diffMinutes <= 180 && (
                        <span className="text-[11px] font-semibold text-slate-500">
                          (in {Math.floor(t.diffMinutes / 60) > 0 ? `${Math.floor(t.diffMinutes / 60)}h ${t.diffMinutes % 60}m` : `${t.diffMinutes}m`})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Route & Customer / Driver Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div className="md:col-span-2 space-y-1">
                      <div className="flex items-start gap-1.5 text-slate-800 leading-tight">
                        <span className="font-bold text-slate-900 shrink-0">From:</span>
                        <span className="truncate">{t.pickupAddress}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-slate-800 leading-tight">
                        <span className="font-bold text-slate-900 shrink-0">To:</span>
                        <span className="truncate">{t.dropAddress}</span>
                      </div>
                      <div className="text-slate-500 text-[11px] pt-0.5">
                        Customer: <span className="font-semibold text-slate-700">{t.customer?.user?.fullName || 'Guest'}</span>
                        {t.customer?.user?.phone && (
                          <span className="ml-1 text-slate-500">({t.customer.user.phone})</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col justify-between items-start md:items-end gap-2 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                      <div className="text-left md:text-right">
                        {t.assignedDriver ? (
                          <div>
                            <div className="font-bold text-slate-900 flex items-center md:justify-end gap-1">
                              <span>Driver:</span> {t.assignedDriver.user?.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {t.assignedDriver.user?.phone || 'Phone on file'}
                              {t.assignedDriver.vehicles?.[0]?.plateNumber && (
                                <span> • {t.assignedDriver.vehicles[0].plateNumber}</span>
                              )}
                            </div>
                          </div>
                        ) : t.dispatches?.[0]?.driver ? (
                          <div>
                            <div className="font-bold text-orange-700">
                              Dispatched to: {t.dispatches[0].driver.user?.fullName}
                            </div>
                            <div className="text-[11px] text-orange-600">
                              Awaiting Driver Acceptance
                            </div>
                          </div>
                        ) : (
                          <div className="font-bold text-rose-600 flex items-center gap-1">
                            <span>⚠️ No Driver Assigned</span>
                          </div>
                        )}
                        <div className="text-[11px] font-extrabold text-slate-900 mt-0.5">
                          ₹{Number(t.estimatedFare || 0).toLocaleString('en-IN')}
                          <span className="text-[10px] font-medium text-slate-500 ml-1">
                            (Adv: ₹{Number(t.advanceAmount || 0).toLocaleString('en-IN')})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/bookings?search=${t.humanReadableRef}`}
                          className="px-3 py-1 bg-[#F95700] hover:bg-[#e04e00] text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1"
                        >
                          <span>{t.status === BookingStatus.PENDING_ADMIN || !t.assignedDriver ? 'Dispatch Now →' : 'View Dispatch →'}</span>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Urgent Risk Banner for this trip */}
                  {t.riskMessage && (
                    <div
                      className={`mt-2.5 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 ${
                        t.riskLevel === 'MISSED_PICKUP'
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <IconAlert className="w-4 h-4 shrink-0" />
                        <span className="truncate">{t.riskMessage}</span>
                      </div>
                      <Link
                        href={`/bookings?search=${t.humanReadableRef}`}
                        className="underline hover:no-underline font-extrabold shrink-0"
                      >
                        Dispatch / Call Driver →
                      </Link>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* 2-Column Split: Recent Bookings & Audit Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Column 1: Live Bookings Feed */}
          <div className="bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <IconBookings className="w-4 h-4 text-slate-800" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">Recent Bookings</h3>
                </div>
                <Link
                  href="/bookings"
                  className="text-xs font-semibold text-[#ea580c] hover:text-[#c2410c] transition flex items-center gap-1"
                >
                  View All →
                </Link>
              </div>

              {recentBookings.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  {loading ? 'Loading bookings...' : 'No bookings found yet.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentBookings.map((b: any) => (
                    <div key={b.id} className="py-2.5 sm:py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-1.5 sm:gap-3">
                      {/* Trip Details */}
                      <div className="space-y-0.5 sm:space-y-1 flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                          <span className="font-mono font-bold text-[#ea580c] text-xs">
                            {b.humanReadableRef || `#${b.id.slice(0, 8)}`}
                          </span>
                          <span className="text-[9.5px] sm:text-[10px] text-slate-600 font-medium uppercase px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200/60">
                            {b.category || 'CAB'}
                          </span>
                        </div>

                        {/* Trip Route: On mobile, 'To:' is arranged below 'From:' */}
                        <div className="text-slate-800 font-medium text-[11.5px] sm:text-xs leading-tight sm:leading-snug" title={`${b.pickupAddress} ${parseIntermediateStops(b).length > 0 ? `➔ Via: ${parseIntermediateStops(b).join(' ➔ ')}` : ''} ➔ ${b.dropAddress}`}>
                          {/* Mobile View: stacked lines */}
                          <div className="sm:hidden space-y-0.5">
                            <div className="truncate">
                              <span className="text-slate-900 font-bold">From:</span> <span className="text-slate-700">{b.pickupAddress}</span>
                            </div>
                            {parseIntermediateStops(b).length > 0 && (
                              <div className="truncate text-slate-700">
                                <span className="text-slate-900 font-bold">Via:</span> {parseIntermediateStops(b).join(', ')}
                              </div>
                            )}
                            <div className="truncate">
                              <span className="text-slate-900 font-bold">To:</span> <span className="text-slate-700">{b.dropAddress}</span>
                            </div>
                          </div>

                          {/* Desktop View: inline row */}
                          <p className="hidden sm:block truncate">
                            <span className="text-slate-900 font-bold">From:</span> {b.pickupAddress}
                            {parseIntermediateStops(b).length > 0 && (
                              <span className="text-slate-700">
                                {' '}➔ <span className="text-slate-900 font-bold">Via:</span> {parseIntermediateStops(b).join(' ➔ ')}
                              </span>
                            )}
                            {' '}➔ <span className="text-slate-900 font-bold">To:</span> {b.dropAddress}
                          </p>
                        </div>

                        <p className="text-[10.5px] sm:text-[11px] text-slate-400 truncate">
                          Customer: <span className="text-slate-600 font-medium">{b.customer?.user?.fullName || b.customer?.user?.phone || 'Guest'}</span>
                        </p>
                      </div>

                      {/* Status & Fare: Arranged below trip details on mobile, right-aligned on desktop */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1 pt-1 sm:pt-0 shrink-0">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[9.5px] sm:text-[10px] font-semibold rounded-full border whitespace-nowrap ${getStatusBadge(
                            b.status
                          )}`}
                        >
                          {getStatusLabel(b.status)}
                        </span>
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                          ₹{b.totalFare?.toLocaleString('en-IN') || 0}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex justify-between items-center text-[11px] sm:text-xs text-slate-500">
              <span>Quick status breakdown:</span>
              <div className="flex items-center space-x-2">
                <span className="text-emerald-700 font-semibold">{stats.bookings.completed} Completed</span>
                <span>•</span>
                <span className="text-rose-700 font-semibold">{stats.bookings.cancelled} Cancelled</span>
              </div>
            </div>
          </div>

          {/* Column 2: Audit Stream */}
          <div className="bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <IconFileText className="w-4 h-4 text-slate-800" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">Latest System Actions</h3>
                </div>
                <Link
                  href="/audit-logs"
                  className="text-xs font-semibold text-[#ea580c] hover:text-[#c2410c] transition"
                >
                  View Audit →
                </Link>
              </div>

              {recentAuditLogs.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  {loading ? 'Loading audit trail...' : 'No audit records logged yet.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentAuditLogs.map((log: any) => (
                    <div key={log.id} className="py-2.5 sm:py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-2 text-xs">
                      <div className="space-y-0.5 max-w-[70%]">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-800 text-[11.5px] sm:text-xs">{log.action}</span>
                        </div>
                        <p className="text-[10.5px] sm:text-[11px] text-slate-500 truncate">
                          Target: {log.entityType} ({log.entityId ? `#${log.entityId.slice(0, 8)}` : 'System'})
                        </p>
                        <p className="text-[9.5px] sm:text-[10px] text-slate-400">
                          By: {log.actor?.fullName || log.actor?.phone || 'System Automated'}
                        </p>
                      </div>

                      <div className="text-right text-[9.5px] sm:text-[10px] text-slate-500 font-mono">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <br />
                        {new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 text-right">
              <Link
                href="/audit-logs"
                className="text-[11px] sm:text-xs text-slate-400 hover:text-slate-700 transition"
              >
                Audits are cryptographically preserved & immutable
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
