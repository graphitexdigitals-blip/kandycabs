'use client';

import React, { useState, useEffect } from 'react';

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
      className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-md p-4 lg:p-5 flex flex-col justify-between h-full select-none relative overflow-hidden"
    >
      {/* Background Decorative Accent */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-orange-50/60 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header: Trust Badge & Overall Rating */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
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

        <div className="flex items-center gap-1.5 bg-orange-50/90 border border-orange-100 px-2.5 py-1 rounded-full flex-shrink-0">
          <span className="text-xs font-black text-[#f0750f]">4.9</span>
          <div className="flex text-amber-400 text-xs tracking-tight">
            {'★★★★★'}
          </div>
        </div>
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
      </div>

      {/* Bottom Footer: Trust Pillars & Carousel Dots */}
      <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
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
              className={`h-1.5 rounded-full transition-all ${
                currentIndex === idx ? 'w-4 bg-[#f0750f]' : 'w-1.5 bg-slate-200 hover:bg-slate-300'
              }`}
              aria-label={`Go to review ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
