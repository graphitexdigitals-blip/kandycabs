'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { BookingStatus, getSupabaseClient } from '@kandy-cabs/shared';
import { AdminNavbar } from '@/components/AdminNavbar';
import { reverseGeocodeLocation } from '@/lib/geocoding';
import { parseIntermediateStops } from '@/lib/bookingHelpers';
import type { DriverMapMarker } from '@/components/LiveLeafletMap';
import {
  IconMap,
  IconCar,
  IconBuilding,
  IconPinPickup,
  IconPinDropoff,
  IconMenu,
  IconX,
  IconChevronLeft,
} from '@/components/Icons';

// Dynamically import LiveLeafletMap with SSR disabled (Leaflet requires browser DOM)
const LiveLeafletMap = dynamic(() => import('@/components/LiveLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 w-full h-full min-h-[500px] bg-slate-100 flex flex-col items-center justify-center text-slate-500">
      <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3"></div>
      <span className="text-sm font-medium">Loading OpenStreetMap Leaflet Engine...</span>
    </div>
  ),
});

export default function AdminLiveMapPage() {
  const [drivers, setDrivers] = useState<DriverMapMarker[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverMapMarker | null>(null);
  const [selectedBookingFilter, setSelectedBookingFilter] = useState<string>('ALL');
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [driverLocations, setDriverLocations] = useState<Record<string, string>>({});
  const [isFleetDrawerOpen, setIsFleetDrawerOpen] = useState(false);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFleetDrawerOpen) {
        setIsFleetDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFleetDrawerOpen]);

  // Resolve driver place/building/area names when driver coordinates arrive
  useEffect(() => {
    drivers.forEach((d) => {
      let lat = d.currentLat;
      let lng = d.currentLng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        if ((Math.abs(lat - 37.42) < 1.0 && Math.abs(lng - (-122.08)) < 1.0) || lng < 0) {
          lat = 12.9716;
          lng = 77.5946;
        }
        const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        if (!driverLocations[d.id] || !driverLocations[d.id].includes(key)) {
          reverseGeocodeLocation(lat, lng).then((addr) => {
            setDriverLocations((prev) => ({ ...prev, [d.id]: addr }));
          });
        }
      }
    });
  }, [drivers]);

  const fetchOnlineDrivers = useCallback(async (isBackground: boolean = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetch('/api/admin/drivers/online');
      if (res.ok) {
        const data = await res.json();
        const incomingDrivers: DriverMapMarker[] = data.drivers || [];
        setDrivers(incomingDrivers);
        setSelectedDriver((prev) => {
          if (!prev) return null;
          const fresh = incomingDrivers.find((d) => d.id === prev.id);
          return fresh || prev;
        });
        setIsReconnecting(false);
      } else {
        setIsReconnecting(true);
      }
    } catch (err) {
      console.error('Failed to fetch online drivers:', err);
      setIsReconnecting(true);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOnlineDrivers();
  }, [fetchOnlineDrivers]);

  // Primary: Supabase Realtime subscription on Driver table
  // Fallback: Polling only when Realtime is disconnected or during low-frequency background sync
  useEffect(() => {
    const supabase = getSupabaseClient();
    let channel: any = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const startFallbackPolling = (intervalMs = 5000) => {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchOnlineDrivers(true);
        }
      }, intervalMs);
    };

    if (supabase) {
      try {
        channel = supabase
          .channel(`admin-live-map-drivers-${Date.now()}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'Driver' },
            (payload: any) => {
              setRealtimeConnected(true);
              setIsReconnecting(false);

              if (payload.eventType === 'UPDATE') {
                // Update driver's position live
                setDrivers((prev) =>
                  prev.map((d) =>
                    d.id === payload.new.id
                      ? {
                          ...d,
                          currentLat: payload.new.currentLat,
                          currentLng: payload.new.currentLng,
                          lastPingAt: payload.new.lastPingAt,
                          onlineStatus: payload.new.onlineStatus !== undefined ? payload.new.onlineStatus : d.onlineStatus,
                          verificationStatus: payload.new.verificationStatus !== undefined ? payload.new.verificationStatus : d.verificationStatus,
                        }
                      : d
                  )
                );

                setSelectedDriver((curr) =>
                  curr && curr.id === payload.new.id
                    ? {
                        ...curr,
                        currentLat: payload.new.currentLat,
                        currentLng: payload.new.currentLng,
                        lastPingAt: payload.new.lastPingAt,
                        onlineStatus: payload.new.onlineStatus !== undefined ? payload.new.onlineStatus : curr.onlineStatus,
                        verificationStatus: payload.new.verificationStatus !== undefined ? payload.new.verificationStatus : curr.verificationStatus,
                      }
                    : curr
                );
              } else {
                fetchOnlineDrivers(true);
              }
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              setRealtimeConnected(true);
              setIsReconnecting(false);
              // Relax polling to 30s when Realtime is healthy
              startFallbackPolling(30000);
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              setRealtimeConnected(false);
              setIsReconnecting(true);
              // Fallback to 5s polling when Realtime is disconnected
              startFallbackPolling(5000);
            }
          });
      } catch (e) {
        setRealtimeConnected(false);
        setIsReconnecting(true);
        startFallbackPolling(5000);
      }
    } else {
      setRealtimeConnected(false);
      startFallbackPolling(5000);
    }

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      } else if (channel) {
        channel.unsubscribe();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [fetchOnlineDrivers]);

  // Fetch breadcrumb points when a driver with active booking is selected
  useEffect(() => {
    const activeBooking = selectedDriver?.assignedBookings.find(
      (b) => b.status === 'TRIP_STARTED' || b.status === 'DRIVER_EN_ROUTE'
    );
    if (activeBooking) {
      fetch(`/api/admin/bookings/${activeBooking.id}/tracking`)
        .then((r) => r.json())
        .then((d) => setBreadcrumbs(d.points || []))
        .catch(() => setBreadcrumbs([]));
    } else {
      setBreadcrumbs([]);
    }
  }, [selectedDriver]);

  // Helper checks for true trip in progress vs idle vs offline vs pending review
  const isDriverApproved = (d: DriverMapMarker) => d.verificationStatus === 'APPROVED';
  const isDriverOnline = (d: DriverMapMarker) => Boolean(d.onlineStatus);
  const isDriverOnTrip = (d: DriverMapMarker) => d.assignedBookings.some((b) => b.status === 'TRIP_STARTED');
  const isDriverEnRoute = (d: DriverMapMarker) =>
    !isDriverOnTrip(d) && d.assignedBookings.some((b) => b.status === 'DRIVER_EN_ROUTE');
  const isDriverAvailable = (d: DriverMapMarker) =>
    isDriverApproved(d) && isDriverOnline(d) && !isDriverOnTrip(d) && !isDriverEnRoute(d);

  const getDriverStatusMeta = (d: DriverMapMarker) => {
    if (!isDriverApproved(d)) {
      return {
        label: d.verificationStatus === 'REJECTED' ? 'KYC Rejected' : 'Pending Review',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
        isAvailable: false,
      };
    }
    if (!isDriverOnline(d)) {
      return {
        label: 'Offline',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        isAvailable: false,
      };
    }
    if (isDriverOnTrip(d)) {
      return {
        label: 'Trip in Progress',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        isAvailable: false,
      };
    }
    if (isDriverEnRoute(d)) {
      return {
        label: 'En-Route',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
        isAvailable: false,
      };
    }
    return {
      label: 'Idle / Available',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      isAvailable: true,
    };
  };

  // Filtered drivers based on category tab
  const filteredDrivers: DriverMapMarker[] = drivers.filter((d) => {
    if (selectedBookingFilter === 'ALL') return true;
    if (selectedBookingFilter === 'IDLE' || selectedBookingFilter === 'AVAILABLE') return isDriverAvailable(d);
    if (selectedBookingFilter === 'ON_TRIP') return isDriverOnTrip(d) || isDriverEnRoute(d);
    if (selectedBookingFilter === 'OFFLINE') return !isDriverOnline(d) || !isDriverApproved(d);
    return true;
  });

  const availableCount = drivers.filter((d) => isDriverAvailable(d)).length;
  const idleCount = availableCount;
  const onTripCount = drivers.filter((d) => isDriverOnTrip(d) || isDriverEnRoute(d)).length;
  const offlineCount = drivers.filter((d) => !isDriverOnline(d) || !isDriverApproved(d)).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <AdminNavbar />
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-3 py-2 sm:px-5 sm:py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 sticky top-0 z-20 shadow-2xs">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
              <IconMap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Live Fleet GPS Map (OpenStreetMap)</span>
            </h1>
            {isReconnecting ? (
              <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                <span>Reconnecting</span>
              </span>
            ) : realtimeConnected ? (
              <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                <span>GPS Connected</span>
              </span>
            ) : null}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
            Realtime OpenStreetMap Leaflet telemetry: Driver phone GPS tracking & live fleet management
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <Link
            href="/bookings"
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-[11px] sm:text-xs font-bold rounded-lg transition border border-slate-200 shadow-2xs whitespace-nowrap"
          >
            ← Back to Bookings Table
          </Link>
        </div>
      </header>

      {/* Main Map Area - Full Screen & Immersive */}
      <div className="flex-1 relative w-full h-[calc(100vh-105px)] min-h-[500px] overflow-hidden bg-slate-100">
        <LiveLeafletMap
          drivers={filteredDrivers}
          selectedDriver={selectedDriver}
          onSelectDriver={(d) => {
            setSelectedDriver(d);
            if (d) {
              setIsFleetDrawerOpen(true);
            }
          }}
          breadcrumbs={breadcrumbs}
        />

        {/* Floating Quick Drawer Button at Top of Map */}
        {!isFleetDrawerOpen && (
          <button
            type="button"
            onClick={() => setIsFleetDrawerOpen(true)}
            className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-bold shadow-xl backdrop-blur-md border border-white/20 transition-all active:scale-95 group hover:shadow-2xl hover:border-amber-400"
            title="Open Fleet Details Drawer"
          >
            <IconChevronLeft className="w-3.5 h-3.5 text-amber-400 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.5} />
            <span>Fleet Details</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
              {drivers.length}
            </span>
          </button>
        )}
      </div>

      {/* Slidable Off-Canvas Fleet Drawer (Right to Left) */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 ${
          isFleetDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsFleetDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out Panel from Right */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-full max-w-sm sm:max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-300 ease-out transform ${
          isFleetDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Fleet Details Drawer"
      >
        {/* Drawer Sticky Header */}
        <div className="sticky top-0 bg-white z-20 border-b border-slate-200 px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2 shadow-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <IconCar className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 truncate">
                <span>Fleet & Driver Telemetry</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                  {drivers.length}
                </span>
              </h2>
              <p className="text-[10px] text-slate-500 truncate">Live active drivers & trip assignments</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsFleetDrawerOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition active:scale-95 shrink-0"
            aria-label="Close Fleet Drawer"
            title="Close"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-3.5 space-y-3">
          {/* Category Filter Tabs */}
          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 grid grid-cols-4 gap-1 text-[10px] sm:text-[11px] font-semibold">
            <button
              onClick={() => {
                setSelectedBookingFilter('ALL');
              }}
              className={`py-1 px-1 rounded-md text-center transition ${
                selectedBookingFilter === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({drivers.length})
            </button>
            <button
              onClick={() => {
                setSelectedBookingFilter('IDLE');
              }}
              className={`py-1 px-1 rounded-md text-center transition ${
                selectedBookingFilter === 'IDLE' || selectedBookingFilter === 'AVAILABLE'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Available ({availableCount})
            </button>
            <button
              onClick={() => {
                setSelectedBookingFilter('ON_TRIP');
              }}
              className={`py-1 px-1 rounded-md text-center transition ${
                selectedBookingFilter === 'ON_TRIP'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              On-Trip ({onTripCount})
            </button>
            <button
              onClick={() => {
                setSelectedBookingFilter('OFFLINE');
              }}
              className={`py-1 px-1 rounded-md text-center transition ${
                selectedBookingFilter === 'OFFLINE'
                  ? 'bg-slate-700 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Offline/Pending ({offlineCount})
            </button>
          </div>

          {/* Selected Driver Detailed View */}
          {selectedDriver ? (
            <div className="space-y-3 pt-0.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <button
                  onClick={() => setSelectedDriver(null)}
                  className="text-[11px] text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 transition"
                >
                  <span>← Back to Driver List</span>
                </button>
                <button
                  onClick={() => setSelectedDriver(null)}
                  className="text-slate-500 hover:text-slate-800 text-[11px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{selectedDriver.user.fullName}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{selectedDriver.user.phone}</p>
                </div>
                {(() => {
                  const meta = getDriverStatusMeta(selectedDriver);
                  return (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${meta.badgeClass}`}>
                      {meta.label}
                    </span>
                  );
                })()}
              </div>

              {/* Status & Coordinates */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1.5">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">GPS Coordinates:</span>
                  <span className="text-emerald-700 font-bold">
                    {selectedDriver.currentLat?.toFixed(5) || '12.97160'}°, {selectedDriver.currentLng?.toFixed(5) || '77.59460'}°
                  </span>
                </div>

                {/* Resolved Driver Locality / Area */}
                <div className="pt-1.5 border-t border-slate-200 flex items-start justify-between gap-2">
                  <span className="text-slate-500 shrink-0 inline-flex items-center gap-1">
                    <IconBuilding className="w-3 h-3 text-slate-400" />
                    Current Area:
                  </span>
                  <div className="text-right">
                    <span className="text-slate-900 font-semibold text-[10px] block">
                      {driverLocations[selectedDriver.id] || 'Resolving locality...'}
                    </span>
                    {selectedDriver.currentLat && selectedDriver.currentLng && (
                      <a
                        href={`https://www.google.com/maps?q=${selectedDriver.currentLat},${selectedDriver.currentLng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:text-blue-800 underline font-mono inline-block mt-0.5"
                      >
                        View in Google Maps ↗
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex justify-between font-mono pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Last Ping:</span>
                  <span className="text-slate-700">
                    {selectedDriver.lastPingAt
                      ? new Date(selectedDriver.lastPingAt).toLocaleTimeString()
                      : 'Just now'}
                  </span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">License No:</span>
                  <span className="text-slate-700">{selectedDriver.licenseNumber}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-500">Vehicle:</span>
                  <span className="text-slate-700">
                    {selectedDriver.vehicles[0]?.plateNumber || 'N/A'} ({selectedDriver.vehicles[0]?.category || 'Standard'})
                  </span>
                </div>
              </div>

              {/* Active Assigned Booking */}
              {selectedDriver.assignedBookings.length > 0 ? (
                <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200 space-y-1.5">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-blue-700">
                    {selectedDriver.assignedBookings.some(b => b.status === 'TRIP_STARTED')
                      ? 'Live Trip in Progress'
                      : selectedDriver.assignedBookings.some(b => b.status === 'DRIVER_EN_ROUTE')
                      ? 'En-Route to Pickup'
                      : 'Assigned Booking'}
                  </span>
                  {selectedDriver.assignedBookings.map((b) => {
                    const stops = parseIntermediateStops(b);
                    return (
                      <div key={b.id} className="text-[11px] space-y-1">
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-900">{b.humanReadableRef}</span>
                          <span className="text-blue-700 font-semibold text-[10px]">{b.status}</span>
                        </div>
                        <p className="text-slate-700 truncate font-medium flex items-center gap-1">
                          <IconPinPickup className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{b.pickupAddress}</span>
                        </p>
                        {stops.length > 0 && (
                          <div className="pl-3 border-l-2 border-amber-300 ml-1 py-0.5 space-y-0.5">
                            {stops.map((s, idx) => (
                              <p key={idx} className="text-amber-900 text-[10px] font-semibold truncate">
                                Stop {idx + 1}: {s}
                              </p>
                            ))}
                          </div>
                        )}
                        <p className="text-slate-600 truncate flex items-center gap-1">
                          <IconPinDropoff className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="truncate">{b.dropAddress}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 text-center">
                  {isDriverAvailable(selectedDriver)
                    ? 'Driver is approved, online, and currently available for ride dispatches.'
                    : !isDriverApproved(selectedDriver)
                    ? 'Driver is pending KYC registration review. Cannot be dispatched.'
                    : 'Driver is currently offline / off-duty.'}
                </div>
              )}

              {/* Breadcrumb Route Polyline Points */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-slate-600">
                    GPS Breadcrumb Trail ({breadcrumbs.length})
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">OpenStreetMap</span>
                </div>

                {breadcrumbs.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No GPS breadcrumbs logged yet for this trip.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                    {breadcrumbs.map((pt, idx) => (
                      <div
                        key={pt.id || idx}
                        className="flex justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700"
                      >
                        <span>
                          #{idx + 1} ({pt.lat.toFixed(4)}, {pt.lng.toFixed(4)})
                        </span>
                        <span className="text-slate-500 text-[9px]">
                          {new Date(pt.recordedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Driver Cards List Column */
            <div className="space-y-2">
              <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  {selectedBookingFilter === 'ALL'
                    ? `All Drivers (${filteredDrivers.length})`
                    : selectedBookingFilter === 'IDLE' || selectedBookingFilter === 'AVAILABLE'
                    ? `Available Drivers (${filteredDrivers.length})`
                    : selectedBookingFilter === 'ON_TRIP'
                    ? `On-Trip Drivers (${filteredDrivers.length})`
                    : `Offline / Pending Drivers (${filteredDrivers.length})`}
                </span>
                <span className="text-[9px] text-amber-600 font-medium">Click to track</span>
              </div>

              {filteredDrivers.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs space-y-1">
                  <IconCar className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="font-semibold text-slate-700 text-xs">No drivers matching this filter</p>
                  <p className="text-[10px]">Drivers will appear here when they match this category.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
                  {filteredDrivers.map((d) => {
                    const isTripStarted = d.assignedBookings.some((b) => b.status === 'TRIP_STARTED');
                    const isEnRoute = !isTripStarted && d.assignedBookings.some((b) => b.status === 'DRIVER_EN_ROUTE');
                    const vehicle = d.vehicles[0];
                    const resolvedLocation = driverLocations[d.id];
                    const meta = getDriverStatusMeta(d);

                    return (
                      <div
                        key={d.id}
                        onClick={() => setSelectedDriver(d)}
                        className="p-2.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-amber-400 cursor-pointer transition shadow-2xs group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <h4 className="font-bold text-xs text-slate-900 group-hover:text-amber-600 transition flex items-center gap-1.5">
                              <IconCar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>{d.user.fullName}</span>
                            </h4>
                            <p className="text-[10px] text-slate-500 font-mono">{d.user.phone}</p>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${meta.badgeClass}`}>
                            {meta.label}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-500 space-y-0.5 border-t border-slate-100 pt-1.5">
                          <div className="flex justify-between font-mono">
                            <span className="text-slate-400">Vehicle:</span>
                            <span className="text-slate-700">
                              {vehicle?.plateNumber || 'N/A'} ({vehicle?.category || 'Standard'})
                            </span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-slate-400">GPS:</span>
                            <span className="text-emerald-600 font-semibold">
                              {d.currentLat ? `${d.currentLat.toFixed(4)}, ${d.currentLng?.toFixed(4)}` : 'No fix'}
                            </span>
                          </div>
                          {resolvedLocation && (
                            <div className="text-[10px] text-slate-700 flex items-center gap-1 pt-0.5 truncate">
                              <IconBuilding className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{resolvedLocation}</span>
                            </div>
                          )}
                          {(isTripStarted || isEnRoute) && d.assignedBookings.length > 0 && (
                            <div className="mt-1 pt-1 border-t border-slate-100 text-[10px] text-blue-700 truncate" title={`${d.assignedBookings[0].pickupAddress} ${parseIntermediateStops(d.assignedBookings[0]).length > 0 ? `➔ Via: ${parseIntermediateStops(d.assignedBookings[0]).join(' ➔ ')}` : ''} ➔ ${d.assignedBookings[0].dropAddress}`}>
                              <IconPinPickup className="w-2.5 h-2.5 text-emerald-600 inline mr-0.5 shrink-0" />
                              <span>{d.assignedBookings[0].pickupAddress}</span>
                              {parseIntermediateStops(d.assignedBookings[0]).length > 0 && (
                                <span className="text-amber-800 font-bold">
                                  {' '}➔ Via {parseIntermediateStops(d.assignedBookings[0]).join(', ')}
                                </span>
                              )}
                              {' '}→ <IconPinDropoff className="w-2.5 h-2.5 text-rose-500 inline mr-0.5 shrink-0" />
                              <span>{d.assignedBookings[0].dropAddress}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Bottom Summary Pill */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-3.5 py-2.5 flex justify-between items-center text-[10px] sm:text-[11px] text-slate-600 font-mono shrink-0">
          <span>Total: <strong className="text-slate-900">{drivers.length}</strong></span>
          <span>Available: <strong className="text-emerald-600">{availableCount}</strong></span>
          <span>On-Trip: <strong className="text-blue-600">{onTripCount}</strong></span>
          <span>Off/Pending: <strong className="text-amber-700">{offlineCount}</strong></span>
        </div>
      </aside>
    </div>
  );
}
