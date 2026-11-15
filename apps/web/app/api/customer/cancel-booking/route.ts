import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  verifyAuthToken,
  BookingStatus,
  DEFAULT_CANCELLATION_CONFIG,
  CancellationRatesConfig,
  evaluateCancellationCharge,
} from '@kandy-cabs/shared';
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
        vehicle: true,
        tripEvents: {
          orderBy: { createdAt: 'desc' },
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

    // Fetch active cancellation policy configuration
    let cancellationConfig: CancellationRatesConfig = DEFAULT_CANCELLATION_CONFIG;
    try {
      const rows = (await prisma.$queryRawUnsafe(`
        SELECT "value" FROM "SystemSetting" WHERE "key" = 'cancellation_charges' LIMIT 1;
      `)) as any[];
      if (rows && rows.length > 0 && rows[0].value) {
        const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        cancellationConfig = {
          windowHours: typeof val.windowHours === 'number' ? val.windowHours : DEFAULT_CANCELLATION_CONFIG.windowHours,
          rates: {
            ...DEFAULT_CANCELLATION_CONFIG.rates,
            ...(val.rates || {}),
          },
          tripTypeRules: val.tripTypeRules,
        };
      }
    } catch (e) {
      console.warn('Could not load dynamic cancellation config, using default:', e);
    }

    // Determine category of booking
    const category =
      booking.vehicle?.category ||
      (booking.tripEvents?.find((e: any) => e.type === 'BOOKING_CREATED')?.payloadJson as any)?.category ||
      'SEDAN';

    const advancePaid = Number(booking.advanceAmount || 0);

    // Evaluate cancellation fee based on tripType policy (Advance Non-Refundable, Fixed Fleet Rate, or Free)
    const cancellationEvaluation = evaluateCancellationCharge(
      booking.scheduledAt,
      category,
      new Date(),
      cancellationConfig,
      booking.tripType,
      advancePaid
    );

    const cancellationCharge = cancellationEvaluation.cancellationCharge;
    const refundAmount = cancellationEvaluation.refundAmount;
    const isWithinWindow = cancellationEvaluation.isWithinWindow;
    const hoursUntilPickup = cancellationEvaluation.hoursUntilPickup;
    const mode = cancellationEvaluation.mode;
    const isAdvanceNonRefundable = cancellationEvaluation.isAdvanceNonRefundable;

    // Atomic Cancellation Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Booking status to CANCELLED
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });

      // 2. Insert TripEvent with full cancellation breakdown
      await tx.tripEvent.create({
        data: {
          bookingId,
          type: 'BOOKING_CANCELLED',
          payloadJson: {
            cancelledBy: 'CUSTOMER',
            reason: reason.trim(),
            category,
            tripType: booking.tripType,
            mode,
            cancellationCharge,
            refundAmount,
            advancePaid,
            isWithinWindow,
            isAdvanceNonRefundable,
            hoursUntilPickup,
            refundEligible: refundAmount > 0,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // 3. Insert AuditLog
      let auditReason = '';
      if (mode === 'ADVANCE_NON_REFUNDABLE') {
        auditReason = `Customer cancelled ride (${booking.tripType}). Advance Non-Refundable policy applied: Advance of ₹${advancePaid} retained as cancellation fee. Refund: ₹0. Reason: ${reason.trim()}`;
      } else if (mode === 'FREE' || cancellationCharge === 0) {
        auditReason = `Customer cancelled ride (${booking.tripType}, ${hoursUntilPickup}h before pickup). Free cancellation applied. Full advance of ₹${refundAmount} eligible for refund. Reason: ${reason.trim()}`;
      } else {
        auditReason = `Customer cancelled ride (${booking.tripType}) within ${cancellationEvaluation.windowHours}h of pickup (${hoursUntilPickup}h left). Fleet fee of ₹${cancellationCharge} applied to ${category}. Advance: ₹${advancePaid}, Net Refund: ₹${refundAmount}. Reason: ${reason.trim()}`;
      }

      await tx.auditLog.create({
        data: {
          actorUserId: payload.userId,
          action: 'CANCEL_BOOKING',
          entityType: 'Booking',
          entityId: bookingId,
          reason: auditReason,
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
        cancellationCharge,
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
      cancellationCharge,
      refundAmount,
      mode,
    });

    let successMessage = '';
    if (mode === 'ADVANCE_NON_REFUNDABLE') {
      successMessage = `Booking cancelled. As per the cancellation policy for ${booking.tripType || 'this ride'}, the advance payment of ₹${advancePaid} is non-refundable and has been charged as the cancellation fee.`;
    } else if (cancellationCharge > 0) {
      successMessage = `Booking cancelled. A cancellation fee of ₹${cancellationCharge} was applied as the ride was cancelled within ${cancellationEvaluation.windowHours} hours of scheduled pickup. Net refund of ₹${refundAmount.toFixed(2)} will be processed.`;
    } else {
      successMessage = `Booking cancelled successfully with free cancellation. Full advance of ₹${refundAmount.toFixed(2)} will be refunded.`;
    }

    const response = NextResponse.json(
      {
        success: true,
        mode,
        cancellationCharge,
        refundAmount,
        advancePaid,
        isWithinWindow,
        isAdvanceNonRefundable,
        refundEligible: refundAmount > 0,
        booking: result,
        message: successMessage,
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
