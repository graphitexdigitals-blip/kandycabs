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
      plateNumber?: string;
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
          plateNumber: d.vehicles?.[0]?.plateNumber,
          expiringCount: expiring.length,
          expiringDocuments: expiring,
        });
      }
    }

    const grossRevenue = Number(paymentsSummary._sum?.estimatedFare || 0);
    const advanceCollected = Number(paymentsSummary._sum?.advanceAmount || 0);

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
