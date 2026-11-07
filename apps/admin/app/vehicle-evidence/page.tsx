'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminNavbar } from '@/components/AdminNavbar';
import { DriverVerificationStatus } from '@kandy-cabs/shared';
import { parseDocExpiryDate } from '@/lib/documentExpiry';

function getDocValidityStatus(validTo?: string | null, validFrom?: string | null) {
  if (!validTo && !validFrom) return null;

  if (validTo && validTo.toLowerCase().includes('permanent')) {
    return {
      text: 'Permanent KYC',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold',
    };
  }

  if (validTo) {
    const expiryDate = parseDocExpiryDate(validTo);
    if (expiryDate) {
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const expiryMidnight = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate()).getTime();
      const diffMs = expiryMidnight - todayMidnight;
      const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (daysLeft < 0) {
        return {
          text: `Expired (${Math.abs(daysLeft)}d ago)`,
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
        };
      }
      if (daysLeft === 0) {
        return {
          text: 'Expires Today',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
        };
      }
      if (daysLeft <= 5) {
        return {
          text: `Exp in ${daysLeft}d (${validTo})`,
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        };
      }
      if (daysLeft <= 30) {
        return {
          text: `Exp: ${validTo} (${daysLeft}d)`,
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 font-medium',
        };
      }
      return {
        text: `Exp: ${validTo}`,
        badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
      };
    }
    return {
      text: `Exp: ${validTo}`,
      badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    };
  }

  if (validFrom) {
    return {
      text: `Reg: ${validFrom}`,
      badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    };
  }

  return null;
}

export const dynamic = 'force-dynamic';

function AdminVehicleEvidenceContent() {
  const searchParams = useSearchParams();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0, expiringSoon: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    const s = searchParams?.get('status');
    if (s && ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRING'].includes(s.toUpperCase())) {
      setStatusFilter(s.toUpperCase());
    }
  }, [searchParams]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [mobileExpandedDriverId, setMobileExpandedDriverId] = useState<string | null>(null);
  const [inspectorVehicleIndex, setInspectorVehicleIndex] = useState(0);

  // Lightbox / Image Preview modal state
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

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
      if (statusFilter === 'EXPIRING') {
        if (!d.hasExpiringDocs) return false;
      } else if (statusFilter !== 'ALL' && d.verificationStatus !== statusFilter) {
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

  const renderDriverInspector = (driver: any, isMobileView: boolean = false) => {
    if (!driver) return null;

    const vehicles = Array.isArray(driver.vehiclesList) && driver.vehiclesList.length > 0
      ? driver.vehiclesList
      : null;
    const safeVehIdx = vehicles ? Math.min(inspectorVehicleIndex, vehicles.length - 1) : 0;
    const currentVeh = vehicles ? vehicles[safeVehIdx] : null;

    const carModelMatch = driver.adminNotes?.match(/\[Car Model:\s*([^\]]+)\]/);
    const carriageMatch = driver.adminNotes?.match(/\[Luggage\/Carriage:\s*([^\]]+)\]/);
    const carModelName = currentVeh?.carModel || (carModelMatch ? carModelMatch[1].trim() : (driver.carModel || null));
    const carriageInfo = currentVeh?.carriageCapacity || (carriageMatch ? carriageMatch[1].trim() : (driver.carriageCapacity || null));
    const cleanNote = driver.adminNotes
      ? driver.adminNotes
          .replace(/\[Car Model:[^\]]+\]/g, '')
          .replace(/\[Luggage\/Carriage:[^\]]+\]/g, '')
          .replace(/\[ExtraDocs:[\s\S]*?\]/g, '')
          .replace(/\[DocDates:[\s\S]*?\]/g, '')
          .replace(/\[MultiVehicles:[\s\S]*?\]/g, '')
          .trim()
      : '';
    const hasPlate = currentVeh?.plateNumber
      ? !!currentVeh.plateNumber
      : (
          driver.vehicle?.plateNumber &&
          driver.vehicle.plateNumber !== 'PENDING' &&
          !driver.vehicle.plateNumber.startsWith('KA 01 TR 0000')
        );
    const activePlate = currentVeh?.plateNumber || (hasPlate ? driver.vehicle.plateNumber : 'KA 19 2025');
    const activeFuel = currentVeh?.fuelType || driver.vehicle?.fuelType || 'PETROL';
    const activeSeats = currentVeh?.category === 'SUV' || currentVeh?.category === 'INNOVA'
      ? '6-7 Seater'
      : (driver.vehicle?.seatCount ? `${driver.vehicle.seatCount} Seater` : '4 Seater');

    return (
      <div className="space-y-4">
        {/* On desktop: show the top Driver Profile Header Card. On mobile: the summary card already displays this */}
        {!isMobileView ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-2.5 sm:p-3.5 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-100 border-2 flex-shrink-0 overflow-hidden flex items-center justify-center shadow-xs ${
                  driver.verificationStatus === 'APPROVED' ? 'border-emerald-400' :
                  driver.verificationStatus === 'REJECTED' ? 'border-rose-400' : 'border-amber-400'
                }`}>
                  {driver.profilePhotoUrl ? (
                    <img
                      src={driver.profilePhotoUrl}
                      alt={driver.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                      {driver.fullName}
                    </h2>
                    {driver.verificationStatus === 'APPROVED' ? (
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                        <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Approved Driver
                      </span>
                    ) : driver.verificationStatus === 'REJECTED' ? (
                      <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                        <svg className="w-3.5 h-3.5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Rejected Driver
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Pending Review
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {driver.phone}
                    </span>
                    <span className="hidden sm:inline">DL: {driver.licenseNumber || 'KA 19 2025/0002'}</span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                      </svg>
                      {hasPlate ? `Reg: ${driver.vehicle.plateNumber}` : 'Reg: KA19D2025'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Action Buttons on Desktop */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-slate-100">
              <button
                onClick={() => openEditModal(driver)}
                className="flex-1 py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                title="Edit Driver & Vehicle Details"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Details
              </button>
              <button
                disabled={submitting || driver.verificationStatus === 'APPROVED'}
                onClick={() => handleReview(driver.driverId, DriverVerificationStatus.APPROVED)}
                className="flex-1 py-2 px-3.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Approve Driver
              </button>
              <button
                disabled={submitting || driver.verificationStatus === 'REJECTED'}
                onClick={() => {
                  setSelectedDriverId(driver.driverId);
                  setRejectModalOpen(true);
                }}
                className="flex-1 py-2 px-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Reject Driver
              </button>
              <button
                disabled={submitting || deleteLoading}
                onClick={() => {
                  setSelectedDriverId(driver.driverId);
                  setDeleteError('');
                  setDeleteModalOpen(true);
                }}
                className="flex-1 py-2 px-3.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                title="Delete Driver Account"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete Driver
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={() => openEditModal(driver)}
              className="flex-1 py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Details
            </button>
            <button
              disabled={submitting || driver.verificationStatus === 'APPROVED'}
              onClick={() => handleReview(driver.driverId, DriverVerificationStatus.APPROVED)}
              className="flex-1 py-2.5 px-3.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Approve Driver
            </button>
            <button
              disabled={submitting || driver.verificationStatus === 'REJECTED'}
              onClick={() => {
                setSelectedDriverId(driver.driverId);
                setRejectModalOpen(true);
              }}
              className="flex-1 py-2.5 px-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Reject Driver
            </button>
            <button
              disabled={submitting || deleteLoading}
              onClick={() => {
                setSelectedDriverId(driver.driverId);
                setDeleteError('');
                setDeleteModalOpen(true);
              }}
              className="flex-1 py-2.5 px-3.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete Driver
            </button>
          </div>
        )}

        {/* Status & Feedback note */}
        {cleanNote && (
          <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>
              <span className="font-bold">Note: </span>
              <span>{cleanNote}</span>
            </div>
          </div>
        )}

        {/* Multi-Vehicle Fleet Selector Tabs in Admin */}
        {vehicles && vehicles.length > 1 && (
          <div className="bg-slate-900 text-white rounded-2xl p-3 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z" />
                </svg>
                Registered Vehicles Fleet ({vehicles.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Inspecting Vehicle {safeVehIdx + 1} of {vehicles.length}
              </span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {vehicles.map((v: any, idx: number) => {
                const isSelected = idx === safeVehIdx;
                const docsCount = [v.rcDocUrl, v.insuranceDocUrl, v.fitnessDocUrl, v.taxDocUrl, v.permitDocUrl, v.pucDocUrl].filter(Boolean).length;
                return (
                  <button
                    key={v.id || idx}
                    type="button"
                    onClick={() => setInspectorVehicleIndex(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 border ${
                      isSelected
                        ? 'bg-orange-500 border-orange-400 text-white shadow-xs'
                        : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span>🚗 {v.plateNumber || `Vehicle ${idx + 1}`}</span>
                    <span className="opacity-75 text-[10px]">({v.carModel || v.category || 'Sedan'})</span>
                    <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${
                      isSelected ? 'bg-black/30 text-white' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {docsCount}/6
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Vehicle Specifications Section */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3 sm:p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
              </svg>
              <span className="hidden sm:inline">Vehicle & Carriage Specifications</span>
              <span className="sm:hidden">Vehicle Specifications</span>
            </h3>
            {carModelName && (
              <span className="text-[10px] sm:text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                {carModelName}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1.5 truncate">
                <svg className="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="10" rx="2" />
                  <line x1="6" y1="12" x2="6.01" y2="12" />
                  <line x1="18" y1="12" x2="18.01" y2="12" />
                </svg>
                Plate Number
              </div>
              <div className="font-mono font-bold text-slate-900 text-xs sm:text-sm mt-1 truncate">
                {activePlate}
              </div>
            </div>

            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1.5 truncate">
                <svg className="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 2v20M21 12h-4M17 6h4v12h-4M3 6h10v14H3z" />
                </svg>
                Fuel Type
              </div>
              <div className="font-bold text-slate-900 text-xs sm:text-sm mt-1 truncate">
                {activeFuel}
              </div>
            </div>

            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1.5 truncate">
                <svg className="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Passenger Seats
              </div>
              <div className="font-bold text-slate-900 text-xs sm:text-sm mt-1 truncate">
                {activeSeats}
              </div>
            </div>

            <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1.5 truncate">
                <svg className="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                Carriage / Luggage
              </div>
              <div className="font-bold text-slate-900 text-xs sm:text-sm mt-1 truncate" title={carriageInfo || '2 Large Bags (Standard Boot)'}>
                {carriageInfo === 'Yes' ? 'Carrier Equipped (Yes)' : carriageInfo === 'No' ? 'Standard Boot (No Carrier)' : carriageInfo || 'Standard Boot'}
              </div>
            </div>
          </div>
        </div>

        {/* Urgent Document Expiry Alert Banner */}
        {driver.hasExpiringDocs && driver.expiringDocuments?.length > 0 && (
          <div className="p-3 bg-red-50/90 border border-red-200 rounded-2xl flex items-start gap-3 shadow-2xs">
            <div className="w-7 h-7 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shrink-0 text-red-600 font-bold text-xs mt-0.5">
              ⚠️
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-red-900 flex items-center gap-2">
                Document Expiry Action Required
                <span className="text-[10px] bg-red-200/80 text-red-800 px-2 py-0.5 rounded-full font-bold">
                  {driver.expiringDocuments.length} Document{driver.expiringDocuments.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-red-700 mt-0.5">
                The driver has compliance documents that are already expired or expiring within 5 days.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {driver.expiringDocuments.map((doc: any, i: number) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                      doc.status === 'EXPIRED'
                        ? 'bg-red-600 text-white border-red-700'
                        : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}
                  >
                    <span>{doc.docName}:</span>
                    <span>{doc.label}</span>
                    <span className="opacity-80">({doc.expiryDateFormatted})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* All 10 Driver Identity & Vehicle Compliance Documents */}
        {(() => {
          const kycDocs = [
            {
              key: 'profile',
              title: 'Driver Profile Photo',
              url: driver.profilePhotoUrl,
              docNumber: null,
              validFrom: null,
              validTo: null,
              isProfile: true,
            },
            {
              key: 'license',
              title: 'Driving License (DL)',
              url: driver.licenseDocUrl,
              docNumber: driver.docDates?.license?.docNumber || driver.licenseNumber,
              validFrom: driver.docDates?.license?.validFrom,
              validTo: driver.docDates?.license?.validTo,
            },
            {
              key: 'aadhaar',
              title: 'Aadhaar Card',
              url: driver.aadhaarDocUrl,
              docNumber: driver.docDates?.aadhaar?.docNumber,
              validFrom: driver.docDates?.aadhaar?.validFrom,
              validTo: driver.docDates?.aadhaar?.validTo || 'Permanent',
            },
            {
              key: 'pan',
              title: 'PAN Card',
              url: driver.panDocUrl,
              docNumber: driver.docDates?.pan?.docNumber,
              validFrom: driver.docDates?.pan?.validFrom,
              validTo: driver.docDates?.pan?.validTo || 'Permanent',
            },
          ];

          const vehicleDocs = [
            {
              key: 'rc',
              title: 'RC Certificate',
              url: currentVeh ? currentVeh.rcDocUrl : driver.rcDocUrl,
              docNumber: currentVeh?.docDates?.rc?.docNumber || driver.docDates?.rc?.docNumber || (hasPlate ? activePlate : null),
              validFrom: currentVeh?.docDates?.rc?.validFrom || driver.docDates?.rc?.validFrom,
              validTo: currentVeh?.docDates?.rc?.validTo || driver.docDates?.rc?.validTo,
            },
            {
              key: 'insurance',
              title: 'Vehicle Insurance Policy',
              url: currentVeh ? currentVeh.insuranceDocUrl : driver.insuranceDocUrl,
              docNumber: currentVeh?.docDates?.insurance?.docNumber || driver.docDates?.insurance?.docNumber,
              validFrom: currentVeh?.docDates?.insurance?.validFrom || driver.docDates?.insurance?.validFrom,
              validTo: currentVeh?.docDates?.insurance?.validTo || driver.docDates?.insurance?.validTo,
            },
            {
              key: 'fitness',
              title: 'Fitness Certificate (FC)',
              url: currentVeh ? currentVeh.fitnessDocUrl : driver.fitnessDocUrl,
              docNumber: currentVeh?.docDates?.fitness?.docNumber || driver.docDates?.fitness?.docNumber,
              validFrom: currentVeh?.docDates?.fitness?.validFrom || driver.docDates?.fitness?.validFrom,
              validTo: currentVeh?.docDates?.fitness?.validTo || driver.docDates?.fitness?.validTo,
            },
            {
              key: 'tax',
              title: 'Road Tax Receipt',
              url: currentVeh ? currentVeh.taxDocUrl : driver.taxDocUrl,
              docNumber: currentVeh?.docDates?.tax?.docNumber || driver.docDates?.tax?.docNumber,
              validFrom: currentVeh?.docDates?.tax?.validFrom || driver.docDates?.tax?.validFrom,
              validTo: currentVeh?.docDates?.tax?.validTo || driver.docDates?.tax?.validTo,
            },
            {
              key: 'permit',
              title: 'Commercial Permit',
              url: currentVeh ? currentVeh.permitDocUrl : driver.permitDocUrl,
              docNumber: currentVeh?.docDates?.permit?.docNumber || driver.docDates?.permit?.docNumber,
              validFrom: currentVeh?.docDates?.permit?.validFrom || driver.docDates?.permit?.validFrom,
              validTo: currentVeh?.docDates?.permit?.validTo || driver.docDates?.permit?.validTo,
            },
            {
              key: 'puc',
              title: 'PUC Emission Certificate',
              url: currentVeh ? currentVeh.pucDocUrl : driver.pucDocUrl,
              docNumber: currentVeh?.docDates?.puc?.docNumber || driver.docDates?.puc?.docNumber,
              validFrom: currentVeh?.docDates?.puc?.validFrom || driver.docDates?.puc?.validFrom,
              validTo: currentVeh?.docDates?.puc?.validTo || driver.docDates?.puc?.validTo,
            },
          ];

          const kycUploadedCount = kycDocs.filter((d) => Boolean(d.url)).length;
          const vehicleUploadedCount = vehicleDocs.filter((d) => Boolean(d.url)).length;

          const renderCard = (item: any) => {
            const validity = item.isProfile
              ? { text: 'Driver Portrait', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' }
              : getDocValidityStatus(item.validTo, item.validFrom);

            return (
              <div
                key={item.key}
                className={`bg-white border rounded-xl p-2.5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition min-w-0 ${
                  item.url ? 'border-slate-200' : 'border-dashed border-slate-200 bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="text-xs font-bold text-slate-800 truncate" title={item.title}>
                      {item.title}
                    </div>
                    {item.url ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Uploaded
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-full shrink-0">
                        Missing
                      </span>
                    )}
                  </div>
                  {item.docNumber && (
                    <div className="text-[10px] font-mono font-medium text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-150 truncate mb-1" title={item.docNumber}>
                      No: {item.docNumber}
                    </div>
                  )}
                </div>

                <div className="w-full h-24 sm:h-28 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/80 relative flex items-center justify-center group my-1">
                  {item.url ? (
                    <>
                      <img
                        src={item.url}
                        alt={item.title}
                        className={`w-full h-full ${item.isProfile ? 'object-cover' : 'object-contain bg-slate-900'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ title: item.title, url: item.url! })}
                        className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-white/95 hover:bg-white text-slate-700 border border-slate-200 shadow-sm flex items-center justify-center text-xs transition cursor-pointer"
                        title="View full size"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="11" cy="11" r="7" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400 p-2 text-center">
                      <svg className="w-6 h-6 stroke-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-[10px] font-medium">Not Uploaded</span>
                    </div>
                  )}
                </div>

                <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between min-w-0">
                  {validity ? (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border truncate ${validity.badgeClass}`} title={validity.text}>
                      {validity.text}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">No date set</span>
                  )}
                  {item.url && (
                    <button
                      type="button"
                      onClick={() => setPreviewDoc({ title: item.title, url: item.url! })}
                      className="text-[11px] text-sky-600 hover:text-sky-700 font-bold cursor-pointer shrink-0 ml-1 flex items-center gap-0.5"
                    >
                      <span>Zoom</span>
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          };

          return (
            <div className="space-y-4">
              {/* Section 1: Driver Identity & KYC Documents */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <circle cx="12" cy="13" r="2" />
                    </svg>
                    <span>Driver Identity & KYC Documents</span>
                  </h3>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                    {kycUploadedCount}/4 Uploaded
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  {kycDocs.map(renderCard)}
                </div>
              </div>

              {/* Section 2: Vehicle Documents & Commercial Permits */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                    <span>Vehicle Documents & Commercial Permits</span>
                  </h3>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                    {vehicleUploadedCount}/6 Uploaded
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {vehicleDocs.map(renderCard)}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Bank Account & Payout Details (RAZORPAYX) Section */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3 sm:p-4 space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="21" x2="21" y2="21" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <polyline points="5 6 12 3 19 6" />
                <line x1="4" y1="10" x2="4" y2="21" />
                <line x1="20" y1="10" x2="20" y2="21" />
                <line x1="8" y1="14" x2="8" y2="17" />
                <line x1="12" y1="14" x2="12" y2="17" />
                <line x1="16" y1="14" x2="16" y2="17" />
              </svg>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  <span className="hidden sm:inline">Bank Account & Payout Details (RAZORPAYX)</span>
                  <span className="sm:hidden">Bank Account & Payout Details</span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {driver.payoutStatus === 'VERIFIED' ? (
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Verified
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending
                </span>
              )}

              {/* Desktop action buttons */}
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  onClick={() => handleTogglePayoutStatus(driver.driverId, driver.payoutStatus === 'VERIFIED' ? 'PENDING' : 'VERIFIED')}
                  className={`px-3 py-1.5 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
                    driver.payoutStatus === 'VERIFIED'
                      ? 'bg-slate-700 hover:bg-slate-600'
                      : 'bg-emerald-700 hover:bg-emerald-600'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{driver.payoutStatus === 'VERIFIED' ? 'Mark Pending' : 'Verify Bank'}</span>
                </button>
                <button
                  onClick={() => openEditModal(driver)}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>Edit</span>
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Bank Details Cards */}
          <div className="hidden sm:grid grid-cols-3 gap-3 text-xs">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase truncate">Account Holder Name</div>
              <div className="font-bold text-slate-900 mt-0.5 truncate">
                {driver.bankAccountHolderName || 'Not Provided'}
              </div>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase truncate">Bank Account Number</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5 truncate">
                {driver.bankAccountNumber
                  ? `•••• ${driver.bankAccountNumber.slice(-4)}`
                  : 'Not Provided'}
              </div>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase truncate">Bank IFSC Code</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5 truncate">
                {driver.bankIfsc || 'Not Provided'}
              </div>
            </div>
          </div>

          {/* Mobile Bank Details Cards (2 column grid) */}
          <div className="grid sm:hidden grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase truncate">Account Holder</div>
              <div className="font-bold text-slate-900 mt-0.5 truncate">
                {driver.bankAccountHolderName || 'Not Provided'}
              </div>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs min-w-0">
              <div className="text-[10px] text-slate-400 font-semibold uppercase truncate">Bank IFSC</div>
              <div className="font-mono font-bold text-slate-900 mt-0.5 truncate">
                {driver.bankIfsc || 'Not Provided'}
              </div>
            </div>
          </div>

          {/* Full-width Mobile Verify Bank Button */}
          <button
            onClick={() => handleTogglePayoutStatus(driver.driverId, driver.payoutStatus === 'VERIFIED' ? 'PENDING' : 'VERIFIED')}
            className={`w-full py-2.5 rounded-xl text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 sm:hidden cursor-pointer ${
              driver.payoutStatus === 'VERIFIED'
                ? 'bg-slate-800 hover:bg-slate-700'
                : 'bg-emerald-700 hover:bg-emerald-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{driver.payoutStatus === 'VERIFIED' ? 'Mark Pending' : 'Verify Bank'}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-6 space-y-2.5 sm:space-y-5">
        {/* Page Header: Single aligned row on all devices */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-slate-800" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-base md:text-xl font-bold tracking-tight text-slate-900 truncate">
                <span className="hidden sm:inline">Vehicle & Driver KYC Review</span>
                <span className="sm:hidden">Driver KYC Review</span>
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                <span className="hidden sm:inline">Verify licenses, RC, insurance certificates & vehicle specifications</span>
                <span className="sm:hidden">Verify driver documents</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-2 sm:px-3.5 py-1 sm:py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl shadow-xs flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
              title="Add Driver"
            >
              <span>+</span> <span className="hidden xs:inline sm:inline">Add Driver</span><span className="xs:hidden sm:hidden">Add</span>
            </button>
            <button
              onClick={() => fetchDrivers()}
              className="px-2 sm:px-3.5 py-1 sm:py-2 bg-white hover:bg-slate-50 text-[10px] sm:text-xs font-semibold rounded-lg sm:rounded-xl border border-slate-200/90 flex items-center gap-1 text-slate-700 transition shadow-2xs cursor-pointer whitespace-nowrap"
              title="Refresh"
            >
              <span>⟳</span> <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Pills & Search Bar Row */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2.5 sm:gap-4">
          <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1 md:pb-0 -mx-1 px-1">
            {[
              { id: 'ALL', label: 'All Drivers', count: counts.all },
              { id: 'PENDING', label: 'Pending Review', count: counts.pending, badgeBg: 'bg-amber-100 text-amber-800' },
              { id: 'APPROVED', label: 'Approved', count: counts.approved, badgeBg: 'bg-emerald-100 text-emerald-800' },
              { id: 'REJECTED', label: 'Rejected', count: counts.rejected, badgeBg: 'bg-rose-100 text-rose-800' },
              { id: 'EXPIRING', label: '⚠️ Expiring Soon (≤ 5 Days)', count: counts.expiringSoon || 0, badgeBg: 'bg-orange-100 text-orange-800' },
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs transition active:scale-95 shadow-2xs shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'bg-orange-500 text-white font-bold shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-slate-900/30 text-white' : tab.badgeBg || 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver, phone, vehicle plate..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-2xs transition"
            />
            <span className="absolute left-3 top-2.5 text-slate-400">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
          </div>
        </div>

        {/* Mobile & Tablet Drivers List (< lg) */}
        <div className="lg:hidden space-y-3">
          {loading && drivers.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center text-slate-400 text-sm shadow-xs">
              <div className="inline-block animate-spin text-2xl mb-2 text-slate-400">
                <svg className="w-6 h-6 animate-spin mx-auto text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
              <div>Loading drivers...</div>
            </div>
          ) : displayedDrivers.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center text-slate-400 text-xs shadow-xs">
              No drivers match the selected filter or search.
            </div>
          ) : (
            displayedDrivers.map((d) => {
              const isExpanded = mobileExpandedDriverId === d.driverId;
              const hasPlate = d.vehicle?.plateNumber && d.vehicle.plateNumber !== 'PENDING' && !d.vehicle.plateNumber.startsWith('KA 01 TR 0000');
              const carModelMatch = d.adminNotes?.match(/\[Car Model:\s*([^\]]+)\]/);
              const carModelName = carModelMatch ? carModelMatch[1].trim() : (d.vehicle?.model || null);
              const vehicleCategory = d.vehicle?.category || 'SEDAN';
              const carType = carModelName || (vehicleCategory === 'SEDAN' ? 'Sedan' : vehicleCategory === 'HATCHBACK' ? 'Hatchback' : vehicleCategory === 'SUV' ? 'SUV' : vehicleCategory === 'SUV_PREMIUM' ? 'SUV Premium' : 'Cab');

              return (
                <div
                  key={d.driverId}
                  className={`bg-white border rounded-2xl p-3 sm:p-4 shadow-xs transition ${
                    isExpanded ? 'border-amber-300 ring-1 ring-amber-300/50' : 'border-slate-200/90'
                  }`}
                >
                  {/* Summary row matching Image 2 with contents in clean horizontal rows and no blank spaces */}
                  <div
                    onClick={() => {
                      setMobileExpandedDriverId(isExpanded ? null : d.driverId);
                      setSelectedDriverId(d.driverId);
                    }}
                    className="cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full bg-slate-100 border-2 flex-shrink-0 overflow-hidden flex items-center justify-center shadow-xs ${
                        d.verificationStatus === 'APPROVED' ? 'border-emerald-400' :
                        d.verificationStatus === 'REJECTED' ? 'border-rose-400' : 'border-amber-400'
                      }`}>
                        {d.profilePhotoUrl ? (
                          <img src={d.profilePhotoUrl} alt={d.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* Line 1: Driver Name (left) & Status Badge (right) */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-slate-900 text-sm sm:text-base truncate">
                            {d.fullName}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {d.hasExpiringDocs && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 border border-orange-300 rounded-full text-[11px] font-bold whitespace-nowrap shadow-2xs">
                                <span>⚠️</span>
                                <span>{d.expiringDocuments.length} Expiring (≤ 5d)</span>
                              </span>
                            )}
                            {d.verificationStatus === 'APPROVED' ? (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs">
                              <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Approved Driver
                            </span>
                          ) : d.verificationStatus === 'REJECTED' ? (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs">
                              <svg className="w-3.5 h-3.5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                              Rejected Driver
                            </span>
                          ) : (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Pending Review
                            </span>
                          )}
                        </div>

                        {/* Line 2: Phone (left) & Registration (right) */}
                        <div className="text-xs text-slate-600 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 text-slate-500 whitespace-nowrap truncate">
                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            <span>{d.phone}</span>
                          </span>
                          <span className="flex items-center gap-1 font-medium text-slate-700 whitespace-nowrap shrink-0">
                            <span>Reg: {hasPlate ? d.vehicle.plateNumber : 'KA 19 2025'}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Below Profile Image: Car Type & Vehicle Category on left, View Details on right (no line separator) */}
                    <div className="pt-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium whitespace-nowrap shrink-0">
                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                        </svg>
                        <span className="font-semibold text-slate-900 whitespace-nowrap">{carType}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200/90 whitespace-nowrap shrink-0 shadow-2xs">
                          {vehicleCategory}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileExpandedDriverId(isExpanded ? null : d.driverId);
                          setSelectedDriverId(d.driverId);
                        }}
                        className={`py-0.5 px-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap ${
                          isExpanded
                            ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                            : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50/60'
                        }`}
                      >
                        <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                        <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Inspector Section */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                      {renderDriverInspector(d, true)}
                      <div className="pt-2 flex justify-center border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setMobileExpandedDriverId(null)}
                          className="w-full py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="18 15 12 9 6 15" />
                          </svg>
                          Hide Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
          )}
        </div>

        {/* Master-Detail Layout */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Registered Drivers List (Desktop) */}
          <div className="hidden lg:flex lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl overflow-hidden flex-col h-[750px] relative shadow-xs">
            {loading && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 overflow-hidden z-10">
                <div className="h-full bg-orange-500 animate-pulse w-full" />
              </div>
            )}
            <div className="px-4 py-3 bg-white border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
              <span>REGISTERED DRIVERS ({displayedDrivers.length})</span>
            </div>

            <div className={`flex-1 overflow-y-auto p-3 space-y-2.5 transition-opacity ${loading && drivers.length > 0 ? 'opacity-80' : 'opacity-100'}`}>
              {loading && drivers.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-sm">
                  <div className="inline-block animate-spin text-2xl mb-2 text-slate-400">
                    <svg className="w-6 h-6 animate-spin mx-auto text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  </div>
                  <div>Loading drivers...</div>
                </div>
              ) : displayedDrivers.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No drivers match the selected filter or search.
                </div>
              ) : (
                displayedDrivers.map((d) => {
                  const isSelected = selectedDriver?.driverId === d.driverId;
                  const hasPlate = d.vehicle?.plateNumber && d.vehicle.plateNumber !== 'PENDING' && !d.vehicle.plateNumber.startsWith('KA 01 TR 0000');
                  const carModelMatch = d.adminNotes?.match(/\[Car Model:\s*([^\]]+)\]/);
                  const carModelName = carModelMatch ? carModelMatch[1].trim() : (d.vehicle?.model || null);
                  const vehicleCategory = d.vehicle?.category || 'SEDAN';
                  const carType = carModelName || (vehicleCategory === 'SEDAN' ? 'Sedan' : vehicleCategory === 'HATCHBACK' ? 'Hatchback' : vehicleCategory === 'SUV' ? 'SUV' : vehicleCategory === 'SUV_PREMIUM' ? 'SUV Premium' : 'Cab');

                  return (
                    <div
                      key={d.driverId}
                      onClick={() => setSelectedDriverId(d.driverId)}
                      className={`p-3 rounded-2xl cursor-pointer transition border ${
                        isSelected
                          ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-300/60 shadow-xs'
                          : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {d.profilePhotoUrl ? (
                            <img src={d.profilePhotoUrl} alt={d.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center gap-1">
                            <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                              <span>{d.fullName}</span>
                              {d.vehiclesList && d.vehiclesList.length > 1 && (
                                <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                                  🚗 {d.vehiclesList.length}
                                </span>
                              )}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border flex-shrink-0 ${
                                d.verificationStatus === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : d.verificationStatus === 'REJECTED'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {d.verificationStatus}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            <span>{d.phone}</span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1 flex items-center justify-between gap-1 font-medium">
                            <span className="flex items-center gap-1 truncate text-slate-700">
                              <svg className="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                              </svg>
                              <span className="truncate">{carType}</span>
                              <span className="text-[10px] uppercase font-bold text-slate-400">({vehicleCategory})</span>
                            </span>
                            <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">{hasPlate ? d.vehicle.plateNumber : 'KA 19 2025'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Evidence Inspector & Action Panel (Desktop) */}
          <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-5 flex flex-col h-[750px] overflow-y-auto shadow-xs space-y-4">
            {selectedDriver ? (
              renderDriverInspector(selectedDriver, false)
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
                <svg className="w-12 h-12 text-slate-300 mb-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                </svg>
                <div className="text-xs font-medium">Select a driver from the left list to review KYC evidence.</div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Lightbox / Document Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-5 space-y-3 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span>{previewDoc.title}</span>
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-600 hover:text-sky-700 font-semibold px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 flex items-center gap-1"
                >
                  <span>Open Tab</span> ↗
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm cursor-pointer transition"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-900/5 rounded-xl p-2 border border-slate-200">
              <img
                src={previewDoc.url}
                alt={previewDoc.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalOpen && selectedDriver && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Reject Driver KYC</span>
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
                <svg className="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span>Edit Driver & Vehicle Specifications</span>
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
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{editDriverError}</span>
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
                      <option value="DIESEL">Diesel</option>
                      <option value="PETROL">Petrol</option>
                      <option value="CNG">CNG</option>
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
                    <option value="None (No Carriage / Luggage Space)">None (No Luggage Space)</option>
                    <option value="2 Large Bags (Standard Boot)">2 Large Bags (Standard Boot)</option>
                    <option value="3 Large Bags (Spacious Boot)">3 Large Bags (Spacious Boot)</option>
                    <option value="4 Large Bags (SUV Boot Space)">4 Large Bags (SUV Boot Space)</option>
                    <option value="5+ Large Bags (Max Cargo)">5+ Large Bags (Max Cargo)</option>
                    <option value="Roof Carrier Included (Heavy Luggage / Hill Trips)">Roof Carrier Included (Heavy Luggage)</option>
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
                      <option value="PENDING">Pending Verification</option>
                      <option value="VERIFIED">Verified</option>
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
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
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

export default function AdminVehicleEvidencePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm">Loading Vehicle & Driver KYC...</div>}>
      <AdminVehicleEvidenceContent />
    </Suspense>
  );
}
