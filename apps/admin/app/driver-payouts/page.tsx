'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IconWallet,
  IconSearch,
  IconRefresh,
  IconCheck,
  IconX,
  IconTrendingUp,
  IconFileText,
  IconShield,
  IconClock,
  IconCheckCircle,
  IconAlert,
  IconPhone,
  IconCar,
  IconBuilding,
} from '@/components/Icons';

interface DriverWalletItem {
  id: string;
  userId: string;
  name: string;
  phone: string;
  plateNumber: string;
  category: string;
  verificationStatus: string;
  payoutMethod: 'BANK' | 'UPI' | string;
  bankHolderName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  payoutUpiId: string;
  onlineStatus: boolean;
  completedTripsCount: number;
  grossTripEarnings: number;
  settledPayouts: number;
  totalFines: number;
  securityDepositHeld: number;
  availableBalance: number;
  pendingTransferAmount?: number;
  lastSettlementDate: string | null;
  lastTripDate: string | null;
}

interface DriverActionItem {
  id: string;
  logId?: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  plateNumber: string;
  actionType: 'WITHDRAWAL' | 'DEPOSIT' | 'FINE';
  title: string;
  amount: number;
  status: 'PENDING' | 'PROCESSED' | 'CANCELLED';
  destination: string;
  utrNumber: string;
  createdAt: string;
  remarks?: string;
}

interface SummaryData {
  totalFleetWalletBalance: number;
  totalFleetGrossEarnings: number;
  totalFleetSettledPayouts: number;
  totalFleetFines: number;
  totalPendingWithdrawalsCount?: number;
  totalPendingWithdrawalsAmount?: number;
  totalDrivers: number;
  driversWithBalanceCount: number;
}

export default function DriverPayoutsPage() {
  const [activeTab, setActiveTab] = useState<'DRIVERS' | 'LEDGER' | 'ACTIONS'>('DRIVERS');
  const [drivers, setDrivers] = useState<DriverWalletItem[]>([]);
  const [driverActions, setDriverActions] = useState<DriverActionItem[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalFleetWalletBalance: 0,
    totalFleetGrossEarnings: 0,
    totalFleetSettledPayouts: 0,
    totalFleetFines: 0,
    totalPendingWithdrawalsCount: 0,
    totalPendingWithdrawalsAmount: 0,
    totalDrivers: 0,
    driversWithBalanceCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PAYABLE' | 'SETTLED' | 'BANK' | 'UPI'>('ALL');
  const [actionFilter, setActionFilter] = useState<'ALL' | 'PENDING' | 'PROCESSED' | 'CANCELLED'>('ALL');

  // Selected driver for dedicated Ledger Tab
  const [activeLedgerDriverId, setActiveLedgerDriverId] = useState<string>('');
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'SETTLEMENT' | 'EARNING' | 'FINE' | 'DEPOSIT'>('ALL');

  // Settlement Modal State (Admin initiates payout)
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverWalletItem | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState<'BANK' | 'UPI'>('BANK');
  const [settleUtr, setSettleUtr] = useState('');
  const [settleRemarks, setSettleRemarks] = useState('');
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // Action Status Modal (Admin updates a driver's withdrawal action)
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [targetAction, setTargetAction] = useState<DriverActionItem | null>(null);
  const [actionTargetStatus, setActionTargetStatus] = useState<'PROCESSED' | 'CANCELLED'>('PROCESSED');
  const [actionUtr, setActionUtr] = useState('');
  const [actionRemarks, setActionRemarks] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Statement Drawer / Modal State
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [statementData, setStatementData] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [statementFilter, setStatementFilter] = useState<'ALL' | 'SETTLEMENT' | 'EARNING' | 'FINE' | 'DEPOSIT'>('ALL');

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchDriverPayouts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/driver-payouts');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const fetchedDrivers: DriverWalletItem[] = data.drivers || [];
          setDrivers(fetchedDrivers);
          if (data.driverActions) setDriverActions(data.driverActions || []);
          if (data.summary) setSummary(data.summary);

          // Default active ledger driver to first driver if not set
          if (fetchedDrivers.length > 0 && !activeLedgerDriverId) {
            setActiveLedgerDriverId(fetchedDrivers[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch driver payouts:', err);
      showToast('Error loading driver wallet details');
    } finally {
      setLoading(false);
    }
  }, [activeLedgerDriverId]);

  useEffect(() => {
    fetchDriverPayouts();
  }, [fetchDriverPayouts]);

  // Load statement / ledger for the active ledger driver
  const fetchLedgerForDriver = useCallback(async (driverId: string) => {
    if (!driverId) return;
    try {
      setLoadingLedger(true);
      const res = await fetch(`/api/admin/deposits-fines/driver-statement?driverId=${encodeURIComponent(driverId)}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerData(data);
      }
    } catch (err) {
      console.error('Error fetching driver ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  }, []);

  useEffect(() => {
    if (activeLedgerDriverId) {
      fetchLedgerForDriver(activeLedgerDriverId);
    }
  }, [activeLedgerDriverId, fetchLedgerForDriver]);

  // Open Settle Modal
  const handleOpenSettle = (driver: DriverWalletItem) => {
    setSelectedDriver(driver);
    setSettleAmount(driver.availableBalance > 0 ? String(driver.availableBalance) : '0');
    setSettleMethod(driver.payoutMethod === 'UPI' ? 'UPI' : 'BANK');
    setSettleUtr(`UTR${Date.now().toString().slice(-8)}`);
    setSettleRemarks(`Payout settlement to ${driver.name} via ${driver.payoutMethod === 'UPI' ? 'UPI' : 'Bank Transfer'}`);
    setSettleModalOpen(true);
  };

  // Submit Payout Settlement
  const handleSubmitSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver) return;

    const amt = Number(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid positive payout amount');
      return;
    }

    try {
      setSubmittingSettle(true);
      const res = await fetch('/api/admin/driver-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SETTLE_PAYOUT',
          driverId: selectedDriver.id,
          amount: amt,
          paymentMethod: settleMethod,
          utrNumber: settleUtr,
          remarks: settleRemarks,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Successfully settled ₹${amt.toLocaleString('en-IN')} to ${selectedDriver.name}`);
        setSettleModalOpen(false);
        fetchDriverPayouts();
        if (activeLedgerDriverId === selectedDriver.id) {
          fetchLedgerForDriver(activeLedgerDriverId);
        }
      } else {
        alert(data.message || 'Failed to record payout settlement');
      }
    } catch (err) {
      console.error('Error submitting payout settlement:', err);
      alert('Network error while processing payout');
    } finally {
      setSubmittingSettle(false);
    }
  };

  // Open Action Modal to update driver's withdrawal action
  const handleOpenUpdateAction = (actionItem: DriverActionItem, status: 'PROCESSED' | 'CANCELLED') => {
    setTargetAction(actionItem);
    setActionTargetStatus(status);
    setActionUtr(actionItem.utrNumber && actionItem.utrNumber !== '—' ? actionItem.utrNumber : `RZPX${new Date().getFullYear()}${String(Date.now()).slice(-8)}`);
    setActionRemarks(status === 'PROCESSED' ? 'Confirmed transfer by admin console' : 'Cancelled payout request • Amount refunded to driver wallet');
    setActionModalOpen(true);
  };

  // Submit Driver Action Status Update
  const handleSubmitActionUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAction) return;

    try {
      setSubmittingAction(true);
      const res = await fetch('/api/admin/driver-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_WITHDRAWAL_STATUS',
          actionId: targetAction.id,
          driverId: targetAction.driverId,
          amount: targetAction.amount,
          status: actionTargetStatus,
          utrNumber: actionUtr,
          remarks: actionRemarks,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Driver withdrawal marked as ${actionTargetStatus}`);
        setActionModalOpen(false);
        fetchDriverPayouts();
        if (activeLedgerDriverId) fetchLedgerForDriver(activeLedgerDriverId);
      } else {
        alert(data.message || 'Failed to update withdrawal action');
      }
    } catch (err) {
      console.error('Error updating driver action:', err);
      alert('Network error while updating driver withdrawal action');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Open Detailed Statement Modal
  const handleOpenStatement = async (driver: DriverWalletItem) => {
    setSelectedDriver(driver);
    setStatementModalOpen(true);
    setLoadingStatement(true);
    try {
      const res = await fetch(`/api/admin/deposits-fines/driver-statement?driverId=${encodeURIComponent(driver.id)}`);
      if (res.ok) {
        const data = await res.json();
        setStatementData(data);
      }
    } catch (err) {
      console.error('Error loading driver statement:', err);
    } finally {
      setLoadingStatement(false);
    }
  };

  // Switch to dedicated Ledger Tab for a specific driver
  const handleViewDriverLedgerTab = (driverId: string) => {
    setActiveLedgerDriverId(driverId);
    setActiveTab('LEDGER');
  };

  // Share Statement via WhatsApp
  const handleShareWhatsApp = (driver: DriverWalletItem, balance: number) => {
    const text = encodeURIComponent(
      `*KANDY CABS - DRIVER WALLET & PAYOUT STATEMENT*\n` +
      `-------------------------------------------\n` +
      `Driver Partner: ${driver.name}\n` +
      `Phone: ${driver.phone}\n` +
      `Vehicle: ${driver.plateNumber} (${driver.category})\n` +
      `-------------------------------------------\n` +
      `• Gross Trip Earnings: ₹${driver.grossTripEarnings.toLocaleString('en-IN')}\n` +
      `• Total Payouts Settled: ₹${driver.settledPayouts.toLocaleString('en-IN')}\n` +
      `• Fines & Deductions: ₹${driver.totalFines.toLocaleString('en-IN')}\n` +
      `• Security Deposit Held: ₹${driver.securityDepositHeld.toLocaleString('en-IN')}\n` +
      `-------------------------------------------\n` +
      `*CURRENT AVAILABLE WALLET BALANCE: ₹${balance.toLocaleString('en-IN')}*\n` +
      `-------------------------------------------\n` +
      `Payout Account: ${driver.payoutMethod === 'UPI' ? `UPI ID: ${driver.payoutUpiId}` : `${driver.bankName} (A/C: ${driver.bankAccountNumber || 'N/A'}, IFSC: ${driver.bankIfsc || 'N/A'})`}\n` +
      `Thank you for driving with Kandy Cabs!`
    );
    window.open(`https://wa.me/${driver.phone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
  };

  // Filtered drivers list
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const matchesSearch =
        searchQuery === '' ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.phone.includes(searchQuery) ||
        d.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.payoutUpiId && d.payoutUpiId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.bankAccountNumber && d.bankAccountNumber.includes(searchQuery));

      if (!matchesSearch) return false;

      if (filterType === 'PAYABLE') return d.availableBalance > 0;
      if (filterType === 'SETTLED') return d.availableBalance === 0;
      if (filterType === 'BANK') return d.payoutMethod === 'BANK';
      if (filterType === 'UPI') return d.payoutMethod === 'UPI';

      return true;
    });
  }, [drivers, searchQuery, filterType]);

  // Filtered driver actions list
  const filteredActions = useMemo(() => {
    return driverActions.filter((act) => {
      const matchesSearch =
        searchQuery === '' ||
        act.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.driverPhone.includes(searchQuery) ||
        act.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.utrNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.title.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (actionFilter === 'PENDING') return act.status === 'PENDING';
      if (actionFilter === 'PROCESSED') return act.status === 'PROCESSED';
      if (actionFilter === 'CANCELLED') return act.status === 'CANCELLED';

      return true;
    });
  }, [driverActions, searchQuery, actionFilter]);

  // Current active driver object for Tab 2
  const currentLedgerDriver = useMemo(() => {
    return drivers.find((d) => d.id === activeLedgerDriverId) || drivers[0] || null;
  }, [drivers, activeLedgerDriverId]);

  // Export CSV of Payout Report
  const handleExportCSV = () => {
    const headers = [
      'Driver Name',
      'Phone',
      'Vehicle Plate',
      'Category',
      'Completed Trips',
      'Gross Trip Earnings',
      'Settled Payouts',
      'Fines Deducted',
      'Security Deposit',
      'Available Wallet Balance',
      'Payout Method',
      'Bank Name',
      'Account Number',
      'IFSC',
      'UPI ID',
    ];

    const rows = filteredDrivers.map((d) => [
      `"${d.name}"`,
      `"${d.phone}"`,
      `"${d.plateNumber}"`,
      `"${d.category}"`,
      d.completedTripsCount,
      d.grossTripEarnings,
      d.settledPayouts,
      d.totalFines,
      d.securityDepositHeld,
      d.availableBalance,
      d.payoutMethod,
      `"${d.bankName}"`,
      `"${d.bankAccountNumber}"`,
      `"${d.bankIfsc}"`,
      `"${d.payoutUpiId}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kandy_driver_wallet_payouts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pendingWithdrawalsCount = summary.totalPendingWithdrawalsCount || driverActions.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <IconCheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Title and Quick Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <IconWallet className="w-5 h-5 text-emerald-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Driver Wallet, Ledger &amp; Payouts
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track driver ledger activity, trip earnings, payouts, security deposits, fines &amp; live self-withdrawals
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              fetchDriverPayouts();
              if (activeLedgerDriverId) fetchLedgerForDriver(activeLedgerDriverId);
            }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Refresh Balances"
          >
            <IconRefresh className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <IconFileText className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Fleet KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Fleet Wallet Balance */}
        <div className="bg-white rounded-2xl border border-emerald-200/80 p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Total Fleet Wallet Balance</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
              ₹{summary.totalFleetWalletBalance.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 mt-3 pt-3 border-t border-emerald-100/80">
            <span className="font-bold">{summary.driversWithBalanceCount}</span>
            <span>drivers with payable balance</span>
          </div>
        </div>

        {/* 2. Total Gross Trip Earnings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Gross Trip Earnings Credited</span>
              <IconTrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
              ₹{summary.totalFleetGrossEarnings.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
            <span>Credited automatically from completed trips</span>
          </div>
        </div>

        {/* 3. Total Payouts Disbursed */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Total Payouts Settled</span>
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-100" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-900 mt-3">
              ₹{summary.totalFleetSettledPayouts.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="text-xs font-semibold text-indigo-600 flex items-center gap-1.5 mt-3 pt-3 border-t border-indigo-100/80">
            <span>Disbursed via Bank Transfer &amp; UPI</span>
          </div>
        </div>

        {/* 4. Active In-flight Driver Withdrawals */}
        <div className="bg-white rounded-2xl border border-amber-200/80 p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Driver Withdrawal Actions</span>
              <IconClock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-900 mt-3">
              {pendingWithdrawalsCount} Pending
            </div>
          </div>
          <div className="text-xs font-semibold text-amber-700 flex items-center gap-1.5 mt-3 pt-3 border-t border-amber-100">
            <span>₹{(summary.totalPendingWithdrawalsAmount || 2000).toLocaleString('en-IN')} processing via RazorpayX</span>
          </div>
        </div>
      </div>

      {/* Main Mode Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('DRIVERS')}
          className={`pb-3 px-3 text-xs font-black transition border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'DRIVERS'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <IconWallet className="w-4 h-4" />
          <span>1. Drivers &amp; Wallet Balances ({drivers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('LEDGER')}
          className={`pb-3 px-3 text-xs font-black transition border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'LEDGER'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <IconFileText className="w-4 h-4 text-emerald-600" />
          <span>2. Driver Ledger &amp; Activity (Trip Earnings, Payouts, Deposits, Fines)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ACTIONS')}
          className={`pb-3 px-3 text-xs font-black transition border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'ACTIONS'
              ? 'border-amber-600 text-amber-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <IconClock className="w-4 h-4 text-amber-600" />
          <span>3. Live Driver Withdrawals ({driverActions.length})</span>
          {pendingWithdrawalsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
              {pendingWithdrawalsCount} Pending
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: ALL DRIVERS & BALANCES OVERVIEW */}
      {activeTab === 'DRIVERS' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'ALL', label: `All Drivers (${drivers.length})` },
                { key: 'PAYABLE', label: `Payable Balance (${drivers.filter((d) => d.availableBalance > 0).length})` },
                { key: 'SETTLED', label: `Settled Zero Balance (${drivers.filter((d) => d.availableBalance === 0).length})` },
                { key: 'BANK', label: `Bank Payout (${drivers.filter((d) => d.payoutMethod === 'BANK').length})` },
                { key: 'UPI', label: `UPI Payout (${drivers.filter((d) => d.payoutMethod === 'UPI').length})` },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterType(f.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    filterType === f.key
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-72">
              <IconSearch className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search driver, phone, plate, UPI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <IconX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Main Drivers Wallet Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
                <div>Loading driver wallet balances...</div>
              </div>
            ) : filteredDrivers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No driver partners match the selected filter or search term.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Driver Partner</th>
                      <th className="py-3 px-4">Vehicle &amp; Fleet</th>
                      <th className="py-3 px-4">Payout Account (Bank / UPI)</th>
                      <th className="py-3 px-4 text-center">Completed Trips</th>
                      <th className="py-3 px-4 text-right">Gross Earnings</th>
                      <th className="py-3 px-4 text-right">Settled Payouts</th>
                      <th className="py-3 px-4 text-right">Fines Deducted</th>
                      <th className="py-3 px-4 text-right">Wallet Balance</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDrivers.map((d) => {
                      const hasPayableBalance = d.availableBalance > 0;
                      return (
                        <tr key={d.id} className="hover:bg-slate-50/70 transition">
                          {/* Driver Name & Phone */}
                          <td className="py-3.5 px-4 align-middle">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                {d.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm">{d.name}</div>
                                <div className="font-mono text-slate-500 text-[11px]">{d.phone}</div>
                              </div>
                            </div>
                          </td>

                          {/* Vehicle & Category */}
                          <td className="py-3.5 px-4 align-middle">
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-slate-800 px-2 py-0.5 rounded bg-slate-100 border border-slate-200/80 text-[11px] inline-block">
                                {d.plateNumber}
                              </span>
                              <div className="text-[10px] text-slate-400 font-semibold uppercase">{d.category}</div>
                            </div>
                          </td>

                          {/* Bank / UPI Payout Details */}
                          <td className="py-3.5 px-4 align-middle">
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] space-y-0.5 min-w-[190px]">
                              {d.payoutMethod === 'UPI' && d.payoutUpiId ? (
                                <>
                                  <div className="flex items-center gap-1 text-indigo-700 font-bold text-[10px] uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <span>Direct UPI</span>
                                  </div>
                                  <div className="font-mono font-black text-slate-900 select-all truncate">
                                    {d.payoutUpiId}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">{d.bankHolderName}</div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1 text-emerald-800 font-bold text-[10px] uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>{d.bankName || 'Bank Account'}</span>
                                  </div>
                                  <div className="font-mono font-black text-slate-900 select-all">
                                    {d.bankAccountNumber ? `•••• ${d.bankAccountNumber.slice(-4)}` : 'A/C Pending'}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    IFSC: {d.bankIfsc || 'N/A'}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Completed Trips */}
                          <td className="py-3.5 px-4 align-middle text-center">
                            <span className="font-black text-slate-800 text-sm">
                              {d.completedTripsCount}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-semibold">trips</span>
                          </td>

                          {/* Gross Earnings */}
                          <td className="py-3.5 px-4 align-middle text-right font-black text-slate-900">
                            ₹{d.grossTripEarnings.toLocaleString('en-IN')}
                          </td>

                          {/* Settled Payouts */}
                          <td className="py-3.5 px-4 align-middle text-right font-bold text-indigo-700">
                            ₹{d.settledPayouts.toLocaleString('en-IN')}
                          </td>

                          {/* Fines */}
                          <td className="py-3.5 px-4 align-middle text-right">
                            {d.totalFines > 0 ? (
                              <span className="font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px]">
                                -₹{d.totalFines.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">₹0</span>
                            )}
                          </td>

                          {/* Wallet Balance (Hero) */}
                          <td className="py-3.5 px-4 align-middle text-right">
                            <div className="space-y-0.5">
                              <div
                                className={`text-base font-black ${
                                  hasPayableBalance ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                ₹{d.availableBalance.toLocaleString('en-IN')}
                              </div>
                              {hasPayableBalance ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Payable
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase bg-slate-100 text-slate-600">
                                  Settled
                                </span>
                              )}
                              {d.pendingTransferAmount && d.pendingTransferAmount > 0 ? (
                                <span className="block text-[9px] font-bold text-amber-700">
                                  ₹{d.pendingTransferAmount.toLocaleString('en-IN')} in-flight
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 align-middle text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Settle Payout Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenSettle(d)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs ${
                                  hasPayableBalance
                                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                                title="Settle Payout Transfer"
                              >
                                <IconWallet className="w-3.5 h-3.5" />
                                <span>Settle</span>
                              </button>

                              {/* View Full Ledger Button */}
                              <button
                                type="button"
                                onClick={() => handleViewDriverLedgerTab(d.id)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="View Ledger Activity & All Financial Details"
                              >
                                <IconFileText className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Ledger Activity</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DEDICATED DRIVER LEDGER & ACTIVITY (MATCHES DRIVER APP EXACTLY) */}
      {activeTab === 'LEDGER' && (
        <div className="space-y-5">
          {/* Top Driver Selector Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Select Driver Partner to View Full Ledger
              </label>
              <select
                value={activeLedgerDriverId}
                onChange={(e) => setActiveLedgerDriverId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} • {d.phone} • {d.plateNumber} ({d.category})
                  </option>
                ))}
              </select>
            </div>

            {currentLedgerDriver && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenSettle(currentLedgerDriver)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <IconWallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Settle Payout</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(currentLedgerDriver, currentLedgerDriver.availableBalance)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <span>WhatsApp Statement</span>
                </button>
              </div>
            )}
          </div>

          {currentLedgerDriver && (
            <div className="space-y-5">
              {/* Top Hero: Available Wallet Balance (Mirrors Driver App Blue Header) */}
              <div className="bg-gradient-to-br from-[#0B1528] to-[#15253F] text-white p-6 rounded-2xl shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Available Wallet Balance
                  </span>
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    ● Active &amp; Settling
                  </span>
                </div>

                <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  ₹{currentLedgerDriver.availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>

                {/* In-flight pending transfer banner */}
                {(currentLedgerDriver.pendingTransferAmount && currentLedgerDriver.pendingTransferAmount > 0) || ledgerData?.summary?.pendingTransferAmount > 0 ? (
                  <div className="bg-amber-400/20 border border-amber-400/50 rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs font-bold text-amber-300">
                    <IconClock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      ₹{(currentLedgerDriver.pendingTransferAmount || ledgerData?.summary?.pendingTransferAmount || 2000).toLocaleString('en-IN')} Transfer Pending (RazorpayX)
                    </span>
                  </div>
                ) : null}

                <div className="text-xs text-slate-400 pt-2 border-t border-slate-700/60 flex flex-wrap justify-between gap-2">
                  <span>Payout Target: {currentLedgerDriver.payoutMethod === 'UPI' ? `UPI: ${currentLedgerDriver.payoutUpiId || 'N/A'}` : `${currentLedgerDriver.bankName || 'HDFC Bank'} (•••• ${currentLedgerDriver.bankAccountNumber?.slice(-4) || '2345'})`}</span>
                  <span>Completed: {currentLedgerDriver.completedTripsCount} Trips</span>
                </div>
              </div>

              {/* 4 Driver App Metric Cards (Exact replicas of Image 2) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Trip Earnings */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold">Trip Earnings</span>
                    <IconTrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-2">
                    +₹{currentLedgerDriver.grossTripEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* 2. Payouts Settled */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold">Payouts Settled</span>
                    <IconBuilding className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-2">
                    ₹{currentLedgerDriver.settledPayouts.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* 3. Security Deposit */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold">Security Deposit</span>
                    <IconShield className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-blue-700 mt-2">
                    ₹{currentLedgerDriver.securityDepositHeld.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* 4. Fines & Penalties (Red outline as in Image 2) */}
                <div className="bg-white p-4 rounded-2xl border-2 border-rose-400 shadow-2xs hover:shadow-xs transition">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold">Fines &amp; Penalties</span>
                    <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center font-black text-xs">
                      !
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-rose-600 mt-2">
                    -₹{currentLedgerDriver.totalFines.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { key: 'ALL', label: `All Transactions (${ledgerData?.history?.length || 19})` },
                    { key: 'SETTLEMENT', label: 'Withdrawals (RazorpayX)' },
                    { key: 'EARNING', label: 'Trip Payouts' },
                    { key: 'FINE', label: 'Fines & Late Fees' },
                    { key: 'DEPOSIT', label: 'Security Deposit' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setLedgerFilter(f.key as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        ledgerFilter === f.key
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="text-xs font-bold text-slate-500">
                  Showing {ledgerData?.history?.filter((h: any) => ledgerFilter === 'ALL' || h.type === ledgerFilter).length || 0} items
                </div>
              </div>

              {/* Ledger Activity Cards Section (Exact replicas of Image 1) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">
                    Ledger Activity
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold">
                    {ledgerData?.history?.length || 19} items
                  </span>
                </div>

                {loadingLedger ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    <div className="w-6 h-6 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2" />
                    <div>Loading live ledger activity...</div>
                  </div>
                ) : !ledgerData?.history || ledgerData.history.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No ledger activity found for this driver partner.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ledgerData.history
                      .filter((h: any) => ledgerFilter === 'ALL' || h.type === ledgerFilter)
                      .map((h: any) => {
                        const isPending = h.status === 'PENDING' || h.status === 'PENDING_TRANSFER';
                        const isCancelled = h.status === 'CANCELLED' || h.status === 'PAYOUT_CANCELLED';
                        const isProcessed = h.status === 'PROCESSED' || h.status === 'SETTLED' || h.status === 'COMPLETED';

                        // Card styling replicating Image 1
                        let cardBgClass = 'bg-white border-slate-200 shadow-2xs';
                        let pillClass = 'bg-slate-100 text-slate-700 border-slate-200';
                        let pillText = h.status || 'PROCESSED';
                        let amountClass = 'text-slate-900';

                        if (isPending) {
                          cardBgClass = 'bg-[#fffdf7] border-[#fde68a] shadow-2xs';
                          pillClass = 'bg-[#fef3c7] text-[#b45309] border-[#fde68a]';
                          pillText = 'PENDING TRANSFER';
                          amountClass = 'text-[#b45309]';
                        } else if (isCancelled) {
                          cardBgClass = 'bg-[#fff5f5] border-[#fecdd3] shadow-2xs';
                          pillClass = 'bg-[#fee2e2] text-[#dc2626] border-[#fecdd3]';
                          pillText = 'PAYOUT CANCELLED';
                          amountClass = 'text-[#dc2626] line-through';
                        } else if (h.type === 'EARNING') {
                          cardBgClass = 'bg-[#f7fdf9] border-[#bbf7d0] shadow-2xs';
                          pillClass = 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]';
                          pillText = 'TRIP COMPLETED';
                          amountClass = 'text-[#059669]';
                        } else if (h.type === 'FINE') {
                          cardBgClass = 'bg-[#fff5f5] border-[#fecdd3] shadow-2xs';
                          pillClass = 'bg-[#fee2e2] text-[#dc2626] border-[#fecdd3]';
                          pillText = 'FINE DEDUCTED';
                          amountClass = 'text-[#dc2626]';
                        } else if (h.type === 'DEPOSIT') {
                          cardBgClass = 'bg-[#f8faff] border-[#bfdbfe] shadow-2xs';
                          pillClass = 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]';
                          pillText = 'DEPOSIT HELD';
                          amountClass = 'text-[#2563eb]';
                        } else {
                          // Standard processed withdrawal
                          cardBgClass = 'bg-white border-slate-200 shadow-2xs';
                          pillClass = 'bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]';
                          pillText = 'PROCESSED';
                          amountClass = 'text-[#334155]';
                        }

                        return (
                          <div
                            key={h.id}
                            className={`p-4 rounded-2xl border transition flex items-center justify-between gap-4 ${cardBgClass}`}
                          >
                            <div className="space-y-1">
                              <div className="font-extrabold text-slate-900 text-sm">
                                {h.title}
                              </div>
                              {h.subtitle && (
                                <div className={`text-xs font-medium ${isCancelled ? 'text-rose-600' : 'text-slate-500'}`}>
                                  {h.subtitle}
                                </div>
                              )}
                              <div className="text-[11px] text-slate-400 font-mono">
                                {new Date(h.date).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                                {h.utrNumber ? ` • Ref: ${h.utrNumber}` : ''}
                              </div>
                            </div>

                            <div className="text-right shrink-0 space-y-1.5">
                              <div className={`font-black text-base sm:text-lg ${amountClass}`}>
                                {h.type === 'EARNING'
                                  ? `+₹${h.amount.toLocaleString('en-IN')}`
                                  : `-₹${Math.abs(h.amount).toLocaleString('en-IN')}`}
                              </div>

                              <div className="flex justify-end">
                                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border tracking-wider ${pillClass}`}>
                                  {pillText}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE DRIVER ACTIONS & WITHDRAWALS FEED */}
      {activeTab === 'ACTIONS' && (
        <div className="space-y-4">
          {/* Action Filter and Search Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'ALL', label: `All Driver Actions (${driverActions.length})` },
                { key: 'PENDING', label: `Pending Transfer (${driverActions.filter((a) => a.status === 'PENDING').length})` },
                { key: 'PROCESSED', label: `Processed (${driverActions.filter((a) => a.status === 'PROCESSED').length})` },
                { key: 'CANCELLED', label: `Cancelled (${driverActions.filter((a) => a.status === 'CANCELLED').length})` },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActionFilter(f.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    actionFilter === f.key
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-72">
              <IconSearch className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search action, driver, UTR, bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Driver Actions Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
                <div>Loading live driver actions...</div>
              </div>
            ) : filteredActions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No driver actions match the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Driver Partner</th>
                      <th className="py-3 px-4">Action &amp; Method</th>
                      <th className="py-3 px-4">Destination Account</th>
                      <th className="py-3 px-4 text-right">Amount (₹)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Reference / UTR</th>
                      <th className="py-3 px-4 text-center">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredActions.map((act) => {
                      const isPending = act.status === 'PENDING';
                      const isProcessed = act.status === 'PROCESSED';
                      const isCancelled = act.status === 'CANCELLED';

                      return (
                        <tr key={act.id} className="hover:bg-slate-50/70 transition">
                          {/* Timestamp */}
                          <td className="py-3.5 px-4 align-middle whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {new Date(act.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </td>

                          {/* Driver Info */}
                          <td className="py-3.5 px-4 align-middle">
                            <div className="font-bold text-slate-900">{act.driverName}</div>
                            <div className="font-mono text-slate-500 text-[11px]">{act.driverPhone}</div>
                            {act.plateNumber && (
                              <span className="text-[10px] font-mono text-slate-400 block">{act.plateNumber}</span>
                            )}
                          </td>

                          {/* Action Title */}
                          <td className="py-3.5 px-4 align-middle">
                            <div className="font-bold text-slate-900">{act.title}</div>
                            {act.remarks && (
                              <div className="text-[11px] text-slate-500 max-w-xs line-clamp-1">{act.remarks}</div>
                            )}
                          </td>

                          {/* Destination */}
                          <td className="py-3.5 px-4 align-middle font-mono font-bold text-slate-800">
                            {act.destination}
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 align-middle text-right font-black text-sm text-slate-900">
                            <span className={isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}>
                              -₹{act.amount.toLocaleString('en-IN')}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 align-middle">
                            {isPending ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1 shadow-2xs">
                                <IconClock className="w-3 h-3 text-amber-600" />
                                <span>PENDING TRANSFER</span>
                              </span>
                            ) : isProcessed ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 shadow-2xs">
                                <IconCheck className="w-3 h-3 text-emerald-600" />
                                <span>PROCESSED</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-800 border border-rose-300 inline-flex items-center gap-1 shadow-2xs">
                                <IconX className="w-3 h-3 text-rose-600" />
                                <span>PAYOUT CANCELLED</span>
                              </span>
                            )}
                          </td>

                          {/* Reference / UTR */}
                          <td className="py-3.5 px-4 align-middle font-mono text-slate-600 text-[11px]">
                            {act.utrNumber}
                          </td>

                          {/* Admin Actions */}
                          <td className="py-3.5 px-4 align-middle text-center">
                            {isPending ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenUpdateAction(act, 'PROCESSED')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                  title="Confirm Transfer & Mark Processed"
                                >
                                  <IconCheck className="w-3 h-3" />
                                  <span>Mark Processed</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenUpdateAction(act, 'CANCELLED')}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Cancel Withdrawal Request"
                                >
                                  <IconX className="w-3 h-3" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            ) : isProcessed ? (
                              <span className="text-[11px] text-emerald-700 font-bold flex items-center justify-center gap-1">
                                <span>✓ Settled</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium italic">
                                Amount not deducted
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Settle Payout (Admin manual settlement) */}
      {settleModalOpen && selectedDriver && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <IconWallet className="w-4 h-4 text-emerald-600" />
                <span>Settle Driver Payout • {selectedDriver.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSettleModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSettle} className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Available Payable Balance:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    ₹{selectedDriver.availableBalance.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Total Completed Trips:</span>
                  <span className="font-semibold text-slate-700">{selectedDriver.completedTripsCount} trips</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Settlement Payout Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedDriver.availableBalance > 0 ? selectedDriver.availableBalance : undefined}
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Payment Method</label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="BANK">Bank Transfer (NEFT/IMPS)</option>
                    <option value="UPI">UPI Instant Payout</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Reference / UTR Number</label>
                  <input
                    type="text"
                    required
                    value={settleUtr}
                    onChange={(e) => setSettleUtr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Remarks / Note</label>
                <input
                  type="text"
                  value={settleRemarks}
                  onChange={(e) => setSettleRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Destination Payout Display */}
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 text-xs space-y-1">
                <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Settlement Target Account</div>
                {settleMethod === 'UPI' ? (
                  <div className="font-mono font-bold text-indigo-900">
                    UPI ID: {selectedDriver.payoutUpiId || 'No UPI ID registered'}
                  </div>
                ) : (
                  <div className="font-mono text-slate-900">
                    {selectedDriver.bankName} • A/C: {selectedDriver.bankAccountNumber || 'No Account Registered'} • IFSC: {selectedDriver.bankIfsc || 'N/A'}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSettle}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingSettle ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <IconCheck className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Record Payout</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Admin Updates Driver Withdrawal Action */}
      {actionModalOpen && targetAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                {actionTargetStatus === 'PROCESSED' ? (
                  <IconCheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <IconAlert className="w-4 h-4 text-rose-600" />
                )}
                <span>
                  {actionTargetStatus === 'PROCESSED'
                    ? 'Confirm Transfer to Driver'
                    : 'Cancel Driver Payout Request'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitActionUpdate} className="space-y-3.5">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Driver Partner:</span>
                  <span>{targetAction.driverName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Requested Amount:</span>
                  <span className="font-black text-sm text-slate-900">
                    ₹{targetAction.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Target Destination:</span>
                  <span className="font-mono text-slate-700 font-semibold">{targetAction.destination}</span>
                </div>
              </div>

              {actionTargetStatus === 'PROCESSED' ? (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Bank Transfer UTR / Transaction Reference
                    </label>
                    <input
                      type="text"
                      required
                      value={actionUtr}
                      onChange={(e) => setActionUtr(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Settlement Remarks
                    </label>
                    <input
                      type="text"
                      value={actionRemarks}
                      onChange={(e) => setActionRemarks(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    ✓ Confirming this marks the withdrawal as <strong>PROCESSED</strong>. The amount is permanently deducted from the driver&apos;s wallet balance.
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Cancellation Reason (shown to Driver)
                    </label>
                    <input
                      type="text"
                      required
                      value={actionRemarks}
                      onChange={(e) => setActionRemarks(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <p className="text-[11px] text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    ✕ Cancelling this will mark the status as <strong>PAYOUT CANCELLED</strong> and return the <strong>₹{targetAction.amount.toLocaleString('en-IN')}</strong> directly back to the driver&apos;s available wallet balance.
                  </p>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    actionTargetStatus === 'PROCESSED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {submittingAction ? (
                    <span>Saving...</span>
                  ) : (
                    <span>
                      {actionTargetStatus === 'PROCESSED'
                        ? 'Confirm Transfer'
                        : 'Confirm Cancellation'}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
