import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { uploadTripPhoto } from '@/lib/supabase-storage';

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
      startingOdometer,
      startingOdometerImagePath,
      driverSelfie,
      photoLocation,
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

    const parsedOdo = parseFloat(String(startingOdometer));
    if (isNaN(parsedOdo) || parsedOdo < 0) {
      const res = NextResponse.json(
        { success: false, message: 'Valid non-negative starting odometer reading in KM is required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    let storedOdometerPath: string | null = null;
    if (startingOdometerImagePath) {
      try {
        storedOdometerPath = await uploadTripPhoto({
          bookingId,
          category: 'start',
          imageBase64OrUri: startingOdometerImagePath,
          customName: 'starting_odometer',
        });
      } catch (uploadErr) {
        console.warn('Odometer image upload to storage failed, saving uri:', uploadErr);
        storedOdometerPath = startingOdometerImagePath;
      }
    }

    let storedDriverSelfie: string | null = null;
    if (driverSelfie) {
      try {
        storedDriverSelfie = await uploadTripPhoto({
          bookingId,
          category: 'start',
          imageBase64OrUri: driverSelfie,
          customName: 'driver_selfie',
        });
      } catch (uploadErr) {
        console.warn('Driver selfie upload to storage failed, saving uri:', uploadErr);
        storedDriverSelfie = driverSelfie;
      }
    }

    const updateData: any = {
      startingOdometer: parsedOdo,
    };
    if (storedOdometerPath) {
      updateData.startingOdometerImagePath = storedOdometerPath;
    }

    // If driver selfie provided and booking has vehicleInspectionPhotos, make sure it's reflected
    if (storedDriverSelfie && Array.isArray(booking.vehicleInspectionPhotos)) {
      const existing = [...booking.vehicleInspectionPhotos];
      if (existing.length === 0) {
        existing.push(storedDriverSelfie);
        updateData.vehicleInspectionPhotos = existing;
      } else if (!existing[0]) {
        existing[0] = storedDriverSelfie;
        updateData.vehicleInspectionPhotos = existing;
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    await prisma.tripEvent.create({
      data: {
        bookingId,
        type: 'ODOMETER_RECORDED',
        payloadJson: {
          driverId: session.driverId,
          startingOdometer: parsedOdo,
          hasPhoto: Boolean(storedOdometerPath),
          photoLocation: photoLocation || null,
          timestamp: new Date().toISOString(),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: 'DRIVER_ODOMETER_RECORDED',
        entityType: 'Booking',
        entityId: bookingId,
        reason: `Driver recorded starting odometer: ${parsedOdo} KM`,
      },
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Starting odometer saved successfully in database',
        booking: updatedBooking,
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/trip/odometer:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to save starting odometer' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
