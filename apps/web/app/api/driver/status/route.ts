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

    // Safe scheduled date parser to handle 2-digit years or corrupt years gracefully
    const parseSafeScheduledDate = (rawDate: any): Date | null => {
      if (!rawDate) return null;
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return null;
      if (d.getFullYear() < 100) {
        d.setFullYear(2000 + d.getFullYear());
      }
      return d;
    };

    // Primary active booking selection:
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

    // Helper: auto-release if pickup time is within 5 hours of pickup (or pickup time has arrived)
    const isBookingPhoneReleased = (b: any): boolean => {
      if (!b) return false;
      // 1. Explicit admin release
      if (Boolean(b.customerPhoneReleased)) return true;
      // 2. Already active on trip
      if (['TRIP_STARTED', 'ON_TRIP', 'COMPLETED'].includes(b.status)) return true;
      // 3. Auto-release if pickup time is within 5 hours of pickup
      if (!b.scheduledAt) return false;
      const schedDate = parseSafeScheduledDate(b.scheduledAt);
      if (!schedDate || isNaN(schedDate.getTime())) return false;
      const now = new Date();
      const diffHours = (schedDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      return diffHours <= 5 && diffHours >= -4;
    };

    // Mask customer phone number if phone is not released yet by admin or auto-released within 5 hours on pickup day
    const maskBookingForDriver = (b: any) => {
      if (!b) return null;
      const isPhoneReleased = isBookingPhoneReleased(b);

      if (isPhoneReleased) {
        return {
          ...b,
          customerPhoneReleased: true,
        };
      }

      return {
        ...b,
        customerPhoneReleased: false,
        customer: b.customer
          ? {
              ...b.customer,
              user: b.customer.user
                ? {
                    ...b.customer.user,
                    phone: null,
                  }
                : null,
            }
          : null,
      };
    };

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
          payoutPhone: session.driver.payoutPhone,
          payoutEmail: session.driver.payoutEmail,
          payoutStatus: session.driver.payoutStatus,
          currentLat: session.driver.currentLat,
          currentLng: session.driver.currentLng,
          lastPingAt: session.driver.lastPingAt,
          vehicle: session.driver.vehicles[0] || null,
          vehicles: vehiclesList,
          docDates,
          expiringDocuments,
        },
        activeBooking: maskBookingForDriver(activeBookingWithOtp),
        upcomingBookings: (upcomingBookings || []).map(maskBookingForDriver),
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
