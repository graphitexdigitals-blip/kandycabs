'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { UserRole } from '@kandy-cabs/shared';
import { useAuth } from '@/lib/AuthContext';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sendOtp, verifyOtp, user, isAuthenticated } = useAuth();
  
  const [phone, setPhone] = useState('9999999999');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const errParam = searchParams.get('error');
    if (errParam === 'unauthorized_role') {
      setError('Please log in with an authorized Master Admin account.');
    }
  }, [searchParams]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await sendOtp(phone);
      if (res.success) {
        setStep('OTP');
        setMessage(res.message + (res.debugOtp ? ` (Debug OTP: ${res.debugOtp})` : ''));
        if (res.debugOtp) {
          setOtp(res.debugOtp);
        }
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await verifyOtp(phone, otp);
      if (res.success) {
        if (!res.user?.roles?.includes(UserRole.ADMIN)) {
          setError('Access Denied: This account does not have ADMIN privileges.');
          return;
        }
        setMessage('Logged in successfully! Redirecting to Dashboard...');
        const redirectParam = searchParams.get('redirect');
        const target = redirectParam && redirectParam !== '/' ? redirectParam : '/bookings';
        window.location.href = target;
      } else {
        setError('Verification failed. Please check the OTP and try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <img
            src="/images/logo.png"
            alt="Kandy Cabs"
            className="h-10 w-auto object-contain"
          />
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Kandy Cabs Admin</h1>
            <p className="text-xs text-slate-500 font-medium">Fleet Operations & Dispatch Console</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 font-medium leading-relaxed">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 font-medium leading-relaxed">
            {message}
          </div>
        )}

        {step === 'PHONE' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Admin Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9999999999"
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900 font-semibold focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                Default Master Admin: <span className="font-mono font-bold text-slate-800">9999999999</span>
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-3 font-bold text-slate-950 shadow-md shadow-amber-500/20 transition duration-200 disabled:opacity-50 text-sm"
            >
              {loading ? 'Sending OTP...' : 'Send Admin OTP →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Enter 4-Digit Security OTP
              </label>
              <input
                type="text"
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="1234"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-center text-2xl tracking-[0.4em] font-mono font-black text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-3 font-bold text-slate-950 shadow-md shadow-amber-500/20 transition duration-200 disabled:opacity-50 text-sm"
            >
              {loading ? 'Verifying...' : 'Verify & Enter Console →'}
            </button>
            <button
              type="button"
              onClick={() => setStep('PHONE')}
              className="w-full text-xs font-semibold text-slate-500 hover:text-slate-800 transition pt-1 text-center block"
            >
              ← Use another phone number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm">Loading admin portal...</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}

