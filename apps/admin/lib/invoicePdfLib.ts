import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { KandyInvoiceData, KANDY_LOGO_BASE64 } from '@kandy-cabs/shared';

function formatRupees(amount: number | undefined | null): string {
  const val = Number(amount || 0);
  return `Rs. ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generates an official, compliant vector PDF Tax Invoice for Kandy Cabs
 * using pure TypeScript pdf-lib with zero native/ESM fontkit dependencies.
 * Conforms exactly to the customer invoice design, featuring the official
 * Kandy Cabs logo, warm peach taxable highlights, vibrant orange total banner,
 * and clean computerized footer with no signature or unauthorized names.
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

  // Palette colors matching Customer Invoice design
  const colorNavy = rgb(0.086, 0.133, 0.196); // #162232
  const colorOrange = rgb(0.969, 0.290, 0.004); // #F74A01 (Kandy Orange)
  const colorSlateDark = rgb(0.2, 0.25, 0.33); // #334155
  const colorSlateMid = rgb(0.4, 0.45, 0.53); // #64748B
  const colorBorder = rgb(0.88, 0.91, 0.94); // #E2E8F0
  const colorLightBg = rgb(0.97, 0.98, 0.99); // #F8FAFC
  const colorPeachBg = rgb(1.0, 0.969, 0.929); // #FFF7ED (Taxable peach highlight)
  const colorPeachBorder = rgb(0.996, 0.843, 0.667); // #FED7AA
  const colorEmerald = rgb(0.02, 0.47, 0.34); // #057A55

  const left = 36;
  const right = 595.28 - 36;
  const width = right - left; // 523.28

  // Coordinate tracking (y = 0 at bottom)
  const top = 841.89 - 36; // 805.89
  let currentY = top;

  // ----------------------------------------------------
  // 1. Header: KANDY CABS Official Logo (Left) + Company Info (Right)
  // ----------------------------------------------------
  let logoEmbedded = false;
  try {
    const cleanBase64 = KANDY_LOGO_BASE64.replace(/^data:image\/\w+;base64,/, '');
    const imgBytes = Buffer.from(cleanBase64, 'base64');
    const logoImg = await pdfDoc.embedPng(imgBytes);
    // Aspect ratio: 605 x 313 (1.933)
    const logoW = 98;
    const logoH = 50.7;
    page.drawImage(logoImg, {
      x: left,
      y: currentY - logoH - 2,
      width: logoW,
      height: logoH,
    });
    logoEmbedded = true;
  } catch (err) {
    console.warn('[invoicePdfLib] Fallback to vector brand text:', err);
  }

  if (!logoEmbedded) {
    page.drawText('KANDY CABS', {
      x: left,
      y: currentY - 18,
      size: 20,
      font: fontBold,
      color: colorOrange,
    });
    page.drawText('Safe | Reliable | Hassle-Free', {
      x: left,
      y: currentY - 32,
      size: 8,
      font: fontBold,
      color: colorSlateMid,
    });
  }

  // Right-aligned company header details
  const company = invoice.company || {
    name: 'KANDY CABS',
    tagline: 'Safe | Reliable | Hassle-Free',
    gstin: '29AIEPR4688P1Z4',
    website: 'www.kandycabs.in',
    email: 'kandycabsmlr@gmail.com',
  };

  const compTitle = company.name || 'KANDY CABS';
  const compTitleW = fontBold.widthOfTextAtSize(compTitle, 15);
  page.drawText(compTitle, {
    x: right - compTitleW,
    y: currentY - 14,
    size: 15,
    font: fontBold,
    color: colorNavy,
  });

  const tagline = company.tagline || 'Safe | Reliable | Hassle-Free';
  const tagW = fontBold.widthOfTextAtSize(tagline, 8);
  page.drawText(tagline, {
    x: right - tagW,
    y: currentY - 26,
    size: 8,
    font: fontBold,
    color: colorSlateMid,
  });

  const gstinStr = `GSTIN: ${company.gstin || '29AIEPR4688P1Z4'}`;
  const gstinW = fontBold.widthOfTextAtSize(gstinStr, 8.5);
  page.drawText(gstinStr, {
    x: right - gstinW,
    y: currentY - 38,
    size: 8.5,
    font: fontBold,
    color: colorNavy,
  });

  const contactStr = `${company.website || 'www.kandycabs.in'} • ${company.email || 'kandycabsmlr@gmail.com'}`;
  const contactW = fontRegular.widthOfTextAtSize(contactStr, 7.5);
  page.drawText(contactStr, {
    x: right - contactW,
    y: currentY - 49,
    size: 7.5,
    font: fontRegular,
    color: colorSlateDark,
  });

  currentY -= 58;

  // ----------------------------------------------------
  // 2. Full-Width Navy Banner: TAX INVOICE
  // ----------------------------------------------------
  const bannerH = 18;
  const isCancelled = Boolean(invoice.cancellation?.isCancelled || invoice.bookingStatus === 'CANCELLED');
  page.drawRectangle({
    x: left,
    y: currentY - bannerH,
    width: width,
    height: bannerH,
    color: isCancelled ? rgb(0.745, 0.07, 0.235) : colorNavy,
  });

  const bannerTitle = isCancelled
    ? 'TAX INVOICE / CANCELLATION VOUCHER (CANCELLED)'
    : 'TAX INVOICE';
  const bannerTitleW = fontBold.widthOfTextAtSize(bannerTitle, 9);
  page.drawText(bannerTitle, {
    x: left + (width - bannerTitleW) / 2,
    y: currentY - 12.5,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  currentY -= bannerH + 8;

  // ----------------------------------------------------
  // 3. Customer & Trip Details: Two Side-by-Side Cards
  // ----------------------------------------------------
  const boxH = 80;
  const gap = 10;
  const boxW = (width - gap) / 2;
  const boxY = currentY - boxH;

  // Box 1: Billed To Customer
  page.drawRectangle({
    x: left,
    y: boxY,
    width: boxW,
    height: boxH,
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

  page.drawText(`Name: ${invoice.customer?.name || 'Customer'}`, {
    x: left + 8,
    y: currentY - 28,
    size: 8,
    font: fontBold,
    color: colorSlateDark,
  });

  page.drawText(`Phone: ${invoice.customer?.phone || 'On file'}`, {
    x: left + 8,
    y: currentY - 40,
    size: 7.5,
    font: fontRegular,
    color: colorSlateDark,
  });

  const pickupStr = (invoice.customer?.pickupAddress || 'Address on file').substring(0, 50);
  page.drawText(`Pickup: ${pickupStr}`, {
    x: left + 8,
    y: currentY - 52,
    size: 7.5,
    font: fontRegular,
    color: colorSlateMid,
  });

  // Box 2: Booking & Trip Particulars
  const box2X = left + boxW + gap;
  page.drawRectangle({
    x: box2X,
    y: boxY,
    width: boxW,
    height: boxH,
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

  page.drawText(`Booking Ref: #${invoice.bookingRef || invoice.invoiceNumber}`, {
    x: box2X + 8,
    y: currentY - 28,
    size: 8,
    font: fontBold,
    color: colorOrange,
  });

  const routeStr = (invoice.tripDetails?.route || 'Custom Trip Route').substring(0, 48);
  page.drawText(`Route: ${routeStr}`, {
    x: box2X + 8,
    y: currentY - 40,
    size: 7.5,
    font: fontRegular,
    color: colorSlateDark,
  });

  const tripMeta = `${invoice.tripDetails?.tripType || 'Outstation'} | ${invoice.tripDetails?.kmLimit || 'Distance Limit'}`;
  page.drawText(tripMeta.substring(0, 48), {
    x: box2X + 8,
    y: currentY - 52,
    size: 7.5,
    font: fontRegular,
    color: colorSlateMid,
  });

  const cabMeta = `Cab: ${invoice.tripDetails?.passengers || 'AC Commercial Cab'}`;
  page.drawText(cabMeta.substring(0, 48), {
    x: box2X + 8,
    y: currentY - 64,
    size: 7.5,
    font: fontRegular,
    color: colorSlateMid,
  });

  currentY = boxY - 12;

  // ----------------------------------------------------
  // 4. INVOICE PARTICULARS Table (Two-Column Layout matching Customer App)
  // ----------------------------------------------------
  page.drawText('INVOICE PARTICULARS', {
    x: left + 1,
    y: currentY - 2,
    size: 8,
    font: fontBold,
    color: colorNavy,
  });

  currentY -= 8;

  // Table Header
  const thHeight = 18;
  page.drawRectangle({
    x: left,
    y: currentY - thHeight,
    width: width,
    height: thHeight,
    color: colorLightBg,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  page.drawText('Description of Service', {
    x: left + 8,
    y: currentY - 12.5,
    size: 7.5,
    font: fontBold,
    color: colorNavy,
  });

  const thAmtTitle = 'Amount';
  const thAmtW = fontBold.widthOfTextAtSize(thAmtTitle, 7.5);
  page.drawText(thAmtTitle, {
    x: right - 8 - thAmtW,
    y: currentY - 12.5,
    size: 7.5,
    font: fontBold,
    color: colorNavy,
  });

  currentY -= thHeight;

  // Helper to draw a table row
  const drawRow = (desc: string, amountStr: string, isPeach = false, isBold = false) => {
    const rowH = 17;
    page.drawRectangle({
      x: left,
      y: currentY - rowH,
      width: width,
      height: rowH,
      color: isPeach ? colorPeachBg : rgb(1, 1, 1),
      borderColor: isPeach ? colorPeachBorder : colorBorder,
      borderWidth: 1,
    });

    page.drawText(desc.substring(0, 72), {
      x: left + 8,
      y: currentY - 11.5,
      size: 7.5,
      font: isBold ? fontBold : fontRegular,
      color: colorSlateDark,
    });

    const amtW = (isBold ? fontBold : fontRegular).widthOfTextAtSize(amountStr, 7.5);
    page.drawText(amountStr, {
      x: right - 8 - amtW,
      y: currentY - 11.5,
      size: 7.5,
      font: isBold ? fontBold : fontRegular,
      color: isBold ? colorNavy : colorSlateDark,
    });

    currentY -= rowH;
  };

  const fin = invoice.financials || ({} as any);

  // Line item 1: Base service
  const serviceDesc = fin.serviceDescription || `Passenger Transportation Service (${invoice.tripDetails?.kmLimit || 'Trip'})`;
  drawRow(serviceDesc, formatRupees(fin.serviceAmount || fin.taxableValue || 0));

  // Chauffeur Day Allowance
  if (Number(fin.chauffeurAllowance || 0) > 0) {
    drawRow('Chauffeur Day Allowance', formatRupees(fin.chauffeurAllowance));
  }

  // Toll Charges
  if (Number(fin.tollAmount || 0) > 0) {
    drawRow('Highway Toll Charges (FASTag)', formatRupees(fin.tollAmount));
  }

  // Parking Charges
  if (Number(fin.parkingAmount || 0) > 0) {
    drawRow('Airport & Parking Charges', formatRupees(fin.parkingAmount));
  }

  // Pet Fee
  if (Number(fin.petFee || 0) > 0) {
    drawRow('Pet Friendly Sanitization Fee', formatRupees(fin.petFee));
  }

  // Extra Km Amount
  if (Number(fin.extraKmAmount || 0) > 0) {
    drawRow('Additional Distance Charges', formatRupees(fin.extraKmAmount));
  }

  // Warm Peach Taxable Value Highlight Row
  const taxVal = Number(fin.taxableValue || (fin.grandTotal ? fin.grandTotal / 1.05 : 0));
  drawRow('Taxable Value', formatRupees(taxVal), true, true);

  // CGST & SGST
  const cgstVal = Number(fin.cgst || (fin.gstTotal ? fin.gstTotal / 2 : 0));
  const sgstVal = Number(fin.sgst || cgstVal);
  drawRow('CGST @ 2.5%', formatRupees(cgstVal));
  drawRow('SGST @ 2.5%', formatRupees(sgstVal));

  currentY -= 6;

  // ----------------------------------------------------
  // 5. Vibrant Brand Orange GRAND TOTAL Banner
  // ----------------------------------------------------
  const gtH = 22;
  page.drawRectangle({
    x: left,
    y: currentY - gtH,
    width: width,
    height: gtH,
    color: colorOrange,
  });

  page.drawText('GRAND TOTAL (INCLUDING GST)', {
    x: left + 10,
    y: currentY - 15,
    size: 8.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  const gtAmtStr = formatRupees(fin.grandTotal || 0);
  const gtAmtW = fontBold.widthOfTextAtSize(gtAmtStr, 11);
  page.drawText(gtAmtStr, {
    x: right - 10 - gtAmtW,
    y: currentY - 15.5,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  currentY -= gtH + 7;

  // ----------------------------------------------------
  // 6. Amount in Words
  // ----------------------------------------------------
  page.drawText('Amount in Words: ', {
    x: left + 2,
    y: currentY - 8,
    size: 7.5,
    font: fontRegular,
    color: colorSlateDark,
  });

  const amtWords = invoice.amountInWords || 'Rupees Only';
  const prefixW = fontRegular.widthOfTextAtSize('Amount in Words: ', 7.5);
  page.drawText(amtWords, {
    x: left + 2 + prefixW,
    y: currentY - 8,
    size: 7.5,
    font: fontBold,
    color: colorNavy,
  });

  currentY -= 18;

  // ----------------------------------------------------
  // 7. REMARKS / PAYMENT DETAILS Box
  // ----------------------------------------------------
  const remarksBoxH = 46;
  page.drawRectangle({
    x: left,
    y: currentY - remarksBoxH,
    width: width,
    height: remarksBoxH,
    color: colorLightBg,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  page.drawText('REMARKS / PAYMENT DETAILS', {
    x: left + 8,
    y: currentY - 12,
    size: 7,
    font: fontBold,
    color: colorNavy,
  });

  const remarksBody = invoice.remarks || 'Toll and parking charges, additional kilometres beyond package limit, and chauffeur night allowance payable extra as applicable.';
  page.drawText(remarksBody.substring(0, 115), {
    x: left + 8,
    y: currentY - 23,
    size: 6.8,
    font: fontRegular,
    color: colorSlateMid,
  });

  // Payment Status Badge Strip
  const advPaid = Number(fin.advancePaid || 0);
  const advStatus = fin.advanceStatus || 'PAID';
  const balDue = Number(fin.balanceDue || 0);
  const balStatus = fin.balanceStatus || (balDue <= 0 ? 'PAID' : 'PENDING');
  const payBadge = `Advance: ${formatRupees(advPaid)} (${advStatus})   |   Balance: ${formatRupees(balDue)} (${balStatus})`;
  page.drawText(payBadge, {
    x: left + 8,
    y: currentY - 36,
    size: 7,
    font: fontBold,
    color: colorNavy,
  });

  currentY -= remarksBoxH + 16;

  // ----------------------------------------------------
  // 8. Clean Modern Footer (Zero Signatory / No Unauthorized Names)
  // ----------------------------------------------------
  page.drawLine({
    start: { x: left, y: currentY },
    end: { x: right, y: currentY },
    thickness: 0.8,
    color: colorBorder,
  });

  currentY -= 14;

  // Centered brand gratitude
  const fHeading = `Thank you for choosing ${company.name || 'KANDY CABS'}`;
  const fHeadingW = fontBold.widthOfTextAtSize(fHeading, 9);
  page.drawText(fHeading, {
    x: left + (width - fHeadingW) / 2,
    y: currentY,
    size: 9,
    font: fontBold,
    color: colorNavy,
  });

  // Centered subtitle & website
  const fSub = `${company.tagline || 'Safe | Reliable | Hassle-Free'} • ${company.website || 'www.kandycabs.in'} • ${company.email || 'kandycabsmlr@gmail.com'}`;
  const fSubW = fontRegular.widthOfTextAtSize(fSub, 7.5);
  page.drawText(fSub, {
    x: left + (width - fSubW) / 2,
    y: currentY - 11,
    size: 7.5,
    font: fontRegular,
    color: colorSlateMid,
  });

  // Right-aligned GSTIN running notice
  const fGstin = `${company.name || 'KANDY CABS'} | GSTIN: ${company.gstin || '29AIEPR4688P1Z4'}`;
  const fGstinW = fontRegular.widthOfTextAtSize(fGstin, 7);
  page.drawText(fGstin, {
    x: right - fGstinW,
    y: currentY - 21,
    size: 7,
    font: fontRegular,
    color: colorSlateMid,
  });

  return await pdfDoc.save();
}
