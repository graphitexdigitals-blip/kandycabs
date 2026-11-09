import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, PaymentType, PaymentStatus, BookingStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { paymentMethod = 'UPI', razorpayPaymentId } = body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        payments: true,
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
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { customer: true },
    });

    if (booking.customerId !== user?.customer?.id && booking.customer?.userId !== payload.userId) {
      const res = NextResponse.json(
        { error: 'Forbidden', message: 'Not authorized for this booking' },
        { status: 403 }
      );
      return setCorsHeaders(res);
    }

    if (booking.advancePaymentStatus === PaymentStatus.PAID) {
      const res = NextResponse.json(
        { success: true, message: 'Advance already paid for this booking' },
        { status: 200 }
      );
      return setCorsHeaders(res);
    }

    const advanceAmount = Number(booking.advanceAmount);
    const mockPaymentId = razorpayPaymentId || `pay_adv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Update booking and payment in transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update booking advance status
      await tx.booking.update({
        where: { id },
        data: {
          advancePaymentStatus: PaymentStatus.PAID,
        },
      });

      // 2. Find or create payment record
      const existingAdvPayment = booking.payments.find((p) => p.type === PaymentType.ADVANCE);
      if (existingAdvPayment) {
        await tx.payment.update({
          where: { id: existingAdvPayment.id },
          data: {
            status: PaymentStatus.PAID,
            verifiedAt: new Date(),
            razorpayPaymentId: mockPaymentId,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            bookingId: id,
            type: PaymentType.ADVANCE,
            amount: advanceAmount,
            razorpayOrderId: `order_${Date.now()}`,
            razorpayPaymentId: mockPaymentId,
            status: PaymentStatus.PAID,
            verifiedAt: new Date(),
          },
        });
      }

      // 3. TripEvent
      await tx.tripEvent.create({
        data: {
          bookingId: id,
          type: 'ADVANCE_PAID',
          payloadJson: {
            amount: advanceAmount,
            paymentMethod,
            paidAt: new Date().toISOString(),
            source: 'customer-app-my-bookings',
          },
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId: payload.userId,
          action: 'CUSTOMER_PAY_ADVANCE',
          entityType: 'Booking',
          entityId: id,
          reason: `Customer paid advance ₹${advanceAmount} from My Bookings after fleet approval.`,
        },
      });
    });

    const res = NextResponse.json({
      success: true,
      message: `Advance payment of ₹${advanceAmount.toLocaleString('en-IN')} received successfully!`,
      advancePaymentStatus: PaymentStatus.PAID,
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/customer/bookings/[id]/pay-advance:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Payment processing failed' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

