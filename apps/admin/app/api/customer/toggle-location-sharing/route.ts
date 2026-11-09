import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken } from '@kandy-cabs/shared';
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
    const { bookingId, enabled } = body;

    if (!bookingId || typeof enabled !== 'boolean') {
      const res = NextResponse.json(
        { success: false, message: 'bookingId and boolean enabled are required' },
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
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    // Update sharing preference; if turning off, clear the coordinates so driver app falls back to static pin
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        customerLocationSharingEnabled: enabled,
        ...(enabled === false ? { customerCurrentLat: null, customerCurrentLng: null } : {}),
      },
    });

    const res = NextResponse.json({
      success: true,
      enabled,
      message: enabled
        ? 'Live pickup location sharing enabled'
        : 'Live location sharing turned off',
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error toggling location sharing:', error);
    const res = NextResponse.json(
      { error: error.message || 'Failed to toggle location sharing' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
