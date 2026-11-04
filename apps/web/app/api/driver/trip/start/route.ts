import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { BookingStatus, verifyOtp } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { RealtimeEvents } from '@/lib/realtime-events';
import { uploadTripPhoto, uploadInspectionPhotos } from '@/lib/supabase-storage';

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
      pickupOtp,
      startingOdometer,
      startingOdometerImagePath,
      driverSelfie,
      vehicleInspectionPhotos = [],
      actualPickupLat,
      actualPickupLng,
      actualPickupAddress,
    } = body;

    if (!bookingId || !pickupOtp) {
      const res = NextResponse.json(
        { success: false, message: 'Booking ID and Pickup OTP are required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    if (!startingOdometer || !startingOdometerImagePath) {
      const res = NextResponse.json(
        { success: false, message: 'Starting odometer reading and photo evidence are mandatory to start trip' },
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
    const resolvedPickupLat = typeof actualPickupLat === 'number' ? actualPickupLat : null;
    const resolvedPickupLng = typeof actualPickupLng === 'number' ? actualPickupLng : null;
    const resolvedPickupAddress = actualPickupAddress ? String(actualPickupAddress).trim() : null;

    // Upload starting odometer photo & inspection photos to Supabase Storage (offloads Base64 from PostgreSQL)
    let storedOdometerPath: string | null = null;
    if (startingOdometerImagePath) {
      storedOdometerPath = await uploadTripPhoto({
        bookingId,
        category: 'start',
        imageBase64OrUri: startingOdometerImagePath,
        customName: 'starting_odometer',
      });
    }

    let storedDriverSelfie: string | null = null;
    if (driverSelfie) {
      storedDriverSelfie = await uploadTripPhoto({
        bookingId,
        category: 'start',
        imageBase64OrUri: driverSelfie,
        customName: 'driver_selfie',
      });
    }

    let storedInspectionPhotos: string[] = [];
    if (Array.isArray(vehicleInspectionPhotos) && vehicleInspectionPhotos.length > 0) {
      storedInspectionPhotos = await uploadInspectionPhotos(bookingId, vehicleInspectionPhotos);
    }
    if (storedDriverSelfie && !storedInspectionPhotos.includes(storedDriverSelfie)) {
      storedInspectionPhotos.unshift(storedDriverSelfie);
    }

    // If trip was already authorized/started by Admin override
    if (booking.status === BookingStatus.TRIP_STARTED) {
      const updateData: any = {};
      if (startingOdometer) {
        updateData.startingOdometer = parseFloat(String(startingOdometer));
        updateData.startingOdometerImagePath = storedOdometerPath || null;
      }
      if (storedInspectionPhotos.length > 0) {
        updateData.vehicleInspectionPhotos = storedInspectionPhotos;
      }
      if (resolvedPickupLat != null) {
        updateData.actualPickupLat = resolvedPickupLat;
      }
      if (resolvedPickupLng != null) {
        updateData.actualPickupLng = resolvedPickupLng;
      }
      if (resolvedPickupAddress) {
        updateData.actualPickupAddress = resolvedPickupAddress;
      }
      if (!booking.actualStartedAt) {
        updateData.actualStartedAt = now;
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: updateData,
        });
      }
      const res = NextResponse.json(
        {
          success: true,
          message: 'Trip authorized by admin. Proceeding to active trip.',
          booking,
        },
        { status: 200 }
      );
      return setCorsHeaders(res);
    }

    // Verify OTP (or check if already verified earlier)
    const hasOtpVerifiedEvent = await prisma.tripEvent.findFirst({
      where: {
        bookingId,
        type: 'OTP_VERIFIED',
      },
    });
    const isOtpValid = Boolean(hasOtpVerifiedEvent) || verifyOtp(pickupOtp.trim(), booking.pickupOtp || '');
    if (!isOtpValid) {
      const res = NextResponse.json(
        { success: false, message: 'Incorrect 4-digit pickup OTP. Please verify with customer or request admin override.' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Atomic Transaction: update status, record odometer, record verified driver pickup point, clear Flow B customer location
    const updated = await prisma.$transaction(
      async (tx) => {
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.TRIP_STARTED,
            startingOdometer: startingOdometer ? parseFloat(String(startingOdometer)) : null,
            startingOdometerImagePath: storedOdometerPath || null,
            vehicleInspectionPhotos: storedInspectionPhotos,
            actualPickupAddress: resolvedPickupAddress || booking.pickupAddress,
            actualPickupLat: resolvedPickupLat ?? booking.pickupLat,
            actualPickupLng: resolvedPickupLng ?? booking.pickupLng,
            actualStartedAt: now,
            // Clear Flow B customer pickup coordinates on trip start
            customerCurrentLat: null,
            customerCurrentLng: null,
            customerLocationSharingEnabled: false,
          },
        });

        await tx.tripEvent.create({
          data: {
            bookingId,
            type: 'TRIP_STARTED',
            payloadJson: {
              driverId: session.driverId,
              startingOdometer,
              hasImage: !!storedOdometerPath,
              vehicleInspectionPhotosCount: storedInspectionPhotos.length,
              actualPickupAddress: resolvedPickupAddress || booking.pickupAddress,
              actualPickupLat: resolvedPickupLat ?? booking.pickupLat,
              actualPickupLng: resolvedPickupLng ?? booking.pickupLng,
              timestamp: now.toISOString(),
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: session.userId,
            action: 'DRIVER_START_TRIP',
            entityType: 'Booking',
            entityId: bookingId,
            reason: `Driver started trip with verified OTP at [${resolvedPickupAddress || 'driver GPS location'}], starting odometer ${startingOdometer || 'N/A'}, and ${storedInspectionPhotos.length} inspection photos stored`,
          },
        });

        return updatedBooking;
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );

    // Realtime SSE: Notify customer, admin and driver
    RealtimeEvents.emitToBooking(bookingId, 'BOOKING_STATUS', {
      bookingId,
      status: BookingStatus.TRIP_STARTED,
      startingOdometer,
      actualPickupAddress: updated.actualPickupAddress,
      actualPickupLat: updated.actualPickupLat,
      actualPickupLng: updated.actualPickupLng,
      actualStartedAt: updated.actualStartedAt,
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Trip started successfully!',
        booking: updated,
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/trip/start:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to start trip' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
