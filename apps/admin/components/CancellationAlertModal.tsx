'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconAlert, IconCheck } from '@/components/Icons';

export interface DriverCancelRequest {
  bookingId: string;
  bookingRef: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate?: string;
  customerName: string;
  customerPhone?: string;
  pickupAddress: string;
  dropAddress: string;
  tripType: string;
  scheduledAt: string;
  reason: string;
  requestedAt: string;
}

export function CancellationAlertModal() {
  const router = useRouter();
  const [activeRequests, setActiveRequests] = useState<DriverCancelRequest[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>({});

  // Poll for active cancellation requests every 4 seconds
  useEffect(() => {
    let isMounted = true;

    const checkCancellations = async () => {
      try {
        const res = await fetch('/api/admin/cancellations/active');
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.requests)) {
          setActiveRequests(data.requests);
        }
      } catch (err) {
        // silent fallback
      }
    };

    checkCancellations();
    const interval = setInterval(checkCancellations, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const visibleRequests = activeRequests.filter((r) => !dismissedIds[r.bookingId]);

  if (visibleRequests.length === 0) {
    return null;
  }

  const current = visibleRequests[Math.min(currentIndex, visibleRequests.length - 1)];
  if (!current) return null;

  const handleAcceptCancellation = async (bId: string) => {
    if (!confirm('Accept this driver cancellation request? The driver will be unassigned and the ride will become available for re-dispatch.')) return;
    setAcceptingId(bId);
    try {
      const res = await fetch(`/api/admin/bookings/${bId}/accept-cancellation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Remove from list
        setActiveRequests((prev) => prev.filter((r) => r.bookingId !== bId));
        alert('Driver cancellation accepted successfully. The ride has been reset to DISPATCHED.');
      } else {
        alert(data.message || 'Failed to accept cancellation');
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Network error'));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDismiss = (bId: string) => {
    setDismissedIds((prev) => ({ ...prev, [bId]: true }));
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border-2 border-red-500 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white shadow-inner">
              <IconAlert className="w-5 h-5 text-white" strokeWidth={2.5} />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-wide uppercase">Driver Cancellation Request</h2>
              <p className="text-xs text-red-100">
                Action Required: Driver cannot proceed with this assigned trip
              </p>
            </div>
          </div>
          {visibleRequests.length > 1 && (
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
              {currentIndex + 1} of {visibleRequests.length}
            </span>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Reason Box */}
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                Selected Reason
              </span>
              <span className="text-[11px] font-medium text-red-500">
                {new Date(current.requestedAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-base font-bold text-red-950">
              "{current.reason}"
            </p>
          </div>

          {/* Booking & Driver Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-0.5">Booking Ref</span>
              <span className="text-sm font-black text-slate-800">{current.bookingRef}</span>
              <span className="text-xs text-slate-500 block mt-0.5 truncate">{current.pickupAddress} ➔ {current.dropAddress}</span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-0.5">Driver</span>
              <span className="text-sm font-bold text-slate-800">{current.driverName}</span>
              <span className="text-xs text-slate-500 block mt-0.5">{current.driverPhone || current.vehiclePlate || 'Assigned Driver'}</span>
            </div>
          </div>

          <div className="rounded-xl bg-amber-50/70 border border-amber-200/70 p-3 text-xs text-amber-800 flex items-start gap-2">
            <IconAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Accepting will release <strong>{current.driverName}</strong> from this ride and mark the booking ready for re-dispatch to another available driver.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleDismiss(current.bookingId)}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            Review Later
          </button>

          <div className="flex items-center gap-2">
            <Link
              href={`/bookings?search=${encodeURIComponent(current.bookingRef)}`}
              onClick={() => handleDismiss(current.bookingId)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
            >
              View in Bookings
            </Link>

            <button
              type="button"
              disabled={acceptingId === current.bookingId}
              onClick={() => handleAcceptCancellation(current.bookingId)}
              className="rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white px-5 py-2.5 text-xs font-bold tracking-wide uppercase transition shadow-md hover:shadow-lg flex items-center gap-1.5"
            >
              {acceptingId === current.bookingId ? (
                <>Processing...</>
              ) : (
                <>
                  <IconCheck className="w-4 h-4 text-white" />
                  <span>Accept Cancellation</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
