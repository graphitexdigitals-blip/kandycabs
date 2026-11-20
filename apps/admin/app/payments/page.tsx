'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminNavbar } from '@/components/AdminNavbar';
import { AdminTaxInvoiceModal } from '@/components/AdminTaxInvoiceModal';
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
  IconCash,
  IconTicket,
} from '@/components/Icons';

export const dynamic = 'force-dynamic';

function formatPaymentDateTime(d?: string | Date | null): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatPaymentDateOnly(d?: string | Date | null): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

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

  // Cancellation Refund Modal States
  const [refundModalBooking, setRefundModalBooking] = useState<any | null>(null);
  const [refundAmountVal, setRefundAmountVal] = useState<string>('0');
  const [refundMethodVal, setRefundMethodVal] = useState<string>('UPI');
  const [refundTxnRefVal, setRefundTxnRefVal] = useState<string>('');
  const [refundNotesVal, setRefundNotesVal] = useState<string>('');
  const [savingRefund, setSavingRefund] = useState<boolean>(false);

  // Accordion state for mobile/tablet payment transaction cards
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const toggleCardExpand = (id: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Official Tax Invoice Modal State
  const [selectedInvoiceBooking, setSelectedInvoiceBooking] = useState<any | null>(null);

  // Bulk Invoices Download State
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);

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

  // Convert any Date to YYYY-MM-DD strictly in Indian Standard Time (IST)
  const toIstIsoDate = (d: Date = new Date()) => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  };

  const handleSelectPreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const todayStr = toIstIsoDate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = toIstIsoDate(yesterday);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'THIS_WEEK') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      setStartDate(toIstIsoDate(weekAgo));
      setEndDate(toIstIsoDate(now));
    } else if (preset === 'THIS_MONTH') {
      const istStr = toIstIsoDate(now);
      const [year, month] = istStr.split('-');
      setStartDate(`${year}-${month}-01`);
      setEndDate(istStr);
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
      const [y, m, d] = startDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
    if (startDate && endDate) {
      const [y1, m1, d1] = startDate.split('-').map(Number);
      const [y2, m2, d2] = endDate.split('-').map(Number);
      const date1 = new Date(y1, m1 - 1, d1);
      const date2 = new Date(y2, m2 - 1, d2);
      return `${date1.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${date2.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }
    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return `From ${dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
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
        setSummary(data.summary || {});
        setTransactions(data.transactions || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        setTransactions([]);
        console.error('Failed to load payments, status:', res.status);
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

  // Bulk Invoices ZIP Download
  const handleDownloadAllInvoicesZip = async () => {
    try {
      setDownloadingZip(true);
      const params = new URLSearchParams({
        status: statusFilter,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(search ? { search } : {}),
      });

      const res = await fetch(`/api/admin/payments/invoices-bulk?${params.toString()}`);
      if (!res.ok) {
        let errorMsg = 'Failed to generate invoice package.';
        try {
          const data = await res.json();
          errorMsg = data.error || data.message || errorMsg;
        } catch {
          errorMsg = `Server returned status ${res.status} (${res.statusText || 'Internal Server Error'}).`;
        }
        alert(errorMsg);
        return;
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.downloadUrl) {
          const a = document.createElement('a');
          a.href = data.downloadUrl;
          a.setAttribute('download', data.fileName || 'KandyCabs_Invoices.zip');
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          return;
        }
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const dateLabel =
        startDate && endDate
          ? `${startDate}_to_${endDate}`
          : startDate
          ? `From_${startDate}`
          : endDate
          ? `Until_${endDate}`
          : 'All_Dates';
      a.download = `KandyCabs_Invoices_${dateLabel}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download invoices zip:', err);
      alert('An error occurred while generating the invoices ZIP archive.');
    } finally {
      setDownloadingZip(false);
    }
  };

  // WhatsApp Share Functions
  const handleShareWhatsAppBill = (t: any) => {
    const rawPhone = t.customerPhone ? t.customerPhone.replace(/[^0-9]/g, '') : '';
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

    const webBaseUrl = typeof window !== 'undefined' ? window.location.origin.replace(':3001', ':3000') : 'http://localhost:3000';
    const payUrl = `${webBaseUrl}/pay/${t.humanReadableRef}`;

    const message = `*KANDY CABS — TRIP INVOICE & BALANCE DUE*
----------------------------------------
*Booking Ref:* ${t.humanReadableRef}
*Customer:* ${t.customerName}
*Trip Type:* ${t.tripType}

*FARE BREAKDOWN*
• Total Trip Fare: ₹${t.estimatedFare.toLocaleString('en-IN')}
• Advance Paid (Online): -₹${t.advanceAmount.toLocaleString('en-IN')} (Confirmed)
${t.tollAmount > 0 ? `• Tolls: +₹${t.tollAmount.toLocaleString('en-IN')}\n` : ''}${t.parkingAmount > 0 ? `• Parking: +₹${t.parkingAmount.toLocaleString('en-IN')}\n` : ''}----------------------------------------
*Pending Balance to Pay: ₹${t.balanceAmount.toLocaleString('en-IN')}*
----------------------------------------

*Pay Online & View Tax Invoice:*
${payUrl}

Thank you for traveling with Kandy Cabs!
Support: +91 9786452563`;

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

    const message = `*KANDY CABS — PAYMENT RECEIVED & CONFIRMED*
----------------------------------------
*Booking Ref:* ${t.humanReadableRef}
*Customer:* ${t.customerName}
*Receipt No:* RCP-${t.humanReadableRef}

*Balance Paid:* ₹${t.balanceAmount.toLocaleString('en-IN')}
*Status:* 100% SETTLED & PAID

*View & Download Tax Invoice Receipt:*
${receiptUrl}

Thank you for choosing Kandy Cabs Mangalore!
Support: +91 9786452563`;

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

  // Toggle Customer Pay Later Status
  const handleToggleCustomerPayLater = async (bookingId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          action: 'SET_PAY_LATER',
          customerPaysLater: !currentStatus,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === bookingId ? { ...t, isPayLater: !currentStatus } : t))
        );
      } else {
        alert(data.message || data.error || 'Failed to update Pay Later status');
      }
    } catch (err) {
      console.error('Error updating Pay Later status:', err);
      alert('Network error updating Pay Later status');
    }
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

  // Open Refund Modal
  const handleOpenRefundModal = (t: any) => {
    setRefundModalBooking(t);
    const due = t.cancellationData?.refundDue ?? Math.max(0, Number(t.advanceAmount || 0) - Number(t.cancellationData?.cancellationCharge || 0));
    setRefundAmountVal(String(due));
    setRefundMethodVal('UPI');
    setRefundTxnRefVal('');
    setRefundNotesVal('');
  };

  // Process / Record Refund Payment Done
  const handleProcessRefund = async () => {
    if (!refundModalBooking) return;
    const parsed = parseFloat(refundAmountVal);
    if (isNaN(parsed) || parsed <= 0) {
      alert('Please enter a valid refund amount');
      return;
    }
    setSavingRefund(true);
    try {
      const res = await fetch(`/api/admin/bookings/${refundModalBooking.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RECORD_REFUND',
          refundAmount: parsed,
          refundMethod: refundMethodVal,
          refundTxnRef: refundTxnRefVal,
          notes: refundNotesVal,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || 'Refund recorded successfully');
        setRefundModalBooking(null);
        fetchPayments();
      } else {
        alert(data.message || data.error || 'Failed to record refund');
      }
    } catch (err: any) {
      alert(err.message || 'Network error while recording refund');
    } finally {
      setSavingRefund(false);
    }
  };

  // Waive cancellation charge and allow 100% full advance refund
  const handleWaiveCancellationFee = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to waive the cancellation charge and grant 100% full advance refund to the customer?')) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'WAIVE_CANCELLATION_FEE',
          notes: 'Waived by Admin in Booking Ledger',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || 'Cancellation fee waived successfully');
        fetchPayments();
      } else {
        alert(data.message || data.error || 'Failed to waive cancellation fee');
      }
    } catch (err: any) {
      alert(err.message || 'Network error waiving cancellation fee');
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
    const rawPayee = Number(t.driverPayeeAmount || 0);
    const distanceKm = Number(t.distanceKm || 0);
    const driverRatePerKm = Number(t.driverRatePerKm || 10);
    const effectivePayee = rawPayee > 0 ? rawPayee : Math.round(distanceKm > 0 ? distanceKm * driverRatePerKm : 0);
    setEditPayee(String(effectivePayee));
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
    <div className="min-h-screen bg-[#f8fafc] text-[#0F172A] flex flex-col font-sans">
      <AdminNavbar />

      <main className="flex-1 w-full px-4 sm:px-6 lg:pl-6 lg:pr-24 py-6 sm:py-7 space-y-6">
        {/* Page Title & Top Actions Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#F95700] bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200/80">
                Finance & Settlements
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-slate-500">Live Accounting</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A] leading-tight">
              Revenue & Driver Payout Ledger
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Active customer collections, automated driver settlements, and verified profit margins.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => fetchPayments()}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-xs font-bold rounded-xl border border-[#E2E8F0] flex items-center gap-2 text-slate-700 transition shadow-2xs hover:shadow-xs cursor-pointer"
            >
              <IconRefresh className="w-3.5 h-3.5 text-slate-500" />
              <span>Refresh</span>
            </button>
            <div className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Sync</span>
            </div>
          </div>
        </div>

        {/* 4-Card Primary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* 1. Total Revenue */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 truncate">Total Revenue</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#F95700] ring-4 ring-orange-100 shrink-0" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[#0F172A] mt-3 tracking-tight truncate">
                ₹{(summary.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 mt-3 pt-3 border-t border-[#E2E8F0]">
              <span className="font-bold">↑</span>
              <span className="truncate">Verified customer receipts</span>
            </div>
          </div>

          {/* 2. Kandy Profit (Net) */}
          <div className="bg-white rounded-2xl border border-emerald-200/80 p-5 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group ring-1 ring-emerald-500/10">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 truncate">Kandy Profit (Net)</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 shrink-0" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-3 tracking-tight truncate">
                +₹{Math.max(0, (summary.totalRevenue || 0) - ((summary.totalDriverPaidAmount || 0) + (summary.totalDriverPendingAmount || 0))).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 mt-3 pt-3 border-t border-emerald-100/80">
              <span className="font-bold">↑</span>
              <span className="truncate">Net margin (Rev − Driver Cost)</span>
            </div>
          </div>

          {/* 3. Driver Unpaid (Pending) */}
          <div className="bg-white rounded-2xl border border-rose-200/80 p-5 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 truncate">Driver Unpaid</span>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-100 shrink-0" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[#0F172A] mt-3 tracking-tight truncate">
                ₹{(summary.totalDriverPendingAmount || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 mt-3 pt-3 border-t border-rose-100/80">
              <span className="font-bold">{summary.driverPendingCount || 0}</span>
              <span className="truncate">pending driver settlements</span>
            </div>
          </div>

          {/* 4. Driver Settled (Paid) */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 truncate">Driver Settled</span>
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-100 shrink-0" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[#0F172A] mt-3 tracking-tight truncate">
                ₹{(summary.totalDriverPaidAmount || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mt-3 pt-3 border-t border-[#E2E8F0]">
              <span className="font-bold">{summary.driverPaidCount || 0}</span>
              <span className="truncate">settled driver payouts</span>
            </div>
          </div>
        </div>

        {/* Secondary Summary Strip: Driver Cost & Collections */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-50 shrink-0" />
            <div>
              <span className="text-slate-400 font-medium">Total Driver Cost: </span>
              <span className="font-bold text-[#0F172A]">
                ₹{((summary.totalDriverPaidAmount || 0) + (summary.totalDriverPendingAmount || 0)).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 ring-4 ring-purple-50 shrink-0" />
            <div>
              <span className="text-slate-400 font-medium">Collections: </span>
              <span className="font-bold text-[#0F172A]">
                {summary.paidCount || 0} <span className="text-slate-400 font-normal">/ {summary.totalBookings || 0} fully settled</span>
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-2 flex-wrap text-slate-600">
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/60">
              {summary.customerNoPendingCount ?? summary.paidCount ?? 0} Full Paid
            </span>
            <span className="px-2 py-0.5 rounded-md bg-orange-50 text-[#F95700] font-semibold border border-orange-200/80">
              {summary.customerAdvReceivedCount ?? 0} Advance
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold border border-amber-200/60">
              {summary.customerAdvBalancePendingCount ?? summary.partiallyPaidCount ?? 0} Balance Due
            </span>
            {(summary.cancelledCount ?? 0) > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold border border-rose-200/60">
                {summary.cancelledCount} Cancelled
              </span>
            )}
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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-[#F95700] text-white shadow-sm shadow-[#F95700]/25'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0]'
              }`}
            >
              <IconGrid className="w-3.5 h-3.5" />
              <span>All Bookings</span>
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  statusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
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
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'DRIVER_PAID'
                  ? 'bg-[#0F172A] text-white font-bold shadow-sm shadow-slate-900/25'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0]'
              }`}
            >
              <span>✓ Driver Paid</span>
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  statusFilter === 'DRIVER_PAID' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {summary.driverPaidCount || 0}
              </span>
            </button>

            {/* Driver Unpaid */}
            <button
              onClick={() => {
                setStatusFilter('DRIVER_UNPAID');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'DRIVER_UNPAID'
                  ? 'bg-[#0F172A] text-white font-bold shadow-sm shadow-slate-900/25'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0]'
              }`}
            >
              <span>✕ Driver Unpaid</span>
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  statusFilter === 'DRIVER_UNPAID' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {summary.driverPendingCount || 0}
              </span>
            </button>

            {/* 1. Customer Amount Received (No Pending) */}
            <button
              onClick={() => {
                setStatusFilter('CUSTOMER_NO_PENDING');
                setPage(1);
              }}
              title="All bookings where customer payment is fully settled with ₹0 pending balance"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'CUSTOMER_NO_PENDING'
                  ? 'bg-[#F95700] text-white font-bold shadow-sm shadow-[#F95700]/25'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0]'
              }`}
            >
              <IconCheck className={`w-3.5 h-3.5 ${statusFilter === 'CUSTOMER_NO_PENDING' ? 'text-white' : 'text-emerald-600'}`} strokeWidth={2.5} />
              <span>Customer Paid (No Pending)</span>
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  statusFilter === 'CUSTOMER_NO_PENDING' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {summary.customerNoPendingCount ?? summary.paidCount ?? 0}
              </span>
            </button>

            {/* 2. Customer Full Payment (100% Upfront) */}
            <button
              onClick={() => {
                setStatusFilter('CUSTOMER_FULL_PAYMENT');
                setPage(1);
              }}
              title="Bookings where customer paid 100% full payment upfront at booking time"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'CUSTOMER_FULL_PAYMENT'
                  ? 'bg-[#F95700] text-white font-bold shadow-sm shadow-[#F95700]/25'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0]'
              }`}
            >
              <IconPayments className={`w-3.5 h-3.5 ${statusFilter === 'CUSTOMER_FULL_PAYMENT' ? 'text-white' : 'text-[#F95700]'}`} />
              <span>Customer Full Payment</span>
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  statusFilter === 'CUSTOMER_FULL_PAYMENT' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {summary.customerFullPaymentCount ?? 0}
              </span>
            </button>

            {/* 3. Customer Advance Received */}
            <button
              onClick={() => {
                setStatusFilter('CUSTOMER_ADV_RECEIVED');
                setPage(1);
              }}
              title="All bookings where customer advance payment has been confirmed"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'CUSTOMER_ADV_RECEIVED'
                  ? 'bg-[#F95700] text-white font-bold shadow-sm shadow-[#F95700]/25'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0]'
              }`}
            >
              <IconPayments className={`w-3.5 h-3.5 ${statusFilter === 'CUSTOMER_ADV_RECEIVED' ? 'text-white' : 'text-[#F95700]'}`} />
              <span>Customer Advance</span>
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  statusFilter === 'CUSTOMER_ADV_RECEIVED' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {summary.customerAdvReceivedCount ?? 0}
              </span>
            </button>

            {/* 4. Customer Advance Paid (Balance Due) */}
            <button
              onClick={() => {
                setStatusFilter('CUSTOMER_ADV_BALANCE_PENDING');
                setPage(1);
              }}
              title="Customer paid advance, but remaining balance is still pending (due at drop)"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'CUSTOMER_ADV_BALANCE_PENDING'
                  ? 'bg-amber-500 text-white font-bold shadow-xs'
                  : 'bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 font-semibold'
              }`}
            >
              <IconClock className={`w-3.5 h-3.5 ${statusFilter === 'CUSTOMER_ADV_BALANCE_PENDING' ? 'text-white' : 'text-amber-600'}`} />
              <span>Adv Paid (Balance Due)</span>
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  statusFilter === 'CUSTOMER_ADV_BALANCE_PENDING' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {summary.customerAdvBalancePendingCount ?? summary.partiallyPaidCount ?? 0}
              </span>
            </button>

            {/* 5. Customer Pending */}
            <button
              onClick={() => {
                setStatusFilter('CUSTOMER_PENDING');
                setPage(1);
              }}
              title="All bookings where customer payment is pending"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'CUSTOMER_PENDING'
                  ? 'bg-amber-500 text-white font-bold shadow-xs'
                  : 'bg-white hover:bg-amber-50 text-amber-900 border border-amber-200 font-semibold'
              }`}
            >
              <IconClock className={`w-3.5 h-3.5 ${statusFilter === 'CUSTOMER_PENDING' ? 'text-white' : 'text-amber-600'}`} />
              <span>Customer Pending</span>
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  statusFilter === 'CUSTOMER_PENDING' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {summary.customerPendingCount ?? summary.pendingCount ?? 0}
              </span>
            </button>

            {/* 6. Cancelled Bookings */}
            <button
              onClick={() => {
                setStatusFilter('CANCELLED');
                setPage(1);
              }}
              title="All cancelled bookings with cancellation charges & refund records"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
                statusFilter === 'CANCELLED'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-semibold'
              }`}
            >
              <IconCross className={`w-3.5 h-3.5 ${statusFilter === 'CANCELLED' ? 'text-white' : 'text-rose-600'}`} />
              <span>Cancelled</span>
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  statusFilter === 'CANCELLED' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {summary.cancelledCount ?? 0}
              </span>
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 items-center w-full lg:w-auto">
            <div className="relative flex-1 lg:w-72">
              <IconSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search ref, phone, driver..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F95700]/20 focus:border-[#F95700] shadow-2xs transition"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#F95700] hover:bg-[#e04e00] text-white text-xs font-bold rounded-xl transition shadow-sm shadow-[#F95700]/25 shrink-0 cursor-pointer"
            >
              Search
            </button>
          </form>
        </div>

        {/* Transactions Table Card: Booking Ledger */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
          {/* Card Header Row */}
          <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 border-b border-[#E2E8F0] bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F95700] flex items-center justify-center font-bold">
                <IconList className="w-4 h-4" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A] tracking-tight">Booking Ledger</h2>
                <p className="text-[11px] text-slate-500 font-medium">Verified trip records, payments & driver payouts</p>
              </div>
              <span className="ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                {pagination.totalCount || transactions.length}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
              {/* One-Click Download All Invoices ZIP Folder (Kandy Orange Style) */}
              <button
                type="button"
                onClick={handleDownloadAllInvoicesZip}
                disabled={downloadingZip}
                className="px-4 py-2 bg-[#F95700] hover:bg-[#e04e00] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm shadow-[#F95700]/25 transition cursor-pointer disabled:opacity-50 shrink-0"
                title="Download all tax invoices as PDF files in a single folder for selected dates"
              >
                {downloadingZip ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating PDFs...</span>
                  </>
                ) : (
                  <>
                    <IconFileText className="w-3.5 h-3.5 text-white" />
                    <span className="hidden sm:inline">Download Invoices (PDF)</span>
                    <span className="sm:hidden">Invoices (PDF)</span>
                  </>
                )}
              </button>

              {/* Select Date Dropdown Button */}
              <div className="relative" ref={dateDropdownRef}>
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsDateDropdownOpen((prev) => !prev)}
                  className={`px-3.5 py-2 bg-white hover:bg-slate-50 border rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs transition cursor-pointer ${
                    startDate ? 'border-[#F95700] bg-orange-50/60 text-[#0F172A] font-bold' : 'border-[#E2E8F0] text-slate-700'
                  }`}
                >
                  <IconCalendar className={`w-3.5 h-3.5 ${startDate ? 'text-[#F95700]' : 'text-slate-500'}`} />
                  <span className="truncate max-w-[130px] sm:max-w-none">{getDateButtonLabel()}</span>
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
        </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
              <div>Loading financial ledger & driver payouts...</div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <div>No payment transactions found matching the filter criteria.</div>
            </div>
          ) : (
            <>
              {/* Desktop Table View (lg and up) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200/90 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-4 px-4">Booking Ref<br /><span className="text-[10px] text-slate-400 font-normal lowercase tracking-normal">/ date</span></th>
                      <th className="py-4 px-4">Customer</th>
                      <th className="py-4 px-4">Assigned Driver</th>
                      <th className="py-4 px-4">Total Fare</th>
                      <th className="py-4 px-4">Advance</th>
                      <th className="py-4 px-4">Balance</th>
                      <th className="py-4 px-4 text-rose-700">Refund</th>
                      <th className="py-4 px-4">Tolls /<br /><span className="text-[10px] text-slate-400 font-normal lowercase tracking-normal">parking</span></th>
                      <th className="py-4 px-4">Driver Payout<br /><span className="text-[10px] text-amber-700 font-bold lowercase tracking-normal">/km + allowance</span></th>
                      <th className="py-4 px-4 text-emerald-800">Kandy Profit<br /><span className="text-[10px] text-emerald-600 font-bold lowercase tracking-normal">revenue − driver</span></th>
                      <th className="py-4 px-4">Ride Status</th>
                      <th className="py-4 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/90">
                    {transactions.map((t) => {
                      const isDriverPaid = t.driverPaymentStatus === 'PAID';
                      const isProcessing = actionLoadingId === t.id;
                      const distanceKm = Number(t.distanceKm || 0);
                      const driverRatePerKm = Number(t.driverRatePerKm || 10);
                      const rawPayee = Number(t.driverPayeeAmount || 0);
                      const driverKmPayout = rawPayee > 0 ? rawPayee : Math.round(distanceKm > 0 ? distanceKm * driverRatePerKm : 0);
                      const driverAllowance = Number(t.driverAllowance || 0);
                      const totalDriverPayout = (driverKmPayout + driverAllowance) > 0 ? (driverKmPayout + driverAllowance) : (driverAllowance || 300);
                      const kandyProfit = Math.max(0, Number(t.estimatedFare || 0) - totalDriverPayout);
                      const isTripDone = t.status === 'TRIP_COMPLETED' || t.status === 'COMPLETED';
                      const isFullyPaid =
                        Number(t.balanceAmount || 0) <= 0 ||
                        t.balancePaymentStatus === PaymentStatus.PAID ||
                        (Number(t.advanceAmount || 0) >= Number(t.estimatedFare || 0) && t.advancePaymentStatus === PaymentStatus.PAID);

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/80 transition">
                          {/* 1. Booking Ref / Date */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-extrabold text-slate-900 font-mono text-xs">
                              {t.humanReadableRef}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
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
                              <IconUserSolid className="w-3.5 h-3.5 text-slate-500 shrink-0" />
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
                                  <IconUserSolid className="w-3.5 h-3.5 text-slate-500 shrink-0" />
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

                          {/* 4. Total Fare & Margin */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                              ₹{t.estimatedFare?.toLocaleString('en-IN')}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold block">
                              Customer Pays
                            </span>
                            <div className="mt-1 space-y-0.5">
                              <span className="text-[10.5px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block">
                                Profit: +₹{kandyProfit.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </td>

                          {/* 5. Advance */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-semibold text-slate-800 text-xs">
                              ₹{t.advanceAmount?.toLocaleString('en-IN')}
                            </div>
                            {t.advancePaymentStatus === PaymentStatus.PAID ? (
                              <div className="mt-0.5">
                                <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                                  <span>✓ Paid</span>
                                  {t.advancePayment?.paymentMethod && (
                                    <span className="text-slate-400 font-normal">({t.advancePayment.paymentMethod})</span>
                                  )}
                                </div>
                                <div className="text-[9.5px] text-slate-500 font-medium">
                                  {formatPaymentDateTime(t.advancePaidDate || t.advancePayment?.verifiedAt || t.createdAt)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                                Due
                              </div>
                            )}
                          </td>

                          {/* 6. Balance */}
                          <td className="py-3.5 px-4 align-top">
                            {t.status === 'CANCELLED' ? (
                              <div>
                                <div className="font-semibold text-slate-400 text-xs line-through">
                                  ₹{t.balanceAmount?.toLocaleString('en-IN')}
                                </div>
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 mt-0.5">
                                  Cancelled
                                </span>
                              </div>
                            ) : isFullyPaid ? (
                              <div>
                                <div className="font-semibold text-slate-800 text-xs">
                                  ₹{t.balanceAmount?.toLocaleString('en-IN') || 0}
                                </div>
                                <div className="text-[10px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                                  <span>{Number(t.advanceAmount || 0) >= Number(t.estimatedFare || 0) ? '✓ Full Paid' : '✓ Paid in Full'}</span>
                                  {t.balancePayment?.paymentMethod && (
                                    <span className="text-slate-500 font-normal">({t.balancePayment.paymentMethod})</span>
                                  )}
                                </div>
                                <div className="text-[9.5px] text-slate-500 font-medium mt-0.5">
                                  {Number(t.advanceAmount || 0) >= Number(t.estimatedFare || 0)
                                    ? formatPaymentDateTime(t.fullPaymentDate || t.advancePaidDate || t.createdAt)
                                    : formatPaymentDateTime(t.balancePaidDate || t.balancePayment?.verifiedAt || t.createdAt)}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="font-semibold text-slate-800 text-xs">
                                  ₹{t.balanceAmount?.toLocaleString('en-IN')}
                                </div>
                                <div className="mt-1 space-y-1">
                                  <div>
                                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                                      isTripDone
                                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                                        : t.isPayLater
                                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}>
                                      <span>
                                        {isTripDone
                                          ? 'Balance Pending'
                                          : t.isPayLater
                                          ? 'Pay Later (Pending)'
                                          : 'Due at drop'}
                                      </span>
                                    </span>
                                  </div>
                                  <div className="text-[9.5px] text-amber-800 font-medium">
                                    {t.isPayLater
                                      ? `Pending since ${formatPaymentDateOnly(t.createdAt)}`
                                      : `Due: ${formatPaymentDateOnly(t.scheduledAt || t.balanceDueDate || t.createdAt)}`}
                                  </div>
                                  <div className="flex flex-col gap-1 pt-0.5">
                                    {isTripDone && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenBalanceModal(t);
                                        }}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-md text-[10px] font-black shadow-2xs transition flex items-center justify-center gap-1 cursor-pointer"
                                        title="Admin: Pay / Record Customer Balance Amount"
                                      >
                                        <IconCash className="w-3 h-3 text-white" />
                                        <span>Pay Amount / Settle</span>
                                      </button>
                                    )}
                                    {!isTripDone && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleCustomerPayLater(t.id, Boolean(t.isPayLater));
                                        }}
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition text-center cursor-pointer ${
                                          t.isPayLater
                                            ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-rose-50 hover:text-rose-700'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-800'
                                        }`}
                                        title={t.isPayLater ? 'Remove Pay Later status' : 'Designate customer to pay later (reflects ₹0 for driver)'}
                                      >
                                        {t.isPayLater ? '✓ Customer Pays Later' : '+ Mark Pay Later'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </td>

                          {/* 7. Refund (Separate Column) */}
                          <td className="py-3.5 px-4 align-top">
                            {t.status === 'CANCELLED' || t.cancellationData || t.advancePaymentStatus === PaymentStatus.REFUNDED ? (
                              <div className="space-y-1.5 text-[11px] min-w-[155px]">
                                {/* Cancellation Charge Display */}
                                <div className="flex items-center justify-between gap-1 text-[10px]">
                                  <span className="text-slate-500 font-medium">Cancellation Fee:</span>
                                  <span className={`font-black px-1.5 py-0.5 rounded ${
                                    (t.cancellationData?.cancellationCharge ?? 0) > 0
                                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  }`}>
                                    {(t.cancellationData?.cancellationCharge ?? 0) > 0
                                      ? `₹${Number(t.cancellationData?.cancellationCharge).toLocaleString('en-IN')}`
                                      : '₹0 (Waived/Free)'}
                                  </span>
                                </div>

                                {/* Refund Due Display */}
                                <div className="flex items-center justify-between gap-1 text-[10px]">
                                  <span className="text-slate-500 font-medium">Refund Amount:</span>
                                  <span className="font-extrabold text-slate-900 text-xs">
                                    ₹{Number(t.cancellationData?.refundDue ?? Math.max(0, Number(t.advanceAmount || 0) - Number(t.cancellationData?.cancellationCharge || 0))).toLocaleString('en-IN')}
                                  </span>
                                </div>

                                {/* Refund Status & Admin Action */}
                                {t.cancellationData?.isRefundDone ? (
                                  <div className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                    <span>✓ Refund Done</span>
                                    {t.cancellationData.refundDetails?.method && (
                                      <span className="font-normal text-emerald-600">({t.cancellationData.refundDetails.method})</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-1 pt-0.5">
                                    {(t.cancellationData?.refundDue ?? Math.max(0, Number(t.advanceAmount || 0) - Number(t.cancellationData?.cancellationCharge || 0))) > 0 ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenRefundModal(t);
                                        }}
                                        className="w-full px-2 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded text-[10px] font-black shadow-2xs transition flex items-center justify-center gap-1 cursor-pointer"
                                        title="Record refund sent to customer"
                                      >
                                        <span>Process Refund</span>
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-medium block">
                                        No refund due
                                      </span>
                                    )}

                                    {/* Option to waive cancellation fee & refund full advance */}
                                    {(t.cancellationData?.cancellationCharge ?? 0) > 0 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleWaiveCancellationFee(t.id);
                                        }}
                                        className="w-full px-1.5 py-0.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded text-[9px] font-bold transition text-center cursor-pointer"
                                        title="Waive the cancellation charge and grant full advance refund"
                                      >
                                        + Waive Fee & Full Refund
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
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

                          {/* 8. Driver Payout Mini-Card (/KM + Allowance) */}
                          <td className="py-3.5 px-4 align-top">
                            {t.driverName ? (
                              <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-2.5 text-xs min-w-[155px] space-y-1 shadow-2xs">
                                <div className="font-bold text-slate-900 text-[11px] flex justify-between items-center">
                                  <span>Driver Payout</span>
                                  <span className="text-[10px] text-amber-900 font-extrabold bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-200">
                                    ₹{driverRatePerKm}/km
                                  </span>
                                </div>
                                <div className="flex justify-between text-slate-600 text-[11px]">
                                  <span>KM ({distanceKm > 0 ? `${distanceKm} km` : 'Base'})</span>
                                  <span className="font-semibold text-slate-800">₹{driverKmPayout.toLocaleString('en-IN')}</span>
                                </div>
                                {driverAllowance > 0 && (
                                  <div className="flex justify-between text-slate-600 text-[11px]">
                                    <span>Allowance</span>
                                    <span className="font-semibold text-slate-800">₹{driverAllowance.toLocaleString('en-IN')}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-bold text-slate-900 text-[11px] pt-1 border-t border-slate-200">
                                  <span>Total Payout</span>
                                  <span className="text-slate-900 font-black">₹{totalDriverPayout.toLocaleString('en-IN')}</span>
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

                          {/* 9. Kandy Cabs Profit Dedicated Column */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 text-xs min-w-[135px] space-y-1 shadow-2xs">
                              <div className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center justify-between">
                                <span>Kandy Cabs Profit</span>
                                <IconTrendingUp className="w-3 h-3 text-emerald-600" />
                              </div>
                              <div className="text-sm font-black text-emerald-900">
                                +₹{kandyProfit.toLocaleString('en-IN')}
                              </div>
                              <div className="text-[10px] text-slate-500 flex justify-between pt-0.5 border-t border-emerald-100">
                                <span>Customer:</span>
                                <span className="font-semibold text-slate-700">₹{(t.estimatedFare || 0).toLocaleString('en-IN')}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 flex justify-between">
                                <span>Driver:</span>
                                <span className="font-semibold text-rose-700">-₹{totalDriverPayout.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
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
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-[#F95700] border border-orange-200/80 inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#F95700] animate-pulse" />
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
                                  onClick={() => setSelectedInvoiceBooking(t)}
                                  className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition shadow-2xs cursor-pointer"
                                  title="View & Download Official Tax Invoice (PDF)"
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
                  const distanceKm = Number(t.distanceKm || 0);
                  const driverRatePerKm = Number(t.driverRatePerKm || 10);
                  const rawPayee = Number(t.driverPayeeAmount || 0);
                  const driverKmPayout = rawPayee > 0 ? rawPayee : Math.round(distanceKm > 0 ? distanceKm * driverRatePerKm : 0);
                  const driverAllowance = Number(t.driverAllowance || 0);
                  const totalDriverPayout = (driverKmPayout + driverAllowance) > 0 ? (driverKmPayout + driverAllowance) : (driverAllowance || 300);
                  const totalDriverEarning = totalDriverPayout;
                  const kandyProfit = Math.max(0, Number(t.estimatedFare || 0) - totalDriverPayout);
                  const isExpanded = !!expandedCards[t.id];
                  const isTripDone = t.status === 'TRIP_COMPLETED' || t.status === 'COMPLETED';
                  const isFullyPaid =
                    Number(t.balanceAmount || 0) <= 0 ||
                    t.balancePaymentStatus === PaymentStatus.PAID ||
                    (Number(t.advanceAmount || 0) >= Number(t.estimatedFare || 0) && t.advancePaymentStatus === PaymentStatus.PAID);

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
                          <div className="text-[11px] text-slate-400 mt-0.5">
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
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-[#F95700] border border-orange-200/80 inline-flex items-center gap-1.5 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#F95700] animate-pulse" />
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
                            <IconUserSolid className="w-3 h-3 text-slate-500 shrink-0" />
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
                                <IconUserSolid className="w-3 h-3 text-slate-500 shrink-0" />
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

                        {/* Total Fare & Profit */}
                        <div className="col-span-2 sm:col-span-1 flex flex-col justify-center sm:items-end">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block sm:text-right">Customer Pays</span>
                          <div className="text-base font-extrabold text-slate-900 tracking-tight sm:text-right">
                            ₹{t.estimatedFare?.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10.5px] font-bold text-indigo-700 sm:text-right">
                            Driver: ₹{totalDriverEarning.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10.5px] font-black text-emerald-700 sm:text-right">
                            Profit: +₹{Math.max(0, (t.estimatedFare || 0) - totalDriverEarning).toLocaleString('en-IN')}
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
                                <div className="mt-0.5">
                                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                                    <span>✓</span> Paid
                                  </span>
                                  <span className="text-[9.5px] text-slate-500 font-medium block">
                                    {formatPaymentDateTime(t.advancePaidDate || t.advancePayment?.verifiedAt || t.createdAt)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-amber-700 font-bold mt-0.5 block">Due</span>
                              )}
                            </div>

                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Balance</span>
                              <div className={`font-extrabold text-sm mt-0.5 ${t.status === 'CANCELLED' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                ₹{t.balanceAmount?.toLocaleString('en-IN')}
                              </div>
                              {t.status === 'CANCELLED' ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 mt-1">
                                  Cancelled
                                </span>
                              ) : isFullyPaid ? (
                                <div className="mt-0.5">
                                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                                    <span>✓</span> {Number(t.advanceAmount || 0) >= Number(t.estimatedFare || 0) ? 'Full Paid' : 'Paid in Full'} {t.balancePayment?.paymentMethod ? `(${t.balancePayment.paymentMethod})` : ''}
                                  </span>
                                  <span className="text-[9.5px] text-slate-500 font-medium block">
                                    {Number(t.advanceAmount || 0) >= Number(t.estimatedFare || 0)
                                      ? formatPaymentDateTime(t.fullPaymentDate || t.advancePaidDate || t.createdAt)
                                      : formatPaymentDateTime(t.balancePaidDate || t.balancePayment?.verifiedAt || t.createdAt)}
                                  </span>
                                </div>
                              ) : (
                                <div className="mt-1 space-y-1">
                                  <span className={`text-[10px] font-bold block ${isTripDone || t.isPayLater ? 'text-amber-800' : 'text-slate-500'}`}>
                                    {isTripDone ? 'Balance Pending' : t.isPayLater ? 'Pay Later (Pending)' : 'Due at drop'}
                                  </span>
                                  <span className="text-[9.5px] text-amber-800 font-medium block">
                                    {t.isPayLater
                                      ? `Pending since ${formatPaymentDateOnly(t.createdAt)}`
                                      : `Due: ${formatPaymentDateOnly(t.scheduledAt || t.balanceDueDate || t.createdAt)}`}
                                  </span>
                                  {isTripDone && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenBalanceModal(t)}
                                      className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-2xs transition flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <IconCash className="w-3 h-3 text-white" />
                                      <span>Pay Amount</span>
                                    </button>
                                  )}
                                  {!isTripDone && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCustomerPayLater(t.id, Boolean(t.isPayLater))}
                                      className="w-full py-0.5 bg-slate-50 border border-slate-200 hover:bg-amber-50 text-slate-700 hover:text-amber-900 rounded text-[9px] font-bold transition text-center cursor-pointer"
                                    >
                                      {t.isPayLater ? '✓ Customer Pays Later' : '+ Mark Pay Later'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 2. Separate Refund Card (Mobile - if cancelled or refund due) */}
                          {(t.status === 'CANCELLED' || t.cancellationData || t.advancePaymentStatus === PaymentStatus.REFUNDED) && (
                            <div className="bg-rose-50/70 p-2.5 rounded-xl border border-rose-200/90 shadow-2xs text-xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-rose-800 uppercase font-black tracking-wider">Refund Column</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  (t.cancellationData?.cancellationCharge ?? 0) > 0
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  Fee: ₹{t.cancellationData?.cancellationCharge ?? 0}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-700">
                                <span className="text-[11px] font-medium">Refund Amount:</span>
                                <span className="font-black text-slate-900 text-xs">
                                  ₹{Number(t.cancellationData?.refundDue ?? Math.max(0, Number(t.advanceAmount || 0) - Number(t.cancellationData?.cancellationCharge || 0))).toLocaleString('en-IN')}
                                </span>
                              </div>
                              {t.cancellationData?.isRefundDone ? (
                                <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded block text-center">
                                  ✓ Refund Done ({t.cancellationData.refundDetails?.method || 'UPI'})
                                </span>
                              ) : (
                                <div className="flex gap-2 pt-1">
                                  {(t.cancellationData?.refundDue ?? 0) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRefundModal(t)}
                                      className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded text-[10px] font-bold shadow-2xs transition text-center cursor-pointer"
                                    >
                                      Process Refund
                                    </button>
                                  )}
                                  {(t.cancellationData?.cancellationCharge ?? 0) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleWaiveCancellationFee(t.id)}
                                      className="py-1 px-2 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 rounded text-[9px] font-bold transition text-center cursor-pointer"
                                    >
                                      + Waive Fee
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

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
                                <span className="text-[10px] text-amber-900 font-extrabold bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-200">
                                  ₹{driverRatePerKm}/km
                                </span>
                              </div>
                              <div className="flex justify-between text-slate-600 text-[11px]">
                                <span>KM ({distanceKm > 0 ? `${distanceKm} km` : 'Base'})</span>
                                <span className="font-semibold text-slate-800">₹{driverKmPayout.toLocaleString('en-IN')}</span>
                              </div>
                              {driverAllowance > 0 && (
                                <div className="flex justify-between text-slate-600 text-[11px]">
                                  <span>Allowance</span>
                                  <span className="font-semibold text-slate-800">₹{driverAllowance.toLocaleString('en-IN')}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold text-slate-900 text-[11px] pt-1 border-t border-slate-200">
                                <span>Total Driver Payout</span>
                                <span className="text-slate-900 font-black">₹{totalDriverPayout.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between font-bold text-emerald-800 text-[11px] pt-1 border-t border-emerald-100 bg-emerald-50/50 -mx-3 -mb-3 p-2 rounded-b-xl">
                                <span>Kandy Cabs Profit</span>
                                <span className="font-black">+₹{kandyProfit.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          )}

                          {/* 4. Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceBooking(t)}
                              className="flex-1 min-w-[130px] px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <IconFileText className="w-3.5 h-3.5 text-slate-700" />
                              <span>Tax Invoice (PDF)</span>
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
                  Edit Driver Payout
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
                <label className="block text-slate-700 font-bold mb-1">Driver Allowance (₹)</label>
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
                <label className="block text-slate-700 font-bold mb-1">Driver Final Payee (₹)</label>
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
                <label className="block text-slate-700 font-bold mb-1">Driver Payment Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="PAID">DRIVER PAID (Settled)</option>
                  <option value="PENDING">DRIVER UNPAID (Pending)</option>
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
                {savingEdit ? <span>Saving...</span> : <span>Save Payout</span>}
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
                Record Balance Payment — {balanceModalBooking.humanReadableRef}
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
                <label className="block text-slate-700 font-bold mb-1">Payment Collection Method</label>
                <select
                  value={balanceMethod}
                  onChange={(e) => setBalanceMethod(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="UPI_QR">UPI QR / GPay / PhonePe</option>
                  <option value="CASH">Cash Collected by Driver / Office</option>
                  <option value="RAZORPAY">Online Razorpay Gateway</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer / NEFT</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Transaction Reference / UTR (Optional)</label>
                <input
                  type="text"
                  value={balanceTxnRef}
                  onChange={(e) => setBalanceTxnRef(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="e.g. UPI Ref #426789123456"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Internal Note (Optional)</label>
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

      {/* Record Customer Refund Modal */}
      {refundModalBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Process Customer Refund</span>
                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {refundModalBooking.humanReadableRef}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setRefundModalBooking(null)}
                className="text-slate-400 hover:text-slate-700 p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Financial Breakdown */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="text-slate-600 flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold text-slate-900">{refundModalBooking.customerName}</span>
                </div>
                <div className="text-slate-600 flex justify-between">
                  <span>Customer Phone:</span>
                  <span className="font-mono font-medium text-slate-900">{refundModalBooking.customerPhone || '—'}</span>
                </div>
                <div className="text-slate-600 flex justify-between">
                  <span>Advance Paid:</span>
                  <span className="font-bold text-emerald-700">₹{Number(refundModalBooking.advanceAmount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-slate-600 flex justify-between">
                  <span>Cancellation Fee:</span>
                  <span className="font-bold text-rose-700">
                    -₹{Number(refundModalBooking.cancellationData?.cancellationCharge ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-900">Refund Amount Due:</span>
                  <span className="font-black text-emerald-700 text-base">
                    ₹{Number(refundModalBooking.cancellationData?.refundDue ?? Math.max(0, Number(refundModalBooking.advanceAmount || 0) - Number(refundModalBooking.cancellationData?.cancellationCharge || 0))).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Refund Amount Input */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Refund Amount to Customer (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={refundAmountVal}
                  onChange={(e) => setRefundAmountVal(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. 1506"
                />
              </div>

              {/* Refund Method */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Refund Method</label>
                <select
                  value={refundMethodVal}
                  onChange={(e) => setRefundMethodVal(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="UPI">UPI Transfer (GPay / PhonePe / Paytm)</option>
                  <option value="BANK_TRANSFER">Bank NEFT / IMPS / RTGS</option>
                  <option value="ORIGINAL_GATEWAY">Razorpay / Original Gateway</option>
                  <option value="CASH">Cash Refund</option>
                </select>
              </div>

              {/* Transaction Reference / UTR */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Transaction Reference / UTR (Optional)</label>
                <input
                  type="text"
                  value={refundTxnRefVal}
                  onChange={(e) => setRefundTxnRefVal(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. UPI Ref #426789123456"
                />
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Internal Note (Optional)</label>
                <input
                  type="text"
                  value={refundNotesVal}
                  onChange={(e) => setRefundNotesVal(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Sent via UPI to customer's GPay number"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRefundModalBooking(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingRefund}
                onClick={handleProcessRefund}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {savingRefund ? <span>Processing...</span> : <span>✓ Confirm Refund Done</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Tax Invoice Modal (PDF View, Download, Share) */}
      {selectedInvoiceBooking && (
        <AdminTaxInvoiceModal
          booking={selectedInvoiceBooking}
          isOpen={!!selectedInvoiceBooking}
          onClose={() => setSelectedInvoiceBooking(null)}
        />
      )}
    </div>
  );
}
