'use client';

import React, { useState } from 'react';
import { evaluateCancellationCharge } from '@kandy-cabs/shared';

interface CancelBookingModalProps {
  bookingId: string | null;
  bookingRef: string;
  scheduledAt: string;
  category?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelBookingModal({
  bookingId,
  bookingRef,
  scheduledAt,
  category = 'SEDAN',
  isOpen,
  onClose,
  onSuccess,
}: CancelBookingModalProps) {
  const [reason, setReason] = useState('Change of plans');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !bookingId) return null;

  const evalResult = evaluateCancellationCharge(scheduledAt, category, new Date());
  const isWithin3h = evalResult.isWithinWindow;
  const cancellationFee = evalResult.applicableFeeIfCancelled;

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/customer/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, reason }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to cancel booking');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel booking');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-fade-in text-slate-800">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Cancel Booking</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleCancel} className="mt-4 space-y-4 text-xs">
          <p className="text-slate-600">
            Are you sure you want to cancel booking <strong className="text-slate-900">{bookingRef}</strong>?
          </p>

          {isWithin3h ? (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <span>⚠️ Cancellation Charge Policy Applies</span>
              </div>
              <p className="text-[11px] text-amber-800">
                This trip is scheduled within 3 hours ({evalResult.hoursUntilPickup}h left). According to policy, a cancellation fee of <strong>₹{cancellationFee}</strong> applies for {category} and will be deducted from your advance.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <span>✅ Free Cancellation Eligible</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                You are cancelling {evalResult.hoursUntilPickup} hours before pickup (more than 3 hours). Full advance payment will be refunded to your original source.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 rounded-xl text-red-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Cancellation</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:ring-2 focus:ring-amber-500"
            >
              <option value="Change of plans">Change of plans</option>
              <option value="Booked another cab">Booked another cab</option>
              <option value="Flight/Train rescheduled">Flight/Train rescheduled</option>
              <option value="Price/timing issue">Price/timing issue</option>
              <option value="Other">Other reason</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
            >
              Keep Booking
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition disabled:opacity-50"
            >
              {submitting ? 'Cancelling...' : isWithin3h ? `Confirm & Pay ₹${cancellationFee} Fee` : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
