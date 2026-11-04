import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { BookingStatus } from '@kandy-cabs/shared';
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
    const { bookingId, action, status: requestedStatus } = body;

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        assignedDriverId: session.driverId,
      },
    });

    if (!booking) {
      const res = NextResponse.json(
        { success: false, message: 'Active booking not found for this driver' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    const isRevert = action === 'NOT_REACHED' || action === 'REVERT' || requestedStatus === BookingStatus.DRIVER_ACCEPTED;
    const targetStatus = isRevert ? BookingStatus.DRIVER_ACCEPTED : BookingStatus.DRIVER_EN_ROUTE;

    // Do not downgrade if already TRIP_STARTED or TRIP_COMPLETED
    if (
      booking.status === BookingStatus.TRIP_STARTED ||
      booking.status === BookingStatus.TRIP_COMPLETED ||
      booking.status === BookingStatus.CANCELLED
    ) {
      const res = NextResponse.json(
        { success: true, message: `Booking is already ${booking.status}`, status: booking.status },
        { status: 200 }
      );
      return setCorsHeaders(res);
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: targetStatus },
      });

      await tx.tripEvent.create({
        data: {
          bookingId,
          type: isRevert ? 'DRIVER_ACCEPTED' : 'DRIVER_EN_ROUTE',
          payloadJson: {
            driverId: session.driverId,
            timestamp: new Date().toISOString(),
            action: isRevert ? 'NOT_REACHED' : 'START_TRIP_CLICKED',
          },
        },
      });
    });

    // Realtime SSE: Notify customer tracking stream & admin
    RealtimeEvents.emitToBooking(bookingId, 'BOOKING_STATUS', {
      bookingId,
      status: targetStatus,
    });

    const res = NextResponse.json(
      { success: true, message: `Status updated to ${targetStatus}`, status: targetStatus },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/trip/en-route:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to update status' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
