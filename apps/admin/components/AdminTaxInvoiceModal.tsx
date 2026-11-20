'use client';

import React, { useState, useEffect, useRef } from 'react';
import { KANDY_LOGO_BASE64 } from '@kandy-cabs/shared';

interface AdminTaxInvoiceModalProps {
  booking: any | null;
  isOpen: boolean;
  onClose: () => void;
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

export function AdminTaxInvoiceModal({
  booking,
  isOpen,
  onClose,
}: AdminTaxInvoiceModalProps) {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  const bookingId = booking?.id || booking?.humanReadableRef;

  useEffect(() => {
    if (!isOpen || !bookingId) {
      setInvoice(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    fetch(`/api/customer/bookings/${bookingId}/invoice`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success && data.invoice) {
          setInvoice(data.invoice);
        } else if (booking) {
          // Construct fallback invoice representation from booking object
          const rawRef = (booking.humanReadableRef || booking.ref || booking.id || '').toUpperCase();
          const invoiceNum = rawRef.startsWith('KC-') ? rawRef : `KC-2026-${rawRef.slice(-6)}`;
          const d = new Date(booking.scheduledAt || booking.createdAt || Date.now());
          const grandTotal = Number(booking.estimatedFare || booking.finalFare || 0);
          const taxable = Math.round((grandTotal / 1.05) * 100) / 100;
          const gst = grandTotal - taxable;
          const halfGst = Math.round((gst / 2) * 100) / 100;

          setInvoice({
            invoiceNumber: invoiceNum,
            invoiceDateFormatted: formatOrdinalDate(d),
            placeOfSupply: 'Karnataka',
            supplyType: 'Passenger Transportation Service',
            bookingRef: invoiceNum,
            bookingStatus: booking.status || 'CONFIRMED',
            customer: {
              name: booking.customerName?.startsWith('Mr.') ? booking.customerName : `Mr. ${booking.customerName || 'Customer'}`,
              phone: booking.customerPhone || '',
              pickupAddress: booking.actualPickupAddress || booking.pickupAddress || 'Address on file',
            },
            tripDetails: {
              travelDate: formatOrdinalDate(d),
              tripType: booking.tripType || 'ONEWAY',
              numberOfDays: '1 Day',
              route: `${booking.pickupAddress?.split(',')[0] || 'Origin'} → ${booking.dropAddress?.split(',')[0] || 'Destination'}`,
              passengers: `${booking.passengers || 4} Passengers • AC Commercial Cab`,
              pickupTime: 'Pickup Scheduled as per booking',
              kmLimit: `${Math.round(Number(booking.distanceKm || 100))} Km Limit`,
              tollParkingStatus: booking.tollAmount > 0 || booking.parkingAmount > 0 ? `Included (Toll: ₹${booking.tollAmount || 0} + Parking: ₹${booking.parkingAmount || 0})` : 'Excluded (Payable Extra at Actuals)',
            },
            financials: {
              serviceDescription: `Outstation Cab Service (${Math.round(Number(booking.distanceKm || 100))} Km Limit) - ${booking.vehicleModel || 'AC Commercial Cab'}`,
              serviceAmount: taxable - (Number(booking.driverAllowance || 0)),
              chauffeurAllowance: Number(booking.driverAllowance || 0),
              taxableValue: taxable,
              cgst: halfGst,
              sgst: gst - halfGst,
              gstTotal: gst,
              grandTotal: grandTotal,
              advancePaid: Number(booking.advanceAmount || 0),
              advanceStatus: booking.advancePaymentStatus || 'PAID',
              balanceDue: Number(booking.balanceAmount || 0),
              balanceStatus: booking.balancePaymentStatus || 'PENDING',
            },
            amountInWords: numberToWordsINR(grandTotal),
            remarks: 'Toll charges, state border permits, parking fees, additional kilometres beyond the limit, and chauffeur night allowance are charged extra as applicable.',
            company: {
              name: 'KANDY CABS',
              tagline: 'Safe | Reliable | Hassle-Free',
              addressLine1: '#708, 7th Floor, Inland Impala, Vidyaranyanagar,',
              addressLine2: 'Mangaluru, Karnataka – 575020',
              gstin: '29AIEPR4688P1Z4',
              website: 'www.kandycabs.in',
              email: 'kandycabsmlr@gmail.com',
            },
          });
        } else {
          setError(data?.message || 'Failed to load official tax invoice.');
        }
      })
      .catch((err) => {
        console.error('Error loading tax invoice:', err);
        setError('Error loading tax invoice data.');
      })
      .finally(() => setLoading(false));
  }, [isOpen, bookingId, booking]);

  if (!isOpen) return null;

  const invoiceUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/customer/bookings/${bookingId}/invoice?format=html`
    : `/api/customer/bookings/${bookingId}/invoice?format=html`;

  const webReceiptUrl = typeof window !== 'undefined'
    ? `${window.location.origin.replace(':3001', ':3000')}/pay/${booking?.humanReadableRef || invoice?.invoiceNumber || bookingId}`
    : `http://localhost:3000/pay/${booking?.humanReadableRef || bookingId}`;

  // View / Print PDF via dedicated window or print iframe
  const handlePrintPdf = () => {
    if (printIframeRef.current) {
      printIframeRef.current.src = `${invoiceUrl}&print=true`;
    } else {
      const printWin = window.open(`${invoiceUrl}&print=true`, '_blank');
      if (printWin) printWin.focus();
    }
  };

  // Download PDF invoice
  const handleDownloadPdf = () => {
    const downloadUrl = `/api/customer/bookings/${bookingId}/invoice?format=pdf&download=1`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `Kandy_Cabs_Tax_Invoice_${invoice?.invoiceNumber || bookingId}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(webReceiptUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-slate-100 rounded-2xl shadow-2xl border border-slate-300 flex flex-col max-h-[94vh] overflow-hidden my-auto">
        {/* Hidden Iframe for Direct PDF Printing */}
        <iframe ref={printIframeRef} className="hidden" title="Invoice Print Frame" />

        {/* Modal Header Control Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#162232] text-white flex items-center justify-between shadow-md shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-black text-xs text-white shadow-xs">
              KC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  Official Tax Invoice
                </h3>
                {invoice?.invoiceNumber && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40">
                    {invoice.invoiceNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                Kandy Cabs Pvt Ltd • Customer App Invoice View
              </p>
            </div>
          </div>

          {/* Action Buttons Top Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* View / Print PDF */}
            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={loading || !invoice}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
              title="Open Printable View / Save as PDF"
            >
              <span>🖨️</span>
              <span className="hidden sm:inline">View / Print PDF</span>
            </button>

            {/* Download PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={loading || !invoice}
              className="px-2.5 sm:px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              title="Download Tax Invoice File (PDF/HTML)"
            >
              <span>⬇️</span>
              <span className="hidden sm:inline">Download PDF</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-700/80 hover:bg-rose-600 hover:text-white text-slate-300 flex items-center justify-center transition cursor-pointer text-sm font-bold ml-1"
              title="Close Modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body / Scrollable Invoice Sheet */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/80">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-3">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-bold tracking-tight">Generating official tax invoice...</p>
            </div>
          ) : error ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center max-w-md mx-auto my-12 text-rose-800">
              <p className="font-bold text-sm mb-2">⚠️ {error}</p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition"
              >
                Close
              </button>
            </div>
          ) : invoice ? (
            <div className="max-w-[780px] mx-auto bg-white rounded-xl shadow-xl border border-slate-300 p-6 sm:p-9 text-[#162232] font-sans">
              {/* 1. Header: Logo & Company Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-100">
                <div className="flex flex-col items-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={KANDY_LOGO_BASE64}
                    alt="Kandy Cabs"
                    className="w-32 h-auto object-contain mb-1"
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Safe • Reliable • Hassle-Free
                  </span>
                </div>

                <div className="text-left sm:text-right text-[11px] text-slate-600 leading-snug">
                  <h4 className="text-base font-black text-[#162232] tracking-tight">
                    {invoice.company?.name || 'KANDY CABS'}
                  </h4>
                  <p className="font-semibold text-slate-700">{invoice.company?.tagline || 'Safe | Reliable | Hassle-Free'}</p>
                  <p>{invoice.company?.addressLine1 || '#708, 7th Floor, Inland Impala, Vidyaranyanagar,'}</p>
                  <p>{invoice.company?.addressLine2 || 'Mangaluru, Karnataka – 575020'}</p>
                  <p className="font-extrabold text-[#162232] mt-0.5">
                    GSTIN: {invoice.company?.gstin || '29AIEPR4688P1Z4'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {invoice.company?.website || 'www.kandycabs.in'} • {invoice.company?.email || 'kandycabsmlr@gmail.com'}
                  </p>
                </div>
              </div>

              {/* 2. Navy TAX INVOICE Banner */}
              <div
                className={`w-full py-2 px-3 text-center text-xs font-black tracking-widest text-white uppercase rounded-xs my-3.5 shadow-xs ${
                  invoice.cancellation?.isCancelled ? 'bg-rose-700' : 'bg-[#162232]'
                }`}
              >
                {invoice.cancellation?.isCancelled
                  ? 'TAX INVOICE / CANCELLATION VOUCHER (CANCELLED)'
                  : 'TAX INVOICE'}
              </div>

              {/* Cancellation & Refund Alert Card if trip was cancelled */}
              {invoice.cancellation?.isCancelled && (
                <div className="mb-4 p-3.5 bg-rose-50/80 border border-rose-300 rounded-lg text-xs">
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-rose-200">
                    <span className="font-black text-rose-800 uppercase tracking-wider">
                      ⚠️ Cancellation Charges & Refund Breakdown
                    </span>
                    <span className="px-2 py-0.5 bg-rose-700 text-white font-bold rounded-sm text-[10px]">
                      Trip Cancelled
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-slate-700">
                    <span>Total Advance Paid:</span>
                    <span className="text-right font-bold text-slate-900">
                      ₹{(invoice.cancellation.advancePaid ?? invoice.financials?.advancePaid ?? 0).toFixed(2)}
                    </span>
                    <span className="text-rose-700 font-semibold">Applicable Cancellation Charge:</span>
                    <span className="text-right font-bold text-rose-700">
                      - ₹{(invoice.cancellation.cancellationCharge ?? 0).toFixed(2)}
                    </span>
                    <span className="text-emerald-800 font-extrabold text-sm pt-1 border-t border-rose-200">
                      Excess Refund Due:
                    </span>
                    <span className="text-right font-black text-emerald-800 text-sm pt-1 border-t border-rose-200">
                      ₹{(invoice.cancellation.refundAmount ?? 0).toFixed(2)}
                    </span>
                    <span>Refund Status:</span>
                    <span className="text-right font-bold text-blue-700">
                      {invoice.cancellation.refundStatus || 'Processing Refund'}
                    </span>
                  </div>
                  {invoice.cancellation.reason && (
                    <p className="text-[10px] text-slate-500 mt-2 italic">
                      Reason: {invoice.cancellation.reason}
                    </p>
                  )}
                </div>
              )}

              {/* 3. Table 1: Invoice Meta */}
              <div className="border border-slate-200 rounded-md overflow-hidden text-xs mb-3.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-200 bg-slate-50">
                  <div className="p-2 sm:p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Invoice No.</span>
                    <span className="font-extrabold text-[#162232]">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="p-2 sm:p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Invoice Date</span>
                    <span className="font-semibold text-slate-800">{invoice.invoiceDateFormatted}</span>
                  </div>
                  <div className="p-2 sm:p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Place of Supply</span>
                    <span className="font-semibold text-slate-800">{invoice.placeOfSupply || 'Karnataka'}</span>
                  </div>
                  <div className="p-2 sm:p-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Supply Type</span>
                    <span className="font-semibold text-slate-800">{invoice.supplyType || 'Passenger Transportation'}</span>
                  </div>
                </div>
              </div>

              {/* 4. Table 2: Customer Details */}
              <div className="text-[10.5px] font-black uppercase text-[#162232] tracking-wider mb-1 px-0.5">
                Bill To / Customer Details
              </div>
              <div className="border border-slate-200 rounded-md overflow-hidden text-xs mb-3.5 bg-slate-50 p-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Customer Name</span>
                    <span className="font-extrabold text-[#162232] text-sm">
                      {invoice.customer?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Contact Phone</span>
                    <span className="font-semibold text-slate-800">
                      {invoice.customer?.phone || 'On file'}
                    </span>
                  </div>
                  <div className="sm:col-span-3 pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Pickup Address</span>
                    <span className="font-medium text-slate-700">
                      {invoice.customer?.pickupAddress}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Table 3: Trip Details */}
              <div className="text-[10.5px] font-black uppercase text-[#162232] tracking-wider mb-1 px-0.5">
                Trip Details
              </div>
              <div className="border border-slate-200 rounded-md overflow-hidden text-xs mb-3.5 divide-y divide-slate-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200 bg-white">
                  <div className="p-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Date of Journey</span>
                    <span className="font-semibold text-slate-800">{invoice.tripDetails?.travelDate}</span>
                  </div>
                  <div className="p-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Trip Type</span>
                    <span className="font-bold text-[#162232]">{invoice.tripDetails?.tripType}</span>
                  </div>
                  <div className="p-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">No. of Days</span>
                    <span className="font-semibold text-slate-800">{invoice.tripDetails?.numberOfDays || '1 Day'}</span>
                  </div>
                  <div className="p-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">KM Limit</span>
                    <span className="font-bold text-orange-600">{invoice.tripDetails?.kmLimit}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/50">
                  <div className="p-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Route</span>
                    <span className="font-extrabold text-[#162232]">{invoice.tripDetails?.route}</span>
                  </div>
                  <div className="p-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Passengers & Luggage</span>
                    <span className="font-medium text-slate-700">{invoice.tripDetails?.passengers}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-white">
                  <div className="p-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Pickup Time</span>
                    <span className="font-medium text-slate-700">{invoice.tripDetails?.pickupTime}</span>
                  </div>
                  <div className="p-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Toll & Parking</span>
                    <span className="font-semibold text-slate-800">{invoice.tripDetails?.tollParkingStatus}</span>
                  </div>
                </div>
              </div>

              {/* 6. Table 4: Description of Service & Financials */}
              <div className="text-[10.5px] font-black uppercase text-[#162232] tracking-wider mb-1 px-0.5">
                Invoice Particulars & Fare Breakdown
              </div>
              <div className="border border-slate-200 rounded-md overflow-hidden text-xs mb-3">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-left border-b border-slate-200 font-extrabold text-[11px] text-[#162232]">
                      <th className="p-2.5">Description of Service</th>
                      <th className="p-2.5 text-right w-36">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2.5 text-slate-800 font-medium">
                        {invoice.financials?.serviceDescription}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-slate-900">
                        ₹{invoice.financials?.serviceAmount?.toFixed(2)}
                      </td>
                    </tr>

                    {invoice.financials?.chauffeurAllowance > 0 && (
                      <tr>
                        <td className="p-2.5 text-slate-700">Chauffeur Day Allowance</td>
                        <td className="p-2.5 text-right font-semibold text-slate-900">
                          ₹{invoice.financials.chauffeurAllowance.toFixed(2)}
                        </td>
                      </tr>
                    )}

                    {invoice.financials?.chauffeurNightAllowance > 0 && (
                      <tr>
                        <td className="p-2.5 text-slate-700">Chauffeur Night Stay Allowance</td>
                        <td className="p-2.5 text-right font-semibold text-slate-900">
                          ₹{invoice.financials.chauffeurNightAllowance.toFixed(2)}
                        </td>
                      </tr>
                    )}

                    {invoice.financials?.tollAmount > 0 && (
                      <tr>
                        <td className="p-2.5 text-slate-700">Tollway Entry Charges</td>
                        <td className="p-2.5 text-right font-semibold text-slate-900">
                          ₹{invoice.financials.tollAmount.toFixed(2)}
                        </td>
                      </tr>
                    )}

                    {invoice.financials?.parkingAmount > 0 && (
                      <tr>
                        <td className="p-2.5 text-slate-700">Airport / Station Parking Fees</td>
                        <td className="p-2.5 text-right font-semibold text-slate-900">
                          ₹{invoice.financials.parkingAmount.toFixed(2)}
                        </td>
                      </tr>
                    )}

                    {/* Pre-tax Subtotal */}
                    <tr className="bg-amber-50/50 font-bold border-t border-amber-200/60">
                      <td className="p-2.5 text-slate-900">Taxable Value of Service</td>
                      <td className="p-2.5 text-right text-slate-900">
                        ₹{invoice.financials?.taxableValue?.toFixed(2)}
                      </td>
                    </tr>

                    {/* CGST 2.5% */}
                    <tr>
                      <td className="p-2 text-slate-600 pl-5">CGST (2.5%)</td>
                      <td className="p-2 text-right font-medium text-slate-700">
                        ₹{invoice.financials?.cgst?.toFixed(2)}
                      </td>
                    </tr>

                    {/* SGST 2.5% */}
                    <tr>
                      <td className="p-2 text-slate-600 pl-5">SGST / UTGST (2.5%)</td>
                      <td className="p-2 text-right font-medium text-slate-700">
                        ₹{invoice.financials?.sgst?.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Grand Total Banner */}
                <div className="bg-[#f74a01] text-white p-3 flex justify-between items-center font-black">
                  <span className="text-xs uppercase tracking-wider">Grand Total (Incl. 5% GST)</span>
                  <span className="text-lg tracking-tight">
                    ₹{invoice.financials?.grandTotal?.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Amount in words */}
              <div className="text-xs text-slate-700 mb-3 px-1">
                Amount in Words:{' '}
                <span className="font-extrabold text-[#162232]">{invoice.amountInWords}</span>
              </div>

              {/* Advance Paid & Balance Due Pill */}
              <div className="flex flex-wrap gap-2 text-xs mb-3.5">
                <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-900 font-semibold">
                  Advance Paid: <span className="font-black">₹{invoice.financials?.advancePaid?.toFixed(2)}</span> ({invoice.financials?.advanceStatus}
                  {invoice.financials?.advancePaidDate ? ` • ${invoice.financials.advancePaidDate}` : ''})
                </div>
                <div className={`px-3 py-1.5 rounded-md font-semibold ${
                  invoice.financials?.balanceDue <= 0 || invoice.financials?.balanceStatus === 'PAID'
                    ? 'bg-slate-50 border border-slate-200 text-slate-900'
                    : 'bg-amber-50 border border-amber-200 text-amber-900'
                }`}>
                  {invoice.financials?.balanceDue <= 0 || invoice.financials?.balanceStatus === 'PAID' ? (
                    <>
                      Balance: <span className="font-black">₹{invoice.financials?.balanceDue?.toFixed(2)}</span> (PAID IN FULL
                      {invoice.financials?.fullPaymentDate ? ` • ${invoice.financials.fullPaymentDate}` : ''})
                    </>
                  ) : (
                    <>
                      Balance Due: <span className="font-black">₹{invoice.financials?.balanceDue?.toFixed(2)}</span> ({invoice.financials?.balanceStatus}
                      {invoice.financials?.balanceDueDate ? ` • Due: ${invoice.financials.balanceDueDate}` : ''})
                    </>
                  )}
                </div>
              </div>

              {/* Remarks */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[10.5px] text-slate-600 leading-relaxed mb-6">
                <span className="font-bold text-slate-800 uppercase block mb-0.5">Remarks / Conditions:</span>
                {invoice.remarks}
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end pt-4 border-t border-slate-200">
                <div className="text-[10px] text-slate-500">
                  <p className="font-bold text-slate-700">Thank you for traveling with Kandy Cabs!</p>
                  <p>Computer generated tax invoice • Valid without physical seal</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-5">
                    For {invoice.company?.name || 'KANDY CABS'}
                  </p>
                  <div className="inline-block border-t border-slate-400 pt-1 text-right min-w-[130px]">
                    <span className="text-xs font-black text-[#162232] block leading-tight">
                      KANDY CABS PVT LTD
                    </span>
                    <span className="text-[9px] text-slate-500">Authorized Signatory</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Bottom Action Footer */}
        <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 border border-slate-200"
              title="Copy Customer Invoice Web Link"
            >
              <span>🔗</span>
              <span>{copiedLink ? 'Link Copied!' : 'Copy Invoice Link'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>⬇️</span>
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-3.5 py-1.5 bg-[#162232] hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>🖨️</span>
              <span>View / Print PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
