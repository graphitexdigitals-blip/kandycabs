import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { BookingStatus, DispatchStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { RealtimeEvents } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const session = await getDriverSession(req);
    if (!session) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Driver authentication required' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const body = await req.json();
    const { dispatchId, bookingId, reason } = body;

    if (!dispatchId || !bookingId) {
      const res = NextResponse.json(
        { success: false, message: 'Dispatch ID and Booking ID are required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Atomic Transaction for Driver Decline
    await prisma.$transaction(async (tx) => {
      // 1. Mark this driver's dispatch as EXPIRED/DECLINED
      await tx.bookingDispatch.updateMany({
        where: {
          id: dispatchId,
          driverId: session.driverId,
        },
        data: {
          status: DispatchStatus.EXPIRED,
          respondedAt: new Date(),
        },
      });

      // 2. If the booking was assigned to this driver, unassign so admin can re-dispatch
      await tx.booking.updateMany({
        where: {
          id: bookingId,
          assignedDriverId: session.driverId,
        },
        data: {
          assignedDriverId: null,
          status: BookingStatus.DISPATCHED,
        },
      });

      // 3. Record TripEvent for admin panel tracking
      await tx.tripEvent.create({
        data: {
          bookingId,
          type: 'DRIVER_DECLINED',
          payloadJson: {
            driverId: session.driverId,
            driverName: session.user.fullName,
            driverPhone: session.user.phone,
            dispatchId,
            reason: reason || 'Declined by driver from mobile app',
            timestamp: new Date().toISOString(),
          },
        },
      });

      // 4. Record AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: 'DRIVER_DECLINE_DISPATCH',
          entityType: 'Booking',
          entityId: bookingId,
          reason: `Driver ${session.user.fullName} declined ride dispatch.`,
        },
      });
    });

    // 5. Realtime SSE: Broadcast decline to admin & booking channel
    RealtimeEvents.emitToBooking(bookingId, 'BOOKING_STATUS', {
      bookingId,
      status: BookingStatus.DISPATCHED,
      driverDeclined: true,
      driverId: session.driverId,
      driverName: session.user.fullName,
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Ride declined successfully. Admin has been notified.',
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/dispatches/decline:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to decline dispatch' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

