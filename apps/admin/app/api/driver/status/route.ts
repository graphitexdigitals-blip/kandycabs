import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { BookingStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { getExpiringDocuments } from '@/lib/documentExpiry';

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

    const freshDriver = await prisma.driver.findUnique({
      where: { id: session.driverId },
      include: {
        user: true,
        vehicles: { where: { deletedAt: null } },
      },
    });
    const driverRecord = freshDriver || session.driver;
    const userRecord = freshDriver?.user || session.user;

    // Fetch all active and upcoming assigned rides for this driver
    const assignedBookings = await prisma.booking.findMany({
      where: {
        assignedDriverId: session.driverId,
        deletedAt: null,
        status: {
          in: [
            BookingStatus.DRIVER_ACCEPTED,
            BookingStatus.DRIVER_EN_ROUTE,
            BookingStatus.TRIP_STARTED,
          ],
        },
      },
      include: {
        customer: {
          include: {
            user: { select: { fullName: true, phone: true } },
          },
        },
        vehicle: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Auto-release customer phone if within 5 hours
    const idsToRelease: string[] = [];
    for (let i = 0; i < assignedBookings.length; i++) {
      const b = assignedBookings[i];
      const scheduledMs = new Date(b.scheduledAt).getTime();
      const isWithin5Hours = scheduledMs - Date.now() <= 5 * 60 * 60 * 1000;
      if (isWithin5Hours && !b.customerPhoneReleased) {
        idsToRelease.push(b.id);
        assignedBookings[i] = {
          ...b,
          customerPhoneReleased: true,
        };
      }
    }
    if (idsToRelease.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: idsToRelease } },
        data: { customerPhoneReleased: true },
      });
    }

    // Determine primary active booking:
    // 1. Prioritize live trip in progress (TRIP_STARTED / DRIVER_EN_ROUTE)
    const liveTrip = assignedBookings.find(
      (b) => b.status === BookingStatus.TRIP_STARTED || b.status === BookingStatus.DRIVER_EN_ROUTE
    );

    // 2. Prioritize trip with vehicle inspection completed or odometer entered
    const inPrepTrip = !liveTrip
      ? assignedBookings.find(
          (b) =>
            b.startingOdometer != null ||
            (Array.isArray(b.vehicleInspectionPhotos) &&
              b.vehicleInspectionPhotos.filter((p: string) => p && !p.includes('placehold.co') && p.trim().length > 0).length >= 4)
        )
      : null;

    // 3. Fallback to the first assigned booking
    const activeBooking = liveTrip || inPrepTrip || assignedBookings[0] || null;
    const upcomingBookings = activeBooking
      ? assignedBookings.filter((b) => b.id !== activeBooking.id)
      : [];

    let activeBookingWithOtp: any = activeBooking;
    if (activeBooking) {
      const otpEvent = await prisma.tripEvent.findFirst({
        where: {
          bookingId: activeBooking.id,
          type: 'OTP_VERIFIED',
        },
        orderBy: { createdAt: 'desc' },
      });
      if (otpEvent) {
        const payload: any = otpEvent.payloadJson || {};
        activeBookingWithOtp = {
          ...activeBooking,
          isOtpVerified: true,
          verifiedPickupOtp: payload.otp || activeBooking.pickupOtp || '',
        };
      }
    }

    let docDates: Record<string, any> = {};
    if (driverRecord.adminNotes) {
      const datesMatch = driverRecord.adminNotes.match(/\[DocDates:\s*(\{.*?\})\]/);
      if (datesMatch && datesMatch[1]) {
        try {
          docDates = JSON.parse(datesMatch[1]);
        } catch {}
      }
      if (!docDates || Object.keys(docDates).length === 0) {
        const extraMatch = driverRecord.adminNotes.match(/\[ExtraDocs:\s*(\{.*?\})\]/);
        if (extraMatch && extraMatch[1]) {
          try {
            const extra = JSON.parse(extraMatch[1]);
            if (extra.docDates) docDates = extra.docDates;
          } catch {}
        }
      }
    }
    const expiringDocuments = getExpiringDocuments(docDates, 5);

    let rejectionReason: string | null = null;
    if (driverRecord.adminNotes) {
      const rejMatch = driverRecord.adminNotes.match(/\[RejectionReason:\s*([^\]]+)\]/);
      if (rejMatch && rejMatch[1]) {
        rejectionReason = rejMatch[1].replace(/\[.*?\]/g, '').trim();
      } else if (driverRecord.verificationStatus === 'REJECTED') {
        const cleanNotes = driverRecord.adminNotes.replace(/\[.*?\]/g, '').trim();
        if (cleanNotes) rejectionReason = cleanNotes;
      }
    }

    let vehiclesList: any[] = [];
    if (driverRecord.adminNotes && driverRecord.adminNotes.includes('[MultiVehicles:')) {
      const match = driverRecord.adminNotes.match(/\[MultiVehicles:\s*([\s\S]*?)\]/);
      if (match && match[1]) {
        try {
          vehiclesList = JSON.parse(match[1]);
        } catch (_) {}
      }
    }
    if (!vehiclesList.length && driverRecord.vehicles?.length) {
      vehiclesList = driverRecord.vehicles.map((v: any) => ({
        id: v.id,
        plateNumber: v.plateNumber,
        category: v.category,
        carModel: v.model || v.category || 'Sedan',
        fuelType: v.fuelType || 'DIESEL',
        carriageCapacity: 'No',
        rcDocUrl: driverRecord.rcDocUrl || null,
        insuranceDocUrl: driverRecord.insuranceDocUrl || null,
      }));
    }

    const response = NextResponse.json(
      {
        success: true,
        driver: {
          id: driverRecord.id,
          fullName: userRecord.fullName,
          phone: userRecord.phone,
          licenseNumber: driverRecord.licenseNumber,
          profilePhotoUrl: driverRecord.profilePhotoUrl,
          licenseDocUrl: driverRecord.licenseDocUrl,
          rcDocUrl: driverRecord.rcDocUrl,
          insuranceDocUrl: driverRecord.insuranceDocUrl,
          verificationStatus: driverRecord.verificationStatus || 'PENDING',
          rejectionReason,
          adminNotes: driverRecord.adminNotes || null,
          onlineStatus: driverRecord.onlineStatus,
          payoutMethod: driverRecord.payoutMethod,
          bankAccountHolderName: driverRecord.bankAccountHolderName,
          bankAccountNumber: driverRecord.bankAccountNumber,
          bankIfsc: driverRecord.bankIfsc,
          bankName: driverRecord.bankName,
          payoutUpiId: driverRecord.payoutUpiId,
          payoutPhone: driverRecord.payoutPhone,
          payoutEmail: driverRecord.payoutEmail,
          payoutStatus: driverRecord.payoutStatus,
          currentLat: driverRecord.currentLat,
          currentLng: driverRecord.currentLng,
          lastPingAt: driverRecord.lastPingAt,
          vehicle: driverRecord.vehicles[0] || null,
          vehicles: vehiclesList,
          docDates,
          expiringDocuments,
        },
        activeBooking: activeBookingWithOtp || null,
        upcomingBookings: upcomingBookings || [],
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in GET /api/driver/status:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch driver status' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
