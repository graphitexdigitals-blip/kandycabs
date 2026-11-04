'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdminNavbar } from '@/components/AdminNavbar';
import { DriverVerificationStatus } from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export default function AdminVehicleEvidencePage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  // Review modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit Driver & Vehicle modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editDriverLoading, setEditDriverLoading] = useState(false);
  const [editDriverError, setEditDriverError] = useState('');
  const [editDriverData, setEditDriverData] = useState({
    fullName: '',
    phone: '',
    licenseNumber: '',
    category: 'SEDAN',
    carModel: '',
    fuelType: 'DIESEL',
    carriageCapacity: '2 Large Bags (Standard Boot)',
    plateNumber: '',
    payoutMethod: 'BANK',
    bankAccountHolderName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankName: '',
    payoutUpiId: '',
    payoutPhone: '',
    payoutEmail: '',
    payoutStatus: 'PENDING',
  });

  // Delete Driver modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Add Driver modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addDriverLoading, setAddDriverLoading] = useState(false);
  const [addDriverError, setAddDriverError] = useState('');
  const [newDriver, setNewDriver] = useState({
    fullName: '',
    phone: '',
    licenseNumber: '',
    category: 'SEDAN',
    plateNumber: '',
    fuelType: 'DIESEL',
  });

  const isFetchingRef = useRef(false);

  const fetchDrivers = useCallback(async (isSilent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/vehicle-evidence?status=${statusFilter}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.drivers || [];
        setDrivers(list);
        if (data.counts) setCounts(data.counts);
      }
    } catch (err) {
      console.error('Failed to load vehicle evidence:', err);
    } finally {
      isFetchingRef.current = false;
      if (!isSilent) setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDrivers();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchDrivers(true);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchDrivers]);

  const openEditModal = (driver: any) => {
    if (!driver) return;
    const carModelMatch = driver.adminNotes?.match(/\[Car Model:\s*([^\]]+)\]/);
    const carriageMatch = driver.adminNotes?.match(/\[Luggage\/Carriage:\s*([^\]]+)\]/);
    setEditDriverData({
      fullName: driver.fullName || '',
      phone: driver.phone?.replace(/^\+91/, '') || '',
      licenseNumber: driver.licenseNumber && driver.licenseNumber !== 'PENDING' ? driver.licenseNumber : '',
      category: driver.vehicle?.category || 'SEDAN',
      carModel: carModelMatch ? carModelMatch[1].trim() : '',
      fuelType: driver.vehicle?.fuelType || 'DIESEL',
      carriageCapacity: carriageMatch ? carriageMatch[1].trim() : '2 Large Bags (Standard Boot)',
      plateNumber: driver.vehicle?.plateNumber && driver.vehicle.plateNumber !== 'PENDING' && !driver.vehicle.plateNumber.startsWith('KA 01 TR 0000') ? driver.vehicle.plateNumber : '',
      payoutMethod: driver.payoutMethod || 'BANK',
      bankAccountHolderName: driver.bankAccountHolderName || '',
      bankAccountNumber: driver.bankAccountNumber || '',
      bankIfsc: driver.bankIfsc || '',
      bankName: driver.bankName || '',
      payoutUpiId: driver.payoutUpiId || '',
      payoutPhone: driver.payoutPhone || '',
      payoutEmail: driver.payoutEmail || '',
      payoutStatus: driver.payoutStatus || 'PENDING',
    });
    setEditDriverError('');
    setEditModalOpen(true);
  };

  const handleTogglePayoutStatus = async (driverId: string, newStatus: 'VERIFIED' | 'PENDING') => {
    try {
      const res = await fetch(`/api/admin/vehicle-evidence/${driverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutStatus: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDrivers((prev) =>
          prev.map((d) => (d.driverId === driverId ? { ...d, payoutStatus: newStatus } : d))
        );
      } else {
        alert(data.error || 'Failed to update payout status');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating payout status');
    }
  };

  const handleEditDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver) return;
    setEditDriverError('');
    setEditDriverLoading(true);
    try {
      const res = await fetch(`/api/admin/vehicle-evidence/${selectedDriver.driverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDriverData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditModalOpen(false);
        if (data.driver) {
          setDrivers((prev) =>
            prev.map((d) => (d.driverId === data.driver.driverId ? { ...d, ...data.driver } : d))
          );
        }
        await fetchDrivers(true);
      } else {
        setEditDriverError(data.error || 'Failed to update driver details');
      }
    } catch (err: any) {
      setEditDriverError(err.message || 'Failed to update driver details');
    } finally {
      setEditDriverLoading(false);
    }
  };

  const handleDeleteDriver = async () => {
    if (!selectedDriver) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/admin/vehicle-evidence/${selectedDriver.driverId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteModalOpen(false);
        setSelectedDriverId(null);
        await fetchDrivers();
      } else {
        setDeleteError(data.error || 'Failed to delete driver');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete driver');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddDriverError('');
    setAddDriverLoading(true);
    try {
      const res = await fetch('/api/admin/vehicle-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDriver),
      });
      const data = await res.json();
      if (res.ok) {
        setAddModalOpen(false);
        setNewDriver({
          fullName: '',
          phone: '',
          licenseNumber: '',
          category: 'SEDAN',
          plateNumber: '',
          fuelType: 'DIESEL',
        });
        await fetchDrivers();
      } else {
        setAddDriverError(data.error || 'Failed to add driver');
      }
    } catch (err: any) {
      setAddDriverError(err.message || 'Failed to add driver');
    } finally {
      setAddDriverLoading(false);
    }
  };

  const handleReview = async (driverId: string, status: DriverVerificationStatus, notes?: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/vehicle-evidence/${driverId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes: notes }),
      });

      if (res.ok) {
        setRejectModalOpen(false);
        setRejectNotes('');
        setDrivers((prev) =>
          prev.map((d) => (d.driverId === driverId ? { ...d, verificationStatus: status } : d))
        );
        await fetchDrivers(true);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update review status');
      }
    } catch (err: any) {
      console.error('Error submitting review:', err);
      alert(err.message || 'Error updating review status');
    } finally {
      setSubmitting(false);
    }
  };

  const [search, setSearch] = useState('');

  // Instant client-side filtering for 0ms response
  const displayedDrivers = React.useMemo(() => {
    if (!drivers || drivers.length === 0) return [];
    return drivers.filter((d) => {
      if (statusFilter !== 'ALL' && d.verificationStatus !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const nameMatch = d.fullName?.toLowerCase().includes(q);
        const phoneMatch = d.phone?.includes(q);
        const licenseMatch = d.licenseNumber?.toLowerCase().includes(q);
        const plateMatch = d.vehicle?.plateNumber?.toLowerCase().includes(q);
        const catMatch = d.vehicle?.category?.toLowerCase().includes(q);
        return nameMatch || phoneMatch || licenseMatch || plateMatch || catMatch;
      }
      return true;
    });
  }, [drivers, statusFilter, search]);

  // Derived active driver: ALWAYS in-sync with latest drivers array
  const selectedDriver = React.useMemo(() => {
    if (!drivers || drivers.length === 0) return null;
    if (selectedDriverId) {
      const match = drivers.find((d) => d.driverId === selectedDriverId);
      if (match) return match;
    }
    return displayedDrivers[0] || drivers[0] || null;
  }, [drivers, selectedDriverId, displayedDrivers]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <span>🛡️</span> Vehicle & Driver KYC Evidence Review
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Verify driving licenses, RC books, insurance certificates, and vehicle specifications
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition"
            >
              <span>+</span> Add Driver
            </button>
            <button
              onClick={() => fetchDrivers()}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-xs font-semibold rounded-lg border border-slate-200 flex items-center gap-1.5 text-slate-700 transition shadow-xs"
            >
              <span>🔄</span> Refresh
            </button>
          </div>
        </div>

        {/* Status Filter Tabs & Search Bar */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'ALL', label: 'All Drivers', count: counts.all },
              { id: 'PENDING', label: 'Pending Review', count: counts.pending, badgeColor: 'bg-amber-100 text-amber-800 border border-amber-300' },
              { id: 'APPROVED', label: 'Approved', count: counts.approved, badgeColor: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
              { id: 'REJECTED', label: 'Rejected', count: counts.rejected, badgeColor: 'bg-rose-100 text-rose-800 border border-rose-300' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition active:scale-95 shadow-xs ${
                  statusFilter === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    statusFilter === tab.id ? 'bg-slate-950/20 text-slate-950' : tab.badgeColor || 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative md:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver, phone, vehicle plate, license..."
              className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition shadow-2xs"
            />
            <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">🔍</span>
          </div>
        </div>

        {/* Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Drivers List */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-[750px] relative shadow-xs">
            {loading && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 overflow-hidden z-10">
                <div className="h-full bg-amber-500 animate-pulse w-full" />
              </div>
            )}
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider flex justify-between items-center">
              <span>Registered Drivers ({displayedDrivers.length})</span>
            </div>

            <div className={`flex-1 overflow-y-auto divide-y divide-slate-100 transition-opacity ${loading && drivers.length > 0 ? 'opacity-80' : 'opacity-100'}`}>
              {loading && drivers.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-sm">
                  <div className="inline-block animate-spin text-2xl mb-2">🔄</div>
                  <div>Loading drivers...</div>
                </div>
              ) : displayedDrivers.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No drivers match the selected filter or search.
                </div>
              ) : (
                displayedDrivers.map((d) => {
                  const isSelected = selectedDriver?.driverId === d.driverId;
                  const carModelMatch = d.adminNotes?.match(/\[Car Model:\s*([^\]]+)\]/);
                  const carModelName = carModelMatch ? carModelMatch[1].trim() : null;
                  const hasPlate = d.vehicle?.plateNumber && d.vehicle.plateNumber !== 'PENDING' && !d.vehicle.plateNumber.startsWith('KA 01 TR 0000');

                  return (
                    <div
                      key={d.driverId}
                      onClick={() => setSelectedDriverId(d.driverId)}
                      className={`p-4 cursor-pointer transition ${
                        isSelected ? 'bg-amber-50/50 border-l-4 border-amber-500' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {d.profilePhotoUrl ? (
                            <img src={d.profilePhotoUrl} alt={d.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg">👨🏽‍✈️</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-1">
                            <div className="font-bold text-slate-900 text-sm truncate">{d.fullName}</div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border flex-shrink-0 ${
                                d.verificationStatus === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : d.verificationStatus === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}
                            >
                              {d.verificationStatus}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{d.phone}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            DL: <span className="font-mono text-slate-800 font-semibold">{d.licenseNumber}</span>
                          </div>
                          <div className="text-[10px] text-amber-800 mt-1 font-semibold truncate">
                            🚗 {d.vehicle?.category || 'Segment Pending'} {carModelName ? `(${carModelName})` : ''} • {hasPlate ? d.vehicle.plateNumber : 'Plate Pending'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Evidence Inspector & Action Panel */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col h-[750px] overflow-y-auto shadow-xs">
            {selectedDriver ? (
              (() => {
                const carModelMatch = selectedDriver.adminNotes?.match(/\[Car Model:\s*([^\]]+)\]/);
                const carriageMatch = selectedDriver.adminNotes?.match(/\[Luggage\/Carriage:\s*([^\]]+)\]/);
                const carModelName = carModelMatch ? carModelMatch[1].trim() : null;
                const carriageInfo = carriageMatch ? carriageMatch[1].trim() : null;
                const cleanNote = selectedDriver.adminNotes
                  ? selectedDriver.adminNotes
                      .replace(/\[Car Model:[^\]]+\]/g, '')
                      .replace(/\[Luggage\/Carriage:[^\]]+\]/g, '')
                      .trim()
                  : '';
                const hasPlate =
                  selectedDriver.vehicle?.plateNumber &&
                  selectedDriver.vehicle.plateNumber !== 'PENDING' &&
                  !selectedDriver.vehicle.plateNumber.startsWith('KA 01 TR 0000');

                return (
                  <div className="space-y-6">
                    {/* Driver Info Header & Action Buttons */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 border-2 border-amber-400 flex-shrink-0 overflow-hidden flex items-center justify-center shadow-xs">
                          {selectedDriver.profilePhotoUrl ? (
                            <img
                              src={selectedDriver.profilePhotoUrl}
                              alt={selectedDriver.fullName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl">👨🏽‍✈️</span>
                          )}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            {selectedDriver.fullName}
                          </h2>
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-4">
                            <span>📞 {selectedDriver.phone}</span>
                            <span>🆔 DL: {selectedDriver.licenseNumber}</span>
                            <span>📅 Registered: {new Date(selectedDriver.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => openEditModal(selectedDriver)}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                          title="Edit Driver & Vehicle Details"
                        >
                          <span>✏️</span> Edit Details
                        </button>
                        <button
                          disabled={submitting || selectedDriver.verificationStatus === 'APPROVED'}
                          onClick={() => handleReview(selectedDriver.driverId, DriverVerificationStatus.APPROVED)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                        >
                          <span>✓</span> Approve Driver
                        </button>
                        <button
                          disabled={submitting || selectedDriver.verificationStatus === 'REJECTED'}
                          onClick={() => setRejectModalOpen(true)}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                        >
                          <span>✕</span> Reject Driver
                        </button>
                        <button
                          disabled={submitting || deleteLoading}
                          onClick={() => {
                            setDeleteError('');
                            setDeleteModalOpen(true);
                          }}
                          className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                          title="Delete Driver Account"
                        >
                          <span>🗑️</span> Delete Driver
                        </button>
                      </div>
                    </div>

                    {/* Status & Feedback alert */}
                    {cleanNote ? (
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                        <span className="font-bold">ℹ️ Note:</span>
                        <span>{cleanNote}</span>
                      </div>
                    ) : null}

                    {/* Vehicle & Carriage Specifications Summary */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          🚗 Vehicle & Carriage Specifications
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(selectedDriver)}
                            className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-100/70 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1 transition shadow-2xs"
                          >
                            <span>✏️</span> Edit Specs
                          </button>
                          {carModelName && (
                            <span className="text-[11px] font-bold text-slate-900 bg-white border border-slate-300 px-2 py-0.5 rounded-md shadow-2xs">
                              🚘 {carModelName}
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                              selectedDriver.vehicle?.category
                                ? 'text-amber-700 bg-amber-50 border-amber-200'
                                : 'text-slate-500 bg-slate-100 border-slate-200'
                            }`}
                          >
                            {selectedDriver.vehicle?.category || 'Pending Selection'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Plate / Reg No</div>
                          <div className="font-mono font-bold text-slate-900 mt-0.5">
                            {hasPlate ? selectedDriver.vehicle.plateNumber : 'Pending Upload'}
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Fuel Type</div>
                          <div className="font-bold text-slate-900 mt-0.5">
                            {selectedDriver.vehicle?.fuelType ? `⛽ ${selectedDriver.vehicle.fuelType}` : 'Pending Selection'}
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Passenger Seats</div>
                          <div className="font-bold text-slate-900 mt-0.5">
                            {selectedDriver.vehicle?.seatCount ? `👥 ${selectedDriver.vehicle.seatCount} Seater` : 'Pending'}
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Luggage / Carriage</div>
                          <div className="font-bold text-slate-900 mt-0.5 truncate" title={carriageInfo || 'Pending Selection'}>
                            {carriageInfo ? `🧳 ${carriageInfo}` : 'Pending Selection'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KYC Documents Review (Profile Photo, License, RC, Insurance) */}
                    <div>
                      <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider mb-3">
                        Official KYC & Profile Documents
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Driver Profile Photo */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center">
                          <div className="text-xs font-bold text-slate-700 mb-2">Driver Profile Photo</div>
                          {selectedDriver.profilePhotoUrl ? (
                            <a href={selectedDriver.profilePhotoUrl} target="_blank" rel="noreferrer" className="w-full flex flex-col items-center">
                              <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-amber-500 shadow-md my-2">
                                <img
                                  src={selectedDriver.profilePhotoUrl}
                                  alt="Driver Profile Photo"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className="text-[10px] text-amber-700 font-semibold mt-1">🔍 View Full Size</span>
                            </a>
                          ) : (
                            <div className="w-full h-36 flex items-center justify-center bg-white rounded-lg text-slate-400 text-xs border border-slate-200">
                              No Photo
                            </div>
                          )}
                        </div>

                        {/* License */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center">
                          <div className="text-xs font-bold text-slate-700 mb-2">Driving License</div>
                          {selectedDriver.licenseDocUrl ? (
                            <a href={selectedDriver.licenseDocUrl} target="_blank" rel="noreferrer" className="w-full">
                              <img
                                src={selectedDriver.licenseDocUrl}
                                alt="License"
                                className="w-full h-36 object-contain bg-slate-900 rounded-lg border border-slate-200"
                              />
                            </a>
                          ) : (
                            <div className="w-full h-36 flex items-center justify-center bg-white rounded-lg text-slate-400 text-xs border border-slate-200">
                              No Document
                            </div>
                          )}
                        </div>

                        {/* RC Book */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center">
                          <div className="text-xs font-bold text-slate-700 mb-2">RC Certificate</div>
                          {selectedDriver.rcDocUrl ? (
                            <a href={selectedDriver.rcDocUrl} target="_blank" rel="noreferrer" className="w-full">
                              <img
                                src={selectedDriver.rcDocUrl}
                                alt="RC Book"
                                className="w-full h-36 object-contain bg-slate-900 rounded-lg border border-slate-200"
                              />
                            </a>
                          ) : (
                            <div className="w-full h-36 flex items-center justify-center bg-white rounded-lg text-slate-400 text-xs border border-slate-200">
                              No Document
                            </div>
                          )}
                        </div>

                        {/* Insurance */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center">
                          <div className="text-xs font-bold text-slate-700 mb-2">Vehicle Insurance</div>
                          {selectedDriver.insuranceDocUrl ? (
                            <a href={selectedDriver.insuranceDocUrl} target="_blank" rel="noreferrer" className="w-full">
                              <img
                                src={selectedDriver.insuranceDocUrl}
                                alt="Insurance"
                                className="w-full h-36 object-contain bg-slate-900 rounded-lg border border-slate-200"
                              />
                            </a>
                          ) : (
                            <div className="w-full h-36 flex items-center justify-center bg-white rounded-lg text-slate-400 text-xs border border-slate-200">
                              No Document
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bank & Payout Details (RazorpayX Integration) */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-200 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">💳</span>
                          <div>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                              Bank Account & Payout Details (RazorpayX)
                            </h3>
                            <div className="text-[11px] text-slate-500">
                              Method:{' '}
                              <span className="font-bold text-slate-800">
                                {selectedDriver.payoutMethod === 'UPI' ? '⚡ UPI Transfer (Option 2)' : '🏦 Bank Transfer (Option 1)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedDriver.payoutStatus === 'VERIFIED' ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1">
                              <span>✓</span> Payout Verified
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1">
                              <span>⏳</span> Verification Pending
                            </span>
                          )}

                          {selectedDriver.payoutStatus === 'VERIFIED' ? (
                            <button
                              onClick={() => handleTogglePayoutStatus(selectedDriver.driverId, 'PENDING')}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition"
                              title="Revoke verification"
                            >
                              Mark Pending
                            </button>
                          ) : (
                            <button
                              onClick={() => handleTogglePayoutStatus(selectedDriver.driverId, 'VERIFIED')}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-2xs transition flex items-center gap-1"
                              title="Verify driver bank account for RazorpayX payouts"
                            >
                              <span>✓</span> Verify Bank Details
                            </button>
                          )}

                          <button
                            onClick={() => openEditModal(selectedDriver)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold shadow-2xs transition flex items-center gap-1"
                          >
                            <span>✏️</span> Edit
                          </button>
                        </div>
                      </div>

                      {/* Details Display */}
                      {selectedDriver.payoutMethod === 'UPI' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Driver's Full Name</div>
                            <div className="font-bold text-slate-900 mt-0.5">
                              {selectedDriver.bankAccountHolderName || selectedDriver.fullName || 'Not Provided'}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-sky-200 bg-sky-50/30">
                            <div className="text-[10px] text-sky-700 font-bold uppercase">UPI ID (VPA)</div>
                            <div className="font-mono font-bold text-sky-900 mt-0.5 truncate" title={selectedDriver.payoutUpiId || ''}>
                              {selectedDriver.payoutUpiId || 'Not Provided'}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Payout Contact Phone</div>
                            <div className="font-bold text-slate-900 mt-0.5">
                              {selectedDriver.payoutPhone || selectedDriver.phone || 'None'}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Payout Contact Email</div>
                            <div className="font-bold text-slate-900 mt-0.5 truncate" title={selectedDriver.payoutEmail || ''}>
                              {selectedDriver.payoutEmail || 'None'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Account Holder Name</div>
                            <div className="font-bold text-slate-900 mt-0.5">
                              {selectedDriver.bankAccountHolderName || 'Not Provided'}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Bank Account Number</div>
                            <div className="font-mono font-bold text-slate-900 mt-0.5">
                              {selectedDriver.bankAccountNumber
                                ? `•••• ${selectedDriver.bankAccountNumber.slice(-4)} (${selectedDriver.bankAccountNumber})`
                                : 'Not Provided'}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Bank IFSC Code</div>
                            <div className="font-mono font-bold text-emerald-800 mt-0.5">
                              {selectedDriver.bankIfsc || 'Not Provided'}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Bank Name</div>
                            <div className="font-bold text-slate-900 mt-0.5">
                              {selectedDriver.bankName || 'Not Specified'}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Payout Contact Phone</div>
                            <div className="font-bold text-slate-900 mt-0.5">
                              {selectedDriver.payoutPhone || selectedDriver.phone || 'None'}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Payout Contact Email</div>
                            <div className="font-bold text-slate-900 mt-0.5 truncate" title={selectedDriver.payoutEmail || ''}>
                              {selectedDriver.payoutEmail || 'None'}
                            </div>
                          </div>
                        </div>
                      )}

                      {!selectedDriver.bankAccountNumber && !selectedDriver.payoutUpiId && (
                        <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-center gap-2">
                          <span>⚠️</span>
                          <span>Driver has not submitted settlement details yet. Details can be collected via the mobile app or manually edited.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <div className="text-4xl mb-2">🚗</div>
                <div>Select a driver from the left list to review KYC evidence.</div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Reject Reason Modal */}
      {rejectModalOpen && selectedDriver && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>✕</span> Reject Driver KYC
            </h3>
            <p className="text-xs text-slate-500">
              Provide specific feedback explaining why the documents were rejected. The driver will see this feedback in their mobile app to fix and re-upload.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rejection Reason / Notes:</label>
              <textarea
                rows={4}
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="e.g. RC book photo is blurry; Driving License has expired. Please re-upload clear copies."
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                disabled={submitting}
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectNotes('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={submitting || !rejectNotes.trim()}
                onClick={() =>
                  handleReview(
                    selectedDriver.driverId,
                    DriverVerificationStatus.REJECTED,
                    rejectNotes.trim()
                  )
                }
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-xs"
              >
                {submitting ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Driver & Vehicle Details Modal */}
      {editModalOpen && selectedDriver && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>✏️</span> Edit Driver & Vehicle Specifications
              </h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {editDriverError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                ⚠️ {editDriverError}
              </div>
            )}

            <form onSubmit={handleEditDriver} className="space-y-4 text-xs">
              {/* Section 1: Driver Identity */}
              <div>
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Driver Identity & Contact
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Driver Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editDriverData.fullName}
                      onChange={(e) => setEditDriverData({ ...editDriverData, fullName: e.target.value })}
                      placeholder="e.g. Suresh Gowda"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Mobile Number (10 digits) *</label>
                    <div className="flex">
                      <span className="bg-slate-100 text-slate-600 px-3 py-2.5 rounded-l-lg border border-r-0 border-slate-300 font-semibold">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength={10}
                        required
                        value={editDriverData.phone}
                        onChange={(e) => setEditDriverData({ ...editDriverData, phone: e.target.value.replace(/\D/g, '') })}
                        placeholder="9876543210"
                        className="w-full bg-white border border-slate-300 rounded-r-lg p-2.5 text-slate-900 font-bold placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-slate-700 font-bold mb-1">Driving License Number (DL)</label>
                  <input
                    type="text"
                    value={editDriverData.licenseNumber}
                    onChange={(e) => setEditDriverData({ ...editDriverData, licenseNumber: e.target.value })}
                    placeholder="e.g. KA 01 2023 0089745"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none uppercase"
                  />
                </div>
              </div>

              {/* Section 2: Vehicle & Carriage Specifications */}
              <div className="pt-3 border-t border-slate-200">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  2. Vehicle Specifications & Carriage
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Vehicle Category (Segment)</label>
                    <select
                      value={editDriverData.category}
                      onChange={(e) => setEditDriverData({ ...editDriverData, category: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="HATCHBACK">Hatchback (4 Seats • WagonR, Swift, Tiago)</option>
                      <option value="SEDAN">Sedan (4 Seats • Dzire, Etios, Aura)</option>
                      <option value="SUV">SUV (6 Seats • Ertiga, Carens, XL6)</option>
                      <option value="SUV_PREMIUM">SUV Premium (7 Seats • Innova Crysta, Hycross)</option>
                      <option value="TEMPO_TRAVELER">Tempo Traveller (12 Seats • Force Traveller)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Which Car (Make & Model Name)</label>
                    <input
                      type="text"
                      value={editDriverData.carModel}
                      onChange={(e) => setEditDriverData({ ...editDriverData, carModel: e.target.value })}
                      placeholder="e.g. Maruti Suzuki Dzire / Wagon R"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Vehicle Plate / Registration Number</label>
                    <div className="flex">
                      <span className="bg-slate-900 text-amber-400 px-2.5 py-2.5 rounded-l-lg border border-r-0 border-slate-800 font-black text-[10px]">
                        IND
                      </span>
                      <input
                        type="text"
                        value={editDriverData.plateNumber}
                        onChange={(e) => setEditDriverData({ ...editDriverData, plateNumber: e.target.value })}
                        placeholder="e.g. KA 19 2025"
                        className="w-full bg-white border border-slate-300 rounded-r-lg p-2.5 text-slate-900 font-mono font-bold placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Fuel Type</label>
                    <select
                      value={editDriverData.fuelType}
                      onChange={(e) => setEditDriverData({ ...editDriverData, fuelType: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="DIESEL">⛽ Diesel</option>
                      <option value="PETROL">⛽ Petrol</option>
                      <option value="CNG">🟢 CNG</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-slate-700 font-bold mb-1">Carriage / Luggage Allowance</label>
                  <select
                    value={editDriverData.carriageCapacity}
                    onChange={(e) => setEditDriverData({ ...editDriverData, carriageCapacity: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="None (No Carriage / Luggage Space)">🚫 None (No Luggage Space)</option>
                    <option value="2 Large Bags (Standard Boot)">👜 2 Large Bags (Standard Boot)</option>
                    <option value="3 Large Bags (Spacious Boot)">🧳 3 Large Bags (Spacious Boot)</option>
                    <option value="4 Large Bags (SUV Boot Space)">🧳 4 Large Bags (SUV Boot Space)</option>
                    <option value="5+ Large Bags (Max Cargo)">🚐 5+ Large Bags (Max Cargo)</option>
                    <option value="Roof Carrier Included 🧳 (Heavy Luggage / Hill Trips)">🧳 Roof Carrier Included (Heavy Luggage)</option>
                  </select>
                </div>
              </div>

              {/* Section 3: Bank & Payout Details (RazorpayX) */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    3. Bank & Payout Details (RazorpayX)
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold text-slate-600">Verification Status:</label>
                    <select
                      value={editDriverData.payoutStatus}
                      onChange={(e) => setEditDriverData({ ...editDriverData, payoutStatus: e.target.value })}
                      className={`text-[11px] font-bold rounded px-2 py-1 border ${
                        editDriverData.payoutStatus === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      <option value="PENDING">⏳ Pending Verification</option>
                      <option value="VERIFIED">✓ Verified</option>
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="block text-slate-700 font-bold mb-1">Payout Method</label>
                  <select
                    value={editDriverData.payoutMethod}
                    onChange={(e) => setEditDriverData({ ...editDriverData, payoutMethod: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none font-semibold"
                  >
                    <option value="BANK">Option 1: Bank Account Transfer (NEFT/IMPS)</option>
                    <option value="UPI">Option 2: UPI Transfer (Instant VPA)</option>
                  </select>
                </div>

                {editDriverData.payoutMethod === 'BANK' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Account Holder Name *</label>
                        <input
                          type="text"
                          value={editDriverData.bankAccountHolderName}
                          onChange={(e) => setEditDriverData({ ...editDriverData, bankAccountHolderName: e.target.value })}
                          placeholder="e.g. Ramesh Kumar"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Bank Account Number *</label>
                        <input
                          type="text"
                          value={editDriverData.bankAccountNumber}
                          onChange={(e) => setEditDriverData({ ...editDriverData, bankAccountNumber: e.target.value })}
                          placeholder="e.g. 50100428912345"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Bank IFSC Code *</label>
                        <input
                          type="text"
                          value={editDriverData.bankIfsc}
                          onChange={(e) => setEditDriverData({ ...editDriverData, bankIfsc: e.target.value.toUpperCase() })}
                          placeholder="e.g. HDFC0001234"
                          maxLength={11}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono uppercase placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Bank Name (For Display)</label>
                        <input
                          type="text"
                          value={editDriverData.bankName}
                          onChange={(e) => setEditDriverData({ ...editDriverData, bankName: e.target.value })}
                          placeholder="e.g. HDFC Bank"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Driver's Full Name *</label>
                      <input
                        type="text"
                        value={editDriverData.bankAccountHolderName}
                        onChange={(e) => setEditDriverData({ ...editDriverData, bankAccountHolderName: e.target.value })}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">UPI ID (e.g. driver@oksbi) *</label>
                      <input
                        type="text"
                        value={editDriverData.payoutUpiId}
                        onChange={(e) => setEditDriverData({ ...editDriverData, payoutUpiId: e.target.value })}
                        placeholder="e.g. driver@oksbi"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Payout Mobile Number (Optional)</label>
                    <input
                      type="tel"
                      value={editDriverData.payoutPhone}
                      onChange={(e) => setEditDriverData({ ...editDriverData, payoutPhone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Payout Email Address (Optional)</label>
                    <input
                      type="email"
                      value={editDriverData.payoutEmail}
                      onChange={(e) => setEditDriverData({ ...editDriverData, payoutEmail: e.target.value })}
                      placeholder="e.g. driver@kandycabs.in"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  disabled={editDriverLoading}
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editDriverLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-xs disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  {editDriverLoading ? 'Saving Changes...' : '✓ Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>➕</span> Register Driver Account
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {addDriverError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
                ⚠️ {addDriverError}
              </div>
            )}

            <form onSubmit={handleAddDriver} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Driver Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newDriver.fullName}
                    onChange={(e) => setNewDriver({ ...newDriver, fullName: e.target.value })}
                    placeholder="e.g. Suresh Gowda"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Mobile Number (10 digits) *</label>
                  <div className="flex">
                    <span className="bg-slate-100 text-slate-600 px-3 py-2.5 rounded-l-lg border border-r-0 border-slate-300 font-semibold">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      required
                      value={newDriver.phone}
                      onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value.replace(/\D/g, '') })}
                      placeholder="9876543210"
                      className="w-full bg-white border border-slate-300 rounded-r-lg p-2.5 text-slate-900 font-bold placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Driving License Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newDriver.licenseNumber}
                    onChange={(e) => setNewDriver({ ...newDriver, licenseNumber: e.target.value })}
                    placeholder="e.g. KA01-20220005432"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Vehicle Plate / Reg Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newDriver.plateNumber}
                    onChange={(e) => setNewDriver({ ...newDriver, plateNumber: e.target.value })}
                    placeholder="e.g. KA 01 MJ 5678"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Vehicle Category <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={newDriver.category}
                    onChange={(e) => setNewDriver({ ...newDriver, category: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="HATCHBACK">Hatchback (WagonR, Tiago)</option>
                    <option value="SEDAN">Sedan (Dzire, Etios)</option>
                    <option value="SUV">SUV 6+1 (Ertiga, Carens)</option>
                    <option value="SUV_PREMIUM">SUV Premium 7+1 (Innova Crysta)</option>
                    <option value="TEMPO_TRAVELER">Tempo Traveller 12+1 (Force)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Fuel Type <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={newDriver.fuelType}
                    onChange={(e) => setNewDriver({ ...newDriver, fuelType: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="DIESEL">Diesel</option>
                    <option value="PETROL">Petrol</option>
                    <option value="CNG">CNG</option>
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 p-2.5 rounded-lg font-medium">
                ⏳ Driver will be registered in <strong>PENDING</strong> status. The driver can immediately log into the Driver App to upload their Driving License, RC, Insurance & Vehicle Photos. Once uploaded, you can review and approve them here.
              </p>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  disabled={addDriverLoading}
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addDriverLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-xs disabled:opacity-50 transition"
                >
                  {addDriverLoading ? 'Registering Driver...' : 'Register Driver →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Driver Confirmation Modal */}
      {deleteModalOpen && selectedDriver && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200 animate-scale-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl font-bold flex-shrink-0">
                🗑️
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Driver Account</h3>
                <p className="text-xs text-slate-500">Permanent Removal Action</p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium">
                {deleteError}
              </div>
            )}

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 mb-5">
              <p>
                Are you sure you want to delete <strong className="text-slate-950 font-bold">{selectedDriver.fullName}</strong> ({selectedDriver.phone})?
              </p>
              <p className="text-slate-500 text-[11px]">
                This will unassign the driver's vehicle ({selectedDriver.vehicle?.plateNumber || 'No vehicle'}), expire pending dispatches, and remove the driver account from the active roster.
              </p>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteError('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDeleteDriver}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting Driver...' : 'Yes, Delete Driver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
