import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { DispatchStatus, BookingStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const session = await getDriverSession(req);
    if (!session) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Driver authentication required' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const pendingDispatches = await prisma.bookingDispatch.findMany({
      where: {
        driverId: session.driverId,
        status: DispatchStatus.PENDING,
        booking: {
          deletedAt: null,
          status: { in: [BookingStatus.PENDING_ADMIN, BookingStatus.DISPATCHED] },
        },
      },
      include: {
        booking: {
          include: {
            customer: {
              include: {
                user: { select: { fullName: true, phone: true } },
              },
            },
            tripEvents: {
              where: { type: 'BOOKING_CREATED' },
              select: { payloadJson: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { broadcastAt: 'desc' },
    });

    const sanitizedDispatches = pendingDispatches.map((d) => {
      const b = d.booking;
      const bAny = b as any;
      const createdPayload = (b?.tripEvents?.[0]?.payloadJson as any) || {};
      let viaStops: any[] = [];
      if (Array.isArray(createdPayload.viaStops) && createdPayload.viaStops.length > 0) {
        viaStops = createdPayload.viaStops;
      } else if (Array.isArray(createdPayload.stops) && createdPayload.stops.length > 0) {
        viaStops = createdPayload.stops;
      } else {
        const text = String(createdPayload.notes || createdPayload.specialRequirements || '');
        const match = text.match(/(?:Intermediate Stops|Via Stops(?:\s*\(\d+\))?|Via)\s*:\s*([^|;\n]+)/i);
        if (match && match[1]) {
          const rawSegment = match[1].trim();
          const parts = rawSegment.includes('➔')
            ? rawSegment.split('➔')
            : rawSegment.includes('->')
            ? rawSegment.split('->')
            : rawSegment.split(',');
          viaStops = parts.map((p) => ({ label: p.trim() })).filter((s) => s.label);
        }
      }

      return {
        ...d,
        booking: {
          ...b,
          viaStops,
          stops: viaStops,
          notes: createdPayload.notes || bAny.notes || null,
          specialRequirements: createdPayload.specialRequirements || bAny.specialRequirements || null,
          passengers: createdPayload.passengers ?? bAny.passengers ?? null,
          passengerCount: createdPayload.passengers ?? bAny.passengers ?? null,
          luggage: createdPayload.luggage ?? bAny.luggage ?? null,
          luggageDetails: createdPayload.luggage ?? bAny.luggage ?? null,
          hasCarrier: Boolean(createdPayload.hasCarrier || createdPayload.requestCarrier || bAny.hasCarrier || bAny.requestCarrier),
          requestCarrier: Boolean(createdPayload.hasCarrier || createdPayload.requestCarrier || bAny.hasCarrier || bAny.requestCarrier),
          hasPet: Boolean(createdPayload.hasPet || createdPayload.isPetFriendly || bAny.hasPet || bAny.isPetFriendly),
          isPetFriendly: Boolean(createdPayload.hasPet || createdPayload.isPetFriendly || bAny.hasPet || bAny.isPetFriendly),
          petType: createdPayload.petType || bAny.petType || null,
          flightNumber: createdPayload.flightNumber || bAny.flightNumber || null,
          scheduledAt: b.scheduledAt || createdPayload.scheduledAt,
        },
      };
    });

    const response = NextResponse.json(
      {
        success: true,
        dispatches: sanitizedDispatches,
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in GET /api/driver/dispatches:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch dispatches', dispatches: [] },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
