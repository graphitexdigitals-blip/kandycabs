import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, BookingStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate customer
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

    let user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { customer: true },
    });

    if (!user) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'User not found' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    let customer = user.customer;
    if (!customer) {
      customer = await prisma.customer.create({
        data: { userId: payload.userId },
      });
    }

    const { searchParams } = new URL(req.url);
    const filterKey = searchParams.get('category') || searchParams.get('status') || 'ALL';
    const category = filterKey.toUpperCase().trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    // Collect all customer IDs associated with this user's phone number
    const customerIds = [customer.id];
    if (user.phone) {
      const allUsersWithPhone = await prisma.user.findMany({
        where: { phone: user.phone },
        select: {
          customer: {
            select: { id: true },
          },
        },
      });
      for (const u of allUsersWithPhone) {
        if (u.customer && !customerIds.includes(u.customer.id)) {
          customerIds.push(u.customer.id);
        }
      }
    }

    const where: any = {
      customerId: { in: customerIds },
      deletedAt: null,
    };

    if (category === 'ACTIVE') {
      where.status = {
        in: [
          BookingStatus.PENDING_ADMIN,
          BookingStatus.DISPATCHED,
          BookingStatus.DRIVER_ACCEPTED,
          BookingStatus.DRIVER_EN_ROUTE,
          BookingStatus.TRIP_STARTED,
        ],
      };
    } else if (category === 'COMPLETED') {
      where.status = BookingStatus.TRIP_COMPLETED;
    } else if (category === 'CANCELLED') {
      where.status = BookingStatus.CANCELLED;
    }

    const [totalCount, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          assignedDriver: {
            include: {
              user: {
                select: { fullName: true, phone: true },
              },
              vehicles: true,
            },
          },
          vehicle: true,
          payments: {
            orderBy: { verifiedAt: 'desc' },
          },
          tripEvents: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      }),
    ]);

    const enrichedBookings = bookings.map((b) => {
      const ratingEvent = b.tripEvents?.find(
        (e: any) => e.type === 'TRIP_REVIEWED' || e.type === 'DRIVER_RATED'
      );
      let customerRating = null;
      if (ratingEvent?.payloadJson) {
        const rawJson = typeof ratingEvent.payloadJson === 'string'
          ? JSON.parse(ratingEvent.payloadJson)
          : ratingEvent.payloadJson;
        customerRating = {
          ...rawJson,
          rating: rawJson.driverRating || rawJson.rating || 5,
          driverRating: rawJson.driverRating || rawJson.rating || 5,
          driverFeedbackTags: rawJson.driverFeedbackTags || rawJson.feedbackTags || [],
          kandyRating: rawJson.kandyRating || 5,
          kandyFeedbackTags: rawJson.kandyFeedbackTags || [],
          comment: rawJson.comment || '',
        };
      }
      return {
        ...b,
        customerRating,
        driverRating: b.assignedDriver ? 4.9 : null,
      };
    });

    const totalPages = Math.ceil(totalCount / limit) || 1;

    const response = NextResponse.json(
      {
        success: true,
        customerId: customer.id,
        bookings: enrichedBookings,
        pagination: {
          totalCount,
          totalPages,
          page,
          limit,
        },
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in GET /api/customer/bookings/list:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch customer bookings', bookings: [] },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
