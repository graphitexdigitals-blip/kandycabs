import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
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

    // Check if the booking exists (support matching by id or humanReadableRef)
    const currentBooking = await prisma.booking.findFirst({
      where: {
        OR: [
          { id: bookingId },
          { humanReadableRef: bookingId },
        ],
      },
      select: { id: true, assignedDriverId: true, status: true, humanReadableRef: true },
    });

    const targetBookingId = currentBooking?.id || bookingId;
    const bookingRef = currentBooking?.humanReadableRef || bookingId;

    // Driver requested cancellation or decline with a reason:
    // ALWAYS submit as a cancellation request requiring Admin approval.
    // NEVER auto-decline or auto-unassign without Admin acceptance!
    await prisma.$transaction(async (tx) => {
      // 1. Record TripEvent: DRIVER_CANCEL_REQUESTED
      await tx.tripEvent.create({
        data: {
          bookingId: targetBookingId,
          type: 'DRIVER_CANCEL_REQUESTED',
          payloadJson: {
            driverId: session.driverId,
            driverName: session.user.fullName,
            driverPhone: session.user.phone,
            dispatchId,
            bookingRef,
            reason: reason || 'Driver requested ride cancellation',
            timestamp: new Date().toISOString(),
            status: 'PENDING_ADMIN_ACCEPTANCE',
          },
        },
      });

      // 2. Record AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: 'DRIVER_CANCEL_REQUESTED',
          entityType: 'Booking',
          entityId: targetBookingId,
          reason: `Driver ${session.user.fullName} requested cancellation: ${reason || 'No reason specified'}`,
        },
      });
    });

    // 3. Broadcast to Admin and booking channel
    RealtimeEvents.emitToBooking(targetBookingId, 'BOOKING_STATUS', {
      bookingId: targetBookingId,
      bookingRef,
      driverCancelRequested: true,
      driverId: session.driverId,
      driverName: session.user.fullName,
      driverPhone: session.user.phone,
      reason: reason || 'Driver requested ride cancellation',
    });

    RealtimeEvents.emitToAllDrivers('TRIP_STATUS', {
      bookingId: targetBookingId,
      bookingRef,
      driverCancelRequested: true,
      driverId: session.driverId,
    });

    const res = NextResponse.json(
      {
        success: true,
        pendingApproval: true,
        bookingId: targetBookingId,
        bookingRef,
        message: 'Cancellation request sent to Admin. Please wait for Admin to accept your request.',
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/dispatches/decline:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to process cancellation request' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
