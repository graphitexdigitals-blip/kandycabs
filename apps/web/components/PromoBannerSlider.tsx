'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';

export interface PromoSlide {
  id: string;
  image: string;
  alt: string;
  title?: string;
  category?: 'ONEWAY' | 'ROUND' | 'AIRPORT' | 'LOCAL' | 'CORPORATE' | 'TOUR';
  linkUrl?: string;
}

const DEFAULT_SLIDES: PromoSlide[] = [
  {
    id: 'banner-ev-cab',
    image: '/images/banner-ev-cab.jpg',
    alt: 'Coming Soon EV Cab Service - Smart Rides Happy Rides',
    title: 'EV Cab Service',
    category: 'LOCAL',
  },
  {
    id: 'banner-airport',
    image: '/images/banner-airport.jpg',
    alt: 'Airport Transfers - Mangaluru & Bengaluru Airports',
    title: 'Airport Transfers',
    category: 'AIRPORT',
  },
  {
    id: 'banner-coorg',
    image: '/images/banner-coorg.jpg',
    alt: 'Scenic Coorg & Western Ghats Tours - Unmatched Comfort',
    title: 'Scenic Tours',
    category: 'TOUR',
  },
  {
    id: 'banner-coastal-highway',
    image: '/images/banner-coastal-highway.jpg',
    alt: 'Coastal Highway Drives - Mangaluru, Udupi & Coastal Karnataka',
    title: 'Coastal Drives',
    category: 'ROUND',
  },
  {
    id: 'banner-pilgrimage',
    image: '/images/banner-pilgrimage.jpg',
    alt: 'Temple & Pilgrimage Special - Dharmasthala, Kukke Subrahmanya & Kollur',
    title: 'Pilgrimage Special',
    category: 'TOUR',
  },
];

interface PromoBannerSliderProps {
  onSelectCategory?: (category: string) => void;
  className?: string;
}

export function PromoBannerSlider({ onSelectCategory, className = '' }: PromoBannerSliderProps) {
  const [slides, setSlides] = useState<PromoSlide[]>(DEFAULT_SLIDES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Attempt dynamic load from backend/API if available
  useEffect(() => {
    let isMounted = true;
    async function loadDynamicBanners() {
      try {
        const res = await fetch('/api/banners', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data && Array.isArray(data.banners) && data.banners.length > 0) {
          const activeBanners = data.banners
            .filter((b: any) => b.isActive !== false)
            .map((b: any) => ({
              id: b.id || `banner-${Math.random()}`,
              image: b.image?.startsWith('/') ? b.image : `/images/${b.image}`,
              alt: b.tagline || b.subTagline || 'Kandy Cabs Special Promotion',
              title: b.tagline,
              category: b.category,
              linkUrl: b.linkUrl,
            }));

          if (activeBanners.length > 0) {
            setSlides(activeBanners);
          }
        }
      } catch {
        // Fallback to DEFAULT_SLIDES
      }
    }
    loadDynamicBanners();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalSlides = slides.length;

  const nextSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const goToSlide = (idx: number) => {
    setCurrentIndex(idx);
    pauseAndResumeAfterDelay();
  };

  const pauseAndResumeAfterDelay = (delayMs: number = 5000) => {
    setIsPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      setIsPaused(false);
    }, delayMs);
  };

  // Auto-advance slider
  useEffect(() => {
    if (isPaused || totalSlides <= 1) return;
    const interval = setInterval(() => {
      nextSlide();
    }, 4500);

    return () => clearInterval(interval);
  }, [isPaused, totalSlides, nextSlide]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  // Touch Swipe Handlers for mobile & tablet
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
    touchEndXRef.current = null;
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current !== null && touchEndXRef.current !== null) {
      const deltaX = touchStartXRef.current - touchEndXRef.current;
      const swipeThreshold = 40; // minimum px for gesture

      if (deltaX > swipeThreshold) {
        nextSlide();
      } else if (deltaX < -swipeThreshold) {
        prevSlide();
      }
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
    pauseAndResumeAfterDelay(4000);
  };

  // Slide click handler
  const handleSlideClick = (slide: PromoSlide) => {
    if (slide.linkUrl && slide.linkUrl.trim()) {
      let target = slide.linkUrl.trim();
      if (!/^https?:\/\//i.test(target) && !/^(tel|mailto|whatsapp):/i.test(target)) {
        target = 'https://' + target;
      }
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }

    if (slide.id === 'banner-ev-cab') {
      setInfoNotice('⚡ Kandy Cabs EV Fleet is launching soon! Book CNG or Diesel rides today.');
      setTimeout(() => setInfoNotice(null), 3500);
    }

    if (slide.category && onSelectCategory) {
      onSelectCategory(slide.category);
      // Smooth scroll to booking section
      const bookingSection = document.getElementById('booking-card') || document.querySelector('form');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <section
      className={`relative group rounded-2xl sm:rounded-3xl overflow-hidden shadow-md border border-slate-100 aspect-[2.4/1] w-full select-none bg-slate-900 ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-roledescription="carousel"
      aria-label="Promotions and Featured Offers"
    >
      {/* Slides Container with Smooth CSS Transform */}
      <div
        className="flex w-full h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {slides.map((slide, idx) => (
          <div
            key={slide.id || idx}
            onClick={() => handleSlideClick(slide)}
            className="min-w-full h-full relative aspect-[2.4/1] w-full flex-shrink-0 cursor-pointer overflow-hidden"
            role="group"
            aria-roledescription="slide"
            aria-label={`${idx + 1} of ${totalSlides}: ${slide.title || slide.alt}`}
          >
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              className="object-cover"
              priority={idx === 0}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 800px"
            />
          </div>
        ))}
      </div>

      {/* Floating Info Notification (e.g. for EV coming soon) */}
      {infoNotice && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white text-[11px] sm:text-xs font-semibold backdrop-blur-md shadow-lg border border-white/20 animate-fade-in flex items-center gap-1.5">
          <span>{infoNotice}</span>
        </div>
      )}

      {/* Navigation Arrows (Visible only on desktop on hover, hidden on mobile and tablet) */}
      {totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
              pauseAndResumeAfterDelay();
            }}
            className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-sm transition-all duration-200 opacity-0 group-hover:opacity-100 active:scale-90 shadow-md"
            aria-label="Previous slide"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
              pauseAndResumeAfterDelay();
            }}
            className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-sm transition-all duration-200 opacity-0 group-hover:opacity-100 active:scale-90 shadow-md"
            aria-label="Next slide"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </section>
  );
}
