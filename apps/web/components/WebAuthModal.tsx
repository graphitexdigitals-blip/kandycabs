'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

interface WebAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function WebAuthModal({ isOpen, onClose, onSuccess }: WebAuthModalProps) {
  const { sendOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'NAME'>('PHONE');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [existingName, setExistingName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setStep('PHONE');
    setPhone('');
    setFullName('');
    setOtp('');
    setDebugOtp(null);
    setIsRegistered(false);
    setExistingName(null);
    setErrorMsg(null);
    onClose();
  };

  // Step 1: Send OTP for mobile number
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await sendOtp(cleaned);
      if (res && res.success) {
        setIsRegistered(!!res.isRegistered);
        const name = res.existingName?.trim() || null;
        setExistingName(name);
        if (name) {
          setFullName(name);
        }
        if (res.debugOtp) {
          setDebugOtp(res.debugOtp);
          setOtp(res.debugOtp);
        }
        setStep('OTP');
      } else {
        setErrorMsg(res?.message || 'Failed to send OTP. Please try again.');
      }
    } catch {
      // Fallback debug OTP in demo/dev mode
      setDebugOtp('1234');
      setOtp('1234');
      setIsRegistered(false);
      setStep('OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.length < 4) {
      setErrorMsg('Please enter the 4-digit OTP code');
      return;
    }

    const cleaned = phone.replace(/\D/g, '');

    // If customer is already registered and name is known, verify and sign in immediately
    if (isRegistered && existingName) {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await verifyOtp(cleaned, otp, existingName);
        if (res && res.success) {
          handleClose();
          if (onSuccess) onSuccess();
        } else {
          setErrorMsg(res?.message || 'Invalid OTP code. Please retry.');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Verification failed. Try again.');
      } finally {
        setLoading(false);
      }
    } else {
      // New customer without registered name -> ask to enter full name!
      setErrorMsg(null);
      setStep('NAME');
    }
  };

  // Step 3: Enter Name for new customer
  const handleCompleteName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    const cleaned = phone.replace(/\D/g, '');

    try {
      const res = await verifyOtp(cleaned, otp, fullName.trim());
      if (res && res.success) {
        handleClose();
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(res?.message || 'Registration failed. Try again.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative border border-slate-100">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
        >
          ✕
        </button>

        {/* Modal Icon & Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-orange-50 border border-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#f0750f]">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            {step === 'PHONE'
              ? 'Sign In / Register'
              : step === 'OTP'
              ? 'Verify OTP'
              : 'Enter Your Name'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {step === 'PHONE'
              ? 'Enter your mobile number to access your rides and book cabs seamlessly.'
              : step === 'OTP'
              ? `Code sent to +91 ${phone}`
              : 'Please tell us your name to complete your registration.'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-xs font-medium border border-red-200">
            {errorMsg}
          </div>
        )}

        {debugOtp && step === 'OTP' && (
          <div className="mb-4 p-2.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-mono text-center border border-amber-200">
            Auto-fill Test OTP: <span className="font-bold tracking-widest">{debugOtp}</span>
          </div>
        )}

        {/* Step 1: PHONE ONLY */}
        {step === 'PHONE' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mobile Number *
              </label>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#f0750f]">
                <span className="bg-slate-50 px-3 py-2.5 text-sm text-slate-600 font-medium border-r border-slate-200 flex items-center">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 10-digit number"
                  className="w-full px-3 py-2.5 text-sm focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-white bg-[#f0750f] hover:bg-[#ea580c] transition-colors shadow-sm disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {loading ? 'Sending OTP...' : 'Get OTP Code →'}
            </button>
          </form>
        )}

        {/* Step 2: OTP VERIFICATION */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {/* If user is already registered, welcome them with their name */}
            {isRegistered && existingName && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <svg className="w-3 h-3 stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Welcome back, <strong className="font-bold">{existingName}</strong>!</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                4-Digit OTP Code *
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • •"
                className="w-full py-3 text-center text-2xl font-bold tracking-widest rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#f0750f]"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-white bg-[#f0750f] hover:bg-[#ea580c] transition-colors shadow-sm disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {loading
                ? 'Verifying...'
                : isRegistered && existingName
                ? 'Verify & Sign In ✓'
                : 'Verify & Continue →'}
            </button>
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep('PHONE')}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                ← Change Number
              </button>
              <button
                type="button"
                onClick={() => handleSendOtp()}
                className="text-xs text-[#f0750f] font-semibold hover:underline"
              >
                Resend Code
              </button>
            </div>
          </form>
        )}

        {/* Step 3: ENTER NAME (ONLY FOR NEW CUSTOMERS) */}
        {step === 'NAME' && (
          <form onSubmit={handleCompleteName} className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
              New customer account for <strong className="font-bold">+91 {phone}</strong>.
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#f0750f]"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-white bg-[#f0750f] hover:bg-[#ea580c] transition-colors shadow-sm disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {loading ? 'Completing Registration...' : 'Complete Registration ✓'}
            </button>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setStep('OTP')}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                ← Back to OTP
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
