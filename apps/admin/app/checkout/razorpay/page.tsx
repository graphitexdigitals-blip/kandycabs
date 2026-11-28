'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    Razorpay: any;
    ReactNativeWebView?: {
      postMessage: (data: string) => void;
    };
  }
}

function RazorpayCheckoutContent() {
  const searchParams = useSearchParams();

  const orderId = searchParams.get('orderId') || '';
  const amountStr = searchParams.get('amount') || '0';
  const amount = Number(amountStr) || 0;
  const keyId = searchParams.get('keyId') || 'rzp_test_U3IkpH9yGG0oyk';
  const bookingId = searchParams.get('bookingId') || '';
  const bookingRef = searchParams.get('ref') || bookingId || 'Kandy Cabs Ride';
  const name = searchParams.get('name') || 'Valued Customer';
  const phone = searchParams.get('phone') || '';
  const email = searchParams.get('email') || '';

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentData, setPaymentData] = useState<{ paymentId?: string; orderId?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const rzpInstanceRef = useRef<any>(null);
  const hasAutoOpenedRef = useRef(false);

  // 1. Load Razorpay Checkout SDK Script with readiness check
  useEffect(() => {
    let checkTimer: any = null;
    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript && (window as any).Razorpay) {
      setScriptLoaded(true);
      return;
    }

    const checkReady = () => {
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        setScriptLoaded(true);
        if (checkTimer) clearInterval(checkTimer);
      }
    };

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        checkTimer = setInterval(checkReady, 50);
        setTimeout(checkReady, 0);
      };
      script.onerror = () => {
        setErrorMsg('Failed to load Razorpay payment gateway. Please check your internet connection and refresh.');
        setLoading(false);
      };
      document.body.appendChild(script);
    } else {
      checkTimer = setInterval(checkReady, 100);
    }

    return () => {
      if (checkTimer) clearInterval(checkTimer);
    };
  }, []);

  // 2. Open Razorpay Modal once script is ready
  const openRazorpayCheckout = () => {
    if (typeof window === 'undefined' || !window.Razorpay) {
      setLoading(false);
      setErrorMsg('Razorpay SDK is initializing. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const amountInPaise = Math.round(amount * 100);

    const isRealOrderId = orderId.startsWith('order_') && !orderId.includes('mock') && !orderId.includes('app');
    const options: any = {
      key: keyId,
      amount: amountInPaise,
      currency: 'INR',
      name: 'KANDY CABS',
      description: `Advance Payment for ${bookingRef}`,
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      order_id: isRealOrderId ? orderId : undefined,
      redirect: true,
      callback_url: `/api/payments/verify?bookingId=${bookingId}`,
      prefill: {
        name: name,
        contact: phone,
        email: email || undefined,
      },
      notes: {
        bookingId: bookingId,
        bookingRef: bookingRef,
      },
      theme: {
        color: '#ffffff',
        hide_topbar: true,
      },
      modal: {
        ondismiss: function () {
          setLoading(false);
          if (typeof window !== 'undefined' && window.ReactNativeWebView) {
            try {
              window.ReactNativeWebView.postMessage(
                JSON.stringify({ type: 'PAYMENT_CANCELLED' })
              );
            } catch (_) {}
          }
        },
      },
      handler: async function (response: any) {
        setLoading(true);
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = response;
        setPaymentData({ paymentId: razorpay_payment_id, orderId: razorpay_order_id });

        try {
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingId,
              razorpay_order_id: razorpay_order_id || orderId,
              razorpay_payment_id,
              razorpay_signature,
              paymentMethod: 'RAZORPAY',
            }),
          });

          const verifyJson = await verifyRes.json();
          if (verifyRes.ok && verifyJson.success) {
            setPaymentSuccess(true);
            setLoading(false);

            // Notify embedded React Native WebView immediately
            if (typeof window !== 'undefined' && window.ReactNativeWebView) {
              try {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({
                    type: 'PAYMENT_SUCCESS',
                    bookingId,
                    paymentId: razorpay_payment_id,
                    orderId: razorpay_order_id,
                  })
                );
              } catch (_) {}
            }

            // Attempt redirect to deep link after short delay
            setTimeout(() => {
              const appDeepLink = `kandycabscustomer://booking-confirmed?bookingId=${bookingId}&paymentId=${razorpay_payment_id}`;
              window.location.href = appDeepLink;
            }, 1200);
          } else {
            setErrorMsg(verifyJson.message || 'Payment verification encountered an issue. Please contact support.');
            setLoading(false);
          }
        } catch (e: any) {
          setErrorMsg(e.message || 'Network error verifying payment.');
          setLoading(false);
        }
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzpInstanceRef.current = rzp;
      rzp.on('payment.failed', function (resp: any) {
        setErrorMsg(resp.error?.description || 'Payment failed or was declined by bank.');
        setLoading(false);
      });
      rzp.open();
      setLoading(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not launch Razorpay checkout modal.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scriptLoaded && !hasAutoOpenedRef.current && amount > 0) {
      hasAutoOpenedRef.current = true;
      openRazorpayCheckout();
    }
  }, [scriptLoaded, amount]);

  const appDeepLink = `kandycabscustomer://booking-confirmed?bookingId=${bookingId}&paymentId=${paymentData?.paymentId || ''}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-neutral-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl">🚖</span>
          <span className="text-2xl font-black tracking-tight text-white">
            KANDY <span className="text-[#f0750f]">CABS</span>
          </span>
        </div>

        {/* Success View */}
        {paymentSuccess ? (
          <div className="space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-4xl text-emerald-400">
              ✓
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-white">Payment Received!</h2>
              <p className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">
                Transaction Confirmed via Razorpay
              </p>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Booking Reference:</span>
                <span className="font-bold text-white">{bookingRef}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Amount Paid:</span>
                <span className="font-extrabold text-emerald-400 text-sm">₹{amount.toLocaleString('en-IN')}</span>
              </div>
              {paymentData?.paymentId && (
                <div className="flex justify-between text-slate-400 font-mono text-[11px]">
                  <span>Payment ID:</span>
                  <span className="text-slate-300">{paymentData.paymentId}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <a
                href={appDeepLink}
                className="block w-full py-3.5 px-4 bg-[#f0750f] hover:bg-orange-500 active:scale-95 text-white font-extrabold text-sm rounded-xl shadow-lg transition duration-150"
              >
                Open Kandy Cabs App
              </a>
              <p className="text-[11px] text-slate-500">
                You can safely close this browser window once you return to the app.
              </p>
            </div>
          </div>
        ) : (
          /* Payment In Progress / Launch Checkout View */
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-[11px] font-bold text-orange-400">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                Razorpay Secure 256-bit SSL Checkout
              </div>
              <h2 className="text-xl font-black text-white">Confirm Your Cab Reservation</h2>
              <p className="text-xs text-slate-400">
                Complete the advance payment to lock your cab and driver dispatch.
              </p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Booking:</span>
                <span className="font-bold text-white">{bookingRef}</span>
              </div>
              {name && (
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Passenger:</span>
                  <span className="text-slate-200">{name}</span>
                </div>
              )}
              <div className="border-t border-slate-800/80 pt-2 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">Amount to Pay:</span>
                <span className="text-2xl font-black text-[#f0750f]">
                  ₹{amount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 text-left">
                ⚠️ {errorMsg}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={openRazorpayCheckout}
                disabled={loading}
                className="w-full py-4 px-4 bg-[#f0750f] hover:bg-orange-500 active:scale-95 text-white font-extrabold text-sm rounded-xl shadow-lg transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <span>Connecting to Razorpay...</span>
                ) : (
                  <>
                    <span>Pay ₹{amount.toLocaleString('en-IN')} with Razorpay</span>
                    <span className="text-lg">➔</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <span>Supports:</span>
                <span className="font-semibold text-slate-300">UPI (GPay / PhonePe / Paytm)</span>
                <span>•</span>
                <span className="font-semibold text-slate-300">Cards</span>
                <span>•</span>
                <span className="font-semibold text-slate-300">NetBanking</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60">
              <a
                href={appDeepLink}
                onClick={(e) => {
                  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
                    e.preventDefault();
                    try {
                      window.ReactNativeWebView.postMessage(
                        JSON.stringify({ type: 'CLOSE_CHECKOUT' })
                      );
                    } catch (_) {}
                  }
                }}
                className="text-xs text-slate-400 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                Cancel and return to Kandy Cabs
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-[11px] text-slate-500 flex items-center gap-2">
        <span>🔒 Powered by Razorpay Payment Gateway</span>
        <span>•</span>
        <span>Kandy Cabs Secure Checkout</span>
      </div>
    </div>
  );
}

export default function RazorpayCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <p className="text-sm font-semibold">Loading Razorpay checkout...</p>
        </div>
      }
    >
      <RazorpayCheckoutContent />
    </Suspense>
  );
}
