import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { BookingStatus, DispatchStatus } from '@kandy-cabs/shared';
import { sendCloudPushNotification } from '@/lib/push-notifications';
import { getAdminSession } from '@/lib/auth';

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
    const body = await req.json();
    const { driverIds } = body;

    if (!Array.isArray(driverIds) || driverIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Please select at least one online driver to broadcast' },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
    }

    const isRedispatch = booking.status === BookingStatus.DISPATCHED;

    // Execute atomic dispatch transaction
    const result = await prisma.$transaction(async (tx) => {
      // 0. Expire existing pending dispatches for this booking to prevent stale alerts
      await tx.bookingDispatch.updateMany({
        where: {
          bookingId: id,
          status: DispatchStatus.PENDING,
        },
        data: {
          status: DispatchStatus.EXPIRED,
        },
      });

      // 1. Create BookingDispatch for each driver
      const createdDispatches = await Promise.all(
        driverIds.map((driverId: string) =>
          tx.bookingDispatch.create({
            data: {
              bookingId: id,
              driverId,
              status: DispatchStatus.PENDING,
            },
          })
        )
      );

      // 2. Update booking status to DISPATCHED
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.DISPATCHED,
        },
      });

      // 3. Record TripEvent
      await tx.tripEvent.create({
        data: {
          bookingId: id,
          type: isRedispatch ? 'DISPATCH_REBROADCAST' : 'DISPATCH_BROADCAST',
          payloadJson: {
            dispatchedDriverIds: driverIds,
            broadcastCount: driverIds.length,
            isRedispatch,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // 4. Record AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: isRedispatch ? 'DISPATCH_REBROADCAST' : 'DISPATCH_BROADCAST',
          entityType: 'Booking',
          entityId: id,
          reason: isRedispatch
            ? `Admin re-dispatched ride to ${driverIds.length} driver(s).`
            : `Admin broadcasted ride to ${driverIds.length} driver(s).`,
        },
      });

      return { booking: updatedBooking, dispatches: createdDispatches };
    }, {
      timeout: 15000,
      maxWait: 10000,
    });

    // 5. Trigger Cloud Push Notifications to dispatched drivers in background
    try {
      const driversWithTokens = await prisma.driver.findMany({
        where: {
          id: { in: driverIds },
          pushToken: { not: null },
        },
        select: { pushToken: true },
      });

      const tokens = driversWithTokens.map((d: any) => d.pushToken).filter(Boolean) as string[];
      if (tokens.length > 0) {
        sendCloudPushNotification({
          to: tokens,
          title: 'New Trip Dispatched by Admin',
          body: `${booking.pickupAddress} ➔ ${booking.dropAddress} (${booking.tripType || 'RIDE'})`,
          data: { bookingId: id },
        }).catch((err: any) => console.error('[DispatchPush] Failed to send push:', err));
      }
    } catch (pushErr) {
      console.warn('[DispatchPush] Error fetching driver push tokens:', pushErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Ride broadcasted to ${driverIds.length} driver(s)`,
        booking: result.booking,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/admin/bookings/[id]/dispatch:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to dispatch booking' },
      { status: 500 }
    );
  }
}
