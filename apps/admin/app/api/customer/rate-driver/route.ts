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

    const payload = await verifyAuthToken(token);
    if (!payload || !payload.userId) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const body = await req.json();
    const {
      bookingId,
      rating,
      driverRating: rawDriverRating,
      feedbackTags = [],
      driverFeedbackTags = [],
      kandyRating: rawKandyRating,
      kandyFeedbackTags = [],
      comment = '',
    } = body;

    if (!bookingId) {
      const res = NextResponse.json(
        { success: false, message: 'Booking ID is required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const numericDriverRating = Number(rawDriverRating || rating || 5);
    if (!numericDriverRating || numericDriverRating < 1 || numericDriverRating > 5) {
      const res = NextResponse.json(
        { success: false, message: 'Driver rating must be an integer between 1 and 5' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const numericKandyRating = Number(rawKandyRating || 5);
    if (!numericKandyRating || numericKandyRating < 1 || numericKandyRating > 5) {
      const res = NextResponse.json(
        { success: false, message: 'KandyCabs rating must be an integer between 1 and 5' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const finalDriverTags = Array.isArray(driverFeedbackTags) && driverFeedbackTags.length > 0
      ? driverFeedbackTags
      : (Array.isArray(feedbackTags) ? feedbackTags : []);
    const finalKandyTags = Array.isArray(kandyFeedbackTags) ? kandyFeedbackTags : [];

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          include: { user: true },
        },
        assignedDriver: {
          include: { user: true },
        },
      },
    });

    if (!booking) {
      const res = NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    // Verify ownership
    if (booking.customer.userId !== payload.userId && booking.customer.user.phone !== payload.phone) {
      const res = NextResponse.json(
        { error: 'Forbidden', message: 'You can only rate your own bookings' },
        { status: 403 }
      );
      return setCorsHeaders(res);
    }

    const ratingPayload = {
      // Driver details
      rating: numericDriverRating,
      driverRating: numericDriverRating,
      feedbackTags: finalDriverTags,
      driverFeedbackTags: finalDriverTags,
      driverId: booking.assignedDriverId || null,
      driverName: booking.assignedDriver?.user?.fullName || 'Assigned Driver',

      // KandyCabs Experience details
      kandyRating: numericKandyRating,
      kandyFeedbackTags: finalKandyTags,

      // Overall review / comment
      comment: typeof comment === 'string' ? comment.trim() : '',
      ratedAt: new Date().toISOString(),
      ratedByUserId: payload.userId,
    };

    // Atomic transaction: Record TripEvent & AuditLog
    await prisma.$transaction(async (tx) => {
      // Find existing DRIVER_RATED / TRIP_REVIEWED event to update or create
      const existingDriverRated = await tx.tripEvent.findFirst({
        where: {
          bookingId,
          type: 'DRIVER_RATED',
        },
      });

      if (existingDriverRated) {
        await tx.tripEvent.update({
          where: { id: existingDriverRated.id },
          data: {
            payloadJson: ratingPayload,
          },
        });
      } else {
        await tx.tripEvent.create({
          data: {
            bookingId,
            type: 'DRIVER_RATED',
            payloadJson: ratingPayload,
          },
        });
      }

      // Also ensure TRIP_REVIEWED event is recorded for explicit review querying
      const existingTripReviewed = await tx.tripEvent.findFirst({
        where: {
          bookingId,
          type: 'TRIP_REVIEWED',
        },
      });

      if (existingTripReviewed) {
        await tx.tripEvent.update({
          where: { id: existingTripReviewed.id },
          data: {
            payloadJson: ratingPayload,
          },
        });
      } else {
        await tx.tripEvent.create({
          data: {
            bookingId,
            type: 'TRIP_REVIEWED',
            payloadJson: ratingPayload,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: payload.userId,
          action: 'RATE_TRIP_AND_DRIVER',
          entityType: 'Booking',
          entityId: bookingId,
          reason: `Customer reviewed trip (${booking.humanReadableRef}): Driver ${numericDriverRating}/5, KandyCabs ${numericKandyRating}/5`,
        },
      });
    });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Thank you for rating KandyCabs and your driver!',
        rating: ratingPayload,
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in POST /api/customer/rate-driver:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to submit driver rating' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
