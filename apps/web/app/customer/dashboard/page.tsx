'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { BookingStatus, getSupabaseClient, UserRole, VehicleCategory } from '@kandy-cabs/shared';
import { useAuth } from '@/lib/AuthContext';

import { TaxInvoiceModal } from '@/components/TaxInvoiceModal';
import { CancelBookingModal } from '@/components/CancelBookingModal';
import { DriverAppModal } from '@/components/DriverAppModal';
import { CustomerHeader } from '@/components/CustomerHeader';
import { CustomerBottomDock } from '@/components/CustomerBottomDock';
import { WebAuthModal } from '@/components/WebAuthModal';

export const dynamic = 'force-dynamic';

const STATUS_CATEGORIES = ['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

const VEHICLE_META: Record<
  string,
  {
    image: string;
  }
> = {
  HATCHBACK: { image: '/images/fleet-hatchback.webp' },
  SEDAN: { image: '/images/fleet-sedan.webp' },
  PRIME_SEDAN: { image: '/images/fleet-sedan.webp' },
  SUV: { image: '/images/fleet-suv.webp' },
  SUV_PREMIUM: { image: '/images/fleet-crysta.webp' },
  INNOVA_CRYSTA: { image: '/images/fleet-crysta.webp' },
  TEMPO_TRAVELER: { image: '/images/fleet-traveller.webp' },
  TEMPO_TRAVELLER: { image: '/images/fleet-traveller.webp' },
};

export default function CustomerDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [driverAppModalOpen, setDriverAppModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Modals
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [cancelModalBooking, setCancelModalBooking] = useState<{ id: string; ref: string; scheduledAt: string } | null>(null);
  const [expandedBookingIds, setExpandedBookingIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (bookingId: string) => {
    setExpandedBookingIds((prev) => ({
      ...prev,
      [bookingId]: !prev[bookingId],
    }));
  };

  const fetchBookings = useCallback(
    async (isBackground: boolean = false) => {
      if (!isBackground) setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          category: 'ALL',
          page: '1',
          limit: '100',
        });
        const res = await fetch(`/api/customer/bookings/list?${queryParams}`);
        if (res.ok) {
          const data = await res.json();
          setBookings(data.bookings || []);
          if (data.customerId) {
            setCustomerId(data.customerId);
          }
          setIsReconnecting(false);
        } else {
          console.error('Bookings API returned', res.status, await res.text().catch(() => ''));
          setIsReconnecting(true);
        }
      } catch (err) {
        console.error('Failed to fetch customer bookings:', err);
        setIsReconnecting(true);
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    []
  );

  // Only fetch once auth has resolved and user is confirmed logged-in
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      fetchBookings();
    }
  }, [isLoading, isAuthenticated, fetchBookings]);

  // Realtime subscription scoped to current customer + 5-second polling fallback
  useEffect(() => {
    const supabase = getSupabaseClient();
    let channel: any = null;
    let pollInterval: any = null;

    if (supabase && customerId) {
      try {
        channel = supabase
          .channel(`customer-bookings-${customerId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'Booking',
              filter: `customerId=eq.${customerId}`,
            },
            (payload: any) => {
              setRealtimeActive(true);
              setIsReconnecting(false);

              if (payload.eventType === 'INSERT') {
                setBookings((prev) => [payload.new, ...prev]);
              } else if (payload.eventType === 'UPDATE') {
                // Instantly update status, driver assignment, or customerPhoneReleased flag!
                setBookings((prev) =>
                  prev.map((b) => (b.id === payload.new.id ? { ...b, ...payload.new } : b))
                );
              } else if (payload.eventType === 'DELETE') {
                setBookings((prev) => prev.filter((b) => b.id !== payload.old.id));
              }
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              setRealtimeActive(true);
              setIsReconnecting(false);
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              setRealtimeActive(false);
              setIsReconnecting(true);
            }
          });
      } catch (e) {
        setRealtimeActive(false);
        setIsReconnecting(true);
      }
    }

    // 30s polling fallback — only run when we have a valid customerId (authenticated)
    if (customerId) {
      pollInterval = setInterval(() => {
        fetchBookings(true);
      }, 30000);
    }

    return () => {
      if (channel) channel.unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [customerId, fetchBookings]);

  const isBookingActive = (status: string) => {
    return (
      status === BookingStatus.PENDING_ADMIN ||
      status === BookingStatus.DISPATCHED ||
      status === BookingStatus.DRIVER_ACCEPTED ||
      status === BookingStatus.DRIVER_EN_ROUTE ||
      status === BookingStatus.TRIP_STARTED
    );
  };

  const isBookingCompleted = (status: string) => {
    return status === BookingStatus.TRIP_COMPLETED;
  };

  const isBookingCancelled = (status: string) => {
    return status === BookingStatus.CANCELLED;
  };

  const filteredBookings = React.useMemo(() => {
    if (categoryFilter === 'ACTIVE') {
      return bookings.filter((b) => isBookingActive(b.status));
    }
    if (categoryFilter === 'COMPLETED') {
      return bookings.filter((b) => isBookingCompleted(b.status));
    }
    if (categoryFilter === 'CANCELLED') {
      return bookings.filter((b) => isBookingCancelled(b.status));
    }
    return bookings;
  }, [bookings, categoryFilter]);

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.PENDING_ADMIN:
        return { label: 'Pending', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case BookingStatus.DISPATCHED:
        return { label: 'Finding Driver', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case BookingStatus.DRIVER_ACCEPTED:
        return { label: 'Confirmed', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case BookingStatus.DRIVER_EN_ROUTE:
        return { label: 'En Route', bg: 'bg-sky-50 text-sky-700 border-sky-200' };
      case BookingStatus.TRIP_STARTED:
        return { label: 'In Progress', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case BookingStatus.TRIP_COMPLETED:
        return { label: 'Completed', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case BookingStatus.CANCELLED:
        return { label: 'Cancelled', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: status, bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  const getVehicleImage = (booking: any) => {
    const rawCat =
      booking.vehicleCategory ||
      booking.category ||
      booking.vehicle?.category ||
      booking.assignedDriver?.vehicles?.[0]?.category ||
      booking.tripEvents?.[0]?.payloadJson?.category ||
      booking.tripEvents?.[0]?.payloadJson?.vehicleCategory;

    if (rawCat) {
      const normalized = String(rawCat).toUpperCase().trim();
      if (VEHICLE_META[normalized]) {
        return VEHICLE_META[normalized].image;
      }
      if (normalized.includes('HATCH')) return '/images/fleet-hatchback.webp';
      if (normalized.includes('CRYSTA') || normalized.includes('INNOVA') || normalized.includes('PREMIUM')) return '/images/fleet-crysta.webp';
      if (normalized.includes('SUV')) return '/images/fleet-suv.webp';
      if (normalized.includes('TEMPO') || normalized.includes('TRAVEL')) return '/images/fleet-traveller.webp';
      if (normalized.includes('SEDAN') || normalized.includes('PRIME')) return '/images/fleet-sedan.webp';
    }
    return '/images/fleet-sedan.webp';
  };

  const formatScheduledDate = (dateStr: string) => {
    try {
      let str = typeof dateStr === 'string' ? dateStr : String(dateStr);
      str = str.replace(/^00(\d{2})/, (_, yy) => `20${yy}`);
      str = str.replace(/^(\d{1,3})-/, (_, y) => `${String(Number(y) < 100 ? 2000 + Number(y) : Number(y)).padStart(4, '0')}-`);
      const d = new Date(str);
      if (d.getFullYear() < 100) d.setFullYear(2000 + d.getFullYear());
      const day = d.getDate().toString().padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const formattedHours = hours.toString().padStart(2, '0');
      return `${day} ${month} ${year} • ${formattedHours}:${minutes} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  const formatShortRoute = (pickup: string, drop: string) => {
    const getCleanLocation = (addr: string) => {
      if (!addr) return 'Location';
      const parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return parts.slice(-2).join(', ');
      }
      return parts[0] || addr;
    };
    return `${getCleanLocation(pickup)} → ${getCleanLocation(drop)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8">
      {/* Top Header Matching Customer App */}
      <CustomerHeader activeNav="bookings" onOpenAuth={() => setAuthModalOpen(true)} />

      <div className="pt-4 pb-6 px-3 sm:px-5 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-2.5 sm:space-y-3">
        {/* Header & Filter Tabs */}
        <div className="bg-white p-3 sm:p-3.5 px-3.5 sm:px-4 rounded-xl sm:rounded-2xl shadow-xs border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history.length > 1) {
                    router.back();
                  } else {
                    router.push('/');
                  }
                }}
                aria-label="Go back"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">My Bookings</h1>
            </div>
            <Link
              href="/booking"
              className="px-3 py-1.5 bg-[#F05323] hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition shadow-xs whitespace-nowrap shrink-0"
            >
              + Book New Ride
            </Link>
          </div>

          {/* Status Category Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {STATUS_CATEGORIES.map((cat) => {
              const label = cat === 'ALL' ? 'All Rides' : cat;
              const isSelected = categoryFilter === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`flex-1 py-1.5 px-1.5 text-center rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bookings List */}
        {(isLoading || loading) && bookings.length === 0 ? (
          <div className="py-20 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
            Loading your bookings...
          </div>
        ) : !isAuthenticated ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="font-bold text-slate-800 text-base">Please sign in to view your bookings</h3>
            <Link href="/" className="inline-block mt-4 px-6 py-2.5 bg-[#F05323] hover:bg-orange-600 text-white font-semibold text-xs rounded-xl shadow-xs transition">
              Sign In
            </Link>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
            <div className="text-4xl mb-3">🚕</div>
            <h3 className="font-bold text-slate-800 text-base">
              {categoryFilter === 'ALL'
                ? 'No bookings found'
                : `No ${categoryFilter.toLowerCase()} rides`}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {categoryFilter === 'ACTIVE'
                ? 'You currently have no active or in-progress rides.'
                : categoryFilter === 'COMPLETED'
                ? 'You do not have any completed rides in your history yet.'
                : categoryFilter === 'CANCELLED'
                ? 'You do not have any cancelled rides.'
                : 'Ready for your next journey? Book a ride in just a few taps.'}
            </p>
            <Link
              href="/booking"
              className="inline-block mt-4 px-6 py-2.5 bg-[#F05323] hover:bg-orange-600 text-white font-semibold text-xs rounded-xl shadow-xs transition"
            >
              Book a Cab Now
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBookings.map((booking) => {
              const statusBadge = getStatusBadge(booking.status);
              const isTripActive =
                booking.status !== BookingStatus.TRIP_COMPLETED &&
                booking.status !== BookingStatus.CANCELLED;

              const driver = booking.assignedDriver;
              const vehicle = booking.vehicle || driver?.vehicles?.[0];
              const isExpanded = !!expandedBookingIds[booking.id];

              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md"
                >
                  {/* Compact Header Summary Row (Clickable) */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(booking.id)}
                    className="w-full text-left p-2.5 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 hover:bg-slate-50/70 transition"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      {/* Cab Thumbnail */}
                      <div className="w-13 h-10 sm:w-15 sm:h-11 shrink-0 flex items-center justify-center bg-slate-50 rounded-lg p-0.5 border border-slate-200/80 overflow-hidden">
                        <img
                          src={getVehicleImage(booking)}
                          alt={booking.vehicleCategory || 'Cab'}
                          className="w-full h-full object-contain pointer-events-none drop-shadow-xs"
                          loading="lazy"
                        />
                      </div>

                      {/* KC number, Route, Date */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 font-mono tracking-tight whitespace-nowrap">
                          #{booking.humanReadableRef}
                        </div>
                        <div className="text-xs text-slate-700 font-medium truncate block">
                          {formatShortRoute(booking.pickupAddress, booking.dropAddress)}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium whitespace-nowrap">
                          {formatScheduledDate(booking.scheduledAt)}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge & Chevron */}
                    <div className="flex items-center gap-1.5 shrink-0 pl-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold border whitespace-nowrap ${statusBadge.bg}`}
                      >
                        {statusBadge.label}
                      </span>
                      <svg
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                          isExpanded ? 'rotate-90 text-orange-600' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Full Details */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 space-y-3 bg-white animate-in fade-in-50 duration-200">
                      {/* Price & Scheduled Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 border-b border-slate-100">
                        <div>
                          <p className="text-xs text-slate-400">
                            Scheduled for: <strong className="text-slate-700">{formatScheduledDate(booking.scheduledAt)}</strong>
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-base font-black text-slate-900 block">
                            ₹{Number(booking.estimatedFare).toFixed(2)}
                          </span>
                          <span className="text-[11px] text-emerald-600 font-semibold">
                            Advance Paid: ₹{Number(booking.advanceAmount).toFixed(2)} (25%)
                          </span>
                        </div>
                      </div>

                      {/* Middle Row: Route, OTP Card, Driver Card */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {/* Itinerary */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs text-slate-700">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            Trip Route ({booking.tripType})
                          </span>
                          <p className="truncate" title={booking.pickupAddress}>
                            📍 <strong>Pickup:</strong> {booking.pickupAddress}
                          </p>
                          <p className="truncate" title={booking.dropAddress}>
                            🏁 <strong>Drop:</strong> {booking.dropAddress}
                          </p>
                          <p className="text-slate-500 pt-0.5 font-medium">
                            Distance: {booking.distanceKm} km
                          </p>
                        </div>

                        {/* Trip Start OTP Card */}
                        <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 flex flex-col justify-between text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">
                              🔑 Pickup OTP
                            </span>
                            {isTripActive ? (
                              <div className="flex items-center space-x-2 my-1">
                                <span className="font-mono text-xl font-black text-amber-700 tracking-widest bg-white px-2.5 py-0.5 rounded-lg border border-amber-300">
                                  {booking.pickupOtp}
                                </span>
                              </div>
                            ) : (
                              <p className="text-slate-500 italic">Trip finished / OTP redeemed.</p>
                            )}
                          </div>
                          <p className="text-[10px] text-amber-700 mt-1">
                            Share this 4-digit code with your driver at pickup only to start the ride.
                          </p>
                        </div>

                        {/* Assigned Driver Card */}
                        <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200/80 flex flex-col justify-between text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block mb-1">
                              🚕 Driver &amp; Vehicle
                            </span>
                            {driver ? (
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-900 text-sm">{driver.user.fullName}</p>
                                <p className="text-slate-600 font-mono text-[11px]">
                                  {vehicle ? `${vehicle.category} • ${vehicle.plateNumber || 'Plate TBD'}` : 'Cab assigned'}
                                </p>
                              </div>
                            ) : (
                              <p className="text-slate-500 italic py-0.5">Dispatching to closest driver...</p>
                            )}
                          </div>

                          <div className="mt-1.5 pt-1.5 border-t border-indigo-100">
                            {driver && booking.customerPhoneReleased && booking.status !== 'TRIP_COMPLETED' && booking.status !== 'CANCELLED' ? (
                              <a
                                href={`tel:${driver.user.phone}`}
                                className="inline-flex items-center justify-center w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition shadow-xs"
                              >
                                📞 Call Driver ({driver.user.phone})
                              </a>
                            ) : driver && (booking.status === 'TRIP_COMPLETED' || booking.status === 'CANCELLED') ? (
                              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                ✓ Trip ended • Driver contact closed
                              </span>
                            ) : driver ? (
                              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                🔒 Driver phone hidden until released by dispatch
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Waiting for driver assignment</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                        <div className="text-slate-500">
                          Balance Due on Trip: <strong className="text-slate-800">₹{Number(booking.balanceAmount).toFixed(2)}</strong> ({booking.balancePaymentStatus})
                        </div>

                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceId(booking.id)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
                          >
                            📄 View Tax Invoice
                          </button>

                          {isTripActive && booking.status !== BookingStatus.TRIP_STARTED && (
                            <button
                              type="button"
                              onClick={() =>
                                setCancelModalBooking({
                                  id: booking.id,
                                  ref: booking.humanReadableRef,
                                  scheduledAt: booking.scheduledAt,
                                })
                              }
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 font-bold hover:bg-red-50 transition"
                            >
                              Cancel Ride
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <TaxInvoiceModal
        bookingId={selectedInvoiceId}
        isOpen={!!selectedInvoiceId}
        onClose={() => setSelectedInvoiceId(null)}
      />

      {cancelModalBooking && (
        <CancelBookingModal
          bookingId={cancelModalBooking.id}
          bookingRef={cancelModalBooking.ref}
          scheduledAt={cancelModalBooking.scheduledAt}
          isOpen={!!cancelModalBooking}
          onClose={() => setCancelModalBooking(null)}
          onSuccess={fetchBookings}
        />
      )}

      {/* Driver App Download / Information Modal */}
      <DriverAppModal
        isOpen={driverAppModalOpen}
        onClose={() => setDriverAppModalOpen(false)}
        driverName={user?.fullName}
      />

      {/* Web Auth Modal */}
      <WebAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Mobile Bottom Dock */}
      <CustomerBottomDock onOpenAuth={() => setAuthModalOpen(true)} />
      </div>
    </div>
  );
}
