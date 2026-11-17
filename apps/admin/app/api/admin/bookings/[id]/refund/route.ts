import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getAdminSession } from '@/lib/auth';
import { BookingStatus, PaymentStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { RealtimeEvents } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(
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
    const body = await req.json().catch(() => ({}));
    const { action = 'RECORD_REFUND', refundAmount, refundMethod = 'UPI', refundTxnRef = '', notes = '' } = body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { include: { user: true } },
        tripEvents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.status !== BookingStatus.CANCELLED) {
      return NextResponse.json(
        { success: false, message: 'Refunds can only be managed for cancelled bookings' },
        { status: 400 }
      );
    }

    const cancelEvent = booking.tripEvents.find((e) => e.type === 'BOOKING_CANCELLED');
    let cancelPayload: any = {};
    if (cancelEvent?.payloadJson) {
      cancelPayload = typeof cancelEvent.payloadJson === 'string'
        ? JSON.parse(cancelEvent.payloadJson)
        : cancelEvent.payloadJson;
    }

    const advancePaid = Number(cancelPayload.advancePaid ?? booking.advanceAmount ?? 0);
    const currentCharge = Number(cancelPayload.cancellationCharge ?? 0);
    const nowIso = new Date().toISOString();

    if (action === 'WAIVE_CANCELLATION_FEE') {
      // Admin decides to waive the cancellation fee so the entire advance can be refunded
      const newRefundAmount = advancePaid;

      // Update the cancel event payload if possible, or append a CANCELLATION_FEE_WAIVED event
      await prisma.tripEvent.create({
        data: {
          bookingId: id,
          type: 'CANCELLATION_FEE_WAIVED',
          payloadJson: {
            adminUserId: session.userId,
            adminEmail: (session as any).user?.email || (session as any).email || 'admin',
            originalCancellationCharge: currentCharge,
            newCancellationCharge: 0,
            advancePaid,
            newRefundAmount,
            reason: notes || 'Admin waived cancellation fee to allow full refund',
            timestamp: nowIso,
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: 'WAIVE_CANCELLATION_FEE',
          entityType: 'Booking',
          entityId: id,
          reason: `Admin waived cancellation charge of ₹${currentCharge}. Customer is now eligible for full advance refund of ₹${newRefundAmount}. Note: ${notes || 'None'}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Cancellation fee waived! Customer is now eligible for ₹${newRefundAmount} refund.`,
        cancellationCharge: 0,
        refundAmount: newRefundAmount,
      });
    }

    if (action === 'RECORD_REFUND') {
      const parsedAmount = typeof refundAmount === 'number' ? refundAmount : parseFloat(String(refundAmount || 0));
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { success: false, message: 'Valid refund amount is required' },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        // Mark advance payment status as REFUNDED if full advance was refunded
        if (parsedAmount >= advancePaid) {
          await tx.booking.update({
            where: { id },
            data: {
              advancePaymentStatus: PaymentStatus.REFUNDED,
            },
          });
        }

        await tx.tripEvent.create({
          data: {
            bookingId: id,
            type: 'CANCELLATION_REFUND_PROCESSED',
            payloadJson: {
              adminUserId: session.userId,
              adminEmail: (session as any).user?.email || (session as any).email || 'admin',
              refundAmount: parsedAmount,
              refundMethod,
              refundTxnRef: refundTxnRef.trim(),
              notes: notes.trim(),
              advancePaid,
              processedAt: nowIso,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: session.userId,
            action: 'PROCESS_CANCELLATION_REFUND',
            entityType: 'Booking',
            entityId: id,
            reason: `Admin recorded refund of ₹${parsedAmount} via ${refundMethod} (Txn: ${refundTxnRef || 'N/A'}). Note: ${notes || 'None'}`,
          },
        });
      });

      // Realtime notification
      RealtimeEvents.emitToBooking(id, 'REFUND_STATUS' as any, {
        bookingId: id,
        status: 'REFUNDED',
        refundAmount: parsedAmount,
        refundMethod,
        refundTxnRef,
      });

      return NextResponse.json({
        success: true,
        message: `Refund of ₹${parsedAmount} recorded successfully!`,
        refundAmount: parsedAmount,
        refundMethod,
        refundTxnRef,
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/admin/bookings/[id]/refund:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to process refund action' },
      { status: 500 }
    );
  }
}
