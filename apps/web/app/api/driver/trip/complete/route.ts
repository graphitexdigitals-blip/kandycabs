import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { BookingStatus, PaymentStatus, PaymentType } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { RealtimeEvents } from '@/lib/realtime-events';
import { uploadTripPhoto } from '@/lib/supabase-storage';

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
    const {
      bookingId,
      finalOdometer,
      finalOdometerImagePath,
      tollAmount = 0,
      nhTollAmount = 0,
      expresswayTollAmount = 0,
      niceRoadTollAmount = 0,
      specialPermitAmount = 0,
      statePermitAmount = 0,
      airportFeeAmount = 0,
      parkingAmount = 0,
      paymentMethod = 'CASH', // CASH or UPI_QR
      actualDropLat,
      actualDropLng,
      actualDropAddress,
    } = body;

    if (!bookingId || finalOdometer === undefined || !finalOdometerImagePath) {
      const res = NextResponse.json(
        { success: false, message: 'Final odometer reading and photo evidence are mandatory to complete trip' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        assignedDriverId: session.driverId,
      },
      include: {
        tripEvents: {
          select: { id: true, type: true, payloadJson: true },
        },
      },
    });

    if (!booking) {
      const res = NextResponse.json(
        { success: false, message: 'Booking not found or not assigned to you' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    const startOdo = Number(booking.startingOdometer || 0);
    const endOdo = parseFloat(String(finalOdometer));
    const now = new Date();

    const resolvedDropLat = typeof actualDropLat === 'number' ? actualDropLat : null;
    const resolvedDropLng = typeof actualDropLng === 'number' ? actualDropLng : null;
    const resolvedDropAddress = actualDropAddress ? String(actualDropAddress).trim() : null;

    // Upload final odometer photo to Supabase Storage (offloads Base64 from PostgreSQL)
    let storedFinalOdometerPath: string | null = null;
    if (finalOdometerImagePath) {
      storedFinalOdometerPath = await uploadTripPhoto({
        bookingId,
        category: 'complete',
        imageBase64OrUri: finalOdometerImagePath,
        customName: 'final_odometer',
      });
    }

    // Calculate actual distance from start/end odometer readings
    const actualDistanceKm = Math.max(0, Math.round((endOdo - startOdo) * 10) / 10);
    const bookedDistanceKm = Number(booking.distanceKm || 0);
    const baseBookedFare = Number(booking.estimatedFare || 0);

    // Determine extra KM rate:
    // Proportional unit rate (e.g. ₹2,565 / 171 km = ₹15/km) or fallback to 15
    const unitRate = bookedDistanceKm > 0 ? (baseBookedFare / bookedDistanceKm) : 15;
    const extraKmRate = Math.round(unitRate) || 15;

    let extraKm = 0;
    let extraKmCharge = 0;
    let finalTripFare = baseBookedFare;

    // Minimum guaranteed distance rule:
    // If actualDistanceKm <= bookedDistanceKm, keep full booked base fare (do not decrease).
    // If actualDistanceKm > bookedDistanceKm, calculate extra km charge.
    if (bookedDistanceKm > 0 && actualDistanceKm > bookedDistanceKm) {
      extraKm = Math.round((actualDistanceKm - bookedDistanceKm) * 10) / 10;
      extraKmCharge = Math.round(extraKm * extraKmRate);
      finalTripFare = baseBookedFare + extraKmCharge;
    }

    const isAdvancePaid = booking.advancePaymentStatus === PaymentStatus.PAID;
    const advancePaid = isAdvancePaid ? Number(booking.advanceAmount || 0) : 0;
    const baseBalance = Math.max(0, Math.round(finalTripFare - advancePaid));

    const parsedNhToll = Math.max(0, parseFloat(String(nhTollAmount)) || 0);
    const parsedExpresswayToll = Math.max(0, parseFloat(String(expresswayTollAmount || niceRoadTollAmount)) || 0);
    const parsedSpecialPermit = Math.max(0, parseFloat(String(specialPermitAmount)) || 0);
    const parsedStatePermit = Math.max(0, parseFloat(String(statePermitAmount)) || 0);
    const parsedAirportFee = Math.max(0, parseFloat(String(airportFeeAmount)) || 0);
    const parsedParking = Math.max(0, parseFloat(String(parkingAmount)) || 0);

    const calculatedToll =
      parsedNhToll +
      parsedExpresswayToll +
      parsedSpecialPermit +
      parsedStatePermit +
      parsedAirportFee;
    const parsedToll = calculatedToll > 0 ? calculatedToll : Math.max(0, parseFloat(String(tollAmount)) || 0);
    const totalExtraCharges = parsedToll + parsedParking;

    const isPayLater =
      paymentMethod === 'PAY_LATER' ||
      booking.tripEvents?.some((e: any) => e.type === 'CUSTOMER_PAY_LATER') ||
      false;

    const totalBalanceCollected = baseBalance + totalExtraCharges;

    // Proportional driver payout update for extra km
    const originalDriverPayee = Number(booking.driverPayeeAmount || Math.round(baseBookedFare * 0.77));
    const driverExtraShare = Math.round(extraKmCharge * 0.77);
    const updatedDriverPayee = originalDriverPayee + driverExtraShare;

    // Atomic Transaction: complete trip, record odometer reconciliation, tolls/parking, actual drop location and balance Payment
    const updated = await prisma.$transaction(
      async (tx) => {
        // 1. Update Booking
        const completedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.TRIP_COMPLETED,
            finalOdometer: endOdo,
            finalOdometerImagePath: storedFinalOdometerPath || null,
            actualDistanceKm,
            estimatedFare: finalTripFare,
            balanceAmount: baseBalance,
            driverPayeeAmount: updatedDriverPayee,
            tollAmount: parsedToll,
            parkingAmount: parsedParking,
            balancePaymentStatus: isPayLater ? PaymentStatus.PENDING : PaymentStatus.PAID,
            actualDropAddress: resolvedDropAddress || booking.dropAddress,
            actualDropLat: resolvedDropLat ?? booking.dropLat,
            actualDropLng: resolvedDropLng ?? booking.dropLng,
            actualCompletedAt: now,
          },
        });

        // 2. Insert Final Balance Payment row only if collected by driver
        if (isPayLater) {
          await tx.tripEvent.create({
            data: {
              bookingId,
              type: 'CUSTOMER_PAY_LATER',
              payloadJson: {
                driverId: session.driverId,
                driverCollectedAmount: 0,
                pendingBalanceDue: totalBalanceCollected,
                baseBalance,
                tollAmount: parsedToll,
                nhTollAmount: parsedNhToll,
                expresswayTollAmount: parsedExpresswayToll,
                specialPermitAmount: parsedSpecialPermit,
                statePermitAmount: parsedStatePermit,
                airportFeeAmount: parsedAirportFee,
                parkingAmount: parsedParking,
                totalExtraCharges,
                reason: 'Customer will pay balance later to Admin/Office. Driver collected ₹0.',
                timestamp: now.toISOString(),
              },
            },
          });
        } else {
          await tx.payment.create({
            data: {
              bookingId,
              type: PaymentType.BALANCE,
              amount: totalBalanceCollected,
              paymentMethod,
              razorpayPaymentId: `${paymentMethod.toLowerCase()}_pay_${Date.now()}`,
              status: PaymentStatus.PAID,
              verifiedAt: now,
            },
          });
        }

        // 3. Insert TripEvent
        await tx.tripEvent.create({
          data: {
            bookingId,
            type: 'TRIP_COMPLETED',
            payloadJson: {
              driverId: session.driverId,
              startOdometer: startOdo,
              finalOdometer: endOdo,
              actualDistanceKm,
              bookedDistanceKm,
              extraKm,
              extraKmRate,
              extraKmCharge,
              baseBookedFare,
              finalTripFare,
              advancePaid,
              baseBalance,
              nhTollAmount: parsedNhToll,
              expresswayTollAmount: parsedExpresswayToll,
              niceRoadTollAmount: parsedExpresswayToll,
              specialPermitAmount: parsedSpecialPermit,
              statePermitAmount: parsedStatePermit,
              airportFeeAmount: parsedAirportFee,
              tollAmount: parsedToll,
              parkingAmount: parsedParking,
              totalExtraCharges,
              driverPayeeAmount: updatedDriverPayee,
              totalBalanceCollected,
              paymentMethod,
              hasFinalImage: !!storedFinalOdometerPath,
              actualDropAddress: resolvedDropAddress || booking.dropAddress,
              actualDropLat: resolvedDropLat ?? booking.dropLat,
              actualDropLng: resolvedDropLng ?? booking.dropLng,
              waitingMinutes: Number(body.waitingMinutes) || 0,
              waitingDurationSeconds: Number(body.waitingDurationSeconds) || 0,
              waitingSessions: Array.isArray(body.waitingSessions) ? body.waitingSessions : [],
              timestamp: now.toISOString(),
            },
          },
        });

        // 3b. Insert or update WAITING_RECORDED event if wait time was recorded
        const waitMins = Number(body.waitingMinutes) || 0;
        const waitSecs = Number(body.waitingDurationSeconds) || 0;
        const waitSessions = Array.isArray(body.waitingSessions) ? body.waitingSessions : [];
        if (waitMins > 0 || waitSecs > 0 || waitSessions.length > 0) {
          const existingWait = await tx.tripEvent.findFirst({
            where: { bookingId, type: 'WAITING_RECORDED' },
            orderBy: { createdAt: 'desc' },
          });
          const waitPayload = {
            driverId: session.driverId,
            waitingMinutes: waitMins,
            durationSeconds: waitSecs,
            totalAccumulatedSeconds: waitSecs,
            waitingSessions: waitSessions,
            isWaitingActive: false,
            isWaitingPaused: false,
            updatedAt: now.toISOString(),
          };
          if (existingWait) {
            await tx.tripEvent.update({
              where: { id: existingWait.id },
              data: { payloadJson: waitPayload },
            });
          } else {
            await tx.tripEvent.create({
              data: {
                bookingId,
                type: 'WAITING_RECORDED',
                payloadJson: waitPayload,
              },
            });
          }
        }

        // 4. Insert AuditLog
        await tx.auditLog.create({
          data: {
            actorUserId: session.userId,
            action: 'DRIVER_COMPLETE_TRIP',
            entityType: 'Booking',
            entityId: bookingId,
            reason: `Trip completed by driver at [${resolvedDropAddress || 'driver final reached GPS location'}]. Odometer: ${startOdo} -> ${endOdo} (${actualDistanceKm} km). Balance collected: ₹${totalBalanceCollected} via ${paymentMethod}`,
          },
        });

        return completedBooking;
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );

    // Fetch complete enriched booking (with driver and vehicle details) for real-time customer event
    const fullBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        assignedDriver: {
          include: {
            user: { select: { fullName: true, phone: true } },
            vehicles: true,
          },
        },
        vehicle: true,
      },
    });

    const completionPayload = {
      ...(fullBooking || updated),
      id: bookingId,
      bookingId,
      status: BookingStatus.TRIP_COMPLETED,
      actualDistanceKm,
      totalBalanceCollected,
      actualDropAddress: updated.actualDropAddress,
      actualDropLat: updated.actualDropLat,
      actualDropLng: updated.actualDropLng,
      actualCompletedAt: updated.actualCompletedAt,
    };

    // Realtime SSE: Notify customer and driver
    RealtimeEvents.emitToBooking(bookingId, 'BOOKING_STATUS', completionPayload);
    RealtimeEvents.emitToBooking(bookingId, 'TRIP_COMPLETED', completionPayload);

    RealtimeEvents.emitToDriver(session.driverId, 'TRIP_STATUS', {
      bookingId,
      status: BookingStatus.TRIP_COMPLETED,
    });

    const res = NextResponse.json(
      {
        success: true,
        message: 'Trip completed and balance settlement recorded!',
        actualDistanceKm,
        totalBalanceCollected,
        booking: updated,
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/trip/complete:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to complete trip' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
