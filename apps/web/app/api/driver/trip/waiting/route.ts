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
    const {
      bookingId,
      action = 'SYNC',
      isWaitingActive = false,
      isWaitingPaused = false,
      totalAccumulatedSeconds = 0,
      currentSessionSeconds = 0,
      currentSessionStartTime = null,
      sessions = [],
    } = body;

    if (!bookingId) {
      const res = NextResponse.json(
        { success: false, message: 'bookingId is required' },
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

    const now = new Date();
    const totalSecs = Number(totalAccumulatedSeconds) || 0;
    const waitMins = Math.round(totalSecs / 60);
    const validSessions = Array.isArray(sessions) ? sessions : [];

    // Calculate window if sessions present
    let waitTimeWindow: string | null = null;
    if (validSessions.length > 0) {
      const firstStart = validSessions[0].startedAt;
      const lastStop = validSessions[validSessions.length - 1].stoppedAt;
      if (firstStart && lastStop) {
        waitTimeWindow = `${firstStart} – ${lastStop}`;
      }
    } else if (currentSessionStartTime) {
      waitTimeWindow = `From ${currentSessionStartTime}`;
    }

    const payload = {
      driverId: session.driverId,
      action,
      isWaitingActive: !!isWaitingActive,
      isWaitingPaused: !!isWaitingPaused,
      totalAccumulatedSeconds: totalSecs,
      currentSessionSeconds: Number(currentSessionSeconds) || 0,
      currentSessionStartTime: currentSessionStartTime || null,
      waitingMinutes: waitMins,
      durationSeconds: totalSecs,
      waitingSessions: validSessions,
      waitTimeWindow,
      updatedAt: now.toISOString(),
    };

    // Find existing WAITING_RECORDED event for this booking
    const existingWaitEvt = await prisma.tripEvent.findFirst({
      where: {
        bookingId,
        type: 'WAITING_RECORDED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingWaitEvt) {
      await prisma.tripEvent.update({
        where: { id: existingWaitEvt.id },
        data: {
          payloadJson: payload,
        },
      });
    } else {
      await prisma.tripEvent.create({
        data: {
          bookingId,
          type: 'WAITING_RECORDED',
          payloadJson: payload,
        },
      });
    }

    // Emit Realtime Event for active tracking streams and admin
    RealtimeEvents.emitToBooking(bookingId, 'WAITING_RECORDED', payload);

    const res = NextResponse.json({
      success: true,
      message: 'Waiting state updated successfully',
      payload,
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/trip/waiting:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to update waiting timer' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
