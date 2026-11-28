'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminNavbar } from '@/components/AdminNavbar';
import {
  IconScale,
  IconShield,
  IconAlert,
  IconCheck,
  IconCross,
  IconEdit,
  IconRefresh,
  IconUsers,
  IconCar,
  IconPayments,
} from '@/components/Icons';
import {
  DEFAULT_DEPOSITS_AND_FINES_CONFIG,
  DepositsAndFinesConfig,
  DriverFineOrDepositRecord,
  ViolationFineRule,
  LedgerRecordStatus,
  LedgerRecordType,
  FineSeverity,
} from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export default function DepositsAndFinesPage() {
  const [activeTab, setActiveTab] = useState<'deposit' | 'fines' | 'ledger' | 'statement'>('statement');
  const [config, setConfig] = useState<DepositsAndFinesConfig>(DEFAULT_DEPOSITS_AND_FINES_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ledger state
  const [records, setRecords] = useState<DriverFineOrDepositRecord[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'ALL' | 'DEPOSIT' | 'FINE'>('ALL');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState({
    totalDepositsHeld: 0,
    totalFinesImposed: 0,
    totalFinesCollected: 0,
    pendingFines: 0,
    totalCount: 0,
  });

  // Statement & Individual Driver Payout state (Tab 4)
  const [statementDriverId, setStatementDriverId] = useState('');
  const [statementData, setStatementData] = useState<any>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [statementFilter, setStatementFilter] = useState<'ALL' | 'EARNING' | 'SETTLEMENT' | 'FINE' | 'DEPOSIT'>('ALL');
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('BANK_TRANSFER');
  const [settleUtr, setSettleUtr] = useState('');
  const [settleRemarks, setSettleRemarks] = useState('');
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // Modals state
  const [imposeFineModalOpen, setImposeFineModalOpen] = useState(false);
  const [recordDepositModalOpen, setRecordDepositModalOpen] = useState(false);
  const [addFineRuleModalOpen, setAddFineRuleModalOpen] = useState(false);
  const [waiveModalRecord, setWaiveModalRecord] = useState<DriverFineOrDepositRecord | null>(null);
  const [waiverReason, setWaiverReason] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Form states for modals
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [fineAmount, setFineAmount] = useState('250');
  const [fineBookingRef, setFineBookingRef] = useState('');
  const [fineRemarks, setFineRemarks] = useState('');

  const [depositDriverId, setDepositDriverId] = useState('');
  const [depositAmount, setDepositAmount] = useState('5000');
  const [depositMethod, setDepositMethod] = useState('BANK_TRANSFER');
  const [depositRemarks, setDepositRemarks] = useState('');

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleCode, setNewRuleCode] = useState('');
  const [newRuleDesc, setNewRuleDesc] = useState('');
  const [newRuleAmount, setNewRuleAmount] = useState('500');
  const [newRuleSeverity, setNewRuleSeverity] = useState<FineSeverity>('MEDIUM');

  // Fetch configuration
  const fetchConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/admin/settings/deposits-fines');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setConfig(data.config);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  // Fetch ledger records & drivers
  const fetchLedger = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const params = new URLSearchParams();
      if (ledgerTypeFilter !== 'ALL') params.set('type', ledgerTypeFilter);
      if (ledgerStatusFilter !== 'ALL') params.set('status', ledgerStatusFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/deposits-fines/ledger?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRecords(data.records || []);
          if (data.summary) setSummary(data.summary);
          if (data.drivers && data.drivers.length > 0) {
            setDrivers(data.drivers);
            if (!selectedDriverId) setSelectedDriverId(data.drivers[0].id);
            if (!depositDriverId) setDepositDriverId(data.drivers[0].id);
            if (!statementDriverId) setStatementDriverId(data.drivers[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  }, [ledgerTypeFilter, ledgerStatusFilter, searchQuery, selectedDriverId, depositDriverId, statementDriverId]);

  // Fetch individual driver financial statement
  const fetchDriverStatement = useCallback(async (drvId?: string) => {
    const idToFetch = drvId || statementDriverId || (drivers[0] && drivers[0].id);
    if (!idToFetch) return;
    setLoadingStatement(true);
    try {
      const res = await fetch(`/api/admin/deposits-fines/driver-statement?driverId=${encodeURIComponent(idToFetch)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStatementData(data);
          if (data.selectedDriver) {
            setStatementDriverId(data.selectedDriver.id);
            setSettleMethod(data.selectedDriver.payoutMethod === 'UPI' ? 'UPI' : 'BANK_TRANSFER');
          }
        }
      }
    } catch (e) {
      console.error('Failed to load driver statement:', e);
    } finally {
      setLoadingStatement(false);
    }
  }, [statementDriverId, drivers]);

  useEffect(() => {
    fetchConfig();
    fetchLedger();
  }, [fetchConfig, fetchLedger]);

  useEffect(() => {
    if (activeTab === 'statement') {
      fetchDriverStatement();
    }
  }, [activeTab, fetchDriverStatement]);

  // Save Settings
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/admin/settings/deposits-fines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setToastMessage('Security Deposit & Violation Fine Rules saved successfully!');
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert('Failed to save settings');
      }
    } catch (err: any) {
      console.error('Error saving settings:', err);
      alert('Error saving settings: ' + (err.message || 'Network error'));
    } finally {
      setSavingConfig(false);
    }
  };

  // Submit Impose Fine
  const handleSubmitImposeFine = async (e: React.FormEvent) => {
    e.preventDefault();
    const drv = drivers.find((d) => d.id === selectedDriverId) || drivers[0];
    if (!drv) return alert('Please select a driver');

    const rule = config.fineRules.find((r) => r.id === selectedRuleId);
    const ruleTitle = rule ? rule.name : 'Violation Fine';

    try {
      const res = await fetch('/api/admin/deposits-fines/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: drv.id,
          driverName: drv.name,
          driverPhone: drv.phone,
          vehiclePlate: drv.plateNumber,
          type: 'FINE',
          category: rule?.code || 'CUSTOM',
          title: ruleTitle,
          amount: parseFloat(fineAmount) || 250,
          bookingRef: fineBookingRef,
          remarks: fineRemarks || rule?.description || 'Imposed via Admin Console',
          paymentMethod: 'PAYOUT_DEDUCTION',
        }),
      });

      if (res.ok) {
        setImposeFineModalOpen(false);
        setFineBookingRef('');
        setFineRemarks('');
        fetchLedger();
        if (activeTab === 'statement') fetchDriverStatement(statementDriverId);
        setToastMessage(`Imposed ₹${fineAmount} fine on ${drv.name}`);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert('Failed to impose fine');
      }
    } catch (err) {
      console.error('Error imposing fine:', err);
      alert('Network error imposing fine');
    }
  };

  // Submit Record Deposit
  const handleSubmitRecordDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const drv = drivers.find((d) => d.id === depositDriverId) || drivers[0];
    if (!drv) return alert('Please select a driver');

    try {
      const res = await fetch('/api/admin/deposits-fines/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: drv.id,
          driverName: drv.name,
          driverPhone: drv.phone,
          vehiclePlate: drv.plateNumber,
          type: 'DEPOSIT',
          category: 'SECURITY_DEPOSIT',
          title: 'Driver Security Deposit',
          amount: parseFloat(depositAmount) || 5000,
          paymentMethod: depositMethod,
          remarks: depositRemarks || `Received via ${depositMethod}`,
        }),
      });

      if (res.ok) {
        setRecordDepositModalOpen(false);
        setDepositRemarks('');
        fetchLedger();
        if (activeTab === 'statement') fetchDriverStatement(statementDriverId);
        setToastMessage(`Recorded ₹${depositAmount} security deposit for ${drv.name}`);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert('Failed to record deposit');
      }
    } catch (err) {
      console.error('Error recording deposit:', err);
      alert('Network error recording deposit');
    }
  };

  // Submit New Fine Rule
  const handleAddNewFineRule = () => {
    if (!newRuleName.trim() || !newRuleAmount) {
      alert('Please enter rule name and default amount');
      return;
    }

    const code = newRuleCode.trim() || newRuleName.toUpperCase().replace(/\s+/g, '_');
    const newRule: ViolationFineRule = {
      id: `fine-custom-${Date.now().toString().slice(-5)}`,
      code,
      name: newRuleName.trim(),
      description: newRuleDesc.trim() || newRuleName.trim(),
      defaultAmount: Math.max(0, parseFloat(newRuleAmount) || 500),
      severity: newRuleSeverity,
      enabled: true,
      deductFromPayout: true,
    };

    setConfig((prev) => ({
      ...prev,
      fineRules: [...prev.fineRules, newRule],
    }));

    setAddFineRuleModalOpen(false);
    setNewRuleName('');
    setNewRuleCode('');
    setNewRuleDesc('');
    setNewRuleAmount('500');
    setToastMessage(`Added fine rule: ${newRule.name}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Update Status of a Record
  const handleUpdateRecordStatus = async (recordId: string, newStatus: LedgerRecordStatus, reason?: string) => {
    setActionLoadingId(recordId);
    try {
      const res = await fetch('/api/admin/deposits-fines/ledger', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recordId, status: newStatus, waiverReason: reason }),
      });
      if (res.ok) {
        fetchLedger();
        if (activeTab === 'statement') fetchDriverStatement(statementDriverId);
        setToastMessage(`Updated record status to ${newStatus}`);
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        alert('Failed to update record');
      }
    } catch (err) {
      console.error('Error updating record status:', err);
      alert('Network error updating record');
    } finally {
      setActionLoadingId(null);
      setWaiveModalRecord(null);
      setWaiverReason('');
    }
  };

  // Submit Driver Payout Settlement
  const handleSubmitSettlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statementDriverId || !settleAmount || parseFloat(settleAmount) <= 0) {
      alert('Please enter a valid payout amount');
      return;
    }
    setSubmittingSettle(true);
    try {
      const res = await fetch('/api/admin/deposits-fines/driver-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: statementDriverId,
          amount: parseFloat(settleAmount),
          paymentMethod: settleMethod,
          utrNumber: settleUtr || undefined,
          remarks: settleRemarks || undefined,
        }),
      });

      if (res.ok) {
        setSettleModalOpen(false);
        setSettleAmount('');
        setSettleUtr('');
        setSettleRemarks('');
        fetchDriverStatement(statementDriverId);
        fetchLedger();
        setToastMessage(`Recorded ₹${settleAmount} payout settlement successfully!`);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        const d = await res.json();
        alert(d.message || 'Failed to record payout settlement');
      }
    } catch (err: any) {
      console.error('Error settling payout:', err);
      alert('Network error settling payout');
    } finally {
      setSubmittingSettle(false);
    }
  };

  // WhatsApp Driver Statement Sharing
  const handleShareWhatsAppStatement = () => {
    if (!statementData || !statementData.selectedDriver) return;
    const d = statementData.selectedDriver;
    const s = statementData.summary;
    const now = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const text = `*KANDY CABS - DRIVER PAYOUT & SETTLEMENT STATEMENT*
---------------------------------------
*Driver Partner:* ${d.name} (${d.phone})
*Vehicle:* ${d.plateNumber} (${d.category})
*Date:* ${now}

*FINANCIAL SUMMARY:*
• *Gross Trip Earnings:* ₹${s.grossTripEarnings.toLocaleString('en-IN')} (${s.totalCompletedTrips} trips)
• *Payouts Settled / Withdrawn:* -₹${s.settledPayouts.toLocaleString('en-IN')}
• *Fines & Penalties:* -₹${s.totalFines.toLocaleString('en-IN')}
• *Security Deposit in Escrow:* ₹${s.securityDepositHeld.toLocaleString('en-IN')}

---------------------------------------
*NET PAYABLE BALANCE:* *₹${s.availableBalance.toLocaleString('en-IN')}*
---------------------------------------
*Settlement Account:* ${d.payoutMethod === 'UPI' ? `UPI: ${d.payoutUpiId}` : `${d.bankName} A/c ${d.bankAccountNumber?.slice(-4)} (IFSC: ${d.bankIfsc})`}

_Kandy Cabs Operations & Accounts Desk_`;

    const encoded = encodeURIComponent(text);
    const cleanPhone = (d.phone || '').replace(/[^0-9]/g, '');
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const getSeverityBadge = (severity: FineSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-300">MEDIUM</span>;
      case 'LOW':
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">LOW</span>;
    }
  };

  const getStatusBadge = (status: LedgerRecordStatus) => {
    switch (status) {
      case 'PAID':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Paid</span>;
      case 'DEDUCTED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">✓ Deducted from Payout</span>;
      case 'PENDING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">! Pending</span>;
      case 'REFUNDED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Refunded</span>;
      case 'WAIVED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 line-through border border-slate-200">Waived</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminNavbar />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <IconCheck className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200 shadow-2xs">
              <IconScale className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Security Deposit, Fines & Driver Payouts
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-wide">
                  Fleet Policy & Ledger
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Configure driver onboarding deposits, SLA infraction fines, and track individual driver payout settlements & full ledger statements.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setRecordDepositModalOpen(true)}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>+ Record Deposit</span>
            </button>
            <button
              type="button"
              onClick={() => setImposeFineModalOpen(true)}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <IconAlert className="w-3.5 h-3.5 text-white" />
              <span>+ Impose Fine</span>
            </button>
            <button
              type="button"
              disabled={savingConfig}
              onClick={handleSaveConfig}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {savingConfig ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <IconCheck className="w-3.5 h-3.5 text-white" />
                  <span>Save Rules</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Escrow Deposits Held</div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              ₹{summary.totalDepositsHeld.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <IconShield className="w-3 h-3 text-emerald-600" />
              <span>Active in Driver Escrow</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Fines Imposed</div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              ₹{summary.totalFinesImposed.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">All Recorded Infractions</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fines Collected / Deducted</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
              ₹{summary.totalFinesCollected.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">Recovered via Payouts</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Driver Fines</div>
            <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1">
              ₹{summary.pendingFines.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-rose-600 font-semibold mt-1">To Deduct in Next Settlement</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2 sm:gap-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('statement')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'statement'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <IconUsers className="w-4 h-4" />
            <span>1. Driver Payouts & History Statement</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('deposit')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'deposit'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <IconShield className="w-4 h-4" />
            <span>2. Security Deposit Policy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fines')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'fines'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <IconScale className="w-4 h-4" />
            <span>3. Violation Fines & Penalties Catalog ({config.fineRules.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <IconPayments className="w-4 h-4" />
            <span>4. All Fleet Ledger Log ({records.length})</span>
          </button>
        </div>

        {/* TAB 1: INDIVIDUAL DRIVER PAYOUT & STATEMENT */}
        {activeTab === 'statement' && (
          <div className="space-y-6">
            {/* Top Selector & Profile Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Individual Driver Payout & Ledger Statement</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select any driver partner to view gross trip earnings, settled payouts, security deposit escrow, fines, and execute withdrawal settlements.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchDriverStatement(statementDriverId)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                    title="Refresh Statement"
                  >
                    <IconRefresh className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsAppStatement}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Share Financial Statement via WhatsApp"
                  >
                    <span>WhatsApp Statement</span>
                  </button>
                </div>
              </div>

              {/* Driver Select Dropdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-800 block mb-1">Select Driver Partner</label>
                  <select
                    value={statementDriverId}
                    onChange={(e) => {
                      setStatementDriverId(e.target.value);
                      fetchDriverStatement(e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} • {d.phone} • {d.plateNumber}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Driver Profile & Bank Payout Details Card */}
                {statementData?.selectedDriver && (
                  <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white font-black text-sm flex items-center justify-center shrink-0">
                        {statementData.selectedDriver.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {statementData.selectedDriver.name}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-800">
                            {statementData.selectedDriver.plateNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ✓ Verified
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {statementData.selectedDriver.phone} • Category: {statementData.selectedDriver.category}
                        </div>
                      </div>
                    </div>

                    {/* Bank / UPI Details */}
                    <div className="text-left sm:text-right bg-white p-2 rounded-lg border border-slate-200/80">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Payout Settlement Account</div>
                      {statementData.selectedDriver.payoutMethod === 'UPI' && statementData.selectedDriver.payoutUpiId ? (
                        <div className="text-xs font-black text-indigo-700 font-mono mt-0.5">
                          UPI: {statementData.selectedDriver.payoutUpiId}
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-slate-800 font-mono mt-0.5">
                          {statementData.selectedDriver.bankName} • {statementData.selectedDriver.bankAccountNumber ? `A/c •••• ${statementData.selectedDriver.bankAccountNumber.slice(-4)}` : 'Bank Transfer'}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">
                        {statementData.selectedDriver.bankIfsc ? `IFSC: ${statementData.selectedDriver.bankIfsc}` : 'Direct Electronic Settlement'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5 Driver KPI Summary Cards (Mirrors Mobile Driver App UI) */}
              {statementData?.summary && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
                  {/* 1. Trip Earnings */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-bold">Trip Earnings</span>
                      <span className="text-emerald-600 font-bold text-sm">↗</span>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-emerald-600 mt-1.5">
                      +₹{statementData.summary.grossTripEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      {statementData.summary.totalCompletedTrips} completed trips
                    </div>
                  </div>

                  {/* 2. Payouts Settled */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-bold">Payouts Settled</span>
                      <IconPayments className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <div className="text-lg sm:text-xl font-black text-indigo-700 mt-1.5">
                      ₹{statementData.summary.settledPayouts.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                      Transferred to Bank/UPI
                    </div>
                  </div>

                  {/* 3. Security Deposit */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-bold">Security Deposit</span>
                      <IconShield className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="text-lg sm:text-xl font-black text-blue-700 mt-1.5">
                      ₹{statementData.summary.securityDepositHeld.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
                      Active in Escrow
                    </div>
                  </div>

                  {/* 4. Fines & Penalties (Red outline as in Image 2) */}
                  <div className="bg-white border-2 border-rose-400 rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-bold">Fines &amp; Penalties</span>
                      <div className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center font-black text-[10px]">
                        !
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-rose-600 mt-1.5">
                      -₹{statementData.summary.totalFines.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                      Pending: ₹{statementData.summary.pendingFines.toLocaleString('en-IN')}
                    </div>
                  </div>

                  {/* 5. Net Payable Balance */}
                  <div className="col-span-2 lg:col-span-1 bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                        Net Payable Balance
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">
                        ₹{statementData.summary.availableBalance.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSettleAmount(String(statementData.summary.availableBalance));
                        setSettleModalOpen(true);
                      }}
                      className="mt-2 w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-black shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Settle Payout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Statement Filter Pills & Actions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: 'ALL', label: `All Activity (${statementData?.counts?.all || 0})` },
                  { key: 'EARNING', label: `Trip Earnings (${statementData?.counts?.trips || 0})` },
                  { key: 'SETTLEMENT', label: `Payout Withdrawals (${statementData?.counts?.settlements || 0})` },
                  { key: 'FINE', label: `Fines & Penalties (${statementData?.counts?.fines || 0})` },
                  { key: 'DEPOSIT', label: `Security Deposits (${statementData?.counts?.deposits || 0})` },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setStatementFilter(f.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      statementFilter === f.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDriverId(statementDriverId);
                    setImposeFineModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <span>+ Impose Fine</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDepositDriverId(statementDriverId);
                    setRecordDepositModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <span>+ Record Deposit</span>
                </button>
              </div>
            </div>

            {/* Statement Activity Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              {loadingStatement ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
                  <div>Loading driver financial statement...</div>
                </div>
              ) : !statementData?.history || statementData.history.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No statement activity found for this driver partner.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                      <tr>
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Activity Description & Details</th>
                        <th className="py-3 px-4">Amount (₹)</th>
                        <th className="py-3 px-4">Reference / UTR</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statementData.history
                        .filter((tx: any) => statementFilter === 'ALL' || tx.type === statementFilter)
                        .map((tx: any) => {
                          const isCredit = tx.type === 'EARNING' || tx.type === 'DEPOSIT';
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                                {new Date(tx.date).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="py-3 px-4">
                                {tx.type === 'EARNING' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    TRIP EARNING
                                  </span>
                                )}
                                {tx.type === 'SETTLEMENT' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    WITHDRAWAL
                                  </span>
                                )}
                                {tx.type === 'FINE' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                    FINE
                                  </span>
                                )}
                                {tx.type === 'DEPOSIT' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                    SECURITY DEPOSIT
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 max-w-sm">
                                <div className="font-bold text-slate-900 text-xs">{tx.title}</div>
                                {tx.subtitle && (
                                  <div className="text-[11px] text-slate-500 mt-0.5">{tx.subtitle}</div>
                                )}
                                {tx.bookingRef && (
                                  <span className="inline-block mt-0.5 text-[10px] font-mono text-amber-800 font-bold">
                                    Ref: {tx.bookingRef}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className={`font-black text-sm ${isCredit ? 'text-emerald-700' : 'text-slate-900'}`}>
                                  {isCredit ? '+' : ''}₹{Math.abs(tx.amount).toLocaleString('en-IN')}
                                </div>
                                {tx.paymentMethod && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {tx.paymentMethod.replace(/_/g, ' ')}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                                {tx.utrNumber || tx.bookingRef || '—'}
                              </td>
                              <td className="py-3 px-4">
                                {tx.status === 'SETTLED' || tx.status === 'PROCESSED' || tx.status === 'PAID' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ✓ Settled
                                  </span>
                                ) : tx.status === 'COMPLETED' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    Completed
                                  </span>
                                ) : tx.status === 'DEDUCTED' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Deducted
                                  </span>
                                ) : tx.status === 'PENDING' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                    Pending
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                    {tx.status}
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

        {/* TAB 2: SECURITY DEPOSIT POLICY */}
        {activeTab === 'deposit' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Mandatory Security Deposit Configuration</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Security deposits ensure vehicle safety, policy compliance, and cover potential damage or unpaid toll dues.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.securityDeposit.enabled}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        securityDeposit: { ...prev.securityDeposit, enabled: e.target.checked },
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Default Amount */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">Default Base Security Deposit (₹)</label>
                  <p className="text-[11px] text-slate-500">Standard onboarding deposit held in driver escrow</p>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      value={config.securityDeposit.defaultAmount}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          securityDeposit: {
                            ...prev.securityDeposit,
                            defaultAmount: Math.max(0, Number(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-7 pr-3 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Minimum Threshold */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">Minimum Wallet Threshold (₹)</label>
                  <p className="text-[11px] text-slate-500">Required minimum balance to accept ride dispatches</p>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      value={config.securityDeposit.minWalletThreshold}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          securityDeposit: {
                            ...prev.securityDeposit,
                            minWalletThreshold: Math.max(0, Number(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-7 pr-3 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Refund Lock Period */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">Deposit Return Notice Period (Days)</label>
                  <p className="text-[11px] text-slate-500">Days to wait before refunding deposit when driver leaves Kandy Cabs (for clearance of pending dues & fines)</p>
                  <div className="relative mt-2">
                    <input
                      type="number"
                      value={config.securityDeposit.refundLockPeriodDays}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          securityDeposit: {
                            ...prev.securityDeposit,
                            refundLockPeriodDays: Math.max(0, Number(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Installment Deduction Section */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-amber-900">Installment Deductions from Ride Payouts</h4>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Enable drivers to fund their security deposit gradually by auto-deducting a percentage from each weekly settlement until target is reached.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.securityDeposit.allowInstallmentDeduction}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          securityDeposit: {
                            ...prev.securityDeposit,
                            allowInstallmentDeduction: e.target.checked,
                          },
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-amber-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600" />
                  </label>
                </div>

                {config.securityDeposit.allowInstallmentDeduction && (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs font-bold text-amber-900">Deduction Percentage per Settlement:</span>
                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={config.securityDeposit.installmentPercentage}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            securityDeposit: {
                              ...prev.securityDeposit,
                              installmentPercentage: Math.max(1, Math.min(50, Number(e.target.value) || 10)),
                            },
                          }))
                        }
                        className="w-full bg-white border border-amber-300 rounded-lg py-1 px-2 text-xs font-extrabold text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <span className="text-xs font-bold text-amber-800">% of gross trip payout</span>
                  </div>
                )}
              </div>

              {/* Vehicle Category Deposit Requirements */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2">
                  Category-Wise Security Deposit Requirements
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { key: 'HATCHBACK', label: 'Hatchback / Mini', icon: '🚗' },
                    { key: 'SEDAN', label: 'Sedan (Dzire / Etios)', icon: '🚘' },
                    { key: 'SUV', label: 'SUV (Ertiga)', icon: '🚙' },
                    { key: 'CRYSTA', label: 'Innova Crysta', icon: '⭐' },
                    { key: 'TEMPO_TRAVELLER', label: 'Tempo Traveller', icon: '🚐' },
                  ].map((cat) => (
                    <div key={cat.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center space-y-1">
                      <div className="text-xl">{cat.icon}</div>
                      <div className="text-[11px] font-bold text-slate-800">{cat.label}</div>
                      <div className="relative mt-1">
                        <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold text-xs">₹</span>
                        <input
                          type="number"
                          value={config.securityDeposit.categoryOverrides[cat.key] ?? config.securityDeposit.defaultAmount}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              securityDeposit: {
                                ...prev.securityDeposit,
                                categoryOverrides: {
                                  ...prev.securityDeposit.categoryOverrides,
                                  [cat.key]: Math.max(0, Number(e.target.value) || 0),
                                },
                              },
                            }))
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg py-1 pl-6 pr-2 text-xs font-black text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VIOLATION FINES & PENALTIES CATALOG */}
        {activeTab === 'fines' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Standard Driver Violation Fine Rules</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Predefined fines applied for SLA breaches, cancellations, passenger complaints, and safety violations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddFineRuleModalOpen(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs self-start sm:self-auto cursor-pointer"
                >
                  <span>+ Add Violation Rule</span>
                </button>
              </div>

              {/* Global Fines Policies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Auto-deduct from Weekly Payout</span>
                    <span className="text-[11px] text-slate-500">Automatically settle fines during Tuesday payout cycle</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.autoDeductFromPayout}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, autoDeductFromPayout: e.target.checked }))
                    }
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Dispatch Lock Fine Threshold (₹)</span>
                    <span className="text-[11px] text-slate-500">Temporarily lock driver if unpaid fines exceed</span>
                  </div>
                  <div className="w-28 relative">
                    <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      value={config.suspensionFineThreshold}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          suspensionFineThreshold: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg py-1 pl-6 pr-2 text-xs font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Fine Rules Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-3 px-3">Violation Name & Description</th>
                      <th className="py-3 px-3">Code</th>
                      <th className="py-3 px-3">Severity</th>
                      <th className="py-3 px-3">Fine Amount (₹)</th>
                      <th className="py-3 px-3 text-center">Auto-Deduct</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {config.fineRules.map((rule, idx) => (
                      <tr key={rule.id || idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 max-w-sm">
                          <div className="font-extrabold text-slate-900 text-xs">{rule.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{rule.description}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600 font-bold">
                          {rule.code}
                        </td>
                        <td className="py-3 px-3">{getSeverityBadge(rule.severity)}</td>
                        <td className="py-3 px-3">
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1 text-slate-400 font-bold text-xs">₹</span>
                            <input
                              type="number"
                              value={rule.defaultAmount}
                              onChange={(e) => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                setConfig((prev) => ({
                                  ...prev,
                                  fineRules: prev.fineRules.map((r, i) =>
                                    i === idx ? { ...r, defaultAmount: val } : r
                                  ),
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-md py-1 pl-5 pr-1.5 text-xs font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={rule.deductFromPayout}
                            onChange={(e) => {
                              setConfig((prev) => ({
                                ...prev,
                                fineRules: prev.fineRules.map((r, i) =>
                                  i === idx ? { ...r, deductFromPayout: e.target.checked } : r
                                ),
                              }));
                            }}
                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setConfig((prev) => ({
                                ...prev,
                                fineRules: prev.fineRules.map((r, i) =>
                                  i === idx ? { ...r, enabled: !r.enabled } : r
                                ),
                              }));
                            }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer ${
                              rule.enabled
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {rule.enabled ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remove fine rule "${rule.name}"?`)) {
                                setConfig((prev) => ({
                                  ...prev,
                                  fineRules: prev.fineRules.filter((_, i) => i !== idx),
                                }));
                              }
                            }}
                            className="text-slate-400 hover:text-rose-600 transition p-1"
                            title="Delete Rule"
                          >
                            <IconCross className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ALL FLEET LEDGER LOG */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                {/* Type Filters */}
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    ledgerTypeFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All ({records.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('DEPOSIT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    ledgerTypeFilter === 'DEPOSIT'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Deposits
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('FINE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    ledgerTypeFilter === 'FINE'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Fines
                </button>

                <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

                {/* Status Filters */}
                {['ALL', 'PENDING', 'DEDUCTED', 'PAID', 'REFUNDED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setLedgerStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      ledgerStatusFilter === st
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="w-full md:w-72">
                <input
                  type="text"
                  placeholder="Search driver, phone, plate, ref..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              {loadingLedger ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  <div className="w-6 h-6 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
                  <div>Loading driver deposits & fines ledger...</div>
                </div>
              ) : records.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No deposit or fine records found matching the filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                      <tr>
                        <th className="py-3 px-4">Driver</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Title & Details</th>
                        <th className="py-3 px-4">Amount (₹)</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4">
                            <div className="font-extrabold text-slate-900 text-xs">{rec.driverName}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{rec.driverPhone}</div>
                            {rec.vehiclePlate && (
                              <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-700 text-[10px] font-mono rounded mt-0.5">
                                {rec.vehiclePlate}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {rec.type === 'DEPOSIT' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                DEPOSIT
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                FINE
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-sm">
                            <div className="font-bold text-slate-800 text-xs">{rec.title}</div>
                            {rec.remarks && (
                              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{rec.remarks}</div>
                            )}
                            {rec.bookingRef && (
                              <span className="inline-block mt-0.5 text-[10px] font-mono text-indigo-700 font-semibold">
                                Ref: {rec.bookingRef}
                              </span>
                            )}
                            {rec.waiverReason && (
                              <div className="text-[10px] text-amber-700 italic mt-0.5">
                                Waived: {rec.waiverReason}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className={`font-black text-sm ${rec.type === 'FINE' ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {rec.type === 'FINE' ? '-' : '+'}₹{rec.amount.toLocaleString('en-IN')}
                            </div>
                            {rec.paymentMethod && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {rec.paymentMethod.replace(/_/g, ' ')}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">{getStatusBadge(rec.status)}</td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {new Date(rec.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {rec.status === 'PENDING' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateRecordStatus(rec.id, 'DEDUCTED')}
                                    disabled={actionLoadingId === rec.id}
                                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold transition cursor-pointer"
                                    title="Mark Deducted from Weekly Payout"
                                  >
                                    Deduct
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateRecordStatus(rec.id, 'PAID')}
                                    disabled={actionLoadingId === rec.id}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold transition cursor-pointer"
                                    title="Mark Paid via Cash/Direct"
                                  >
                                    Paid
                                  </button>
                                  {rec.type === 'FINE' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setWaiveModalRecord(rec);
                                        setWaiverReason('');
                                      }}
                                      className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold transition cursor-pointer"
                                      title="Waive Fine"
                                    >
                                      Waive
                                    </button>
                                  )}
                                </>
                              )}

                              {rec.type === 'DEPOSIT' && (rec.status === 'PAID' || rec.status === 'DEDUCTED') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`Refund security deposit of ₹${rec.amount} to ${rec.driverName}?`)) {
                                      handleUpdateRecordStatus(rec.id, 'REFUNDED');
                                    }
                                  }}
                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold transition cursor-pointer"
                                >
                                  Refund
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: IMPOSE FINE */}
      {imposeFineModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <IconAlert className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Impose Driver Fine / Penalty</h3>
                  <p className="text-[11px] text-slate-500">Record a service infraction fine on driver wallet</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImposeFineModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <IconCross className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitImposeFine} className="space-y-3.5">
              {/* Select Driver */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Select Driver *</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} • {d.phone} • {d.plateNumber} ({d.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Fine Rule */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Violation Category</label>
                <select
                  value={selectedRuleId}
                  onChange={(e) => {
                    const ruleId = e.target.value;
                    setSelectedRuleId(ruleId);
                    const rule = config.fineRules.find((r) => r.id === ruleId);
                    if (rule) {
                      setFineAmount(String(rule.defaultAmount));
                      setFineRemarks(rule.description);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Custom Fine Reason --</option>
                  {config.fineRules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} (₹{r.defaultAmount}) - {r.severity}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fine Amount & Booking Ref */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Fine Amount (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      required
                      value={fineAmount}
                      onChange={(e) => setFineAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-7 pr-3 text-xs font-black text-rose-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Booking Ref (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. KC-2026-804669"
                    value={fineBookingRef}
                    onChange={(e) => setFineBookingRef(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Remarks & Incident Details</label>
                <textarea
                  rows={2}
                  placeholder="Explain reason for penalty (customer feedback, delay duration, etc.)..."
                  value={fineRemarks}
                  onChange={(e) => setFineRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setImposeFineModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Impose Fine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD SECURITY DEPOSIT */}
      {recordDepositModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <IconShield className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Record Security Deposit</h3>
                  <p className="text-[11px] text-slate-500">Record driver deposit received into escrow</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecordDepositModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <IconCross className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRecordDeposit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Select Driver *</label>
                <select
                  value={depositDriverId}
                  onChange={(e) => setDepositDriverId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} • {d.phone} • {d.plateNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Amount Received (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                    <input
                      type="number"
                      required
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-7 pr-3 text-xs font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Payment Method</label>
                  <select
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="CASH">Cash in Hand</option>
                    <option value="PAYOUT_DEDUCTION">Deducted from Weekly Payout</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Remarks / Transaction UTR</label>
                <textarea
                  rows={2}
                  placeholder="e.g. UTR / Transaction ID or onboarding deposit notes..."
                  value={depositRemarks}
                  onChange={(e) => setDepositRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRecordDepositModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Record Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD VIOLATION FINE RULE */}
      {addFineRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <IconScale className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Add Violation Rule</h3>
                  <p className="text-[11px] text-slate-500">Define a new standard penalty policy for drivers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddFineRuleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <IconCross className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Violation Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Over-Speeding (> 110 km/h)"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Rule Code</label>
                  <input
                    type="text"
                    placeholder="e.g. OVERSPEEDING"
                    value={newRuleCode}
                    onChange={(e) => setNewRuleCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Severity</label>
                  <select
                    value={newRuleSeverity}
                    onChange={(e) => setNewRuleSeverity(e.target.value as FineSeverity)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Default Fine Amount (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    value={newRuleAmount}
                    onChange={(e) => setNewRuleAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-7 pr-3 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Description / Policy Clause</label>
                <textarea
                  rows={2}
                  placeholder="Detailed infraction definition displayed to driver upon fine notice..."
                  value={newRuleDesc}
                  onChange={(e) => setNewRuleDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddFineRuleModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddNewFineRule}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Add Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WAIVE FINE */}
      {waiveModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Waive Fine</h3>
                <p className="text-[11px] text-slate-500">
                  Waive ₹{waiveModalRecord.amount} fine for {waiveModalRecord.driverName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWaiveModalRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <IconCross className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Reason for Waiver *</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Verified customer misunderstanding / genuine vehicle breakdown proof provided..."
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setWaiveModalRecord(null)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateRecordStatus(waiveModalRecord.id, 'WAIVED', waiverReason)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Confirm Waiver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SETTLE PAYOUT / WITHDRAWAL */}
      {settleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <IconPayments className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Process Payout Settlement</h3>
                  <p className="text-[11px] text-slate-500">Record payout withdrawal to driver bank or UPI</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <IconCross className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSettlePayout} className="space-y-3.5">
              {/* Driver and Account info banner */}
              {statementData?.selectedDriver && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-900">{statementData.selectedDriver.name}</span>
                    <span className="font-mono text-slate-500">{statementData.selectedDriver.phone}</span>
                  </div>
                  <div className="text-[11px] text-indigo-700 font-mono font-bold">
                    {statementData.selectedDriver.payoutMethod === 'UPI'
                      ? `UPI: ${statementData.selectedDriver.payoutUpiId || 'Not set'}`
                      : `${statementData.selectedDriver.bankName || 'Bank'} A/c: ${statementData.selectedDriver.bankAccountNumber || 'Not set'} (IFSC: ${statementData.selectedDriver.bankIfsc || 'N/A'})`}
                  </div>
                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200">
                    <span className="text-slate-500">Current Payable Balance:</span>
                    <span className="font-black text-emerald-700">
                      ₹{statementData.summary?.availableBalance?.toLocaleString('en-IN') || 0}
                    </span>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-800">Payout Settlement Amount (₹) *</label>
                  {statementData?.summary?.availableBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setSettleAmount(String(statementData.summary.availableBalance))}
                      className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Settle Full: ₹{statementData.summary.availableBalance.toLocaleString('en-IN')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    required
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-7 pr-3 text-xs font-black text-emerald-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Payment Method & UTR */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">Payment Method</label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                    <option value="UPI">Instant UPI Transfer</option>
                    <option value="CASH">Cash in Hand</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">UTR / Ref Number</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR904812749201"
                    value={settleUtr}
                    onChange={(e) => setSettleUtr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">Settlement Notes / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Weekly settlement cleared for Tuesday cycle..."
                  value={settleRemarks}
                  onChange={(e) => setSettleRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSettleModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSettle}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {submittingSettle ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Confirm Payout Settlement</span>
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
