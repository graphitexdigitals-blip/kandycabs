import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { PaymentStatus, PaymentType, BookingStatus } from '@kandy-cabs/shared';

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

    // Date range filter for bookings and revenue (strictly in Indian Standard Time UTC+05:30)
    const bookingDateFilter: any = {};
    const paymentDateFilter: any = { status: PaymentStatus.PAID };

    if (startDate || endDate) {
      const dateRange: any = {};
      if (startDate) {
        dateRange.gte = new Date(`${startDate}T00:00:00.000+05:30`);
      }
      if (endDate) {
        dateRange.lte = new Date(`${endDate}T23:59:59.999+05:30`);
      }
      bookingDateFilter.createdAt = dateRange;
      // Payment model doesn't have direct createdAt, but relates to booking
      paymentDateFilter.booking = { createdAt: dateRange };
    }

    // 1. Calculate Revenue & Driver Payout Summary via database aggregates
    const [
      revenueAggregate,
      allBookingsCount,
      customerNoPendingCount,
      customerFullPaymentCount,
      customerAdvReceivedCount,
      customerAdvBalancePendingCount,
      customerPendingCount,
      cancelledBookingsCount,
      refundsCount,
      refundsPendingCount,
      refundsSettledCount,
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
      // 1. Customer Amount Received (No Pending: advance is paid, and balance is paid or zero)
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          advancePaymentStatus: PaymentStatus.PAID,
          OR: [
            { balancePaymentStatus: PaymentStatus.PAID },
            { balanceAmount: { lte: 0 } },
          ],
        },
      }),
      // 2. Customer Full Payment (100% upfront: advance is paid, balanceAmount is 0)
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          advancePaymentStatus: PaymentStatus.PAID,
          balanceAmount: { lte: 0 },
        },
      }),
      // 3. Customer Advance Received (all bookings where advance has been paid)
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          advancePaymentStatus: PaymentStatus.PAID,
        },
      }),
      // 4. Customer Advance Received with Balance Pending
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          advancePaymentStatus: PaymentStatus.PAID,
          balancePaymentStatus: PaymentStatus.PENDING,
          balanceAmount: { gt: 0 },
        },
      }),
      // 5. Customer Pending: Any booking where customer payment is not fully received
      // (includes advance paid but balance pending, as well as advance pending)
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          OR: [
            { balancePaymentStatus: PaymentStatus.PENDING, balanceAmount: { gt: 0 } },
            { advancePaymentStatus: PaymentStatus.PENDING },
          ],
        },
      }),
      // 6. Cancelled Bookings
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          status: BookingStatus.CANCELLED,
        },
      }),
      // 7. All Refund-related bookings (cancelled with advance, or advance refunded, or has refund events)
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          OR: [
            { advancePaymentStatus: PaymentStatus.REFUNDED },
            { tripEvents: { some: { type: 'CANCELLATION_REFUND_PROCESSED' } } },
            {
              status: BookingStatus.CANCELLED,
              OR: [
                { advancePaymentStatus: PaymentStatus.PAID },
                { advanceAmount: { gt: 0 } },
              ],
            },
          ],
        },
      }),
      // 8. Refunds Pending (cancelled with advance paid, but refund transaction not yet recorded)
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          status: BookingStatus.CANCELLED,
          advancePaymentStatus: { not: PaymentStatus.REFUNDED },
          tripEvents: { none: { type: 'CANCELLATION_REFUND_PROCESSED' } },
          OR: [
            { advancePaymentStatus: PaymentStatus.PAID },
            { advanceAmount: { gt: 0 } },
          ],
        },
      }),
      // 9. Refunds Settled (completed refund transaction)
      prisma.booking.count({
        where: {
          ...bookingDateFilter,
          OR: [
            { advancePaymentStatus: PaymentStatus.REFUNDED },
            { tripEvents: { some: { type: 'CANCELLATION_REFUND_PROCESSED' } } },
          ],
        },
      }),
      // Driver Settled
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
      // Driver Pending
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

    // 2. Query bookings with filters using andConditions to prevent OR collisions
    const andConditions: any[] = [];
    if (bookingDateFilter.createdAt) {
      andConditions.push({ createdAt: bookingDateFilter.createdAt });
    }

    if (status === 'CUSTOMER_NO_PENDING' || status === 'PAID') {
      andConditions.push({
        advancePaymentStatus: PaymentStatus.PAID,
        OR: [
          { balancePaymentStatus: PaymentStatus.PAID },
          { balanceAmount: { lte: 0 } },
        ],
      });
    } else if (status === 'CUSTOMER_FULL_PAYMENT') {
      andConditions.push({
        advancePaymentStatus: PaymentStatus.PAID,
        balanceAmount: { lte: 0 },
      });
    } else if (status === 'CUSTOMER_ADV_RECEIVED') {
      andConditions.push({
        advancePaymentStatus: PaymentStatus.PAID,
      });
    } else if (status === 'CUSTOMER_ADV_BALANCE_PENDING' || status === 'PARTIALLY_PAID') {
      andConditions.push({
        advancePaymentStatus: PaymentStatus.PAID,
        balancePaymentStatus: PaymentStatus.PENDING,
        balanceAmount: { gt: 0 },
      });
    } else if (status === 'CUSTOMER_PENDING' || status === 'PAY_LATER' || status === 'PENDING') {
      andConditions.push({
        OR: [
          { balancePaymentStatus: PaymentStatus.PENDING, balanceAmount: { gt: 0 } },
          { advancePaymentStatus: PaymentStatus.PENDING },
        ],
      });
    } else if (status === 'CANCELLED') {
      andConditions.push({
        status: BookingStatus.CANCELLED,
      });
    } else if (status === 'REFUNDS' || status === 'REFUND_ALL') {
      andConditions.push({
        OR: [
          { advancePaymentStatus: PaymentStatus.REFUNDED },
          { tripEvents: { some: { type: 'CANCELLATION_REFUND_PROCESSED' } } },
          {
            status: BookingStatus.CANCELLED,
            OR: [
              { advancePaymentStatus: PaymentStatus.PAID },
              { advanceAmount: { gt: 0 } },
            ],
          },
        ],
      });
    } else if (status === 'REFUND_PENDING') {
      andConditions.push({
        status: BookingStatus.CANCELLED,
        advancePaymentStatus: { not: PaymentStatus.REFUNDED },
        tripEvents: { none: { type: 'CANCELLATION_REFUND_PROCESSED' } },
        OR: [
          { advancePaymentStatus: PaymentStatus.PAID },
          { advanceAmount: { gt: 0 } },
        ],
      });
    } else if (status === 'REFUND_SETTLED' || status === 'REFUND_DONE') {
      andConditions.push({
        OR: [
          { advancePaymentStatus: PaymentStatus.REFUNDED },
          { tripEvents: { some: { type: 'CANCELLATION_REFUND_PROCESSED' } } },
        ],
      });
    } else if (status === 'DRIVER_PAID') {
      andConditions.push({
        driverPaymentStatus: PaymentStatus.PAID,
        assignedDriverId: { not: null },
      });
    } else if (status === 'DRIVER_UNPAID') {
      andConditions.push({
        driverPaymentStatus: PaymentStatus.PENDING,
        assignedDriverId: { not: null },
      });
    }

    if (search) {
      andConditions.push({
        OR: [
          { humanReadableRef: { contains: search, mode: 'insensitive' } },
          { customer: { user: { fullName: { contains: search, mode: 'insensitive' } } } },
          { customer: { user: { phone: { contains: search, mode: 'insensitive' } } } },
          { assignedDriver: { user: { fullName: { contains: search, mode: 'insensitive' } } } },
          { assignedDriver: { user: { phone: { contains: search, mode: 'insensitive' } } } },
          { payments: { some: { razorpayPaymentId: { contains: search, mode: 'insensitive' } } } },
          { payments: { some: { razorpayOrderId: { contains: search, mode: 'insensitive' } } } },
        ],
      });
    }

    const whereClause: any = andConditions.length > 0 ? { AND: andConditions } : {};

    const [totalCount, bookings, driverRulesSetting] = await Promise.all([
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
      prisma.systemSetting.findUnique({
        where: { key: 'driver_pricing_rules' },
      }).catch(() => null),
    ]);

    const driverRulesMap: Record<string, any> = (driverRulesSetting?.value as any) || {};

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

      // Extract vehicle category and trip driver rates from trip events
      let vehicleCategory = 'SWIFT_DZIRE';
      let tripDriverRates: any = null;
      for (const te of b.tripEvents || []) {
        try {
          const p = typeof te.payloadJson === 'string' ? JSON.parse(te.payloadJson) : te.payloadJson;
          if (p?.category) vehicleCategory = p.category;
          if (p?.driverRates) tripDriverRates = p.driverRates;
        } catch {}
      }

      const ruleKey = `${vehicleCategory}_${b.tripType}_DIESEL`;
      const dRule = driverRulesMap[ruleKey] || {};
      const driverRatePerKm = Number(
        tripDriverRates?.driverBaseRatePerKm ??
        dRule.driverBaseRatePerKm ??
        (vehicleCategory === 'HATCHBACK' ? 9 : vehicleCategory === 'SWIFT_DZIRE' || vehicleCategory === 'TOYOTA_ETIOS' || vehicleCategory === 'SEDAN' ? 10 : vehicleCategory === 'SUV_ERTIGA' || vehicleCategory === 'SUV' ? 13 : vehicleCategory === 'SUV_CRYSTA' || vehicleCategory === 'SUV_PREMIUM' ? 17 : 22)
      );

      const distanceKm = Number(b.distanceKm || 0);
      const rawPayee = Number(b.driverPayeeAmount || 0);
      // If rawPayee is 0, auto-calculate distanceKm * driverRatePerKm (the /km rate implemented before)
      const driverKmPayee = rawPayee > 0 ? rawPayee : Math.round(distanceKm * driverRatePerKm);
      const driverAllowance = Number(b.driverAllowance || 0);
      const driverTotalPayout = driverKmPayee + driverAllowance;
      const estimatedFare = Number(b.estimatedFare || 0);
      const kandyCabsProfit = Math.max(0, estimatedFare - driverTotalPayout);

      // Calculate payment milestone dates
      const isAdvancePaid = b.advancePaymentStatus === PaymentStatus.PAID;
      const advancePaidDate = isAdvancePaid
        ? (advancePayment?.verifiedAt?.toISOString() || b.createdAt.toISOString())
        : null;

      const isFullUpfront = Number(b.advanceAmount || 0) >= Number(b.estimatedFare || 0) && isAdvancePaid;
      const isBalancePaid = b.balancePaymentStatus === PaymentStatus.PAID || Number(b.balanceAmount || 0) <= 0;

      let fullPaymentDate: string | null = null;
      let balancePaidDate: string | null = null;

      if (isFullUpfront) {
        fullPaymentDate = advancePaidDate;
      } else if (b.balancePaymentStatus === PaymentStatus.PAID) {
        balancePaidDate = balancePayment?.verifiedAt?.toISOString() || b.createdAt.toISOString();
        fullPaymentDate = balancePaidDate;
      }

      const balanceDueDate = b.scheduledAt ? b.scheduledAt.toISOString() : null;

      return {
        id: b.id,
        humanReadableRef: b.humanReadableRef,
        customerName: b.customer?.user?.fullName || 'Customer',
        customerPhone: b.customer?.user?.phone || '',
        driverName: b.assignedDriver?.user?.fullName,
        driverPhone: b.assignedDriver?.user?.phone,
        tripType: b.tripType,
        category: vehicleCategory,
        distanceKm,
        driverRatePerKm,
        driverKmPayee,
        estimatedFare,
        advanceAmount: Number(b.advanceAmount),
        advancePaymentStatus: b.advancePaymentStatus,
        balanceAmount: Number(b.balanceAmount),
        balancePaymentStatus: b.balancePaymentStatus,
        isPayLater,
        tollAmount: b.tollAmount ? Number(b.tollAmount) : 0,
        parkingAmount: b.parkingAmount ? Number(b.parkingAmount) : 0,
        driverAllowance,
        driverPayeeAmount: driverKmPayee,
        driverTotalPayout,
        kandyCabsProfit,
        driverPaymentStatus: b.driverPaymentStatus || 'PENDING',
        totalCollected:
          (advancePayment?.status === PaymentStatus.PAID ? Number(advancePayment.amount) : 0) +
          (balancePayment?.status === PaymentStatus.PAID ? Number(balancePayment.amount) : 0),
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        scheduledAt: balanceDueDate,
        advancePaidDate,
        fullPaymentDate,
        balancePaidDate,
        balanceDueDate,
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
        allBookingsCount,
        customerNoPendingCount,
        customerFullPaymentCount,
        customerAdvReceivedCount,
        customerAdvBalancePendingCount,
        customerPendingCount,
        cancelledCount: cancelledBookingsCount,
        refundsCount,
        refundsPendingCount,
        refundsSettledCount,
        // Backward-compatibility keys
        paidCount: customerNoPendingCount,
        partiallyPaidCount: customerAdvBalancePendingCount,
        pendingCount: customerPendingCount,
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

