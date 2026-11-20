import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { BookingStatus, DriverVerificationStatus } from '@kandy-cabs/shared';
import { getAdminSession } from '@/lib/auth';
import { getExpiringDocuments } from '@/lib/documentExpiry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin privileges required' },
        { status: 401 }
      );
    }

    const now = new Date();
    // Accurate IST midnight calculation (UTC+05:30)
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(now.getTime() + istOffsetMs);
    const y = nowIst.getUTCFullYear();
    const m = nowIst.getUTCMonth();
    const d = nowIst.getUTCDate();

    const todayStart = new Date(Date.UTC(y, m, d) - istOffsetMs);
    const todayEnd = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - istOffsetMs);
    const tomorrowStart = new Date(Date.UTC(y, m, d + 1) - istOffsetMs);
    const tomorrowEnd = new Date(Date.UTC(y, m, d + 1, 23, 59, 59, 999) - istOffsetMs);

    // Parallel fetch using groupBy aggregations and lean select projections
    const [
      bookingStatusGroups,
      driverStatusGroups,
      onlineDrivers,
      totalFleets,
      pricingRulesCount,
      paymentsSummary,
      recentBookings,
      recentAuditLogs,
      activeDriversWithNotes,
      operationalBookings,
    ] = await Promise.all([
      // 1. Grouped booking status counts
      prisma.booking.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),

      // 2. Grouped driver verification status counts
      prisma.driver.groupBy({
        by: ['verificationStatus'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),

      // 3. Online Drivers count
      prisma.driver.count({ where: { onlineStatus: true, deletedAt: null } }),

      // 4. Total Fleet Categories
      prisma.fleetCategory.count(),

      // 5. Active Pricing Rules
      prisma.pricingRule.count(),

      // 6. Financial aggregations
      prisma.booking.aggregate({
        where: { deletedAt: null },
        _sum: {
          estimatedFare: true,
          advanceAmount: true,
        },
      }),

      // 7. Latest 6 bookings (lean select)
      prisma.booking.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          humanReadableRef: true,
          tripType: true,
          pickupAddress: true,
          dropAddress: true,
          status: true,
          estimatedFare: true,
          createdAt: true,
          customer: {
            select: {
              user: { select: { fullName: true, phone: true } },
            },
          },
          assignedDriver: {
            select: {
              user: { select: { fullName: true, phone: true } },
            },
          },
          tripEvents: {
            select: { id: true, type: true, payloadJson: true },
          },
        },
      }),

      // 8. Latest 6 audit logs
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
          actorUser: {
            select: { fullName: true, phone: true, roles: true },
          },
        },
      }),

      // 9. Drivers with document notes for auto-expiry reminder tracking
      prisma.driver.findMany({
        where: { deletedAt: null, adminNotes: { not: null } },
        select: {
          id: true,
          adminNotes: true,
          user: { select: { fullName: true, phone: true } },
          vehicles: { select: { plateNumber: true } },
        },
      }),

      // 10. Operational Schedule Bookings: Today, Tomorrow, Driver Not Accepted, & Missed Pickup Candidates
      prisma.booking.findMany({
        where: {
          deletedAt: null,
          status: { not: BookingStatus.CANCELLED },
          OR: [
            // Scheduled for today or tomorrow
            { scheduledAt: { gte: todayStart, lte: tomorrowEnd } },
            // Past scheduled pickups that never started or completed (missed pickup / overdue)
            {
              scheduledAt: { lt: now },
              status: { in: [BookingStatus.PENDING_ADMIN, BookingStatus.DISPATCHED, BookingStatus.DRIVER_ACCEPTED] },
            },
            // Driver not accepted (dispatched) or pending admin dispatch
            { status: BookingStatus.DISPATCHED },
            { status: BookingStatus.PENDING_ADMIN },
          ],
        },
        orderBy: { scheduledAt: 'asc' },
        take: 150,
        select: {
          id: true,
          humanReadableRef: true,
          tripType: true,
          pickupAddress: true,
          dropAddress: true,
          scheduledAt: true,
          status: true,
          estimatedFare: true,
          advanceAmount: true,
          advancePaymentStatus: true,
          balanceAmount: true,
          balancePaymentStatus: true,
          assignedDriverId: true,
          actualStartedAt: true,
          createdAt: true,
          customer: {
            select: {
              user: { select: { fullName: true, phone: true } },
            },
          },
          assignedDriver: {
            select: {
              id: true,
              user: { select: { fullName: true, phone: true } },
              vehicles: { select: { plateNumber: true, category: true } },
            },
          },
          dispatches: {
            where: { status: 'PENDING' },
            orderBy: { broadcastAt: 'desc' },
            take: 1,
            select: {
              id: true,
              broadcastAt: true,
              status: true,
              driver: {
                select: {
                  user: { select: { fullName: true, phone: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    // Aggregate booking counts
    const bookingCountsMap: Record<string, number> = {};
    let totalBookings = 0;
    for (const g of bookingStatusGroups) {
      bookingCountsMap[g.status] = g._count._all;
      totalBookings += g._count._all;
    }

    const pendingAdminBookings = bookingCountsMap[BookingStatus.PENDING_ADMIN] || 0;
    const dispatchedBookings = bookingCountsMap[BookingStatus.DISPATCHED] || 0;
    const activeRidesCount =
      (bookingCountsMap[BookingStatus.DISPATCHED] || 0) +
      (bookingCountsMap[BookingStatus.DRIVER_ACCEPTED] || 0) +
      (bookingCountsMap[BookingStatus.DRIVER_EN_ROUTE] || 0) +
      (bookingCountsMap[BookingStatus.TRIP_STARTED] || 0);
    const completedBookings = bookingCountsMap[BookingStatus.TRIP_COMPLETED] || 0;
    const cancelledBookings = bookingCountsMap[BookingStatus.CANCELLED] || 0;

    // Aggregate driver counts
    const driverCountsMap: Record<string, number> = {};
    let totalDrivers = 0;
    for (const g of driverStatusGroups) {
      driverCountsMap[g.verificationStatus] = g._count._all;
      totalDrivers += g._count._all;
    }

    const pendingKycDrivers = driverCountsMap[DriverVerificationStatus.PENDING] || 0;
    const approvedDrivers = driverCountsMap[DriverVerificationStatus.APPROVED] || 0;

    // Evaluate expiring & expired documents across all drivers (threshold <= 5 days)
    const expiringDrivers: Array<{
      driverId: string;
      fullName: string;
      phone: string;
      plateNumber?: string | null;
      expiringCount: number;
      expiringDocuments: any[];
    }> = [];

    for (const d of (activeDriversWithNotes || [])) {
      if (!d.adminNotes) continue;
      let docDates: Record<string, any> = {};
      const datesMatch = d.adminNotes.match(/\[DocDates:\s*(\{.*?\})\]/);
      if (datesMatch && datesMatch[1]) {
        try { docDates = JSON.parse(datesMatch[1]); } catch {}
      }
      if (!docDates || Object.keys(docDates).length === 0) {
        const extraMatch = d.adminNotes.match(/\[ExtraDocs:\s*(\{.*?\})\]/);
        if (extraMatch && extraMatch[1]) {
          try {
            const extra = JSON.parse(extraMatch[1]);
            if (extra.docDates) docDates = extra.docDates;
          } catch {}
        }
      }
      const expiring = getExpiringDocuments(docDates, 5);
      if (expiring.length > 0) {
        expiringDrivers.push({
          driverId: d.id,
          fullName: d.user?.fullName || 'Driver',
          phone: d.user?.phone || '',
          plateNumber: d.vehicles?.[0]?.plateNumber || undefined,
          expiringCount: expiring.length,
          expiringDocuments: expiring,
        });
      }
    }

    const grossRevenue = Number(paymentsSummary._sum?.estimatedFare || 0);
    const advanceCollected = Number(paymentsSummary._sum?.advanceAmount || 0);

    // Process operational schedule bookings
    const nowTime = now.getTime();
    const missedPickups: any[] = [];
    const todayTrips: any[] = [];
    const tomorrowTrips: any[] = [];
    const driverNotAccepted: any[] = [];

    const seenMissed = new Set<string>();
    const seenToday = new Set<string>();
    const seenTomorrow = new Set<string>();
    const seenNotAccepted = new Set<string>();

    for (const b of (operationalBookings || [])) {
      const schedTime = new Date(b.scheduledAt).getTime();
      const isToday = schedTime >= todayStart.getTime() && schedTime <= todayEnd.getTime();
      const isTomorrow = schedTime >= tomorrowStart.getTime() && schedTime <= tomorrowEnd.getTime();
      const isPast = schedTime < nowTime;
      const hasStarted = b.status === BookingStatus.TRIP_STARTED || b.status === BookingStatus.TRIP_COMPLETED;
      const isEnRoute = b.status === BookingStatus.DRIVER_EN_ROUTE;

      // Minutes difference (positive = future, negative = past)
      const diffMinutes = Math.round((schedTime - nowTime) / (60 * 1000));

      // Determine operational risk level
      let riskLevel: 'NORMAL' | 'AT_RISK' | 'MISSED_PICKUP' = 'NORMAL';
      let riskMessage = '';

      if (isPast && !hasStarted && b.status !== BookingStatus.CANCELLED) {
        riskLevel = 'MISSED_PICKUP';
        const minsOverdue = Math.abs(diffMinutes);
        const hoursOverdue = Math.floor(minsOverdue / 60);
        const remMins = minsOverdue % 60;
        const timeOverdueStr = hoursOverdue > 0 ? `${hoursOverdue}h ${remMins}m` : `${minsOverdue}m`;
        riskMessage = `Driver missed pickup! Scheduled ${timeOverdueStr} ago, trip not started.`;
      } else if (isToday && !hasStarted && !isEnRoute && diffMinutes <= 45 && diffMinutes >= 0) {
        riskLevel = 'AT_RISK';
        riskMessage = `Urgent: Pickup in ${diffMinutes} mins! Driver has not started moving en-route.`;
      }

      const enhancedBooking = {
        ...b,
        diffMinutes,
        riskLevel,
        riskMessage,
        isToday,
        isTomorrow,
        isPast,
      };

      // 1. Missed Pickup
      if (riskLevel === 'MISSED_PICKUP' && !seenMissed.has(b.id)) {
        seenMissed.add(b.id);
        missedPickups.push(enhancedBooking);
      }

      // 2. Today's Trips
      if (isToday && !seenToday.has(b.id)) {
        seenToday.add(b.id);
        todayTrips.push(enhancedBooking);
      }

      // 3. Tomorrow's Trips
      if (isTomorrow && !seenTomorrow.has(b.id)) {
        seenTomorrow.add(b.id);
        tomorrowTrips.push(enhancedBooking);
      }

      // 4. Driver Not Accepted (Dispatched or Pending Admin for upcoming)
      if (
        (b.status === BookingStatus.DISPATCHED || b.status === BookingStatus.PENDING_ADMIN) &&
        !seenNotAccepted.has(b.id)
      ) {
        seenNotAccepted.add(b.id);
        driverNotAccepted.push(enhancedBooking);
      }
    }

    return NextResponse.json({
      stats: {
        bookings: {
          total: totalBookings,
          pendingAdmin: pendingAdminBookings,
          dispatched: dispatchedBookings,
          active: activeRidesCount,
          completed: completedBookings,
          cancelled: cancelledBookings,
        },
        financials: {
          grossRevenue,
          advanceCollected,
        },
        drivers: {
          total: totalDrivers,
          online: onlineDrivers,
          pendingKyc: pendingKycDrivers,
          approved: approvedDrivers,
          expiringDocumentsCount: expiringDrivers.length,
          expiringDrivers,
        },
        fleets: {
          categoriesCount: totalFleets,
          pricingRulesCount: pricingRulesCount,
        },
        operationalWatch: {
          todayCount: todayTrips.length,
          tomorrowCount: tomorrowTrips.length,
          missedPickupCount: missedPickups.length,
          driverNotAcceptedCount: driverNotAccepted.length,
          atRiskCount: todayTrips.filter((t: any) => t.riskLevel === 'AT_RISK').length,
        },
      },
      operationalSchedule: {
        todayTrips,
        tomorrowTrips,
        missedPickups,
        driverNotAccepted,
      },
      recentBookings,
      recentAuditLogs,
    });
  } catch (error: any) {
    console.error('Error fetching admin dashboard stats:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
