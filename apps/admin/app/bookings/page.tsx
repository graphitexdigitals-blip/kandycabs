'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookingStatus, getSupabaseClient } from '@kandy-cabs/shared';
import { BroadcastDispatchModal } from '@/components/BroadcastDispatchModal';
import { OtpOverrideModal } from '@/components/OtpOverrideModal';
import { BookingDetailDrawer } from '@/components/BookingDetailDrawer';
import { AdminNavbar } from '@/components/AdminNavbar';
import { parseIntermediateStops, getBookingMetadata } from '@/lib/bookingHelpers';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

export const dynamic = 'force-dynamic';

const STATUS_FILTERS = [
  'ALL',
  BookingStatus.PENDING_ADMIN,
  BookingStatus.DISPATCHED,
  BookingStatus.DRIVER_ACCEPTED,
  BookingStatus.DRIVER_EN_ROUTE,
  BookingStatus.TRIP_STARTED,
  BookingStatus.TRIP_COMPLETED,
  BookingStatus.CANCELLED,
];

export default function AdminBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalCount: 0, totalPages: 1, limit: 25, page: 1 });
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [realtimeActive, setRealtimeActive] = useState(false);

  // Modals & Drawer State
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchBooking, setDispatchBooking] = useState<{ id: string; ref: string } | null>(null);

  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpBooking, setOtpBooking] = useState<{ id: string; ref: string } | null>(null);

  // Quick View All Images Gallery Modal State
  const [galleryBooking, setGalleryBooking] = useState<any | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const inFlightRef = useRef(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchBookings = useCallback(
    async (isBackground: boolean = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      if (!isBackground) {
        setLoading(true);
      }

      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: '25',
          status: statusFilter,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        });

        const res = await fetch(`/api/admin/bookings?${queryParams}`, {
          cache: 'no-store',
        });

        if (res.status === 401) {
          router.push('/login');
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setBookings(data.bookings || []);
          if (data.pagination) {
            setPagination(data.pagination);
          }
          setIsReconnecting(false);
        } else {
          if (!isBackground) setIsReconnecting(true);
        }
      } catch (err: any) {
        console.error('Fetch bookings error:', err);
        if (!isBackground) setIsReconnecting(true);
      } finally {
        inFlightRef.current = false;
        if (!isBackground) setLoading(false);
      }
    },
    [page, statusFilter, debouncedSearch, router]
  );

  // Initial fetch and on filter/page change
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Primary: Supabase Realtime subscription
  // Fallback: HTTP polling only when Realtime is disconnected or during low-frequency background sync
  useEffect(() => {
    const supabase = getSupabaseClient();
    let channel: any = null;
    let fallbackPollInterval: NodeJS.Timeout | null = null;
    let isSubscribed = false;

    const startFallbackPolling = (intervalMs = 10000) => {
      if (fallbackPollInterval) clearInterval(fallbackPollInterval);
      fallbackPollInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchBookings(true);
        }
      }, intervalMs);
    };

    if (supabase) {
      try {
        channel = supabase
          .channel(`admin-bookings-realtime-${Date.now()}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'Booking' },
            () => {
              setRealtimeActive(true);
              setIsReconnecting(false);
              fetchBookings(true);
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              isSubscribed = true;
              setRealtimeActive(true);
              setIsReconnecting(false);
              // Relax polling to low-frequency background sync (60s) when Realtime is healthy
              startFallbackPolling(60000);
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              isSubscribed = false;
              setRealtimeActive(false);
              // Activate aggressive 10s fallback polling when Realtime is disconnected
              startFallbackPolling(10000);
            }
          });
      } catch (e) {
        setRealtimeActive(false);
        startFallbackPolling(10000);
      }
    } else {
      setRealtimeActive(false);
      startFallbackPolling(10000);
    }

    // Default initial fallback until SUBSCRIBED confirmation arrives
    if (!isSubscribed) {
      startFallbackPolling(10000);
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
  }, [fetchBookings]);

  // Instant client-side filtering for 0ms UI response while server query syncs
  const displayedBookings = React.useMemo(() => {
    if (!bookings || bookings.length === 0) return [];
    return bookings.filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const refMatch = b.humanReadableRef?.toLowerCase().includes(q);
        const custMatch =
          b.customer?.user?.fullName?.toLowerCase().includes(q) ||
          b.customer?.user?.phone?.includes(q);
        const addrMatch =
          b.pickupAddress?.toLowerCase().includes(q) ||
          b.dropAddress?.toLowerCase().includes(q) ||
          b.actualPickupAddress?.toLowerCase().includes(q) ||
          b.actualDropAddress?.toLowerCase().includes(q);
        const stops = parseIntermediateStops(b);
        const stopsMatch = stops.some((s: string) => s.toLowerCase().includes(q));
        return refMatch || custMatch || addrMatch || stopsMatch;
      }
      return true;
    });
  }, [bookings, statusFilter, search]);

  const handleOpenDrawer = (id: string) => {
    setSelectedBookingId(id);
    setDrawerOpen(true);
  };

  const handleOpenDispatch = (id: string, ref: string) => {
    setDispatchBooking({ id, ref });
    setDispatchModalOpen(true);
  };

  const handleOpenOtpOverride = (id: string, ref: string) => {
    setOtpBooking({ id, ref });
    setOtpModalOpen(true);
  };

  const handleApproveFleet = async (id: string, ref: string) => {
    if (!window.confirm(`Are you sure you want to approve fleet availability for booking ${ref}? The customer will be notified to pay their advance.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/bookings/${id}/approve-fleet`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Fleet availability approved successfully!');
        fetchBookings();
      } else {
        alert(data.message || 'Failed to approve fleet availability');
      }
    } catch (e: any) {
      alert(e.message || 'Network error');
    }
  };

  const getStatusBadgeClass = (status: BookingStatus) => {
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
        return 'bg-slate-100 text-slate-800 border-slate-300';
      case BookingStatus.CANCELLED:
        return 'bg-rose-100 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStatusLabel = (status: BookingStatus | string) => {
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminNavbar />
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6 flex-1">
        {/* Top Navbar / Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Kandy Cabs Operations</h1>
              {isReconnecting ? (
                <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Reconnecting... (20s polling active)</span>
                </span>
              ) : realtimeActive ? (
                <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Realtime Connected</span>
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live Fleet Bookings & Operations Command Center
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/live-map"
              prefetch={true}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center space-x-1.5"
            >
              <span>🗺️ Open Live Fleet Map (Flow A)</span>
            </Link>
          </div>
        </div>

        {/* Pending Driver Override Alert Banner */}
        {displayedBookings.some(
          (b) =>
            b.tripEvents?.some((e: any) => e.type === 'OVERRIDE_REQUESTED') &&
            (b.status === BookingStatus.DRIVER_ACCEPTED || b.status === BookingStatus.DRIVER_EN_ROUTE)
        ) && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-amber-400">
            <div className="flex items-center space-x-3">
              <span className="text-2xl animate-bounce">⚠️</span>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight text-white">
                  Driver Requested Admin Authorization to Start Trip!
                </h3>
                <p className="text-xs text-amber-100 mt-0.5">
                  Customer phone is unreachable or out of battery. Admin authorization is requested to bypass OTP and start the ride.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {displayedBookings
                .filter(
                  (b) =>
                    b.tripEvents?.some((e: any) => e.type === 'OVERRIDE_REQUESTED') &&
                    (b.status === BookingStatus.DRIVER_ACCEPTED || b.status === BookingStatus.DRIVER_EN_ROUTE)
                )
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleOpenOtpOverride(b.id, b.humanReadableRef)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center space-x-1.5"
                  >
                    <span>🔑 Authorize {b.humanReadableRef}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Status Pills */}
          <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 ${
                  statusFilter === s
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="w-full md:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search reference, customer, phone, location..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Bookings Table */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden relative">
          {loading && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-100 overflow-hidden z-10">
              <div className="h-full bg-indigo-600 animate-pulse w-full" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className={`min-w-full divide-y divide-slate-200 text-left text-xs transition-opacity duration-200 ${loading && bookings.length > 0 ? 'opacity-80' : 'opacity-100'}`}>
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Ref & Date</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Route</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Assigned Driver</th>
                  <th className="px-5 py-3.5">Fare</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        <span>Loading bookings...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayedBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                      No matching bookings found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  displayedBookings.map((b) => {
                    const meta = getBookingMetadata(b);
                    const petTypeStr = meta.petType ? String(meta.petType) : '';
                    const petLabel = petTypeStr ? (petTypeStr.charAt(0).toUpperCase() + petTypeStr.slice(1).toLowerCase()) : '';
                    const hasOverrideRequest =
                      b.tripEvents?.some((e: any) => e.type === 'OVERRIDE_REQUESTED') &&
                      (b.status === BookingStatus.DRIVER_ACCEPTED || b.status === BookingStatus.DRIVER_EN_ROUTE);

                    return (
                    <tr key={b.id} className={`hover:bg-slate-50/70 transition ${hasOverrideRequest ? 'bg-amber-50/60' : ''}`}>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 block">
                          {b.humanReadableRef}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(b.createdAt).toLocaleDateString()} {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-800 block">
                          {b.customer?.user?.fullName || 'Customer'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {b.customerPhoneReleased ? b.customer?.user?.phone : '🔒 Phone Hidden'}
                        </span>
                        {meta.alternateEmail && (
                          <span className="text-[10px] text-sky-700 block truncate font-medium">
                            ✉️ {meta.alternateEmail}
                          </span>
                        )}
                        {meta.gstin && (
                          <span className="text-[10px] text-indigo-700 block font-mono font-semibold">
                            🏢 GST: {meta.gstin}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 max-w-sm">
                        {/* Pickup Location Display */}
                        {b.status === BookingStatus.TRIP_STARTED || b.status === BookingStatus.TRIP_COMPLETED ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                📍 OTP Start Location
                              </span>
                            </div>
                            <div className="truncate text-slate-900 font-bold text-[12px] flex items-center gap-1.5" title={b.actualPickupAddress || b.pickupAddress}>
                              <span className="text-emerald-600 shrink-0 font-bold">📍</span>
                              <span className="truncate">{b.actualPickupAddress || b.pickupAddress}</span>
                            </div>
                            {b.actualPickupAddress && b.actualPickupAddress !== b.pickupAddress && (
                              <div className="text-[10px] text-slate-500 truncate pl-4" title={`Booked: ${b.pickupAddress}`}>
                                Booked: {b.pickupAddress}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="truncate text-slate-800 font-semibold flex items-center gap-1.5" title={b.pickupAddress}>
                            <span className="text-emerald-600 shrink-0 font-bold">📍</span>
                            <span className="truncate">{b.pickupAddress}</span>
                          </div>
                        )}

                        {/* Intermediate Drops / Via Stops */}
                        {(() => {
                          const viaStops = parseIntermediateStops(b);
                          if (viaStops.length === 0) return null;
                          return (
                            <div className="my-1.5 pl-3 border-l-2 border-amber-300 ml-1.5 space-y-1">
                              {viaStops.map((stop, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-[11px] text-amber-950 font-medium" title={`Via Drop ${idx + 1}: ${stop}`}>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 font-extrabold text-amber-900 shrink-0">
                                    Stop {idx + 1}
                                  </span>
                                  <span className="truncate font-semibold text-amber-900">{stop}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Drop Location Display */}
                        {b.status === BookingStatus.TRIP_COMPLETED ? (
                          <div className="space-y-0.5 mt-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300">
                                🏁 Final Reached Drop
                              </span>
                            </div>
                            <div className="truncate text-slate-900 font-bold text-[12px] flex items-center gap-1.5" title={b.actualDropAddress || b.dropAddress}>
                              <span className="text-rose-600 shrink-0 font-bold">🏁</span>
                              <span className="truncate">{b.actualDropAddress || b.dropAddress}</span>
                            </div>
                            {b.actualDropAddress && b.actualDropAddress !== b.dropAddress && (
                              <div className="text-[10px] text-slate-500 truncate pl-4" title={`Booked: ${b.dropAddress}`}>
                                Booked: {b.dropAddress}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="truncate text-slate-600 text-[11px] flex items-center gap-1.5 mt-0.5" title={b.dropAddress}>
                            <span className="text-rose-600 shrink-0 font-bold">🏁</span>
                            <span className="truncate">{b.dropAddress}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-indigo-700 font-bold px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200">
                            {b.tripType} • {b.distanceKm} km
                          </span>
                          {parseIntermediateStops(b).length > 0 && (
                            <span className="text-[10px] text-amber-800 font-black px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 flex items-center gap-1">
                              <span>⚡</span>
                              <span>{parseIntermediateStops(b).length} Via Drops</span>
                            </span>
                          )}
                          {meta.hasCarrier && (
                            <span className="text-[10px] text-emerald-900 font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-300 flex items-center gap-1">
                              <span>📦</span>
                              <span>Roof Carrier</span>
                            </span>
                          )}
                          {meta.hasPet && (
                            <span className="text-[10px] text-amber-900 font-extrabold px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 flex items-center gap-1">
                              <span>🐾</span>
                              <span>Pet Friendly{petLabel ? ` (${petLabel})` : ''} (+₹{meta.petFee || 500})</span>
                            </span>
                          )}
                          {meta.flightNumber && (
                            <span className="text-[10px] text-sky-900 font-extrabold px-1.5 py-0.5 rounded bg-sky-50 border border-sky-300 flex items-center gap-1">
                              <span>✈️</span>
                              <span>{meta.flightNumber}</span>
                            </span>
                          )}
                          {getBookingMetadata(b).gstin && (
                            <span className="text-[10px] text-indigo-900 font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-300 flex items-center gap-1">
                              <span>🏢</span>
                              <span>GST: {getBookingMetadata(b).gstin}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${getStatusBadgeClass(
                            b.status
                          )}`}
                        >
                          {getStatusLabel(b.status)}
                        </span>
                        {b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVAL_REQUESTED' || e.payloadJson?.requiresFleetApproval) && !b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED') && (
                          <span className="block mt-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse text-center">
                            ⏳ FLEET CHECK REQ
                          </span>
                        )}
                        {b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED') && b.advancePaymentStatus === 'PENDING' && (
                          <span className="block mt-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 text-center">
                            ✓ FLEET APPROVED
                          </span>
                        )}
                        {hasOverrideRequest && (
                          <span className="block mt-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse text-center">
                            ⚠️ OVERRIDE REQ
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {b.assignedDriver ? (
                          <div className="space-y-1">
                            <span className="font-bold text-slate-800 block">
                              {b.assignedDriver.user?.fullName}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono block">
                              {b.assignedDriver.user?.phone}
                            </span>
                            {b.driverPaymentStatus === 'PAID' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span>✓</span> Driver Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                <span>✗</span> Driver Not Paid
                              </span>
                            )}
                          </div>
                        ) : b.status === BookingStatus.DISPATCHED ? (
                          <span className="text-blue-600 font-semibold text-[11px]">
                            📡 Dispatched ({b.dispatches?.length || 0} drivers)
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block">
                          ₹{Number(b.estimatedFare).toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-semibold block ${b.advancePaymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          Adv: ₹{Number(b.advanceAmount).toFixed(2)} ({b.advancePaymentStatus})
                        </span>
                        {meta.hasPet && (
                          <span className="text-[10px] text-amber-700 font-bold flex items-center gap-0.5 mt-0.5">
                            <span>🐾</span>
                            <span>Incl. ₹{meta.petFee || 500} Pet Fee{petLabel ? ` (${petLabel})` : ''}</span>
                          </span>
                        )}
                        {(() => {
                          const completeEvt = b.tripEvents?.find((e: any) => e.type === 'TRIP_COMPLETED');
                          const method = completeEvt?.payloadJson?.paymentMethod;
                          if (!method && b.status !== BookingStatus.TRIP_COMPLETED) return null;
                          const isUpi = method === 'UPI_QR';
                          return (
                            <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9.5px] font-black border uppercase tracking-tight ${
                              isUpi
                                ? 'bg-sky-50 text-sky-800 border-sky-300'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            }`}>
                              <span>{isUpi ? '📱' : '💵'}</span>
                              <span>{isUpi ? 'Admin UPI QR' : 'Cash Collected'}</span>
                            </span>
                          );
                        })()}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-right space-x-1.5">
                        {b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVAL_REQUESTED' || e.payloadJson?.requiresFleetApproval) && !b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED') && (
                          <button
                            type="button"
                            onClick={() => handleApproveFleet(b.id, b.humanReadableRef)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-xs"
                            title="Verify fleet availability and approve for customer payment"
                          >
                            ✓ Approve Fleet
                          </button>
                        )}
                        {hasOverrideRequest && (
                          <button
                            type="button"
                            onClick={() => handleOpenOtpOverride(b.id, b.humanReadableRef)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[11px] shadow-xs animate-pulse"
                            title="Driver requested Admin OTP Override to start trip"
                          >
                            🔑 Authorize Start
                          </button>
                        )}

                        {b.status === BookingStatus.PENDING_ADMIN && (
                          <button
                            type="button"
                            onClick={() => handleOpenDispatch(b.id, b.humanReadableRef)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] shadow-xs"
                          >
                            Dispatch
                          </button>
                        )}

                        {b.status === BookingStatus.DISPATCHED && (
                          <button
                            type="button"
                            onClick={() => handleOpenDispatch(b.id, b.humanReadableRef)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shadow-xs"
                            title="Re-broadcast ride to online drivers"
                          >
                            Re-dispatch
                          </button>
                        )}
                        {/* Quick 1-Click Approve OTP Override Button if requested by driver */}
                        {b.tripEvents?.some((e: any) => e.type === 'OVERRIDE_REQUESTED') &&
                          (b.status === BookingStatus.DRIVER_ACCEPTED || b.status === BookingStatus.DRIVER_EN_ROUTE) && (
                            <button
                              type="button"
                              onClick={() => handleOpenOtpOverride(b.id, b.humanReadableRef)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[11px] shadow-xs inline-flex items-center gap-1 animate-pulse"
                              title="Driver requested manual OTP override - click to approve"
                            >
                              <span>⚠️</span>
                              <span>Override Req</span>
                            </button>
                        )}

                        {/* Quick View Photos Button */}
                        <button
                          type="button"
                          onClick={() => setGalleryBooking(b)}
                          className={`px-2.5 py-1 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 transition ${
                            Array.isArray(b.vehicleInspectionPhotos) && b.vehicleInspectionPhotos.filter(Boolean).length > 0
                              ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 shadow-2xs'
                              : b.startingOdometerImagePath || b.finalOdometerImagePath
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                          }`}
                          title="View all vehicle inspection photos & odometer evidence"
                        >
                          <span>📸</span>
                          <span>
                            {Array.isArray(b.vehicleInspectionPhotos) && b.vehicleInspectionPhotos.filter(Boolean).length > 0
                              ? `Photos (${b.vehicleInspectionPhotos.filter(Boolean).length + (b.startingOdometerImagePath ? 1 : 0) + (b.finalOdometerImagePath ? 1 : 0)})`
                              : b.startingOdometerImagePath || b.finalOdometerImagePath
                              ? 'Odometer'
                              : 'Photos'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDrawer(b.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px]"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total bookings)
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick View All Images Gallery Modal */}
      {galleryBooking && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setGalleryBooking(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg">📸</span>
                  <h3 className="font-extrabold text-base tracking-tight">
                    Ride Evidence & Inspection Photos
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 border border-indigo-400 text-indigo-200 font-mono font-bold text-xs">
                    {galleryBooking.humanReadableRef}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Customer: {galleryBooking.customer?.user?.fullName || 'Customer'} • Driver: {galleryBooking.assignedDriver?.user?.fullName || 'Unassigned'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGalleryBooking(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl text-sm font-bold bg-slate-800 hover:bg-slate-700 transition"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* 1. Pre-Trip Vehicle Inspection (4 Angles) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🚗</span>
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                      Pre-Trip Vehicle Condition Photos (4 Angles)
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    {Array.isArray(galleryBooking.vehicleInspectionPhotos)
                      ? `${galleryBooking.vehicleInspectionPhotos.filter(Boolean).length} of 4 Uploaded`
                      : '0 of 4 Uploaded'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Front Angle', sub: 'Front Bumper & Plate', idx: 0 },
                    { label: 'Rear Angle', sub: 'Rear Boot & Tail Lights', idx: 1 },
                    { label: 'Side Profile', sub: 'Side Panels & Doors', idx: 2 },
                    { label: 'Inside / Back Seat', sub: 'Clean Passenger Seats', idx: 3 },
                  ].map((angle) => {
                    const photoUrl = Array.isArray(galleryBooking.vehicleInspectionPhotos)
                      ? galleryBooking.vehicleInspectionPhotos[angle.idx]
                      : null;
                    return (
                      <div
                        key={angle.label}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center text-center shadow-2xs"
                      >
                        <span className="text-xs font-bold text-slate-800">{angle.label}</span>
                        <span className="text-[10px] text-slate-500 mb-2">{angle.sub}</span>
                        {photoUrl ? (
                          <div
                            onClick={() =>
                              setPreviewImage({
                                url: resolveImageUrl(photoUrl),
                                title: `${galleryBooking.humanReadableRef} — ${angle.label}`,
                              })
                            }
                            className="w-full h-32 bg-slate-200 rounded-lg border border-emerald-300 overflow-hidden cursor-pointer relative group shadow-inner"
                          >
                            <img
                              src={resolveImageUrl(photoUrl)}
                              alt={angle.label}
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-bold">
                              🔍 Click to Zoom
                            </div>
                            <div className="absolute bottom-1 right-1 bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                              ✓ Verified
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-32 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-xs text-slate-400 p-2">
                            <span className="text-lg mb-1">📷</span>
                            <span>Not Captured</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Odometer Readings & Verification */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center space-x-2">
                  <span className="text-base">⏱️</span>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Odometer Verification Evidence
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Starting Odometer */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-700">Starting Odometer</span>
                      <span className="text-sm font-mono font-black text-emerald-700">
                        {galleryBooking.startingOdometer ? `${galleryBooking.startingOdometer} KM` : 'N/A'}
                      </span>
                    </div>
                    {galleryBooking.startingOdometerImagePath ? (
                      <div
                        onClick={() =>
                          setPreviewImage({
                            url: resolveImageUrl(galleryBooking.startingOdometerImagePath),
                            title: `${galleryBooking.humanReadableRef} — Starting Odometer (${galleryBooking.startingOdometer || 'N/A'} KM)`,
                          })
                        }
                        className="w-full h-40 bg-slate-200 rounded-lg border border-slate-300 overflow-hidden cursor-pointer relative group"
                      >
                        <img
                          src={resolveImageUrl(galleryBooking.startingOdometerImagePath)}
                          alt="Starting Odometer"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-bold">
                          🔍 Click to Zoom
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-28 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        No Starting Photo Uploaded
                      </div>
                    )}
                  </div>

                  {/* Final Odometer */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-700">Final Odometer</span>
                      <span className="text-sm font-mono font-black text-indigo-700">
                        {galleryBooking.finalOdometer ? `${galleryBooking.finalOdometer} KM` : 'N/A'}
                      </span>
                    </div>
                    {galleryBooking.finalOdometerImagePath ? (
                      <div
                        onClick={() =>
                          setPreviewImage({
                            url: resolveImageUrl(galleryBooking.finalOdometerImagePath),
                            title: `${galleryBooking.humanReadableRef} — Final Odometer (${galleryBooking.finalOdometer || 'N/A'} KM)`,
                          })
                        }
                        className="w-full h-40 bg-slate-200 rounded-lg border border-slate-300 overflow-hidden cursor-pointer relative group"
                      >
                        <img
                          src={resolveImageUrl(galleryBooking.finalOdometerImagePath)}
                          alt="Final Odometer"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-bold">
                          🔍 Click to Zoom
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-28 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        No Final Photo Uploaded
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                All photos are timestamped and geotagged for audit security.
              </span>
              <button
                type="button"
                onClick={() => {
                  const id = galleryBooking.id;
                  setGalleryBooking(null);
                  handleOpenDrawer(id);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                Open Full Ride Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex justify-between items-center text-white">
              <span className="font-bold text-sm">📸 {previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700"
              >
                ✕ Close
              </button>
            </div>
            <div className="p-4 bg-black flex items-center justify-center max-h-[80vh]">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals & Slide-out Drawers */}
      <BookingDetailDrawer
        bookingId={selectedBookingId}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenDispatch={(id, ref) => handleOpenDispatch(id, ref)}
        onOpenOtpOverride={(id, ref) => handleOpenOtpOverride(id, ref)}
        onRefresh={fetchBookings}
      />

      {dispatchBooking && (
        <BroadcastDispatchModal
          bookingId={dispatchBooking.id}
          bookingRef={dispatchBooking.ref}
          isOpen={dispatchModalOpen}
          onClose={() => {
            setDispatchModalOpen(false);
            setDispatchBooking(null);
          }}
          onSuccess={fetchBookings}
        />
      )}

      {otpBooking && (
        <OtpOverrideModal
          bookingId={otpBooking.id}
          bookingRef={otpBooking.ref}
          isOpen={otpModalOpen}
          onClose={() => {
            setOtpModalOpen(false);
            setOtpBooking(null);
          }}
          onSuccess={fetchBookings}
        />
      )}
    </div>
  );
}
