'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminNavbar } from '@/components/AdminNavbar';

export const dynamic = 'force-dynamic';

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<'TODAY' | 'YESTERDAY' | '7D' | '30D' | 'ALL'>('TODAY');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/analytics/activity?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load analytics activity:', err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
    if (!autoRefresh) return;
    const interval = setInterval(fetchAnalytics, 15000); // 15s auto-poll
    return () => clearInterval(interval);
  }, [fetchAnalytics, autoRefresh]);

  const summary = data?.summary || {
    visitors: 0,
    viewRates: 0,
    viewHatchback: 0,
    viewSedan: 0,
    viewSuv: 0,
    viewSuvPremium: 0,
    viewTempo: 0,
    startedBooking: 0,
    completedBooking: 0,
  };

  const customerSegments = data?.customerSegments || {
    newVisitors: 0,
    returningVisitors: 0,
    newCustomers: 0,
    existingCustomers: 0,
  };

  const platforms = data?.platforms || { web: 0, app: 0 };
  const totalPlatformSessions = Math.max(platforms.web + platforms.app, 1);
  const webPercent = Math.round((platforms.web / totalPlatformSessions) * 100);
  const appPercent = Math.round((platforms.app / totalPlatformSessions) * 100);

  const totalSegmentCustomers = Math.max(customerSegments.newCustomers + customerSegments.existingCustomers, 1);
  const newCustomerPercent = Math.round((customerSegments.newCustomers / totalSegmentCustomers) * 100);
  const existingCustomerPercent = Math.round((customerSegments.existingCustomers / totalSegmentCustomers) * 100);

  const conversionRate = summary.visitors > 0 ? Math.min((summary.completedBooking / summary.visitors) * 100, 100).toFixed(1) : '0.0';
  const rateViewRate = summary.visitors > 0 ? Math.min((summary.viewRates / summary.visitors) * 100, 100).toFixed(1) : '0.0';
  const startFormRate = summary.visitors > 0 ? Math.min((summary.startedBooking / summary.visitors) * 100, 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-3 sm:space-y-4">
        {/* Top Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Visitor Activity & Conversion Funnel
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Time Range Pills */}
            <div className="bg-white p-0.5 sm:p-1 rounded-xl grid grid-cols-4 sm:flex items-center border border-slate-200 text-xs font-bold shadow-2xs">
              {[
                { id: 'TODAY', label: "Today", fullLabel: "Today's Activity" },
                { id: 'YESTERDAY', label: 'Yesterday', fullLabel: 'Yesterday' },
                { id: '7D', label: '7 Days', fullLabel: 'Last 7 Days' },
                { id: '30D', label: '30 Days', fullLabel: 'Last 30 Days' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setRange(t.id as any)}
                  className={`px-2 sm:px-3 py-1.5 rounded-lg text-center transition cursor-pointer text-[11px] sm:text-xs ${
                    range === t.id
                      ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900 font-semibold'
                  }`}
                >
                  <span className="sm:hidden">{t.label}</span>
                  <span className="hidden sm:inline">{t.fullLabel}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchAnalytics()}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white hover:bg-slate-50 text-xs font-bold rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 text-slate-700 transition shadow-2xs cursor-pointer shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 1. Main Grid: Activity Hero Card + Funnel Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
          {/* Hero Activity Card (Left 6 Cols) */}
          <div className="lg:col-span-6 bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
            <div className="p-3 sm:p-5 border-b border-slate-100 bg-linear-to-r from-amber-50/80 to-orange-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">
                    {range === 'TODAY' ? "Today's Activity" : `${range} Activity`}
                  </h2>
                  <span className="text-[10px] sm:text-[11px] text-slate-500">Live visitor & booking telemetry</span>
                </div>
              </div>

              <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-100 text-emerald-800 rounded-full text-[9.5px] sm:text-[10px] font-bold border border-emerald-300 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>LIVE FEED</span>
              </div>
            </div>

            {/* Content List */}
            <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
              {/* Total Visitors Big Metric */}
              <div className="bg-slate-900 text-white rounded-xl sm:rounded-2xl p-3.5 sm:p-5 flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Total Unique Visitors</div>
                  <div className="text-3xl font-black mt-1 flex items-center gap-2">
                    <span>{summary.visitors}</span>
                    <span className="text-xs font-semibold text-slate-400">people</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-400 font-semibold">Conversion Rate</div>
                  <div className="text-xl font-black text-emerald-400">{conversionRate}%</div>
                </div>
              </div>

              {/* Step By Step Activity Items */}
              <div className="space-y-2 sm:space-y-2.5">
                {/* View Rates */}
                <div className="bg-slate-50 hover:bg-slate-100/80 transition p-2.5 sm:p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div>
                      <div className="font-black text-xs text-slate-900 tracking-wide">VIEW RATES</div>
                      <div className="text-[10px] sm:text-[11px] text-slate-500">Checked live route fare quotes</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs sm:text-sm font-black text-slate-900">{summary.viewRates}</span>
                    <span className="text-[10px] sm:text-xs text-slate-500 ml-1">people ({rateViewRate}%)</span>
                  </div>
                </div>

                {/* Categories Breakdown Group */}
                <div className="bg-amber-50/40 rounded-xl p-2.5 sm:p-3.5 border border-amber-200/70 space-y-2">
                  <div className="text-[10px] font-black uppercase text-amber-800 tracking-wider">
                    Vehicle Category Interest
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-xs">
                    <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-amber-200 flex flex-col">
                      <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500">HATCHBACK</span>
                      <span className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{summary.viewHatchback}</span>
                      <span className="text-[9px] sm:text-[9.5px] text-slate-400 truncate">WagonR / Swift</span>
                    </div>

                    <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-amber-200 flex flex-col">
                      <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500">SEDAN</span>
                      <span className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{summary.viewSedan}</span>
                      <span className="text-[9px] sm:text-[9.5px] text-slate-400 truncate">Dzire / Etios</span>
                    </div>

                    <div className="bg-white p-2 sm:p-2.5 rounded-lg border border-amber-200 flex flex-col">
                      <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500">SUV (6+1)</span>
                      <span className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{summary.viewSuv}</span>
                      <span className="text-[9px] sm:text-[9.5px] text-slate-400 truncate">Ertiga / Triber</span>
                    </div>
                  </div>

                  {(summary.viewSuvPremium > 0 || summary.viewTempo > 0) && (
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs pt-1">
                      <div className="bg-white p-1.5 sm:p-2 rounded-lg border border-amber-200 flex justify-between items-center">
                        <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500">PREMIUM SUV</span>
                        <span className="text-[11px] sm:text-xs font-black text-purple-700">{summary.viewSuvPremium} people</span>
                      </div>
                      <div className="bg-white p-1.5 sm:p-2 rounded-lg border border-amber-200 flex justify-between items-center">
                        <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-500">TEMPO TRAVELLER</span>
                        <span className="text-[11px] sm:text-xs font-black text-rose-700">{summary.viewTempo} people</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Started Booking */}
                <div className="bg-blue-50/50 hover:bg-blue-50 transition p-2.5 sm:p-3.5 rounded-xl border border-blue-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div>
                      <div className="font-black text-xs text-blue-900 tracking-wide">STARTED BOOKING</div>
                      <div className="text-[10px] sm:text-[11px] text-blue-700">Filled passenger details / scheduled date</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs sm:text-sm font-black text-blue-950">{summary.startedBooking}</span>
                    <span className="text-[10px] sm:text-xs text-blue-700 ml-1">people ({startFormRate}%)</span>
                  </div>
                </div>

                {/* Completed Booking */}
                <div className="bg-emerald-50 hover:bg-emerald-100/70 transition p-2.5 sm:p-3.5 rounded-xl border border-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div>
                      <div className="font-black text-xs text-emerald-900 tracking-wide">COMPLETED BOOKING</div>
                      <div className="text-[10px] sm:text-[11px] text-emerald-700">Confirmed & Advance paid / Assigned</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm sm:text-base font-black text-emerald-800">{summary.completedBooking}</span>
                    <span className="text-[10px] sm:text-xs text-emerald-700 ml-1">rides</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer summary bar */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 text-[11px] sm:text-xs text-slate-500 flex justify-between items-center">
              <span>Updated in real-time from mobile apps & website telemetry.</span>
              <button onClick={() => fetchAnalytics()} className="text-amber-600 hover:text-amber-800 font-bold cursor-pointer">
                Sync Now ➔
              </button>
            </div>
          </div>

          {/* Right Column: Customer Segments + Visual Funnel + Platform Breakdown (Right 6 Cols) */}
          <div className="lg:col-span-6 space-y-3 sm:space-y-6 flex flex-col justify-between">
            {/* New vs Existing Customer Segmentation Card */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  Customer Segmentation (New vs Existing)
                </h3>
                <span className="text-[11px] sm:text-xs font-bold text-slate-500">Audience Split</span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-1">
                {/* New Customers */}
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="text-[11px] sm:text-xs font-bold text-emerald-800 uppercase">New Customers</div>
                      <div className="text-lg sm:text-xl font-black text-emerald-950">
                        {customerSegments.newCustomers} <span className="text-xs font-bold text-emerald-700">({newCustomerPercent}%)</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-emerald-700 font-semibold truncate">First-time booking / registration</div>
                  <div className="w-full h-1.5 sm:h-2 bg-emerald-200/70 rounded-full mt-1.5 sm:mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${newCustomerPercent}%` }} />
                  </div>
                </div>

                {/* Existing / Returning Customers */}
                <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="text-[11px] sm:text-xs font-bold text-indigo-800 uppercase">Existing Customers</div>
                      <div className="text-lg sm:text-xl font-black text-indigo-950">
                        {customerSegments.existingCustomers} <span className="text-xs font-bold text-indigo-700">({existingCustomerPercent}%)</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-indigo-700 font-semibold truncate">Repeat rides & returning accounts</div>
                  <div className="w-full h-1.5 sm:h-2 bg-indigo-200/70 rounded-full mt-1.5 sm:mt-2 overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${existingCustomerPercent}%` }} />
                  </div>
                </div>
              </div>

              {/* Visitor Level Split */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] sm:text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" />
                  <span>New Visitors: <strong className="text-slate-900">{customerSegments.newVisitors}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-500" />
                  <span>Returning Visitors: <strong className="text-slate-900">{customerSegments.returningVisitors}</strong></span>
                </div>
              </div>
            </div>

            {/* Visual Conversion Funnel Card */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  Step-by-Step Conversion Funnel
                </h3>
                <span className="text-[11px] sm:text-xs font-bold text-slate-500">Drop-off Analysis</span>
              </div>

              {/* Funnel Progress Bars */}
              <div className="space-y-2.5 sm:space-y-3 pt-1 sm:pt-2">
                {/* Step 1: All Visitors */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>1. Landed on Web / App</span>
                    <span>{summary.visitors} users (100%)</span>
                  </div>
                  <div className="w-full h-2.5 sm:h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-800 rounded-full w-full" />
                  </div>
                </div>

                {/* Step 2: Rate Views */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>2. Viewed Fare Quotes</span>
                    <span>
                      {summary.viewRates} users ({rateViewRate}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 sm:h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(parseFloat(rateViewRate) || 0, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Step 3: Started Booking */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>3. Proceeded to Details Form</span>
                    <span>
                      {summary.startedBooking} users ({startFormRate}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 sm:h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(parseFloat(startFormRate) || 0, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Step 4: Completed Booking */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-emerald-800 mb-1">
                    <span>4. Final Booking Confirmed</span>
                    <span>
                      {summary.completedBooking} rides ({conversionRate}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 sm:h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(parseFloat(conversionRate) || 0, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Distribution Card (Web vs App) */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-3.5 sm:p-5 shadow-xs space-y-3 sm:space-y-4">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                Platform Distribution
              </h3>

              <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-1">
                {/* Website */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase">Website Visitors</div>
                      <div className="text-lg sm:text-xl font-black text-slate-900">{platforms.web} sessions</div>
                    </div>
                  </div>
                  <div className="mt-2 sm:mt-3 text-[11px] sm:text-xs text-slate-600 font-semibold">{webPercent}% of traffic</div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-slate-700" style={{ width: `${webPercent}%` }} />
                  </div>
                </div>

                {/* Mobile App */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase">Customer App</div>
                      <div className="text-lg sm:text-xl font-black text-slate-900">{platforms.app} sessions</div>
                    </div>
                  </div>
                  <div className="mt-2 sm:mt-3 text-[11px] sm:text-xs text-slate-600 font-semibold">{appPercent}% of traffic</div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${appPercent}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Real-Time Visitor Research Stream Table */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                Live Visitor Research Log & Drop-off Tracker
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed research stream showing active sessions, customer type, searched routes, vehicle interest, and drop-off stage.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600 font-bold flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400"
                />
                <span>Auto-refresh (15s)</span>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
              <div>Loading visitor sessions...</div>
            </div>
          ) : !data?.recentSessions || data.recentSessions.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-sm">
              No visitor activity recorded for the selected window yet. Open the website or customer app to see real-time sessions.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px] sm:text-xs">
                  <tr>
                    <th className="py-2.5 px-3 sm:py-3.5 sm:px-4">Time & Session ID</th>
                    <th className="py-2.5 px-3 sm:py-3.5 sm:px-4">Customer Type</th>
                    <th className="py-2.5 px-3 sm:py-3.5 sm:px-4">Platform & Device</th>
                    <th className="py-2.5 px-3 sm:py-3.5 sm:px-4">Estimated Location</th>
                    <th className="py-2.5 px-3 sm:py-3.5 sm:px-4">Route Searched</th>
                    <th className="py-2.5 px-3 sm:py-3.5 sm:px-4">Vehicle Viewed</th>
                    <th className="py-2.5 px-3 sm:py-3.5 sm:px-4">Drop-Off Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentSessions.map((s: any) => (
                    <tr key={s.sessionId} className="hover:bg-slate-50/80 transition">
                      {/* Time & Session */}
                      <td className="py-2 px-3 sm:py-3 sm:px-4">
                        <div className="font-bold text-slate-900">
                          {new Date(s.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{s.sessionId.substring(0, 14)}...</div>
                      </td>

                      {/* Customer Type Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            s.customerType === 'NEW'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-indigo-100 text-indigo-800 border-indigo-300'
                          }`}
                        >
                          <span>{s.customerType === 'NEW' ? 'New' : 'Returning'}</span>
                        </span>
                      </td>

                      {/* Platform & Device */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.platform === 'CUSTOMER_APP'
                              ? 'bg-purple-100 text-purple-800 border border-purple-300'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}
                        >
                          <span>{s.platform === 'CUSTOMER_APP' ? 'App' : 'Web'}</span>
                          <span>• {s.device}</span>
                        </span>
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 text-slate-700 font-medium">{s.city}</td>

                      {/* Route */}
                      <td className="py-3 px-4">
                        {s.searchedRoute ? (
                          <span className="font-bold text-slate-900">{s.searchedRoute}</span>
                        ) : (
                          <span className="text-slate-400 italic">Home / Exploring</span>
                        )}
                      </td>

                      {/* Vehicle Viewed */}
                      <td className="py-3 px-4">
                        {s.searchedCategory ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">
                            {s.searchedCategory}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Drop-Off Stage */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            s.lastStage === 'Completed Booking'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : s.lastStage === 'Started Booking'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : s.lastStage === 'Viewed Rates'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}
                        >
                          {s.lastStage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
