import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin privileges required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { eventId, incidentId, resolutionNote = 'Acknowledged by dispatch operator' } = body;

    let targetEvent: any = null;

    if (eventId) {
      targetEvent = await prisma.tripEvent.findUnique({ where: { id: eventId } });
    } else if (incidentId) {
      // Find event containing matching incidentId
      const events = await prisma.tripEvent.findMany({
        where: { type: 'VEHICLE_BREAKDOWN' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      targetEvent = events.find((ev) => (ev.payloadJson as any)?.incidentId === incidentId);
    }

    if (!targetEvent) {
      return NextResponse.json(
        { success: false, message: 'Breakdown incident event not found' },
        { status: 404 }
      );
    }

    const currentPayload = (targetEvent.payloadJson as any) || {};
    const updatedPayload = {
      ...currentPayload,
      resolved: true,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedByAdminId: session.userId,
      resolutionNote,
    };

    await prisma.$transaction(async (tx) => {
      await tx.tripEvent.update({
        where: { id: targetEvent.id },
        data: {
          payloadJson: updatedPayload,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: 'ACKNOWLEDGE_VEHICLE_BREAKDOWN',
          entityType: 'Booking',
          entityId: targetEvent.bookingId,
          reason: `Admin acknowledged breakdown incident: ${resolutionNote}`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Breakdown alert acknowledged and alarm silenced.',
    });
  } catch (err: any) {
    console.error('Failed to acknowledge breakdown:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Error acknowledging breakdown' },
      { status: 500 }
    );
  }
}

