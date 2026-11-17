import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { PaymentStatus, PaymentType } from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') || 'ALL';
    const startDate = searchParams.get('startDate')?.trim();
    const endDate = searchParams.get('endDate')?.trim();

    const skip = (page - 1) * limit;

    // Date range filter for bookings and revenue
    const bookingDateFilter: any = {};
    const paymentDateFilter: any = { status: PaymentStatus.PAID };

    if (startDate || endDate) {
      const dateRange: any = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateRange.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateRange.lte = end;
      }
      bookingDateFilter.createdAt = dateRange;
      paymentDateFilter.createdAt = dateRange;
    }

    // 1. Calculate Revenue & Driver Payout Summary via database aggregates
    const [
      revenueAggregate,
      allBookingsCount,
      paidBookingsCount,
      partialBookingsCount,
      pendingBookingsCount,
      driverPaidAggregate,
      driverPaidCount,
      driverPendingAggregate,
      driverPendingCount,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: paymentDateFilter,
        _sum: { amount: true },
      }),
      prisma.booking.count({
        where: bookingDateFilter,
      }),
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          advancePaymentStatus: PaymentStatus.PAID,
          balancePaymentStatus: PaymentStatus.PAID,
        },
      }),
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          advancePaymentStatus: PaymentStatus.PAID,
          balancePaymentStatus: PaymentStatus.PENDING,
        },
      }),
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          advancePaymentStatus: PaymentStatus.PENDING,
        },
      }),
      prisma.booking.aggregate({
        where: {
          ...bookingDateFilter,
          driverPaymentStatus: PaymentStatus.PAID,
          assignedDriverId: { not: null },
        },
        _sum: {
          driverAllowance: true,
          driverPayeeAmount: true,
        },
      }),
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          driverPaymentStatus: PaymentStatus.PAID,
          assignedDriverId: { not: null },
        },
      }),
      prisma.booking.aggregate({
        where: {
          ...bookingDateFilter,
          driverPaymentStatus: PaymentStatus.PENDING,
          assignedDriverId: { not: null },
        },
        _sum: {
          driverAllowance: true,
          driverPayeeAmount: true,
        },
      }),
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          driverPaymentStatus: PaymentStatus.PENDING,
          assignedDriverId: { not: null },
        },
      }),
    ]);

    const totalRevenue = Number(revenueAggregate._sum?.amount || 0);
    const totalDriverPaidAmount =
      Number(driverPaidAggregate._sum?.driverAllowance || 0) +
      Number(driverPaidAggregate._sum?.driverPayeeAmount || 0);
    const totalDriverPendingAmount =
      Number(driverPendingAggregate._sum?.driverAllowance || 0) +
      Number(driverPendingAggregate._sum?.driverPayeeAmount || 0);

    // 2. Query bookings with payments
    const whereClause: any = { ...bookingDateFilter };

    if (status === 'PAID') {
      whereClause.advancePaymentStatus = PaymentStatus.PAID;
      whereClause.balancePaymentStatus = PaymentStatus.PAID;
    } else if (status === 'PARTIALLY_PAID' || status === 'CUSTOMER_PENDING' || status === 'PAY_LATER') {
      whereClause.balancePaymentStatus = PaymentStatus.PENDING;
    } else if (status === 'PENDING') {
      whereClause.advancePaymentStatus = PaymentStatus.PENDING;
    } else if (status === 'DRIVER_PAID') {
      whereClause.driverPaymentStatus = PaymentStatus.PAID;
      whereClause.assignedDriverId = { not: null };
    } else if (status === 'DRIVER_UNPAID') {
      whereClause.driverPaymentStatus = PaymentStatus.PENDING;
      whereClause.assignedDriverId = { not: null };
    }

    if (search) {
      whereClause.OR = [
        { humanReadableRef: { contains: search, mode: 'insensitive' } },
        { customer: { user: { fullName: { contains: search, mode: 'insensitive' } } } },
        { customer: { user: { phone: { contains: search, mode: 'insensitive' } } } },
        { assignedDriver: { user: { fullName: { contains: search, mode: 'insensitive' } } } },
        { assignedDriver: { user: { phone: { contains: search, mode: 'insensitive' } } } },
        { payments: { some: { razorpayPaymentId: { contains: search, mode: 'insensitive' } } } },
        { payments: { some: { razorpayOrderId: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [totalCount, bookings] = await Promise.all([
      prisma.booking.count({ where: whereClause }),
      prisma.booking.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            include: {
              user: {
                select: { fullName: true, phone: true },
              },
            },
          },
          assignedDriver: {
            include: {
              user: {
                select: { fullName: true, phone: true },
              },
            },
          },
          payments: {
            orderBy: { verifiedAt: 'desc' },
          },
          tripEvents: {
            select: { id: true, type: true, payloadJson: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
      }),
    ]);

    const formattedBookings = bookings.map((b) => {
      const advancePayment = b.payments.find((p) => p.type === PaymentType.ADVANCE);
      const balancePayment = b.payments.find((p) => p.type === PaymentType.BALANCE);
      const isPayLater =
        b.tripEvents?.some((e) => e.type === 'CUSTOMER_PAY_LATER') ||
        Boolean((b as any).customerPaysLater) ||
        false;

      // Extract cancellation and refund records
      const cancelEvent = b.tripEvents?.find((e) => e.type === 'BOOKING_CANCELLED');
      const refundEvent = b.tripEvents?.find((e) => e.type === 'CANCELLATION_REFUND_PROCESSED');
      const feeWaivedEvent = b.tripEvents?.find((e) => e.type === 'CANCELLATION_FEE_WAIVED');

      let cancellationData: any = null;
      if (b.status === 'CANCELLED' || cancelEvent) {
        let cPayload: any = {};
        if (cancelEvent?.payloadJson) {
          cPayload = typeof cancelEvent.payloadJson === 'string'
            ? JSON.parse(cancelEvent.payloadJson)
            : cancelEvent.payloadJson;
        }

        let rPayload: any = null;
        if (refundEvent?.payloadJson) {
          rPayload = typeof refundEvent.payloadJson === 'string'
            ? JSON.parse(refundEvent.payloadJson)
            : refundEvent.payloadJson;
        }

        const advancePaid = Number(advancePayment && advancePayment.status === PaymentStatus.PAID ? advancePayment.amount : (cPayload.advancePaid ?? b.advanceAmount ?? 0));
        const originalCharge = Number(cPayload.cancellationCharge ?? 0);
        const isFeeWaived = Boolean(cPayload.waiveCharge || feeWaivedEvent);
        const cancellationCharge = isFeeWaived ? 0 : originalCharge;
        const refundDue = Math.max(0, isFeeWaived ? advancePaid : (cPayload.refundAmount != null ? Number(cPayload.refundAmount) : advancePaid - cancellationCharge));
        const isRefundDone = Boolean(rPayload || b.advancePaymentStatus === PaymentStatus.REFUNDED);

        cancellationData = {
          cancelledAt: cancelEvent?.createdAt?.toISOString() || b.createdAt.toISOString(),
          reason: cPayload.reason || 'Cancelled',
          cancelledBy: cPayload.cancelledBy || 'CUSTOMER',
          advancePaid,
          originalCharge,
          cancellationCharge,
          isFeeWaived,
          isWithinWindow: Boolean(cPayload.isWithinWindow),
          hoursUntilPickup: cPayload.hoursUntilPickup ?? null,
          refundDue,
          isRefundDone,
          refundDetails: rPayload ? {
            amount: Number(rPayload.refundAmount || refundDue),
            method: rPayload.refundMethod || 'UPI',
            txnRef: rPayload.refundTxnRef || '',
            notes: rPayload.notes || '',
            processedAt: rPayload.processedAt || refundEvent?.createdAt?.toISOString(),
          } : null,
        };
      }

      return {
        id: b.id,
        humanReadableRef: b.humanReadableRef,
        customerName: b.customer?.user?.fullName || 'Customer',
        customerPhone: b.customer?.user?.phone || '',
        driverName: b.assignedDriver?.user?.fullName,
        driverPhone: b.assignedDriver?.user?.phone,
        tripType: b.tripType,
        estimatedFare: Number(b.estimatedFare),
        advanceAmount: Number(b.advanceAmount),
        advancePaymentStatus: b.advancePaymentStatus,
        balanceAmount: Number(b.balanceAmount),
        balancePaymentStatus: b.balancePaymentStatus,
        isPayLater,
        tollAmount: b.tollAmount ? Number(b.tollAmount) : 0,
        parkingAmount: b.parkingAmount ? Number(b.parkingAmount) : 0,
        driverAllowance: b.driverAllowance ? Number(b.driverAllowance) : 0,
        driverPayeeAmount: b.driverPayeeAmount ? Number(b.driverPayeeAmount) : 0,
        driverPaymentStatus: b.driverPaymentStatus || 'PENDING',
        totalCollected:
          (advancePayment?.status === PaymentStatus.PAID ? Number(advancePayment.amount) : 0) +
          (balancePayment?.status === PaymentStatus.PAID ? Number(balancePayment.amount) : 0),
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        advancePayment: advancePayment
          ? {
              id: advancePayment.id,
              amount: Number(advancePayment.amount),
              status: advancePayment.status,
              razorpayOrderId: advancePayment.razorpayOrderId,
              razorpayPaymentId: advancePayment.razorpayPaymentId,
              paymentMethod: advancePayment.paymentMethod || 'RAZORPAY',
              verifiedAt: advancePayment.verifiedAt?.toISOString(),
            }
          : null,
        balancePayment: balancePayment
          ? {
              id: balancePayment.id,
              amount: Number(balancePayment.amount),
              status: balancePayment.status,
              paymentMethod: balancePayment.paymentMethod || 'CASH',
              verifiedAt: balancePayment.verifiedAt?.toISOString(),
            }
          : null,
        cancellationData,
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalRevenue,
        totalBookings: allBookingsCount,
        paidCount: paidBookingsCount,
        partiallyPaidCount: partialBookingsCount,
        pendingCount: pendingBookingsCount,
        driverPaidCount,
        totalDriverPaidAmount,
        driverPendingCount,
        totalDriverPendingAmount,
      },
      transactions: formattedBookings,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin payments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payments data' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, paymentMethod = 'UPI_QR', transactionRef, amount, notes } = body;

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Toggle or set Pay Later status
    if (body.action === 'SET_PAY_LATER' || body.customerPaysLater !== undefined) {
      const shouldPayLater = body.customerPaysLater ?? true;
      if (shouldPayLater) {
        await prisma.tripEvent.create({
          data: {
            bookingId: booking.id,
            type: 'CUSTOMER_PAY_LATER',
            payloadJson: {
              markedBy: 'ADMIN',
              reason: notes || 'Admin marked customer to pay balance later',
              customerPaysLater: true,
              timestamp: new Date(),
            },
          },
        });
      } else {
        // Remove or record reverted event
        await prisma.tripEvent.create({
          data: {
            bookingId: booking.id,
            type: 'CUSTOMER_PAY_LATER_REVERTED',
            payloadJson: {
              markedBy: 'ADMIN',
              reason: notes || 'Admin reverted Pay Later status',
              customerPaysLater: false,
              timestamp: new Date(),
            },
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: shouldPayLater
          ? 'Customer marked to pay later. Driver app will reflect ₹0 collection.'
          : 'Customer pay later status removed.',
        isPayLater: shouldPayLater,
      });
    }

    const payAmount = amount ? Number(amount) : Number(booking.balanceAmount);

    // Upsert or create BALANCE Payment record
    const existingBalancePayment = booking.payments.find((p) => p.type === PaymentType.BALANCE);

    let paymentRecord;
    if (existingBalancePayment) {
      paymentRecord = await prisma.payment.update({
        where: { id: existingBalancePayment.id },
        data: {
          amount: payAmount,
          paymentMethod,
          razorpayPaymentId: transactionRef || existingBalancePayment.razorpayPaymentId || `manual_${Date.now()}`,
          status: PaymentStatus.PAID,
          verifiedAt: new Date(),
        },
      });
    } else {
      paymentRecord = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          type: PaymentType.BALANCE,
          amount: payAmount,
          paymentMethod,
          razorpayPaymentId: transactionRef || `manual_${Date.now()}`,
          status: PaymentStatus.PAID,
          verifiedAt: new Date(),
        },
      });
    }

    // Update booking balance payment status
    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        balancePaymentStatus: PaymentStatus.PAID,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'BALANCE_PAYMENT_RECORDED',
        entityType: 'Booking',
        entityId: booking.id,
        reason: `Admin recorded balance payment of ₹${payAmount} via ${paymentMethod} (${transactionRef || 'No ref'}) ${notes ? `Note: ${notes}` : ''}`,
      },
    });

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      payment: paymentRecord,
    });
  } catch (error: any) {
    console.error('Error recording balance payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record balance payment' },
      { status: 500 }
    );
  }
}

