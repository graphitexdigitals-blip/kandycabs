import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin privileges required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
    }

    // 1. Record TripEvent for FLEET_APPROVED
    await prisma.tripEvent.create({
      data: {
        bookingId: id,
        type: 'FLEET_APPROVED',
        payloadJson: {
          approvedBy: session.userId,
          approvedAt: new Date().toISOString(),
          message: 'Fleet availability verified & approved by Admin. Customer can now complete advance payment from My Bookings.',
        },
      },
    });

    // 2. Record AuditLog
    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: 'ADMIN_APPROVE_FLEET',
        entityType: 'Booking',
        entityId: id,
        reason: `Admin approved fleet availability for booking ${booking.humanReadableRef}. Customer enabled to pay advance.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Fleet availability approved for ${booking.humanReadableRef}. Customer can now pay advance.`,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/bookings/[id]/approve-fleet:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to approve fleet availability' },
      { status: 500 }
    );
  }
}

