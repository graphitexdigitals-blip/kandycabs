import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, BookingStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { RealtimeEvents } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { bookingId, reason = 'Customer requested cancellation' } = body;

    if (!bookingId) {
      const res = NextResponse.json(
        { success: false, message: 'Booking ID is required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          include: { user: true },
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

    // Verify ownership
    if (booking.customer.userId !== payload.userId && booking.customer.user.phone !== payload.phone) {
      const res = NextResponse.json(
        { error: 'Forbidden', message: 'You can only cancel your own bookings' },
        { status: 403 }
      );
      return setCorsHeaders(res);
    }

    // Check if already completed or cancelled
    if (booking.status === BookingStatus.CANCELLED) {
      const res = NextResponse.json(
        { success: false, message: 'Booking is already cancelled' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    if (booking.status === BookingStatus.TRIP_STARTED || booking.status === BookingStatus.TRIP_COMPLETED) {
      const res = NextResponse.json(
        { success: false, message: 'Active or completed trips cannot be cancelled' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Enforce 2-hour cancellation rule
    const now = Date.now();
    const scheduledTime = new Date(booking.scheduledAt).getTime();
    const twoHoursInMs = 2 * 60 * 60 * 1000;

    if (scheduledTime - now < twoHoursInMs) {
      const res = NextResponse.json(
        {
          success: false,
          message:
            'Free cancellation is only permitted at least 2 hours prior to scheduled pickup time. Please contact support.',
        },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Atomic Cancellation Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Booking status to CANCELLED
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });

      // 2. Insert TripEvent
      await tx.tripEvent.create({
        data: {
          bookingId,
          type: 'BOOKING_CANCELLED',
          payloadJson: {
            cancelledBy: 'CUSTOMER',
            reason: reason.trim(),
            refundEligible: true,
            advancePaid: Number(booking.advanceAmount),
            timestamp: new Date().toISOString(),
          },
        },
      });

      // 3. Insert AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: payload.userId,
          action: 'CANCEL_BOOKING',
          entityType: 'Booking',
          entityId: bookingId,
          reason: `Customer cancelled ride: ${reason.trim()} (Refund eligible: true)`,
        },
      });

      return updated;
    }, {
      maxWait: 10000,
      timeout: 25000,
    });

    // Realtime SSE: Notify assigned driver if any
    if (booking.assignedDriverId) {
      RealtimeEvents.emitToDriver(booking.assignedDriverId, 'TRIP_STATUS', {
        bookingId,
        status: BookingStatus.CANCELLED,
        reason,
      });
    }

    // Realtime SSE: Revoke any pending broadcasts
    RealtimeEvents.emitToAllDrivers('DISPATCH_REVOKED', {
      bookingId,
      status: BookingStatus.CANCELLED,
    });

    // Realtime SSE: Notify customer tracking stream
    RealtimeEvents.emitToBooking(bookingId, 'BOOKING_STATUS', {
      bookingId,
      status: BookingStatus.CANCELLED,
      reason,
    });

    const response = NextResponse.json(
      {
        success: true,
        refundEligible: true,
        booking: result,
        message: 'Booking cancelled successfully. Your advance payment is eligible for refund.',
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in POST /api/customer/cancel-booking:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to cancel booking' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
