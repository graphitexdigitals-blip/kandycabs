import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, UserRole, buildKandyInvoiceData, generateKandyInvoiceHtml } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    if (!token) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const payload = await verifyAuthToken(token);
    if (!payload || !payload.userId) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const { id } = params;

    const booking = await prisma.booking.findUnique({
      where: { id },
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

    // Ownership check (Customer must own the booking, or User must be ADMIN)
    const isAdmin = payload.roles && payload.roles.includes(UserRole.ADMIN);
    const isOwner =
      booking.customer?.user?.phone === payload.phone ||
      booking.customerId === payload.customerId;

    if (!isAdmin && !isOwner) {
      const res = NextResponse.json(
        { error: 'Forbidden', message: 'You do not have permission to view this invoice' },
        { status: 403 }
      );
      return setCorsHeaders(res);
    }

    // Build official Kandy Cabs invoice data
    const invoiceData = buildKandyInvoiceData(booking);

    // Check request format
    const url = new URL(req.url);
    const format = url.searchParams.get('format');
    const autoPrint = url.searchParams.get('print') === 'true' || url.searchParams.get('download') === '1';

    if (format === 'html' || format === 'download' || req.headers.get('accept')?.includes('text/html')) {
      const html = generateKandyInvoiceHtml(invoiceData, { autoPrint });
      const headers = new Headers();
      headers.set('Content-Type', 'text/html; charset=utf-8');
      if (format === 'download' && url.searchParams.get('attachment') === '1') {
        headers.set('Content-Disposition', `attachment; filename="Kandy_Cabs_Tax_Invoice_${invoiceData.invoiceNumber}.html"`);
      }
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

