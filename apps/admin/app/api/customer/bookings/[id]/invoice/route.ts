import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, UserRole } from '@kandy-cabs/shared';
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

    // Server-authoritative calculations directly from database records
    const estimatedFare = Number(booking.estimatedFare);
    const advanceAmount = Number(booking.advanceAmount);
    const balanceAmount = Number(booking.balanceAmount);
    const tollAmount = Number(booking.tollAmount || 0);
    const parkingAmount = Number(booking.parkingAmount || 0);

    // Pre-tax subtotal & GST breakdown (5% flat)
    const preTaxSubtotal = Math.round((estimatedFare / 1.05) * 100) / 100;
    const gstTotal = Math.round((estimatedFare - preTaxSubtotal) * 100) / 100;
    const cgst = Math.round((gstTotal / 2) * 100) / 100;
    const sgst = Math.round((gstTotal - cgst) * 100) / 100;

    const invoiceData = {
      invoiceNumber: `INV-${booking.humanReadableRef.replace('KC-', '')}`,
      invoiceDate: new Date(booking.createdAt).toISOString(),
      booking: {
        id: booking.id,
        ref: booking.humanReadableRef,
        tripType: booking.tripType,
        status: booking.status,
        pickupAddress: booking.pickupAddress,
        dropAddress: booking.dropAddress,
        actualPickupAddress: booking.actualPickupAddress || null,
        actualDropAddress: booking.actualDropAddress || null,
        actualStartedAt: booking.actualStartedAt || null,
        actualCompletedAt: booking.actualCompletedAt || null,
        distanceKm: booking.distanceKm,
        actualDistanceKm: booking.actualDistanceKm,
      },
      customer: {
        name: booking.customer?.user?.fullName || 'Customer',
        phone: booking.customer?.user?.phone || '',
        email: booking.customer?.email || null,
      },
      driver: booking.assignedDriver
        ? {
            name: booking.assignedDriver.user.fullName,
            phone: booking.assignedDriver.user.phone,
            vehicle: booking.vehicle
              ? `${booking.vehicle.category} (${booking.vehicle.plateNumber || 'N/A'})`
              : 'Assigned Vehicle',
          }
        : null,
      financials: {
        preTaxSubtotal,
        cgst,
        sgst,
        gstTotal,
        tollAmount,
        parkingAmount,
        totalFare: estimatedFare + tollAmount + parkingAmount,
        advancePaid: advanceAmount,
        advanceStatus: booking.advancePaymentStatus,
        balanceDue: balanceAmount + tollAmount + parkingAmount,
        balanceStatus: booking.balancePaymentStatus,
      },
      payments: (booking.payments || []).map((p: any) => ({
        id: p.id,
        type: p.type,
        amount: Number(p.amount),
        razorpayOrderId: p.razorpayOrderId,
        razorpayPaymentId: p.razorpayPaymentId,
        status: p.status,
        verifiedAt: p.verifiedAt,
      })),
    };

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
