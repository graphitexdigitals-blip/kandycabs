import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getAdminSession } from '@/lib/auth';

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

    // Look for recent breakdown events from the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const breakdownEvents = await prisma.tripEvent.findMany({
      where: {
        type: 'VEHICLE_BREAKDOWN',
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Filter for unresolved incidents
    const activeIncidents = breakdownEvents
      .map((ev) => {
        const payload = (ev.payloadJson as any) || {};
        return {
          eventId: ev.id,
          bookingId: ev.bookingId,
          ...payload,
        };
      })
      .filter((inc) => inc.resolved !== true);

    return NextResponse.json({
      success: true,
      count: activeIncidents.length,
      incidents: activeIncidents,
    });
  } catch (err: any) {
    console.error('Failed to query active breakdowns:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Error fetching breakdown alerts' },
      { status: 500 }
    );
  }
}

