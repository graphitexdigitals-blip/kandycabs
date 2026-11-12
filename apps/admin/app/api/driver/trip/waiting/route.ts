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
    const {
      bookingId,
      durationSeconds = 0,
      waitingMinutes = 0,
      sessions = [],
      startedAt,
      stoppedAt,
      action = 'RECORD_WAITING',
    } = body;

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

    const calculatedMinutes = waitingMinutes || Math.round(durationSeconds / 60);
    const nowIso = new Date().toISOString();

    const tripEvent = await prisma.tripEvent.create({
      data: {
        bookingId,
        type: 'WAITING_RECORDED',
        payloadJson: {
          driverId: session.driverId,
          waitingMinutes: calculatedMinutes,
          durationSeconds: durationSeconds || calculatedMinutes * 60,
          sessions,
          startedAt: startedAt || null,
          stoppedAt: stoppedAt || null,
          action,
          timestamp: nowIso,
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: 'DRIVER_WAITING_RECORDED',
        entityType: 'Booking',
        entityId: bookingId,
        reason: `Driver recorded customer waiting time: ${calculatedMinutes} minutes (${durationSeconds}s)`,
      },
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Waiting time recorded successfully',
        waitingMinutes: calculatedMinutes,
        tripEventId: tripEvent.id,
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/trip/waiting:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to record waiting time' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

