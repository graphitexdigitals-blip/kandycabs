import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

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
    const { bookingId, lat, lng, address } = body;

    if (!bookingId) {
      const res = NextResponse.json(
        { success: false, message: 'Booking ID is required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        assignedDriverId: session.driverId,
      },
    });

    if (!booking) {
      const res = NextResponse.json(
        { success: false, message: 'Booking not found or not assigned to you' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    const nowIso = new Date().toISOString();

    await prisma.tripEvent.create({
      data: {
        bookingId,
        type: 'DRIVER_ARRIVED_AT_DESTINATION',
        payloadJson: {
          driverId: session.driverId,
          lat: lat != null ? lat : null,
          lng: lng != null ? lng : null,
          address: address || null,
          timestamp: nowIso,
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: 'DRIVER_ARRIVED_AT_DESTINATION',
        entityType: 'Booking',
        entityId: bookingId,
        reason: 'Driver reached and confirmed destination drop-off point',
      },
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Destination arrival confirmed and saved to database',
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/trip/reach-destination:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to record destination arrival' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
