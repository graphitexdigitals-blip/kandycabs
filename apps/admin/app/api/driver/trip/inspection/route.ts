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
    const { bookingId, vehicleInspectionPhotos } = body;

    if (!bookingId || !Array.isArray(vehicleInspectionPhotos)) {
      const res = NextResponse.json(
        { success: false, message: 'Booking ID and vehicleInspectionPhotos array are required' },
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

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        vehicleInspectionPhotos: vehicleInspectionPhotos,
      },
    });

    await prisma.tripEvent.create({
      data: {
        bookingId,
        type: 'INSPECTION_SUBMITTED',
        payloadJson: {
          driverId: session.driverId,
          photosCount: vehicleInspectionPhotos.length,
          timestamp: new Date().toISOString(),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: 'DRIVER_INSPECTION_UPLOADED',
        entityType: 'Booking',
        entityId: bookingId,
        reason: `Driver uploaded ${vehicleInspectionPhotos.length} vehicle inspection photos for trip start`,
      },
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Vehicle inspection photos saved successfully',
        booking: updatedBooking,
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/trip/inspection:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to save vehicle inspection photos' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
