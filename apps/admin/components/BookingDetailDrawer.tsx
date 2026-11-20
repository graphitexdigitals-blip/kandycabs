'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BookingStatus, PaymentStatus, calculateTripChauffeurAllowance } from '@kandy-cabs/shared';
import { reverseGeocodeLocation } from '@/lib/geocoding';
import {
  parseIntermediateStops,
  getBookingMetadata,
  getTripVerificationPhotos,
  getTripTimingMilestones,
  formatPickupDateTime,
  isBookingMissed,
} from '@/lib/bookingHelpers';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import {
  IconX,
  IconMap,
  IconPinPickup,
  IconBuilding,
  IconUsers,
  IconPackage,
  IconPaw,
  IconPlane,
  IconMail,
  IconRadio,
  IconKey,
  IconImage,
  IconCash,
  IconPayments,
  IconAlert,
  IconCar,
  IconCalendar,
  IconMapPin,
  IconClock,
} from '@/components/Icons';

interface BookingDetailDrawerProps {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDispatch: (bookingId: string, bookingRef: string) => void;
  onOpenOtpOverride: (bookingId: string, bookingRef: string) => void;
  onRefresh: () => void;
}

export function BookingDetailDrawer({
  bookingId,
  isOpen,
  onClose,
  onOpenDispatch,
  onOpenOtpOverride,
  onRefresh,
}: BookingDetailDrawerProps) {
  const [data, setData] = useState<any>(null);
  const [trackingPoints, setTrackingPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingPhone, setTogglingPhone] = useState(false);
  const [isPhoneReleased, setIsPhoneReleased] = useState<boolean>(false);
  const [driverLocationName, setDriverLocationName] = useState<string>('');
  const [driverAllowanceVal, setDriverAllowanceVal] = useState<string>('300');
  const [driverPayeeVal, setDriverPayeeVal] = useState<string>('4850');
  const [driverPayStatus, setDriverPayStatus] = useState<string>('PENDING');
  const [kmRateVal, setKmRateVal] = useState<string>('13');
  const [extraKmRateVal, setExtraKmRateVal] = useState<string>('13');
  const [vehicleLabelVal, setVehicleLabelVal] = useState<string>('Sedan - Toyota Etios');
  const [copiedVendorText, setCopiedVendorText] = useState<boolean>(false);
  const [savingDriverPay, setSavingDriverPay] = useState<boolean>(false);
  const [approvingFleet, setApprovingFleet] = useState<boolean>(false);
  const [cancellingBooking, setCancellingBooking] = useState<boolean>(false);
  const [acceptingCancellation, setAcceptingCancellation] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [togglingPayLater, setTogglingPayLater] = useState<boolean>(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState<boolean>(false);
  const [recordPaymentMethod, setRecordPaymentMethod] = useState<'UPI_QR' | 'CASH' | 'NET_BANKING'>('UPI_QR');
  const [recordPaymentTxnRef, setRecordPaymentTxnRef] = useState<string>('');
  const [recordPaymentNotes, setRecordPaymentNotes] = useState<string>('');
  const [recordingPayment, setRecordingPayment] = useState<boolean>(false);
  const [showDrawerRefundModal, setShowDrawerRefundModal] = useState<boolean>(false);
  const [drawerRefundAmount, setDrawerRefundAmount] = useState<string>('');
  const [drawerRefundMethod, setDrawerRefundMethod] = useState<string>('UPI');
  const [drawerRefundTxnRef, setDrawerRefundTxnRef] = useState<string>('');
  const [drawerRefundNotes, setDrawerRefundNotes] = useState<string>('');
  const [processingDrawerRefund, setProcessingDrawerRefund] = useState<boolean>(false);
  const [waivingDrawerFee, setWaivingDrawerFee] = useState<boolean>(false);
  const isTogglingPhoneRef = useRef<boolean>(false);
  const lastPhoneToggledAtRef = useRef<number>(0);

  const handleAcceptDriverCancellation = async (bId: string) => {
    if (!confirm('Are you sure you want to accept this driver cancellation request? The driver will be unassigned and the ride will become available for re-dispatch.')) return;
    setAcceptingCancellation(true);
    try {
      const res = await fetch(`/api/admin/bookings/${bId}/accept-cancellation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        alert(resData.message || 'Driver cancellation accepted successfully.');
        fetchDetail(bId);
        onRefresh();
      } else {
        alert(resData.message || 'Failed to accept driver cancellation');
      }
    } catch (err: any) {
      alert('Error accepting cancellation: ' + (err.message || 'Network error'));
    } finally {
      setAcceptingCancellation(false);
    }
  };

  const fetchDetail = async (id: string) => {
    setLoading(true);
    try {
      const [resDetail, resTrack] = await Promise.all([
        fetch(`/api/admin/bookings/${id}?_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/admin/bookings/${id}/tracking?_t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      if (resDetail.ok) {
        const json = await resDetail.json();
        setData(json);
        const b = json.booking;
        if (b) {
          setIsPhoneReleased(Boolean(b.customerPhoneReleased));
          let bata = 0;
          if (b.driverAllowance !== undefined && b.driverAllowance !== null && !isNaN(Number(b.driverAllowance))) {
            bata = Number(b.driverAllowance);
          } else {
            const policy = calculateTripChauffeurAllowance({
              tripType: b.tripType,
              category: b.vehicle?.category || 'SEDAN',
              scheduledAt: b.scheduledAt,
              durationDays: b.durationDays || 1,
            });
            bata = policy.totalAllowance;
          }
          setDriverAllowanceVal(String(bata));

          // Automatically calculate vendor cost based on distance if not explicitly set
          const distance = Number(b.distanceKm) || 0;
          const autoComputed = Math.round(distance * 13 + bata);
          const savedVendor = Number(b.driverPayeeAmount || 0);
          const initialVendor = savedVendor > 0 ? savedVendor : autoComputed;

          setDriverPayeeVal(String(initialVendor));
          setDriverPayStatus(b.driverPaymentStatus || 'PENDING');
          const vCat = b.vehicle?.category || 'Sedan';
          const vModel = b.vehicle?.plateNumber ? `Toyota Etios (${b.vehicle.plateNumber})` : 'Toyota Etios';
          setVehicleLabelVal(`${vCat} - ${vModel}`);
        }
        const drv = json.booking?.assignedDriver;
        if (drv?.currentLat && drv?.currentLng) {
          reverseGeocodeLocation(drv.currentLat, drv.currentLng).then(setDriverLocationName);
        }
      }
      if (resTrack.ok) {
        const jsonTrack = await resTrack.json();
        setTrackingPoints(jsonTrack.points || []);
      }
    } catch (err) {
      console.error('Failed to load booking details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDriverPayment = async () => {
    if (!booking) return;
    setSavingDriverPay(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverAllowance: parseFloat(driverAllowanceVal) || 0,
          driverPayeeAmount: parseFloat(driverPayeeVal) || 0,
          driverPaymentStatus: driverPayStatus,
        }),
      });
      if (res.ok) {
        await fetchDetail(booking.id);
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to update driver payment details:', err);
    } finally {
      setSavingDriverPay(false);
    }
  };

  const buildVendorTripDetails = () => {
    if (!booking) return '';
    const rawVal = booking.scheduledAt || booking.createdAt;
    let cleanStr = typeof rawVal === 'string' ? rawVal : (rawVal ? new Date(rawVal).toISOString() : new Date().toISOString());
    cleanStr = cleanStr.replace(/^00(\d{2})/, (_, yy) => `20${yy}`);
    cleanStr = cleanStr.replace(/^(\d{1,3})-/, (_, y) => `${String(Number(y) < 100 ? 2000 + Number(y) : Number(y)).padStart(4, '0')}-`);
    const d = new Date(cleanStr);
    if (d.getFullYear() < 100) d.setFullYear(2000 + d.getFullYear());

    const getOrdinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    const dayOrdinal = getOrdinal(d.getDate());
    const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
    const weekdayShort = d.toLocaleDateString('en-US', { weekday: 'short' });
    const year = d.getFullYear();
    const pickupDateFormatted = `${dayOrdinal} ${monthShort}, ${weekdayShort} ${year}`;

    // Pickup time
    const minutes = d.getMinutes();
    const hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const pickupTimeFormatted = minutes === 0 ? `${displayHours} ${ampm}` : `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;

    // Reporting time: 15 mins before
    const repDate = new Date(d.getTime() - 15 * 60 * 1000);
    const repMinutes = repDate.getMinutes();
    const repHours = repDate.getHours();
    const repAmpm = repHours >= 12 ? 'PM' : 'AM';
    const repDisplayHours = repHours % 12 || 12;
    const reportingTimeFormatted = repMinutes === 0 ? `${repDisplayHours} ${repAmpm}` : `${repDisplayHours}:${repMinutes.toString().padStart(2, '0')} ${repAmpm}`;

    const pickupCity = booking.pickupAddress?.split(',')[0]?.trim() || 'Mangaluru';
    const dropCity = booking.dropAddress?.split(',')[0]?.trim() || 'Bengaluru';
    const tripTypeWord = booking.tripType === 'ROUND_TRIP' ? 'round trip' : 'one way';
    const distanceKm = Math.round(Number(booking.distanceKm) || 0);
    const kmRate = parseFloat(kmRateVal) || 13;
    const extraRate = parseFloat(extraKmRateVal) || 13;
    const driverBata = Math.round(parseFloat(driverAllowanceVal) || 300);
    const parsedVendor = parseFloat(driverPayeeVal);
    const vendorCost = !isNaN(parsedVendor) && parsedVendor > 0
      ? Math.round(parsedVendor)
      : Math.round(distanceKm * kmRate + driverBata);

    return `TRIP DETAILS 

${pickupCity} to ${dropCity} ${tripTypeWord} drop 
Km limit: ${distanceKm} Kms
Pick-up date: ${pickupDateFormatted} 
Pick-up time: ${pickupTimeFormatted} 
Reporting time: ${reportingTimeFormatted}

Vehicle Type: ${vehicleLabelVal || 'Sedan - Toyota Etios'}

VENDOR COST ₹${vendorCost} 

Inclusions:
- Km Price: ₹${kmRate}/ Km
- Driver Bata: ₹${driverBata}

Exclusions (If applicable):
- Km Price: ₹${extraRate}/Km after ${distanceKm} Kms
- Toll
- Parking`;
  };

  const handleCopyVendorTripDetails = async () => {
    const text = buildVendorTripDetails();
    if (!text) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedVendorText(true);
      setTimeout(() => setCopiedVendorText(false), 2500);
    } catch (e) {
      console.error('Failed to copy vendor text:', e);
    }
  };

  const handleWhatsAppVendor = () => {
    const text = buildVendorTripDetails();
    if (!text) return;
    const rawPhone = assignedDriver?.user?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phoneParam = cleanPhone.length >= 10 ? (cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone.slice(-10)}`) : '';
    const url = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleApproveFleet = async () => {
    if (!booking) return;
    if (!window.confirm(`Approve fleet availability for booking ${booking.humanReadableRef}? Customer will be notified to pay their advance.`)) {
      return;
    }
    setApprovingFleet(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/approve-fleet`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Fleet availability approved successfully!');
        fetchDetail(booking.id);
        onRefresh();
      } else {
        alert(data.message || 'Failed to approve fleet availability');
      }
    } catch (e: any) {
      alert(e.message || 'Network error');
    } finally {
      setApprovingFleet(false);
    }
  };

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchDetail(bookingId);
      // Auto refresh location every 5s if active (lightweight query only)
      const interval = setInterval(() => {
        fetch(`/api/admin/bookings/${bookingId}/tracking?_t=${Date.now()}`, { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => setTrackingPoints(d.points || []))
          .catch(() => {});
      }, 5000);
      return () => clearInterval(interval);
    } else {
      setData(null);
      setTrackingPoints([]);
    }
  }, [isOpen, bookingId]);

  const booking = data?.booking;
  const chauffeurCalc = useMemo(() => {
    if (!booking) return null;
    return calculateTripChauffeurAllowance({
      tripType: booking.tripType,
      category: booking.vehicle?.category || 'SEDAN',
      scheduledAt: booking.scheduledAt,
      durationDays: booking.durationDays || 1,
    });
  }, [booking]);

  const isPayLater = useMemo(() => {
    if (!booking) return false;
    if (booking.isPayLater || booking.customerPaysLater) return true;
    if (Array.isArray(booking.tripEvents)) {
      const payLaterEvent = booking.tripEvents.find(
        (e: any) => e.type === 'CUSTOMER_PAY_LATER' || e.type === 'CUSTOMER_PAY_LATER_REVERTED'
      );
      if (payLaterEvent) {
        return payLaterEvent.type === 'CUSTOMER_PAY_LATER';
      }
    }
    return false;
  }, [booking]);

  if (!isOpen || !bookingId) return null;

  const auditLogs = data?.auditLogs || [];
  const assignedDriver = booking?.assignedDriver;
  const bookingMeta = getBookingMetadata(booking);
  const verificationData = getTripVerificationPhotos(booking);
  const timingData = getTripTimingMilestones(booking);
  const pickupTiming = formatPickupDateTime(booking?.scheduledAt || booking?.createdAt);
  const bookedTiming = formatPickupDateTime(booking?.createdAt);

  const cancelEvent = booking?.tripEvents?.find((e: any) => e.type === 'BOOKING_CANCELLED');
  const cancelEventData = cancelEvent?.payloadJson
    ? (typeof cancelEvent.payloadJson === 'string' ? JSON.parse(cancelEvent.payloadJson) : cancelEvent.payloadJson)
    : null;

  const refundEvent = booking?.tripEvents?.find((e: any) => e.type === 'CANCELLATION_REFUND_PROCESSED');
  const refundEventData = refundEvent?.payloadJson
    ? (typeof refundEvent.payloadJson === 'string' ? JSON.parse(refundEvent.payloadJson) : refundEvent.payloadJson)
    : null;

  const feeWaivedEvent = booking?.tripEvents?.find((e: any) => e.type === 'CANCELLATION_FEE_WAIVED');
  const isFeeWaived = Boolean(cancelEventData?.waiveCharge || feeWaivedEvent);
  const cancellationCharge = isFeeWaived ? 0 : Number(cancelEventData?.cancellationCharge ?? 0);
  const advancePaid = Number(cancelEventData?.advancePaid ?? booking?.advanceAmount ?? 0);
  const refundDue = Math.max(0, isFeeWaived ? advancePaid : (cancelEventData?.refundAmount != null ? Number(cancelEventData.refundAmount) : advancePaid - cancellationCharge));
  const isRefundDone = Boolean(refundEventData || booking?.advancePaymentStatus === 'REFUNDED');

  const handleDrawerWaiveFee = async () => {
    if (!booking || waivingDrawerFee) return;
    if (!window.confirm(`Waive the cancellation charge for booking ${booking.humanReadableRef}?\n\nThis will remove the ₹${cancellationCharge} fee and allow a 100% full advance refund of ₹${advancePaid} to the customer.`)) {
      return;
    }
    setWaivingDrawerFee(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'WAIVE_CANCELLATION_FEE' }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Cancellation fee waived successfully!');
        fetchDetail(booking.id);
        onRefresh();
      } else {
        alert(data.message || 'Failed to waive fee');
      }
    } catch (e: any) {
      alert(e.message || 'Error waiving cancellation fee');
    } finally {
      setWaivingDrawerFee(false);
    }
  };

  const handleOpenDrawerRefundModal = () => {
    setDrawerRefundAmount(String(refundDue));
    setDrawerRefundMethod('UPI');
    setDrawerRefundTxnRef('');
    setDrawerRefundNotes('');
    setShowDrawerRefundModal(true);
  };

  const handleDrawerProcessRefund = async () => {
    if (!booking || processingDrawerRefund) return;
    const numAmt = parseFloat(drawerRefundAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      alert('Please enter a valid refund amount');
      return;
    }
    setProcessingDrawerRefund(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RECORD_REFUND',
          refundAmount: numAmt,
          refundMethod: drawerRefundMethod,
          refundTxnRef: drawerRefundTxnRef.trim(),
          notes: drawerRefundNotes.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Customer refund recorded successfully!');
        setShowDrawerRefundModal(false);
        fetchDetail(booking.id);
        onRefresh();
      } else {
        alert(data.message || 'Failed to record refund');
      }
    } catch (e: any) {
      alert(e.message || 'Error processing refund');
    } finally {
      setProcessingDrawerRefund(false);
    }
  };

  const handleAdminCancelBooking = async () => {
    if (!booking || cancellingBooking) return;
    const reason = window.prompt(
      `Cancel booking ${booking.humanReadableRef}?\n\nEnter cancellation reason:`,
      'Cancelled by Admin Operations'
    );
    if (!reason || !reason.trim()) return;

    const applyFee = window.confirm(
      `Apply cancellation charge policy?\n\n- Click OK to apply normal cancellation fee according to policy (Free if >3h, ₹500/₹1000 if within 3h).\n- Click CANCEL to WAIVE the cancellation charge (₹0).`
    );

    setCancellingBooking(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason.trim(),
          waiveCharge: !applyFee,
        }),
      });
      const resData = await res.json();
      if (resData.success) {
        alert(`Booking Cancelled.\nCancellation Charge: ₹${resData.cancellationCharge}\nRefund: ₹${resData.refundAmount}`);
        fetchDetail(booking.id);
        onRefresh();
      } else {
        alert(resData.message || 'Failed to cancel booking');
      }
    } catch (e: any) {
      alert(e.message || 'Error cancelling booking');
    } finally {
      setCancellingBooking(false);
    }
  };

  const handleTogglePhoneRelease = async () => {
    if (!booking || togglingPhone) return;
    const targetState = !isPhoneReleased;

    // Instant optimistic UI update (0ms response)
    setIsPhoneReleased(targetState);
    setData((prev: any) =>
      prev
        ? {
            ...prev,
            booking: {
              ...prev.booking,
              customerPhoneReleased: targetState,
            },
          }
        : prev
    );

    setTogglingPhone(true);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/release-phone`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ released: targetState }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const serverState = json && typeof json.customerPhoneReleased === 'boolean'
          ? json.customerPhoneReleased
          : targetState;

        setIsPhoneReleased(serverState);
        setData((prev: any) =>
          prev
            ? {
                ...prev,
                booking: {
                  ...prev.booking,
                  customerPhoneReleased: serverState,
                },
              }
            : prev
        );
        onRefresh();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.message || 'Failed to update customer phone release');
        // Rollback if failed
        setIsPhoneReleased(!targetState);
        setData((prev: any) =>
          prev
            ? {
                ...prev,
                booking: {
                  ...prev.booking,
                  customerPhoneReleased: !targetState,
                },
              }
            : prev
        );
      }
    } catch (err: any) {
      console.error('Failed to toggle phone release:', err);
      alert(err?.message || 'Network error while updating phone release');
      // Rollback on network error
      setIsPhoneReleased(!targetState);
      setData((prev: any) =>
        prev
          ? {
              ...prev,
              booking: {
                ...prev.booking,
                customerPhoneReleased: !targetState,
              },
            }
          : prev
      );
    } finally {
      setTogglingPhone(false);
    }
  };

  const handleTogglePayLater = async () => {
    if (!booking || togglingPayLater) return;
    const targetState = !isPayLater;
    const confirmMsg = targetState
      ? `Allow Customer Pay Later for booking ${booking.humanReadableRef}?\n\n- The remaining payment amount on the driver app will immediately update to ₹0.\n- Driver will not collect any cash or QR payment from passenger.\n- Admin will collect the remaining payment later.\n- Trip will be tracked in Payments & Ledger.`
      : `Revert Pay Later for booking ${booking.humanReadableRef}?\n\n- Driver will be required to collect the remaining payment (₹${booking.balanceAmount}).`;

    if (!window.confirm(confirmMsg)) return;

    setTogglingPayLater(true);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          action: 'SET_PAY_LATER',
          customerPaysLater: targetState,
          notes: targetState ? 'Admin authorized customer to pay balance later' : 'Admin reverted Pay Later status',
        }),
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        await fetchDetail(booking.id);
        onRefresh();
      } else {
        alert(resData.error || resData.message || 'Failed to update Pay Later status');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating Pay Later status');
    } finally {
      setTogglingPayLater(false);
    }
  };

  const handleSaveRecordPayment = async () => {
    if (!booking || recordingPayment) return;
    setRecordingPayment(true);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          paymentMethod: recordPaymentMethod,
          transactionRef: recordPaymentTxnRef.trim(),
          amount: booking.balanceAmount,
          notes: recordPaymentNotes.trim() || 'Balance payment collected by Admin',
        }),
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        alert(`Payment of ₹${booking.balanceAmount} successfully recorded! The ledger and payments status have been updated.`);
        setShowRecordPaymentModal(false);
        setRecordPaymentTxnRef('');
        setRecordPaymentNotes('');
        await fetchDetail(booking.id);
        onRefresh();
      } else {
        alert(resData.error || resData.message || 'Failed to record payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error recording balance payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col animate-slide-left">
        {/* Header - z-30 sticky to prevent any child cards from painting over */}
        <div className="sticky top-0 bg-white z-30 border-b border-slate-200 px-3.5 py-2.5 sm:px-5 sm:py-3.5 flex items-center justify-between gap-2 shadow-xs">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-mono tracking-tight shrink-0">
                {booking?.humanReadableRef || 'Loading...'}
              </h2>
              {booking && (
                <span
                  className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${
                    booking.status === BookingStatus.DRIVER_EN_ROUTE ||
                    booking.status === BookingStatus.TRIP_STARTED
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : isBookingMissed(booking)
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                      : booking.status === BookingStatus.DRIVER_ACCEPTED
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {booking.status === BookingStatus.DRIVER_EN_ROUTE ||
                  booking.status === BookingStatus.TRIP_STARTED
                    ? 'ON TRIP'
                    : isBookingMissed(booking)
                    ? 'MISSED TRIP'
                    : String(booking.status).replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-md text-[11px] font-bold shadow-2xs">
                <IconCalendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Pickup: {pickupTiming.dateStr} • {pickupTiming.timeStr}</span>
              </div>
              {booking?.createdAt && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10.5px] font-medium">
                  <span>Booked: {bookedTiming.dateStr} {bookedTiming.timeStr}</span>
                </div>
              )}
              <p className="text-[10px] sm:text-xs text-slate-500 truncate">
                Trip Type: <span className="font-semibold text-slate-700">{booking?.tripType}</span>
                {booking?.distanceKm ? ` • ${booking.distanceKm} km` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition shrink-0"
            aria-label="Close drawer"
            title="Close"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {loading && !data ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading trip information...</div>
        ) : !booking ? (
          <div className="p-8 text-center text-xs text-slate-500">Booking details not available.</div>
        ) : (
          <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 flex-1">
            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap gap-1.5 p-2 sm:p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              {booking.status === BookingStatus.PENDING_ADMIN && (
                <button
                  type="button"
                  onClick={() => onOpenDispatch(booking.id, booking.humanReadableRef)}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs inline-flex items-center gap-1.5"
                >
                  <IconRadio className="w-3.5 h-3.5" />
                  <span>Broadcast Dispatch</span>
                </button>
              )}

              {booking.status === BookingStatus.DISPATCHED && (
                <button
                  type="button"
                  onClick={() => onOpenDispatch(booking.id, booking.humanReadableRef)}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  Re-dispatch Ride
                </button>
              )}

              {(booking.status === BookingStatus.DRIVER_ACCEPTED ||
                booking.status === BookingStatus.DRIVER_EN_ROUTE) && (
                <button
                  type="button"
                  onClick={() => onOpenDispatch(booking.id, booking.humanReadableRef)}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs inline-flex items-center gap-1.5"
                  title="Driver accepted but unable to continue? Re-dispatch to another driver"
                >
                  <IconRadio className="w-3.5 h-3.5" />
                  <span>Re-dispatch Ride</span>
                </button>
              )}

              <button
                type="button"
                disabled={togglingPhone}
                onClick={handleTogglePhoneRelease}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                  isPhoneReleased
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {isPhoneReleased ? 'Phone Released' : 'Release Customer Phone'}
              </button>

              {/* Pay Later Toggle Button - Only when balance remains to be paid */}
              {booking.status !== BookingStatus.CANCELLED &&
                booking.status !== 'CANCELLED' &&
                Number(booking.balanceAmount || 0) > 0 &&
                booking.balancePaymentStatus !== 'PAID' &&
                booking.balancePaymentStatus !== PaymentStatus.PAID &&
                !(Number(booking.advanceAmount || 0) >= Number(booking.estimatedFare || 0) && (booking.advancePaymentStatus === 'PAID' || booking.advancePaymentStatus === PaymentStatus.PAID)) && (
                <button
                  type="button"
                  disabled={togglingPayLater}
                  onClick={handleTogglePayLater}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition inline-flex items-center gap-1.5 ${
                    isPayLater
                      ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-xs'
                  }`}
                  title={isPayLater ? 'Pay Later approved: Driver collects ₹0. Click to revert.' : 'Authorize customer to pay balance later directly to Admin'}
                >
                  <span className={`w-2 h-2 rounded-full ${isPayLater ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`} />
                  <span>{togglingPayLater ? 'Updating...' : isPayLater ? 'Pay Later Approved (₹0 to Driver)' : 'Allow Pay Later'}</span>
                </button>
              )}

              {booking.status !== BookingStatus.TRIP_STARTED &&
                booking.status !== BookingStatus.TRIP_COMPLETED &&
                booking.status !== BookingStatus.CANCELLED && (
                  <button
                    type="button"
                    onClick={() => onOpenOtpOverride(booking.id, booking.humanReadableRef)}
                    className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-xs inline-flex items-center gap-1.5"
                  >
                    <IconKey className="w-3.5 h-3.5" />
                    <span>OTP Override</span>
                  </button>
                )}

              {booking.status !== BookingStatus.TRIP_STARTED &&
                booking.status !== BookingStatus.TRIP_COMPLETED &&
                booking.status !== BookingStatus.CANCELLED && (
                  <button
                    type="button"
                    disabled={cancellingBooking}
                    onClick={handleAdminCancelBooking}
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                  >
                    {cancellingBooking ? 'Cancelling...' : 'Cancel Booking'}
                  </button>
                )}

              {booking.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVAL_REQUESTED' || e.payloadJson?.requiresFleetApproval) &&
                !booking.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED') && (
                  <button
                    type="button"
                    disabled={approvingFleet}
                    onClick={handleApproveFleet}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                  >
                    {approvingFleet ? 'Approving...' : 'Approve Fleet'}
                  </button>
                )}
            </div>

            {/* Fleet Availability Verification Alert Box */}
            {booking.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVAL_REQUESTED' || e.payloadJson?.requiresFleetApproval) &&
              !booking.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED') && (
                <div className="p-3 bg-amber-50 border-2 border-amber-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-xs">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <IconAlert className="w-4 h-4 text-amber-700 shrink-0" />
                      <span className="font-black text-xs text-amber-900 uppercase tracking-wide">
                        Fleet Availability Verification Required
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-1 max-w-xl">
                      Large group vehicle booking (Tempo Traveller / Force Urbania). Please verify fleet availability with operations.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={approvingFleet}
                    onClick={handleApproveFleet}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs whitespace-nowrap"
                  >
                    {approvingFleet ? 'Approving...' : 'Approve Fleet'}
                  </button>
                </div>
              )}

            {/* Driver Declined Alert Box */}
            {booking.tripEvents?.some((e: any) => e.type === 'DRIVER_DECLINED') &&
              (booking.status === BookingStatus.DISPATCHED || booking.status === BookingStatus.PENDING_ADMIN) && (
                <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-xs">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <IconAlert className="w-4 h-4 text-rose-700 shrink-0" />
                      <span className="font-black text-xs text-rose-900 uppercase tracking-wide">
                        Driver Declined This Assignment
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-800 mt-0.5">
                      Driver <span className="font-semibold">{booking.tripEvents.find((e: any) => e.type === 'DRIVER_DECLINED')?.payloadJson?.driverName || 'Assigned driver'}</span> declined this ride request. Please re-dispatch to another available driver.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenDispatch(booking.id, booking.humanReadableRef)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs shrink-0 whitespace-nowrap"
                  >
                    Re-dispatch Now
                  </button>
                </div>
              )}

            {/* Driver Cancellation Request Box - Pending Admin Acceptance */}
            {(() => {
              const latestCancelReq = booking.tripEvents?.find((e: any) => e.type === 'DRIVER_CANCEL_REQUESTED');
              const latestCancelApp = booking.tripEvents?.find((e: any) => e.type === 'DRIVER_CANCEL_APPROVED');
              const latestDeclined = booking.tripEvents?.find((e: any) => e.type === 'DRIVER_DECLINED');
              const hasAcceptedEvt = booking.tripEvents?.some((e: any) => e.type === 'DRIVER_ACCEPTED');
              const isActuallyAccepted =
                Boolean(hasAcceptedEvt) ||
                booking.status === BookingStatus.DRIVER_ACCEPTED ||
                booking.status === BookingStatus.DRIVER_EN_ROUTE ||
                booking.status === BookingStatus.TRIP_STARTED;

              const hasPendingCancel =
                Boolean(latestCancelReq) &&
                isActuallyAccepted &&
                booking.assignedDriverId != null &&
                (!latestCancelApp || new Date(latestCancelReq.createdAt) > new Date(latestCancelApp.createdAt)) &&
                (!latestDeclined || new Date(latestCancelReq.createdAt) > new Date(latestDeclined.createdAt));

              if (!hasPendingCancel) return null;

              return (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-pulse">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <IconAlert className="w-4 h-4 text-amber-700 shrink-0" />
                      <span className="font-black text-xs text-amber-900 uppercase tracking-wide">
                        Driver Requested Ride Cancellation
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 mt-0.5">
                      Driver <span className="font-bold">{latestCancelReq?.payloadJson?.driverName || 'Assigned driver'}</span> requested to cancel this ride assignment.
                    </p>
                    <p className="text-[11px] font-bold text-rose-700 mt-0.5">
                      Reason: "{latestCancelReq?.payloadJson?.reason || 'Reason not specified'}"
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAcceptDriverCancellation(booking.id)}
                    disabled={acceptingCancellation}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-lg shadow-xs shrink-0 transition"
                  >
                    {acceptingCancellation ? 'Processing...' : 'Accept Cancellation & Re-dispatch'}
                  </button>
                </div>
              );
            })()}

            {/* Pending Driver Override Alert Box */}
            {booking.tripEvents?.some((e: any) => e.type === 'OVERRIDE_REQUESTED') &&
              (booking.status === BookingStatus.DRIVER_ACCEPTED || booking.status === BookingStatus.DRIVER_EN_ROUTE) && (
                <div className="p-3 bg-amber-50 border-2 border-amber-400 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-xs animate-pulse">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <IconAlert className="w-4 h-4 text-amber-700 shrink-0" />
                      <span className="font-black text-xs text-amber-900 uppercase tracking-wide">
                        Driver Requested Manual Trip Start (OTP Override)
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Reason: <span className="font-semibold">{booking.tripEvents.find((e: any) => e.type === 'OVERRIDE_REQUESTED')?.payloadJson?.note || 'Customer phone unreachable / battery dead'}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenOtpOverride(booking.id, booking.humanReadableRef)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg shadow-xs shrink-0 transition inline-flex items-center gap-1.5"
                  >
                    <IconKey className="w-3.5 h-3.5" />
                    <span>Authorize & Start Trip</span>
                  </button>
                </div>
              )}

            {/* Trip Cancelled Alert Box */}
            {booking.status === BookingStatus.CANCELLED && (
              <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="font-black text-xs text-rose-900 uppercase tracking-wide">
                      Booking Cancelled
                    </span>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-md border ${
                    cancellationCharge > 0
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}>
                    {cancellationCharge > 0
                      ? `Cancellation Fee: ₹${cancellationCharge}`
                      : 'Fee Waived / Free (₹0)'}
                  </span>
                </div>

                {cancelEventData?.reason && (
                  <p className="text-xs text-rose-800 font-medium">
                    Reason: {cancelEventData.reason}
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-rose-200/60 text-[11px]">
                  <div>
                    <span className="text-rose-600 font-medium">Cancelled By:</span>{' '}
                    <span className="font-bold text-rose-950">{cancelEventData?.cancelledBy || 'CUSTOMER'}</span>
                  </div>
                  <div>
                    <span className="text-rose-600 font-medium">Cancellation Fee:</span>{' '}
                    <span className="font-bold text-rose-950">₹{cancellationCharge}</span>
                  </div>
                  <div>
                    <span className="text-rose-600 font-medium">Advance Paid:</span>{' '}
                    <span className="font-bold text-rose-950">₹{advancePaid}</span>
                  </div>
                  <div>
                    <span className="text-rose-600 font-medium">Refund Amount:</span>{' '}
                    <span className="font-bold text-emerald-700">₹{refundDue}</span>
                  </div>
                </div>

                {/* Refund Status & Admin Controls */}
                <div className="pt-2 border-t border-rose-200/60 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {isRefundDone ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black shadow-xs">
                        <span>✓ Refund Completed:</span>
                        <span className="font-bold">₹{refundEventData?.refundAmount ?? refundDue}</span>
                        {refundEventData?.refundMethod && (
                          <span className="font-medium text-emerald-700">via {refundEventData.refundMethod}</span>
                        )}
                        {refundEventData?.refundTxnRef && (
                          <span className="font-mono text-[10px] text-emerald-600">({refundEventData.refundTxnRef})</span>
                        )}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black shadow-xs">
                        <IconClock className="w-3.5 h-3.5 text-amber-700" />
                        <span>Pending Refund:</span>
                        <span className="font-bold">₹{refundDue}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Waive cancellation fee option */}
                    {cancellationCharge > 0 && (
                      <button
                        type="button"
                        disabled={waivingDrawerFee}
                        onClick={handleDrawerWaiveFee}
                        className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                        title="Waive the cancellation charge and grant full advance refund"
                      >
                        {waivingDrawerFee ? 'Waiving...' : '+ Waive Fee & Refund Full'}
                      </button>
                    )}

                    {/* Process Refund Action */}
                    {!isRefundDone && refundDue > 0 && (
                      <button
                        type="button"
                        onClick={handleOpenDrawerRefundModal}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-black transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title="Open refund form to record refund transaction"
                      >
                        <IconPayments className="w-3.5 h-3.5 text-white" />
                        <span>Process Customer Refund</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* FLOW A: Mini Live Tracking Map for Trip */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center space-x-1.5">
                  <IconMap className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Live Driver GPS & Route
                  </span>
                </div>
                {assignedDriver ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    GPS Active (Last: {assignedDriver.lastPingAt ? new Date(assignedDriver.lastPingAt).toLocaleTimeString() : 'Recent'})
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">No Driver Assigned</span>
                )}
              </div>

              <div className="p-3 sm:p-4 bg-slate-900 text-white min-h-[140px] flex flex-col justify-center items-center text-center relative overflow-hidden">
                {assignedDriver ? (
                  <div className="space-y-2 w-full max-w-md">
                    <div className="inline-flex items-center space-x-2 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] sm:text-xs font-mono">
                        {assignedDriver.user.fullName} ({assignedDriver.currentLat?.toFixed(4) || '12.9716'}, {assignedDriver.currentLng?.toFixed(4) || '77.5946'})
                      </span>
                    </div>

                    {/* Area / Building Name */}
                    <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/80 text-[11px] sm:text-xs">
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <IconBuilding className="w-3 h-3 text-slate-400 shrink-0 inline" />
                        <span>Current Location: </span>
                      </span>
                      <span className="text-emerald-300 font-semibold ml-1">
                        {driverLocationName || 'Resolving area & building...'}
                      </span>
                      {assignedDriver.currentLat && assignedDriver.currentLng && (
                        <div className="mt-1">
                          <a
                            href={`https://www.google.com/maps?q=${assignedDriver.currentLat},${assignedDriver.currentLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-sky-400 hover:text-sky-300 underline font-mono inline-block"
                          >
                            Open in Google Maps
                          </a>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Breadcrumbs Recorded: <span className="text-white font-bold">{trackingPoints.length}</span> GPS points
                    </p>
                    {trackingPoints.length > 0 && (
                      <div className="flex justify-center space-x-1 mt-1.5">
                        {trackingPoints.slice(-8).map((pt, i) => (
                          <div
                            key={pt.id || i}
                            className="w-1.5 h-5 bg-indigo-400/80 rounded-xs"
                            title={`Point ${i + 1}: ${pt.lat}, ${pt.lng}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Dispatch this ride to an online driver to activate Flow A live tracking.
                  </p>
                )}
              </div>
            </div>

            {/* Route & Multi-Drop Itinerary Card */}
            {(() => {
              const meta = getBookingMetadata(booking);
              const stops = meta.intermediateStops;
              return (
                <div className="p-3 sm:p-4 rounded-xl border border-slate-200 bg-white space-y-2.5 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <IconPinPickup className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                        Trip Route & Itinerary
                      </h4>
                    </div>
                    <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                        {booking.tripType} • {booking.distanceKm} KM
                      </span>
                      {stops.length > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-md border border-amber-300">
                          {stops.length} Intermediate Drop{stops.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {meta.hasCarrier && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded-md border border-emerald-300 inline-flex items-center gap-1">
                          <IconPackage className="w-3 h-3" />
                          <span>Roof Carrier Requested</span>
                        </span>
                      )}
                      {meta.hasPet && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-md border border-amber-300 inline-flex items-center gap-1">
                          <IconPaw className="w-3 h-3" />
                          <span>Pet Friendly{meta.petType ? ` (${meta.petType.charAt(0).toUpperCase() + meta.petType.slice(1).toLowerCase()})` : ''} (+₹{meta.petFee || 500})</span>
                        </span>
                      )}
                      {meta.flightNumber && (
                        <span className="text-[10px] bg-sky-100 text-sky-900 font-extrabold px-2 py-0.5 rounded-md border border-sky-300 inline-flex items-center gap-1">
                          <IconPlane className="w-3 h-3" />
                          <span>Flight: {meta.flightNumber}</span>
                        </span>
                      )}
                      {meta.isSeniorCitizen && (
                        <span className="text-[10px] bg-orange-100 text-orange-900 font-extrabold px-2 py-0.5 rounded-md border border-orange-300 inline-flex items-center gap-1">
                          <span>Senior Citizen (60+)</span>
                        </span>
                      )}
                      {meta.isBabyOnBoard && (
                        <span className="text-[10px] bg-pink-100 text-pink-900 font-extrabold px-2 py-0.5 rounded-md border border-pink-300 inline-flex items-center gap-1">
                          <span>Baby on Board</span>
                        </span>
                      )}
                      {meta.isPregnancyFriendly && (
                        <span className="text-[10px] bg-purple-100 text-purple-900 font-extrabold px-2 py-0.5 rounded-md border border-purple-300 inline-flex items-center gap-1">
                          <span>Pregnancy Friendly</span>
                        </span>
                      )}
                      {meta.isAccessibilityAssistance && (
                        <span className="text-[10px] bg-blue-100 text-blue-900 font-extrabold px-2 py-0.5 rounded-md border border-blue-300 inline-flex items-center gap-1">
                          <span>Accessibility Assistance</span>
                        </span>
                      )}
                      {meta.needReturnJourney && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-900 font-extrabold px-2 py-0.5 rounded-md border border-indigo-300 inline-flex items-center gap-1">
                          <span>Return Journey Later</span>
                        </span>
                      )}
                      {meta.needAirportDrop && (
                        <span className="text-[10px] bg-sky-100 text-sky-900 font-extrabold px-2 py-0.5 rounded-md border border-sky-300 inline-flex items-center gap-1">
                          <span>Airport Drop</span>
                        </span>
                      )}
                      {meta.needAirportPickup && (
                        <span className="text-[10px] bg-teal-100 text-teal-900 font-extrabold px-2 py-0.5 rounded-md border border-teal-300 inline-flex items-center gap-1">
                          <span>Airport Pickup</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi-Drop Warning / Info Alert */}
                  {stops.length > 0 && (
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                      <IconAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Customer Selected Multiple Drops / Intermediate Stops:</span>
                        <span className="text-[11px] text-amber-800">
                          This trip requires the driver to stop at intermediate destination(s) before reaching final drop-off.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Roof Carrier Alert */}
                  {meta.hasCarrier && (
                    <div className="p-2.5 bg-emerald-50/90 border border-emerald-300 rounded-lg text-xs text-emerald-950 flex items-start gap-2 shadow-2xs">
                      <IconPackage className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold block text-emerald-900">Roof Luggage Carrier Requested:</span>
                        <span className="text-[11px] text-emerald-800">
                          Customer selected rooftop luggage carrier on cab for extra luggage capacity (Up to 45-60 kg rooftop space). Ensure assigned cab has a roof carrier.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Pet Friendly Alert */}
                  {meta.hasPet && (
                    <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-lg text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                      <IconPaw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold block text-amber-900">
                          Pet-Friendly Trip{meta.petType ? ` (${meta.petType.charAt(0).toUpperCase() + meta.petType.slice(1).toLowerCase()})` : ''}:
                        </span>
                        <span className="text-[11px] text-amber-800">
                          Customer is travelling with a {meta.petType ? meta.petType.toLowerCase() : 'pet'} (+₹{meta.petFee || 500} pet sanitization & convenience fee applied). Please ensure the assigned vehicle is pet-friendly and inform driver.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Airport Flight Alert */}
                  {meta.flightNumber && (
                    <div className="p-2.5 bg-sky-50/90 border border-sky-300 rounded-lg text-xs text-sky-950 flex items-start gap-2 shadow-2xs">
                      <IconPlane className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold block text-sky-900">Airport Transfer Flight Details:</span>
                        <span className="text-[11px] text-sky-800">
                          Flight Number: <strong className="font-black text-sky-950">{meta.flightNumber}</strong>. Track this flight arrival/departure time to ensure timely pickup and avoid waiting charges.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Route Timeline / Stepper */}
                  <div className="space-y-3 pt-1">
                    {/* 1. Pickup */}
                    <div className="flex items-start gap-3 relative">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center text-xs font-bold text-emerald-800 shrink-0">
                          1
                        </div>
                        <div className="w-0.5 h-full min-h-[28px] bg-slate-200 my-0.5" />
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Pickup Location</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Start</span>
                          </div>
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-300 rounded text-[10.5px] font-bold text-amber-900 shadow-2xs">
                            <IconCalendar className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>Pickup: {pickupTiming.dateStr}, {pickupTiming.timeStr}</span>
                          </div>
                        </div>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">{booking.pickupAddress}</p>
                      </div>
                    </div>

                    {/* Intermediate Stops */}
                    {stops.map((stopName, idx) => (
                      <div key={idx} className="flex items-start gap-3 relative">
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full bg-amber-100 border-2 border-amber-500 flex items-center justify-center text-xs font-extrabold text-amber-900 shrink-0">
                            {idx + 2}
                          </div>
                          <div className="w-0.5 h-full min-h-[28px] bg-slate-200 my-0.5" />
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                              Intermediate Drop #{idx + 1}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-extrabold">
                              Via Stop
                            </span>
                          </div>
                          <p className="text-xs font-bold text-amber-950 mt-0.5 bg-amber-50/50 p-1.5 rounded border border-amber-200">
                            {stopName}
                          </p>
                        </div>
                      </div>
                    ))}

                    {/* Final Drop */}
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-rose-100 border-2 border-rose-500 flex items-center justify-center text-xs font-bold text-rose-800 shrink-0">
                          {stops.length + 2}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wide">Final Destination</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold">Dropoff</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">{booking.dropAddress}</p>
                      </div>
                    </div>
                  </div>

                  {/* Customer Additional Notes / Luggage / Passengers / Carrier / Pet / Flight / GST / Alt Email */}
                  {(Boolean(pickupTiming.dateStr !== '--') || meta.passengers || meta.luggage || meta.hasCarrier || meta.hasPet || meta.flightNumber || meta.gstin || meta.alternateEmail || meta.notes || meta.specialRequirements) && (
                    <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-1.5 sm:gap-2 text-xs">
                      {/* Pickup Timing */}
                      <div className="bg-amber-50/90 p-2 sm:p-2.5 rounded-lg border border-amber-300">
                        <span className="flex items-center gap-1 text-[10px] text-amber-800 font-bold mb-0.5">
                          <IconCalendar className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>Pickup Timing</span>
                        </span>
                        <span className="font-extrabold text-amber-950 block text-[11px] sm:text-xs">
                          {pickupTiming.dateStr}
                        </span>
                        <span className="font-bold text-amber-800 text-[10px] block">
                          {pickupTiming.timeStr}
                        </span>
                      </div>
                      {/* Booking Created Date */}
                      {booking.createdAt && (
                        <div className="bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-200">
                          <span className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold mb-0.5">
                            <IconCalendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Booking Date</span>
                          </span>
                          <span className="font-bold text-slate-800 block text-[11px] sm:text-xs">
                            {bookedTiming.dateStr}
                          </span>
                          <span className="text-slate-500 text-[10px] block font-medium">
                            {bookedTiming.timeStr}
                          </span>
                        </div>
                      )}
                      {meta.passengers ? (
                        <div className="bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-200">
                          <span className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold mb-0.5">
                            <IconUsers className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>Passengers</span>
                          </span>
                          <span className="font-bold text-slate-800 block">{meta.passengers} Persons</span>
                        </div>
                      ) : null}
                      {meta.luggage ? (
                        <div className="bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-200">
                          <span className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold mb-0.5">
                            <IconPackage className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>Luggage</span>
                          </span>
                          <span className="font-bold text-slate-800 block">{meta.luggage}</span>
                        </div>
                      ) : null}
                      {meta.hasCarrier ? (
                        <div className="bg-emerald-50/90 p-2 sm:p-2.5 rounded-lg border border-emerald-300">
                          <span className="flex items-center gap-1 text-[10px] text-emerald-800 font-bold mb-0.5">
                            <IconPackage className="w-3 h-3 text-emerald-700 shrink-0" />
                            <span>Roof Carrier</span>
                          </span>
                          <span className="font-black text-emerald-950 block">Requested (Rooftop)</span>
                        </div>
                      ) : null}
                      {meta.hasPet ? (
                        <div className="bg-amber-50/90 p-2 sm:p-2.5 rounded-lg border border-amber-300">
                          <span className="flex items-center gap-1 text-[10px] text-amber-800 font-bold mb-0.5">
                            <IconPaw className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>Pet Friendly</span>
                          </span>
                          <span className="font-black text-amber-950 block">{meta.petType ? meta.petType.charAt(0).toUpperCase() + meta.petType.slice(1).toLowerCase() : 'Yes'} (+₹{meta.petFee || 500})</span>
                        </div>
                      ) : null}
                      {meta.flightNumber ? (
                        <div className="bg-sky-50/90 p-2 sm:p-2.5 rounded-lg border border-sky-300">
                          <span className="flex items-center gap-1 text-[10px] text-sky-800 font-bold mb-0.5">
                            <IconPlane className="w-3 h-3 text-sky-700 shrink-0" />
                            <span>Flight Number</span>
                          </span>
                          <span className="font-black text-sky-950 block">{meta.flightNumber}</span>
                        </div>
                      ) : null}
                      {meta.gstin ? (
                        <div className="bg-indigo-50/90 p-2 sm:p-2.5 rounded-lg border border-indigo-300">
                          <span className="flex items-center gap-1 text-[10px] text-indigo-800 font-bold mb-0.5">
                            <IconBuilding className="w-3 h-3 text-indigo-700 shrink-0" />
                            <span>GSTIN</span>
                          </span>
                          <span className="font-mono font-black text-indigo-950 text-xs block">{meta.gstin}</span>
                          {meta.companyName ? (
                            <span className="text-[10px] text-indigo-700 block truncate mt-0.5">{meta.companyName}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {meta.alternateEmail ? (
                        <div className="bg-sky-50/90 p-2 sm:p-2.5 rounded-lg border border-sky-300">
                          <span className="flex items-center gap-1 text-[10px] text-sky-800 font-bold mb-0.5">
                            <IconMail className="w-3 h-3 text-sky-700 shrink-0" />
                            <span>Alternate Email</span>
                          </span>
                          <span className="font-bold text-sky-950 truncate block text-[11px]">{meta.alternateEmail}</span>
                        </div>
                      ) : null}
                      {meta.isSeniorCitizen ? (
                        <div className="bg-orange-50/90 p-2 sm:p-2.5 rounded-lg border border-orange-300">
                          <span className="flex items-center gap-1 text-[10px] text-orange-800 font-bold mb-0.5">
                            <span>Senior Citizen (60+)</span>
                          </span>
                          <span className="font-black text-orange-950 block text-[11px]">Easy Access &amp; Assistance</span>
                        </div>
                      ) : null}
                      {meta.isBabyOnBoard ? (
                        <div className="bg-pink-50/90 p-2 sm:p-2.5 rounded-lg border border-pink-300">
                          <span className="flex items-center gap-1 text-[10px] text-pink-800 font-bold mb-0.5">
                            <span>Baby on Board</span>
                          </span>
                          <span className="font-black text-pink-950 block text-[11px]">Infant / Child Safety</span>
                        </div>
                      ) : null}
                      {meta.isPregnancyFriendly ? (
                        <div className="bg-purple-50/90 p-2 sm:p-2.5 rounded-lg border border-purple-300">
                          <span className="flex items-center gap-1 text-[10px] text-purple-800 font-bold mb-0.5">
                            <span>Pregnancy Care</span>
                          </span>
                          <span className="font-black text-purple-950 block text-[11px]">Extra Smooth Driving</span>
                        </div>
                      ) : null}
                      {meta.isAccessibilityAssistance ? (
                        <div className="bg-blue-50/90 p-2 sm:p-2.5 rounded-lg border border-blue-300">
                          <span className="flex items-center gap-1 text-[10px] text-blue-800 font-bold mb-0.5">
                            <span>Accessibility</span>
                          </span>
                          <span className="font-black text-blue-950 block text-[11px]">Driver Boarding Assistance</span>
                        </div>
                      ) : null}
                      {meta.needReturnJourney ? (
                        <div className="bg-indigo-50/90 p-2 sm:p-2.5 rounded-lg border border-indigo-300">
                          <span className="flex items-center gap-1 text-[10px] text-indigo-800 font-bold mb-0.5">
                            <span>Return Trip</span>
                          </span>
                          <span className="font-black text-indigo-950 block text-[11px]">Return Journey Later</span>
                        </div>
                      ) : null}
                      {meta.needAirportDrop ? (
                        <div className="bg-sky-50/90 p-2 sm:p-2.5 rounded-lg border border-sky-300">
                          <span className="flex items-center gap-1 text-[10px] text-sky-800 font-bold mb-0.5">
                            <span>Airport Drop</span>
                          </span>
                          <span className="font-black text-sky-950 block text-[11px]">Airport Drop Requested</span>
                        </div>
                      ) : null}
                      {meta.needAirportPickup ? (
                        <div className="bg-teal-50/90 p-2 sm:p-2.5 rounded-lg border border-teal-300">
                          <span className="flex items-center gap-1 text-[10px] text-teal-800 font-bold mb-0.5">
                            <span>Airport Pickup</span>
                          </span>
                          <span className="font-black text-teal-950 block text-[11px]">Airport Pickup Requested</span>
                        </div>
                      ) : null}
                      {(meta.notes || meta.specialRequirements) ? (
                        <div className="sm:col-span-4 bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block font-semibold mb-0.5">Special Instructions / Notes</span>
                          <span className="font-medium text-slate-800 block">{meta.notes || meta.specialRequirements}</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Customer & Route Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
              <div className="p-3 sm:p-4 rounded-xl border border-slate-200 bg-white">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Customer Info</h4>
                <p className="text-sm font-bold text-slate-900">{booking.customer?.user?.fullName}</p>
                <p className="text-xs text-slate-600 font-mono mt-0.5">{booking.customer?.user?.phone}</p>
                {booking.customer?.email && (
                  <p className="text-xs text-slate-500 mt-0.5">{booking.customer.email}</p>
                )}
                {bookingMeta.alternateEmail && (
                  <p className="text-xs text-sky-700 font-medium mt-1">
                    Alt Email: <span className="font-bold">{bookingMeta.alternateEmail}</span>
                  </p>
                )}
                {bookingMeta.gstin && (
                  <div className="mt-2 p-2 rounded-lg bg-indigo-50/80 border border-indigo-200">
                    <span className="text-[10px] uppercase font-bold text-indigo-800 block">GSTIN Details</span>
                    <p className="text-xs font-mono font-bold text-indigo-950">{bookingMeta.gstin}</p>
                    {bookingMeta.companyName ? (
                      <p className="text-[11px] text-indigo-800 font-medium">{bookingMeta.companyName}</p>
                    ) : null}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  Pickup OTP: <span className="font-mono font-bold text-amber-600">{booking.pickupOtp || 'N/A'}</span>
                </p>
              </div>

              <div className="p-3 sm:p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-500">Assigned Driver</h4>
                  {assignedDriver && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      4.9 Rating
                    </span>
                  )}
                </div>
                {assignedDriver ? (
                  <>
                    <p className="text-sm font-bold text-slate-900">{assignedDriver.user.fullName}</p>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">{assignedDriver.user.phone}</p>
                    <p className="text-xs text-slate-500 mt-1">License: {assignedDriver.licenseNumber}</p>

                    {(booking.status === BookingStatus.DRIVER_ACCEPTED ||
                      booking.status === BookingStatus.DRIVER_EN_ROUTE) && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-amber-800 font-medium">Driver unable to continue?</span>
                        <button
                          type="button"
                          onClick={() => onOpenDispatch(booking.id, booking.humanReadableRef)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-xs font-bold inline-flex items-center gap-1 transition"
                          title="Driver unable to continue the trip? Re-dispatch to another driver"
                        >
                          <IconRadio className="w-3 h-3 text-amber-700" />
                          <span>Re-dispatch</span>
                        </button>
                      </div>
                    )}

                    {/* Customer Rating & Review for Trip if Rated */}
                    {(() => {
                      const ratingEvt = booking.tripEvents?.find(
                        (e: any) => e.type === 'TRIP_REVIEWED' || e.type === 'DRIVER_RATED'
                      );
                      const tripRating = ratingEvt?.payloadJson
                        ? (typeof ratingEvt.payloadJson === 'string'
                            ? JSON.parse(ratingEvt.payloadJson)
                            : ratingEvt.payloadJson)
                        : null;
                      if (!tripRating) return null;
                      const dRating = tripRating.driverRating || tripRating.rating || 5;
                      const kRating = tripRating.kandyRating || 5;
                      const dTags = tripRating.driverFeedbackTags || tripRating.feedbackTags || [];
                      const kTags = tripRating.kandyFeedbackTags || [];

                      return (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-800">
                              Customer Trip Review
                            </span>
                            {tripRating.ratedAt && (
                              <span className="text-[10px] text-slate-400">
                                {new Date(tripRating.ratedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* Dual Ratings: Driver & KandyCabs */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Driver: {dRating}/5
                            </span>
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              KandyCabs: {kRating}/5
                            </span>
                          </div>

                          {/* Tags */}
                          {(dTags.length > 0 || kTags.length > 0) && (
                            <div className="flex flex-wrap gap-1">
                              {dTags.map((t: string) => (
                                <span
                                  key={t}
                                  className="text-[10px] bg-amber-50 text-amber-800 font-medium px-1.5 py-0.5 rounded border border-amber-200"
                                >
                                  {t}
                                </span>
                              ))}
                              {kTags.map((t: string) => (
                                <span
                                  key={t}
                                  className="text-[10px] bg-emerald-50 text-emerald-800 font-medium px-1.5 py-0.5 rounded border border-emerald-200"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {tripRating.comment ? (
                            <p className="text-[11px] text-slate-700 italic bg-slate-50 p-1.5 rounded border border-slate-200">
                              "{tripRating.comment}"
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic">Not yet assigned</p>
                )}
              </div>
            </div>

            {/* Trip Execution Timings & Milestones */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Trip Execution Timings & Milestones
                  </h4>
                </div>
                {timingData.totalTripDuration && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-800 font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                    Duration: {timingData.totalTripDuration}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {timingData.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 sm:p-2.5 rounded-lg border border-slate-200 bg-slate-50/80 flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[11px] font-bold text-slate-800 block leading-tight">
                        {m.label}
                      </span>
                      <span className="text-[9px] text-slate-500 block truncate mt-0.5">
                        {m.sub}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-1.5 border-t border-slate-200 flex items-end justify-between gap-1">
                      <div>
                        <span className="text-xs font-mono font-bold text-indigo-950 block">
                          {m.timeStr || '--:--'}
                        </span>
                        {m.extraInfo && (
                          <span className="text-[9px] text-slate-600 block truncate font-medium mt-0.5">
                            {m.extraInfo}
                          </span>
                        )}
                      </div>

                      {/* Status Icon Arranged Below */}
                      {m.status === 'COMPLETED' ? (
                        <span
                          className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0 shadow-2xs mb-0.5"
                          title="Completed"
                        >
                          <svg className="w-3 h-3 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      ) : m.status === 'IN_PROGRESS' ? (
                        <span
                          className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 border border-blue-300 flex items-center justify-center shrink-0 shadow-2xs mb-0.5"
                          title="In Progress"
                        >
                          <svg className="w-3 h-3 stroke-[2.5] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                        </span>
                      ) : (
                        <span
                          className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center shrink-0 mb-0.5"
                          title="Pending"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Recorded Waiting Sessions Breakdown */}
              {(timingData.isWaitingActive || (timingData.waitingSessions && timingData.waitingSessions.length > 0)) && (
                <div className="mt-2.5 p-3 rounded-lg border border-amber-200 bg-amber-50/70">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                        Customer Waiting Sessions Breakdown
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                      Total: {timingData.waitingMinutes > 0 ? `${timingData.waitingMinutes} mins` : `${timingData.totalAccumulatedSeconds || 0}s`}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {timingData.waitingSessions?.map((s, idx) => {
                      const locationText =
                        s.address ||
                        s.location?.address ||
                        (s.lat && s.lng ? `${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}` : null);
                      const hasCoords = s.lat && s.lng;

                      return (
                        <div
                          key={s.id || idx}
                          className="flex flex-col text-xs py-1.5 px-2.5 rounded bg-white border border-amber-200/80 shadow-2xs gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-slate-600 text-[11px]">
                                Start: <strong className="text-slate-900">{s.startedAt}</strong> → Stop: <strong className="text-slate-900">{s.stoppedAt || 'Active'}</strong>
                              </span>
                            </div>
                            <span className="font-mono font-bold text-amber-950 text-[11px]">
                              {s.durationSeconds >= 60
                                ? `${Math.floor(s.durationSeconds / 60)}m ${s.durationSeconds % 60}s`
                                : `${s.durationSeconds}s`}
                            </span>
                          </div>

                          {locationText && (
                            <div className="flex items-center space-x-1.5 text-[10.5px] text-slate-500 pl-7">
                              <IconMapPin className="w-3 h-3 text-rose-500 shrink-0" />
                              <span className="truncate max-w-[320px]" title={locationText}>
                                Stopped at: <strong className="text-slate-700 font-medium">{locationText}</strong>
                              </span>
                              {hasCoords && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-[10px] inline-flex items-center shrink-0 ml-1 font-medium"
                                >
                                  View Map ↗
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {timingData.isWaitingActive && (
                      <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-amber-100 border border-amber-300 animate-pulse">
                        <span className="text-amber-900 font-semibold text-[11px] flex items-center gap-1">
                          <IconClock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Currently waiting for customer...</span>
                        </span>
                        <span className="text-amber-950 font-bold text-[11px]">In Progress</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Verification Photos (5 Photos) & Odometer Evidence */}
            <div className="p-3 sm:p-4 rounded-xl border border-sky-200 bg-sky-50/40 space-y-2.5 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <IconImage className="w-4 h-4 text-sky-900 shrink-0" />
                      <h4 className="font-bold text-sky-950 text-xs uppercase tracking-wider">
                        Driver Verification & Inspection Evidence
                      </h4>
                    </div>
                    <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-md border border-sky-200">
                      {verificationData.uploadedCount}/{verificationData.totalCount} Photos
                    </span>
                  </div>

                  {/* Pre-Trip Inspection Angles */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">
                      Pre-Trip Verification Photos ({verificationData.totalCount} Photos):
                    </span>
                    <div className={`grid grid-cols-2 ${verificationData.photos.length === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-1.5 sm:gap-2`}>
                      {verificationData.photos.map((item) => {
                        const photoUrl = item.url;
                        return (
                          <div
                            key={item.key}
                            className="bg-white border border-slate-200 rounded-lg p-1.5 sm:p-2 flex flex-col items-center text-center shadow-2xs"
                          >
                            <span className="text-[11px] font-bold text-slate-800 leading-tight">{item.label}</span>
                            <span className="text-[9px] text-slate-500 mb-1 truncate max-w-full">{item.sub}</span>
                            {photoUrl ? (
                              <div
                                onClick={() => setPreviewImage({ url: resolveImageUrl(photoUrl), title: item.label })}
                                className="w-full h-20 bg-slate-100 rounded border border-emerald-300 overflow-hidden cursor-pointer relative group"
                              >
                                <img
                                  src={resolveImageUrl(photoUrl)}
                                  alt={item.label}
                                  className="w-full h-full object-cover group-hover:scale-105 transition"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">
                                  View Full
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-20 bg-slate-100 rounded border border-dashed border-slate-300 flex flex-col items-center justify-center text-[10px] text-slate-400 p-1">
                                <IconImage className="w-4 h-4 text-slate-300 mb-0.5" />
                                <span>Not Captured</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

              {/* Odometer Evidence Comparison */}
              <div className="pt-2 border-t border-sky-100 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-2 sm:p-2.5 shadow-2xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-slate-700">Starting Odometer</span>
                    <span className="text-xs font-mono font-black text-emerald-700">
                      {booking.startingOdometer ? `${booking.startingOdometer} KM` : 'N/A'}
                    </span>
                  </div>
                  {booking.startingOdometerImagePath ? (
                    <div
                      onClick={() =>
                        setPreviewImage({
                          url: resolveImageUrl(booking.startingOdometerImagePath),
                          title: `Starting Odometer (${booking.startingOdometer || 'N/A'} KM)`,
                        })
                      }
                      className="w-full h-20 bg-slate-100 rounded border border-slate-200 overflow-hidden cursor-pointer relative group"
                    >
                      <img
                        src={resolveImageUrl(booking.startingOdometerImagePath)}
                        alt="Starting Odometer"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">
                        View Full
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-16 bg-slate-50 rounded border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                      No photo uploaded
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-2 sm:p-2.5 shadow-2xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-slate-700">Final Odometer</span>
                    <span className="text-xs font-mono font-black text-indigo-700">
                      {booking.finalOdometer ? `${booking.finalOdometer} KM` : 'N/A'}
                    </span>
                  </div>
                  {booking.finalOdometerImagePath ? (
                    <div
                      onClick={() =>
                        setPreviewImage({
                          url: resolveImageUrl(booking.finalOdometerImagePath),
                          title: `Final Odometer (${booking.finalOdometer || 'N/A'} KM)`,
                        })
                      }
                      className="w-full h-20 bg-slate-100 rounded border border-slate-200 overflow-hidden cursor-pointer relative group"
                    >
                      <img
                        src={resolveImageUrl(booking.finalOdometerImagePath)}
                        alt="Final Odometer"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">
                        View Full
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-16 bg-slate-50 rounded border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                      No photo uploaded
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Financial Overview */}
            {(() => {
              const fMeta = getBookingMetadata(booking);
              return (
                <div className="p-3 sm:p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 sm:space-y-2 text-xs">
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-1.5">Fare & Invoice Breakdown</h4>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Base Estimated Total:</span>
                    <span className="font-bold text-slate-900">₹{Number(booking.estimatedFare).toFixed(2)}</span>
                  </div>
                  {fMeta.hasPet && (
                    <div className="flex justify-between text-amber-800">
                      <span>Pet Convenience Fee{fMeta.petType ? ` (${fMeta.petType.charAt(0).toUpperCase() + fMeta.petType.slice(1).toLowerCase()})` : ''}:</span>
                      <span className="font-bold">+₹{(fMeta.petFee || 500).toFixed(2)} (Included in Total)</span>
                    </div>
                  )}
                  <div className="flex justify-between text-emerald-700">
                    <span>Advance Paid (25%):</span>
                    <span className="font-bold">₹{Number(booking.advanceAmount).toFixed(2)} ({booking.advancePaymentStatus})</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Base Balance (75%):</span>
                    <span className="font-bold">₹{Number(booking.balanceAmount).toFixed(2)} ({booking.balancePaymentStatus})</span>
                  </div>
                  {(Number(booking.tollAmount || 0) > 0 || Number(booking.parkingAmount || 0) > 0) && (
                    <div className="pt-1.5 border-t border-slate-200 space-y-1">
                      {Number(booking.tollAmount || 0) > 0 && (
                        <div className="flex justify-between text-amber-700">
                          <span>Toll Gate Charges (Driver Added):</span>
                          <span className="font-bold">+₹{Number(booking.tollAmount).toFixed(2)}</span>
                        </div>
                      )}
                      {Number(booking.parkingAmount || 0) > 0 && (
                        <div className="flex justify-between text-blue-700">
                          <span>Parking Charges (Driver Added):</span>
                          <span className="font-bold">+₹{Number(booking.parkingAmount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-indigo-900 font-bold pt-1 border-t border-slate-200">
                        <span>Final Invoice Balance to Bill:</span>
                        <span>₹{(Number(booking.balanceAmount) + Number(booking.tollAmount || 0) + Number(booking.parkingAmount || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Trip Completion Payment Method Badge (Admin UPI QR vs Cash Collected vs Pay Later) */}
                  {(() => {
                    const completeEvent = booking.tripEvents?.find((e: any) => e.type === 'TRIP_COMPLETED');
                    const balancePayment = booking.payments?.find((p: any) => p.type === 'BALANCE');
                    const method = balancePayment?.paymentMethod || completeEvent?.payloadJson?.paymentMethod;
                    const hasPayLater = isPayLater || method === 'PAY_LATER';
                    const isUpi = method === 'UPI_QR';

                    if (!method && !hasPayLater) return null;

                    return (
                      <div className="space-y-2 mt-2">
                        <div className={`p-2 rounded-lg border flex items-center justify-between text-xs font-bold ${
                          hasPayLater
                            ? 'bg-amber-50 text-amber-950 border-amber-200'
                            : isUpi
                            ? 'bg-sky-50 text-sky-950 border-sky-200'
                            : 'bg-emerald-50 text-emerald-950 border-emerald-200'
                        }`}>
                          <span className="flex items-center gap-1.5">
                            <IconPayments className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                            <span>Balance Collection:</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded-md border text-[10.5px] font-black uppercase tracking-wide ${
                            hasPayLater
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : isUpi
                              ? 'bg-sky-100 text-sky-900 border-sky-300'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}>
                            {hasPayLater ? 'Customer Pays Later (Admin Pending)' : isUpi ? 'Admin UPI QR (Direct)' : 'Cash Collected by Driver'}
                          </span>
                        </div>

                        {/* Admin Action Box for Pay Later */}
                        {hasPayLater && booking.balancePaymentStatus !== 'PAID' && booking.status !== BookingStatus.CANCELLED && booking.status !== 'CANCELLED' && (
                          <div className="p-3 bg-amber-50 rounded-xl border-2 border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="font-extrabold text-amber-900 text-xs uppercase tracking-wide">
                                  Customer Pay Later Active
                                </span>
                              </div>
                              <p className="text-[11px] text-amber-800 mt-0.5">
                                Driver collected ₹0. Remaining balance to collect from passenger: <strong className="text-amber-950 font-black">₹{Number(booking.balanceAmount).toLocaleString('en-IN')}</strong>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setRecordPaymentTxnRef('');
                                setRecordPaymentNotes('');
                                setShowRecordPaymentModal(true);
                              }}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition cursor-pointer"
                            >
                              <IconPayments className="w-3.5 h-3.5" />
                              <span>Record Balance Payment</span>
                            </button>
                          </div>
                        )}

                        {hasPayLater && booking.balancePaymentStatus === 'PAID' && (
                          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-300 flex items-center justify-between text-xs shadow-xs">
                            <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>Admin Collected Balance (₹{Number(booking.balanceAmount).toLocaleString('en-IN')})</span>
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-black text-[10px] uppercase tracking-wider">
                              Payment Reconciled in Ledger
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Vendor Cost & Trip Commercials Management */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <IconCash className="w-4 h-4 text-indigo-950 shrink-0" />
                  <h4 className="font-extrabold text-indigo-950 uppercase tracking-wider">
                    Vendor Cost & Trip Commercials
                  </h4>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-black border flex items-center gap-1 ${
                    driverPayStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-xs'
                      : 'bg-amber-100 text-amber-800 border-amber-300 shadow-xs'
                  }`}
                >
                  {driverPayStatus === 'PAID' ? 'PAID (SETTLED)' : 'VENDOR PENDING'}
                </span>
              </div>

              {/* Profit & Commercials Quick Summary Bar */}
              <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-indigo-100 text-center shadow-2xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Customer Total</span>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 font-mono">
                    ₹{Number(booking.estimatedFare || 0).toFixed(2)}
                  </span>
                </div>
                <div className="border-x border-slate-100">
                  <span className="text-[10px] text-indigo-600 font-bold block uppercase">Vendor Cost</span>
                  <span className="text-xs sm:text-sm font-extrabold text-indigo-700 font-mono">
                    ₹{Number(driverPayeeVal || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 font-bold block uppercase">Net Profit Margin</span>
                  <span className={`text-xs sm:text-sm font-extrabold font-mono ${
                    (Number(booking.estimatedFare || 0) - Number(driverPayeeVal || 0)) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {((Number(booking.estimatedFare || 0) - Number(driverPayeeVal || 0)) >= 0 ? '+' : '')}
                    ₹{(Number(booking.estimatedFare || 0) - Number(driverPayeeVal || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Commercial Inputs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Vendor Cost Input */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-extrabold text-indigo-950 mb-1">
                    Vendor Cost (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={driverPayeeVal}
                    onChange={(e) => setDriverPayeeVal(e.target.value)}
                    placeholder="e.g. 4850"
                    className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg font-mono font-bold text-xs text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  />
                  <span className="text-[9.5px] text-slate-500 mt-0.5 block">Vendor agreed payout</span>
                </div>

                {/* Driver Bata Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Driver Bata (₹)
                    </label>
                    {chauffeurCalc && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        chauffeurCalc.isDayIncluded ? 'text-indigo-700 bg-indigo-50 border border-indigo-200' : 'text-slate-500 bg-slate-100 border border-slate-200'
                      }`}>
                        {chauffeurCalc.isDayIncluded ? 'Day Included' : 'No Day Bata'}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={driverAllowanceVal}
                    onChange={(e) => {
                      const newBata = e.target.value;
                      setDriverAllowanceVal(newBata);
                      const dist = Number(booking.distanceKm) || 0;
                      const newTotal = Math.round(dist * (parseFloat(kmRateVal) || 13) + (parseFloat(newBata) || 0));
                      setDriverPayeeVal(String(newTotal));
                    }}
                    placeholder="e.g. 350"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                  <div className="flex flex-col gap-0.5 mt-1">
                    <span className="text-[9.5px] text-slate-500 leading-tight">
                      {chauffeurCalc ? `Policy: ${chauffeurCalc.summaryText}` : 'Driver allowance / day'}
                    </span>
                    {chauffeurCalc && parseFloat(driverAllowanceVal || '0') !== chauffeurCalc.totalAllowance && (
                      <button
                        type="button"
                        onClick={() => {
                          setDriverAllowanceVal(String(chauffeurCalc.totalAllowance));
                          const dist = Number(booking.distanceKm) || 0;
                          const newTotal = Math.round(dist * (parseFloat(kmRateVal) || 13) + chauffeurCalc.totalAllowance);
                          setDriverPayeeVal(String(newTotal));
                        }}
                        className="text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 underline text-left cursor-pointer"
                        title="Sync with configured Chauffeur Allowance policy"
                      >
                        Reset to Policy (₹{chauffeurCalc.totalAllowance})
                      </button>
                    )}
                  </div>
                </div>

                {/* Base Km Rate */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Km Price (₹/Km)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={kmRateVal}
                    onChange={(e) => {
                      const newRate = e.target.value;
                      setKmRateVal(newRate);
                      const dist = Number(booking.distanceKm) || 0;
                      const newTotal = Math.round(dist * (parseFloat(newRate) || 0) + (parseFloat(driverAllowanceVal) || 0));
                      setDriverPayeeVal(String(newTotal));
                    }}
                    placeholder="e.g. 13"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[9.5px] text-slate-500 mt-0.5 block">Base rate inclusion</span>
                </div>

                {/* Extra Km Price */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Extra (₹/Km)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={extraKmRateVal}
                    onChange={(e) => setExtraKmRateVal(e.target.value)}
                    placeholder="e.g. 13"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[9.5px] text-slate-500 mt-0.5 block">After limit rate</span>
                </div>
              </div>

              {/* Vehicle Type override & Auto Calculate row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Vehicle Type Display in Vendor Template
                  </label>
                  <input
                    type="text"
                    value={vehicleLabelVal}
                    onChange={(e) => setVehicleLabelVal(e.target.value)}
                    placeholder="e.g. Sedan - Toyota Etios"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const auto = Math.round((Number(booking.distanceKm) || 0) * (parseFloat(kmRateVal) || 13) + (parseFloat(driverAllowanceVal) || 0));
                      setDriverPayeeVal(String(auto));
                    }}
                    className="w-full px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-lg transition text-center shadow-2xs cursor-pointer"
                    title="Calculate: Distance × Km Price + Driver Bata"
                  >
                    Compute ({Number(booking.distanceKm || 0)} km × ₹{kmRateVal || 13} + ₹{driverAllowanceVal || 0})
                  </button>
                </div>
              </div>

              {/* Status & Save Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-indigo-100">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-700">Payout Status:</span>
                  <select
                    value={driverPayStatus}
                    onChange={(e) => setDriverPayStatus(e.target.value)}
                    className="px-2 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PAID">PAID (Settled)</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={savingDriverPay}
                  onClick={handleSaveDriverPayment}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5"
                >
                  <IconCash className="w-3.5 h-3.5" />
                  <span>{savingDriverPay ? 'Saving Vendor Cost...' : `Update Vendor Cost (₹${driverPayeeVal || '0'})`}</span>
                </button>
              </div>

              {/* Vendor Trip Details Dispatch Template Card */}
              <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-800">
                    Vendor WhatsApp / SMS Dispatch Format
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyVendorTripDetails}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                        copiedVendorText
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-900 text-white'
                      }`}
                    >
                      <span>{copiedVendorText ? 'Copied to Clipboard!' : 'Copy Vendor Trip Details'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleWhatsAppVendor}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* Preformatted Text Preview Box */}
                <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg whitespace-pre-wrap leading-relaxed overflow-x-auto border border-slate-800 select-all">
                  {buildVendorTripDetails()}
                </pre>
              </div>
            </div>

            {/* Audit Log Trail */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                Audit Trail ({auditLogs.length})
              </h4>
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="p-2.5 rounded-lg border border-slate-200 bg-white text-xs">
                    <div className="flex justify-between items-center text-slate-500 text-[10px]">
                      <span className="font-bold text-slate-700">{log.action}</span>
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    {log.reason && <p className="text-slate-600 mt-1">{log.reason}</p>}
                    <p className="text-[10px] text-slate-400 mt-0.5">Actor: {log.actorUser?.fullName || log.actorUserId}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Record Customer Balance Payment Modal */}
      {showRecordPaymentModal && booking && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowRecordPaymentModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <IconPayments className="w-5 h-5 text-amber-400" />
                  <span>Record Customer Balance Payment</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Booking #{booking.humanReadableRef} • {booking.customer?.user?.fullName || 'Customer'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordPaymentModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-amber-800 font-bold block">Balance Fare Due:</span>
                  <span className="text-2xl font-black text-amber-950 font-mono">₹{Number(booking.balanceAmount).toLocaleString('en-IN')}</span>
                </div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 rounded-md font-bold text-[11px] uppercase tracking-wider">
                  Pay Later
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Collection Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordPaymentMethod('UPI_QR')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold text-center transition ${
                      recordPaymentMethod === 'UPI_QR'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Admin UPI QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordPaymentMethod('CASH')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold text-center transition ${
                      recordPaymentMethod === 'CASH'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Direct Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordPaymentMethod('NET_BANKING')}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold text-center transition ${
                      recordPaymentMethod === 'NET_BANKING'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Net Banking
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Transaction / UTR Reference
                </label>
                <input
                  type="text"
                  value={recordPaymentTxnRef}
                  onChange={(e) => setRecordPaymentTxnRef(e.target.value)}
                  placeholder="e.g. UPI Ref / Bank UTR / Receipt No."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reconciliation Notes
                </label>
                <input
                  type="text"
                  value={recordPaymentNotes}
                  onChange={(e) => setRecordPaymentNotes(e.target.value)}
                  placeholder="e.g. Paid by passenger to Admin QR at office"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRecordPaymentModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={recordingPayment}
                  onClick={handleSaveRecordPayment}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
                >
                  <IconPayments className="w-4 h-4" />
                  <span>{recordingPayment ? 'Recording...' : `Confirm & Reconcile (₹${Number(booking.balanceAmount).toLocaleString('en-IN')})`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-3.5 py-3 sm:px-4 sm:py-3 border-b border-slate-800 flex items-center text-white pr-12">
              <IconImage className="w-4 h-4 text-indigo-400 shrink-0 mr-2" />
              <span className="font-bold text-xs sm:text-sm truncate">{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
                title="Close"
                aria-label="Close preview"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/60 max-h-[70vh] overflow-hidden">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Record Customer Refund Modal (From Details Drawer) */}
      {showDrawerRefundModal && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowDrawerRefundModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <IconPayments className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Process Customer Refund — {booking.humanReadableRef}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDrawerRefundModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Customer:</span>
                  <span className="font-bold text-slate-900">{booking.customer?.user?.fullName || 'Customer'}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Advance Paid:</span>
                  <span className="font-bold text-emerald-700">₹{advancePaid}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cancellation Fee:</span>
                  <span className="font-bold text-rose-700">-₹{cancellationCharge}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-900">Refund Due:</span>
                  <span className="font-black text-emerald-700 text-base">₹{refundDue}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Refund Amount to Customer (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={drawerRefundAmount}
                  onChange={(e) => setDrawerRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                  placeholder="e.g. 1506"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Refund Method
                </label>
                <select
                  value={drawerRefundMethod}
                  onChange={(e) => setDrawerRefundMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="UPI">UPI Transfer (GPay / PhonePe / Paytm)</option>
                  <option value="BANK_TRANSFER">Bank NEFT / IMPS / RTGS</option>
                  <option value="ORIGINAL_GATEWAY">Razorpay / Original Gateway</option>
                  <option value="CASH">Cash Refund</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Transaction Reference / UTR (Optional)
                </label>
                <input
                  type="text"
                  value={drawerRefundTxnRef}
                  onChange={(e) => setDrawerRefundTxnRef(e.target.value)}
                  placeholder="e.g. UPI Ref #426789123456"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reconciliation Notes (Optional)
                </label>
                <input
                  type="text"
                  value={drawerRefundNotes}
                  onChange={(e) => setDrawerRefundNotes(e.target.value)}
                  placeholder="e.g. Sent via UPI to customer's GPay number"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDrawerRefundModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={processingDrawerRefund}
                  onClick={handleDrawerProcessRefund}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <IconPayments className="w-4 h-4" />
                  <span>{processingDrawerRefund ? 'Processing...' : `Confirm Refund (₹${drawerRefundAmount || refundDue})`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
