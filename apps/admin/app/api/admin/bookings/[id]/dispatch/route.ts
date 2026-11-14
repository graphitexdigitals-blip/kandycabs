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
    const { driverIds, reassignReason } = body;

    if (!Array.isArray(driverIds) || driverIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Please select at least one online driver to broadcast' },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        assignedDriver: {
          include: {
            user: { select: { fullName: true, phone: true } },
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
    }

    // Validation: Cannot re-dispatch to the driver who is already assigned to this trip
    if (booking.assignedDriverId && driverIds.includes(booking.assignedDriverId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Already same trip is assigned to same driver',
        },
        { status: 400 }
      );
    }

    const wasDriverAccepted =
      booking.status === BookingStatus.DRIVER_ACCEPTED ||
      booking.status === BookingStatus.DRIVER_EN_ROUTE ||
      Boolean(booking.assignedDriverId);
    const isRedispatch = booking.status === BookingStatus.DISPATCHED || wasDriverAccepted;
    const previousDriver = booking.assignedDriver;
    const previousDriverName = previousDriver?.user?.fullName || 'Assigned Driver';
    const effectiveReason =
      (reassignReason && String(reassignReason).trim()) ||
      (wasDriverAccepted ? 'Driver accepted but unable to continue the trip' : 'Admin re-dispatched ride');

    // Execute atomic dispatch transaction
    const result = await prisma.$transaction(async (tx) => {
      // 0. Expire existing pending & accepted dispatches for this booking to prevent stale alerts
      await tx.bookingDispatch.updateMany({
        where: {
          bookingId: id,
          status: { in: [DispatchStatus.PENDING, DispatchStatus.ACCEPTED] },
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

      // 2. Update booking status to DISPATCHED & unassign previous driver
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.DISPATCHED,
          assignedDriverId: null, // Clear assigned driver so new driver can accept
        },
      });

      // 3. Record TripEvent
      const actionType = wasDriverAccepted
        ? 'DRIVER_REASSIGNED'
        : isRedispatch
        ? 'DISPATCH_REBROADCAST'
        : 'DISPATCH_BROADCAST';

      await tx.tripEvent.create({
        data: {
          bookingId: id,
          type: actionType,
          payloadJson: {
            dispatchedDriverIds: driverIds,
            broadcastCount: driverIds.length,
            isRedispatch: true,
            wasDriverAccepted,
            previousDriverId: previousDriver?.id || null,
            previousDriverName: previousDriverName,
            previousDriverPhone: previousDriver?.user?.phone || null,
            reason: effectiveReason,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // 4. Record AuditLog with clear audit trail note
      const auditReason = wasDriverAccepted
        ? `Driver reassigned: Previous driver ${previousDriverName} unable to continue (${effectiveReason}). Re-dispatched to ${driverIds.length} driver(s).`
        : isRedispatch
        ? `Admin re-dispatched ride to ${driverIds.length} driver(s).`
        : `Admin broadcasted ride to ${driverIds.length} driver(s).`;

      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: actionType,
          entityType: 'Booking',
          entityId: id,
          reason: auditReason,
        },
      });

      return { booking: updatedBooking, dispatches: createdDispatches };
    }, {
      timeout: 15000,
      maxWait: 10000,
    });

    // Notify previous driver if they had push notifications
    if (previousDriver?.pushToken) {
      sendCloudPushNotification({
        to: [previousDriver.pushToken],
        title: 'Trip Re-assigned by Operations',
        body: `Booking ${booking.humanReadableRef || ''} has been re-dispatched to another driver.`,
        data: { bookingId: id, status: 'REASSIGNED' },
      }).catch(() => {});
    }

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
