import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getAdminSession } from '@/lib/auth';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      const res = NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      return setCorsHeaders(res);
    }

    // Find all bookings with assigned driver where latest DRIVER_CANCEL_REQUESTED event is pending
    const bookings = await prisma.booking.findMany({
      where: {
        deletedAt: null,
        assignedDriverId: { not: null },
        tripEvents: {
          some: {
            type: 'DRIVER_CANCEL_REQUESTED',
          },
        },
      },
      include: {
        assignedDriver: {
          include: {
            user: { select: { fullName: true, phone: true } },
            vehicles: { select: { category: true, plateNumber: true } },
          },
        },
        customer: {
          include: {
            user: { select: { fullName: true, phone: true } },
          },
        },
        tripEvents: {
          where: {
            type: { in: ['DRIVER_CANCEL_REQUESTED', 'DRIVER_CANCEL_APPROVED'] },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const activeRequests = bookings
      .filter((b: any) => {
        const cancelReqEvent = b.tripEvents?.find((e: any) => e.type === 'DRIVER_CANCEL_REQUESTED');
        const cancelAppEvent = b.tripEvents?.find((e: any) => e.type === 'DRIVER_CANCEL_APPROVED');
        return (
          Boolean(cancelReqEvent) &&
          (!cancelAppEvent || new Date(cancelReqEvent.createdAt) > new Date(cancelAppEvent.createdAt))
        );
      })
      .map((b: any) => {
        const latestReq = b.tripEvents?.find((e: any) => e.type === 'DRIVER_CANCEL_REQUESTED');
        const payload: any = latestReq?.payloadJson || {};
        return {
          bookingId: b.id,
          bookingRef: b.humanReadableRef || b.id,
          driverId: b.assignedDriverId,
          driverName: b.assignedDriver?.user?.fullName || payload.driverName || 'Driver Partner',
          driverPhone: b.assignedDriver?.user?.phone || payload.driverPhone || '',
          vehiclePlate: b.assignedDriver?.vehicles?.[0]?.plateNumber || '',
          customerName: b.customer?.user?.fullName || 'Customer',
          customerPhone: b.customer?.user?.phone || '',
          pickupAddress: b.pickupAddress,
          dropAddress: b.dropAddress,
          tripType: b.tripType,
          scheduledAt: b.scheduledAt,
          reason: payload.reason || 'Reason not specified',
          requestedAt: latestReq?.createdAt || new Date(),
        };
      });

    const res = NextResponse.json({ success: true, requests: activeRequests }, { status: 200 });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error fetching active driver cancellation requests:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch cancellation requests' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
