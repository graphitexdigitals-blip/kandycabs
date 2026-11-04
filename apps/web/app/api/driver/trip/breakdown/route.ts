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
      latitude,
      longitude,
      landmark = 'Live Driver GPS Location',
      issueType = 'VEHICLE_BREAKDOWN',
      notes = 'Vehicle breakdown reported by driver',
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
      include: {
        customer: {
          include: {
            user: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
        assignedDriver: {
          include: {
            user: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
        vehicle: true,
      },
    });

    if (!booking) {
      const res = NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    const lat = typeof latitude === 'number' ? latitude : 0;
    const lng = typeof longitude === 'number' ? longitude : 0;
    const mapsLink = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;

    const breakdownPayload = {
      incidentId: `bd-${Date.now()}`,
      bookingId: booking.id,
      bookingRef: booking.humanReadableRef,
      issueType,
      notes: String(notes || '').trim(),
      latitude: lat,
      longitude: lng,
      landmark: String(landmark || '').trim(),
      googleMapsUrl: mapsLink,
      driverId: session.driverId,
      driverName: booking.assignedDriver?.user?.fullName || 'Driver',
      driverPhone: booking.assignedDriver?.user?.phone || '',
      vehiclePlate: (booking as any).vehicle?.registrationNumber || 'N/A',
      vehicleModel: (booking as any).vehicle?.model || 'Vehicle',
      customerName: booking.customer?.user?.fullName || 'Customer',
      customerPhone: booking.customer?.user?.phone || '',
      reportedAt: new Date().toISOString(),
      resolved: false,
    };

    await prisma.$transaction(async (tx) => {
      // 1. Log high-priority TripEvent
      await tx.tripEvent.create({
        data: {
          bookingId: booking.id,
          type: 'VEHICLE_BREAKDOWN',
          payloadJson: breakdownPayload,
        },
      });

      // 2. Track GPS telemetry if coordinates provided
      if (lat && lng) {
        await tx.tripTracking.create({
          data: {
            bookingId: booking.id,
            driverId: session.driverId,
            lat,
            lng,
          },
        });
      }

      // 3. Log Audit Log for dispatch team
      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: 'VEHICLE_BREAKDOWN_REPORTED',
          entityType: 'Booking',
          entityId: booking.id,
          reason: `Driver ${breakdownPayload.driverName} reported breakdown at ${breakdownPayload.landmark}. GPS: ${lat}, ${lng}`,
        },
      });
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Vehicle breakdown alert broadcasted to 24/7 Dispatch Control.',
        incident: breakdownPayload,
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (err: any) {
    console.error('Breakdown report API error:', err);
    const res = NextResponse.json(
      { success: false, message: err.message || 'Internal server error reporting breakdown' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
