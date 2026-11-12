'use client';

import React, { useState, useEffect } from 'react';
import { KANDY_LOGO_BASE64 } from '@kandy-cabs/shared';

function formatOrdinalDate(d: Date): string {
  const day = d.getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();

  let suffix = 'th';
  if (day === 1 || day === 21 || day === 31) suffix = 'st';
  else if (day === 2 || day === 22) suffix = 'nd';
  else if (day === 3 || day === 23) suffix = 'rd';

  return `${day}${suffix} ${month} ${year}`;
}

function formatPickupTimeRange(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;

  const endDate = new Date(date.getTime() + 30 * 60 * 1000);
  const endHours = endDate.getHours();
  const endMinutes = endDate.getMinutes();
  const endAmpm = endHours >= 12 ? 'PM' : 'AM';
  const endH12 = endHours % 12 || 12;
  const endMStr = endMinutes < 10 ? `0${endMinutes}` : `${endMinutes}`;

  return `Between ${h12}:${mStr} ${ampm} and ${endH12}:${endMStr} ${endAmpm}`;
}

function extractCityOrArea(address?: string | null): string {
  if (!address) return '';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (/bengaluru|bangalore|mangaluru|mangalore|mysuru|mysore|udupi|manipal|coorg|madikeri|goa|hubballi|belagavi|bantwal|puttur|hassan|chikmagalur|kasaragod|kannur|shivamogga/i.test(part)) {
      return part.replace(/\s*–.*$/, '').trim();
    }
  }
  return parts.length > 2 ? parts[parts.length - 2] : parts[0];
}

function numberToWordsINR(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Rupees Zero Only.';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(num: number): string {
    if (num === 0) return '';
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : '');
    if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' and ' + inWords(num % 100) : '');
    if (num < 100000) return inWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + inWords(num % 1000) : '');
    if (num < 10000000) return inWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + inWords(num % 100000) : '');
    return inWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 !== 0 ? ' ' + inWords(num % 10000000) : '');
  }

  const rounded = Math.round(amount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  let result = 'Rupees ' + inWords(rupees).trim();
  if (paise > 0) {
    result += ' and ' + inWords(paise).trim() + ' Paise';
  }
  return result.trim() + ' Only.';
}

function normalizeInvoiceData(raw: any): any {
  if (!raw) return null;

  const booking = raw.booking || {};
  const customer = raw.customer || {};
  const financials = raw.financials || {};
  const tripDetails = raw.tripDetails || {};

  // 1. Invoice Number Formatting (Must follow KC-2026-XXXX format)
  const rawRef = (raw.invoiceNumber || booking.ref || booking.humanReadableRef || '').trim();
  let invoiceNumber = '';
  if (/^KC-2026-\d+/i.test(rawRef)) {
    invoiceNumber = rawRef.toUpperCase();
  } else if (/^KC-\d+/i.test(rawRef)) {
    invoiceNumber = `KC-2026-${rawRef.substring(3)}`;
  } else if (/^\d{4,8}$/.test(rawRef)) {
    invoiceNumber = `KC-2026-${rawRef}`;
  } else if (rawRef.startsWith('INV-')) {
    const stripped = rawRef.replace(/^INV-/, '');
    invoiceNumber = stripped.startsWith('2026-') ? `KC-${stripped}` : `KC-2026-${stripped}`;
  } else if (rawRef) {
    const clean = rawRef.replace(/^KC-?/i, '');
    invoiceNumber = clean.startsWith('2026-') ? `KC-${clean}` : `KC-2026-${clean}`;
  } else {
    invoiceNumber = `KC-2026-${Date.now().toString().slice(-6)}`;
  }

  // 2. Dates
  const dateStr = raw.invoiceDate || booking.scheduledAt || booking.createdAt || new Date().toISOString();
  const dateObj = new Date(dateStr);
  const invoiceDateFormatted = raw.invoiceDateFormatted || (!isNaN(dateObj.getTime()) ? formatOrdinalDate(dateObj) : '9th November 2026');

  // 3. Customer Info
  const custName = customer.name || booking.customerName || 'Customer';
  const customerName = custName.startsWith('Mr.') || custName.startsWith('Ms.') || custName.startsWith('Dr.') ? custName : `Mr. ${custName}`;
  const pickupAddress = customer.pickupAddress || booking.actualPickupAddress || booking.pickupAddress || 'Address on file';

  // 4. Trip Type & Route
  const tripTypeKey = String(tripDetails.tripType || booking.tripType || 'ONEWAY').toUpperCase();
  const distanceKm = Math.round(Number(tripDetails.kmLimit || booking.distanceKm || booking.actualDistanceKm || 100));

  let tripType = tripDetails.tripType || '';
  if (!tripType) {
    if (tripTypeKey.includes('ROUND')) {
      tripType = '1 Day Round Trip (Same-Day Return)';
    } else if (tripTypeKey.includes('LOCAL') || tripTypeKey.includes('PACKAGE')) {
      tripType = `Local Rental Package (8 Hrs / ${distanceKm} Km)`;
    } else if (tripTypeKey.includes('AIRPORT')) {
      tripType = 'Airport Transfer Service';
    } else if (tripTypeKey.includes('CORP')) {
      tripType = 'Corporate Dedicated Commute';
    } else {
      tripType = 'One Way Drop (Outstation)';
    }
  }

  let route = tripDetails.route || '';
  if (!route) {
    const origin = extractCityOrArea(booking.pickupAddress || booking.actualPickupAddress) || 'Mangaluru';
    const dest = extractCityOrArea(booking.dropAddress || booking.actualDropAddress) || 'Shivamogga Airport (RQY)';
    if (tripTypeKey.includes('ROUND')) {
      route = `${origin} ↔ ${dest} ↔ ${origin}`;
    } else if (tripTypeKey.includes('LOCAL') || tripTypeKey.includes('PACKAGE')) {
      route = `${origin} City / Local Rental Package`;
    } else if (tripTypeKey.includes('AIRPORT')) {
      route = `${origin} → Airport Drop (${dest})`;
    } else {
      route = `${origin} → ${dest}`;
    }
  }

  const passengers = tripDetails.passengers || `${booking.passengers || 4} Passengers • Normal Luggage`;
  const pickupTime = tripDetails.pickupTime || (!isNaN(dateObj.getTime()) ? formatPickupTimeRange(dateObj) : 'Between 8:00 AM and 8:30 AM');

  let kmLimit = tripDetails.kmLimit || '';
  if (!kmLimit) {
    if (tripTypeKey.includes('ROUND')) {
      kmLimit = `${distanceKm} Km Total (1 Day Allowance)`;
    } else if (tripTypeKey.includes('LOCAL') || tripTypeKey.includes('PACKAGE')) {
      kmLimit = `${distanceKm} Km Limit (8 Hrs Package)`;
    } else {
      kmLimit = `${distanceKm} Kilometres Limit`;
    }
  }

  // 5. Financials
  const grandTotal = Number(financials.grandTotal || financials.totalFare || 0);
  const taxableValue = Number(financials.taxableValue || financials.preTaxSubtotal || (grandTotal ? Math.round((grandTotal / 1.05) * 100) / 100 : 0));
  const gstTotal = Number(financials.gstTotal || (grandTotal - taxableValue));
  const cgst = Number(financials.cgst || (gstTotal ? Math.round((gstTotal / 2) * 100) / 100 : 0));
  const sgst = Number(financials.sgst || (gstTotal - cgst));
  const chauffeurAllowance = Number(financials.chauffeurAllowance || booking.driverAllowance || 0);
  const serviceAmount = Number(financials.serviceAmount || (taxableValue - chauffeurAllowance > 0 ? taxableValue - chauffeurAllowance : taxableValue));

  const vehicleName = booking.vehicle?.model || booking.driver?.vehicle || 'AC Commercial Cab';
  let serviceDescription = financials.serviceDescription || '';
  if (!serviceDescription) {
    if (tripTypeKey.includes('ROUND')) {
      serviceDescription = `Outstation Round Trip (1 Day - ${distanceKm} Km Limit) - ${vehicleName}`;
    } else if (tripTypeKey.includes('LOCAL') || tripTypeKey.includes('PACKAGE')) {
      serviceDescription = `Local City Cab Rental (8 Hrs / ${distanceKm} Km Limit) - ${vehicleName}`;
    } else if (tripTypeKey.includes('AIRPORT')) {
      serviceDescription = `Dedicated Airport Transfer Service (${distanceKm} Km Limit) - ${vehicleName}`;
    } else {
      serviceDescription = `Outstation One Way Drop Service (${distanceKm} Km Limit) - ${vehicleName}`;
    }
  }

  const advancePaid = Number(financials.advancePaid || booking.advanceAmount || 0);
  const advanceStatus = financials.advanceStatus || booking.advancePaymentStatus || 'PAID';
  const balanceDue = Number(financials.balanceDue || booking.balanceAmount || 0);
  const balanceStatus = financials.balanceStatus || booking.balancePaymentStatus || 'PAID';

  let remarks = raw.remarks || '';
  if (!remarks) {
    if (tripTypeKey.includes('ROUND')) {
      remarks = `Toll charges, state border permits, parking fees, additional kilometres beyond ${distanceKm} Km limit, and chauffeur night allowance are charged extra as applicable.`;
    } else if (tripTypeKey.includes('LOCAL') || tripTypeKey.includes('PACKAGE')) {
      remarks = `Toll charges, parking fees, additional hours beyond 8 hours, and extra kilometres beyond ${distanceKm} Km package limit are charged extra as per standard tariff.`;
    } else if (tripTypeKey.includes('AIRPORT')) {
      remarks = `Airport entry/parking fees and toll charges are charged extra as per actual receipts. Safe luggage assistance included.`;
    } else {
      remarks = `Toll and parking charges, additional kilometres beyond the ${distanceKm} Km limit, and applicable chauffeur night allowance are not included in this invoice amount and will be charged extra as applicable.`;
    }
  }

  const amountInWords = raw.amountInWords || numberToWordsINR(grandTotal);

  // Duration / Number of days
  const durationDays = Number(raw.durationDays || booking.durationDays || (tripTypeKey.includes('ROUND') ? 1 : 1));
  let numberOfDays = tripDetails.numberOfDays || '';
  if (!numberOfDays) {
    if (tripTypeKey.includes('ROUND')) {
      numberOfDays = durationDays > 1 ? `${durationDays} Days` : '1 Day (Same-Day Return)';
    } else if (tripTypeKey.includes('LOCAL') || tripTypeKey.includes('PACKAGE')) {
      const hrs = Number(raw.localHours || booking.localHours || 8);
      numberOfDays = `${hrs} Hours Package`;
    } else if (tripTypeKey.includes('CORP')) {
      const days = raw.corporateTotalDays || booking.corporateTotalDays || '1';
      numberOfDays = `${days} Day${days !== '1' ? 's' : ''}`;
    } else {
      numberOfDays = '1 Day (Point-to-Point)';
    }
  }

  // Toll & Parking and additional fares
  const tollAmount = Number(financials.tollAmount || booking.tollAmount || 0);
  const parkingAmount = Number(financials.parkingAmount || booking.parkingAmount || 0);
  const chauffeurNightAllowance = Number(financials.chauffeurNightAllowance || booking.nightAllowance || 0);
  const petFee = Number(financials.petFee || booking.petFee || 0);
  const extraKmAmount = Number(financials.extraKmAmount || booking.extraKmAmount || 0);

  let tollParkingStatus = tripDetails.tollParkingStatus || '';
  if (!tollParkingStatus) {
    if (tollAmount > 0 && parkingAmount > 0) {
      tollParkingStatus = `Included (Toll: ₹${tollAmount} + Parking: ₹${parkingAmount})`;
    } else if (tollAmount > 0) {
      tollParkingStatus = `Included (Toll: ₹${tollAmount})`;
    } else if (parkingAmount > 0) {
      tollParkingStatus = `Included (Parking: ₹${parkingAmount})`;
    } else if (raw.tollsIncluded || booking.tollsIncluded) {
      tollParkingStatus = 'Included in Fare';
    } else {
      tollParkingStatus = 'Excluded (Payable Extra at Actuals)';
    }
  }

  return {
    invoiceNumber,
    invoiceDateFormatted,
    placeOfSupply: raw.placeOfSupply || 'Karnataka',
    supplyType: raw.supplyType || 'Passenger Transportation Service',
    bookingRef: invoiceNumber,
    customer: {
      name: customerName,
      phone: customer.phone || booking.customerPhone || '',
      pickupAddress: pickupAddress,
      email: customer.email || null,
    },
    tripDetails: {
      travelDate: tripDetails.travelDate || invoiceDateFormatted,
      tripType,
      numberOfDays,
      route,
      passengers,
      pickupTime,
      kmLimit,
      tollParkingStatus,
    },
    financials: {
      serviceDescription,
      serviceAmount,
      chauffeurAllowance,
      chauffeurNightAllowance,
      taxableValue,
      cgst,
      sgst,
      gstTotal,
      grandTotal,
      tollAmount,
      parkingAmount,
      petFee,
      extraKmAmount,
      advancePaid,
      advanceStatus,
      balanceDue,
      balanceStatus,
    },
    amountInWords,
    remarks,
    company: raw.company || {
      name: 'KANDY CABS',
      tagline: 'Safe | Reliable | Hassle-Free',
      addressLine1: '#708, 7th Floor, Inland Impala, Vidyaranyanagar,',
      addressLine2: 'Mangaluru, Karnataka – 575020',
      gstin: '29AIEPR4688P1Z4',
      website: 'www.kandycabs.in',
      email: 'kandycabsmlr@gmail.com',
    },
  };
}

interface TaxInvoiceModalProps {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaxInvoiceModal({
  bookingId,
  isOpen,
  onClose,
}: TaxInvoiceModalProps) {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && bookingId) {
      setLoading(true);
      setError('');
      fetch(`/api/customer/bookings/${bookingId}/invoice`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.invoice) {
            setInvoice(normalizeInvoiceData(data.invoice));
          } else {
            setError(data.message || 'Failed to load invoice');
          }
        })
        .catch(() => setError('Failed to load invoice'))
        .finally(() => setLoading(false));
    } else {
      setInvoice(null);
    }
  }, [isOpen, bookingId]);

  if (!isOpen || !bookingId) return null;

  const handlePrint = () => {
    window.open(`/api/customer/bookings/${bookingId}/invoice?format=html&print=true`, '_blank');
  };

  const handleDownload = () => {
    window.open(`/api/customer/bookings/${bookingId}/invoice?format=html&download=1&attachment=1`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-xs text-slate-800">
      {/* Top Floating Control Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#f74a01] text-white font-black text-xs shadow-xs">
            KC
          </span>
          <div>
            <h2 className="text-sm font-black text-slate-900 leading-tight">
              Official Tax Invoice
            </h2>
            <p className="text-[10px] text-slate-500 font-mono">
              {invoice?.invoiceNumber || 'Kandy Cabs'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f74a01] hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
          >
            🖨️ Save as PDF / Print
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
          >
            ⬇️ Download HTML
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable Modal Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-100">
        {loading ? (
          <div className="py-24 text-center text-sm font-semibold text-slate-500">
            Generating official tax invoice...
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-red-600 max-w-md mx-auto bg-white p-6 rounded-xl shadow-xs">
            {error}
          </div>
        ) : invoice ? (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200/80 p-8 sm:p-10 font-sans text-slate-800">
            {/* Header: Logo and Company Info */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-200 gap-4">
              <div className="shrink-0 flex items-center">
                <img
                  src={KANDY_LOGO_BASE64}
                  alt="Kandy Cabs"
                  className="w-[110px] h-auto object-contain"
                />
              </div>

              <div className="text-right">
                <h1 className="text-2xl font-black text-[#162232] tracking-tight">KANDY CABS</h1>
                <p className="text-xs font-bold text-slate-600">Safe | Reliable | Hassle-Free</p>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  #708, 7th Floor, Inland Impala, Vidyaranyanagar,<br />
                  Mangaluru, Karnataka – 575020
                </p>
                <p className="text-xs font-black text-[#162232] mt-1">
                  GSTIN: 29AIEPR4688P1Z4
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Website: www.kandycabs.in &nbsp;|&nbsp; Email: kandycabsmlr@gmail.com
                </p>
              </div>
            </div>

            {/* Dark Navy Banner */}
            <div className="bg-[#162232] text-white text-center font-black py-2 tracking-[2.5px] uppercase text-sm rounded-xs my-3">
              TAX INVOICE
            </div>

            {/* Table 1: Invoice Meta */}
            <table className="w-full border-collapse border border-slate-200 text-xs mb-3">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 w-1/4 border-r border-slate-200">Invoice No.</td>
                  <td className="p-2 font-bold text-[#162232] w-1/4 border-r border-slate-200">{invoice.invoiceNumber}</td>
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 w-1/4 border-r border-slate-200">Invoice Date</td>
                  <td className="p-2 text-slate-800 w-1/4">{invoice.invoiceDateFormatted}</td>
                </tr>
                <tr>
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 border-r border-slate-200">Place of Supply</td>
                  <td className="p-2 text-slate-800 border-r border-slate-200">{invoice.placeOfSupply}</td>
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 border-r border-slate-200">Supply Type</td>
                  <td className="p-2 text-slate-800">{invoice.supplyType}</td>
                </tr>
              </tbody>
            </table>

            {/* BILL TO / CUSTOMER DETAILS */}
            <div className="text-[11px] font-black text-[#162232] uppercase tracking-wider mb-1 mt-3">
              BILL TO / CUSTOMER DETAILS
            </div>
            <table className="w-full border-collapse border border-slate-200 text-xs mb-3">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 w-1/4 border-r border-slate-200">Customer Name</td>
                  <td className="p-2 font-bold text-[#162232]" colSpan={3}>{invoice.customer.name}</td>
                </tr>
                <tr>
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 border-r border-slate-200">Pickup Address</td>
                  <td className="p-2 text-slate-800" colSpan={3}>{invoice.customer.pickupAddress}</td>
                </tr>
              </tbody>
            </table>

            {/* TRIP DETAILS */}
            <div className="text-[11px] font-black text-[#162232] uppercase tracking-wider mb-1 mt-3">
              TRIP DETAILS
            </div>
            <table className="w-full border-collapse border border-slate-200 text-xs mb-3">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 w-1/4 border-r border-slate-200">Travel Date</td>
                  <td className="p-2 text-slate-800 w-1/4 border-r border-slate-200">{invoice.tripDetails.travelDate}</td>
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 w-1/4 border-r border-slate-200">Trip Type</td>
                  <td className="p-2 text-slate-800 w-1/4">{invoice.tripDetails.tripType}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 border-r border-slate-200">No. of Days</td>
                  <td className="p-2 font-bold text-[#162232] border-r border-slate-200">{invoice.tripDetails.numberOfDays || '1 Day'}</td>
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 border-r border-slate-200">KM Limit</td>
                  <td className="p-2 font-bold text-[#162232]">{invoice.tripDetails.kmLimit}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 border-r border-slate-200">Route</td>
                  <td className="p-2 font-bold text-[#162232] border-r border-slate-200">{invoice.tripDetails.route}</td>
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 border-r border-slate-200">Passengers</td>
                  <td className="p-2 text-slate-800">{invoice.tripDetails.passengers}</td>
                </tr>
                <tr>
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 border-r border-slate-200">Pickup Time</td>
                  <td className="p-2 text-slate-800 border-r border-slate-200">{invoice.tripDetails.pickupTime}</td>
                  <td className="bg-slate-50 p-2 font-bold text-slate-700 border-r border-slate-200">Toll & Parking</td>
                  <td className="p-2 text-slate-800">{invoice.tripDetails.tollParkingStatus || 'Excluded (Payable at Actuals)'}</td>
                </tr>
              </tbody>
            </table>

            {/* INVOICE PARTICULARS */}
            <div className="text-[11px] font-black text-[#162232] uppercase tracking-wider mb-1 mt-3">
              INVOICE PARTICULARS
            </div>
            <table className="w-full border-collapse border border-slate-200 text-xs mb-2">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-2 text-left font-black text-slate-700">Description of Service</th>
                  <th className="p-2 text-right font-black text-slate-700 w-1/4">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="p-2 text-slate-800">{invoice.financials.serviceDescription}</td>
                  <td className="p-2 text-right font-mono font-semibold text-slate-800">₹{invoice.financials.serviceAmount.toFixed(2)}</td>
                </tr>
                {invoice.financials.chauffeurAllowance > 0 && (
                  <tr className="border-b border-slate-100">
                    <td className="p-2 text-slate-800">Chauffeur Day Allowance</td>
                    <td className="p-2 text-right font-mono font-semibold text-slate-800">₹{invoice.financials.chauffeurAllowance.toFixed(2)}</td>
                  </tr>
                )}
                {invoice.financials.chauffeurNightAllowance > 0 && (
                  <tr className="border-b border-slate-100">
                    <td className="p-2 text-slate-800">Chauffeur Night Stay Allowance</td>
                    <td className="p-2 text-right font-mono font-semibold text-slate-800">₹{invoice.financials.chauffeurNightAllowance.toFixed(2)}</td>
                  </tr>
                )}
                {invoice.financials.tollAmount > 0 && (
                  <tr className="border-b border-slate-100">
                    <td className="p-2 text-slate-800">Highway Toll Charges (FASTag)</td>
                    <td className="p-2 text-right font-mono font-semibold text-slate-800">₹{invoice.financials.tollAmount.toFixed(2)}</td>
                  </tr>
                )}
                {invoice.financials.parkingAmount > 0 && (
                  <tr className="border-b border-slate-100">
                    <td className="p-2 text-slate-800">Airport & Parking Charges</td>
                    <td className="p-2 text-right font-mono font-semibold text-slate-800">₹{invoice.financials.parkingAmount.toFixed(2)}</td>
                  </tr>
                )}
                {invoice.financials.petFee > 0 && (
                  <tr className="border-b border-slate-100">
                    <td className="p-2 text-slate-800">Pet Friendly Sanitization Fee</td>
                    <td className="p-2 text-right font-mono font-semibold text-slate-800">₹{invoice.financials.petFee.toFixed(2)}</td>
                  </tr>
                )}
                {invoice.financials.extraKmAmount > 0 && (
                  <tr className="border-b border-slate-100">
                    <td className="p-2 text-slate-800">Additional Distance Charges</td>
                    <td className="p-2 text-right font-mono font-semibold text-slate-800">₹{invoice.financials.extraKmAmount.toFixed(2)}</td>
                  </tr>
                )}
                {/* Taxable Value Peach Row */}
                <tr className="bg-[#fff7ed] border-y-2 border-orange-200 font-bold">
                  <td className="p-2 text-[#162232]">Taxable Value</td>
                  <td className="p-2 text-right font-mono font-bold text-[#162232]">₹{invoice.financials.taxableValue.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-2 text-slate-700">CGST @ 2.5%</td>
                  <td className="p-2 text-right font-mono text-slate-800">₹{invoice.financials.cgst.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 text-slate-700">SGST @ 2.5%</td>
                  <td className="p-2 text-right font-mono text-slate-800">₹{invoice.financials.sgst.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Vibrant Orange Grand Total Banner */}
            <div className="bg-[#f74a01] text-white px-4 py-2.5 rounded-xs flex justify-between items-center my-2 shadow-xs">
              <span className="font-black text-xs uppercase tracking-wider">GRAND TOTAL (INCLUDING GST)</span>
              <span className="font-black text-base font-mono">₹{invoice.financials.grandTotal.toFixed(2)}</span>
            </div>

            {/* Amount in words */}
            <div className="text-[11px] text-slate-700 my-2">
              Amount in Words: <strong className="font-bold text-[#162232]">{invoice.amountInWords}</strong>
            </div>

            {/* REMARKS / PAYMENT DETAILS */}
            <div className="mt-4 pt-2 border-t border-slate-100">
              <div className="text-[11px] font-black text-[#162232] uppercase tracking-wider mb-1">
                REMARKS / PAYMENT DETAILS
              </div>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                {invoice.remarks}
              </p>
              <div className="mt-2 inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px]">
                <span className="text-slate-600">Advance Paid: <strong>₹{invoice.financials.advancePaid.toFixed(2)} ({invoice.financials.advanceStatus})</strong></span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600">Balance: <strong>₹{invoice.financials.balanceDue.toFixed(2)} ({invoice.financials.balanceStatus})</strong></span>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 pt-3 text-center">
              <h3 className="text-xs font-black text-[#162232]">
                Thank you for choosing {invoice.company.name}
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {invoice.company.tagline} • {invoice.company.website} • {invoice.company.email}
              </p>
              <p className="text-[9px] text-slate-400 text-right mt-1">
                {invoice.company.name} | GSTIN: {invoice.company.gstin}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
