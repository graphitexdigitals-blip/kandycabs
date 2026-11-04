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
    const { dispatchId, bookingId } = body;

    if (!dispatchId || !bookingId) {
      const res = NextResponse.json(
        { success: false, message: 'Dispatch ID and Booking ID are required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Atomic Transaction with Concurrency Protection
    const result = await prisma.$transaction(async (tx) => {
      // 1. Attempt atomic assignment lock on the booking
      const updatedCount = await tx.booking.updateMany({
        where: {
          id: bookingId,
          assignedDriverId: null,
          status: { in: [BookingStatus.PENDING_ADMIN, BookingStatus.DISPATCHED] },
        },
        data: {
          assignedDriverId: session.driverId,
          status: BookingStatus.DRIVER_ACCEPTED,
        },
      });

      if (updatedCount.count === 0) {
        // Concurrency collision: Another driver already accepted this booking!
        return { success: false, alreadyTaken: true };
      }

      // 2. Mark this driver's dispatch as ACCEPTED
      await tx.bookingDispatch.updateMany({
        where: {
          id: dispatchId,
          driverId: session.driverId,
        },
        data: {
          status: DispatchStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      // 3. Expire all other competing dispatches for this booking
      await tx.bookingDispatch.updateMany({
        where: {
          bookingId,
          id: { not: dispatchId },
          status: DispatchStatus.PENDING,
        },
        data: {
          status: DispatchStatus.EXPIRED,
          respondedAt: new Date(),
        },
      });

      // 4. Insert TripEvent
      await tx.tripEvent.create({
        data: {
          bookingId,
          type: 'DRIVER_ACCEPTED',
          payloadJson: {
            driverId: session.driverId,
            driverName: session.user.fullName,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // 5. Insert AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: 'DRIVER_ACCEPT_DISPATCH',
          entityType: 'Booking',
          entityId: bookingId,
          reason: `Driver ${session.user.fullName} accepted dispatch.`,
        },
      });

      const confirmedBooking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: {
            include: {
              user: { select: { fullName: true, phone: true } },
            },
          },
        },
      });

      return { success: true, booking: confirmedBooking };
    }, {
      timeout: 15000,
      maxWait: 10000,
    });

    if (!result.success && result.alreadyTaken) {
      const res = NextResponse.json(
        {
          success: false,
          alreadyTaken: true,
          message: 'This ride was already accepted by another driver.',
        },
        { status: 409 }
      );
      return setCorsHeaders(res);
    }

    // Realtime SSE: Revoke broadcast from all other drivers instantly
    RealtimeEvents.emitToAllDrivers('DISPATCH_REVOKED', {
      dispatchId,
      bookingId,
      acceptedByDriverId: session.driverId,
    });

    // Realtime SSE: Notify customer tracking stream
    RealtimeEvents.emitToBooking(bookingId, 'BOOKING_STATUS', {
      bookingId,
      status: BookingStatus.DISPATCHED,
      driverId: session.driverId,
      driverName: session.user.fullName,
      driverPhone: session.user.phone,
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Ride accepted successfully! Please proceed to pickup.',
        booking: result.booking,
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/dispatches/accept:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to accept dispatch' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
