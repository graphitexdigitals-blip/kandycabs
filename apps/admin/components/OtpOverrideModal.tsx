'use client';

import React, { useState } from 'react';

interface OtpOverrideModalProps {
  bookingId: string;
  bookingRef: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OtpOverrideModal({
  bookingId,
  bookingRef,
  isOpen,
  onClose,
  onSuccess,
}: OtpOverrideModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 5) {
      setError('Please provide a mandatory reason (at least 5 characters)');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/otp-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'OTP Override failed');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit override');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-fade-in">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Admin OTP Override</h3>
            <p className="text-xs text-slate-500">Booking Ref: <span className="font-semibold text-slate-800">{bookingRef}</span></p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg font-semibold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
            <strong>Audit Notice:</strong> Manual OTP override forces the trip status to <strong>TRIP_STARTED</strong>. This action is permanently logged to the immutable audit trail with your admin account credentials.
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mandatory Override Reason *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer mobile battery died, verified identity verbally."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 5}
              className="px-5 py-2 rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-700 transition disabled:opacity-50"
            >
              {submitting ? 'Applying Override...' : 'Confirm OTP Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
