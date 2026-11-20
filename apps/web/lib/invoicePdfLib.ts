import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { KandyInvoiceData } from '@kandy-cabs/shared';

function formatRupees(amount: number | undefined | null): string {
  const val = Number(amount || 0);
  return `Rs. ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generates an official, compliant vector PDF Tax Invoice for Kandy Cabs
 * using pure TypeScript pdf-lib with zero native/ESM fontkit dependencies.
 * Conforms to standard A4 single-page layout.
 */
export async function generateKandyInvoicePdfBytes(invoice: KandyInvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4: 595.28 x 841.89 pt

  // Protect all drawText calls against WinAnsi encoding crashes (e.g. Rupee sign ₹, unicode dashes, bullets)
  const originalDrawText = page.drawText.bind(page);
  (page as any).drawText = (text: string, options?: any) => {
    const sanitized = String(text ?? '')
      .replace(/₹/g, 'Rs. ')
      .replace(/[\u2010-\u2015]/g, '-')
      .replace(/\u2022/g, '*')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/\u00A0/g, ' ')
      .replace(/[^\x00-\x7F]/g, '');
    return originalDrawText(sanitized, options);
  };

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Palette colors
  const colorNavy = rgb(0.06, 0.09, 0.16); // #0F172A
  const colorOrange = rgb(0.976, 0.341, 0); // #F95700
  const colorSlateDark = rgb(0.2, 0.25, 0.33); // #334155
  const colorSlateMid = rgb(0.4, 0.45, 0.53); // #64748B
  const colorBorder = rgb(0.88, 0.91, 0.94); // #E2E8F0
  const colorLightBg = rgb(0.97, 0.98, 0.99); // #F8FAFC
  const colorEmerald = rgb(0.02, 0.47, 0.34); // #057A55
  const colorEmeraldBg = rgb(0.94, 0.99, 0.96); // #F0FDF4

  const left = 36;
  const right = 595.28 - 36;
  const width = right - left; // 523.28

  // Helpers for pdf-lib coordinate system (y = 0 at bottom)
  const top = 841.89 - 36; // 805.89
  let currentY = top;

  // 1. Header: Left Brand & Company Info | Right TAX INVOICE
  page.drawText('KANDY CABS', {
    x: left,
    y: currentY - 16,
    size: 20,
    font: fontBold,
    color: colorOrange,
  });

  page.drawText('Safe | Reliable | Hassle-Free', {
    x: left,
    y: currentY - 28,
    size: 8,
    font: fontBold,
    color: colorSlateMid,
  });

  const company = invoice.company || {
    addressLine1: '',
    addressLine2: '',
    gstin: '29AIEPR4688P1Z4',
    website: 'www.kandycabs.in',
    email: 'kandycabsmlr@gmail.com',
  };

  page.drawText(`GSTIN: ${company.gstin} | Web: ${company.website} | Email: ${company.email}`, {
    x: left,
    y: currentY - 42,
    size: 7.5,
    font: fontRegular,
    color: colorSlateDark,
  });

  // Right Header Info
  page.drawText('TAX INVOICE', {
    x: right - 130,
    y: currentY - 16,
    size: 16,
    font: fontBold,
    color: colorNavy,
  });

  page.drawText(`Invoice No: ${invoice.invoiceNumber}`, {
    x: right - 130,
    y: currentY - 28,
    size: 8,
    font: fontBold,
    color: colorOrange,
  });

  page.drawText(`Date: ${invoice.invoiceDateFormatted || new Date().toLocaleDateString('en-IN')}`, {
    x: right - 130,
    y: currentY - 39,
    size: 7.5,
    font: fontRegular,
    color: colorSlateDark,
  });

  page.drawText(`Place of Supply: ${invoice.placeOfSupply || 'Karnataka (29)'}`, {
    x: right - 130,
    y: currentY - 50,
    size: 7.5,
    font: fontRegular,
    color: colorSlateDark,
  });

  // Separator line
  currentY -= 62;
  page.drawLine({
    start: { x: left, y: currentY },
    end: { x: right, y: currentY },
    thickness: 1,
    color: colorBorder,
  });

  // 2. Customer & Trip Overview (2 Boxes side-by-side)
  currentY -= 10;
  const boxHeight = 72;
  const boxWidth = (width - 12) / 2;
  const boxY = currentY - boxHeight;

  // Box 1: Billed To Customer
  page.drawRectangle({
    x: left,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: colorLightBg,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  page.drawText('BILLED TO (CUSTOMER):', {
    x: left + 8,
    y: currentY - 14,
    size: 7.5,
    font: fontBold,
    color: colorNavy,
  });

  page.drawText(`Name: ${invoice.customer?.name || 'Valued Customer'}`, {
    x: left + 8,
    y: currentY - 27,
    size: 8,
    font: fontBold,
    color: colorSlateDark,
  });

  page.drawText(`Phone: ${invoice.customer?.phone || 'On file'}`, {
    x: left + 8,
    y: currentY - 39,
    size: 7.5,
    font: fontRegular,
    color: colorSlateDark,
  });

  const pickupStr = (invoice.customer?.pickupAddress || 'Address on file').substring(0, 52);
  page.drawText(`Pickup: ${pickupStr}`, {
    x: left + 8,
    y: currentY - 51,
    size: 7.5,
    font: fontRegular,
    color: colorSlateMid,
  });

  // Box 2: Trip & Cab Details
  const box2X = left + boxWidth + 12;
  page.drawRectangle({
    x: box2X,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: colorLightBg,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  page.drawText('BOOKING & TRIP PARTICULARS:', {
    x: box2X + 8,
    y: currentY - 14,
    size: 7.5,
    font: fontBold,
    color: colorNavy,
  });

  page.drawText(`Booking Ref: ${invoice.bookingRef || invoice.invoiceNumber}`, {
    x: box2X + 8,
    y: currentY - 27,
    size: 8,
    font: fontBold,
    color: colorOrange,
  });

  const routeStr = (invoice.tripDetails?.route || 'Custom Outstation Tour').substring(0, 48);
  page.drawText(`Route: ${routeStr}`, {
    x: box2X + 8,
    y: currentY - 39,
    size: 7.5,
    font: fontRegular,
    color: colorSlateDark,
  });

  page.drawText(`Trip Type: ${invoice.tripDetails?.tripType || 'ONEWAY'} | Package: ${invoice.tripDetails?.kmLimit || '100 Km Limit'}`, {
    x: box2X + 8,
    y: currentY - 51,
    size: 7.5,
    font: fontRegular,
    color: colorSlateMid,
  });

  page.drawText(`Cab: ${invoice.tripDetails?.passengers || 'AC Commercial Cab'}`, {
    x: box2X + 8,
    y: currentY - 63,
    size: 7.5,
    font: fontRegular,
    color: colorSlateMid,
  });

  // 3. Financial Breakdown Table
  currentY = boxY - 16;
  const tableTop = currentY;

  // Table Header Bar
  const headerHeight = 20;
  page.drawRectangle({
    x: left,
    y: tableTop - headerHeight,
    width: width,
    height: headerHeight,
    color: colorNavy,
  });

  page.drawText('Description of Service', {
    x: left + 8,
    y: tableTop - 14,
    size: 8,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('Taxable (Rs.)', {
    x: left + 270,
    y: tableTop - 14,
    size: 8,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('CGST 2.5%', {
    x: left + 355,
    y: tableTop - 14,
    size: 8,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('SGST 2.5%', {
    x: left + 420,
    y: tableTop - 14,
    size: 8,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('Total (Rs.)', {
    x: left + 475,
    y: tableTop - 14,
    size: 8,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Table Row 1: Main Transportation Service
  currentY = tableTop - headerHeight;
  const rowHeight = 36;
  const rowY = currentY - rowHeight;

  page.drawRectangle({
    x: left,
    y: rowY,
    width: width,
    height: rowHeight,
    color: rgb(1, 1, 1),
    borderColor: colorBorder,
    borderWidth: 1,
  });

  const descStr = (invoice.financials?.serviceDescription || 'Passenger Transportation Service - AC Outstation Commercial Cab').substring(0, 52);
  page.drawText(descStr, {
    x: left + 8,
    y: currentY - 15,
    size: 8,
    font: fontBold,
    color: colorNavy,
  });

  page.drawText('SAC Code: 996412 (Passenger Transportation)', {
    x: left + 8,
    y: currentY - 27,
    size: 7,
    font: fontRegular,
    color: colorSlateMid,
  });

  const fin = invoice.financials || {} as any;
  const taxableVal = formatRupees(fin.taxableValue || (fin.grandTotal ? fin.grandTotal / 1.05 : 0)).replace('Rs. ', '');
  const cgstVal = formatRupees(fin.cgst || (fin.gstTotal ? fin.gstTotal / 2 : 0)).replace('Rs. ', '');
  const sgstVal = formatRupees(fin.sgst || (fin.gstTotal ? fin.gstTotal / 2 : 0)).replace('Rs. ', '');
  const grandTotalVal = formatRupees(fin.grandTotal || 0).replace('Rs. ', '');

  page.drawText(taxableVal, { x: left + 270, y: currentY - 18, size: 8, font: fontRegular, color: colorSlateDark });
  page.drawText(cgstVal, { x: left + 355, y: currentY - 18, size: 8, font: fontRegular, color: colorSlateDark });
  page.drawText(sgstVal, { x: left + 420, y: currentY - 18, size: 8, font: fontRegular, color: colorSlateDark });
  page.drawText(grandTotalVal, { x: left + 475, y: currentY - 18, size: 8, font: fontBold, color: colorNavy });

  // 4. Grand Total Summary Row
  currentY = rowY;
  const totalRowHeight = 26;
  const totalRowY = currentY - totalRowHeight;

  page.drawRectangle({
    x: left,
    y: totalRowY,
    width: width,
    height: totalRowHeight,
    color: colorLightBg,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  page.drawText('GRAND TOTAL (INCL. GST):', {
    x: left + 8,
    y: currentY - 16,
    size: 8.5,
    font: fontBold,
    color: colorNavy,
  });

  page.drawText(formatRupees(fin.grandTotal || 0), {
    x: right - 110,
    y: currentY - 16,
    size: 11,
    font: fontBold,
    color: colorOrange,
  });

  // Amount in words
  currentY = totalRowY - 14;
  page.drawText(`Amount in Words: ${invoice.amountInWords || 'Rupees Only'}`, {
    x: left + 2,
    y: currentY,
    size: 7.5,
    font: fontOblique,
    color: colorSlateDark,
  });

  // 5. Settlement / Receipt Audit Box (Advance Paid & Balance Due)
  currentY -= 20;
  const settleBoxHeight = 44;
  const settleBoxY = currentY - settleBoxHeight;

  page.drawRectangle({
    x: left,
    y: settleBoxY,
    width: width,
    height: settleBoxHeight,
    color: colorEmeraldBg,
    borderColor: rgb(0.73, 0.93, 0.82),
    borderWidth: 1,
  });

  page.drawText('SETTLEMENT AUDIT & RECEIPT SUMMARY', {
    x: left + 8,
    y: currentY - 14,
    size: 7.5,
    font: fontBold,
    color: colorEmerald,
  });

  const advAmt = formatRupees(fin.advancePaid || 0);
  const advDate = fin.advancePaidDate ? ` (Paid: ${fin.advancePaidDate})` : ' (PAID)';
  page.drawText(`Advance Paid: ${advAmt}${advDate}`, {
    x: left + 8,
    y: currentY - 28,
    size: 8,
    font: fontBold,
    color: colorSlateDark,
  });

  const balAmt = formatRupees(fin.balanceDue || 0);
  const balStatus = Number(fin.balanceDue || 0) <= 0
    ? `Full Paid: ${fin.fullPaymentDate || 'Settled'}`
    : (fin.balancePaidDate ? `Paid: ${fin.balancePaidDate}` : (fin.balanceDueDate ? `Due at drop: ${fin.balanceDueDate}` : 'Due at drop'));

  page.drawText(`Balance Status: ${balAmt} (${balStatus})`, {
    x: left + 260,
    y: currentY - 28,
    size: 8,
    font: fontBold,
    color: Number(fin.balanceDue || 0) <= 0 ? colorEmerald : colorOrange,
  });

  // 6. Remarks / Terms & Conditions Box
  currentY = settleBoxY - 14;
  const termsBoxHeight = 36;
  const termsBoxY = currentY - termsBoxHeight;

  page.drawRectangle({
    x: left,
    y: termsBoxY,
    width: width,
    height: termsBoxHeight,
    color: colorLightBg,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  page.drawText('REMARKS & CONDITIONS:', {
    x: left + 8,
    y: currentY - 12,
    size: 7,
    font: fontBold,
    color: colorSlateDark,
  });

  const remarksStr = invoice.remarks || 'Tolls, parking, and state permits payable at actuals. Subject to Mangaluru jurisdiction.';
  page.drawText(remarksStr.substring(0, 110), {
    x: left + 8,
    y: currentY - 23,
    size: 7,
    font: fontRegular,
    color: colorSlateMid,
  });

  // 7. Footer & Signatures
  currentY = termsBoxY - 20;
  page.drawLine({
    start: { x: left, y: currentY },
    end: { x: right, y: currentY },
    thickness: 0.5,
    color: colorBorder,
  });

  currentY -= 14;
  page.drawText('Thank you for riding with Kandy Cabs!', {
    x: left,
    y: currentY,
    size: 8,
    font: fontBold,
    color: colorNavy,
  });

  page.drawText('Computer-generated official tax invoice • Valid without physical signature', {
    x: left,
    y: currentY - 11,
    size: 7,
    font: fontRegular,
    color: colorSlateMid,
  });

  page.drawText('24x7 Customer Support: +91 9786452563 | Email: support@kandycabs.in', {
    x: left,
    y: currentY - 22,
    size: 7,
    font: fontRegular,
    color: colorSlateMid,
  });

  // Right Signatory
  page.drawText('For KANDY CABS PVT LTD', {
    x: right - 130,
    y: currentY,
    size: 8,
    font: fontBold,
    color: colorNavy,
  });

  page.drawText('Authorised Signatory', {
    x: right - 130,
    y: currentY - 12,
    size: 7,
    font: fontOblique,
    color: colorSlateMid,
  });

  page.drawText(invoice.signatory?.name || 'Mukesh Rao (Managing Director)', {
    x: right - 130,
    y: currentY - 23,
    size: 7,
    font: fontRegular,
    color: colorSlateDark,
  });

  return await pdfDoc.save();
}
