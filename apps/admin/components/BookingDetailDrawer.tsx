'use client';

import React, { useState, useEffect } from 'react';
import { BookingStatus } from '@kandy-cabs/shared';
import { reverseGeocodeLocation } from '@/lib/geocoding';
import { parseIntermediateStops, getBookingMetadata } from '@/lib/bookingHelpers';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

interface BookingDetailDrawerProps {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDispatch: (bookingId: string, bookingRef: string) => void;
  onOpenOtpOverride: (bookingId: string, bookingRef: string) => void;
  onRefresh: () => void;
}

export function BookingDetailDrawer({
  bookingId,
  isOpen,
  onClose,
  onOpenDispatch,
  onOpenOtpOverride,
  onRefresh,
}: BookingDetailDrawerProps) {
  const [data, setData] = useState<any>(null);
  const [trackingPoints, setTrackingPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingPhone, setTogglingPhone] = useState(false);
  const [driverLocationName, setDriverLocationName] = useState<string>('');
  const [driverAllowanceVal, setDriverAllowanceVal] = useState<string>('350');
  const [driverPayeeVal, setDriverPayeeVal] = useState<string>('0');
  const [driverPayStatus, setDriverPayStatus] = useState<string>('PENDING');
  const [savingDriverPay, setSavingDriverPay] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const fetchDetail = async (id: string) => {
    setLoading(true);
    try {
      const [resDetail, resTrack] = await Promise.all([
        fetch(`/api/admin/bookings/${id}`),
        fetch(`/api/admin/bookings/${id}/tracking`),
      ]);

      if (resDetail.ok) {
        const json = await resDetail.json();
        setData(json);
        const b = json.booking;
        if (b) {
          setDriverAllowanceVal(b.driverAllowance ? String(b.driverAllowance) : '350');
          setDriverPayeeVal(b.driverPayeeAmount ? String(b.driverPayeeAmount) : '0');
          setDriverPayStatus(b.driverPaymentStatus || 'PENDING');
        }
        const drv = json.booking?.assignedDriver;
        if (drv?.currentLat && drv?.currentLng) {
          reverseGeocodeLocation(drv.currentLat, drv.currentLng).then(setDriverLocationName);
        }
      }
      if (resTrack.ok) {
        const jsonTrack = await resTrack.json();
        setTrackingPoints(jsonTrack.points || []);
      }
    } catch (err) {
      console.error('Failed to load booking details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDriverPayment = async () => {
    if (!booking) return;
    setSavingDriverPay(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverAllowance: parseFloat(driverAllowanceVal) || 0,
          driverPayeeAmount: parseFloat(driverPayeeVal) || 0,
          driverPaymentStatus: driverPayStatus,
        }),
      });
      if (res.ok) {
        await fetchDetail(booking.id);
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to update driver payment details:', err);
    } finally {
      setSavingDriverPay(false);
    }
  };

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchDetail(bookingId);
      // Auto refresh location every 5s if active
      const interval = setInterval(() => {
        fetch(`/api/admin/bookings/${bookingId}/tracking`)
          .then((r) => r.json())
          .then((d) => setTrackingPoints(d.points || []))
          .catch(() => {});
      }, 5000);
      return () => clearInterval(interval);
    } else {
      setData(null);
      setTrackingPoints([]);
    }
  }, [isOpen, bookingId]);

  if (!isOpen || !bookingId) return null;

  const booking = data?.booking;
  const auditLogs = data?.auditLogs || [];
  const assignedDriver = booking?.assignedDriver;
  const bookingMeta = getBookingMetadata(booking);

  const handleTogglePhoneRelease = async () => {
    if (!booking) return;
    const targetState = !booking.customerPhoneReleased;

    // Instant optimistic UI update (0ms response)
    setData((prev: any) =>
      prev
        ? {
            ...prev,
            booking: {
              ...prev.booking,
              customerPhoneReleased: targetState,
            },
          }
        : prev
    );

    setTogglingPhone(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/release-phone`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ released: targetState }),
      });
      if (res.ok) {
        onRefresh();
      } else {
        // Rollback if failed
        setData((prev: any) =>
          prev
            ? {
                ...prev,
                booking: {
                  ...prev.booking,
                  customerPhoneReleased: !targetState,
                },
              }
            : prev
        );
      }
    } catch (err) {
      console.error('Failed to toggle phone release:', err);
      // Rollback on network error
      setData((prev: any) =>
        prev
          ? {
              ...prev,
              booking: {
                ...prev.booking,
                customerPhoneReleased: !targetState,
              },
            }
          : prev
      );
    } finally {
      setTogglingPhone(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col animate-slide-left">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900">
                {booking?.humanReadableRef || 'Loading...'}
              </h2>
              {booking && (
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    booking.status === BookingStatus.DRIVER_EN_ROUTE ||
                    booking.status === BookingStatus.TRIP_STARTED
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : booking.status === BookingStatus.DRIVER_ACCEPTED
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {booking.status === BookingStatus.DRIVER_EN_ROUTE ||
                  booking.status === BookingStatus.TRIP_STARTED
                    ? 'ON TRIP'
                    : String(booking.status).replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Trip Type: <span className="font-medium text-slate-700">{booking?.tripType}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {loading && !data ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading trip information...</div>
        ) : !booking ? (
          <div className="p-12 text-center text-sm text-slate-500">Booking details not available.</div>
        ) : (
          <div className="p-6 space-y-6 flex-1">
            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              {booking.status === BookingStatus.PENDING_ADMIN && (
                <button
                  type="button"
                  onClick={() => onOpenDispatch(booking.id, booking.humanReadableRef)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  📡 Broadcast Dispatch
                </button>
              )}

              {booking.status === BookingStatus.DISPATCHED && (
                <button
                  type="button"
                  onClick={() => onOpenDispatch(booking.id, booking.humanReadableRef)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  🔄 Re-dispatch Ride
                </button>
              )}

              <button
                type="button"
                disabled={togglingPhone}
                onClick={handleTogglePhoneRelease}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  booking.customerPhoneReleased
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {booking.customerPhoneReleased ? '🔓 Customer Phone Released' : '🔒 Release Customer Phone'}
              </button>

              {booking.status !== BookingStatus.TRIP_STARTED &&
                booking.status !== BookingStatus.TRIP_COMPLETED &&
                booking.status !== BookingStatus.CANCELLED && (
                  <button
                    type="button"
                    onClick={() => onOpenOtpOverride(booking.id, booking.humanReadableRef)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-xs"
                  >
                    🔑 Admin OTP Override
                  </button>
                )}
            </div>

            {/* Pending Driver Override Alert Box */}
            {booking.tripEvents?.some((e: any) => e.type === 'OVERRIDE_REQUESTED') &&
              (booking.status === BookingStatus.DRIVER_ACCEPTED || booking.status === BookingStatus.DRIVER_EN_ROUTE) && (
                <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-pulse">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">⚠️</span>
                      <span className="font-black text-xs text-amber-900 uppercase tracking-wide">
                        Driver Requested Manual Trip Start (OTP Override)
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 mt-1">
                      Reason: <span className="font-semibold">{booking.tripEvents.find((e: any) => e.type === 'OVERRIDE_REQUESTED')?.payloadJson?.note || 'Customer phone unreachable / battery dead'}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenOtpOverride(booking.id, booking.humanReadableRef)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-xs shrink-0 transition"
                  >
                    🔑 Authorize & Start Trip
                  </button>
                </div>
              )}

            {/* FLOW A: Mini Live Tracking Map for Trip */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  🗺️ Flow A: Live Driver GPS & Route
                </span>
                {assignedDriver ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    GPS Active (Last: {assignedDriver.lastPingAt ? new Date(assignedDriver.lastPingAt).toLocaleTimeString() : 'Recent'})
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">No Driver Assigned</span>
                )}
              </div>

              <div className="p-4 bg-slate-900 text-white min-h-[160px] flex flex-col justify-center items-center text-center relative overflow-hidden">
                {assignedDriver ? (
                  <div className="space-y-2 z-10 w-full max-w-md">
                    <div className="inline-flex items-center space-x-2 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-mono">
                        {assignedDriver.user.fullName} ({assignedDriver.currentLat?.toFixed(4) || '12.9716'}, {assignedDriver.currentLng?.toFixed(4) || '77.5946'})
                      </span>
                    </div>

                    {/* Area / Building Name */}
                    <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/80 text-xs">
                      <span className="text-slate-400">🏢 Current Location: </span>
                      <span className="text-emerald-300 font-semibold">
                        {driverLocationName || 'Resolving area & building...'}
                      </span>
                      {assignedDriver.currentLat && assignedDriver.currentLng && (
                        <div className="mt-1">
                          <a
                            href={`https://www.google.com/maps?q=${assignedDriver.currentLat},${assignedDriver.currentLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-sky-400 hover:text-sky-300 underline font-mono inline-block"
                          >
                            Open in Google Maps ↗
                          </a>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-slate-400">
                      Breadcrumbs Recorded: <span className="text-white font-bold">{trackingPoints.length}</span> GPS points
                    </p>
                    {trackingPoints.length > 0 && (
                      <div className="flex justify-center space-x-1 mt-2">
                        {trackingPoints.slice(-8).map((pt, i) => (
                          <div
                            key={pt.id || i}
                            className="w-1.5 h-6 bg-indigo-400/80 rounded-xs"
                            title={`Point ${i + 1}: ${pt.lat}, ${pt.lng}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Dispatch this ride to an online driver to activate Flow A live tracking.
                  </p>
                )}
              </div>
            </div>

            {/* Route & Multi-Drop Itinerary Card */}
            {(() => {
              const meta = getBookingMetadata(booking);
              const stops = meta.intermediateStops;
              return (
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">📍</span>
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                        Trip Route & Itinerary
                      </h4>
                    </div>
                    <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                        {booking.tripType} • {booking.distanceKm} KM
                      </span>
                      {stops.length > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-md border border-amber-300">
                          ⚡ {stops.length} Intermediate Drop{stops.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {meta.hasCarrier && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                          <span>📦</span>
                          <span>Roof Carrier Requested</span>
                        </span>
                      )}
                      {meta.hasPet && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-md border border-amber-300 flex items-center gap-1">
                          <span>🐾</span>
                          <span>Pet Friendly (+₹{meta.petFee || 500})</span>
                        </span>
                      )}
                      {meta.flightNumber && (
                        <span className="text-[10px] bg-sky-100 text-sky-900 font-extrabold px-2 py-0.5 rounded-md border border-sky-300 flex items-center gap-1">
                          <span>✈️</span>
                          <span>Flight: {meta.flightNumber}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi-Drop Warning / Info Alert */}
                  {stops.length > 0 && (
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                      <span className="text-sm">ℹ️</span>
                      <div>
                        <span className="font-bold block">Customer Selected Multiple Drops / Intermediate Stops:</span>
                        <span className="text-[11px] text-amber-800">
                          This trip requires the driver to stop at intermediate destination(s) before reaching final drop-off.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Roof Carrier Alert */}
                  {meta.hasCarrier && (
                    <div className="p-2.5 bg-emerald-50/90 border border-emerald-300 rounded-lg text-xs text-emerald-950 flex items-start gap-2 shadow-2xs">
                      <span className="text-base">📦</span>
                      <div>
                        <span className="font-extrabold block text-emerald-900">Roof Luggage Carrier Requested:</span>
                        <span className="text-[11px] text-emerald-800">
                          Customer selected rooftop luggage carrier on cab for extra luggage capacity (Up to 45-60 kg rooftop space). Ensure assigned cab has a roof carrier.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Pet Friendly Alert */}
                  {meta.hasPet && (
                    <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-lg text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                      <span className="text-base">🐾</span>
                      <div>
                        <span className="font-extrabold block text-amber-900">Pet-Friendly Trip:</span>
                        <span className="text-[11px] text-amber-800">
                          Customer is travelling with a pet (+₹{meta.petFee || 500} pet sanitization & convenience fee applied). Please ensure the assigned vehicle is pet-friendly and inform driver.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Airport Flight Alert */}
                  {meta.flightNumber && (
                    <div className="p-2.5 bg-sky-50/90 border border-sky-300 rounded-lg text-xs text-sky-950 flex items-start gap-2 shadow-2xs">
                      <span className="text-base">✈️</span>
                      <div>
                        <span className="font-extrabold block text-sky-900">Airport Transfer Flight Details:</span>
                        <span className="text-[11px] text-sky-800">
                          Flight Number: <strong className="font-black text-sky-950">{meta.flightNumber}</strong>. Track this flight arrival/departure time to ensure timely pickup and avoid waiting charges.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Route Timeline / Stepper */}
                  <div className="space-y-3 pt-1">
                    {/* 1. Pickup */}
                    <div className="flex items-start gap-3 relative">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center text-xs font-bold text-emerald-800 shrink-0">
                          1
                        </div>
                        <div className="w-0.5 h-full min-h-[28px] bg-slate-200 my-0.5" />
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Pickup Location</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Start</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">{booking.pickupAddress}</p>
                      </div>
                    </div>

                    {/* Intermediate Stops */}
                    {stops.map((stopName, idx) => (
                      <div key={idx} className="flex items-start gap-3 relative">
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full bg-amber-100 border-2 border-amber-500 flex items-center justify-center text-xs font-extrabold text-amber-900 shrink-0">
                            {idx + 2}
                          </div>
                          <div className="w-0.5 h-full min-h-[28px] bg-slate-200 my-0.5" />
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                              Intermediate Drop #{idx + 1}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-extrabold">
                              Via Stop
                            </span>
                          </div>
                          <p className="text-xs font-bold text-amber-950 mt-0.5 bg-amber-50/50 p-1.5 rounded border border-amber-200">
                            {stopName}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Final Drop */}
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-rose-100 border-2 border-rose-500 flex items-center justify-center text-xs font-bold text-rose-800 shrink-0">
                          {stops.length + 2}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">Final Destination</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold">Dropoff</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">{booking.dropAddress}</p>
                      </div>
                    </div>
                  </div>

                  {/* Customer Additional Notes / Luggage / Passengers / Carrier / Pet / Flight / GST / Alt Email */}
                  {(meta.passengers || meta.luggage || meta.hasCarrier || meta.hasPet || meta.flightNumber || meta.gstin || meta.alternateEmail || meta.notes || meta.specialRequirements) && (
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                      {meta.passengers ? (
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block font-semibold">👥 Passengers</span>
                          <span className="font-bold text-slate-800">{meta.passengers} Persons</span>
                        </div>
                      ) : null}
                      {meta.luggage ? (
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block font-semibold">🧳 Luggage</span>
                          <span className="font-bold text-slate-800">{meta.luggage}</span>
                        </div>
                      ) : null}
                      {meta.hasCarrier ? (
                        <div className="bg-emerald-50/90 p-2.5 rounded-lg border border-emerald-300">
                          <span className="text-[10px] text-emerald-800 block font-bold">📦 Roof Carrier</span>
                          <span className="font-black text-emerald-950">✓ Requested (Rooftop)</span>
                        </div>
                      ) : null}
                      {meta.hasPet ? (
                        <div className="bg-amber-50/90 p-2.5 rounded-lg border border-amber-300">
                          <span className="text-[10px] text-amber-800 block font-bold">🐾 Pet Friendly</span>
                          <span className="font-black text-amber-950">✓ Yes (+₹{meta.petFee || 500})</span>
                        </div>
                      ) : null}
                      {meta.flightNumber ? (
                        <div className="bg-sky-50/90 p-2.5 rounded-lg border border-sky-300">
                          <span className="text-[10px] text-sky-800 block font-bold">✈️ Flight Number</span>
                          <span className="font-black text-sky-950">{meta.flightNumber}</span>
                        </div>
                      ) : null}
                      {meta.gstin ? (
                        <div className="bg-indigo-50/90 p-2.5 rounded-lg border border-indigo-300">
                          <span className="text-[10px] text-indigo-800 block font-bold">🏢 GSTIN</span>
                          <span className="font-mono font-black text-indigo-950 text-xs">{meta.gstin}</span>
                          {meta.companyName ? (
                            <span className="text-[10px] text-indigo-700 block truncate mt-0.5">{meta.companyName}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {meta.alternateEmail ? (
                        <div className="bg-sky-50/90 p-2.5 rounded-lg border border-sky-300">
                          <span className="text-[10px] text-sky-800 block font-bold">✉️ Alternate Email</span>
                          <span className="font-bold text-sky-950 truncate block text-[11px]">{meta.alternateEmail}</span>
                        </div>
                      ) : null}
                      {(meta.notes || meta.specialRequirements) ? (
                        <div className="sm:col-span-4 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block font-semibold">📝 Special Instructions / Notes</span>
                          <span className="font-medium text-slate-800">{meta.notes || meta.specialRequirements}</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Customer & Route Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Customer Info</h4>
                <p className="text-sm font-bold text-slate-900">{booking.customer?.user?.fullName}</p>
                <p className="text-xs text-slate-600 font-mono mt-0.5">{booking.customer?.user?.phone}</p>
                {booking.customer?.email && (
                  <p className="text-xs text-slate-500 mt-0.5">{booking.customer.email}</p>
                )}
                {bookingMeta.alternateEmail && (
                  <p className="text-xs text-sky-700 font-medium mt-1">
                    Alt Email: <span className="font-bold">{bookingMeta.alternateEmail}</span>
                  </p>
                )}
                {bookingMeta.gstin && (
                  <div className="mt-2 p-2 rounded-lg bg-indigo-50/80 border border-indigo-200">
                    <span className="text-[10px] uppercase font-bold text-indigo-800 block">GSTIN Details</span>
                    <p className="text-xs font-mono font-bold text-indigo-950">{bookingMeta.gstin}</p>
                    {bookingMeta.companyName ? (
                      <p className="text-[11px] text-indigo-800 font-medium">{bookingMeta.companyName}</p>
                    ) : null}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  Pickup OTP: <span className="font-mono font-bold text-amber-600">{booking.pickupOtp || 'N/A'}</span>
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-500">Assigned Driver</h4>
                  {assignedDriver && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      ⭐ 4.9 Rating
                    </span>
                  )}
                </div>
                {assignedDriver ? (
                  <>
                    <p className="text-sm font-bold text-slate-900">{assignedDriver.user.fullName}</p>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">{assignedDriver.user.phone}</p>
                    <p className="text-xs text-slate-500 mt-1">License: {assignedDriver.licenseNumber}</p>

                    {/* Customer Rating & Review for Trip if Rated */}
                    {(() => {
                      const ratingEvt = booking.tripEvents?.find(
                        (e: any) => e.type === 'TRIP_REVIEWED' || e.type === 'DRIVER_RATED'
                      );
                      const tripRating = ratingEvt?.payloadJson
                        ? (typeof ratingEvt.payloadJson === 'string'
                            ? JSON.parse(ratingEvt.payloadJson)
                            : ratingEvt.payloadJson)
                        : null;
                      if (!tripRating) return null;
                      const dRating = tripRating.driverRating || tripRating.rating || 5;
                      const kRating = tripRating.kandyRating || 5;
                      const dTags = tripRating.driverFeedbackTags || tripRating.feedbackTags || [];
                      const kTags = tripRating.kandyFeedbackTags || [];

                      return (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-800">
                              Customer Trip Review
                            </span>
                            {tripRating.ratedAt && (
                              <span className="text-[10px] text-slate-400">
                                {new Date(tripRating.ratedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* Dual Ratings: Driver & KandyCabs */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ⭐ Driver: {dRating}/5
                            </span>
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              🚕 KandyCabs: {kRating}/5
                            </span>
                          </div>

                          {/* Tags */}
                          {(dTags.length > 0 || kTags.length > 0) && (
                            <div className="flex flex-wrap gap-1">
                              {dTags.map((t: string) => (
                                <span
                                  key={t}
                                  className="text-[10px] bg-amber-50 text-amber-800 font-medium px-1.5 py-0.5 rounded border border-amber-200"
                                >
                                  {t}
                                </span>
                              ))}
                              {kTags.map((t: string) => (
                                <span
                                  key={t}
                                  className="text-[10px] bg-emerald-50 text-emerald-800 font-medium px-1.5 py-0.5 rounded border border-emerald-200"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {tripRating.comment ? (
                            <p className="text-[11px] text-slate-700 italic bg-slate-50 p-1.5 rounded border border-slate-200">
                              "{tripRating.comment}"
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not yet assigned</p>
                )}
              </div>
            </div>

            {/* Vehicle Inspection Photos (Trip Start 4 Angles) & Odometer Evidence */}
            <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-base">📸</span>
                  <h4 className="font-bold text-sky-950 text-xs uppercase tracking-wider">
                    Vehicle Inspection & Odometer Evidence (Trip Start)
                  </h4>
                </div>
                <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-md border border-sky-200">
                  {Array.isArray(booking.vehicleInspectionPhotos) && booking.vehicleInspectionPhotos.length > 0
                    ? `${booking.vehicleInspectionPhotos.filter(Boolean).length}/4 Photos Attached`
                    : 'Pending Trip Start'}
                </span>
              </div>

              {/* 4 Inspection Angles */}
              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Cab Inspection Photos (4 Angles):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Front Photo', sub: 'Bumper & Plate', idx: 0 },
                    { label: 'Rear Photo', sub: 'Tail & Boot', idx: 1 },
                    { label: 'Side Photo', sub: 'Doors & Body', idx: 2 },
                    { label: 'Inside Photo', sub: 'Interior Cabin', idx: 3 },
                  ].map((angle) => {
                    const photoUrl = Array.isArray(booking.vehicleInspectionPhotos)
                      ? booking.vehicleInspectionPhotos[angle.idx]
                      : null;
                    return (
                      <div
                        key={angle.label}
                        className="bg-white border border-slate-200 rounded-lg p-2 flex flex-col items-center text-center shadow-2xs"
                      >
                        <span className="text-[11px] font-bold text-slate-800">{angle.label}</span>
                        <span className="text-[9px] text-slate-500 mb-1.5">{angle.sub}</span>
                        {photoUrl ? (
                          <div
                            onClick={() => setPreviewImage({ url: resolveImageUrl(photoUrl), title: angle.label })}
                            className="w-full h-20 bg-slate-100 rounded border border-emerald-300 overflow-hidden cursor-pointer relative group"
                          >
                            <img
                              src={resolveImageUrl(photoUrl)}
                              alt={angle.label}
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">
                              🔍 View Full
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-20 bg-slate-100 rounded border border-dashed border-slate-300 flex flex-col items-center justify-center text-[10px] text-slate-400 p-1">
                            <span>📷</span>
                            <span>Not Captured</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Odometer Evidence Comparison */}
              <div className="pt-2 border-t border-sky-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-slate-700">Starting Odometer</span>
                    <span className="text-xs font-mono font-black text-emerald-700">
                      {booking.startingOdometer ? `${booking.startingOdometer} KM` : 'N/A'}
                    </span>
                  </div>
                  {booking.startingOdometerImagePath ? (
                    <div
                      onClick={() =>
                        setPreviewImage({
                          url: resolveImageUrl(booking.startingOdometerImagePath),
                          title: `Starting Odometer (${booking.startingOdometer || 'N/A'} KM)`,
                        })
                      }
                      className="w-full h-20 bg-slate-100 rounded border border-slate-200 overflow-hidden cursor-pointer relative group"
                    >
                      <img
                        src={resolveImageUrl(booking.startingOdometerImagePath)}
                        alt="Starting Odometer"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">
                        🔍 View Full
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-16 bg-slate-50 rounded border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                      No photo uploaded
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-2xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-slate-700">Final Odometer</span>
                    <span className="text-xs font-mono font-black text-indigo-700">
                      {booking.finalOdometer ? `${booking.finalOdometer} KM` : 'N/A'}
                    </span>
                  </div>
                  {booking.finalOdometerImagePath ? (
                    <div
                      onClick={() =>
                        setPreviewImage({
                          url: resolveImageUrl(booking.finalOdometerImagePath),
                          title: `Final Odometer (${booking.finalOdometer || 'N/A'} KM)`,
                        })
                      }
                      className="w-full h-20 bg-slate-100 rounded border border-slate-200 overflow-hidden cursor-pointer relative group"
                    >
                      <img
                        src={resolveImageUrl(booking.finalOdometerImagePath)}
                        alt="Final Odometer"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">
                        🔍 View Full
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-16 bg-slate-50 rounded border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                      No photo uploaded
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Financial Overview */}
            {(() => {
              const fMeta = getBookingMetadata(booking);
              return (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2">Fare & Invoice Breakdown</h4>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Base Estimated Total:</span>
                    <span className="font-bold text-slate-900">₹{Number(booking.estimatedFare).toFixed(2)}</span>
                  </div>
                  {fMeta.hasPet && (
                    <div className="flex justify-between text-amber-800">
                      <span>🐾 Pet Convenience Fee:</span>
                      <span className="font-bold">+₹{(fMeta.petFee || 500).toFixed(2)} (Included in Total)</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-700">
                    <span>Advance Paid (25%):</span>
                    <span className="font-bold">₹{Number(booking.advanceAmount).toFixed(2)} ({booking.advancePaymentStatus})</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Base Balance (75%):</span>
                    <span className="font-bold">₹{Number(booking.balanceAmount).toFixed(2)} ({booking.balancePaymentStatus})</span>
                  </div>
                  {(Number(booking.tollAmount || 0) > 0 || Number(booking.parkingAmount || 0) > 0) && (
                    <div className="pt-1.5 border-t border-slate-200 space-y-1">
                      {Number(booking.tollAmount || 0) > 0 && (
                        <div className="flex justify-between text-amber-700">
                          <span>🛣️ Toll Gate Charges (Driver Added):</span>
                          <span className="font-bold">+₹{Number(booking.tollAmount).toFixed(2)}</span>
                        </div>
                      )}
                      {Number(booking.parkingAmount || 0) > 0 && (
                        <div className="flex justify-between text-blue-700">
                          <span>🅿️ Parking Charges (Driver Added):</span>
                          <span className="font-bold">+₹{Number(booking.parkingAmount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-indigo-900 font-bold pt-1 border-t border-slate-200">
                        <span>Final Invoice Balance to Bill:</span>
                        <span>₹{(Number(booking.balanceAmount) + Number(booking.tollAmount || 0) + Number(booking.parkingAmount || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Driver Payment & Allowance Management */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-base">💵</span>
                  <h4 className="font-bold text-emerald-950 uppercase tracking-wider">
                    Driver Payee & Allowance Settlement
                  </h4>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-[11px] font-black border flex items-center gap-1 ${
                    driverPayStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-xs'
                      : 'bg-rose-100 text-rose-800 border-rose-300 shadow-xs'
                  }`}
                >
                  {driverPayStatus === 'PAID' ? '✓ PAID' : '✗ NOT PAID'}
                </span>
              </div>

              <p className="text-[11px] text-slate-600">
                Configure initial driver allowance (paid at trip acceptance/start) and final payee amount upon trip completion.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Driver Allowance Input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    🚗 Driver Allowance (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={driverAllowanceVal}
                    onChange={(e) => setDriverAllowanceVal(e.target.value)}
                    placeholder="e.g. 350"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[9px] text-slate-500 mt-0.5 block">Paid at trip start</span>
                </div>

                {/* Driver Final Payee Input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    💰 Driver Final Payee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={driverPayeeVal}
                    onChange={(e) => setDriverPayeeVal(e.target.value)}
                    placeholder="e.g. 1800"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[9px] text-slate-500 mt-0.5 block">Payable after completion</span>
                </div>

                {/* Settlement Status Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    💳 Payment Status
                  </label>
                  <select
                    value={driverPayStatus}
                    onChange={(e) => setDriverPayStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PAID">PAID (Settled)</option>
                  </select>
                  <span className="text-[9px] text-slate-500 mt-0.5 block">Payout state</span>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  disabled={savingDriverPay}
                  onClick={handleSaveDriverPayment}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
                >
                  {savingDriverPay ? (
                    <span>Saving...</span>
                  ) : (
                    <span>💾 Update Driver Payment</span>
                  )}
                </button>
              </div>
            </div>

            {/* Audit Log Trail */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                Audit Trail ({auditLogs.length})
              </h4>
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs">
                    <div className="flex justify-between items-center text-slate-500 text-[10px]">
                      <span className="font-bold text-slate-700">{log.action}</span>
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    {log.reason && <p className="text-slate-600 mt-1">{log.reason}</p>}
                    <p className="text-[10px] text-slate-400 mt-0.5">Actor: {log.actorUser?.fullName || log.actorUserId}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Photo Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex justify-between items-center text-white">
              <span className="font-bold text-sm">📸 {previewImage.title}</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-sm"
              >
                ✕ Close
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/60 max-h-[70vh] overflow-hidden">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
