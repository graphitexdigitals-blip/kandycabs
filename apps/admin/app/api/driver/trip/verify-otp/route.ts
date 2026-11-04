import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { verifyOtp } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const session = await getDriverSession(req);
    if (!session) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Driver authentication required' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const body = await req.json();
    const { bookingId, pickupOtp } = body;

    if (!bookingId || !pickupOtp) {
      const res = NextResponse.json(
        { success: false, message: 'Booking ID and Pickup OTP are required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        assignedDriverId: session.driverId,
      },
    });

    if (!booking) {
      const res = NextResponse.json(
        { success: false, message: 'Booking not found or not assigned to you' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    const isOtpValid = verifyOtp(pickupOtp.trim(), booking.pickupOtp || '');
    if (!isOtpValid) {
      const res = NextResponse.json(
        { success: false, message: 'Incorrect 4-digit pickup OTP. Please verify with customer.' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Persist verified OTP event to database so state survives page refresh & back navigation
    await prisma.tripEvent.create({
      data: {
        bookingId,
        type: 'OTP_VERIFIED',
        payloadJson: {
          driverId: session.driverId,
          otp: pickupOtp.trim(),
          verifiedAt: new Date().toISOString(),
        },
      },
    }).catch((e) => console.error('Failed to log OTP_VERIFIED event:', e));

    const res = NextResponse.json(
      {
        success: true,
        verified: true,
        message: 'Customer pickup OTP verified successfully!',
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/trip/verify-otp:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to verify OTP' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

