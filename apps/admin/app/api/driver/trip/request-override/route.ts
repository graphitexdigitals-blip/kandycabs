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
    const { bookingId, note = 'Customer phone unreachable / battery dead' } = body;

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        assignedDriverId: session.driverId,
      },
    });

    if (!booking) {
      const res = NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    await prisma.$transaction(async (tx) => {
      await tx.tripEvent.create({
        data: {
          bookingId,
          type: 'OVERRIDE_REQUESTED',
          payloadJson: {
            driverId: session.driverId,
            note: note.trim(),
            timestamp: new Date().toISOString(),
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: 'REQUEST_OTP_OVERRIDE',
          entityType: 'Booking',
          entityId: bookingId,
          reason: `Driver requested OTP override: ${note.trim()}`,
        },
      });
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Admin override request logged. Please notify dispatch to authorize the trip start.',
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/trip/request-override:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to submit override request' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
