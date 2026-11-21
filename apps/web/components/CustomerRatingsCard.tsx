'use client';

import React, { useState, useEffect } from 'react';

const GOOGLE_MAPS_REVIEW_URL =
  'https://www.google.com/maps/place/Kandy+Cabs/@12.8210633,74.8382611,17z/data=!4m18!1m9!3m8!1s0x3ba35bd4b22d0263:0x6d0d06bc85a432f6!2sKandy+Cabs!8m2!3d12.8204879!4d74.8409326!9m1!1b1!16s%2Fg%2F11rxywzzz8!3m7!1s0x3ba35bd4b22d0263:0x6d0d06bc85a432f6!8m2!3d12.8204879!4d74.8409326!9m1!1b1!16s%2Fg%2F11rxywzzz8?entry=ttu&g_ep=EgoyMDI2MTExOC4xIKXMDSoASAFQAw%3D%3D';

interface Review {
  id: string;
  name: string;
  location: string;
  tag: string;
  rating: number;
  date: string;
  text: string;
  initials: string;
}

const REVIEWS: Review[] = [
  {
    id: 'rev-1',
    name: 'Karthik Hegde',
    location: 'Mangaluru',
    tag: 'Outstation Trip',
    rating: 5,
    date: 'Yesterday',
    text: 'Booked an Innova Crysta for Bangalore. The driver was 15 mins early, drove very safely through the ghats, and the car was sparkling clean. Completely transparent billing with zero hidden costs!',
    initials: 'KH',
  },
  {
    id: 'rev-2',
    name: 'Dr. Deepa Shenoy',
    location: 'Manipal',
    tag: 'Airport Transfer (IXE)',
    rating: 5,
    date: '3 days ago',
    text: 'Our midnight flight was delayed, but the driver waited patiently with a name placard. Smooth ride, sanitized AC cabin, and polite service. Hands down the best cab service in Coastal Karnataka.',
    initials: 'DS',
  },
  {
    id: 'rev-3',
    name: 'Gautham Prabhu',
    location: 'Bengaluru',
    tag: 'Temple Pilgrimage Tour',
    rating: 5,
    date: '1 week ago',
    text: 'Took family on a 3-day Kollur and Murudeshwar pilgrimage package. The driver was knowledgeable, courteous, and accommodating with elders. Top notch hospitality and fair pricing!',
    initials: 'GP',
  },
];

export function CustomerRatingsCard() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % REVIEWS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused]);

  const activeReview = REVIEWS[currentIndex];

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="flex flex-col justify-between h-full select-none relative py-1 px-1 lg:px-2"
    >
      {/* Top Header: Trust Badge & Overall Rating */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#f0750f] flex items-center justify-center flex-shrink-0 font-bold text-sm">
            ★
          </div>
          <div>
            <h4 className="text-xs lg:text-sm font-extrabold text-slate-900 leading-tight">
              Customer Ratings & Reviews
            </h4>
            <p className="text-[10px] text-slate-500 font-medium">
              Verified by 15,400+ Happy Travelers
            </p>
          </div>
        </div>

        {/* Rating Pill linking directly to Google Reviews */}
        <a
          href={GOOGLE_MAPS_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Rate Kandy Cabs on Google Maps"
          className="flex items-center gap-1.5 bg-orange-50/90 hover:bg-orange-100 border border-orange-200/80 px-2.5 py-1 rounded-full flex-shrink-0 transition-all group cursor-pointer hover:shadow-xs"
        >
          <span className="text-xs font-black text-[#f0750f]">4.9</span>
          <div className="flex text-amber-400 text-xs tracking-tight">
            {'★★★★★'}
          </div>
          <svg
            className="w-3 h-3 text-[#f0750f]/80 group-hover:text-[#f0750f] transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>

      {/* Middle Body: Active Testimonial Quote */}
      <div className="py-2.5 flex-1 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-slate-200">
              {activeReview.initials}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-extrabold text-slate-800 truncate block">
                {activeReview.name}
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                {activeReview.location}
              </span>
            </div>
          </div>

          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
            ✓ {activeReview.tag}
          </span>
        </div>

        <p className="text-[11px] lg:text-xs font-medium text-slate-600 leading-relaxed italic line-clamp-3">
          &ldquo;{activeReview.text}&rdquo;
        </p>

        {/* Rating Actions Bar */}
        <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200/70 flex items-center justify-between gap-2">
          <a
            href={GOOGLE_MAPS_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0750f] hover:bg-[#ea580c] text-white text-[11px] font-bold shadow-xs active:scale-95 transition-all group"
          >
            {/* Google G logo */}
            <svg className="w-3.5 h-3.5 bg-white rounded-full p-0.5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.24v3.15C3.26 21.36 7.33 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.59H1.24C.45 8.16 0 9.97 0 12c0 2.03.45 3.84 1.24 5.41l4.04-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.59l4.04 3.15c.95-2.84 3.6-4.99 6.72-4.99z" />
            </svg>
            <span>Rate Us on Google</span>
            <span className="text-amber-200">★★★★★</span>
          </a>

          <a
            href={GOOGLE_MAPS_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10.5px] font-bold text-slate-500 hover:text-[#f0750f] transition-colors inline-flex items-center gap-1 group"
          >
            <span>All Google Reviews</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </a>
        </div>
      </div>

      {/* Bottom Footer: Trust Pillars & Carousel Dots */}
      <div className="border-t border-slate-200/80 pt-2.5 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-slate-600">
            <svg className="w-3 h-3 text-[#f0750f]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Verified Drivers
          </span>
          <span className="inline-flex items-center gap-1 text-slate-600">
            <svg className="w-3 h-3 text-[#f0750f]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Zero Surge Cost
          </span>
          <span className="inline-flex items-center gap-1 text-slate-600">
            <svg className="w-3 h-3 text-[#f0750f]" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Clean & Sanitized
          </span>
        </div>

        {/* Dots */}
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {REVIEWS.map((rev, idx) => (
            <button
              key={rev.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all ${currentIndex === idx ? 'w-4 bg-[#f0750f]' : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                }`}
              aria-label={`Go to review ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
