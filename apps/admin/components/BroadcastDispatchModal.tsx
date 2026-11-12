'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { parseIntermediateStops, getBookingMetadata } from '@/lib/bookingHelpers';
import { IconMapPin } from '@/components/Icons';

interface DriverOption {
  id: string;
  onlineStatus: boolean;
  profilePhotoUrl?: string | null;
  verificationStatus?: string;
  licenseNumber?: string | null;
  licenseDocUrl?: string | null;
  rcDocUrl?: string | null;
  insuranceDocUrl?: string | null;
  panDocUrl?: string | null;
  aadhaarDocUrl?: string | null;
  user: { fullName: string; phone: string };
  vehicles: { category: string; plateNumber: string }[];
  currentLat?: number | null;
  currentLng?: number | null;
  assignedBookings?: any[];
}

interface BroadcastDispatchModalProps {
  bookingId: string;
  bookingRef: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BroadcastDispatchModal({
  bookingId,
  bookingRef,
  isOpen,
  onClose,
  onSuccess,
}: BroadcastDispatchModalProps) {
  const [onlineDrivers, setOnlineDrivers] = useState<DriverOption[]>([]);
  const [bookingData, setBookingData] = useState<any | null>(null);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [kycWarningDrivers, setKycWarningDrivers] = useState<DriverOption[] | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError('');
      setSelectedDriverIds([]);
      setSearchQuery('');
      setStatusFilter('ALL');
      setKycWarningDrivers(null);
      setBookingData(null);

      fetch(`/api/admin/bookings/${bookingId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.booking) setBookingData(data.booking);
        })
        .catch(() => {});

      fetch('/api/admin/drivers/online')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.drivers)) {
            setOnlineDrivers(data.drivers);
          }
        })
        .catch(() => {
          setError('Failed to fetch drivers');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, bookingId]);

  // Check if driver KYC is incomplete (unapproved status or missing key documents)
  const isDriverKycIncomplete = (driver: DriverOption) => {
    // 1. If verification status is explicitly not APPROVED
    if (!driver.verificationStatus || driver.verificationStatus !== 'APPROVED') {
      return true;
    }
    // 2. If any of the mandatory KYC documents are missing / empty / placeholder
    const isDocEmpty = (url?: string | null) => !url || url.trim() === '' || url.includes('placehold.co');
    if (
      isDocEmpty(driver.profilePhotoUrl) ||
      isDocEmpty(driver.licenseDocUrl) ||
      isDocEmpty(driver.rcDocUrl) ||
      isDocEmpty(driver.insuranceDocUrl) ||
      !driver.licenseNumber ||
      driver.licenseNumber.trim() === ''
    ) {
      return true;
    }
    // 3. If vehicle is missing or vehicle plate is missing
    if (!driver.vehicles || driver.vehicles.length === 0 || !driver.vehicles[0]?.plateNumber) {
      return true;
    }
    return false;
  };

  // Filtered drivers based on search query and status filter
  const filteredDrivers = useMemo(() => {
    return onlineDrivers.filter((driver) => {
      // Status filter
      if (statusFilter === 'ONLINE' && !driver.onlineStatus) return false;
      if (statusFilter === 'OFFLINE' && driver.onlineStatus) return false;

      // Search query matching
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = driver.user.fullName?.toLowerCase().includes(q);
      const phoneMatch = driver.user.phone?.toLowerCase().includes(q);
      const plateMatch = driver.vehicles?.some((v) => v.plateNumber?.toLowerCase().includes(q));
      const catMatch = driver.vehicles?.some((v) => v.category?.toLowerCase().includes(q));
      return nameMatch || phoneMatch || plateMatch || catMatch;
    });
  }, [onlineDrivers, statusFilter, searchQuery]);

  if (!isOpen) return null;

  const toggleDriver = (id: string) => {
    setSelectedDriverIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredDrivers.map((d) => d.id);
    const allFilteredSelected = filteredIds.every((id) => selectedDriverIds.includes(id));

    if (allFilteredSelected) {
      setSelectedDriverIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedDriverIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleInitialDispatch = () => {
    if (selectedDriverIds.length === 0) {
      setError('Please select at least one driver');
      return;
    }

    // Identify selected drivers with incomplete KYC
    const incompleteDrivers = selectedDriverIds
      .map((id) => onlineDrivers.find((d) => d.id === id))
      .filter((d): d is DriverOption => !!d && isDriverKycIncomplete(d));

    if (incompleteDrivers.length > 0) {
      setKycWarningDrivers(incompleteDrivers);
      return;
    }

    executeDispatch();
  };

  const executeDispatch = async () => {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverIds: selectedDriverIds }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to dispatch booking');
      }

      setKycWarningDrivers(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Dispatch failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onlineCount = onlineDrivers.filter((d) => d.onlineStatus).length;
  const offlineCount = onlineDrivers.length - onlineCount;
  const isAllFilteredSelected =
    filteredDrivers.length > 0 &&
    filteredDrivers.every((d) => selectedDriverIds.includes(d.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl animate-fade-in flex flex-col max-h-[90vh] overflow-hidden">
        {/* KYC Warning Confirmation Overlay */}
        {kycWarningDrivers && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/60 p-5 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-amber-300 animate-scale-up">
              <div className="flex items-center gap-3 mb-3.5">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">KYC Verification Incomplete</h4>
                  <p className="text-[11px] text-slate-500">Dispatch Verification Alert</p>
                </div>
              </div>

              <div className="my-3 rounded-xl bg-amber-50/90 border border-amber-200 p-4">
                <p className="text-xs text-amber-950 font-medium leading-relaxed">
                  {kycWarningDrivers.length === 1 ? (
                    <>
                      <span className="font-bold text-amber-950 text-sm">
                        {kycWarningDrivers[0].user.fullName}
                      </span>{' '}
                      KYC is not complete. Would you like to broadcast dispatch?
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-amber-950">
                        {kycWarningDrivers.map((d) => d.user.fullName).join(', ')}
                      </span>{' '}
                      KYC is not complete. Would you like to broadcast dispatch?
                    </>
                  )}
                </p>

                <div className="mt-3 pt-2.5 border-t border-amber-200/80 space-y-1.5 max-h-32 overflow-y-auto">
                  {kycWarningDrivers.map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-xs text-amber-900">
                      <span className="font-semibold truncate mr-2">• {d.user.fullName} ({d.user.phone})</span>
                      <span className="bg-amber-200 text-amber-900 text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0">
                        {d.verificationStatus === 'PENDING' ? 'Pending Review' : 'KYC Incomplete'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-5 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setKycWarningDrivers(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={executeDispatch}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-md shadow-amber-600/20 flex items-center gap-1.5"
                >
                  {submitting ? 'Broadcasting...' : 'Yes, Broadcast Dispatch'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal Header */}
        <div className="pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Broadcast Ride Dispatch
              </h3>
              <p className="text-xs text-slate-500">
                Booking Ref: <span className="font-semibold text-slate-800">{bookingRef}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-lg font-semibold w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition"
            >
              ✕
            </button>
          </div>

          {/* Route Summary with Multi-Drop support */}
          {bookingData && (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Trip Route ({bookingData.tripType || 'ONEWAY'})
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {getBookingMetadata(bookingData).hasCarrier && (
                    <span className="text-[10px] text-emerald-900 font-extrabold bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>Roof Carrier Requested</span>
                    </span>
                  )}
                  {getBookingMetadata(bookingData).hasPet && (
                    <span className="text-[10px] text-amber-900 font-extrabold bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>Pet Friendly (+₹{getBookingMetadata(bookingData).petFee || 500})</span>
                    </span>
                  )}
                  {getBookingMetadata(bookingData).isSeniorCitizen && (
                    <span className="text-[10px] text-orange-900 font-extrabold bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>Senior Citizen</span>
                    </span>
                  )}
                  {getBookingMetadata(bookingData).isBabyOnBoard && (
                    <span className="text-[10px] text-pink-900 font-extrabold bg-pink-100 border border-pink-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>Baby on Board</span>
                    </span>
                  )}
                  {getBookingMetadata(bookingData).isPregnancyFriendly && (
                    <span className="text-[10px] text-purple-900 font-extrabold bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>Pregnancy Friendly</span>
                    </span>
                  )}
                  {getBookingMetadata(bookingData).isAccessibilityAssistance && (
                    <span className="text-[10px] text-blue-900 font-extrabold bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>Accessibility Assistance</span>
                    </span>
                  )}
                  {getBookingMetadata(bookingData).needReturnJourney && (
                    <span className="text-[10px] text-indigo-900 font-extrabold bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>Return Journey Later</span>
                    </span>
                  )}
                  {getBookingMetadata(bookingData).needAirportDrop && (
                    <span className="text-[10px] text-sky-900 font-extrabold bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>Airport Drop</span>
                    </span>
                  )}
                  {getBookingMetadata(bookingData).needAirportPickup && (
                    <span className="text-[10px] text-teal-900 font-extrabold bg-teal-100 border border-teal-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>Airport Pickup</span>
                    </span>
                  )}
                  <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                    ~{bookingData.distanceKm} km
                  </span>
                </div>
              </div>

              <div className="text-slate-800 font-medium space-y-1">
                <div className="flex items-center gap-1.5 truncate">
                  <IconMapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{bookingData.pickupAddress}</span>
                </div>

                {/* Intermediate Stops */}
                {parseIntermediateStops(bookingData).length > 0 && (
                  <div className="pl-3.5 border-l-2 border-amber-300 ml-1.5 space-y-0.5 py-0.5">
                    {parseIntermediateStops(bookingData).map((stop, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-amber-950 text-[11px]">
                        <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded font-extrabold shrink-0">
                          Stop {i + 1}
                        </span>
                        <span className="truncate font-semibold">{stop}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5 truncate text-slate-600">
                  <IconMapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="truncate">{bookingData.dropAddress}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="my-3 rounded-lg bg-red-50 p-3 text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Search Input & Status Filter Controls */}
        <div className="py-3 space-y-2.5">
          {/* Live Search Box */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search driver by name, phone, plate, or vehicle..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills & Select All Row */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({onlineDrivers.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ONLINE')}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition ${
                  statusFilter === 'ONLINE'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                ● Online ({onlineCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('OFFLINE')}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition ${
                  statusFilter === 'OFFLINE'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ○ Offline ({offlineCount})
              </button>
            </div>

            <button
              type="button"
              onClick={selectAllFiltered}
              disabled={filteredDrivers.length === 0}
              className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 disabled:opacity-40"
            >
              {isAllFilteredSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        {/* Drivers List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px] max-h-80">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-1.5" />
              <div>Loading registered drivers...</div>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              {searchQuery ? 'No drivers matching search query.' : 'No drivers found.'}
            </div>
          ) : (
            filteredDrivers.map((driver) => {
              const isSelected = selectedDriverIds.includes(driver.id);
              const vehicle = driver.vehicles[0];

              const targetScheduledAt = bookingData?.scheduledAt;
              const isSameCalendarDay = (d1?: string | Date | null, d2?: string | Date | null) => {
                if (!d1 || !d2) return false;
                const a = new Date(d1);
                const b = new Date(d2);
                if (isNaN(a.getTime()) || isNaN(b.getTime())) return false;
                return (
                  a.getFullYear() === b.getFullYear() &&
                  a.getMonth() === b.getMonth() &&
                  a.getDate() === b.getDate()
                );
              };

              const activeBookingsOnDate = (driver.assignedBookings || []).filter((b: any) => {
                const isLiveTrip = b.status === 'TRIP_STARTED' || b.status === 'IN_PROGRESS';
                if (isLiveTrip) return true;
                if (!targetScheduledAt) {
                  return (
                    b.status === 'DRIVER_ACCEPTED' ||
                    b.status === 'DRIVER_EN_ROUTE' ||
                    b.status === 'ASSIGNED'
                  );
                }
                return (
                  (b.status === 'DRIVER_ACCEPTED' ||
                    b.status === 'DRIVER_EN_ROUTE' ||
                    b.status === 'ASSIGNED') &&
                  isSameCalendarDay(b.scheduledAt, targetScheduledAt)
                );
              });

              const isOnTrip = activeBookingsOnDate.some(
                (b: any) => b.status === 'TRIP_STARTED' || b.status === 'IN_PROGRESS'
              );
              const isAssigned = !isOnTrip && activeBookingsOnDate.length > 0;

              return (
                <div
                  key={driver.id}
                  onClick={() => toggleDriver(driver.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {driver.profilePhotoUrl ? (
                        <img
                          src={driver.profilePhotoUrl}
                          alt={driver.user.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {driver.user.fullName}
                        </span>
                        {isOnTrip ? (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                            On Trip
                          </span>
                        ) : isAssigned ? (
                          <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">
                            Assigned
                          </span>
                        ) : driver.onlineStatus ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                            ● Online
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                            ○ Offline
                          </span>
                        )}
                        {isDriverKycIncomplete(driver) && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                            {driver.verificationStatus === 'PENDING' ? 'Pending Review' : 'KYC Incomplete'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {driver.user.phone} •{' '}
                        {vehicle
                          ? `${vehicle.category} (${vehicle.plateNumber || 'No Plate'})`
                          : 'No Vehicle Assigned'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
          <div className="text-xs text-slate-500">
            Selected: <span className="font-bold text-slate-800">{selectedDriverIds.length}</span> / {onlineDrivers.length}
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || selectedDriverIds.length === 0}
              onClick={handleInitialDispatch}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50 shadow-md shadow-indigo-500/20"
            >
              {submitting
                ? 'Broadcasting...'
                : `Broadcast to ${selectedDriverIds.length} Driver(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
