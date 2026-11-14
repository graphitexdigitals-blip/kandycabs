import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { KANDY_LOGO_BASE64, generateKandyInvoiceHtml } from '@kandy-cabs/shared';
import { customerApiClient, getDynamicBaseUrl, customerTokenStorage } from '../lib/api';

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

  const isCancelled = raw.cancellation?.isCancelled || raw.bookingStatus === 'CANCELLED' || booking.status === 'CANCELLED';
  let cancellation = raw.cancellation;
  if (isCancelled && !cancellation) {
    const cancelCharge = Number(raw.cancellationCharge || 0);
    const refAmt = Math.max(0, advancePaid - cancelCharge);
    cancellation = {
      isCancelled: true,
      cancelledBy: 'CUSTOMER',
      reason: booking.cancellationReason || 'Booking cancelled',
      cancellationCharge: cancelCharge,
      advancePaid: advancePaid,
      refundAmount: refAmt,
      refundStatus: refAmt > 0 ? 'Eligible for Refund (Processing)' : 'No Refund Applicable',
    };
  }

  return {
    invoiceNumber,
    invoiceDateFormatted,
    placeOfSupply: raw.placeOfSupply || 'Karnataka',
    supplyType: raw.supplyType || 'Passenger Transportation Service',
    bookingRef: invoiceNumber,
    bookingStatus: raw.bookingStatus || booking.status || (isCancelled ? 'CANCELLED' : 'CONFIRMED'),
    cancellation,
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
  const { t } = useTranslation();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && bookingId) {
      setLoading(true);
      setError('');
      customerApiClient
        .fetch(`/api/customer/bookings/${bookingId}/invoice`)
        .then((data: any) => {
          if (data && data.success && data.invoice) {
            setInvoice(normalizeInvoiceData(data.invoice));
          } else {
            setError(data?.message || 'Failed to generate tax invoice');
          }
        })
        .catch((err: any) => {
          setError(err.message || 'Failed to load invoice');
        })
        .finally(() => setLoading(false));
    } else {
      setInvoice(null);
    }
  }, [isOpen, bookingId]);

  if (!isOpen || !bookingId) return null;

  const generateLocalPdf = async (): Promise<string> => {
    // 1. Generate full official HTML invoice template from invoice data
    const htmlContent = generateKandyInvoiceHtml(invoice, { autoPrint: false });

    // 2. Directly compile into native PDF file on device storage via expo-print
    const { uri: tempPdfUri } = await Print.printToFileAsync({
      html: htmlContent,
    });

    // 3. Prepare permanent named PDF destination
    const fileName = `Kandy_Cabs_Tax_Invoice_${invoice.invoiceNumber}.pdf`;
    const targetPdfUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${fileName}`;

    // Move / Copy generated PDF to named file
    await FileSystem.copyAsync({
      from: tempPdfUri,
      to: targetPdfUri,
    });

    return targetPdfUri;
  };

  const handleDownloadPdf = async () => {
    if (!invoice || !bookingId) return;
    try {
      setDownloading(true);
      const targetPdfUri = await generateLocalPdf();

      // 4. Directly save / share without redirecting to any external browser page
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(targetPdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Save Invoice #${invoice.invoiceNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(
          'Invoice PDF Saved',
          `Tax Invoice #${invoice.invoiceNumber} has been downloaded and saved to your device:\n\n${targetPdfUri}`
        );
      }
    } catch (err: any) {
      console.error('[TaxInvoice] Direct PDF download error:', err);
      Alert.alert('Download Error', err.message || 'Unable to download invoice at this time.');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!invoice || !bookingId) return;
    try {
      setSharing(true);
      // Generate actual PDF file on device
      const targetPdfUri = await generateLocalPdf();

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        // Share actual .pdf document directly to WhatsApp, Email, Drive, etc.
        await Sharing.shareAsync(targetPdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Kandy Cabs Invoice #${invoice.invoiceNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback to text link if device doesn't support file sharing
        const token = await customerTokenStorage.getTokenAsync();
        const baseUrl = getDynamicBaseUrl();
        const authParam = token ? `&auth=${encodeURIComponent(token)}` : '';
        const downloadUrl = `${baseUrl}/api/customer/bookings/${bookingId}/invoice?format=html&download=1&print=true${authParam}`;
        await Share.share({
          title: `Kandy Cabs Tax Invoice #${invoice.invoiceNumber}`,
          message: `Kandy Cabs Tax Invoice #${invoice.invoiceNumber}\nCustomer: ${invoice.customer?.name || 'Customer'}\nTotal: ₹${invoice.financials?.grandTotal?.toFixed(2) || '0.00'}\nDownload Official PDF: ${downloadUrl}`,
          url: downloadUrl,
        });
      }
    } catch (err: any) {
      console.error('[TaxInvoice] Share PDF error:', err);
      Alert.alert('Share Error', err.message || 'Unable to share invoice at this time.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Modal Top Bar */}
          <View style={styles.topControlBar}>
            <View style={styles.topBarLeft}>
              <View style={styles.kcLogoMiniBadge}>
                <Text style={styles.kcLogoMiniText}>KC</Text>
              </View>
              <View>
                <Text style={styles.topBarTitle}>
                  {t('modals.invoice.title', { defaultValue: 'Official Tax Invoice' })}
                </Text>
                <Text style={styles.topBarSub}>
                  {invoice?.invoiceNumber ? `#${invoice.invoiceNumber}` : 'Kandy Cabs Pvt Ltd'}
                </Text>
              </View>
            </View>

            <View style={styles.topBarRight}>
              <TouchableOpacity
                style={styles.iconActionBtn}
                onPress={handleShare}
                activeOpacity={0.7}
                disabled={sharing || downloading}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color="#f74a01" />
                ) : (
                  <Ionicons name="share-social-outline" size={17} color="#162232" />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color="#162232" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Scrollable Sheet Content */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#f74a01" />
              <Text style={styles.loadingMessage}>Generating official tax invoice...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={28} color="#ef4444" style={{ marginBottom: 6 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : invoice ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Document Sheet Container */}
              <View style={styles.paperSheet}>
                {/* 1. Header: Logo & Company Info */}
                <View style={styles.docHeader}>
                  <View style={styles.brandBox}>
                    <Image
                      source={{ uri: KANDY_LOGO_BASE64 }}
                      defaultSource={require('../assets/images/logo-with-tagline.png')}
                      style={styles.brandLogoImg}
                      resizeMode="contain"
                    />
                  </View>

                  <View style={styles.companyInfoBox}>
                    <Text style={styles.companyMainTitle}>{invoice.company?.name || 'KANDY CABS'}</Text>
                    <Text style={styles.companySubTitle}>{invoice.company?.tagline || 'Safe | Reliable | Hassle-Free'}</Text>
                    <Text style={styles.companyAddrText}>
                      {invoice.company?.addressLine1 || '#708, 7th Floor, Inland Impala, Vidyaranyanagar,'}{'\n'}
                      {invoice.company?.addressLine2 || 'Mangaluru, Karnataka – 575020'}
                    </Text>
                    <Text style={styles.companyGstinText}>
                      GSTIN: {invoice.company?.gstin || '29AIEPR4688P1Z4'}
                    </Text>
                    <Text style={styles.companyContactText}>
                      {invoice.company?.website || 'www.kandycabs.in'} • {invoice.company?.email || 'kandycabsmlr@gmail.com'}
                    </Text>
                  </View>
                </View>

                {/* 2. Navy TAX INVOICE Banner / Cancellation Banner */}
                <View style={[
                  styles.taxInvoiceNavyBanner,
                  invoice.cancellation?.isCancelled ? styles.taxInvoiceCancelledBanner : null
                ]}>
                  <Text style={styles.taxInvoiceNavyText}>
                    {invoice.cancellation?.isCancelled
                      ? 'TAX INVOICE / CANCELLATION VOUCHER (CANCELLED)'
                      : 'TAX INVOICE'}
                  </Text>
                </View>

                {/* Dedicated Cancellation Charges & Excess Refund Breakdown */}
                {invoice.cancellation?.isCancelled ? (
                  <View style={styles.cancellationCard}>
                    <View style={styles.cancellationCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="warning-outline" size={15} color="#be123c" />
                        <Text style={styles.cancellationCardTitle}>CANCELLATION CHARGES & REFUND BREAKDOWN</Text>
                      </View>
                      <View style={styles.cancellationBadge}>
                        <Text style={styles.cancellationBadgeText}>TRIP CANCELLED</Text>
                      </View>
                    </View>

                    <View style={styles.cancellationRow}>
                      <Text style={styles.cancellationLbl}>Total Advance Paid:</Text>
                      <Text style={styles.cancellationVal}>
                        ₹{(invoice.cancellation.advancePaid ?? invoice.financials?.advancePaid ?? 0).toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.cancellationRow}>
                      <Text style={styles.cancellationLbl}>Applicable Cancellation Charge:</Text>
                      <Text style={[styles.cancellationVal, { color: '#be123c' }]}>
                        - ₹{(invoice.cancellation.cancellationCharge ?? 0).toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.cancellationRefundRow}>
                      <Text style={styles.cancellationRefundLbl}>Excess Amount to be Refunded:</Text>
                      <Text style={styles.cancellationRefundVal}>
                        ₹{(invoice.cancellation.refundAmount ?? 0).toFixed(2)}
                      </Text>
                    </View>

                    <View style={styles.cancellationRow}>
                      <Text style={styles.cancellationLbl}>Refund Settlement Status:</Text>
                      <Text style={[styles.cancellationVal, { color: '#0284c7' }]}>
                        {invoice.cancellation.refundStatus || 'Eligible for Refund (Processing)'}
                      </Text>
                    </View>

                    {invoice.cancellation.reason ? (
                      <View style={[styles.cancellationRow, { borderBottomWidth: 0, paddingTop: 4 }]}>
                        <Text style={styles.cancellationReasonTxt}>
                          Reason: {invoice.cancellation.reason}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* 3. Table 1: Invoice Meta */}
                <View style={styles.tableBordered}>
                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>Invoice No.</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%' }]}>
                      <Text style={styles.valTxtBold}>{invoice.invoiceNumber}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>Invoice Date</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%', borderRightWidth: 0 }]}>
                      <Text style={styles.valTxt}>{invoice.invoiceDateFormatted}</Text>
                    </View>
                  </View>
                  <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>Place of Supply</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%' }]}>
                      <Text style={styles.valTxt}>{invoice.placeOfSupply}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>Supply Type</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%', borderRightWidth: 0 }]}>
                      <Text style={styles.valTxt}>{invoice.supplyType}</Text>
                    </View>
                  </View>
                </View>

                {/* 4. Section: BILL TO / CUSTOMER DETAILS */}
                <Text style={styles.sectionHeaderTitle}>BILL TO / CUSTOMER DETAILS</Text>
                <View style={styles.tableBordered}>
                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '24%' }]}>
                      <Text style={styles.labelTxt}>Customer Name</Text>
                    </View>
                    <View style={[styles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
                      <Text style={styles.valTxtBold}>{invoice.customer?.name}</Text>
                    </View>
                  </View>
                  <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '24%' }]}>
                      <Text style={styles.labelTxt}>Pickup Address</Text>
                    </View>
                    <View style={[styles.tableCell, { flex: 1, borderRightWidth: 0 }]}>
                      <Text style={styles.valTxt}>{invoice.customer?.pickupAddress}</Text>
                    </View>
                  </View>
                </View>

                {/* 5. Section: TRIP DETAILS */}
                <Text style={styles.sectionHeaderTitle}>TRIP DETAILS</Text>
                <View style={styles.tableBordered}>
                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>Travel Date</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%' }]}>
                      <Text style={styles.valTxt}>{invoice.tripDetails?.travelDate}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>Trip Type</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%', borderRightWidth: 0 }]}>
                      <Text style={styles.valTxt}>{invoice.tripDetails?.tripType}</Text>
                    </View>
                  </View>

                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>No. of Days</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%' }]}>
                      <Text style={styles.valTxtBold}>{invoice.tripDetails?.numberOfDays || '1 Day'}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>KM Limit</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%', borderRightWidth: 0 }]}>
                      <Text style={styles.valTxtBold}>{invoice.tripDetails?.kmLimit}</Text>
                    </View>
                  </View>

                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>Route</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%' }]}>
                      <Text style={styles.valTxtBold}>{invoice.tripDetails?.route}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>Passengers</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%', borderRightWidth: 0 }]}>
                      <Text style={styles.valTxt}>{invoice.tripDetails?.passengers}</Text>
                    </View>
                  </View>

                  <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>Pickup Time</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%' }]}>
                      <Text style={styles.valTxt}>{invoice.tripDetails?.pickupTime}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.cellLabel, { width: '22%' }]}>
                      <Text style={styles.labelTxt}>Toll & Parking</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%', borderRightWidth: 0 }]}>
                      <Text style={styles.valTxt}>{invoice.tripDetails?.tollParkingStatus || 'Excluded (Payable at Actuals)'}</Text>
                    </View>
                  </View>
                </View>

                {/* 6. Section: INVOICE PARTICULARS */}
                <Text style={styles.sectionHeaderTitle}>INVOICE PARTICULARS</Text>
                <View style={styles.tableBordered}>
                  <View style={[styles.tableRow, styles.cellHeaderBg]}>
                    <View style={[styles.tableCell, { flex: 1, backgroundColor: 'transparent' }]}>
                      <Text style={styles.tableHeaderTxt}>Description of Service</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%', alignItems: 'flex-end', borderRightWidth: 0, backgroundColor: 'transparent' }]}>
                      <Text style={styles.tableHeaderTxt}>Amount</Text>
                    </View>
                  </View>

                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, { flex: 1 }]}>
                      <Text style={styles.valTxt}>{invoice.financials?.serviceDescription}</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%', alignItems: 'flex-end', borderRightWidth: 0 }]}>
                      <Text style={styles.amountTxt}>₹{invoice.financials?.serviceAmount?.toFixed(2)}</Text>
                    </View>
                  </View>

                  {invoice.financials?.chauffeurAllowance > 0 ? (
                    <View style={styles.tableRow}>
                      <View style={[styles.tableCell, { flex: 1 }]}>
                        <Text style={styles.valTxt}>Chauffeur Day Allowance</Text>
                      </View>
                      <View style={[styles.tableCell, { width: '28%', alignItems: 'flex-end', borderRightWidth: 0 }]}>
                        <Text style={styles.amountTxt}>₹{invoice.financials?.chauffeurAllowance?.toFixed(2)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {invoice.financials?.chauffeurNightAllowance > 0 ? (
                    <View style={styles.tableRow}>
                      <View style={[styles.tableCell, { flex: 1 }]}>
                        <Text style={styles.valTxt}>Chauffeur Night Stay Allowance</Text>
                      </View>
                      <View style={[styles.tableCell, { width: '28%', alignItems: 'flex-end', borderRightWidth: 0 }]}>
                        <Text style={styles.amountTxt}>₹{invoice.financials?.chauffeurNightAllowance?.toFixed(2)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {invoice.financials?.tollAmount > 0 ? (
                    <View style={styles.tableRow}>
                      <View style={[styles.tableCell, { flex: 1 }]}>
                        <Text style={styles.valTxt}>Highway Toll Charges (FASTag)</Text>
                      </View>
                      <View style={[styles.tableCell, { width: '28%', alignItems: 'flex-end', borderRightWidth: 0 }]}>
                        <Text style={styles.amountTxt}>₹{invoice.financials?.tollAmount?.toFixed(2)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {invoice.financials?.parkingAmount > 0 ? (
                    <View style={styles.tableRow}>
                      <View style={[styles.tableCell, { flex: 1 }]}>
                        <Text style={styles.valTxt}>Airport & Parking Charges</Text>
                      </View>
                      <View style={[styles.tableCell, { width: '28%', alignItems: 'flex-end', borderRightWidth: 0 }]}>
                        <Text style={styles.amountTxt}>₹{invoice.financials?.parkingAmount?.toFixed(2)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {invoice.financials?.petFee > 0 ? (
                    <View style={styles.tableRow}>
                      <View style={[styles.tableCell, { flex: 1 }]}>
                        <Text style={styles.valTxt}>Pet Friendly Sanitization Fee</Text>
                      </View>
                      <View style={[styles.tableCell, { width: '28%', alignItems: 'flex-end', borderRightWidth: 0 }]}>
                        <Text style={styles.amountTxt}>₹{invoice.financials?.petFee?.toFixed(2)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {invoice.financials?.extraKmAmount > 0 ? (
                    <View style={styles.tableRow}>
                      <View style={[styles.tableCell, { flex: 1 }]}>
                        <Text style={styles.valTxt}>Additional Distance Charges</Text>
                      </View>
                      <View style={[styles.tableCell, { width: '28%', alignItems: 'flex-end', borderRightWidth: 0 }]}>
                        <Text style={styles.amountTxt}>₹{invoice.financials?.extraKmAmount?.toFixed(2)}</Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Taxable Value Warm Peach Highlight Row */}
                  <View style={[styles.tableRow, styles.taxableRowHighlight]}>
                    <View style={[styles.tableCell, { flex: 1, backgroundColor: 'transparent' }]}>
                      <Text style={styles.taxableLabelTxt}>Taxable Value</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%', alignItems: 'flex-end', borderRightWidth: 0, backgroundColor: 'transparent' }]}>
                      <Text style={styles.taxableAmountTxt}>₹{invoice.financials?.taxableValue?.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View style={styles.tableRow}>
                    <View style={[styles.tableCell, { flex: 1 }]}>
                      <Text style={styles.valTxt}>CGST @ 2.5%</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%', alignItems: 'flex-end', borderRightWidth: 0 }]}>
                      <Text style={styles.amountTxt}>₹{invoice.financials?.cgst?.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                    <View style={[styles.tableCell, { flex: 1 }]}>
                      <Text style={styles.valTxt}>SGST @ 2.5%</Text>
                    </View>
                    <View style={[styles.tableCell, { width: '28%', alignItems: 'flex-end', borderRightWidth: 0 }]}>
                      <Text style={styles.amountTxt}>₹{invoice.financials?.sgst?.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>

                {/* 7. Vibrant Brand Orange GRAND TOTAL Banner */}
                <View style={styles.grandTotalOrangeBanner}>
                  <Text style={styles.grandTotalLabel}>GRAND TOTAL (INCLUDING GST)</Text>
                  <Text style={styles.grandTotalAmount}>₹{invoice.financials?.grandTotal?.toFixed(2)}</Text>
                </View>

                {/* 8. Amount in Words */}
                <View style={styles.amountInWordsBox}>
                  <Text style={styles.amountInWordsTxt}>
                    Amount in Words: <Text style={styles.amountInWordsBold}>{invoice.amountInWords}</Text>
                  </Text>
                </View>

                {/* 9. REMARKS / PAYMENT DETAILS */}
                <View style={styles.remarksBox}>
                  <Text style={styles.sectionHeaderTitle}>REMARKS / PAYMENT DETAILS</Text>
                  <Text style={styles.remarksBodyText}>{invoice.remarks}</Text>
                  <View style={styles.paymentBadgeRow}>
                    {invoice.cancellation?.isCancelled ? (
                      <Text style={styles.paymentBadgeTxt}>
                        Advance Paid: <Text style={{ fontWeight: '800' }}>₹{(invoice.cancellation.advancePaid ?? invoice.financials?.advancePaid ?? 0).toFixed(2)}</Text>
                        {'  '}|{'  '}
                        Cancellation Fee: <Text style={{ fontWeight: '800', color: '#be123c' }}>₹{(invoice.cancellation.cancellationCharge ?? 0).toFixed(2)}</Text>
                        {'  '}|{'  '}
                        Excess Refund: <Text style={{ fontWeight: '800', color: '#047857' }}>₹{(invoice.cancellation.refundAmount ?? 0).toFixed(2)}</Text>
                      </Text>
                    ) : (
                      <Text style={styles.paymentBadgeTxt}>
                        Advance: <Text style={{ fontWeight: '800' }}>₹{invoice.financials?.advancePaid?.toFixed(2)} ({invoice.financials?.advanceStatus})</Text>
                        {'  '}|{'  '}
                        Balance: <Text style={{ fontWeight: '800' }}>₹{invoice.financials?.balanceDue?.toFixed(2)} ({invoice.financials?.balanceStatus})</Text>
                      </Text>
                    )}
                  </View>
                </View>

                {/* 10. Footer */}
                <View style={styles.docFooter}>
                  <Text style={styles.footerBrandHeading}>
                    Thank you for choosing {invoice.company?.name || 'KANDY CABS'}
                  </Text>
                  <Text style={styles.footerBrandSub}>
                    {invoice.company?.tagline || 'Safe | Reliable | Hassle-Free'} • {invoice.company?.website || 'www.kandycabs.in'} • {invoice.company?.email || 'kandycabsmlr@gmail.com'}
                  </Text>
                  <Text style={styles.footerGstinRunning}>
                    {invoice.company?.name || 'KANDY CABS'} | GSTIN: {invoice.company?.gstin || '29AIEPR4688P1Z4'}
                  </Text>
                </View>
              </View>

              {/* Bottom Extra Download Button */}
              <TouchableOpacity
                style={styles.bottomDownloadBtn}
                onPress={handleDownloadPdf}
                disabled={downloading}
                activeOpacity={0.8}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="document-text-outline" size={17} color="#ffffff" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.bottomDownloadBtnText}>
                  {downloading ? 'Generating PDF...' : 'Download PDF Copy'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#f1f5f9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '94%',
    minHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    overflow: 'hidden',
  },
  topControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kcLogoMiniBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f74a01',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f74a01',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  kcLogoMiniText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  topBarTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#162232',
  },
  topBarSub: {
    fontSize: 10.5,
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Download Action Bar */
  downloadBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  downloadPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f74a01',
    borderRadius: 10,
    paddingVertical: 11,
    shadowColor: '#f74a01',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  downloadPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  /* Loading & Error */
  loadingBox: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMessage: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  errorBox: {
    margin: 20,
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    textAlign: 'center',
    fontWeight: '600',
  },

  /* Paper Document */
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 12,
    paddingBottom: 24,
  },
  paperSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  /* Header Box */
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogoImg: {
    width: 105,
    height: 54,
  },
  companyInfoBox: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 14,
  },
  companyMainTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#162232',
    letterSpacing: 0.3,
  },
  companySubTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
    marginTop: 1,
  },
  companyAddrText: {
    fontSize: 8.5,
    color: '#334155',
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 11.5,
  },
  companyGstinText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#162232',
    marginTop: 2,
  },
  companyContactText: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 1,
  },

  /* Navy TAX INVOICE Banner */
  taxInvoiceNavyBanner: {
    backgroundColor: '#162232',
    borderRadius: 2,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  taxInvoiceNavyText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  taxInvoiceCancelledBanner: {
    backgroundColor: '#be123c',
  },

  /* Cancellation Card Styles */
  cancellationCard: {
    borderWidth: 1.5,
    borderColor: '#fda4af',
    backgroundColor: '#fff1f2',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  cancellationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#fecdd3',
    borderStyle: 'dashed',
    paddingBottom: 6,
    marginBottom: 6,
  },
  cancellationCardTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#be123c',
    letterSpacing: 0.5,
  },
  cancellationBadge: {
    backgroundColor: '#be123c',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  cancellationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  cancellationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  cancellationLbl: {
    fontSize: 11,
    color: '#4c0519',
    fontWeight: '600',
  },
  cancellationVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#162232',
  },
  cancellationRefundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffe4e6',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f43f5e',
    borderStyle: 'dashed',
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginVertical: 4,
    borderRadius: 4,
  },
  cancellationRefundLbl: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#047857',
  },
  cancellationRefundVal: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#047857',
  },
  cancellationReasonTxt: {
    fontSize: 10,
    color: '#64748b',
    fontStyle: 'italic',
  },

  /* Section Title */
  sectionHeaderTitle: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#162232',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 3,
    paddingLeft: 1,
  },

  /* Table Grid */
  tableBordered: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableCell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  cellLabel: {
    backgroundColor: '#f8fafc',
  },
  cellHeaderBg: {
    backgroundColor: '#f8fafc',
  },
  labelTxt: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#334155',
  },
  valTxt: {
    fontSize: 9,
    color: '#1e293b',
    fontWeight: '500',
  },
  valTxtBold: {
    fontSize: 9,
    fontWeight: '800',
    color: '#162232',
  },
  tableHeaderTxt: {
    fontSize: 9,
    fontWeight: '900',
    color: '#162232',
  },
  amountTxt: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#1e293b',
  },

  /* Taxable Row Peach Highlight */
  taxableRowHighlight: {
    backgroundColor: '#fff7ed',
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
  },
  taxableLabelTxt: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#162232',
  },
  taxableAmountTxt: {
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '900',
    color: '#162232',
  },

  /* Grand Total Banner */
  grandTotalOrangeBanner: {
    backgroundColor: '#f74a01',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 2,
    marginTop: 6,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  grandTotalAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  /* Amount In Words */
  amountInWordsBox: {
    marginTop: 5,
    marginBottom: 6,
    paddingLeft: 1,
  },
  amountInWordsTxt: {
    fontSize: 8.5,
    color: '#334155',
  },
  amountInWordsBold: {
    fontWeight: '800',
    color: '#162232',
  },

  /* Remarks */
  remarksBox: {
    marginTop: 2,
    marginBottom: 8,
  },
  remarksBodyText: {
    fontSize: 8,
    color: '#475569',
    lineHeight: 11,
    marginTop: 1,
  },
  paymentBadgeRow: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  paymentBadgeTxt: {
    fontSize: 8.5,
    color: '#1e293b',
  },

  /* Signatures */
  signaturesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  sigColLeft: {
    width: '45%',
  },
  sigColRight: {
    width: '45%',
    alignItems: 'flex-end',
  },
  sigTitleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#162232',
  },
  sigGapSpace: {
    height: 30,
  },
  sigDashedLine: {
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    borderStyle: 'dashed',
    paddingTop: 3,
    minWidth: 110,
  },
  sigSignatoryName: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#162232',
  },
  sigSubText: {
    fontSize: 8,
    color: '#64748b',
  },

  /* Footer */
  docFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  footerBrandHeading: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#162232',
  },
  footerBrandSub: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 1,
  },
  footerGstinRunning: {
    fontSize: 7.5,
    color: '#94a3b8',
    alignSelf: 'flex-end',
    marginTop: 4,
  },

  /* Bottom Download Button */
  bottomDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#162232',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 12,
  },
  bottomDownloadBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
