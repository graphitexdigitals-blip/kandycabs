'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CustomerHeader } from '@/components/CustomerHeader';
import { WebAuthModal } from '@/components/WebAuthModal';

export default function AboutPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <CustomerHeader activeNav="about" onOpenAuth={() => setAuthModalOpen(true)} />

      {/* Hero Section */}
      <section className="bg-[#162232] text-white py-12 sm:py-16 px-4">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <span className="inline-block px-3 py-1 bg-orange-500/20 text-[#f0750f] rounded-full text-xs font-bold uppercase tracking-wider border border-orange-500/30">
            About Kandy Cabs
          </span>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Safe, Reliable & Hassle-Free Rides
          </h1>
          <p className="text-slate-300 text-sm sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed">
            Karnataka’s premier intercity & local cab service — providing clean AC vehicles, transparent pricing, verified drivers, and 24/7 dedicated travel assistance.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-10 sm:py-14 space-y-12 flex-1">
        {/* Core Values / Why Choose Us */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-[#f0750f]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Safety & Verification First</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Every driver partner undergoes background checks and commercial vehicle verification. Your rides are monitored with live GPS tracking for complete peace of mind.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Transparent Pricing</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              No hidden charges, surge surprises, or last-minute cancellation penalties. All toll taxes, driver allowances, and GST rates are displayed upfront before booking.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow space-y-3">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Guaranteed On-Time Pickups</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              We understand the urgency of catching flights or reaching meetings on time. Our drivers arrive at least 15 minutes before scheduled pickup times.
            </p>
          </div>
        </div>

        {/* Our Story / Who We Are */}
        <div className="bg-white rounded-2xl p-6 sm:p-10 border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Our Mission & Commitment
          </h2>
          <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
            Founded with a vision to redefine outstation and intercity travel in South India, Kandy Cabs connects travelers between key hubs like <strong>Mangalore, Bangalore, Mysore, Udupi, Coorg, Chikmagalur, Kasaragod, and Goa</strong>.
          </p>
          <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
            Whether you need a quick airport transfer to Mangalore International Airport (IXE) or Kempegowda International Airport (BLR), a scenic family pilgrimage, or a multi-day corporate booking, our dedicated fleet of Sedans, SUVs, and Crystas ensures comfort at every mile.
          </p>
        </div>

        {/* Fleet Range */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Our Premium Fleet</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Well-maintained, clean, air-conditioned cabs for every requirement</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm text-center space-y-2">
              <span className="text-2xl">🚗</span>
              <h4 className="font-bold text-slate-900 text-base">Hatchback</h4>
              <p className="text-xs text-slate-500">WagonR, Tiago • 4 Seats • Budget-friendly</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm text-center space-y-2">
              <span className="text-2xl">🚘</span>
              <h4 className="font-bold text-slate-900 text-base">Prime Sedan</h4>
              <p className="text-xs text-slate-500">Dzire, Etios • 4 Seats • Top comfort & boot space</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm text-center space-y-2">
              <span className="text-2xl">🚙</span>
              <h4 className="font-bold text-slate-900 text-base">Family SUV</h4>
              <p className="text-xs text-slate-500">Ertiga, Rumion • 6-7 Seats • Group travel</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm text-center space-y-2">
              <span className="text-2xl">🚐</span>
              <h4 className="font-bold text-slate-900 text-base">Innova Crysta</h4>
              <p className="text-xs text-slate-500">Innova Crysta • 7 Seats • Ultimate luxury</p>
            </div>
          </div>
        </div>

        {/* Book Now Call to Action */}
        <div className="bg-[#162232] text-white rounded-2xl p-6 sm:p-10 text-center space-y-4">
          <h3 className="text-xl sm:text-3xl font-black">Ready for your journey?</h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
            Book your cab online in seconds with zero hassle and instant driver confirmation.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block bg-[#f0750f] hover:bg-[#d96509] text-white font-extrabold text-sm sm:text-base px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95"
            >
              Book a Cab Now →
            </Link>
          </div>
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
