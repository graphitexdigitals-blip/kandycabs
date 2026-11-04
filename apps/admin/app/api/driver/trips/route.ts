import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { BookingStatus } from '@kandy-cabs/shared';
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

    // Fetch all trips assigned to this driver
    const completedBookings = await prisma.booking.findMany({
      where: {
        assignedDriverId: session.driverId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          include: {
            user: { select: { fullName: true, phone: true } },
          },
        },
        vehicle: true,
      },
    });

    // Compute driver financial earnings & settlements summary (All-time & Monthly)
    let totalAllowanceEarned = 0;
    let totalPayeeEarned = 0;
    let totalSettled = 0;
    let totalPending = 0;
    let completedTripsCount = 0;

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const monthlyMap: Record<
      string,
      {
        monthKey: string;
        monthName: string;
        shortMonth: string;
        year: number;
        month: number;
        totalAllowanceEarned: number;
        totalPayeeEarned: number;
        totalEarnings: number;
        totalSettled: number;
        totalPending: number;
        completedTripsCount: number;
        totalTripsCount: number;
        isCurrentMonth: boolean;
        isPreviousMonth: boolean;
      }
    > = {};

    // Helper to ensure month entry exists in map
    const getOrCreateMonth = (dateObj: Date) => {
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;

      if (!monthlyMap[key]) {
        const monthName = dateObj.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        const shortMonth = dateObj.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
        monthlyMap[key] = {
          monthKey: key,
          monthName,
          shortMonth,
          year,
          month,
          totalAllowanceEarned: 0,
          totalPayeeEarned: 0,
          totalEarnings: 0,
          totalSettled: 0,
          totalPending: 0,
          completedTripsCount: 0,
          totalTripsCount: 0,
          isCurrentMonth: key === currentMonthKey,
          isPreviousMonth: key === prevMonthKey,
        };
      }
      return monthlyMap[key];
    };

    // Ensure current month and previous month are always present in the map even if 0 trips
    getOrCreateMonth(now);
    getOrCreateMonth(prevMonthDate);

    const formattedTrips = completedBookings.map((b) => {
      const allowance = b.driverAllowance ? Number(b.driverAllowance) : 0;
      const payee = b.driverPayeeAmount ? Number(b.driverPayeeAmount) : 0;
      const totalEarnedForTrip = allowance + payee;
      const isSettled = b.driverPaymentStatus === 'PAID';
      const tripDate = new Date(b.createdAt);
      const monthObj = getOrCreateMonth(tripDate);

      monthObj.totalTripsCount++;

      if (b.status === BookingStatus.TRIP_COMPLETED) {
        completedTripsCount++;
        totalAllowanceEarned += allowance;
        totalPayeeEarned += payee;

        monthObj.completedTripsCount++;
        monthObj.totalAllowanceEarned += allowance;
        monthObj.totalPayeeEarned += payee;
        monthObj.totalEarnings += totalEarnedForTrip;

        if (isSettled) {
          totalSettled += totalEarnedForTrip;
          monthObj.totalSettled += totalEarnedForTrip;
        } else {
          totalPending += totalEarnedForTrip;
          monthObj.totalPending += totalEarnedForTrip;
        }
      }

      return {
        id: b.id,
        humanReadableRef: b.humanReadableRef,
        customerName: b.customer?.user?.fullName || 'Customer',
        customerPhone:
          b.customerPhoneReleased ||
          (b.scheduledAt && new Date(b.scheduledAt).getTime() - Date.now() <= 5 * 60 * 60 * 1000)
            ? b.customer?.user?.phone
            : null,
        tripType: b.tripType,
        pickupAddress: b.pickupAddress,
        dropAddress: b.dropAddress,
        scheduledAt: b.scheduledAt.toISOString(),
        distanceKm: b.actualDistanceKm || b.distanceKm,
        startingOdometer: b.startingOdometer,
        finalOdometer: b.finalOdometer,
        tollAmount: b.tollAmount ? Number(b.tollAmount) : 0,
        parkingAmount: b.parkingAmount ? Number(b.parkingAmount) : 0,
        driverAllowance: allowance,
        driverPayeeAmount: payee,
        totalEarnings: totalEarnedForTrip,
        driverPaymentStatus: b.driverPaymentStatus || 'PENDING',
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        monthKey: `${tripDate.getFullYear()}-${String(tripDate.getMonth() + 1).padStart(2, '0')}`,
      };
    });

    // Sort monthly breakdown by month descending (newest first)
    const monthlyBreakdown = Object.values(monthlyMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    const currentMonthSummary = monthlyMap[currentMonthKey] || {
      monthKey: currentMonthKey,
      monthName: now.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      shortMonth: now.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
      totalAllowanceEarned: 0,
      totalPayeeEarned: 0,
      totalEarnings: 0,
      totalSettled: 0,
      totalPending: 0,
      completedTripsCount: 0,
      totalTripsCount: 0,
      isCurrentMonth: true,
      isPreviousMonth: false,
    };

    const previousMonthSummary = monthlyMap[prevMonthKey] || {
      monthKey: prevMonthKey,
      monthName: prevMonthDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      shortMonth: prevMonthDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
      totalAllowanceEarned: 0,
      totalPayeeEarned: 0,
      totalEarnings: 0,
      totalSettled: 0,
      totalPending: 0,
      completedTripsCount: 0,
      totalTripsCount: 0,
      isCurrentMonth: false,
      isPreviousMonth: true,
    };

    const response = NextResponse.json(
      {
        success: true,
        summary: {
          totalAllowanceEarned,
          totalPayeeEarned,
          totalEarnings: totalAllowanceEarned + totalPayeeEarned,
          totalSettled,
          totalPending,
          completedTripsCount,
          totalTripsCount: formattedTrips.length,
        },
        currentMonthSummary,
        previousMonthSummary,
        monthlyBreakdown,
        trips: formattedTrips,
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in GET /api/driver/trips:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch driver trips and payments', trips: [] },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
