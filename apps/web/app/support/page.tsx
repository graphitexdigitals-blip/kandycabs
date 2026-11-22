'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CustomerHeader } from '@/components/CustomerHeader';
import { WebAuthModal } from '@/components/WebAuthModal';

const FAQS = [
  {
    q: 'How do I book an outstation or local cab?',
    a: 'You can book directly from the homepage by selecting your trip type (Oneway, Round Trip, Local Rental, Airport, etc.), choosing your pickup and drop locations, selecting your vehicle, and completing the instant reservation.'
  },
  {
    q: 'Are tolls, state permits, and driver allowance included?',
    a: 'Yes, our fare calculator transparently breaks down the estimated fare, driver allowance, GST, and advance amount before you confirm. Any state entry taxes or parking fees will be clearly documented on your digital invoice.'
  },
  {
    q: 'Can I cancel or reschedule my ride?',
    a: 'Yes! You can manage or cancel your ride directly under "My Bookings". Cancellations made at least 2 hours before the scheduled pickup time are eligible for immediate refunds as per our standard cancellation policy.'
  },
  {
    q: 'How will I receive my driver and vehicle details?',
    a: 'Once a driver partner is dispatched for your ride, you will receive an SMS and WhatsApp update with driver details, car registration number, and live tracking.'
  },
  {
    q: 'What if my flight or train is delayed?',
    a: 'For airport and railway station pickups, our drivers monitor flight and train arrival timings. Free waiting time is provided for scheduled airport pickups.'
  }
];

export default function SupportPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <CustomerHeader activeNav="support" onOpenAuth={() => setAuthModalOpen(true)} />

      {/* Hero Section */}
      <section className="bg-[#162232] text-white py-12 sm:py-16 px-4">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-500/30">
            24/7 Dedicated Support
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            How can we help you today?
          </h1>
          <p className="text-slate-300 text-sm sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed">
            Our support desk is operational 24 hours a day, 7 days a week. Reach out for ride assistance, booking modifications, corporate queries, or billing help.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-10 sm:py-14 space-y-12 flex-1">
        {/* Direct Channels Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Phone */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Phone Support</h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Speak directly with our travel desk for immediate ride bookings or emergency assistance.
              </p>
            </div>
            <a
              href="tel:+919481086058"
              className="w-full bg-[#162232] hover:bg-slate-800 text-white font-bold text-xs sm:text-sm py-2.5 rounded-xl text-center transition-colors block"
            >
              Call +91 9481086058
            </a>
          </div>

          {/* WhatsApp */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm5.78 14.07c-.24.68-1.39 1.3-1.92 1.38-.49.08-1.12.11-3.6-0.89-3.17-1.28-5.21-4.49-5.37-4.7-.16-.21-1.29-1.72-1.29-3.28 0-1.56.81-2.33 1.1-2.65.29-.32.64-.4.85-.4.21 0 .43 0 .61.01.2.01.46-.07.72.55.27.64.92 2.25.99 2.42.08.17.13.37.02.59-.11.22-.16.36-.32.55-.16.19-.34.42-.49.56-.16.16-.33.34-.14.66.19.32.84 1.38 1.8 2.24 1.24 1.11 2.29 1.45 2.61 1.61.32.16.51.13.7-.08.19-.21.8-0.93 1.01-1.25.21-.32.43-.27.72-.16.29.11 1.86.88 2.18 1.04.32.16.54.24.62.37.08.13.08.77-.16 1.45z"/>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">WhatsApp Chat</h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Quick updates, sharing live location, sending pickup landmarks, and invoice copies.
              </p>
            </div>
            <a
              href="https://wa.me/919481086058?text=Hello%20Kandy%20Cabs,%20I%20need%20assistance%20with%20my%20booking"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs sm:text-sm py-2.5 rounded-xl text-center transition-colors block"
            >
              Chat on WhatsApp
            </a>
          </div>

          {/* Email */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Email Support</h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Corporate tie-ups, GST invoice inquiries, customer grievances, or feedback.
              </p>
            </div>
            <a
              href="mailto:kandycabsmlr@gmail.com"
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm py-2.5 rounded-xl text-center transition-colors block"
            >
              kandycabsmlr@gmail.com
            </a>
          </div>
        </div>

        {/* FAQs Section */}
        <div className="bg-white rounded-2xl p-6 sm:p-10 border border-slate-100 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Quick answers to common questions about booking and rides</p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="border border-slate-100 rounded-xl overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between text-left font-bold text-sm sm:text-base text-slate-900 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="text-slate-400 text-lg ml-2">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-5 py-3 text-xs sm:text-sm text-slate-600 bg-white leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Need to manage rides? */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg sm:text-xl font-bold">Have an active booking?</h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Track your cab, view OTP, or download tax invoices in My Bookings.</p>
          </div>
          <Link
            href="/customer/dashboard"
            className="bg-[#f0750f] hover:bg-[#d96509] text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl whitespace-nowrap transition-all shadow-md active:scale-95"
          >
            Go to My Bookings →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Kandy Cabs. Safe | Reliable | Hassle-Free. All rights reserved.</p>
        <p className="mt-1">Website: www.kandycabs.in • Email: kandycabsmlr@gmail.com • Contact: +91 9481086058</p>
      </footer>

      {/* Web Auth Modal */}
      <WebAuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
