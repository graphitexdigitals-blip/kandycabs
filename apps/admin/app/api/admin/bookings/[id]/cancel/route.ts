import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getAdminSession } from '@/lib/auth';
import {
  BookingStatus,
  DEFAULT_CANCELLATION_CONFIG,
  CancellationRatesConfig,
  evaluateCancellationCharge,
} from '@kandy-cabs/shared';
import { RealtimeEvents } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin privileges required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const reason = (body.reason || 'Cancelled by Admin Operations').trim();
    const waiveCharge = Boolean(body.waiveCharge);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { include: { user: true } },
        vehicle: true,
        tripEvents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return NextResponse.json(
        { success: false, message: 'Booking is already cancelled' },
        { status: 400 }
      );
    }

    if (booking.status === BookingStatus.TRIP_COMPLETED) {
      return NextResponse.json(
        { success: false, message: 'Completed trips cannot be cancelled' },
        { status: 400 }
      );
    }

    // Load cancellation settings
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
      console.warn('Could not load dynamic cancellation config:', e);
    }

    const category =
      booking.vehicle?.category ||
      (booking.tripEvents?.find((e: any) => e.type === 'BOOKING_CREATED')?.payloadJson as any)?.category ||
      'SEDAN';

    const cancellationEvaluation = evaluateCancellationCharge(
      booking.scheduledAt,
      category,
      new Date(),
      cancellationConfig,
      booking.tripType
    );

    const advancePaid = Number(booking.advanceAmount || 0);
    const cancellationCharge = waiveCharge ? 0 : (typeof body.customCharge === 'number' ? body.customCharge : cancellationEvaluation.cancellationCharge);
    const refundAmount = Math.max(0, advancePaid - cancellationCharge);
    const isWithinWindow = cancellationEvaluation.isWithinWindow;
    const hoursUntilPickup = cancellationEvaluation.hoursUntilPickup;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });

      await tx.tripEvent.create({
        data: {
          bookingId: id,
          type: 'BOOKING_CANCELLED',
          payloadJson: {
            cancelledBy: 'ADMIN',
            adminUserId: session.userId,
            reason,
            category,
            cancellationCharge,
            waiveCharge,
            refundAmount,
            advancePaid,
            isWithinWindow,
            hoursUntilPickup,
            refundEligible: refundAmount > 0,
            timestamp: new Date().toISOString(),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: 'ADMIN_CANCEL_BOOKING',
          entityType: 'Booking',
          entityId: id,
          reason: `Admin cancelled booking. Reason: ${reason}. Cancellation Charge: ₹${cancellationCharge}${waiveCharge ? ' (Fee Waived)' : ''}. Advance: ₹${advancePaid}, Refund: ₹${refundAmount}. Hours to pickup: ${hoursUntilPickup}h`,
        },
      });

      return updated;
    });

    // Realtime SSE: Notify assigned driver if any
    if (booking.assignedDriverId) {
      RealtimeEvents.emitToDriver(booking.assignedDriverId, 'TRIP_STATUS', {
        bookingId: id,
        status: BookingStatus.CANCELLED,
        reason,
        cancellationCharge,
      });
    }

    // Realtime SSE: Revoke any pending broadcasts
    RealtimeEvents.emitToAllDrivers('DISPATCH_REVOKED', {
      bookingId: id,
      status: BookingStatus.CANCELLED,
    });

    // Realtime SSE: Notify customer tracking stream
    RealtimeEvents.emitToBooking(id, 'BOOKING_STATUS', {
      bookingId: id,
      status: BookingStatus.CANCELLED,
      reason,
      cancellationCharge,
      refundAmount,
    });

    return NextResponse.json({
      success: true,
      message: `Booking cancelled successfully. Cancellation Charge: ₹${cancellationCharge}, Refund: ₹${refundAmount}`,
      booking: result,
      cancellationCharge,
      refundAmount,
      advancePaid,
      isWithinWindow,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/bookings/[id]/cancel:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}

