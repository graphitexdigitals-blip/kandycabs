import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { KandyInvoiceData } from '@kandy-cabs/shared';

/**
 * Format currency amount with commas and 2 decimals e.g. "Rs. 2,506.00"
 */
function formatRupees(amount: number | undefined | null): string {
  const val = Number(amount || 0);
  return `Rs. ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generate official Kandy Cabs Tax Invoice as a binary PDF Buffer.
 * Conforms to standard A4 single-page tax invoice layout.
 */
export async function generateKandyInvoicePdf(invoice: KandyInvoiceData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 36, bottom: 36, left: 36, right: 36 },
    info: {
      Title: `Kandy Cabs Tax Invoice - ${invoice.invoiceNumber}`,
      Author: 'Kandy Cabs Pvt Ltd',
      Subject: 'Official Tax Invoice',
      Keywords: 'Kandy Cabs, Tax Invoice, Cab Booking, Transportation',
      CreationDate: new Date(),
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const endPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const pageWidth = 595.28;
  const left = 36;
  const right = pageWidth - 36;
  const contentWidth = right - left; // 523.28

  let y = 36;

  // 1. Header: Logo & Company Information
  const logoPath = path.resolve(process.cwd(), 'public/images/kandy_cabs_invoice_logo.png');
  const altLogoPath = path.resolve(process.cwd(), 'apps/admin/public/images/kandy_cabs_invoice_logo.png');
  const resolvedLogo = fs.existsSync(logoPath) ? logoPath : (fs.existsSync(altLogoPath) ? altLogoPath : null);

  if (resolvedLogo) {
    try {
      doc.image(resolvedLogo, left, y, { width: 125 });
    } catch {
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#162232').text('KANDY CABS', left, y);
    }
  } else {
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#162232').text('KANDY CABS', left, y);
  }

  // Tagline under logo
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#F74A01').text('SAFE  |  RELIABLE  |  HASSLE-FREE', left, y + 42);

  // Right-aligned company legal & contact info
  const compX = 280;
  const compW = right - compX;
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor('#162232').text(invoice.company?.name || 'KANDY CABS PVT LTD', compX, y, { width: compW, align: 'right' });
  doc.font('Helvetica').fontSize(7.5).fillColor('#475569');
  doc.text(invoice.company?.tagline || 'Safe | Reliable | Hassle-Free Cab Services', compX, y + 16, { width: compW, align: 'right' });
  doc.text(invoice.company?.addressLine1 || '#708, 7th Floor, Inland Impala, Vidyaranyanagar,', compX, y + 27, { width: compW, align: 'right' });
  doc.text(invoice.company?.addressLine2 || 'Mangaluru, Karnataka – 575020', compX, y + 37, { width: compW, align: 'right' });
  doc.font('Helvetica-Bold').fillColor('#162232').text(`GSTIN: ${invoice.company?.gstin || '29AIEPR4688P1Z4'}`, compX, y + 48, { width: compW, align: 'right' });
  doc.font('Helvetica').fontSize(7).fillColor('#64748B').text(`${invoice.company?.website || 'www.kandycabs.in'}  •  ${invoice.company?.email || 'kandycabsmlr@gmail.com'}`, compX, y + 59, { width: compW, align: 'right' });

  y = 110;
  // Header divider rule
  doc.strokeColor('#E2E8F0').lineWidth(0.75).moveTo(left, y).lineTo(right, y).stroke();

  // 2. Official Navy TAX INVOICE Banner
  y += 7;
  const isCancelled = Boolean(invoice.cancellation?.isCancelled);
  const bannerColor = isCancelled ? '#BE123C' : '#162232';
  const bannerText = isCancelled ? 'TAX INVOICE / CANCELLATION VOUCHER (CANCELLED)' : 'TAX INVOICE';
  doc.roundedRect(left, y, contentWidth, 22, 3).fill(bannerColor);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF').text(bannerText, left, y + 6, { width: contentWidth, align: 'center' });

  // 3. Optional Cancellation & Refund Summary Card
  if (isCancelled && invoice.cancellation) {
    y += 28;
    doc.roundedRect(left, y, contentWidth, 42, 3).fillAndStroke('#FFF1F2', '#FECDD3');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#9F1239').text('CANCELLATION & REFUND BREAKDOWN', left + 8, y + 5);
    doc.font('Helvetica').fontSize(7.5).fillColor('#334155');
    
    const advPaidStr = formatRupees(invoice.cancellation.advancePaid ?? invoice.financials?.advancePaid);
    const cancelChargeStr = formatRupees(invoice.cancellation.cancellationCharge);
    const refundDueStr = formatRupees(invoice.cancellation.refundAmount);

    doc.text(`Advance Paid: ${advPaidStr}`, left + 8, y + 17);
    doc.text(`Cancellation Charge: ${cancelChargeStr}`, left + 175, y + 17);
    doc.font('Helvetica-Bold').fillColor('#065F46').text(`Refund Due: ${refundDueStr}`, left + 360, y + 17);

    doc.font('Helvetica').fontSize(7).fillColor('#64748B').text(`Refund Status: ${invoice.cancellation.refundStatus || 'Processing'}`, left + 8, y + 29);
    if (invoice.cancellation.reason) {
      doc.text(`Reason: ${invoice.cancellation.reason}`, left + 175, y + 29, { width: 330, ellipsis: true });
    }
    y += 18;
  }

  // 4. Invoice Meta Grid (4 Columns)
  y += 28;
  doc.roundedRect(left, y, contentWidth, 34, 3).fillAndStroke('#F8FAFC', '#E2E8F0');
  const colW = contentWidth / 4;

  // Col 1: Invoice Number
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748B').text('INVOICE NO.', left + 8, y + 6);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#162232').text(invoice.invoiceNumber, left + 8, y + 17);

  // Col 2: Invoice Date
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748B').text('INVOICE DATE', left + colW + 8, y + 6);
  doc.font('Helvetica').fontSize(8.5).fillColor('#1E293B').text(invoice.invoiceDateFormatted, left + colW + 8, y + 17);

  // Col 3: Place of Supply
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748B').text('PLACE OF SUPPLY', left + colW * 2 + 8, y + 6);
  doc.font('Helvetica').fontSize(8.5).fillColor('#1E293B').text(invoice.placeOfSupply || 'Karnataka (29)', left + colW * 2 + 8, y + 17);

  // Col 4: Supply Type
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748B').text('SUPPLY TYPE', left + colW * 3 + 8, y + 6);
  doc.font('Helvetica').fontSize(8.5).fillColor('#1E293B').text(invoice.supplyType || 'Passenger Transport', left + colW * 3 + 8, y + 17);

  // Vertical column dividers
  doc.strokeColor('#E2E8F0').lineWidth(0.5);
  doc.moveTo(left + colW, y).lineTo(left + colW, y + 34).stroke();
  doc.moveTo(left + colW * 2, y).lineTo(left + colW * 2, y + 34).stroke();
  doc.moveTo(left + colW * 3, y).lineTo(left + colW * 3, y + 34).stroke();

  // 5. Bill To / Customer Details
  y += 42;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#162232').text('BILL TO / CUSTOMER DETAILS', left, y);
  y += 12;
  doc.roundedRect(left, y, contentWidth, 44, 3).fillAndStroke('#FFFFFF', '#E2E8F0');

  const customerName = invoice.customer?.name || 'Customer';
  const customerPhone = invoice.customer?.phone || 'On file';
  const pickupAddress = invoice.customer?.pickupAddress || 'Pickup address on file';

  doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748B').text('CUSTOMER NAME', left + 8, y + 6);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#162232').text(customerName, left + 8, y + 16, { width: 300, ellipsis: true });

  doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748B').text('CONTACT PHONE', left + 320, y + 6);
  doc.font('Helvetica').fontSize(8.5).fillColor('#1E293B').text(customerPhone, left + 320, y + 16);

  doc.strokeColor('#F1F5F9').lineWidth(0.5).moveTo(left + 8, y + 29).lineTo(right - 8, y + 29).stroke();
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748B').text('PICKUP ADDRESS:', left + 8, y + 32);
  doc.font('Helvetica').fontSize(7.5).fillColor('#334155').text(pickupAddress, left + 85, y + 32, { width: contentWidth - 95, ellipsis: true });

  // 6. Trip Details Box
  y += 52;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#162232').text('TRIP DETAILS', left, y);
  y += 12;
  doc.roundedRect(left, y, contentWidth, 58, 3).fillAndStroke('#FFFFFF', '#E2E8F0');

  // Row 1 (4 columns)
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748B').text('JOURNEY DATE', left + 8, y + 5);
  doc.font('Helvetica').fontSize(8).fillColor('#1E293B').text(invoice.tripDetails?.travelDate || invoice.invoiceDateFormatted, left + 8, y + 14);

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748B').text('TRIP TYPE', left + colW + 8, y + 5);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#162232').text(invoice.tripDetails?.tripType || 'One Way', left + colW + 8, y + 14, { width: colW - 12, ellipsis: true });

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748B').text('DURATION', left + colW * 2 + 8, y + 5);
  doc.font('Helvetica').fontSize(8).fillColor('#1E293B').text(invoice.tripDetails?.numberOfDays || '1 Day', left + colW * 2 + 8, y + 14);

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748B').text('KM LIMIT', left + colW * 3 + 8, y + 5);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#F74A01').text(invoice.tripDetails?.kmLimit || '100 Km Limit', left + colW * 3 + 8, y + 14, { width: colW - 12, ellipsis: true });

  doc.strokeColor('#F1F5F9').lineWidth(0.5).moveTo(left, y + 27).lineTo(right, y + 27).stroke();

  // Row 2 (Route & Passengers)
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748B').text('ROUTE:', left + 8, y + 31);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#162232').text(invoice.tripDetails?.route || 'Point-to-Point Trip', left + 50, y + 31, { width: 235, ellipsis: true });

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748B').text('PASSENGERS:', left + 295, y + 31);
  doc.font('Helvetica').fontSize(7.5).fillColor('#334155').text(invoice.tripDetails?.passengers || '4 Passengers • AC Cab', left + 365, y + 31, { width: right - 370, ellipsis: true });

  // Row 3 (Pickup Time & Toll/Parking)
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748B').text('PICKUP TIME:', left + 8, y + 44);
  doc.font('Helvetica').fontSize(7.5).fillColor('#334155').text(invoice.tripDetails?.pickupTime || 'Scheduled Time', left + 65, y + 44, { width: 220, ellipsis: true });

  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748B').text('TOLL & PARKING:', left + 295, y + 44);
  doc.font('Helvetica').fontSize(7.5).fillColor('#334155').text(invoice.tripDetails?.tollParkingStatus || 'Excluded (Payable Extra at Actuals)', left + 375, y + 44, { width: right - 380, ellipsis: true });

  // 7. Particulars & Fare Breakdown Table
  y += 66;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#162232').text('INVOICE PARTICULARS & FARE BREAKDOWN', left, y);
  y += 12;

  // Table header
  doc.rect(left, y, contentWidth, 18).fillAndStroke('#F1F5F9', '#CBD5E1');
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#162232').text('Description of Service', left + 8, y + 5);
  doc.text('Amount (INR)', right - 110, y + 5, { width: 102, align: 'right' });
  y += 18;

  const addTableRow = (desc: string, amtStr: string, isSubtotal = false) => {
    const rowH = 17;
    if (isSubtotal) {
      doc.rect(left, y, contentWidth, rowH).fill('#F8FAFC');
      doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(left, y).lineTo(right, y).stroke();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#162232');
    } else {
      doc.strokeColor('#F1F5F9').lineWidth(0.5).moveTo(left, y).lineTo(right, y).stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor('#334155');
    }
    doc.text(desc, left + (isSubtotal ? 8 : 12), y + 4.5, { width: 375, ellipsis: true });
    doc.text(amtStr, right - 110, y + 4.5, { width: 102, align: 'right' });
    y += rowH;
  };

  // Base Service Description
  const serviceDesc = invoice.financials?.serviceDescription || 'Commercial Outstation Cab Service';
  addTableRow(serviceDesc, formatRupees(invoice.financials?.serviceAmount));

  if (Number(invoice.financials?.chauffeurAllowance || 0) > 0) {
    addTableRow('Chauffeur Day Allowance', formatRupees(invoice.financials?.chauffeurAllowance));
  }
  if (Number(invoice.financials?.chauffeurNightAllowance || 0) > 0) {
    addTableRow('Chauffeur Night Stay Allowance', formatRupees(invoice.financials?.chauffeurNightAllowance));
  }
  if (Number(invoice.financials?.tollAmount || 0) > 0) {
    addTableRow('Tollway Charges (Included)', formatRupees(invoice.financials?.tollAmount));
  }
  if (Number(invoice.financials?.parkingAmount || 0) > 0) {
    addTableRow('Parking Charges (Included)', formatRupees(invoice.financials?.parkingAmount));
  }

  // Taxable Value Subtotal
  addTableRow('Taxable Value of Service', formatRupees(invoice.financials?.taxableValue), true);

  // GST Breakdown
  addTableRow('CGST (2.5%)', formatRupees(invoice.financials?.cgst));
  addTableRow('SGST / UTGST (2.5%)', formatRupees(invoice.financials?.sgst));

  // Grand Total Banner
  doc.rect(left, y, contentWidth, 22).fill('#F74A01');
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF').text('GRAND TOTAL (INCL. 5% GST)', left + 8, y + 6);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF').text(formatRupees(invoice.financials?.grandTotal), right - 130, y + 5, { width: 122, align: 'right' });
  y += 22;

  // 8. Amount in Words
  y += 10;
  doc.font('Helvetica').fontSize(7.5).fillColor('#64748B').text('Amount in Words: ', left, y, { continued: true });
  doc.font('Helvetica-Bold').fillColor('#162232').text(invoice.amountInWords || 'Rupees Zero Only.');

  // 9. Payment Status Badges (Advance Paid Date, Full Payment Date, Remaining Payment Date/Due)
  y += 15;
  const advAmtStr = formatRupees(invoice.financials?.advancePaid);
  const advStatus = invoice.financials?.advanceStatus || 'CONFIRMED';
  const advDateStr = invoice.financials?.advancePaidDate ? ` • ${invoice.financials.advancePaidDate}` : '';

  const balAmt = Number(invoice.financials?.balanceDue || 0);
  const balAmtStr = formatRupees(balAmt);
  const isBalZero = balAmt <= 0 || invoice.financials?.balanceStatus === 'PAID';

  // Advance badge (Emerald green)
  doc.roundedRect(left, y, 255, 22, 3).fillAndStroke('#ECFDF5', '#A7F3D0');
  doc.font('Helvetica').fontSize(7.5).fillColor('#065F46').text('Advance Paid: ', left + 8, y + 6, { continued: true });
  doc.font('Helvetica-Bold').text(`${advAmtStr} (${advStatus}${advDateStr})`, { width: 238, ellipsis: true });

  // Balance badge
  const balBg = isBalZero ? '#F8FAFC' : '#FFFBEB';
  const balBorder = isBalZero ? '#E2E8F0' : '#FDE68A';
  const balColor = isBalZero ? '#047857' : '#B45309';

  let balText = '';
  if (isBalZero) {
    if (invoice.financials?.fullPaymentDate) {
      balText = `${balAmtStr} (PAID IN FULL • ${invoice.financials.fullPaymentDate})`;
    } else {
      balText = `${balAmtStr} (NIL / CLEARED)`;
    }
  } else {
    const dueStr = invoice.financials?.balanceDueDate ? ` • Due: ${invoice.financials.balanceDueDate}` : '';
    balText = `${balAmtStr} (PENDING${dueStr})`;
  }

  doc.roundedRect(left + 265, y, 258, 22, 3).fillAndStroke(balBg, balBorder);
  doc.font('Helvetica').fontSize(7.5).fillColor('#334155').text(isBalZero ? 'Balance: ' : 'Balance Due: ', left + 273, y + 6, { continued: true });
  doc.font('Helvetica-Bold').fillColor(balColor).text(balText, { width: 240, ellipsis: true });

  // 10. Remarks / Conditions Box
  y += 27;
  doc.roundedRect(left, y, contentWidth, 34, 3).fillAndStroke('#F8FAFC', '#E2E8F0');
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#475569').text('REMARKS / CONDITIONS:', left + 8, y + 5);
  doc.font('Helvetica').fontSize(7).fillColor('#64748B');
  const remarksText = invoice.remarks || 'Toll charges, parking fees, additional kilometres beyond limit, and chauffeur night allowance charged extra as applicable. Subject to Mangaluru jurisdiction.';
  doc.text(remarksText, left + 8, y + 14, { width: contentWidth - 16, lineGap: 1.5 });

  // 11. Signatures & Footer
  y += 42;
  doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(left, y).lineTo(right, y).stroke();
  y += 8;

  // Left Footer Info
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#162232').text('Thank you for choosing Kandy Cabs!', left, y);
  doc.font('Helvetica').fontSize(6.5).fillColor('#64748B').text('Computer generated tax invoice • Valid without physical signature', left, y + 10);
  doc.text('24/7 Support Helpline: +91 9786452563 | Email: support@kandycabs.com', left, y + 19);

  // Right Signatory
  const signX = 350;
  const signW = right - signX;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#162232').text('For KANDY CABS PVT LTD', signX, y, { width: signW, align: 'right' });
  doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748B').text('Authorised Signatory', signX, y + 11, { width: signW, align: 'right' });
  doc.font('Helvetica').fontSize(6.5).fillColor('#475569').text(`${invoice.signatory?.name || 'Mukesh Rao'} (${invoice.signatory?.role || 'Authorised Signatory'})`, signX, y + 21, { width: signW, align: 'right' });

  doc.end();
  return endPromise;
}
