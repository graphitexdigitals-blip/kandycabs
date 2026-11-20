import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { prisma } from '@kandy-cabs/db';
import { getAdminSession } from '@/lib/auth';
import { uploadBulkInvoicesZip } from '@/lib/supabase-storage';
import {
  buildKandyInvoiceData,
  generateKandyInvoiceHtml,
  UserRole,
  PaymentStatus,
  BookingStatus,
} from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const adminSession = await getAdminSession(req);
    if (!adminSession || !adminSession.roles || !adminSession.roles.includes(UserRole.ADMIN)) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate')?.trim();
    const endDate = searchParams.get('endDate')?.trim();
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search')?.trim() || '';

    // Build filter conditions
    const andConditions: any[] = [];

    if (startDate || endDate) {
      const dateRange: any = {};
      if (startDate) {
        dateRange.gte = new Date(`${startDate}T00:00:00.000+05:30`);
      }
      if (endDate) {
        dateRange.lte = new Date(`${endDate}T23:59:59.999+05:30`);
      }
      andConditions.push({ createdAt: dateRange });
    }

    if (status === 'CUSTOMER_NO_PENDING' || status === 'PAID') {
      andConditions.push({
        advancePaymentStatus: PaymentStatus.PAID,
        OR: [
          { balancePaymentStatus: PaymentStatus.PAID },
          { balanceAmount: { lte: 0 } },
        ],
      });
    } else if (status === 'CUSTOMER_FULL_PAYMENT') {
      andConditions.push({
        advancePaymentStatus: PaymentStatus.PAID,
        balanceAmount: { lte: 0 },
      });
    } else if (status === 'CUSTOMER_ADV_RECEIVED') {
      andConditions.push({
        advancePaymentStatus: PaymentStatus.PAID,
      });
    } else if (status === 'CUSTOMER_ADV_BALANCE_PENDING' || status === 'PARTIALLY_PAID') {
      andConditions.push({
        advancePaymentStatus: PaymentStatus.PAID,
        balancePaymentStatus: PaymentStatus.PENDING,
        balanceAmount: { gt: 0 },
      });
    } else if (status === 'CUSTOMER_PENDING' || status === 'PAY_LATER' || status === 'PENDING') {
      andConditions.push({
        OR: [
          { balancePaymentStatus: PaymentStatus.PENDING, balanceAmount: { gt: 0 } },
          { advancePaymentStatus: PaymentStatus.PENDING },
        ],
      });
    } else if (status === 'CANCELLED') {
      andConditions.push({
        status: BookingStatus.CANCELLED,
      });
    } else if (status === 'DRIVER_PAID') {
      andConditions.push({
        driverPaymentStatus: PaymentStatus.PAID,
        assignedDriverId: { not: null },
      });
    } else if (status === 'DRIVER_UNPAID') {
      andConditions.push({
        driverPaymentStatus: PaymentStatus.PENDING,
        assignedDriverId: { not: null },
      });
    }

    if (search) {
      andConditions.push({
        OR: [
          { humanReadableRef: { contains: search, mode: 'insensitive' } },
          { customer: { user: { fullName: { contains: search, mode: 'insensitive' } } } },
          { customer: { user: { phone: { contains: search, mode: 'insensitive' } } } },
          { assignedDriver: { user: { fullName: { contains: search, mode: 'insensitive' } } } },
          { assignedDriver: { user: { phone: { contains: search, mode: 'insensitive' } } } },
          { payments: { some: { razorpayPaymentId: { contains: search, mode: 'insensitive' } } } },
          { payments: { some: { razorpayOrderId: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }

    const whereClause: any = andConditions.length > 0 ? { AND: andConditions } : {};

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 500, // Safe batch limit
      include: {
        customer: {
          include: {
            user: { select: { fullName: true, phone: true } },
          },
        },
        assignedDriver: {
          include: {
            user: { select: { fullName: true, phone: true } },
            vehicles: true,
          },
        },
        vehicle: true,
        tripEvents: {
          where: { type: { in: ['BOOKING_CREATED', 'BOOKING_CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { verifiedAt: 'desc' },
        },
      },
    });

    if (bookings.length === 0) {
      return NextResponse.json(
        { error: 'No bookings found matching the selected date range and filters.' },
        { status: 404 }
      );
    }

    // Build friendly folder name based on date selection
    let dateSlug = 'All_Dates';
    if (startDate && endDate) {
      dateSlug = `${startDate}_to_${endDate}`;
    } else if (startDate) {
      dateSlug = `From_${startDate}`;
    } else if (endDate) {
      dateSlug = `Until_${endDate}`;
    }

    const zip = new JSZip();
    const folderName = `KandyCabs_Invoices_${dateSlug}`;
    const folder = zip.folder(folderName) || zip;

    // Track summary for the consolidated index
    const summaryRows: Array<{
      ref: string;
      date: string;
      customer: string;
      phone: string;
      pickup: string;
      drop: string;
      fare: number;
      advance: number;
      advancePaidDate: string;
      balance: number;
      remainingPaymentDate: string;
      fullPaymentDate: string;
      status: string;
      filename: string;
    }> = [];

    for (const b of bookings) {
      try {
        const invoiceData = buildKandyInvoiceData(b);
        const safeCustomerName = (b.customer?.user?.fullName || 'Customer')
          .trim()
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .substring(0, 30);

        const htmlContent = generateKandyInvoiceHtml(invoiceData);
        const fileName = `Invoice_${b.humanReadableRef}_${safeCustomerName}.html`;
        folder.file(fileName, htmlContent);

        const bookingDateStr = b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const advPaidDateStr = invoiceData.financials?.advancePaidDate || (b.advancePaymentStatus === PaymentStatus.PAID ? bookingDateStr : 'Pending');
        const fullPayDateStr = invoiceData.financials?.fullPaymentDate || (invoiceData.financials?.balanceDue === 0 ? bookingDateStr : 'Pending');
        const remPayDateStr = invoiceData.financials?.balancePaidDate
          ? `Paid: ${invoiceData.financials.balancePaidDate}`
          : (invoiceData.financials?.balanceDueDate ? `Due: ${invoiceData.financials.balanceDueDate}` : 'Pending');

        summaryRows.push({
          ref: b.humanReadableRef,
          date: bookingDateStr,
          customer: b.customer?.user?.fullName || 'Customer',
          phone: b.customer?.user?.phone || '—',
          pickup: b.pickupAddress || '—',
          drop: b.dropAddress || '—',
          fare: Number(b.estimatedFare || 0),
          advance: Number(b.advanceAmount || 0),
          advancePaidDate: advPaidDateStr,
          balance: Number(b.balanceAmount || 0),
          remainingPaymentDate: remPayDateStr,
          fullPaymentDate: fullPayDateStr,
          status: b.status,
          filename: fileName,
        });
      } catch (err) {
        console.error(`Failed to generate invoice for booking ${b.humanReadableRef}:`, err);
      }
    }

    // Add a beautiful consolidated Master Index HTML inside the folder
    const masterIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Kandy Cabs Invoices Master Index — ${dateSlug}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 28px; }
    .header { background: #0f172a; color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { margin: 0 0 6px 0; font-size: 22px; }
    .header p { margin: 0; font-size: 13px; color: #94a3b8; }
    .card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
    th { background: #f1f5f9; padding: 10px 14px; font-weight: 700; color: #334155; border-bottom: 1px solid #cbd5e1; }
    td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tr:hover { background: #f8fafc; }
    a.btn { display: inline-block; padding: 4px 10px; background: #fa4f01; color: white; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 11px; }
    a.btn:hover { background: #e04500; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-weight: 700; font-size: 10px; background: #e2e8f0; color: #1e293b; }
    .badge.paid { background: #dcfce7; color: #166534; }
    .badge.pending { background: #fef3c7; color: #92400e; }
    .badge.cancelled { background: #ffe4e6; color: #9f1239; }
    .total-bar { padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-weight: 700; display: flex; justify-content: space-between; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Kandy Cabs — Tax Invoices Archive</h1>
    <p>Generated for Period: <strong>${dateSlug.replace(/_/g, ' ')}</strong> &bull; Total Invoices in this Folder: <strong>${summaryRows.length}</strong></p>
  </div>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Booking Ref</th>
          <th>Booking Date</th>
          <th>Customer Name</th>
          <th>Route</th>
          <th>Total Fare</th>
          <th>Advance (Paid Date)</th>
          <th>Balance (Paid / Due Date)</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${summaryRows
          .map(
            (r) => `
        <tr>
          <td><strong>${r.ref}</strong></td>
          <td>${r.date}</td>
          <td>${r.customer}<br/><span style="color:#64748b;font-size:11px;">${r.phone}</span></td>
          <td><span style="font-size:11px;">${r.pickup} &rarr; ${r.drop}</span></td>
          <td><strong>₹${r.fare.toLocaleString('en-IN')}</strong></td>
          <td>
            <span style="color:#16a34a;font-weight:700;">₹${r.advance.toLocaleString('en-IN')}</span><br/>
            <span style="font-size:10px;color:#64748b;">${r.advancePaidDate}</span>
          </td>
          <td>
            <span style="color:#ca8a04;font-weight:700;">₹${r.balance.toLocaleString('en-IN')}</span><br/>
            <span style="font-size:10px;color:#64748b;">${r.remainingPaymentDate}</span>
          </td>
          <td><span class="badge ${r.status === 'CANCELLED' ? 'cancelled' : r.balance === 0 ? 'paid' : 'pending'}">${r.status}</span></td>
          <td><a class="btn" href="${r.filename}" target="_blank">Open PDF 📄</a></td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
    <div class="total-bar">
      <span>Total Invoices: ${summaryRows.length} (Direct PDF Format)</span>
      <span>Total Fare Amount: ₹${summaryRows.reduce((acc, r) => acc + r.fare, 0).toLocaleString('en-IN')}</span>
    </div>
  </div>
</body>
</html>`;

    folder.file('00_Invoices_Master_Index.html', masterIndexHtml);

    // Also add a clean CSV for accountant / spreadsheet usage with UTF-8 BOM, payment dates, and Excel-safe text dates
    const csvHeader = '\uFEFFBooking Ref,Booking Date,Customer Name,Phone,Pickup,Drop,Total Fare,Advance Paid,Advance Paid Date,Balance Amount,Remaining Payment Date/Due,Full Payment Date,Status,Invoice PDF File\n';
    const csvContent = summaryRows
      .map(
        (r) =>
          `"${r.ref}","=""${r.date}""","${r.customer.replace(/"/g, '""')}","${r.phone}","${r.pickup.replace(/"/g, '""')}","${r.drop.replace(/"/g, '""')}",${r.fare},${r.advance},"${r.advancePaidDate}",${r.balance},"${r.remainingPaymentDate}","${r.fullPaymentDate}","${r.status}","${r.filename}"`
      )
      .join('\n');
    folder.file('00_Invoices_Ledger.csv', csvHeader + csvContent);

    // Generate zip buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    // Upload archive to Supabase Cloud Storage
    const cloudUrl = await uploadBulkInvoicesZip({
      zipBuffer,
      fileName: `${folderName}.zip`,
    });

    const wantsJson = req.headers.get('accept')?.includes('application/json') || req.nextUrl.searchParams.get('format') === 'json';
    if (wantsJson && cloudUrl) {
      return NextResponse.json({
        success: true,
        downloadUrl: cloudUrl,
        fileName: `${folderName}.zip`,
        count: summaryRows.length,
      });
    }

    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="${folderName}.zip"`);
    headers.set('Cache-Control', 'no-store, max-age=0');
    if (cloudUrl) {
      headers.set('X-Cloud-Storage-Url', cloudUrl);
    }

    return new Response(new Uint8Array(zipBuffer), { status: 200, headers });
  } catch (error: any) {
    console.error('Error in bulk invoice export:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate bulk invoices ZIP' },
      { status: 500 }
    );
  }
}
