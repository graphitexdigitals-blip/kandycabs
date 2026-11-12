'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookingStatus, getSupabaseClient } from '@kandy-cabs/shared';
import { BroadcastDispatchModal } from '@/components/BroadcastDispatchModal';
import { OtpOverrideModal } from '@/components/OtpOverrideModal';
import { BookingDetailDrawer } from '@/components/BookingDetailDrawer';
import { AdminNavbar } from '@/components/AdminNavbar';
import { parseIntermediateStops, getBookingMetadata, getTripVerificationPhotos, getTripTimingMilestones } from '@/lib/bookingHelpers';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import {
  IconMap,
  IconSearch,
  IconPinPickup,
  IconPinDropoff,
  IconCheck,
  IconCross,
  IconCash,
  IconPayments,
  IconPaw,
  IconPackage,
  IconPlane,
  IconBuilding,
  IconMail,
  IconRadio,
  IconImage,
  IconAlert,
  IconKey,
  IconUsers,
  IconBookings,
  IconCar,
  IconCheckCircle,
  IconSteeringWheel,
  IconUser,
  IconUserSolid,
  IconCalendar,
  IconX,
  IconClock,
  IconMapPin,
} from '@/components/Icons';

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

  const getStatusFilterLabel = (s: string) => {
    switch (s) {
      case 'ALL':
        return 'ALL';
      case BookingStatus.PENDING_ADMIN:
        return 'PENDING';
      case BookingStatus.DISPATCHED:
        return 'DISPATCHED';
      case BookingStatus.DRIVER_ACCEPTED:
        return 'ACCEPTED';
      case BookingStatus.DRIVER_EN_ROUTE:
        return 'EN ROUTE';
      case BookingStatus.TRIP_STARTED:
        return 'ON TRIP';
      case BookingStatus.TRIP_COMPLETED:
        return 'COMPLETED';
      case BookingStatus.CANCELLED:
        return 'CANCELLED';
      default:
        return s.replace(/_/g, ' ');
    }
  };

  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchBooking, setDispatchBooking] = useState<{ id: string; ref: string } | null>(null);

  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpBooking, setOtpBooking] = useState<{ id: string; ref: string } | null>(null);

  // Quick View All Images Gallery Modal State
  const [galleryBooking, setGalleryBooking] = useState<any | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Accordion state for mobile/tablet bookings
  const [expandedMobileCards, setExpandedMobileCards] = useState<Record<string, boolean>>({});
  const toggleMobileExpand = (id: string) => {
    setExpandedMobileCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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

  const formatBookingDateTime = (dateStr: string | Date | undefined) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getStatusDisplay = (status: BookingStatus | string) => {
    switch (status) {
      case BookingStatus.TRIP_COMPLETED:
        return {
          label: 'Trip Completed',
          badgeClass: 'bg-[#f0f4f9] text-slate-800 border-slate-200/80',
          icon: (
            <div className="w-4 h-4 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ),
        };
      case BookingStatus.TRIP_STARTED:
      case BookingStatus.DRIVER_EN_ROUTE:
      case 'ON_TRIP':
      case 'ON TRIP':
        return {
          label: 'Trip Started',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: <IconCar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />,
        };
      case BookingStatus.DRIVER_ACCEPTED:
        return {
          label: 'Driver Accepted',
          badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          icon: <IconCheckCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />,
        };
      case BookingStatus.DISPATCHED:
        return {
          label: 'Dispatched',
          badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: <IconRadio className="w-3.5 h-3.5 text-blue-600 shrink-0" />,
        };
      case BookingStatus.PENDING_ADMIN:
        return {
          label: 'Pending Admin',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: <IconAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
        };
      case BookingStatus.CANCELLED:
        return {
          label: 'Cancelled',
          badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: <IconCross className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
        };
      default:
        return {
          label: String(status).replace(/_/g, ' '),
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: <IconAlert className="w-3.5 h-3.5 text-slate-600 shrink-0" />,
        };
    }
  };

  const getStatusBadgeClass = (status: BookingStatus) => {
    return getStatusDisplay(status).badgeClass;
  };

  const getStatusLabel = (status: BookingStatus | string) => {
    return getStatusDisplay(status).label;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminNavbar />
      <div className="max-w-[1536px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4 flex-1">
        {/* Top Navbar / Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 bg-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-xl shadow-xs border border-slate-200">
          <div>
            <div className="flex items-center space-x-2.5 sm:space-x-3 flex-wrap">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-900 tracking-tight">Kandy Cabs Operations</h1>
              {isReconnecting ? (
                <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Reconnecting... (20s polling active)</span>
                </span>
              ) : realtimeActive ? (
                <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>Realtime Connected</span>
                </span>
              ) : null}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">
              Live Fleet Bookings & Operations Command Center
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/live-map"
              prefetch={true}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center space-x-2"
            >
              <IconMap className="w-3.5 h-3.5 text-indigo-100" />
              <span>Open Live Fleet Map</span>
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
              <IconAlert className="w-6 h-6 text-white shrink-0" />
              <div>
                <h3 className="font-extrabold text-sm tracking-tight text-white">
                  Driver Requested Admin Authorization to Start Trip
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
                    <IconKey className="w-3.5 h-3.5 text-amber-400" />
                    <span>Authorize {b.humanReadableRef}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-xs border border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 sm:gap-4">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 flex-1 min-w-0">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition active:scale-95 whitespace-nowrap ${
                  statusFilter === s
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {getStatusFilterLabel(s)}
              </button>
            ))}
          </div>

          {/* Search Bar (never shrinks or overlaps) */}
          <div className="relative w-full sm:w-64 md:w-72 lg:w-80 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <IconSearch className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search"
              className="w-full pl-9.5 pr-3 py-1.5 sm:py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              style={{ paddingLeft: '2.35rem' }}
            />
          </div>
        </div>

        {/* Bookings Card List */}
        <div className="space-y-3 relative">
          {loading && (
            <div className="h-1 bg-amber-100 overflow-hidden rounded-full">
              <div className="h-full bg-amber-500 animate-pulse w-full" />
            </div>
          )}

          {loading && bookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-2xs">
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Loading bookings...</span>
              </div>
            </div>
          ) : displayedBookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-2xs text-sm">
              No matching bookings found for the selected filter.
            </div>
          ) : (
            displayedBookings.map((b) => {
              const meta = getBookingMetadata(b);
              const petTypeStr = meta.petType ? String(meta.petType) : '';
              const petLabel = petTypeStr ? (petTypeStr.charAt(0).toUpperCase() + petTypeStr.slice(1).toLowerCase()) : '';
              const viaStops = parseIntermediateStops(b);
              const hasOverrideRequest =
                b.tripEvents?.some((e: any) => e.type === 'OVERRIDE_REQUESTED') &&
                (b.status === BookingStatus.DRIVER_ACCEPTED || b.status === BookingStatus.DRIVER_EN_ROUTE);
              const statusDisplay = getStatusDisplay(b.status);

              const completeEvt = b.tripEvents?.find((e: any) => e.type === 'TRIP_COMPLETED');
              const paymentMethod = completeEvt?.payloadJson?.paymentMethod;
              const isUpi = paymentMethod === 'UPI_QR';

              const driverFullName = b.assignedDriver?.user?.fullName || '';
              const cleanDriverName = driverFullName.replace(/\s*\([^)]*\)/g, '').trim();
              const isExpanded = !!expandedMobileCards[b.id];

              const renderActionBtn = () => {
                if (b.status === BookingStatus.TRIP_COMPLETED) {
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDrawer(b.id);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer shadow-2xs ${
                        isUpi
                          ? 'border border-sky-600 text-sky-800 bg-sky-50/50 hover:bg-sky-100/60'
                          : 'border border-slate-800 text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {isUpi ? <IconPayments className="w-3.5 h-3.5 text-sky-600" /> : <IconCash className="w-3.5 h-3.5 text-slate-700" />}
                      <span>{isUpi ? 'Admin UPI QR' : 'Cash Collected'}</span>
                    </button>
                  );
                }
                if (b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVAL_REQUESTED' || e.payloadJson?.requiresFleetApproval) && !b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED')) {
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApproveFleet(b.id, b.humanReadableRef);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-2xs"
                      title="Approve fleet availability for customer payment"
                    >
                      <span>Approve Fleet</span>
                    </button>
                  );
                }
                if (hasOverrideRequest) {
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenOtpOverride(b.id, b.humanReadableRef);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition shadow-2xs animate-pulse"
                      title="Authorize trip start"
                    >
                      <IconKey className="w-3 h-3 text-white" />
                      <span>Authorize Start</span>
                    </button>
                  );
                }
                if (b.status === BookingStatus.PENDING_ADMIN) {
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDispatch(b.id, b.humanReadableRef);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition shadow-2xs"
                    >
                      <span>Dispatch</span>
                    </button>
                  );
                }
                if (b.status === BookingStatus.DISPATCHED) {
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDispatch(b.id, b.humanReadableRef);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition shadow-2xs"
                    >
                      <span>Re-dispatch</span>
                    </button>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDrawer(b.id);
                    }}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 transition"
                  >
                    <span>View Details</span>
                  </button>
                );
              };

              const renderDriverContent = () => {
                if (b.assignedDriver) {
                  return (
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900 text-sm block truncate" title={cleanDriverName || driverFullName}>
                        {cleanDriverName || driverFullName}
                      </span>
                      <span className="text-xs text-slate-700 font-medium block">
                        (Test Driver)
                      </span>
                      <span className="text-xs text-slate-500 font-mono block">
                        {b.assignedDriver.user?.phone}
                      </span>
                      <div>
                        {b.driverPaymentStatus === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#edfbf3] text-[#1e8a4a] border border-[#c4f0d5] mt-1">
                            <svg className="w-3 h-3 text-[#1e8a4a] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Driver Paid</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#fff1f1] text-[#cf2a2a] border border-[#fed6d6] mt-1">
                            <svg className="w-3 h-3 text-[#cf2a2a] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            <span>Driver Not Paid</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
                if (b.status === BookingStatus.DISPATCHED || b.status === BookingStatus.PENDING_ADMIN) {
                  const latestDeclined = b.tripEvents?.find((e: any) => e.type === 'DRIVER_DECLINED');
                  if (latestDeclined) {
                    const driverName = latestDeclined.payloadJson?.driverName || 'Driver';
                    return (
                      <div className="space-y-1">
                        <span className="text-rose-600 font-bold text-xs flex items-center gap-1">
                          <IconCross className="w-3.5 h-3.5 text-rose-500" />
                          <span>Declined by {driverName}</span>
                        </span>
                        <span className="text-[11px] text-amber-700 font-semibold block">Needs Re-dispatch</span>
                      </div>
                    );
                  }
                  if (b.status === BookingStatus.DISPATCHED) {
                    return (
                      <div className="space-y-1">
                        <span className="text-blue-600 font-semibold text-xs flex items-center gap-1">
                          <IconRadio className="w-3.5 h-3.5 text-blue-500" />
                          <span>Dispatched ({b.dispatches?.length || 0})</span>
                        </span>
                        <span className="text-xs text-slate-400 italic block">Awaiting driver response</span>
                      </div>
                    );
                  }
                }
                return (
                  <div className="space-y-1">
                    <span className="text-slate-400 italic text-xs block">Unassigned</span>
                  </div>
                );
              };

              const renderFareContent = (isMobileLayout: boolean = false) => {
                const customerFare = Number(b.estimatedFare || 0);
                const savedVendorCost = Number(b.driverPayeeAmount || 0);
                const distanceKm = Number(b.distanceKm || 0);
                const autoVendorCost = distanceKm > 0 ? Math.round(distanceKm * 13 + Number(b.driverAllowance || 300)) : null;
                const vendorCost = savedVendorCost > 0 ? savedVendorCost : autoVendorCost;
                const netMargin = vendorCost !== null ? customerFare - vendorCost : null;

                return (
                  <div className={`flex flex-col ${isMobileLayout ? 'items-end text-right' : 'xl:items-end xl:text-right'}`}>
                    <span className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight block">
                      ₹{customerFare.toFixed(2)}
                    </span>

                    {/* Vendor Cost & Net Profit Margin Badge (Auto-calculated from Km if not yet set) */}
                    {vendorCost !== null ? (
                      <div className="mt-1 space-y-0.5">
                        <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block">
                          Vendor: ₹{vendorCost.toLocaleString('en-IN')}{savedVendorCost <= 0 ? ' (Est)' : ''}
                        </span>
                        {netMargin !== null && (
                          <span className={`text-[10.5px] font-black block ${netMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            Margin: {netMargin >= 0 ? '+' : ''}₹{netMargin.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10.5px] text-slate-400 italic block mt-0.5">
                        Vendor cost pending
                      </span>
                    )}

                    <span className="text-xs text-slate-500 font-medium block mt-1">
                      Adv: ₹{Number(b.advanceAmount || 0).toFixed(2)}
                    </span>

                    {/* Primary Action Button */}
                    <div className="mt-1.5">
                      {renderActionBtn()}
                    </div>

                    {/* Secondary Controls (Photos & Details) */}
                    <div className="flex items-center gap-3 mt-2 text-xs font-medium">
                      {(Array.isArray(b.vehicleInspectionPhotos) && b.vehicleInspectionPhotos.filter(Boolean).length > 0 || b.driverSelfie || b.startingOdometerImagePath || b.finalOdometerImagePath) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGalleryBooking(b);
                          }}
                          className="text-sky-700 hover:text-sky-900 inline-flex items-center gap-1 text-[11px]"
                          title="View vehicle inspection photos & odometer"
                        >
                          <IconImage className="w-3 h-3 text-sky-600" />
                          <span>Photos</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDrawer(b.id);
                        }}
                        className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-0.5 text-[11px]"
                      >
                        <span>Details</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                );
              };

              return (
                <div
                  key={b.id}
                  className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition duration-150 p-3 sm:p-3.5 flex flex-col xl:flex-row xl:items-stretch xl:justify-between gap-3 xl:gap-3.5 ${
                    hasOverrideRequest ? 'ring-2 ring-amber-400 bg-amber-50/20' : ''
                  }`}
                >
                  {/* Column 1: Ref & Date */}
                  <div className="w-full xl:w-32 shrink-0 flex flex-col justify-center">
                    <span className="font-bold text-slate-900 text-sm tracking-tight block">
                      {b.humanReadableRef}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 font-medium">
                      <IconCalendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatBookingDateTime(b.createdAt)}</span>
                    </div>
                  </div>

                  {/* Column 2: Customer */}
                  <div className="w-full xl:w-36 shrink-0 flex flex-col justify-center">
                    <span className="font-bold text-slate-900 text-sm block truncate" title={b.customer?.user?.fullName || 'Customer'}>
                      {b.customer?.user?.fullName || 'Customer'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono block mt-0.5">
                      {b.customerPhoneReleased ? b.customer?.user?.phone : 'Phone Hidden'}
                    </span>
                    {meta.alternateEmail && (
                      <span className="text-[10px] text-sky-700 block truncate font-medium flex items-center gap-1 mt-0.5" title={meta.alternateEmail}>
                        <IconMail className="w-3 h-3 text-sky-600 shrink-0" />
                        <span className="truncate">{meta.alternateEmail}</span>
                      </span>
                    )}
                    {meta.gstin && (
                      <span className="text-[10px] text-indigo-700 block font-mono font-semibold flex items-center gap-1 mt-0.5" title={`GST: ${meta.gstin}`}>
                        <IconBuilding className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span>GST: {meta.gstin}</span>
                      </span>
                    )}
                  </div>

                  {/* Column 3: Route */}
                  <div className="w-full xl:flex-1 min-w-0 space-y-1.5 xl:pr-1 flex flex-col justify-center">
                    {/* Pickup */}
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <IconMapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate font-medium text-slate-800 flex-1 min-w-0" title={b.actualPickupAddress || b.pickupAddress}>
                        {b.actualPickupAddress || b.pickupAddress}
                      </span>
                    </div>

                    {/* Via stops if any */}
                    {viaStops.length > 0 && (
                      <div className="pl-4 border-l border-dashed border-amber-300 ml-1 space-y-0.5 my-1">
                        {viaStops.map((stop: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-1 text-[11px] text-amber-900 font-medium truncate" title={`Stop ${idx + 1}: ${stop}`}>
                            <span className="text-[9px] px-1 rounded bg-amber-100 font-bold shrink-0">Via {idx + 1}</span>
                            <span className="truncate">{stop}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dropoff */}
                    <div className="flex items-center gap-2 text-xs text-slate-700">
                      <IconMapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="truncate font-medium text-slate-800 flex-1 min-w-0" title={b.actualDropAddress || b.dropAddress}>
                        {b.actualDropAddress || b.dropAddress}
                      </span>
                    </div>

                    {/* Route Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        <IconCar className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span>{b.distanceKm ? `${b.distanceKm} km` : b.tripType}</span>
                      </span>

                      {meta.hasPet && (
                        <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-medium bg-[#fff3e8] text-[#c25e00] border border-[#fde2cb]">
                          <IconPaw className="w-3.5 h-3.5 text-[#c25e00] shrink-0" />
                          <span>Pet Friendly (+₹{meta.petFee || 500})</span>
                        </span>
                      )}
                      {meta.hasCarrier && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <IconPackage className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Roof Carrier</span>
                        </span>
                      )}
                      {meta.flightNumber && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200">
                          <IconPlane className="w-3 h-3 text-sky-600 shrink-0" />
                          <span>{meta.flightNumber}</span>
                        </span>
                      )}
                      {meta.isSeniorCitizen && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-800 border border-orange-200">
                          <span>Senior Citizen</span>
                        </span>
                      )}
                      {meta.isBabyOnBoard && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-50 text-pink-800 border border-pink-200">
                          <span>Baby on Board</span>
                        </span>
                      )}
                      {meta.isPregnancyFriendly && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                          <span>Pregnancy Friendly</span>
                        </span>
                      )}
                      {meta.isAccessibilityAssistance && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                          <span>Accessibility</span>
                        </span>
                      )}
                      {meta.needReturnJourney && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          <span>Return Journey</span>
                        </span>
                      )}
                      {meta.needAirportDrop && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                          <span>Airport Drop</span>
                        </span>
                      )}
                      {meta.needAirportPickup && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                          <span>Airport Pickup</span>
                        </span>
                      )}
                    </div>

                    {/* Trip Milestones Quick Timing Strip */}
                    {(() => {
                      const t = getTripTimingMilestones(b);
                      const hasAnyTiming =
                        t.photosTime || t.arrivedPickupTime || t.startedTime || t.completedTime || t.waitingMinutes > 0;
                      if (!hasAnyTiming) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px]">
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                            Timings:
                          </span>
                          {t.photosTime && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700 font-medium font-mono">
                              <span>Photos:</span>
                              <strong className="text-slate-900">{t.photosTime}</strong>
                            </span>
                          )}
                          {t.arrivedPickupTime && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 font-medium font-mono">
                              <span>Arrived:</span>
                              <strong className="text-blue-950">{t.arrivedPickupTime}</strong>
                            </span>
                          )}
                          {t.waitingMinutes > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-900 font-medium font-mono">
                              <span>Waited:</span>
                              <strong className="text-amber-950">{t.waitingMinutes}m</strong>
                              {t.waitingTimeWindow && (
                                <span className="text-[10px] text-amber-700">({t.waitingTimeWindow})</span>
                              )}
                            </span>
                          )}
                          {t.startedTime && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-800 font-medium font-mono">
                              <span>Started:</span>
                              <strong className="text-indigo-950">{t.startedTime}</strong>
                            </span>
                          )}
                          {t.completedTime && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium font-mono">
                              <span>Drop:</span>
                              <strong className="text-emerald-950">{t.completedTime}</strong>
                            </span>
                          )}
                          {t.totalTripDuration && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              <span>Total: {t.totalTripDuration}</span>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Mobile/Tablet Status & View Details Row */}
                  <div className="flex items-center justify-between gap-2 pt-1 xl:hidden">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusDisplay.badgeClass}`}>
                        {statusDisplay.icon}
                        <span>{statusDisplay.label}</span>
                      </span>
                      {b.tripEvents?.some((e: any) => e.type === 'DRIVER_DECLINED') && (b.status === BookingStatus.DISPATCHED || b.status === BookingStatus.PENDING_ADMIN) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 text-center animate-pulse">
                          Driver Declined
                        </span>
                      )}
                      {b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVAL_REQUESTED' || e.payloadJson?.requiresFleetApproval) && !b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED') && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse text-center">
                          Fleet Check Required
                        </span>
                      )}
                      {b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED') && b.advancePaymentStatus === 'PENDING' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 text-center">
                          Fleet Approved
                        </span>
                      )}
                      {hasOverrideRequest && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse text-center">
                          Override Requested
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMobileExpand(b.id);
                      }}
                      className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full inline-flex items-center gap-1 transition shrink-0"
                    >
                      <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                      <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Column 4: Status (Desktop only) */}
                  <div className="hidden xl:flex xl:w-auto shrink-0 flex-col items-center justify-center px-1">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusDisplay.badgeClass}`}>
                      {statusDisplay.icon}
                      <span>{statusDisplay.label}</span>
                    </span>

                    {/* Special status warnings/alerts */}
                    {b.tripEvents?.some((e: any) => e.type === 'DRIVER_DECLINED') && (b.status === BookingStatus.DISPATCHED || b.status === BookingStatus.PENDING_ADMIN) && (
                      <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 text-center animate-pulse">
                        Driver Declined
                      </span>
                    )}
                    {b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVAL_REQUESTED' || e.payloadJson?.requiresFleetApproval) && !b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED') && (
                      <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse text-center">
                        Fleet Check Required
                      </span>
                    )}
                    {b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED') && b.advancePaymentStatus === 'PENDING' && (
                      <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 text-center">
                        Fleet Approved
                      </span>
                    )}
                    {hasOverrideRequest && (
                      <span className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse text-center">
                        Override Requested
                      </span>
                    )}
                  </div>

                  {/* Mobile/Tablet Expanded Bottom Row */}
                  {isExpanded && (
                    <div className="xl:hidden border-t border-slate-100 pt-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {renderDriverContent()}
                      </div>
                      <div className="shrink-0">
                        {renderFareContent(true)}
                      </div>
                    </div>
                  )}

                  {/* Column 5: Assigned Driver (Desktop Only) */}
                  <div className="hidden xl:flex w-full xl:w-40 shrink-0 xl:border-l xl:border-slate-200 xl:pl-4 justify-center flex-col">
                    {renderDriverContent()}
                  </div>

                  {/* Column 6: Fare, Vendor Cost & Actions (Desktop Only) */}
                  <div className="hidden xl:flex w-full xl:w-44 shrink-0 xl:border-l xl:border-slate-200 xl:pl-4 justify-center xl:items-end xl:text-right flex-col">
                    {renderFareContent(false)}
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between mt-3">
              <span className="text-xs text-slate-500 font-medium">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total bookings)
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
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
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in"
          onClick={() => setGalleryBooking(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative px-3.5 py-3 sm:px-5 sm:py-4 border-b border-slate-800 bg-slate-900 text-white pr-12 sm:pr-14">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <IconImage className="w-4 h-4 text-indigo-400 shrink-0" />
                <h3 className="font-extrabold text-xs sm:text-base tracking-tight text-white">
                  Ride Evidence & Inspection Photos
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 font-mono font-bold text-[11px] sm:text-xs whitespace-nowrap">
                  {galleryBooking.humanReadableRef}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-1 truncate">
                Customer: {galleryBooking.customer?.user?.fullName || 'Customer'} • Driver: {galleryBooking.assignedDriver?.user?.fullName || 'Unassigned'}
              </p>
              {/* Close bar / button pinned at top right */}
              <button
                type="button"
                onClick={() => setGalleryBooking(null)}
                className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition shadow-xs focus:outline-none"
                title="Close"
                aria-label="Close modal"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
              {/* Trip Timings & Execution Milestones */}
              {(() => {
                const timings = getTripTimingMilestones(galleryBooking);
                return (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <IconClock className="w-4 h-4 text-slate-600" />
                        <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-800">
                          Trip Timings & Execution Milestones
                        </h4>
                      </div>
                      {timings.totalTripDuration && (
                        <span className="text-[10px] sm:text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          Total Duration: {timings.totalTripDuration}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
                      {timings.milestones.map((m) => (
                        <div
                          key={m.id}
                          className="bg-white border border-slate-200 rounded-lg p-2 sm:p-2.5 flex flex-col justify-between shadow-2xs"
                        >
                          <div>
                            <span className="text-[11px] font-bold text-slate-900 block leading-tight">
                              {m.label}
                            </span>
                            <span className="text-[9px] text-slate-500 truncate block mt-0.5">
                              {m.sub}
                            </span>
                          </div>

                          <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-end justify-between gap-1">
                            <div>
                              <span className="text-xs sm:text-sm font-black font-mono text-slate-900 block">
                                {m.timeStr || '--:--'}
                              </span>
                              {m.extraInfo && (
                                <span className="text-[9px] text-slate-600 font-medium truncate block mt-0.5">
                                  {m.extraInfo}
                                </span>
                              )}
                            </div>

                            {/* Status Icon Arranged Below */}
                            {m.status === 'COMPLETED' ? (
                              <span
                                className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0 shadow-2xs mb-0.5"
                                title="Completed"
                              >
                                <svg className="w-3 h-3 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </span>
                            ) : m.status === 'IN_PROGRESS' ? (
                              <span
                                className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 flex items-center justify-center shrink-0 shadow-2xs mb-0.5"
                                title="In Progress"
                              >
                                <svg className="w-3 h-3 stroke-[2.5] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                              </span>
                            ) : (
                              <span
                                className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center shrink-0 mb-0.5"
                                title="Pending"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* 1. Pre-Trip Verification & Vehicle Condition (5 Photos) */}
              {(() => {
                const verificationData = getTripVerificationPhotos(galleryBooking);
                return (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <IconCar className="w-4 h-4 text-indigo-600 shrink-0" />
                        <h4 className="text-[11px] sm:text-xs font-black uppercase text-slate-800 tracking-wider">
                          Pre-Trip Verification & Vehicle Condition (5 Photos)
                        </h4>
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 whitespace-nowrap">
                        {verificationData.uploadedCount} of 5 Uploaded
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
                      {verificationData.photos.map((item) => {
                        const photoUrl = item.url;
                        return (
                          <div
                            key={item.key}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-2 sm:p-2.5 flex flex-col items-center text-center shadow-2xs"
                          >
                            <span className="text-[11px] sm:text-xs font-bold text-slate-800 leading-tight">{item.label}</span>
                            <span className="text-[9px] sm:text-[10px] text-slate-500 mb-1.5 truncate max-w-full">{item.sub}</span>
                            {photoUrl ? (
                              <div
                                onClick={() =>
                                  setPreviewImage({
                                    url: resolveImageUrl(photoUrl),
                                    title: `${galleryBooking.humanReadableRef} — ${item.label}`,
                                  })
                                }
                                className="w-full h-24 sm:h-32 bg-slate-200 rounded-lg border border-emerald-300 overflow-hidden cursor-pointer relative group shadow-inner"
                              >
                                <img
                                  src={resolveImageUrl(photoUrl)}
                                  alt={item.label}
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[11px] font-bold">
                                  Click to Zoom
                                </div>
                                <div className="absolute bottom-1 right-1 bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                  ✓ Verified
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-24 sm:h-32 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-[11px] text-slate-400 p-2">
                                <IconImage className="w-5 h-5 text-slate-300 mb-1" />
                                <span>Not Captured</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* 2. Odometer Readings & Verification */}
              <div className="space-y-2.5 sm:space-y-3 pt-3 sm:pt-4 border-t border-slate-200">
                <div className="flex items-center space-x-1.5">
                  <IconClock className="w-4 h-4 text-indigo-600 shrink-0" />
                  <h4 className="text-[11px] sm:text-xs font-black uppercase text-slate-800 tracking-wider">
                    Odometer Verification Evidence
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                  {/* Starting Odometer */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3.5 shadow-2xs">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-slate-700">Starting Odometer</span>
                      <span className="text-xs sm:text-sm font-mono font-black text-emerald-700">
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
                        className="w-full h-28 sm:h-40 bg-slate-200 rounded-lg border border-slate-300 overflow-hidden cursor-pointer relative group shadow-inner"
                      >
                        <img
                          src={resolveImageUrl(galleryBooking.startingOdometerImagePath)}
                          alt="Starting Odometer"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-bold">
                          Click to Zoom
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-20 sm:h-28 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        No Starting Photo Uploaded
                      </div>
                    )}
                  </div>

                  {/* Final Odometer */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3.5 shadow-2xs">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-slate-700">Final Odometer</span>
                      <span className="text-xs sm:text-sm font-mono font-black text-indigo-700">
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
                        className="w-full h-28 sm:h-40 bg-slate-200 rounded-lg border border-slate-300 overflow-hidden cursor-pointer relative group shadow-inner"
                      >
                        <img
                          src={resolveImageUrl(galleryBooking.finalOdometerImagePath)}
                          alt="Final Odometer"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-bold">
                          Click to Zoom
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-20 sm:h-28 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        No Final Photo Uploaded
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer - Arranged neatly below all content */}
            <div className="px-3 py-2.5 sm:px-5 sm:py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <span className="text-[10px] sm:text-xs text-slate-500 text-center sm:text-left">
                All photos are timestamped and geotagged for audit security.
              </span>
              <button
                type="button"
                onClick={() => {
                  const id = galleryBooking.id;
                  setGalleryBooking(null);
                  handleOpenDrawer(id);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition text-center whitespace-nowrap"
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
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-3.5 py-3 sm:px-4 sm:py-3 border-b border-slate-800 flex items-center text-white pr-12">
              <IconImage className="w-4 h-4 text-indigo-400 shrink-0 mr-2" />
              <span className="font-bold text-xs sm:text-sm truncate">{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
                title="Close"
                aria-label="Close preview"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-2 sm:p-4 bg-black flex items-center justify-center max-h-[80vh]">
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
