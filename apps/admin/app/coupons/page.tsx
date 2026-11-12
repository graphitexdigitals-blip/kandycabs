'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminNavbar } from '@/components/AdminNavbar';
import type { Coupon, CouponDiscountType } from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

interface CouponStats {
  totalCoupons: number;
  activeCoupons: number;
  fixedAmountCoupons: number;
  percentageCoupons: number;
  totalRedemptions: number;
}

const TRIP_TYPE_OPTIONS = [
  { id: 'ALL', label: 'All Trip Types' },
  { id: 'ONEWAY', label: 'One-Way Drop' },
  { id: 'ROUND', label: 'Round Trip' },
  { id: 'AIRPORT', label: 'Airport Transfer' },
  { id: 'LOCAL', label: 'Local Rental' },
  { id: 'PACKAGE', label: 'Tour Package' },
];

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStats>({
    totalCoupons: 0,
    activeCoupons: 0,
    fixedAmountCoupons: 0,
    percentageCoupons: 0,
    totalRedemptions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | CouponDiscountType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [modalError, setModalError] = useState('');

  // Form Fields
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<CouponDiscountType>('FIXED_AMOUNT');
  const [discountValue, setDiscountValue] = useState<string>('100');
  const [maxDiscount, setMaxDiscount] = useState<string>('500');
  const [minBookingAmount, setMinBookingAmount] = useState<string>('500');
  const [validTo, setValidTo] = useState<string>('');
  const [usageLimit, setUsageLimit] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [selectedTripTypes, setSelectedTripTypes] = useState<string[]>(['ALL']);

  // Notification Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/coupons');
      if (res.ok) {
        const data = await res.json();
        setCoupons(data.coupons || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
      showToast('Failed to load coupons from server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode('');
    setDescription('');
    setDiscountType('FIXED_AMOUNT');
    setDiscountValue('150');
    setMaxDiscount('500');
    setMinBookingAmount('500');
    setValidTo('');
    setUsageLimit('');
    setIsActive(true);
    setSelectedTripTypes(['ALL']);
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setDescription(coupon.description || '');
    setDiscountType(coupon.discountType);
    setDiscountValue(String(coupon.discountValue));
    setMaxDiscount(coupon.maxDiscount ? String(coupon.maxDiscount) : '');
    setMinBookingAmount(String(coupon.minBookingAmount || 0));
    setValidTo(coupon.validTo ? coupon.validTo.slice(0, 10) : '');
    setUsageLimit(coupon.usageLimit != null ? String(coupon.usageLimit) : '');
    setIsActive(coupon.isActive);
    setSelectedTripTypes(coupon.applicableTripTypes || ['ALL']);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}/toggle`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCoupons((prev) =>
          prev.map((c) => (c.id === coupon.id ? { ...c, isActive: !c.isActive } : c))
        );
        showToast(data.message || `Coupon ${coupon.code} updated.`);
      }
    } catch (err) {
      console.error('Failed to toggle coupon status:', err);
    }
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    if (!confirm(`Are you sure you want to delete coupon code "${coupon.code}"?`)) return;
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, { method: 'DELETE' });
      if (res.ok) {
        setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
        showToast(`Coupon "${coupon.code}" deleted.`);
      }
    } catch (err) {
      console.error('Failed to delete coupon:', err);
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setModalError('Please enter a coupon code.');
      return;
    }

    const numDiscount = Number(discountValue);
    if (isNaN(numDiscount) || numDiscount <= 0) {
      setModalError('Discount value must be a positive number.');
      return;
    }

    if (discountType === 'PERCENTAGE' && numDiscount > 100) {
      setModalError('Percentage discount cannot exceed 100%.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code: trimmedCode,
        description,
        discountType,
        discountValue: numDiscount,
        maxDiscount: discountType === 'PERCENTAGE' && maxDiscount ? Number(maxDiscount) : null,
        minBookingAmount: Number(minBookingAmount) || 0,
        validTo: validTo ? new Date(validTo).toISOString() : null,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        isActive,
        applicableTripTypes: selectedTripTypes,
      };

      const url = editingCoupon ? `/api/admin/coupons/${editingCoupon.id}` : '/api/admin/coupons';
      const method = editingCoupon ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save coupon.');
      }

      showToast(editingCoupon ? `Updated coupon "${trimmedCode}"!` : `Created coupon "${trimmedCode}"!`);
      setIsModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      setModalError(err.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCode(text);
    showToast(`Copied code "${text}" to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtered coupons
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      const matchesSearch =
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'ALL' || c.discountType === typeFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && c.isActive) ||
        (statusFilter === 'INACTIVE' && !c.isActive);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [coupons, searchQuery, typeFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <AdminNavbar />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-slide-up border border-slate-700">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-3 sm:space-y-4">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 pb-2.5 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              Coupons & Discounts
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchCoupons}
              className="p-2 sm:px-3 sm:py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
              title="Refresh Coupons"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={openCreateModal}
              className="flex-1 sm:flex-initial justify-center px-4 py-2 text-xs sm:text-sm font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span className="text-base font-black leading-none">+</span>
              <span>Create Coupon</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Stats Cards - 3 in a row on mobile */}
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-3">
          <div className="bg-white p-2 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">Total Codes</span>
            <div className="flex items-baseline justify-between mt-0.5 sm:mt-1">
              <span className="text-base sm:text-xl font-black text-slate-900">{stats.totalCoupons}</span>
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
          </div>

          <div className="bg-white p-2 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Active & Live</span>
            <div className="flex items-baseline justify-between mt-0.5 sm:mt-1">
              <span className="text-base sm:text-xl font-black text-slate-900">{stats.activeCoupons}</span>
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            </div>
          </div>

          <div className="bg-white p-2 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Flat Amount</span>
            <div className="flex items-baseline justify-between mt-0.5 sm:mt-1">
              <span className="text-base sm:text-xl font-black text-slate-900">{stats.fixedAmountCoupons}</span>
              <span className="text-[9px] sm:text-[11px] font-mono font-bold text-slate-500 shrink-0">₹ OFF</span>
            </div>
          </div>

          <div className="bg-white p-2 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Percentage</span>
            <div className="flex items-baseline justify-between mt-0.5 sm:mt-1">
              <span className="text-base sm:text-xl font-black text-slate-900">{stats.percentageCoupons}</span>
              <span className="text-[9px] sm:text-[11px] font-mono font-bold text-slate-500 shrink-0">% OFF</span>
            </div>
          </div>

          <div className="bg-white p-2 sm:p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[9.5px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block truncate">Redemptions</span>
            <div className="flex items-baseline justify-between mt-0.5 sm:mt-1">
              <span className="text-base sm:text-xl font-black text-slate-900">{stats.totalRedemptions}</span>
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-2 sm:p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shadow-2xs">
          <div className="relative flex-1 min-w-0">
            <span className="absolute inset-y-0 left-2.5 sm:left-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coupon code or description..."
              className="w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Discount Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="flex-1 sm:flex-initial py-1.5 px-2.5 sm:py-2 sm:px-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Types</option>
              <option value="FIXED_AMOUNT">Flat Amount (₹)</option>
              <option value="PERCENTAGE">Percentage (%)</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="flex-1 sm:flex-initial py-1.5 px-2.5 sm:py-2 sm:px-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Coupons Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-2">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Loading coupon codes...</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <h3 className="text-base font-bold text-slate-800">No coupons found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No coupon codes match your active filters. Try resetting search or type filter.'
                : 'You have not created any promo codes yet. Click below to add your first coupon!'}
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-xl transition shadow-xs"
            >
              <span>+ Create First Coupon</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCoupons.map((coupon) => {
              const isPercentage = coupon.discountType === 'PERCENTAGE';
              const isExpired = coupon.validTo && new Date(coupon.validTo) < new Date();

              return (
                <div
                  key={coupon.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md ${
                    !coupon.isActive || isExpired
                      ? 'border-slate-200 opacity-80 bg-slate-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header & Badge */}
                  <div className="p-3 sm:p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Type Badge */}
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border bg-slate-100 text-slate-900 border-slate-200">
                          {isPercentage ? 'Percentage' : 'Flat Amount'}
                        </span>

                        {/* Status Badge */}
                        {isExpired ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                            Expired
                          </span>
                        ) : coupon.isActive ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            Inactive
                          </span>
                        )}
                      </div>

                      {/* Active/Inactive Toggle Button */}
                      <button
                        onClick={() => handleToggleStatus(coupon)}
                        className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border transition shrink-0 cursor-pointer ${
                          coupon.isActive
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'
                        }`}
                        title="Click to toggle status"
                      >
                        {coupon.isActive ? 'Enabled' : 'Paused'}
                      </button>
                    </div>

                    {/* Discount Value Display */}
                    <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-baseline gap-1">
                          {isPercentage ? (
                            <>
                              <span>{coupon.discountValue}%</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-900 uppercase">OFF</span>
                            </>
                          ) : (
                            <>
                              <span className="text-base sm:text-lg font-bold text-slate-900">₹</span>
                              <span>{coupon.discountValue}</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-900 uppercase">OFF</span>
                            </>
                          )}
                        </div>
                        {isPercentage && coupon.maxDiscount && (
                          <span className="text-[10px] sm:text-[11px] text-slate-600 font-semibold block mt-0.5">
                            Capped up to ₹{coupon.maxDiscount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      {/* Coupon Code Pill with Copy */}
                      <div
                        onClick={() => copyToClipboard(coupon.code)}
                        className="group flex items-center gap-1.5 bg-slate-100 hover:bg-amber-100/70 border border-slate-200 hover:border-amber-400 px-2.5 py-1 rounded-lg cursor-pointer transition shadow-2xs shrink-0"
                        title="Click to copy code"
                      >
                        <span className="font-mono font-black text-xs sm:text-sm text-slate-900 group-hover:text-amber-800 tracking-wider">
                          {coupon.code}
                        </span>
                        <span className="text-slate-400 group-hover:text-amber-700 text-[11px] font-semibold">
                          {copiedCode === coupon.code ? 'Copied' : 'Copy'}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    {coupon.description && (
                      <p className="text-xs text-slate-600 leading-relaxed pt-1 border-t border-slate-100">
                        {coupon.description}
                      </p>
                    )}

                    {/* Details Strip */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] space-y-1 text-slate-600 font-medium">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Min Fare Required:</span>
                        <span className="font-bold text-slate-800">
                          {coupon.minBookingAmount > 0
                            ? `₹${coupon.minBookingAmount.toLocaleString('en-IN')}`
                            : 'No minimum'}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-400">Validity:</span>
                        <span className="text-slate-700 font-semibold">
                          {coupon.validTo
                            ? new Date(coupon.validTo).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'Lifetime / No Expiry'}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-400">Redemptions:</span>
                        <span className="font-bold text-amber-700">
                          {coupon.usageCount}
                          {coupon.usageLimit ? ` / ${coupon.usageLimit} max` : ' used'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Added {new Date(coupon.createdAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(coupon)}
                        className="text-amber-700 hover:text-amber-900 font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg hover:bg-amber-100/60 transition cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(coupon)}
                        className="text-rose-600 hover:text-rose-800 font-bold px-2 py-0.5 sm:px-2 sm:py-1 rounded-lg hover:bg-rose-100/60 transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create / Edit Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-none sm:rounded-2xl max-w-xl w-full h-full sm:h-auto sm:max-h-[90vh] shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col my-0 sm:my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 sm:px-5 sm:py-4 text-slate-950 flex items-center justify-between shrink-0 shadow-xs">
              <div>
                <h3 className="font-black text-base sm:text-lg">
                  {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Discount Coupon'}
                </h3>
                <p className="text-[11px] text-amber-950 font-medium">
                  Set flat amount or percentage discount rules for customers
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-slate-950 flex items-center justify-center font-bold text-sm transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCoupon} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 sm:space-y-4">
                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                    {modalError}
                  </div>
                )}

              {/* Step 1: Discount Type Selector (2 Options) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Select Coupon Discount Option <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Option 1: Amount */}
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('FIXED_AMOUNT');
                      if (Number(discountValue) > 1000) setDiscountValue('200');
                    }}
                    className={`p-3 rounded-2xl border-2 text-left transition flex flex-col justify-between gap-1.5 ${
                      discountType === 'FIXED_AMOUNT'
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">Flat ₹</span>
                      {discountType === 'FIXED_AMOUNT' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-xs sm:text-sm text-slate-900">Option 1: Flat Amount (₹)</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">e.g. Flat ₹100, ₹200, ₹500 discount</p>
                    </div>
                  </button>

                  {/* Option 2: Percentage */}
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('PERCENTAGE');
                      if (Number(discountValue) > 100) setDiscountValue('15');
                    }}
                    className={`p-3 rounded-2xl border-2 text-left transition flex flex-col justify-between gap-1.5 ${
                      discountType === 'PERCENTAGE'
                        ? 'border-purple-600 bg-purple-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-purple-800 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-md">% Off</span>
                      {discountType === 'PERCENTAGE' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-xs sm:text-sm text-slate-900">Option 2: Percentage (%)</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">e.g. 10%, 15%, 20% discount (with cap)</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Coupon Code & Discount Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Coupon Promo Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. KANDY100, FESTIVE20"
                    required
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white uppercase tracking-wider"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Customer will enter this exact code</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {discountType === 'FIXED_AMOUNT' ? 'Flat Discount Amount (₹)' : 'Discount Percentage (%)'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center font-bold text-slate-400 text-sm">
                      {discountType === 'FIXED_AMOUNT' ? '₹' : '%'}
                    </span>
                    <input
                      type="number"
                      min="1"
                      max={discountType === 'PERCENTAGE' ? 100 : 10000}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      required
                      placeholder={discountType === 'FIXED_AMOUNT' ? '200' : '15'}
                      className="w-full pl-8 pr-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {discountType === 'FIXED_AMOUNT' ? 'Deducted directly from fare' : 'Calculated off booking fare'}
                  </span>
                </div>
              </div>

              {/* Max Discount (Only for Percentage) & Min Booking Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {discountType === 'PERCENTAGE' ? (
                  <div>
                    <label className="text-xs font-bold text-purple-900 block mb-1">
                      Max Discount Cap (₹) <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center font-bold text-slate-400 text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={maxDiscount}
                        onChange={(e) => setMaxDiscount(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full pl-8 pr-3 py-2 text-sm font-bold bg-purple-50/50 border border-purple-200 rounded-xl focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">e.g. 15% discount capped up to ₹500</span>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Min Booking Fare (₹) <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center font-bold text-slate-400 text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={minBookingAmount}
                        onChange={(e) => setMinBookingAmount(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">0 for no minimum fare requirement</span>
                  </div>
                )}

                {discountType === 'PERCENTAGE' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Min Booking Fare (₹) <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center font-bold text-slate-400 text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={minBookingAmount}
                        onChange={(e) => setMinBookingAmount(e.target.value)}
                        placeholder="e.g. 1000"
                        className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">0 for no minimum fare requirement</span>
                  </div>
                )}

                {discountType === 'FIXED_AMOUNT' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Usage Limit <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={usageLimit}
                      onChange={(e) => setUsageLimit(e.target.value)}
                      placeholder="e.g. 100 (Blank = Unlimited)"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Total times coupon can be redeemed</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Description / Subtitle <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Festive season discount for Bangalore & Mangalore trips"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Expiry Date & Usage Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Expiration Date <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Leave empty for lifetime promo code</span>
                </div>

                {discountType === 'PERCENTAGE' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Usage Limit <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={usageLimit}
                      onChange={(e) => setUsageLimit(e.target.value)}
                      placeholder="e.g. 500 (Blank = Unlimited)"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Total allowed claims</span>
                  </div>
                )}
              </div>

              {/* Applicable Trip Types */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Applicable Trip Types
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {TRIP_TYPE_OPTIONS.map((opt) => {
                    const isSelected = selectedTripTypes.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          if (opt.id === 'ALL') {
                            setSelectedTripTypes(['ALL']);
                          } else {
                            const withoutAll = selectedTripTypes.filter((t) => t !== 'ALL');
                            if (isSelected) {
                              const next = withoutAll.filter((t) => t !== opt.id);
                              setSelectedTripTypes(next.length === 0 ? ['ALL'] : next);
                            } else {
                              setSelectedTripTypes([...withoutAll, opt.id]);
                            }
                          }
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition ${
                          isSelected
                            ? 'bg-amber-100 text-amber-900 border-amber-400'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Pill */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Customer Live Preview:
                </span>
                <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-mono font-black text-sm tracking-wider">
                        {code || 'PROMOCODE'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold">
                        {discountType === 'FIXED_AMOUNT' ? `Flat ₹${discountValue || '0'} OFF` : `${discountValue || '0'}% OFF`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {description || (discountType === 'FIXED_AMOUNT' ? `Save ₹${discountValue} on your cab ride` : `Get ${discountValue}% discount on your booking`)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs bg-emerald-600 font-bold px-2 py-1 rounded-lg">
                      APPLY
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Submit Buttons Footer */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-2 sm:gap-2.5 shrink-0 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)] sm:shadow-none">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create & Activate'}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}
    </div>
  );
}

