import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getAdminSession } from '@/lib/auth';
import { RealtimeEvents } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

export async function PATCH(
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

    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
    }

    const newReleasedState =
      typeof body.released === 'boolean'
        ? body.released
        : !booking.customerPhoneReleased;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.admin_phone_release_override = 'true'`);
      return tx.booking.update({
        where: { id },
        data: {
          customerPhoneReleased: newReleasedState,
        },
        select: {
          customerPhoneReleased: true,
        },
      });
    });

    // Non-blocking audit log
    prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: 'TOGGLE_CUSTOMER_PHONE_RELEASE',
        entityType: 'Booking',
        entityId: id,
        reason: `Admin changed customerPhoneReleased to ${newReleasedState}`,
      },
    }).catch((err) => console.warn('AuditLog error:', err));

    // Realtime notification to driver app and customer app
    if (booking.assignedDriverId) {
      RealtimeEvents.emitToDriver(booking.assignedDriverId, 'TRIP_STATUS', {
        bookingId: id,
        customerPhoneReleased: newReleasedState,
      });
    }
    RealtimeEvents.emitToBooking(id, 'BOOKING_STATUS', {
      bookingId: id,
      customerPhoneReleased: newReleasedState,
    });

    return NextResponse.json(
      {
        success: true,
        customerPhoneReleased: updated.customerPhoneReleased,
        message: `Customer phone release set to ${updated.customerPhoneReleased}`,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/bookings/[id]/release-phone:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update phone release status' },
      { status: 500 }
    );
  }
}
