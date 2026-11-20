import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, UserRole, buildKandyInvoiceData, generateKandyInvoiceHtml } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { getAdminSession } from '@/lib/auth';
import { generateKandyInvoicePdfBytes } from '@/lib/invoicePdfLib';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let payload = null;
    const adminSession = await getAdminSession(req);
    if (adminSession && adminSession.roles && adminSession.roles.includes(UserRole.ADMIN)) {
      payload = adminSession;
    } else {
      let token = req.cookies.get('kandy_session')?.value;
      if (!token) {
        const authHeader = req.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7).trim();
        }
      }
      // Support URL token for direct browser PDF/HTML downloads
      if (!token) {
        const url = new URL(req.url);
        token = url.searchParams.get('auth') || url.searchParams.get('token') || undefined;
      }
      if (token) {
        payload = await verifyAuthToken(token);
      }
    }

    const url = new URL(req.url);
    const format = url.searchParams.get('format');
    const autoPrint = url.searchParams.get('print') === 'true';
    const isDownload = url.searchParams.get('download') === '1' || format === 'download' || format === 'pdf';
    const isPublicPdf = format === 'pdf' || isDownload;

    if (!payload?.userId && !isPublicPdf) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const { id } = params;

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [
          { id },
          { humanReadableRef: id },
        ],
      },
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

    if (!booking) {
      const res = NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    // Ownership check (Customer must own the booking, or User must be ADMIN, or public invoice PDF download)
    const isAdmin = payload?.roles && payload.roles.includes(UserRole.ADMIN);
    const isOwner =
      payload &&
      (booking.customer?.user?.phone === payload.phone ||
        booking.customerId === payload.customerId);

    if (!isAdmin && !isOwner && !isPublicPdf) {
      const res = NextResponse.json(
        { error: 'Forbidden', message: 'You do not have permission to view this invoice' },
        { status: 403 }
      );
      return setCorsHeaders(res);
    }

    // Build official Kandy Cabs invoice data
    const invoiceData = buildKandyInvoiceData(booking);

    // Prioritize PDF whenever download is requested OR format=pdf
    if (format === 'pdf' || isDownload) {
      const pdfBytes = await generateKandyInvoicePdfBytes(invoiceData);
      const disposition = isDownload ? 'attachment' : 'inline';
      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Content-Disposition', `${disposition}; filename="Kandy_Cabs_Tax_Invoice_${invoiceData.invoiceNumber}.pdf"`);
      headers.set('Cache-Control', 'public, max-age=3600');
      return new Response(pdfBytes as any, { status: 200, headers });
    }

    if (format === 'html' || autoPrint || req.headers.get('accept')?.includes('text/html')) {
      const html = generateKandyInvoiceHtml(invoiceData, { autoPrint });
      const headers = new Headers();
      headers.set('Content-Type', 'text/html; charset=utf-8');
      return new NextResponse(html, { status: 200, headers });
    }

    const response = NextResponse.json(
      {
        success: true,
        invoice: invoiceData,
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in GET /api/customer/bookings/[id]/invoice:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to generate tax invoice' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

