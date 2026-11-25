import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, BookingStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      const res = NextResponse.json({ success: false, message: 'Booking ID required' }, { status: 400 });
      return setCorsHeaders(res);
    }

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [{ id }, { humanReadableRef: id }],
      },
      include: {
        payments: true,
        customer: true,
        assignedDriver: true,
      },
    });

    if (!booking) {
      const res = NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
      return setCorsHeaders(res);
    }

    const res = NextResponse.json({ success: true, booking }, { status: 200 });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in GET /api/customer/bookings/[id]:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch booking' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      const res = NextResponse.json({ success: false, message: 'Booking ID required' }, { status: 400 });
      return setCorsHeaders(res);
    }

    const booking = await prisma.booking.findFirst({
      where: {
        OR: [{ id }, { humanReadableRef: id }],
      },
      include: {
        customer: {
          include: { user: true },
        },
      },
    });

    if (!booking) {
      const res = NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
      return setCorsHeaders(res);
    }

    // Disallow editing ongoing or completed trips
    const nonEditableStatuses: BookingStatus[] = [
      BookingStatus.TRIP_STARTED,
      BookingStatus.TRIP_COMPLETED,
      BookingStatus.CANCELLED,
    ];
    if (nonEditableStatuses.includes(booking.status as BookingStatus)) {
      const res = NextResponse.json(
        {
          success: false,
          message: `Trip cannot be modified in ${booking.status} status. Please contact support.`,
        },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Try to resolve customer user for audit log
    let actorUserId = booking.customer?.user?.id || null;
    let actorName = booking.customer?.user?.fullName || 'Customer';

    let token = req.cookies.get('kandy_session')?.value;
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (token) {
      try {
        const payload = await verifyAuthToken(token);
        if (payload?.userId) {
          actorUserId = payload.userId;
          const u = await prisma.user.findUnique({ where: { id: payload.userId }, select: { fullName: true } });
          if (u?.fullName) actorName = u.fullName;
        }
      } catch (_) {}
    }

    const body = await req.json().catch(() => ({}));
    const { pickupAddress, dropAddress, scheduledAt, notes } = body;

    const changes: string[] = [];
    const dataToUpdate: any = {};

    if (pickupAddress && typeof pickupAddress === 'string' && pickupAddress.trim()) {
      const cleanPickup = pickupAddress.trim();
      if (cleanPickup !== booking.pickupAddress) {
        changes.push(`Pickup changed from "${booking.pickupAddress}" to "${cleanPickup}"`);
        dataToUpdate.pickupAddress = cleanPickup;
      }
    }

    if (dropAddress && typeof dropAddress === 'string' && dropAddress.trim()) {
      const cleanDrop = dropAddress.trim();
      if (cleanDrop !== booking.dropAddress) {
        changes.push(`Drop destination changed from "${booking.dropAddress}" to "${cleanDrop}"`);
        dataToUpdate.dropAddress = cleanDrop;
      }
    }

    if (scheduledAt) {
      const newDate = new Date(scheduledAt);
      if (!isNaN(newDate.getTime())) {
        const oldTime = new Date(booking.scheduledAt).getTime();
        if (Math.abs(oldTime - newDate.getTime()) > 60000) {
          const oldFormatted = new Date(booking.scheduledAt).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
          const newFormatted = newDate.toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
          changes.push(`Scheduled pickup changed from "${oldFormatted}" to "${newFormatted}"`);
          dataToUpdate.scheduledAt = newDate;
        }
      }
    }

    if (notes && typeof notes === 'string' && notes.trim()) {
      changes.push(`Trip notes: "${notes.trim()}"`);
    }

    if (changes.length === 0) {
      const res = NextResponse.json({
        success: true,
        message: 'No changes detected',
        booking,
      });
      return setCorsHeaders(res);
    }

    // 1. Update Booking record
    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: dataToUpdate,
      include: {
        customer: true,
        assignedDriver: true,
        payments: true,
      },
    });

    const changeSummary = changes.join(' | ');

    // 2. Create AuditLog entry visible in Admin Audit Trail
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId,
        action: 'CUSTOMER_UPDATE_TRIP',
        entityType: 'Booking',
        entityId: booking.id,
        reason: `${actorName} updated trip (${booking.humanReadableRef}): ${changeSummary}`,
      },
    });

    // 3. Create TripEvent record
    await prisma.tripEvent.create({
      data: {
        bookingId: booking.id,
        type: 'CUSTOMER_TRIP_UPDATED',
        payloadJson: {
          actorName,
          actorUserId,
          changes,
          summary: changeSummary,
          timestamp: new Date().toISOString(),
        },
      },
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Trip details updated successfully',
        booking: updatedBooking,
        changes,
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in PATCH /api/customer/bookings/[id]:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to update trip details' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
