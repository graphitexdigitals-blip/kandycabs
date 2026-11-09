import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, BookingStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    let token = req.cookies.get('kandy_session')?.value;
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const authPayload = await verifyAuthToken(token);
    if (!authPayload || !authPayload.userId) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired session' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const body = await req.json();
    const { bookingId, lat, lng } = body;

    if (!bookingId || typeof lat !== 'number' || typeof lng !== 'number') {
      const res = NextResponse.json(
        { success: false, message: 'Valid bookingId, lat, and lng are required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const customer = await prisma.customer.findUnique({
      where: { userId: authPayload.userId },
    });

    if (!customer) {
      const res = NextResponse.json(
        { error: 'Forbidden', message: 'Customer account not found' },
        { status: 403 }
      );
      return setCorsHeaders(res);
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        customerId: customer.id,
      },
    });

    if (!booking) {
      const res = NextResponse.json(
        { success: false, message: 'Booking not found or not owned by you' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    // Strictly enforce the "find me for pickup" window: DRIVER_ACCEPTED or DRIVER_EN_ROUTE only
    const isPickupWindow =
      booking.status === BookingStatus.DRIVER_ACCEPTED ||
      booking.status === BookingStatus.DRIVER_EN_ROUTE;

    if (!isPickupWindow) {
      // Automatic stop / no-op if status has progressed to TRIP_STARTED, COMPLETED, or CANCELLED
      const res = NextResponse.json({
        success: true,
        active: false,
        message: 'Location sharing is not active for this ride stage.',
      });
      return setCorsHeaders(res);
    }

    if (!booking.customerLocationSharingEnabled) {
      const res = NextResponse.json({
        success: true,
        active: false,
        message: 'Location sharing is paused by customer toggle.',
      });
      return setCorsHeaders(res);
    }

    // Update customer live position for Flow B
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        customerCurrentLat: lat,
        customerCurrentLng: lng,
        customerLocationUpdatedAt: new Date(),
      },
    });

    const res = NextResponse.json({
      success: true,
      active: true,
      lat,
      lng,
      updatedAt: new Date().toISOString(),
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/customer/location-ping:', error);
    const res = NextResponse.json(
      { error: error.message || 'Failed to update customer live location' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
