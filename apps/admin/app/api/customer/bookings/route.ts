import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  verifyAuthToken,
  calculateFare,
  generateOtp,
  VehicleCategory,
  TripType,
  PaymentType,
  PaymentStatus,
  BookingStatus,
} from '@kandy-cabs/shared';
import { calculateRouteDistance } from '@/lib/distance';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { recordCouponUsage } from '@/lib/couponStore';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

function generateBookingReference(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `KC-${year}-${random}`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user from cookie or Bearer header
    let token = req.cookies.get('kandy_session')?.value;
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required to create booking' },
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

    // Ensure customer record exists
    let customer = await prisma.customer.findUnique({
      where: { userId: payload.userId },
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { userId: payload.userId },
      });
    }

    const body = await req.json();
    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropAddress,
      dropLat,
      dropLng,
      category = VehicleCategory.SEDAN,
      fuelType,
      tripType = TripType.ONEWAY,
      scheduledAt = new Date().toISOString(),
      durationDays = 1,
      packageHours = 8,
      couponCode,
      razorpayOrderId,
      razorpayPaymentId,
      idempotencyKey,
      passengerName,
      passengerPhone,
      passengerEmail,
      alternateEmail,
      companyName,
      gstin,
      paymentMode,
      notes,
    } = body;

    // Update user profile full name and customer email if provided
    if (passengerName) {
      try {
        await prisma.user.update({
          where: { id: payload.userId },
          data: {
            fullName: String(passengerName).trim(),
          },
        });
      } catch (e) {}
    }
    if (passengerEmail) {
      try {
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            email: String(passengerEmail).trim(),
          },
        });
      } catch (e) {}
    }

    if (!pickupAddress || !dropAddress || typeof pickupLat !== 'number' || typeof dropLat !== 'number') {
      const res = NextResponse.json(
        { success: false, message: 'Pickup and drop location details are required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Must have advance payment / order id or idempotency key
    const headerIdemp = req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key');
    const orderRef = razorpayOrderId || idempotencyKey || headerIdemp || `order_app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Idempotency check: if payment with this razorpayOrderId already exists, return existing booking
    const existingPayment = await prisma.payment.findFirst({
      where: { razorpayOrderId: orderRef },
      include: { booking: true },
    });

    if (existingPayment && existingPayment.booking) {
      const res = NextResponse.json(
        {
          success: true,
          isDuplicate: true,
          booking: existingPayment.booking,
          message: 'Booking already confirmed',
        },
        { status: 200 }
      );
      return setCorsHeaders(res);
    }

    // 2. Authoritative server distance calculation
    const route = await calculateRouteDistance(pickupLat, pickupLng, dropLat, dropLng);
    const distanceKm = route.distanceKm;

    // 3. Authoritative server fare calculation (with pet friendly convenience fee if requested)
    const rawFlightNumber = body.flightNumber || 
      (typeof notes === 'string' ? notes.match(/flight(?:\s*number|\s*no)?\s*[:#-]?\s*([A-Z0-9\s-]+)/i)?.[1] : undefined) ||
      (typeof body.specialRequirements === 'string' ? body.specialRequirements.match(/flight(?:\s*number|\s*no)?\s*[:#-]?\s*([A-Z0-9\s-]+)/i)?.[1] : undefined);
    const flightNumber = rawFlightNumber ? String(rawFlightNumber).trim().toUpperCase() : undefined;

    const hasPet = Boolean(
      body.hasPet ||
      body.isPetFriendly ||
      (typeof notes === 'string' && /pet\s*friendly/i.test(notes)) ||
      (typeof body.specialRequirements === 'string' && /pet\s*friendly/i.test(body.specialRequirements))
    );
    const petType = body.petType ? String(body.petType).toLowerCase() : 'dog';
    const petFee = hasPet ? (Number(body.petFee) || 500) : 0;

    const pricing = calculateFare({
      category,
      fuelType,
      tripType,
      distanceKm,
      scheduledAt,
      durationDays,
      packageHours,
      couponCode,
      hasPet,
      petFee,
    });

    const isPayOnDrop = paymentMode === 'PAY_ON_DROP' || paymentMode === 'CASH';
    const isPayOnApproval = Boolean(paymentMode === 'PAY_ON_APPROVAL' || body.isFleetApprovalRequired || category === VehicleCategory.TEMPO_TRAVELER || category === 'TEMPO_TRAVELER' || category === 'URBANIA');
    const isFullPayment = paymentMode === 'FULL';
    const advanceAmount = isPayOnDrop ? 0 : isFullPayment ? pricing.totalFare : pricing.advanceAmount;
    const advancePaymentStatus = (isPayOnDrop || isPayOnApproval) ? PaymentStatus.PENDING : PaymentStatus.PAID;
    const balanceAmount = isPayOnDrop ? pricing.totalFare : isFullPayment ? 0 : pricing.balanceAmount;

    const humanReadableRef = generateBookingReference();
    const pickupOtp = generateOtp(4);

    // 4. Atomic Database Transaction
    const newBooking = await prisma.$transaction(async (tx) => {
      // 1. Create Booking
      const booking = await tx.booking.create({
        data: {
          humanReadableRef,
          customerId: customer.id,
          tripType,
          pickupAddress,
          pickupLat,
          pickupLng,
          dropAddress,
          dropLat,
          dropLng,
          scheduledAt: new Date(scheduledAt),
          distanceKm: pricing.billableDistanceKm,
          estimatedFare: pricing.totalFare,
          advanceAmount: advanceAmount,
          advancePaymentStatus: advancePaymentStatus,
          balanceAmount: balanceAmount,
          balancePaymentStatus: PaymentStatus.PENDING,
          status: BookingStatus.PENDING_ADMIN,
          pickupOtp,
          customerLocationSharingEnabled: true,
          driverAllowance: pricing.driverAllowance || 350.0,
          driverPayeeAmount: 0.0,
          driverPaymentStatus: PaymentStatus.PENDING,
        },
      });

      // 2. Create Advance Payment
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          type: PaymentType.ADVANCE,
          amount: advanceAmount,
          razorpayOrderId: orderRef,
          razorpayPaymentId: razorpayPaymentId || (isPayOnDrop ? `pay_cash_${Date.now()}` : isPayOnApproval ? `pay_pending_approval_${Date.now()}` : `pay_mock_${Date.now()}`),
          status: advancePaymentStatus,
          verifiedAt: (isPayOnDrop || isPayOnApproval) ? null : new Date(),
        },
      });

      const passengerCount = Number(body.passengers) || Number(body.passengerCount) || 4;
      const luggageDetails = String(body.luggage || body.luggageDetails || 'Normal Luggage');
      const specialReqs = String(body.specialRequirements || body.notes || notes || '').trim();
      const requestCarrier = Boolean(body.requestCarrier || body.hasCarrier || body.roofCarrier);

      // 3. Create initial TripEvent
      await tx.tripEvent.create({
        data: {
          bookingId: booking.id,
          type: 'BOOKING_CREATED',
          payloadJson: {
            source: 'customer-app',
            category,
            tripType,
            viaStops: Array.isArray(body.viaStops) ? body.viaStops : (Array.isArray(body.stops) ? body.stops : []),
            stops: Array.isArray(body.viaStops) ? body.viaStops : (Array.isArray(body.stops) ? body.stops : []),
            passengers: passengerCount,
            luggage: luggageDetails,
            requestCarrier,
            hasCarrier: requestCarrier,
            flightNumber,
            hasPet,
            isPetFriendly: hasPet,
            petType,
            petFee,
            requiresFleetApproval: isPayOnApproval,
            fleetApprovalStatus: isPayOnApproval ? 'PENDING_APPROVAL' : 'NOT_REQUIRED',
            specialRequirements: specialReqs,
            notes: specialReqs,
            advancePaid: isPayOnApproval ? 0 : pricing.advanceAmount,
            advanceDue: pricing.advanceAmount,
            balanceDue: pricing.balanceAmount,
            razorpayOrderId: orderRef,
            passengerName: passengerName ? String(passengerName).trim() : undefined,
            passengerPhone: passengerPhone ? String(passengerPhone).trim() : undefined,
            alternateEmail: alternateEmail ? String(alternateEmail).trim() : (body.alternateEmail ? String(body.alternateEmail).trim() : undefined),
            companyName: companyName ? String(companyName).trim() : (body.companyName ? String(body.companyName).trim() : undefined),
            gstin: gstin ? String(gstin).trim().toUpperCase() : (body.gstin ? String(body.gstin).trim().toUpperCase() : undefined),
            couponCode: couponCode ? String(couponCode).trim().toUpperCase() : undefined,
            couponDiscount: pricing.discount || Number(body.couponDiscount) || 0,
          },
        },
      });

      if (couponCode) {
        recordCouponUsage(String(couponCode)).catch(() => {});
      }

      if (isPayOnApproval) {
        await tx.tripEvent.create({
          data: {
            bookingId: booking.id,
            type: 'FLEET_APPROVAL_REQUESTED',
            payloadJson: {
              category,
              requiresFleetApproval: true,
              advanceAmount: pricing.advanceAmount,
              message: 'Large fleet availability check requested for Tempo Traveller / Force Urbania. Payment deferred until Admin approval.',
            },
          },
        });
      }

      // 4. Create AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: payload.userId,
          action: 'CREATE_BOOKING',
          entityType: 'Booking',
          entityId: booking.id,
          reason: isPayOnApproval
            ? `Customer requested booking for ${category} (${tripType}${flightNumber ? `, Flight ${flightNumber}` : ''}) for ${passengerCount} travellers. Fleet availability verification required; ₹${pricing.advanceAmount} advance payment deferred until Admin approval.`
            : `Customer booked ${category} (${tripType}${flightNumber ? `, Flight ${flightNumber}` : ''}) for ${passengerCount} passengers (${luggageDetails}) with ₹${pricing.advanceAmount} advance paid.`,
        },
      });

      return booking;
    }, {
      maxWait: 10000,
      timeout: 25000,
    });

    const response = NextResponse.json(
      {
        success: true,
        booking: newBooking,
        message: 'Booking created successfully and pending admin dispatch',
      },
      { status: 201 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in POST /api/customer/bookings:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to create booking' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
