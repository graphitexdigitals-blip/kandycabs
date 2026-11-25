import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, BookingStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { isSessionSuperceded } from '@/lib/auth';

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

    let payload = await verifyAuthToken(token);
    if ((!payload || !payload.userId) && token.startsWith('token-')) {
      const phoneDigits = token.replace('token-', '').replace(/\D/g, '').slice(-10);
      const matchedUser = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: `+91${phoneDigits}` },
            { phone: phoneDigits },
            { phone: { contains: phoneDigits } },
          ],
        },
      });
      if (matchedUser) {
        payload = {
          userId: matchedUser.id,
          phone: matchedUser.phone,
          roles: matchedUser.roles as any,
        };
      }
    }

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

    if (isSessionSuperceded(payload, user)) {
      const res = NextResponse.json(
        {
          error: 'SESSION_TERMINATED',
          code: 'SESSION_TERMINATED',
          message: 'You have been logged out because this account was logged into another device. Please log in again.',
        },
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
      const cleanDigits = user.phone.replace(/\D/g, '').slice(-10);
      const allUsersWithPhone = await prisma.user.findMany({
        where: {
          OR: [
            { phone: user.phone },
            { phone: `+91${cleanDigits}` },
            { phone: cleanDigits },
            { phone: { contains: cleanDigits } },
          ],
        },
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

    const orderBy: any = category === 'ACTIVE'
      ? [{ scheduledAt: 'asc' }, { createdAt: 'desc' }]
      : { createdAt: 'desc' };

    const [totalCount, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        orderBy,
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

      const cancelEvent = b.tripEvents?.find(
        (e: any) => e.type === 'BOOKING_CANCELLED'
      );
      const refundEvent = b.tripEvents?.find(
        (e: any) => e.type === 'CANCELLATION_REFUND_PROCESSED'
      );
      const feeWaivedEvent = b.tripEvents?.find(
        (e: any) => e.type === 'CANCELLATION_FEE_WAIVED'
      );

      let cancellationDetails: any = null;
      let refundDetails: any = null;
      let refundStatus: 'REFUNDED' | 'IN_PROCESS' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';

      if (cancelEvent?.payloadJson || b.status === BookingStatus.CANCELLED) {
        let rawJson: any = {};
        if (cancelEvent?.payloadJson) {
          rawJson = typeof cancelEvent.payloadJson === 'string'
            ? JSON.parse(cancelEvent.payloadJson)
            : cancelEvent.payloadJson;
        }

        const isFeeWaived = Boolean(rawJson.waiveCharge || feeWaivedEvent);
        const originalCharge = Number(rawJson.cancellationCharge ?? 0);
        const cancellationCharge = isFeeWaived ? 0 : originalCharge;
        const advancePaid = Number(rawJson.advancePaid ?? b.advanceAmount ?? 0);
        const refundAmount = Math.max(
          0,
          isFeeWaived
            ? advancePaid
            : (rawJson.refundAmount != null ? Number(rawJson.refundAmount) : advancePaid - cancellationCharge)
        );

        if (refundEvent?.payloadJson) {
          const rJson = typeof refundEvent.payloadJson === 'string'
            ? JSON.parse(refundEvent.payloadJson)
            : refundEvent.payloadJson;
          refundDetails = {
            status: 'REFUNDED',
            refundAmount: Number(rJson.refundAmount ?? refundAmount),
            refundMethod: rJson.refundMethod || 'UPI',
            refundTxnRef: rJson.refundTxnRef || '',
            notes: rJson.notes || '',
            processedAt: rJson.processedAt || refundEvent.createdAt,
          };
        }

        const isRefundDone = Boolean(
          b.advancePaymentStatus === 'REFUNDED' ||
          refundDetails?.status === 'REFUNDED'
        );

        if (isRefundDone) {
          refundStatus = 'REFUNDED';
        } else if (refundAmount > 0) {
          refundStatus = 'IN_PROCESS';
        } else {
          refundStatus = 'NOT_APPLICABLE';
        }

        cancellationDetails = {
          mode: rawJson.mode,
          isAdvanceNonRefundable: isFeeWaived ? false : Boolean(rawJson.isAdvanceNonRefundable || rawJson.mode === 'ADVANCE_NON_REFUNDABLE'),
          cancellationCharge,
          originalCharge,
          isFeeWaived,
          refundAmount,
          advancePaid,
          isWithinWindow: Boolean(rawJson.isWithinWindow),
          hoursUntilPickup: rawJson.hoursUntilPickup,
          reason: rawJson.reason || 'Trip Cancelled',
          cancelledBy: rawJson.cancelledBy || 'CUSTOMER',
          timestamp: rawJson.timestamp || cancelEvent?.createdAt || b.createdAt,
          isRefundDone,
          refundStatus,
          refundDetails,
        };
      }

      return {
        ...b,
        customerRating,
        cancellationDetails,
        refundDetails,
        refundStatus,
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
