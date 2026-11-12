'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AdminNavbar } from '@/components/AdminNavbar';

export const dynamic = 'force-dynamic';

interface BannerItem {
  id: string;
  badge?: string;
  tagline?: string;
  subTagline?: string;
  image: string;
  btnText: string;
  category?: 'ONEWAY' | 'ROUND' | 'AIRPORT' | 'LOCAL' | 'CORPORATE' | 'TOUR';
  bannerType?: 'APP_BANNER' | 'PROMO_GRAPHIC';
  showTextOverlay?: boolean;
  showCtaButton?: boolean;
  linkUrl?: string;
  isActive: boolean;
  order: number;
  createdAt?: string;
}

const CATEGORY_OPTIONS: { id: NonNullable<BannerItem['category']>; label: string; icon: string }[] = [
  { id: 'ONEWAY', label: 'One-Way Drop', icon: '' },
  { id: 'ROUND', label: 'Round Trip', icon: '' },
  { id: 'AIRPORT', label: 'Airport Transfer', icon: '' },
  { id: 'LOCAL', label: 'Local Rental', icon: '' },
  { id: 'CORPORATE', label: 'Corporate Travel', icon: '' },
  { id: 'TOUR', label: 'Tour & Pilgrimage', icon: '' },
];

const PRESET_TEMPLATES = [
  {
    tagline: 'Coastal Karnataka Temple Tours',
    btnText: 'Explore Tours',
    category: 'TOUR' as const,
    bannerType: 'PROMO_GRAPHIC' as const,
    showTextOverlay: false,
    showCtaButton: true,
    linkUrl: '',
    image: 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1200&auto=format&fit=crop&q=80',
  },
  {
    tagline: 'Force Urbania & Tempo Traveller',
    btnText: 'Book Urbania',
    category: 'TOUR' as const,
    bannerType: 'PROMO_GRAPHIC' as const,
    showTextOverlay: false,
    showCtaButton: true,
    linkUrl: '',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&auto=format&fit=crop&q=80',
  },
  {
    tagline: 'Mangaluru & Bengaluru Direct Drops',
    btnText: 'Book Airport Cab',
    category: 'AIRPORT' as const,
    bannerType: 'PROMO_GRAPHIC' as const,
    showTextOverlay: false,
    showCtaButton: true,
    linkUrl: '',
    image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&auto=format&fit=crop&q=80',
  },
  {
    tagline: 'Festive Season Discounts',
    btnText: 'Claim Offer',
    category: 'ONEWAY' as const,
    bannerType: 'PROMO_GRAPHIC' as const,
    showTextOverlay: false,
    showCtaButton: true,
    linkUrl: 'https://kandycabs.com/offers',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
  },
];

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Partial<BannerItem> | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [previewIndex, setPreviewIndex] = useState(0);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/banners');
      if (res.ok) {
        const data = await res.json();
        setBanners(data.banners || []);
      }
    } catch (err) {
      console.error('Failed to load banners:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleOpenAddModal = (template?: typeof PRESET_TEMPLATES[0]) => {
    if (template) {
      setEditingBanner({
        tagline: template.tagline,
        btnText: template.btnText,
        category: template.category,
        bannerType: 'PROMO_GRAPHIC',
        showTextOverlay: false,
        showCtaButton: template.showCtaButton ?? true,
        linkUrl: template.linkUrl || '',
        image: template.image,
        isActive: true,
        order: banners.length + 1,
      });
      setImageInputMode('url');
    } else {
      setEditingBanner({
        tagline: '',
        btnText: 'Book Now',
        category: 'ONEWAY',
        bannerType: 'PROMO_GRAPHIC',
        showTextOverlay: false,
        showCtaButton: true,
        linkUrl: '',
        image: '',
        isActive: true,
        order: banners.length + 1,
      });
      setImageInputMode('upload');
    }
    setShowModal(true);
  };

  const handleOpenEditModal = (banner: BannerItem) => {
    setEditingBanner({
      ...banner,
      bannerType: 'PROMO_GRAPHIC',
      showTextOverlay: false,
      showCtaButton: banner.showCtaButton !== undefined ? banner.showCtaButton : Boolean(banner.btnText),
      linkUrl: banner.linkUrl || '',
    });
    setImageInputMode(banner.image.startsWith('data:') ? 'upload' : 'url');
    setShowModal(true);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      alert('File size exceeds 4MB. Please choose an image smaller than 4MB (Recommended: < 500KB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Data = uploadEvent.target?.result as string;
      setEditingBanner((prev) => (prev ? { ...prev, image: base64Data } : null));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner?.image?.trim()) {
      alert('Please upload an image or provide an image URL.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...editingBanner,
        bannerType: 'PROMO_GRAPHIC',
        showTextOverlay: false,
      };

      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingBanner(null);
        await fetchBanners();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to save banner.');
      }
    } catch (err) {
      console.error('Error saving banner:', err);
      alert('Network error while saving banner.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotional banner?')) return;

    try {
      const res = await fetch(`/api/admin/banners?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchBanners();
      } else {
        alert('Failed to delete banner.');
      }
    } catch (err) {
      console.error('Error deleting banner:', err);
      alert('Network error while deleting banner.');
    }
  };

  const handleToggleActive = async (banner: BannerItem) => {
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...banner, isActive: !banner.isActive }),
      });
      if (res.ok) {
        await fetchBanners();
      }
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const activeBanners = banners.filter((b) => b.isActive);
  const currentSimBanner = activeBanners[previewIndex];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-3 sm:space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Promotional & Carousel Banners
            </h1>
          </div>

          <div className="flex items-center shrink-0">
            <button
              onClick={() => handleOpenAddModal()}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 sm:px-5 sm:py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold rounded-xl transition shadow-sm hover:shadow active:scale-95"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add New Banner</span>
            </button>
          </div>
        </div>

        {/* IMAGE SIZE & SPECIFICATIONS GUIDE BOX */}
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/60 border border-amber-300/80 rounded-2xl p-3 sm:p-4 shadow-sm space-y-2 sm:space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Image Dimensions & Banner Types Guide
              </h2>
            </div>
            <span className="text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full uppercase tracking-wider shrink-0">
              Important Standard
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
            Upload clean <strong>Promotional Graphic Posters & Flyers</strong> (full-bleed artwork with optional custom action button and direct redirect link).
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {/* 1. Dimensions */}
            <div className="bg-white/95 backdrop-blur rounded-xl p-2.5 sm:p-3 border border-amber-200/80 shadow-2xs">
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                Dimensions
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                1200 × 600 px
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                (2:1 Ratio, min 800×400)
              </div>
            </div>

            {/* 2. Aspect Ratio */}
            <div className="bg-white/95 backdrop-blur rounded-xl p-2.5 sm:p-3 border border-amber-200/80 shadow-2xs">
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                Aspect Ratio
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                2:1 or 16:9
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Avoid 1:1 or 9:16
              </div>
            </div>

            {/* 3. File Size & Format */}
            <div className="bg-white/95 backdrop-blur rounded-xl p-2.5 sm:p-3 border border-amber-200/80 shadow-2xs">
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                Format & Size
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                WebP, JPG, PNG
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Max 4 MB (&lt; 500 KB best)
              </div>
            </div>

            {/* 4. Click Action */}
            <div className="bg-white/95 backdrop-blur rounded-xl p-2.5 sm:p-3 border border-amber-200/80 shadow-2xs">
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                Click Action
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                CTA Button or Link
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Direct link or booking
              </div>
            </div>
          </div>
        </div>

        {/* LIVE APP CAROUSEL SIMULATOR */}
        {activeBanners.length > 0 && currentSimBanner && (
          <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 sm:space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Live Mobile App Simulator Preview
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Showing how customer sees active carousel banner #{previewIndex + 1} of {activeBanners.length}
                </p>
              </div>

              {/* Slider Dots / Controls */}
              <div className="flex items-center space-x-1.5 self-start sm:self-auto">
                {activeBanners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPreviewIndex(idx)}
                    className={`h-2 sm:h-2.5 rounded-full transition-all duration-300 ${
                      previewIndex === idx ? 'w-6 sm:w-8 bg-amber-500' : 'w-2 sm:w-2.5 bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Simulated Banner Card */}
            <div className="relative w-full max-w-2xl mx-auto h-44 sm:h-60 rounded-xl sm:rounded-2xl overflow-hidden shadow-md border border-slate-300 group bg-slate-100">
              <img
                src={currentSimBanner.image}
                alt={currentSimBanner.tagline || 'Promotional Banner'}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
              />

              {/* PROMOTIONAL POSTER OVERLAY (CLEAN ARTWORK WITH OPTIONAL CTA) */}
              <div className="absolute inset-0 p-3 sm:p-5 flex flex-col justify-between pointer-events-none">
                <div className="flex justify-end">
                  <span className="text-[9px] sm:text-[10px] text-white/90 font-bold bg-slate-950/70 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md backdrop-blur">
                    Target: {currentSimBanner.category}
                  </span>
                </div>

                {currentSimBanner.btnText ? (
                  <div className="flex justify-end">
                    <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-500 text-slate-950 text-[11px] sm:text-xs font-black rounded-lg sm:rounded-xl shadow-lg border border-amber-300 inline-flex items-center space-x-1.5 pointer-events-auto">
                      <span>{currentSimBanner.btnText}</span>
                      <span>→</span>
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* QUICK PRESET TEMPLATES */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 sm:space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
              Quick Preset Tour & Promo Templates
            </h3>
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">Click to instantly populate banner form</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {PRESET_TEMPLATES.map((tpl, i) => (
              <div
                key={i}
                onClick={() => handleOpenAddModal(tpl)}
                className="p-2.5 sm:p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50/50 hover:border-amber-300 transition cursor-pointer flex flex-col justify-between group shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] sm:text-[10px] font-extrabold text-amber-700 uppercase tracking-wide truncate">
                      {tpl.category}
                    </span>
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold text-slate-900 mt-1 group-hover:text-amber-900 line-clamp-1">
                    {tpl.tagline}
                  </div>
                </div>
                <div className="mt-2 sm:mt-3 flex items-center justify-between text-[10px] sm:text-[11px] text-amber-700 font-bold">
                  <span>+ Use</span>
                  <span>→</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BANNERS MANAGEMENT LIST */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3.5 sm:p-5 border-b border-slate-200">
            <h3 className="text-sm sm:text-base font-black text-slate-900">Configured Carousel Banners ({banners.length})</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              Active promotional posters automatically rotate in the customer app.
            </p>
          </div>

          {loading ? (
            <div className="p-8 sm:p-12 text-center text-slate-500 font-semibold text-xs sm:text-sm">Loading banners...</div>
          ) : banners.length === 0 ? (
            <div className="p-8 sm:p-12 text-center space-y-2 sm:space-y-3">
              <div className="text-sm sm:text-base font-bold text-slate-700">No Carousel Banners Found</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Create promotional posters to showcase your deals and fleet.
              </p>
              <button
                onClick={() => handleOpenAddModal()}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs hover:bg-amber-400"
              >
                + Add First Banner
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {banners.map((b, idx) => (
                <div
                  key={b.id}
                  className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                >
                  <div className="flex items-start sm:items-center space-x-3">
                    {/* Thumbnail */}
                    <div className="w-20 sm:w-28 h-12 sm:h-16 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-300 relative shadow-2xs">
                      <img
                        src={b.image}
                        alt={b.tagline || 'Banner'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as any).src = 'https://placehold.co/1200x600/1e293b/f59e0b?text=Kandy+Cabs';
                        }}
                      />
                    </div>

                    {/* Content Details */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                        {b.category && (
                          <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                            {b.category}
                          </span>
                        )}

                        {b.isActive ? (
                          <span className="text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 bg-slate-200 text-slate-600 rounded">
                            Inactive
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs sm:text-sm font-black text-slate-900 mt-1 truncate">
                        {b.tagline || 'Promotional Poster Flyer'}
                      </h4>
                      <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 font-semibold flex items-center gap-2">
                        {b.showCtaButton !== false && b.btnText ? (
                          <span>CTA: <span className="text-slate-700 font-bold">"{b.btnText}"</span></span>
                        ) : (
                          <span className="text-slate-500 italic bg-slate-100 px-1.5 py-0.5 rounded text-[9px]">Full Poster Clickable</span>
                        )}
                        {b.linkUrl && (
                          <span className="text-emerald-700 font-medium truncate max-w-[160px]">→ {b.linkUrl}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1.5 self-end md:self-center shrink-0">
                    <button
                      onClick={() => handleToggleActive(b)}
                      className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition ${
                        b.isActive
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {b.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(b)}
                      className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] sm:text-xs font-bold transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteBanner(b.id)}
                      className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] sm:text-xs font-bold transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* MODAL: ADD / EDIT BANNER */}
      {showModal && editingBanner && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-3.5 sm:p-6 shadow-2xl border border-slate-200 my-4 sm:my-8 space-y-3.5 sm:space-y-6 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingBanner.id ? 'Edit Promotional Banner' : 'Create New Promotional Banner'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Upload promotional graphic flyers and posters for customer app & web
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold p-1 leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="space-y-4">
              {/* Image Input Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Banner Background / Poster Image *
                  </label>
                  <div className="flex items-center space-x-2 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setImageInputMode('upload')}
                      className={`px-2.5 py-1 rounded-md transition ${
                        imageInputMode === 'upload'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputMode('url')}
                      className={`px-2.5 py-1 rounded-md transition ${
                        imageInputMode === 'url'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Image URL
                    </button>
                  </div>
                </div>

                {imageInputMode === 'upload' ? (
                  <div className="border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-xl p-4 text-center bg-slate-50 hover:bg-amber-50/20 transition cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      className="hidden"
                      id="bannerFileInput"
                    />
                    <label htmlFor="bannerFileInput" className="cursor-pointer block space-y-1">
                      <div className="w-8 h-8 mx-auto text-slate-400 flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <div className="text-xs font-bold text-slate-700">
                        Click to select an image from your computer
                      </div>
                      <div className="text-[11px] text-slate-400">
                        PNG, JPG, or WebP • Recommended 1200×600 px (&lt; 4 MB)
                      </div>
                    </label>
                  </div>
                ) : (
                  <input
                    type="url"
                    placeholder="https://example.com/banner-image.jpg"
                    value={editingBanner.image || ''}
                    onChange={(e) => setEditingBanner({ ...editingBanner, image: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                )}

                {/* Live Modal Image Preview */}
                {editingBanner.image && (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-300 bg-slate-100 mt-2">
                    <img
                      src={editingBanner.image}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                    />

                    {/* Promotional Poster Preview */}
                    <div className="absolute inset-0 p-3 flex flex-col justify-between pointer-events-none">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-white font-bold bg-slate-950/80 px-2 py-0.5 rounded">
                          Target: {editingBanner.category || 'ONEWAY'}
                        </span>
                        {editingBanner.linkUrl && (
                          <span className="text-[10px] text-emerald-300 font-bold bg-slate-950/80 px-2 py-0.5 rounded max-w-[200px] truncate">
                            {editingBanner.linkUrl}
                          </span>
                        )}
                      </div>
                      {editingBanner.showCtaButton !== false && editingBanner.btnText ? (
                        <div className="flex justify-end">
                          <span className="px-3 py-1.5 bg-amber-500 text-slate-950 font-black text-xs rounded-lg shadow-md">
                            {editingBanner.btnText} →
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              {/* Banner Label / Reference (Optional) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                  Banner Label / Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festive Discount Offer Flyer"
                  value={editingBanner.tagline || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, tagline: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Used for internal admin list identification</p>
              </div>

              {/* Target Booking Category */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                  Target Booking Category *
                </label>
                <select
                  value={editingBanner.category || 'ONEWAY'}
                  onChange={(e) =>
                    setEditingBanner({ ...editingBanner, category: e.target.value as BannerItem['category'] })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              {/* ACTION CTA BUTTON & REDIRECT URL CONFIGURATION */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="modalShowCta" className="text-xs font-extrabold text-slate-900 uppercase tracking-wider block cursor-pointer">
                      Include Action CTA Button
                    </label>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Display a floating action button over the banner (e.g. "Book Now", "Claim Offer")
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="modalShowCta"
                    checked={editingBanner.showCtaButton ?? true}
                    onChange={(e) =>
                      setEditingBanner({
                        ...editingBanner,
                        showCtaButton: e.target.checked,
                        btnText: e.target.checked ? (editingBanner.btnText || 'Book Now') : '',
                      })
                    }
                    className="w-4 h-4 text-amber-500 focus:ring-amber-400 border-slate-300 rounded cursor-pointer"
                  />
                </div>

                {editingBanner.showCtaButton !== false ? (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                        Action Button CTA Text *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Book Now / Claim Offer / Explore Tours"
                        value={editingBanner.btnText || ''}
                        onChange={(e) => setEditingBanner({ ...editingBanner, btnText: e.target.value })}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                        CTA Button Redirect URL / Web Link (Optional)
                      </label>
                      <input
                        type="url"
                        placeholder="e.g. https://www.graphitexdigitals.com/ or https://wa.me/919900000000"
                        value={editingBanner.linkUrl || ''}
                        onChange={(e) => setEditingBanner({ ...editingBanner, linkUrl: e.target.value })}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <p className="text-[11px] text-slate-500 mt-1 font-medium">
                        When customer clicks this CTA button in the customer app, it will redirect directly to this link. If left empty, it opens the booking flow.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                      Banner Flyer Click URL / Web Link (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="e.g. https://www.graphitexdigitals.com/ or https://wa.me/919900000000"
                      value={editingBanner.linkUrl || ''}
                      onChange={(e) => setEditingBanner({ ...editingBanner, linkUrl: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                      No CTA button is shown. Tapping anywhere on the banner flyer will open this link.
                    </p>
                  </div>
                )}
              </div>



              {/* Active Toggle */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="modalIsActive"
                  checked={editingBanner.isActive ?? true}
                  onChange={(e) => setEditingBanner({ ...editingBanner, isActive: e.target.checked })}
                  className="w-4 h-4 text-amber-500 focus:ring-amber-400 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="modalIsActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Activate banner immediately on Customer App
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition shadow-sm hover:shadow disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingBanner.id ? 'Update Banner' : 'Publish Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
