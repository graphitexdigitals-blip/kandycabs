import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { BookingStatus, DispatchStatus } from '@kandy-cabs/shared';
import { getAdminSession } from '@/lib/auth';
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

    const bookingId = params.id;
    const body = await req.json().catch(() => ({}));
    const { note } = body;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        assignedDriver: {
          include: {
            user: { select: { fullName: true, phone: true } },
          },
        },
        tripEvents: {
          where: { type: 'DRIVER_CANCEL_REQUESTED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
    }

    const driverId = booking.assignedDriverId;
    const driverName = booking.assignedDriver?.user?.fullName || 'Driver';
    const cancelReason = booking.tripEvents?.[0]?.payloadJson
      ? (booking.tripEvents[0].payloadJson as any).reason
      : 'Driver cancellation accepted by admin';

    await prisma.$transaction(async (tx) => {
      // 1. Unassign driver and set booking to DISPATCHED so admin can re-dispatch
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          assignedDriverId: null,
          status: BookingStatus.DISPATCHED,
        },
      });

      // 2. Expire all dispatches for this driver for this booking
      if (driverId) {
        await tx.bookingDispatch.updateMany({
          where: {
            bookingId,
            driverId,
          },
          data: {
            status: DispatchStatus.EXPIRED,
            respondedAt: new Date(),
          },
        });
      }

      // 3. Record TripEvent DRIVER_CANCEL_APPROVED
      await tx.tripEvent.create({
        data: {
          bookingId,
          type: 'DRIVER_CANCEL_APPROVED',
          payloadJson: {
            adminUserId: session.userId,
            adminPhone: session.phone,
            driverId,
            driverName,
            reason: cancelReason,
            adminNote: note || null,
            approvedAt: new Date().toISOString(),
          },
        },
      });

      // 4. Record AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: 'ADMIN_APPROVE_DRIVER_CANCELLATION',
          entityType: 'Booking',
          entityId: bookingId,
          reason: `Admin (${session.phone}) approved cancellation for driver ${driverName}: ${cancelReason}`,
        },
      });
    });

    // 5. Broadcast via Realtime SSE
    RealtimeEvents.emitToBooking(bookingId, 'BOOKING_STATUS', {
      bookingId,
      status: BookingStatus.DISPATCHED,
      driverCancelled: true,
      driverCancelApproved: true,
      driverId,
    });

    if (driverId) {
      RealtimeEvents.emitToDriver(driverId, 'TRIP_STATUS', {
        bookingId,
        driverCancelled: true,
        driverCancelApproved: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Driver ${driverName}'s cancellation request has been accepted. Booking is unassigned and ready to re-dispatch.`,
    });
  } catch (error: any) {
    console.error('Error in accept-cancellation:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to accept cancellation' },
      { status: 500 }
    );
  }
}
