'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminNavbar } from '@/components/AdminNavbar';
import { PaymentStatus } from '@kandy-cabs/shared';
import {
  IconPayments,
  IconRefresh,
  IconCheck,
  IconCross,
  IconCar,
  IconPhone,
  IconSearch,
  IconWallet,
  IconUsers,
  IconClock,
  IconCalendar,
  IconGrid,
  IconList,
  IconTrendingUp,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconUserSolid,
  IconFileText,
  IconEdit,
} from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default function AdminPaymentsPage() {
  const [summary, setSummary] = useState<any>({
    totalRevenue: 0,
    totalBookings: 0,
    paidCount: 0,
    partiallyPaidCount: 0,
    pendingCount: 0,
    driverPaidCount: 0,
    totalDriverPaidAmount: 0,
    driverPendingCount: 0,
    totalDriverPendingAmount: 0,
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalCount: 0, totalPages: 1, limit: 25, page: 1 });

  // Driver Payout Quick Action & Edit States
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editModalBooking, setEditModalBooking] = useState<any | null>(null);
  const [editAllowance, setEditAllowance] = useState<string>('350');
  const [editPayee, setEditPayee] = useState<string>('0');
  const [editStatus, setEditStatus] = useState<string>('PENDING');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Customer Balance Payment Recording States
  const [balanceModalBooking, setBalanceModalBooking] = useState<any | null>(null);
  const [balanceMethod, setBalanceMethod] = useState<string>('UPI_QR');
  const [balanceTxnRef, setBalanceTxnRef] = useState<string>('');
  const [balanceNotes, setBalanceNotes] = useState<string>('');
  const [savingBalance, setSavingBalance] = useState<boolean>(false);

  // Accordion state for mobile/tablet payment transaction cards
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const toggleCardExpand = (id: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Date Filtering States
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState<boolean>(false);
  const dateDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setIsDateDropdownOpen(false);
      }
    };
    if (isDateDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDateDropdownOpen]);

  const toLocalIsoDate = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const handleSelectPreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const todayStr = toLocalIsoDate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = toLocalIsoDate(yesterday);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'THIS_WEEK') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      setStartDate(toLocalIsoDate(weekAgo));
      setEndDate(toLocalIsoDate(now));
    } else if (preset === 'THIS_MONTH') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toLocalIsoDate(monthStart));
      setEndDate(toLocalIsoDate(now));
    }
    setIsDateDropdownOpen(false);
    setPage(1);
  };

  const handleClearDateFilter = () => {
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
    setIsDateDropdownOpen(false);
    setPage(1);
  };

  const getDateButtonLabel = () => {
    if (!startDate && !endDate) return 'Select Date';
    if (datePreset === 'TODAY') return 'Today';
    if (datePreset === 'YESTERDAY') return 'Yesterday';
    if (datePreset === 'THIS_WEEK') return 'Last 7 Days';
    if (datePreset === 'THIS_MONTH') return 'This Month';
    if (startDate && endDate && startDate === endDate) {
      const d = new Date(startDate);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
    if (startDate && endDate) {
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      return `${d1.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${d2.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }
    if (startDate) {
      return `From ${new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }
    return 'Select Date';
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '25',
        status: statusFilter,
        ...(search ? { search } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });

      const res = await fetch(`/api/admin/payments?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setTransactions(data.transactions || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, startDate, endDate]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPayments();
  };

  // WhatsApp Share Functions
  const handleShareWhatsAppBill = (t: any) => {
    const rawPhone = t.customerPhone ? t.customerPhone.replace(/[^0-9]/g, '') : '';
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

    const webBaseUrl = typeof window !== 'undefined' ? window.location.origin.replace(':3001', ':3000') : 'http://localhost:3000';
    const payUrl = `${webBaseUrl}/pay/${t.humanReadableRef}`;

    const message = `🚖 *KANDY CABS — TRIP INVOICE & BALANCE DUE*
----------------------------------------
*Booking Ref:* ${t.humanReadableRef}
*Customer:* ${t.customerName}
*Trip Type:* ${t.tripType}

💰 *FARE BREAKDOWN*
• Total Trip Fare: ₹${t.estimatedFare.toLocaleString('en-IN')}
• Advance Paid (Online): -₹${t.advanceAmount.toLocaleString('en-IN')} (✓ Confirmed)
${t.tollAmount > 0 ? `• Tolls: +₹${t.tollAmount.toLocaleString('en-IN')}\n` : ''}${t.parkingAmount > 0 ? `• Parking: +₹${t.parkingAmount.toLocaleString('en-IN')}\n` : ''}----------------------------------------
🔴 *Pending Balance to Pay: ₹${t.balanceAmount.toLocaleString('en-IN')}*
----------------------------------------

💳 *Pay Online & View Tax Invoice:*
${payUrl}

Thank you for traveling with Kandy Cabs!
📞 Support: +91 9786452563`;

    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  const handleShareWhatsAppReceipt = (t: any) => {
    const rawPhone = t.customerPhone ? t.customerPhone.replace(/[^0-9]/g, '') : '';
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

    const webBaseUrl = typeof window !== 'undefined' ? window.location.origin.replace(':3001', ':3000') : 'http://localhost:3000';
    const receiptUrl = `${webBaseUrl}/pay/${t.humanReadableRef}`;

    const message = `🎉 *KANDY CABS — PAYMENT RECEIVED & CONFIRMED*
----------------------------------------
*Booking Ref:* ${t.humanReadableRef}
*Customer:* ${t.customerName}
*Receipt No:* RCP-${t.humanReadableRef}

*Balance Paid:* ₹${t.balanceAmount.toLocaleString('en-IN')}
*Status:* ✓ 100% SETTLED & PAID

🧾 *View & Download Tax Invoice Receipt:*
${receiptUrl}

Thank you for choosing Kandy Cabs Mangalore!
📞 Support: +91 9786452563`;

    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank');
  };

  // Open Balance Payment Record Modal
  const handleOpenBalanceModal = (t: any) => {
    setBalanceModalBooking(t);
    setBalanceMethod('UPI_QR');
    setBalanceTxnRef('');
    setBalanceNotes('');
  };

  // Save Balance Payment
  const handleSaveBalancePayment = async () => {
    if (!balanceModalBooking) return;
    setSavingBalance(true);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: balanceModalBooking.id,
          paymentMethod: balanceMethod,
          transactionRef: balanceTxnRef,
          notes: balanceNotes,
        }),
      });

      if (res.ok) {
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === balanceModalBooking.id
              ? {
                  ...t,
                  balancePaymentStatus: PaymentStatus.PAID,
                  balancePayment: {
                    paymentMethod: balanceMethod,
                    razorpayPaymentId: balanceTxnRef,
                    status: PaymentStatus.PAID,
                  },
                }
              : t
          )
        );
        setBalanceModalBooking(null);
        fetchPayments();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to record balance payment');
      }
    } catch (err) {
      console.error('Failed to record balance payment:', err);
      alert('Network error while recording balance payment');
    } finally {
      setSavingBalance(false);
    }
  };

  // Toggle Driver Payment Status directly from table
  const handleToggleDriverPayment = async (bookingId: string, newStatus: 'PAID' | 'PENDING') => {
    setActionLoadingId(bookingId);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverPaymentStatus: newStatus }),
      });

      if (res.ok) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === bookingId ? { ...t, driverPaymentStatus: newStatus } : t))
        );
        // Refresh summary counters
        fetchPayments();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to update driver payment status');
      }
    } catch (err) {
      console.error('Failed to update driver payment status:', err);
      alert('Network error while updating driver payment status');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (t: any) => {
    setEditModalBooking(t);
    setEditAllowance(String(t.driverAllowance || 0));
    setEditPayee(String(t.driverPayeeAmount || 0));
    setEditStatus(t.driverPaymentStatus || 'PENDING');
  };

  // Save Edit Modal
  const handleSaveDriverPayoutEdit = async () => {
    if (!editModalBooking) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/bookings/${editModalBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverAllowance: parseFloat(editAllowance) || 0,
          driverPayeeAmount: parseFloat(editPayee) || 0,
          driverPaymentStatus: editStatus,
        }),
      });

      if (res.ok) {
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === editModalBooking.id
              ? {
                  ...t,
                  driverAllowance: parseFloat(editAllowance) || 0,
                  driverPayeeAmount: parseFloat(editPayee) || 0,
                  driverPaymentStatus: editStatus,
                }
              : t
          )
        );
        setEditModalBooking(null);
        fetchPayments();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to update driver payout');
      }
    } catch (err) {
      console.error('Error saving driver payout:', err);
      alert('Failed to save driver payout');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-3.5 sm:space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-100/90 text-slate-900 flex items-center justify-center shadow-2xs shrink-0 border border-amber-200/60">
              <IconWallet className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-base sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
                Revenue & Driver Payout Ledger
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">
                Manage customer collections and driver settlements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchPayments()}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white hover:bg-slate-50 text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl border border-slate-200/90 flex items-center gap-1.5 text-slate-700 transition shadow-2xs"
            >
              <IconRefresh className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-600" />
              <span>Refresh Data</span>
            </button>
            <div className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Ledger</span>
            </div>
          </div>
        </div>

        {/* 6 Summary Metric Cards - 3 in a row on mobile */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-3 lg:gap-4">
          {/* 1. Total Revenue */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-2 sm:p-3.5 lg:p-4 shadow-2xs sm:shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition group">
            <div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[9px] sm:text-xs shrink-0">
                    ₹
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-800 truncate">Total Revenue</span>
                </div>
                <IconTrendingUp className="hidden sm:block w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition shrink-0" />
              </div>
              <div className="text-xs sm:text-lg lg:text-xl font-black text-slate-900 mt-1 sm:mt-2 tracking-tight truncate">
                ₹{(summary.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate">Verified payments</div>
            {/* Soft wave accent */}
            <div className="absolute -bottom-1 left-0 right-0 h-2 sm:h-3.5 opacity-35 pointer-events-none">
              <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full fill-current text-blue-500">
                <path d="M0.00,49.98 C149.99,150.00 349.81,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
              </svg>
            </div>
          </div>

          {/* 2. Driver Paid */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-2 sm:p-3.5 lg:p-4 shadow-2xs sm:shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition group">
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[9px] sm:text-xs shrink-0">
                  <IconCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" strokeWidth={3} />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-slate-800 truncate">Driver Paid</span>
              </div>
              <div className="text-xs sm:text-lg lg:text-xl font-black text-slate-900 mt-1 sm:mt-2 tracking-tight truncate">
                ₹{(summary.totalDriverPaidAmount || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate">
              Settled payouts
            </div>
            {/* Soft wave accent */}
            <div className="absolute -bottom-1 left-0 right-0 h-2 sm:h-3.5 opacity-35 pointer-events-none">
              <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full fill-current text-emerald-500">
                <path d="M0.00,49.98 C149.99,150.00 349.81,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
              </svg>
            </div>
          </div>

          {/* 3. Driver Unpaid */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-2 sm:p-3.5 lg:p-4 shadow-2xs sm:shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition group">
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-black text-[9px] sm:text-xs shrink-0">
                  !
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-slate-800 truncate">Driver Unpaid</span>
              </div>
              <div className="text-xs sm:text-lg lg:text-xl font-black text-slate-900 mt-1 sm:mt-2 tracking-tight truncate">
                ₹{(summary.totalDriverPendingAmount || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate">
              Pending payouts
            </div>
            {/* Soft wave accent */}
            <div className="absolute -bottom-1 left-0 right-0 h-2 sm:h-3.5 opacity-35 pointer-events-none">
              <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full fill-current text-rose-500">
                <path d="M0.00,49.98 C149.99,150.00 349.81,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
              </svg>
            </div>
          </div>

          {/* 4. Customer Received */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-2 sm:p-3.5 lg:p-4 shadow-2xs sm:shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition group">
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                  <IconUsers className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-slate-800 truncate">Cust. Received</span>
              </div>
              <div className="text-xs sm:text-lg lg:text-xl font-black text-slate-900 mt-1 sm:mt-2 tracking-tight truncate">
                {summary.paidCount || 0}
              </div>
            </div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate">Payments received</div>
            {/* Soft wave accent */}
            <div className="absolute -bottom-1 left-0 right-0 h-2 sm:h-3.5 opacity-35 pointer-events-none">
              <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full fill-current text-blue-500">
                <path d="M0.00,49.98 C149.99,150.00 349.81,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
              </svg>
            </div>
          </div>

          {/* 5. Advance Received */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-2 sm:p-3.5 lg:p-4 shadow-2xs sm:shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition group">
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <IconClock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-slate-800 truncate">Adv. Received</span>
              </div>
              <div className="text-xs sm:text-lg lg:text-xl font-black text-slate-900 mt-1 sm:mt-2 tracking-tight truncate">
                {summary.partiallyPaidCount || 0}
              </div>
            </div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate">Balance at drop</div>
            {/* Soft wave accent */}
            <div className="absolute -bottom-1 left-0 right-0 h-2 sm:h-3.5 opacity-35 pointer-events-none">
              <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full fill-current text-amber-500">
                <path d="M0.00,49.98 C149.99,150.00 349.81,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
              </svg>
            </div>
          </div>

          {/* 6. Advance Due */}
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-2 sm:p-3.5 lg:p-4 shadow-2xs sm:shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition group">
            <div>
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0">
                  <IconCalendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-slate-800 truncate">Advance Due</span>
              </div>
              <div className="text-xs sm:text-lg lg:text-xl font-black text-slate-900 mt-1 sm:mt-2 tracking-tight truncate">
                {summary.pendingCount || 0}
              </div>
            </div>
            <div className="text-[9px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate">Unpaid bookings</div>
            {/* Soft wave accent */}
            <div className="absolute -bottom-1 left-0 right-0 h-2 sm:h-3.5 opacity-35 pointer-events-none">
              <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full fill-current text-slate-600">
                <path d="M0.00,49.98 C149.99,150.00 349.81,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter Pills & Search Bar */}
        <div className="flex flex-col lg:flex-row gap-3.5 justify-between items-stretch lg:items-center">
          {/* Filter Pills (slidable on mobile/tablet) */}
          <div className="flex overflow-x-auto no-scrollbar gap-2 items-center pb-1 lg:pb-0 lg:flex-wrap -mx-2.5 px-2.5 lg:mx-0 lg:px-0">
            {/* All Bookings */}
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <IconGrid className="w-3.5 h-3.5" />
              <span>All Bookings</span>
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {pagination.totalCount || transactions.length}
              </span>
            </button>

            {/* Driver Paid */}
            <button
              onClick={() => {
                setStatusFilter('DRIVER_PAID');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'DRIVER_PAID'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <span>✓ Driver Paid ({summary.driverPaidCount || 0})</span>
            </button>

            {/* Driver Unpaid */}
            <button
              onClick={() => {
                setStatusFilter('DRIVER_UNPAID');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'DRIVER_UNPAID'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <span>✕ Driver Unpaid ({summary.driverPendingCount || 0})</span>
            </button>

            {/* Customer Paid */}
            <button
              onClick={() => {
                setStatusFilter('PAID');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'PAID'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <IconUserSolid className="w-3 h-3 text-slate-500" />
              <span>Customer Paid</span>
            </button>

            {/* Customer Adv Received */}
            <button
              onClick={() => {
                setStatusFilter('PARTIALLY_PAID');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'PARTIALLY_PAID'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <IconPayments className="w-3.5 h-3.5 text-slate-500" />
              <span>Customer Adv Received</span>
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 items-center w-full lg:w-auto">
            <div className="relative flex-1 lg:w-80">
              <IconSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by ref, phone, driver name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition shadow-xs shrink-0"
            >
              Search
            </button>
          </form>
        </div>

        {/* Transactions Table Card: Booking Ledger */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
          {/* Card Header Row */}
          <div className="px-3.5 sm:px-5 py-3 sm:py-4 flex justify-between items-center border-b border-slate-100">
            <div className="flex items-center gap-2">
              <IconList className="w-4 h-4 text-slate-800" strokeWidth={2.5} />
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">Booking Ledger</h2>
            </div>

            {/* Select Date Dropdown Button */}
            <div className="relative" ref={dateDropdownRef}>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsDateDropdownOpen((prev) => !prev)}
                  className={`px-2.5 sm:px-3.5 py-1.5 bg-white hover:bg-slate-50 border rounded-xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 shadow-2xs transition cursor-pointer ${
                    startDate ? 'border-amber-400 bg-amber-50/50 text-amber-950 font-bold' : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <IconCalendar className={`w-3.5 h-3.5 ${startDate ? 'text-amber-600' : 'text-slate-500'}`} />
                  <span className="truncate max-w-[120px] sm:max-w-none">{getDateButtonLabel()}</span>
                  <IconChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                      isDateDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Reset button when date filter is active */}
                {startDate && (
                  <button
                    type="button"
                    onClick={handleClearDateFilter}
                    className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 flex items-center justify-center text-xs transition cursor-pointer border border-slate-200 shadow-2xs"
                    title="Reset date filter to All Dates"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Date Filter Dropdown Popup */}
              {isDateDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-[265px] sm:w-80 bg-white rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/90 p-2.5 sm:p-3.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[11px] sm:text-xs">
                    <span className="font-extrabold text-slate-900 tracking-tight">Filter Ledger by Date</span>
                    {startDate && (
                      <button
                        type="button"
                        onClick={handleClearDateFilter}
                        className="text-[10px] sm:text-[11px] font-bold text-rose-600 hover:text-rose-800 transition cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Preset Quick Filters */}
                  <div className="py-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-0.5">
                      Quick Presets
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => handleSelectPreset('ALL')}
                        className={`px-2 py-1 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold text-left transition cursor-pointer ${
                          datePreset === 'ALL' && !startDate
                            ? 'bg-slate-900 text-white font-bold'
                            : 'hover:bg-slate-100 text-slate-700 bg-slate-50'
                        }`}
                      >
                        All Dates
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectPreset('TODAY')}
                        className={`px-2 py-1 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold text-left transition cursor-pointer ${
                          datePreset === 'TODAY'
                            ? 'bg-slate-900 text-white font-bold'
                            : 'hover:bg-slate-100 text-slate-700 bg-slate-50'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectPreset('YESTERDAY')}
                        className={`px-2 py-1 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold text-left transition cursor-pointer ${
                          datePreset === 'YESTERDAY'
                            ? 'bg-slate-900 text-white font-bold'
                            : 'hover:bg-slate-100 text-slate-700 bg-slate-50'
                        }`}
                      >
                        Yesterday
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectPreset('THIS_WEEK')}
                        className={`px-2 py-1 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold text-left transition cursor-pointer ${
                          datePreset === 'THIS_WEEK'
                            ? 'bg-slate-900 text-white font-bold'
                            : 'hover:bg-slate-100 text-slate-700 bg-slate-50'
                        }`}
                      >
                        Last 7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectPreset('THIS_MONTH')}
                        className={`col-span-2 px-2 py-1 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold text-left transition cursor-pointer ${
                          datePreset === 'THIS_MONTH'
                            ? 'bg-slate-900 text-white font-bold'
                            : 'hover:bg-slate-100 text-slate-700 bg-slate-50'
                        }`}
                      >
                        This Month
                      </button>
                    </div>
                  </div>

                  {/* Custom Date Range */}
                  <div className="border-t border-slate-100 pt-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-0.5">
                      Custom Date Range
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-0.5">From Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => {
                            setDatePreset('CUSTOM');
                            setStartDate(e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md sm:rounded-lg py-1 px-1.5 text-[11px] text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-0.5">To Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => {
                            setDatePreset('CUSTOM');
                            setEndDate(e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-md sm:rounded-lg py-1 px-1.5 text-[11px] text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleClearDateFilter}
                        className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold px-1.5 py-0.5 rounded transition cursor-pointer"
                      >
                        Reset All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDateDropdownOpen(false);
                          setPage(1);
                        }}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-md sm:rounded-lg transition shadow-2xs cursor-pointer"
                      >
                        Apply Filter
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              <div className="inline-block animate-spin text-2xl mb-2">🔄</div>
              <div>Loading financial ledger & driver payouts...</div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <div className="text-3xl mb-2">🧾</div>
              <div>No payment transactions found matching the filter criteria.</div>
            </div>
          ) : (
            <>
              {/* Desktop Table View (lg and up) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold tracking-tight">
                    <tr>
                      <th className="py-3.5 px-4 font-bold">Booking Ref<br /><span className="text-[11px] text-slate-400 font-normal">/ Date</span></th>
                      <th className="py-3.5 px-4 font-bold">Customer</th>
                      <th className="py-3.5 px-4 font-bold">Assigned Driver</th>
                      <th className="py-3.5 px-4 font-bold">Total Fare</th>
                      <th className="py-3.5 px-4 font-bold">Advance</th>
                      <th className="py-3.5 px-4 font-bold">Balance</th>
                      <th className="py-3.5 px-4 font-bold">Tolls /<br /><span className="text-[11px] text-slate-400 font-normal">Parking</span></th>
                      <th className="py-3.5 px-4 font-bold">Driver Payout</th>
                      <th className="py-3.5 px-4 font-bold">Ride Status</th>
                      <th className="py-3.5 px-4 font-bold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((t) => {
                      const isDriverPaid = t.driverPaymentStatus === 'PAID';
                      const isProcessing = actionLoadingId === t.id;
                      const totalDriverEarning = (t.driverAllowance || 0) + (t.driverPayeeAmount || 0);

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition">
                          {/* 1. Booking Ref / Date */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-extrabold text-slate-900 font-mono text-xs">
                              {t.humanReadableRef}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <IconClock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>
                                {new Date(t.createdAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-md tracking-wider">
                              {t.tripType || 'ONEWAY'}
                            </span>
                          </td>

                          {/* 2. Customer */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                              <IconUserSolid className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{t.customerName}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <IconPhone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{t.customerPhone}</span>
                            </div>
                          </td>

                          {/* 3. Assigned Driver */}
                          <td className="py-3.5 px-4 align-top">
                            {t.driverName ? (
                              <div>
                                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                                  <IconUserSolid className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span>{t.driverName}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                  <IconPhone className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{t.driverPhone}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                            )}
                          </td>

                          {/* 4. Total Fare */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                              ₹{t.estimatedFare?.toLocaleString('en-IN')}
                            </div>
                          </td>

                          {/* 5. Advance */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-semibold text-slate-800 text-xs">
                              ₹{t.advanceAmount?.toLocaleString('en-IN')}
                            </div>
                            {t.advancePaymentStatus === PaymentStatus.PAID ? (
                              <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                                ✓ Paid
                              </div>
                            ) : (
                              <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                                Due
                              </div>
                            )}
                          </td>

                          {/* 6. Balance */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-semibold text-slate-800 text-xs">
                              ₹{t.balanceAmount?.toLocaleString('en-IN')}
                            </div>
                            {t.balancePaymentStatus === PaymentStatus.PAID ? (
                              <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                                ✓ Paid ({t.balancePayment?.paymentMethod || 'Cash'})
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Due at drop
                              </div>
                            )}
                          </td>

                          {/* 7. Tolls / Parking */}
                          <td className="py-3.5 px-4 align-top">
                            {t.tollAmount > 0 || t.parkingAmount > 0 ? (
                              <div className="space-y-0.5 text-[11px]">
                                {t.tollAmount > 0 && (
                                  <div className="text-amber-800 font-semibold font-mono">
                                    Toll: ₹{t.tollAmount.toLocaleString('en-IN')}
                                  </div>
                                )}
                                {t.parkingAmount > 0 && (
                                  <div className="text-sky-800 font-semibold font-mono">
                                    Park: ₹{t.parkingAmount.toLocaleString('en-IN')}
                                  </div>
                                )}
                                <div className="text-emerald-700 font-bold text-[10px]">
                                  +₹{(t.tollAmount + t.parkingAmount).toLocaleString('en-IN')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>

                          {/* 8. Driver Payout Mini-Card */}
                          <td className="py-3.5 px-4 align-top">
                            {t.driverName ? (
                              <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-2.5 text-xs min-w-[145px] space-y-1 shadow-2xs">
                                <div className="font-bold text-slate-900 text-[11px]">Driver Payout</div>
                                <div className="flex justify-between text-slate-500 text-[11px]">
                                  <span>Allowance</span>
                                  <span className="font-semibold text-slate-700">₹{(t.driverAllowance || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between text-slate-500 text-[11px]">
                                  <span>Payee</span>
                                  <span className="font-semibold text-slate-700">₹{(t.driverPayeeAmount || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between font-bold text-slate-900 text-[11px] pt-1 border-t border-slate-200">
                                  <span>Total</span>
                                  <span>₹{totalDriverEarning.toLocaleString('en-IN')}</span>
                                </div>
                                {isDriverPaid ? (
                                  <div className="mt-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold text-center flex items-center justify-center gap-1">
                                    <span>✓</span>
                                    <span>Driver Paid</span>
                                  </div>
                                ) : (
                                  <div className="mt-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold text-center flex items-center justify-center gap-1">
                                    <span>!</span>
                                    <span>Driver Unpaid</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No driver</span>
                            )}
                          </td>

                          {/* 9. Ride Status */}
                          <td className="py-3.5 px-4 align-top">
                            {t.status === 'TRIP_COMPLETED' ? (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Completed</span>
                              </span>
                            ) : t.status === 'CANCELLED' ? (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>Cancelled</span>
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span>{String(t.status).replace(/_/g, ' ')}</span>
                              </span>
                            )}
                          </td>

                          {/* 10. Actions */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex flex-col items-center gap-1.5 min-w-[125px]">
                              {/* Top row: Receipt & Edit buttons */}
                              <div className="flex items-center gap-1.5 w-full justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleShareWhatsAppReceipt(t)}
                                  className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition shadow-2xs cursor-pointer"
                                  title="Share WhatsApp Invoice / Receipt"
                                >
                                  <IconFileText className="w-4 h-4 text-slate-700" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(t)}
                                  className="w-8 h-8 flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition shadow-2xs border border-amber-200/50 cursor-pointer"
                                  title="Edit Allowance & Payee"
                                >
                                  <IconEdit className="w-4 h-4 text-amber-600" />
                                </button>
                              </div>

                              {/* Bottom row: Mark Paid Button or Status */}
                              {t.driverName && (
                                <div className="w-full">
                                  {isDriverPaid ? (
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => handleToggleDriverPayment(t.id, 'PENDING')}
                                      className="w-full px-2 py-1 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 rounded-lg text-[10px] font-semibold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                                      title="Mark Driver Unpaid"
                                    >
                                      <IconChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => handleToggleDriverPayment(t.id, 'PAID')}
                                      className="w-full px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                                    >
                                      {isProcessing ? (
                                        <span>...</span>
                                      ) : (
                                        <>
                                          <IconCheck className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                          <span>Mark Driver Paid</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile and Tablet Card View (< lg) */}
              <div className="block lg:hidden divide-y divide-slate-100">
                {transactions.map((t) => {
                  const isDriverPaid = t.driverPaymentStatus === 'PAID';
                  const isProcessing = actionLoadingId === t.id;
                  const totalDriverEarning = (t.driverAllowance || 0) + (t.driverPayeeAmount || 0);
                  const isExpanded = !!expandedCards[t.id];

                  return (
                    <div key={t.id} className="p-3.5 sm:p-4 transition hover:bg-slate-50/50">
                      {/* Top Row: Ref & Date + Ride Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 font-mono text-sm tracking-tight">
                              {t.humanReadableRef}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-md tracking-wider">
                              {t.tripType || 'ONEWAY'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <IconClock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>
                              {new Date(t.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Ride Status Badge */}
                        <div className="shrink-0">
                          {t.status === 'TRIP_COMPLETED' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Completed</span>
                            </span>
                          ) : t.status === 'CANCELLED' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1.5 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>Cancelled</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1.5 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              <span>{String(t.status).replace(/_/g, ' ')}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Summary Row: Customer, Driver, Fare */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-slate-100">
                        {/* Customer */}
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Customer</span>
                          <div className="flex items-center gap-1 text-xs font-bold text-slate-900 truncate mt-0.5" title={t.customerName}>
                            <IconUserSolid className="w-3 h-3 text-blue-600 shrink-0" />
                            <span className="truncate">{t.customerName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                            <IconPhone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span>{t.customerPhone}</span>
                          </div>
                        </div>

                        {/* Driver */}
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Driver</span>
                          {t.driverName ? (
                            <>
                              <div className="flex items-center gap-1 text-xs font-bold text-slate-900 truncate mt-0.5" title={t.driverName}>
                                <IconUserSolid className="w-3 h-3 text-blue-600 shrink-0" />
                                <span className="truncate">{t.driverName}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                                <IconPhone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span>{t.driverPhone}</span>
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-400 italic text-xs mt-0.5 block">Unassigned</span>
                          )}
                        </div>

                        {/* Total Fare */}
                        <div className="col-span-2 sm:col-span-1 flex flex-col justify-center sm:items-end">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block sm:text-right">Total Fare</span>
                          <div className="text-base font-extrabold text-slate-900 tracking-tight sm:text-right">
                            ₹{t.estimatedFare?.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium sm:text-right">
                            Adv: ₹{t.advanceAmount?.toLocaleString('en-IN')} • Bal: ₹{t.balanceAmount?.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      {/* Toggle View All / View Details Button */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        {/* Driver Payout Badge in collapsed view */}
                        <div>
                          {t.driverName && (
                            isDriverPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span>✓</span>
                                <span>Driver Paid</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <span>!</span>
                                <span>Driver Unpaid (₹{totalDriverEarning.toLocaleString('en-IN')})</span>
                              </span>
                            )
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleCardExpand(t.id)}
                          className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 transition shrink-0 shadow-2xs cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide Details' : 'View All Details'}</span>
                          <IconChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* Expanded Section (reveals all financial details and action buttons) */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-dashed border-slate-200 space-y-3 bg-slate-50/70 -mx-3.5 sm:-mx-4 -mb-3.5 sm:-mb-4 p-3.5 sm:p-4 rounded-b-2xl">
                          {/* 1. Advance & Balance Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Advance</span>
                              <div className="font-extrabold text-slate-900 text-sm mt-0.5">₹{t.advanceAmount?.toLocaleString('en-IN')}</div>
                              {t.advancePaymentStatus === PaymentStatus.PAID ? (
                                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                                  <span>✓</span> Paid
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-700 font-bold mt-0.5 block">Due</span>
                              )}
                            </div>

                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Balance</span>
                              <div className="font-extrabold text-slate-900 text-sm mt-0.5">₹{t.balanceAmount?.toLocaleString('en-IN')}</div>
                              {t.balancePaymentStatus === PaymentStatus.PAID ? (
                                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                                  <span>✓</span> Paid ({t.balancePayment?.paymentMethod || 'Cash'})
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 mt-0.5 block">Due at drop</span>
                              )}
                            </div>
                          </div>

                          {/* 2. Tolls & Parking (if any) */}
                          {(t.tollAmount > 0 || t.parkingAmount > 0) && (
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between text-xs">
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">Tolls & Parking</span>
                                <div className="flex gap-2 text-[11px] mt-0.5">
                                  {t.tollAmount > 0 && <span className="text-amber-800 font-semibold font-mono">Toll: ₹{t.tollAmount.toLocaleString('en-IN')}</span>}
                                  {t.parkingAmount > 0 && <span className="text-sky-800 font-semibold font-mono">Park: ₹{t.parkingAmount.toLocaleString('en-IN')}</span>}
                                </div>
                              </div>
                              <div className="text-sm font-black text-emerald-700">
                                +₹{(t.tollAmount + t.parkingAmount).toLocaleString('en-IN')}
                              </div>
                            </div>
                          )}

                          {/* 3. Driver Payout Breakdown */}
                          {t.driverName && (
                            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-1.5 text-xs">
                              <div className="flex justify-between items-center font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                                <span>Driver Payout Breakdown</span>
                                <span className="text-xs font-black text-slate-900">Total: ₹{totalDriverEarning.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between text-slate-500 text-[11px]">
                                <span>Allowance</span>
                                <span className="font-semibold text-slate-700">₹{(t.driverAllowance || 0).toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between text-slate-500 text-[11px]">
                                <span>Payee</span>
                                <span className="font-semibold text-slate-700">₹{(t.driverPayeeAmount || 0).toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          )}

                          {/* 4. Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleShareWhatsAppReceipt(t)}
                              className="flex-1 min-w-[130px] px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <IconFileText className="w-3.5 h-3.5 text-slate-700" />
                              <span>WhatsApp Receipt</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(t)}
                              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 text-amber-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <IconEdit className="w-3.5 h-3.5 text-amber-700" />
                              <span>Edit</span>
                            </button>

                            {t.driverName && (
                              isDriverPaid ? (
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => handleToggleDriverPayment(t.id, 'PENDING')}
                                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                                >
                                  <span>Mark Unpaid</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => handleToggleDriverPayment(t.id, 'PAID')}
                                  className="flex-1 min-w-[140px] px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                                >
                                  {isProcessing ? (
                                    <span>...</span>
                                  ) : (
                                    <>
                                      <IconCheck className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                      <span>Mark Driver Paid</span>
                                    </>
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Pagination Footer */}
          <div className="px-6 py-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-700">
                {transactions.length > 0 ? (page - 1) * pagination.limit + 1 : 0} – {Math.min(page * pagination.limit, pagination.totalCount)}
              </span> of <span className="font-semibold text-slate-700">{pagination.totalCount}</span> bookings
            </div>
            <div className="flex gap-1.5 items-center">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 rounded-lg transition flex items-center justify-center shadow-2xs"
                aria-label="Previous page"
              >
                <IconChevronLeft className="w-3.5 h-3.5 text-slate-600" />
              </button>
              {Array.from({ length: Math.min(pagination.totalPages || 1, 5) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                    page === p
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page >= (pagination.totalPages || 1)}
                onClick={() => setPage((p) => p + 1)}
                className="w-7 h-7 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 rounded-lg transition flex items-center justify-center shadow-2xs"
                aria-label="Next page"
              >
                <IconChevronRight className="w-3.5 h-3.5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Driver Payout Edit Modal */}
      {editModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center gap-1.5">
                  <span>💵</span> Edit Driver Payout
                </h3>
                <p className="text-xs text-amber-800 font-mono mt-0.5 font-bold">
                  {editModalBooking.humanReadableRef} • {editModalBooking.driverName || 'Driver'}
                </p>
              </div>
              <button
                onClick={() => setEditModalBooking(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">🚗 Driver Allowance (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={editAllowance}
                  onChange={(e) => setEditAllowance(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. 350"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Given at trip start / acceptance</span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">💰 Driver Final Payee (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={editPayee}
                  onChange={(e) => setEditPayee(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. 1800"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Settled after ride completion</span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">💳 Driver Payment Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="PAID">✓ DRIVER PAID (Settled)</option>
                  <option value="PENDING">✗ DRIVER UNPAID (Pending)</option>
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">Total Driver Amount:</span>
                <span className="text-emerald-800 font-black text-sm">
                  ₹{((parseFloat(editAllowance) || 0) + (parseFloat(editPayee) || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditModalBooking(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveDriverPayoutEdit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
              >
                {savingEdit ? <span>Saving...</span> : <span>💾 Save Payout</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Customer Balance Payment Modal */}
      {balanceModalBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>💵</span> Record Balance Payment — {balanceModalBooking.humanReadableRef}
              </h3>
              <button
                type="button"
                onClick={() => setBalanceModalBooking(null)}
                className="text-slate-400 hover:text-slate-700 p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="text-slate-600 flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold text-slate-900">{balanceModalBooking.customerName}</span>
                </div>
                <div className="text-slate-600 flex justify-between">
                  <span>Total Fare:</span>
                  <span className="font-bold text-slate-900">₹{balanceModalBooking.estimatedFare.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-slate-600 flex justify-between">
                  <span>Advance Paid:</span>
                  <span className="font-bold text-emerald-800">-₹{balanceModalBooking.advanceAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-900">Balance Due:</span>
                  <span className="font-black text-amber-800 text-base">₹{balanceModalBooking.balanceAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">💳 Payment Collection Method</label>
                <select
                  value={balanceMethod}
                  onChange={(e) => setBalanceMethod(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="UPI_QR">📱 UPI QR / GPay / PhonePe</option>
                  <option value="CASH">💵 Cash Collected by Driver / Office</option>
                  <option value="RAZORPAY">🌐 Online Razorpay Gateway</option>
                  <option value="BANK_TRANSFER">🏦 Direct Bank Transfer / NEFT</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">🔖 Transaction Reference / UTR (Optional)</label>
                <input
                  type="text"
                  value={balanceTxnRef}
                  onChange={(e) => setBalanceTxnRef(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. UPI Ref #426789123456"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">📝 Internal Note (Optional)</label>
                <input
                  type="text"
                  value={balanceNotes}
                  onChange={(e) => setBalanceNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. Received at drop location by driver"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setBalanceModalBooking(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingBalance}
                onClick={handleSaveBalancePayment}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1.5"
              >
                {savingBalance ? <span>Recording...</span> : <span>✓ Confirm & Generate Receipt</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
