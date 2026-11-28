import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  BookingStatus,
  TripType,
  VehicleCategory,
  PaymentStatus,
  PaymentType,
  DispatchStatus,
  UserRole,
  calculateFare,
  parseSafeIsoDate,
} from '@kandy-cabs/shared';
import { getAdminSession } from '@/lib/auth';
import { resolveImageUrl } from '@/lib/resolveImageUrl';
import { calculateRouteDistance } from '@/lib/distance';
import { RealtimeEvents } from '@/lib/realtime-events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin privileges required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const rawLimit = parseInt(searchParams.get('limit') || '25', 10);
    const limit = Math.min(50, Math.max(1, rawLimit));
    const statusParam = searchParams.get('status')?.toUpperCase();
    const search = searchParams.get('search')?.trim();
    const startDate = searchParams.get('startDate')?.trim();
    const endDate = searchParams.get('endDate')?.trim();

    const where: any = {
      deletedAt: null,
    };

    if (statusParam && statusParam !== 'ALL') {
      const now = new Date();
      if (statusParam === 'MISSED') {
        where.scheduledAt = { lt: now };
        where.status = {
          in: [BookingStatus.PENDING_ADMIN, BookingStatus.DISPATCHED, BookingStatus.DRIVER_ACCEPTED],
        };
      } else if (statusParam === 'DECLINED') {
        where.tripEvents = { some: { type: 'DRIVER_DECLINED' } };
        where.status = { in: [BookingStatus.PENDING_ADMIN, BookingStatus.DISPATCHED] };
        where.assignedDriverId = null;
      } else if (statusParam === BookingStatus.PENDING_ADMIN || statusParam === 'PENDING') {
        where.status = BookingStatus.PENDING_ADMIN;
        where.scheduledAt = { gte: now };
      } else if (statusParam === BookingStatus.DISPATCHED) {
        where.status = BookingStatus.DISPATCHED;
      } else if (statusParam === BookingStatus.DRIVER_ACCEPTED || statusParam === 'ACCEPTED') {
        where.status = BookingStatus.DRIVER_ACCEPTED;
        where.scheduledAt = { gte: now };
      } else if (Object.values(BookingStatus).includes(statusParam as any)) {
        where.status = statusParam as BookingStatus;
      }
    }

    // Filter by Scheduled Pickup Date range (IST-aware)
    if (startDate || endDate) {
      const dateRange: any = {};
      if (startDate) {
        dateRange.gte = new Date(`${startDate}T00:00:00.000+05:30`);
      }
      if (endDate) {
        dateRange.lte = new Date(`${endDate}T23:59:59.999+05:30`);
      }

      if (where.scheduledAt && typeof where.scheduledAt === 'object') {
        where.scheduledAt = {
          ...where.scheduledAt,
          ...dateRange,
        };
      } else {
        where.scheduledAt = dateRange;
      }
    }

    if (search) {
      where.OR = [
        { humanReadableRef: { contains: search, mode: 'insensitive' } },
        { customer: { user: { phone: { contains: search } } } },
        { customer: { user: { fullName: { contains: search, mode: 'insensitive' } } } },
        { pickupAddress: { contains: search, mode: 'insensitive' } },
        { dropAddress: { contains: search, mode: 'insensitive' } },
      ];
    }

    const totalCount = await prisma.booking.count({ where });
    const rawBookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        humanReadableRef: true,
        tripType: true,
        pickupAddress: true,
        dropAddress: true,
        actualPickupAddress: true,
        actualPickupLat: true,
        actualPickupLng: true,
        actualStartedAt: true,
        actualDropAddress: true,
        actualDropLat: true,
        actualDropLng: true,
        actualCompletedAt: true,
        distanceKm: true,
        estimatedFare: true,
        advanceAmount: true,
        driverPayeeAmount: true,
        driverAllowance: true,
        scheduledAt: true,
        status: true,
        customerPhoneReleased: true,
        driverPaymentStatus: true,
        startingOdometer: true,
        startingOdometerImagePath: true,
        finalOdometer: true,
        finalOdometerImagePath: true,
        vehicleInspectionPhotos: true,
        createdAt: true,
        customer: {
          select: {
            user: {
              select: { id: true, fullName: true, phone: true },
            },
          },
        },
        assignedDriver: {
          select: {
            user: {
              select: { id: true, fullName: true, phone: true },
            },
          },
        },
        vehicle: {
          select: {
            category: true,
            fuelType: true,
            plateNumber: true,
          },
        },
        tripEvents: {
          select: { id: true, type: true, payloadJson: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        dispatches: {
          select: {
            id: true,
            driverId: true,
            status: true,
            broadcastAt: true,
            respondedAt: true,
            driver: {
              select: {
                id: true,
                user: {
                  select: { fullName: true, phone: true },
                },
              },
            },
          },
          orderBy: { broadcastAt: 'desc' },
          take: 20,
        },
      },
    });

    // Format lightweight image paths (Supabase Storage URLs / local paths)
    const bookings = rawBookings.map((b) => ({
      ...b,
      startingOdometerImagePath: resolveImageUrl(b.startingOdometerImagePath) || null,
      finalOdometerImagePath: resolveImageUrl(b.finalOdometerImagePath) || null,
      vehicleInspectionPhotos: Array.isArray(b.vehicleInspectionPhotos)
        ? b.vehicleInspectionPhotos.map((p) => resolveImageUrl(p)).filter(Boolean)
        : [],
    }));

    const totalPages = Math.ceil(totalCount / limit) || 1;

    // Always return 200 with array (even if 0 results)
    return NextResponse.json(
      {
        success: true,
        bookings,
        pagination: {
          totalCount,
          totalPages,
          page,
          limit,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in GET /api/admin/bookings:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch bookings', bookings: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin privileges required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      customerPhone,
      customerName,
      customerEmail,
      tripType = TripType.ONEWAY,
      category = VehicleCategory.SEDAN,
      pickupAddress,
      pickupLat,
      pickupLng,
      dropAddress,
      dropLat,
      dropLng,
      scheduledAt,
      distanceKm: passedDistanceKm,
      estimatedFare: passedEstimatedFare,
      advanceAmount: passedAdvanceAmount,
      advancePaymentStatus = PaymentStatus.PENDING,
      driverPayeeAmount: passedDriverPayeeAmount,
      driverAllowance: passedDriverAllowance,
      assignedDriverId,
      passengers = 4,
      luggage = 'Normal Luggage',
      hasCarrier = false,
      hasPet = false,
      flightNumber,
      notes,
      fleetId,
      fleetName,
      luggageDetails,
      isSeniorCitizen = false,
      isBabyOnBoard = false,
      isPregnancyFriendly = false,
      isHandicapped = false,
      needAirportDrop = false,
      needAirportPickup = false,
      needReturnJourney = false,
      petType,
      specialRequirements,
    } = body;

    // 1. Validation
    if (!customerPhone || String(customerPhone).trim().length < 5) {
      return NextResponse.json(
        { success: false, message: 'Customer phone number is required' },
        { status: 400 }
      );
    }

    if (!pickupAddress || !dropAddress) {
      return NextResponse.json(
        { success: false, message: 'Pickup address and drop address are required' },
        { status: 400 }
      );
    }

    if (!scheduledAt) {
      return NextResponse.json(
        { success: false, message: 'Trip schedule date & time is required' },
        { status: 400 }
      );
    }

    // 2. Normalize customer phone number (ensure +91)
    const digitsOnly = String(customerPhone).replace(/\D/g, '');
    const tenDigits = digitsOnly.slice(-10);
    if (tenDigits.length < 10) {
      return NextResponse.json(
        { success: false, message: 'Please provide a valid 10-digit mobile number' },
        { status: 400 }
      );
    }
    const normalizedPhone = `+91${tenDigits}`;

    // 3. Find or Create User & Customer
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: tenDigits },
          { phone: { contains: tenDigits } },
        ],
      },
      include: { customer: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: normalizedPhone,
          fullName: customerName ? String(customerName).trim() : 'Valued Customer',
          roles: [UserRole.CUSTOMER],
          customer: {
            create: {
              email: customerEmail ? String(customerEmail).trim() : null,
            },
          },
        },
        include: { customer: true },
      });
    } else {
      // Update full name if given and was previously empty or generic
      if (
        customerName &&
        (!user.fullName || user.fullName === 'Valued Customer' || user.fullName.trim() === '')
      ) {
        await prisma.user.update({
          where: { id: user.id },
          data: { fullName: String(customerName).trim() },
        });
      }

      // Ensure customer record exists
      if (!user.customer) {
        const newCustomer = await prisma.customer.create({
          data: {
            userId: user.id,
            email: customerEmail ? String(customerEmail).trim() : null,
          },
        });
        user.customer = newCustomer;
      } else if (customerEmail && !user.customer.email) {
        await prisma.customer.update({
          where: { id: user.customer.id },
          data: { email: String(customerEmail).trim() },
        });
      }
    }

    const customer = user.customer!;

    // 4. Coordinates & Distance
    const pLat = typeof pickupLat === 'number' ? pickupLat : 12.9141;
    const pLng = typeof pickupLng === 'number' ? pickupLng : 74.8560;
    const dLat = typeof dropLat === 'number' ? dropLat : 13.0827;
    const dLng = typeof dropLng === 'number' ? dropLng : 80.2707;

    let distanceKm = Number(passedDistanceKm) || 0;
    if (distanceKm <= 0) {
      try {
        const route = await calculateRouteDistance(pLat, pLng, dLat, dLng);
        distanceKm = route.distanceKm || 50;
      } catch {
        distanceKm = 50;
      }
    }

    // 5. Pricing calculation
    let estimatedFare = Number(passedEstimatedFare) || 0;
    if (estimatedFare <= 0) {
      try {
        const quote = calculateFare({
          category,
          tripType,
          distanceKm,
          scheduledAt: new Date(scheduledAt),
        });
        estimatedFare = quote.totalFare || 2500;
      } catch {
        estimatedFare = Math.round(distanceKm * 18);
      }
    }

    let advanceAmount =
      passedAdvanceAmount !== undefined && passedAdvanceAmount !== null
        ? Number(passedAdvanceAmount)
        : Math.round(estimatedFare * 0.3);

    const isAdvancePaid = advancePaymentStatus === PaymentStatus.PAID;
    const effectiveAdvancePaid = isAdvancePaid ? advanceAmount : 0;
    const balanceAmount = Math.max(0, estimatedFare - effectiveAdvancePaid);

    let driverPayeeAmount =
      passedDriverPayeeAmount !== undefined && passedDriverPayeeAmount !== null && Number(passedDriverPayeeAmount) > 0
        ? Number(passedDriverPayeeAmount)
        : Math.round(estimatedFare * 0.77);

    const driverAllowance = Number(passedDriverAllowance) || 0;

    // 6. Generate human-readable reference & pickup OTP
    let humanReadableRef = `KC-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    for (let attempts = 0; attempts < 5; attempts++) {
      const existing = await prisma.booking.findUnique({
        where: { humanReadableRef },
        select: { id: true },
      });
      if (!existing) break;
      humanReadableRef = `KC-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    const pickupOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // 7. Atomic transaction to create booking, payment, and events
    const newBooking = await prisma.$transaction(async (tx) => {
      const isDriverAssigned = Boolean(assignedDriverId);
      const initialStatus = isDriverAssigned
        ? BookingStatus.DISPATCHED
        : BookingStatus.PENDING_ADMIN;

      const booking = await tx.booking.create({
        data: {
          humanReadableRef,
          customerId: customer.id,
          tripType,
          pickupAddress: String(pickupAddress).trim(),
          pickupLat: pLat,
          pickupLng: pLng,
          dropAddress: String(dropAddress).trim(),
          dropLat: dLat,
          dropLng: dLng,
          scheduledAt: parseSafeIsoDate(scheduledAt),
          distanceKm,
          estimatedFare,
          advanceAmount,
          advancePaymentStatus: advancePaymentStatus as PaymentStatus,
          balanceAmount,
          balancePaymentStatus: PaymentStatus.PENDING,
          status: initialStatus,
          assignedDriverId: null, // Keep null on booking creation so driver is dispatched only (not auto-accepted) and can Accept or Decline
          pickupOtp,
          customerLocationSharingEnabled: true,
          driverAllowance,
          driverPayeeAmount,
          driverPaymentStatus: PaymentStatus.PENDING,
        },
      });

      // Advance payment record
      await tx.payment.create({
        data: {
          bookingId: booking.id,
          type: PaymentType.ADVANCE,
          amount: advanceAmount,
          razorpayOrderId: `admin_order_${Date.now()}`,
          razorpayPaymentId: isAdvancePaid ? `admin_cash_${Date.now()}` : null,
          status: isAdvancePaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
          verifiedAt: isAdvancePaid ? new Date() : null,
        },
      });

      // Initial booking created TripEvent
      await tx.tripEvent.create({
        data: {
          bookingId: booking.id,
          type: 'BOOKING_CREATED',
          payloadJson: {
            source: 'admin-panel',
            bookedByAdmin: true,
            adminId: session.userId,
            adminName: session.phone || 'Operations Admin',
            category,
            fleetId: fleetId || undefined,
            fleetName: fleetName || undefined,
            tripType,
            passengers: Number(passengers) || 1,
            luggage: String(luggage || 'Normal Luggage'),
            luggageDetails: luggageDetails || undefined,
            hasCarrier: Boolean(hasCarrier),
            requestCarrier: Boolean(hasCarrier),
            hasPet: Boolean(hasPet),
            petType: petType || undefined,
            isSeniorCitizen: Boolean(isSeniorCitizen),
            isBabyOnBoard: Boolean(isBabyOnBoard),
            isPregnancyFriendly: Boolean(isPregnancyFriendly),
            isHandicapped: Boolean(isHandicapped),
            needAirportDrop: Boolean(needAirportDrop),
            needAirportPickup: Boolean(needAirportPickup),
            needReturnJourney: Boolean(needReturnJourney),
            flightNumber: flightNumber ? String(flightNumber).trim().toUpperCase() : undefined,
            specialRequirements: specialRequirements ? String(specialRequirements).trim() : notes ? String(notes).trim() : undefined,
            notes: notes ? String(notes).trim() : undefined,
            passengerName: customerName ? String(customerName).trim() : user.fullName,
            passengerPhone: normalizedPhone,
            advancePaid: effectiveAdvancePaid,
            advanceDue: advanceAmount,
            balanceDue: balanceAmount,
          },
        },
      });

      // If a driver was assigned immediately by Admin, create pending dispatch awaiting driver Accept / Decline
      if (assignedDriverId) {
        await tx.bookingDispatch.create({
          data: {
            bookingId: booking.id,
            driverId: assignedDriverId,
            status: DispatchStatus.PENDING,
            broadcastAt: new Date(),
          },
        });

        await tx.tripEvent.create({
          data: {
            bookingId: booking.id,
            type: 'DISPATCH_BROADCAST',
            payloadJson: {
              dispatchedDriverIds: [assignedDriverId],
              broadcastCount: 1,
              assignedByAdmin: true,
              adminName: session.phone || 'Operations Admin',
              timestamp: new Date().toISOString(),
            },
          },
        });
      }

      // Audit log entry (ensure actor user exists in DB)
      const adminUserExists = await tx.user.findUnique({
        where: { id: session.userId },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: adminUserExists ? session.userId : null,
          action: 'ADMIN_MANUAL_BOOKING_CREATED',
          entityType: 'BOOKING',
          entityId: booking.id,
          reason: `Manual booking ${humanReadableRef} created for customer ${normalizedPhone} (Dispatched to driver ${assignedDriverId})`,
        },
      });

      return booking;
    });

    // Notify driver in real-time so incoming dispatch interface / alert pops up immediately
    if (assignedDriverId) {
      try {
        RealtimeEvents.emitToDriver(assignedDriverId, 'DISPATCH_NEW', {
          dispatchId: `dispatch-${newBooking.id}`,
          bookingId: newBooking.id,
          booking: newBooking,
        });
      } catch (rtErr) {
        console.warn('[AdminBookings] Failed to emit realtime dispatch event to driver:', rtErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Booking ${newBooking.humanReadableRef} created successfully for ${normalizedPhone}`,
        booking: newBooking,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/admin/bookings:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create booking' },
      { status: 500 }
    );
  }
}
