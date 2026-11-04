import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { DispatchStatus, BookingStatus } from '@kandy-cabs/shared';
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

    const pendingDispatches = await prisma.bookingDispatch.findMany({
      where: {
        driverId: session.driverId,
        status: DispatchStatus.PENDING,
        booking: {
          deletedAt: null,
          status: { in: [BookingStatus.PENDING_ADMIN, BookingStatus.DISPATCHED] },
        },
      },
      include: {
        booking: {
          include: {
            customer: {
              include: {
                user: { select: { fullName: true, phone: true } },
              },
            },
          },
        },
      },
      orderBy: { broadcastAt: 'desc' },
    });

    const response = NextResponse.json(
      {
        success: true,
        dispatches: pendingDispatches,
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in GET /api/driver/dispatches:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch dispatches', dispatches: [] },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
