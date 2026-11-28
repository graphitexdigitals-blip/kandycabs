import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { RealtimeEvents } from '@/lib/realtime-events';

import { BookingStatus, DispatchStatus } from '@kandy-cabs/shared';

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

    // Check if the driver has ALREADY accepted this trip:
    // Only an accepted trip creates a DRIVER_CANCEL_REQUESTED event requiring Admin approval.
    const isAcceptedByThisDriver =
      currentBooking?.assignedDriverId === session.driverId &&
      (currentBooking?.status === BookingStatus.DRIVER_ACCEPTED ||
        currentBooking?.status === BookingStatus.DRIVER_EN_ROUTE ||
        currentBooking?.status === BookingStatus.TRIP_STARTED);

    if (!isAcceptedByThisDriver) {
      // FLOW 1: Driver declines BEFORE accepting (unaccepted dispatch offer)
      // Do NOT create a cancellation request modal in Admin panel!
      // Unassign driver if pre-assigned, set booking to DISPATCHED so it's ready for re-dispatch,
      // expire this driver's dispatch offer, and record DRIVER_DECLINED event.
      await prisma.$transaction(async (tx) => {
        // 1. Unassign driver and ensure booking status allows immediate re-dispatch
        await tx.booking.update({
          where: { id: targetBookingId },
          data: {
            assignedDriverId: null,
            status: BookingStatus.DISPATCHED,
          },
        });

        // 2. Mark this driver's BookingDispatch as EXPIRED
        if (dispatchId) {
          await tx.bookingDispatch.updateMany({
            where: {
              OR: [
                { id: dispatchId },
                { bookingId: targetBookingId, driverId: session.driverId },
              ],
            },
            data: {
              status: DispatchStatus.EXPIRED,
              respondedAt: new Date(),
            },
          });
        }

        // 3. Record TripEvent: DRIVER_DECLINED
        await tx.tripEvent.create({
          data: {
            bookingId: targetBookingId,
            type: 'DRIVER_DECLINED',
            payloadJson: {
              driverId: session.driverId,
              driverName: session.user.fullName,
              driverPhone: session.user.phone,
              dispatchId,
              bookingRef,
              reason: reason || 'Driver declined dispatch offer',
              timestamp: new Date().toISOString(),
            },
          },
        });

        // 4. Record AuditLog
        let validActorId: string | null = null;
        if (session.userId && !session.userId.startsWith('dev-')) {
          const userExists = await tx.user.findUnique({ where: { id: session.userId }, select: { id: true } });
          if (userExists) validActorId = userExists.id;
        }

        await tx.auditLog.create({
          data: {
            actorUserId: validActorId,
            action: 'DRIVER_DECLINED_DISPATCH',
            entityType: 'Booking',
            entityId: targetBookingId,
            reason: `Driver ${session.user.fullName} declined dispatch: ${reason || 'Declined before accept'}`,
          },
        });
      });

      // 5. Broadcast realtime events: notify Admin and revoke offer from driver
      RealtimeEvents.emitToBooking(targetBookingId, 'BOOKING_STATUS', {
        bookingId: targetBookingId,
        bookingRef,
        driverDeclined: true,
        driverCancelRequested: false,
        driverId: session.driverId,
        driverName: session.user.fullName,
        driverPhone: session.user.phone,
        reason: reason || 'Driver declined dispatch offer',
        assignedDriverId: null,
        status: BookingStatus.DISPATCHED,
      });

      RealtimeEvents.emitToAllDrivers('DISPATCH_REVOKED', {
        dispatchId,
        bookingId: targetBookingId,
        declinedByDriverId: session.driverId,
      });

      RealtimeEvents.emitToDriver(session.driverId, 'TRIP_STATUS', {
        bookingId: targetBookingId,
        bookingRef,
        driverDeclined: true,
        driverCancelRequested: false,
      });

      const res = NextResponse.json(
        {
          success: true,
          pendingApproval: false,
          declined: true,
          bookingId: targetBookingId,
          bookingRef,
          message: 'Ride dispatch declined.',
        },
        { status: 200 }
      );
      return setCorsHeaders(res);
    }

    // FLOW 2: Driver requested cancellation of an ALREADY ACCEPTED ride:
    // Requires Admin acceptance to release driver and re-dispatch.
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
      let validActorId: string | null = null;
      if (session.userId && !session.userId.startsWith('dev-')) {
        const userExists = await tx.user.findUnique({ where: { id: session.userId }, select: { id: true } });
        if (userExists) validActorId = userExists.id;
      }

      await tx.auditLog.create({
        data: {
          actorUserId: validActorId,
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
