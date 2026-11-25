import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { PaymentStatus, PaymentType } from '@kandy-cabs/shared';
import { getAdminSession } from '@/lib/auth';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin privileges required' },
        { status: 401 }
      );
    }

    const { id } = params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: { select: { id: true, fullName: true, phone: true } },
          },
        },
        assignedDriver: {
          include: {
            user: { select: { id: true, fullName: true, phone: true } },
            vehicles: true,
          },
        },
        vehicle: true,
        payments: {
          orderBy: { verifiedAt: 'desc' },
        },
        dispatches: {
          orderBy: { broadcastAt: 'desc' },
          include: {
            driver: {
              include: {
                user: { select: { fullName: true, phone: true } },
                vehicles: true,
              },
            },
          },
        },
        tripEvents: {
          orderBy: { createdAt: 'desc' },
        },
        tripTrackings: {
          orderBy: { recordedAt: 'desc' },
          take: 30,
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
    }

    // Fetch related audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Booking',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        actorUser: {
          select: { id: true, fullName: true, roles: true },
        },
      },
    });

    const payLaterEvent = booking.tripEvents?.find(
      (e: any) => e.type === 'CUSTOMER_PAY_LATER' || e.type === 'CUSTOMER_PAY_LATER_REVERTED'
    );
    const isPayLater = payLaterEvent ? payLaterEvent.type === 'CUSTOMER_PAY_LATER' : false;

    const formattedBooking = {
      ...booking,
      isPayLater,
      customerPaysLater: isPayLater,
      startingOdometerImagePath: resolveImageUrl(booking.startingOdometerImagePath) || null,
      finalOdometerImagePath: resolveImageUrl(booking.finalOdometerImagePath) || null,
      vehicleInspectionPhotos: Array.isArray(booking.vehicleInspectionPhotos)
        ? booking.vehicleInspectionPhotos.map((p) => resolveImageUrl(p)).filter(Boolean)
        : [],
    };

    return NextResponse.json(
      {
        success: true,
        booking: formattedBooking,
        auditLogs,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in GET /api/admin/bookings/[id]:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch booking details' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin privileges required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const {
      driverAllowance,
      driverPayeeAmount,
      driverPaymentStatus,
      advancePaymentStatus,
      advanceAmount,
    } = body;

    const currentBooking = await prisma.booking.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!currentBooking) {
      return NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
    }

    const dataToUpdate: any = {};
    if (driverAllowance !== undefined) {
      dataToUpdate.driverAllowance = parseFloat(String(driverAllowance)) || 0;
    }
    if (driverPayeeAmount !== undefined) {
      dataToUpdate.driverPayeeAmount = parseFloat(String(driverPayeeAmount)) || 0;
    }
    if (driverPaymentStatus !== undefined) {
      dataToUpdate.driverPaymentStatus = driverPaymentStatus;
    }

    let isAdvanceStatusChanged = false;
    if (advancePaymentStatus !== undefined && advancePaymentStatus !== currentBooking.advancePaymentStatus) {
      isAdvanceStatusChanged = true;
      dataToUpdate.advancePaymentStatus = advancePaymentStatus as PaymentStatus;

      const advAmt = advanceAmount !== undefined ? parseFloat(String(advanceAmount)) : Number(currentBooking.advanceAmount || 0);
      if (advanceAmount !== undefined) {
        dataToUpdate.advanceAmount = advAmt;
      }

      if (advancePaymentStatus === PaymentStatus.PAID) {
        dataToUpdate.balanceAmount = Math.max(0, Number(currentBooking.estimatedFare || 0) - advAmt);
      } else {
        dataToUpdate.balanceAmount = Number(currentBooking.estimatedFare || 0);
      }
    } else if (advanceAmount !== undefined) {
      dataToUpdate.advanceAmount = parseFloat(String(advanceAmount)) || 0;
    }

    const updatedBooking = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id },
        data: dataToUpdate,
        include: {
          customer: {
            include: {
              user: { select: { id: true, fullName: true, phone: true } },
            },
          },
          assignedDriver: {
            include: {
              user: { select: { id: true, fullName: true, phone: true } },
            },
          },
          payments: true,
        },
      });

      if (isAdvanceStatusChanged) {
        const advAmt = Number(b.advanceAmount || 0);
        const existingAdvPayment = currentBooking.payments.find((p) => p.type === PaymentType.ADVANCE);

        if (advancePaymentStatus === PaymentStatus.PAID) {
          if (existingAdvPayment) {
            await tx.payment.update({
              where: { id: existingAdvPayment.id },
              data: {
                status: PaymentStatus.PAID,
                verifiedAt: new Date(),
                razorpayPaymentId: existingAdvPayment.razorpayPaymentId || `admin_adv_paid_${Date.now()}`,
              },
            });
          } else {
            await tx.payment.create({
              data: {
                bookingId: id,
                type: PaymentType.ADVANCE,
                amount: advAmt,
                razorpayOrderId: `admin_order_${Date.now()}`,
                razorpayPaymentId: `admin_adv_paid_${Date.now()}`,
                status: PaymentStatus.PAID,
                verifiedAt: new Date(),
              },
            });
          }

          // Record TripEvent
          await tx.tripEvent.create({
            data: {
              bookingId: id,
              type: 'ADVANCE_PAID',
              payloadJson: {
                amount: advAmt,
                collectedBy: 'ADMIN',
                adminId: session.userId,
                adminPhone: session.phone,
                paidAt: new Date().toISOString(),
                source: 'admin-panel',
                note: 'Marked as Paid by Admin in Operations Panel',
              },
            },
          });
        } else if (advancePaymentStatus === PaymentStatus.PENDING) {
          if (existingAdvPayment) {
            await tx.payment.update({
              where: { id: existingAdvPayment.id },
              data: {
                status: PaymentStatus.PENDING,
                verifiedAt: null,
              },
            });
          }
          await tx.tripEvent.create({
            data: {
              bookingId: id,
              type: 'ADVANCE_PAYMENT_PENDING',
              payloadJson: {
                amount: advAmt,
                updatedBy: 'ADMIN',
                adminId: session.userId,
                updatedAt: new Date().toISOString(),
                source: 'admin-panel',
              },
            },
          });
        }
      }

      // Check if actor user exists to satisfy foreign key constraint safely
      const actorUser = session.userId
        ? await tx.user.findUnique({ where: { id: session.userId }, select: { id: true } })
        : null;

      // Record AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: actorUser?.id || null,
          action: isAdvanceStatusChanged ? 'ADMIN_UPDATE_ADVANCE_PAYMENT' : 'ADMIN_UPDATE_DRIVER_PAYMENT',
          entityType: 'Booking',
          entityId: id,
          reason: isAdvanceStatusChanged
            ? `Admin changed advance payment status to ${advancePaymentStatus} (₹${b.advanceAmount})`
            : `Admin updated driver payment: Allowance=₹${driverAllowance ?? 'unchanged'}, Payee=₹${driverPayeeAmount ?? 'unchanged'}, Status=${driverPaymentStatus ?? 'unchanged'}`,
        },
      });

      return b;
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Booking details updated successfully',
        booking: updatedBooking,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/bookings/[id]:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update driver payment details' },
      { status: 500 }
    );
  }
}
