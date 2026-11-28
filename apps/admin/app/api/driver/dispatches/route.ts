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

    // Clean up any stale PENDING dispatches where the booking was already accepted/assigned to another driver
    await prisma.bookingDispatch.updateMany({
      where: {
        driverId: session.driverId,
        status: DispatchStatus.PENDING,
        booking: {
          assignedDriverId: { not: null, notIn: [session.driverId] },
        },
      },
      data: {
        status: DispatchStatus.EXPIRED,
        respondedAt: new Date(),
      },
    }).catch(() => {});

    const pendingDispatches = await prisma.bookingDispatch.findMany({
      where: {
        driverId: session.driverId,
        OR: [
          {
            status: DispatchStatus.PENDING,
            booking: {
              deletedAt: null,
              OR: [
                { assignedDriverId: null },
                { assignedDriverId: session.driverId },
              ],
              status: { in: [BookingStatus.PENDING_ADMIN, BookingStatus.DISPATCHED] },
            },
          },
          {
            status: DispatchStatus.ACCEPTED,
            booking: {
              deletedAt: null,
              assignedDriverId: session.driverId,
              status: BookingStatus.DRIVER_ACCEPTED,
            },
          },
        ],
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
              select: { id: true, type: true, payloadJson: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
      },
      orderBy: [
        { booking: { scheduledAt: 'asc' } },
        { broadcastAt: 'asc' },
      ],
    });

    // Double safeguard: filter out any dispatch where the booking is assigned to another driver
    const availableDispatches = pendingDispatches.filter((d) => {
      const b = d.booking;
      if (!b) return false;
      if (b.assignedDriverId && b.assignedDriverId !== session.driverId) {
        return false;
      }
      if (
        d.status === DispatchStatus.PENDING &&
        b.status !== BookingStatus.PENDING_ADMIN &&
        b.status !== BookingStatus.DISPATCHED
      ) {
        return false;
      }
      return true;
    });

    const sanitizedDispatches = availableDispatches.map((d) => {
      const b = d.booking;
      const bAny = b as any;
      const bookingCreatedEvt = b?.tripEvents?.find((e: any) => e.type === 'BOOKING_CREATED');
      const createdPayload = (bookingCreatedEvt?.payloadJson as any) || (b?.tripEvents?.[0]?.payloadJson as any) || {};
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
          fleetId: createdPayload.fleetId || bAny.fleetId || null,
          fleetName: createdPayload.fleetName || createdPayload.selectedVehicleName || bAny.fleetName || bAny.selectedVehicleName || null,
          selectedVehicleName: createdPayload.selectedVehicleName || createdPayload.fleetName || bAny.selectedVehicleName || null,
          category: createdPayload.fleetId || bAny.category,
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

    // Chronological order: earliest pickup date and time first
    sanitizedDispatches.sort((a, b) => {
      const getMs = (item: any) => {
        const val = item?.booking?.scheduledAt || item?.booking?.pickupDateTime;
        if (!val) {
          const cMs = new Date(item?.booking?.createdAt || item?.broadcastAt || 0).getTime();
          return isNaN(cMs) || cMs === 0 ? Number.MAX_SAFE_INTEGER : cMs;
        }
        const t = new Date(val).getTime();
        return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
      };
      const diff = getMs(a) - getMs(b);
      if (diff !== 0) return diff;
      return new Date(a.broadcastAt || 0).getTime() - new Date(b.broadcastAt || 0).getTime();
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
