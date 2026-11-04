import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { BookingStatus, getDistanceInMeters } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { RealtimeEvents } from '@/lib/realtime-events';

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
      lat,
      lng,
      bookingId,
      batchedPoints = [],
      recordedAt,
    } = body;

    // 1. Sanity & Bounds Validation
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      (lat === 0 && lng === 0)
    ) {
      const res = NextResponse.json(
        { success: false, message: 'Valid non-zero GPS coordinates required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const now = new Date();
    const pingTimestamp = recordedAt ? new Date(recordedAt) : now;

    // 2. Fetch driver's lastPingAt to prevent out-of-order/stale coordinate overwrites
    const currentDriver = await prisma.driver.findUnique({
      where: { id: session.driverId },
      select: { id: true, currentLat: true, currentLng: true, lastPingAt: true },
    });

    if (!currentDriver) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Driver record not found' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    // Stale location protection: do not overwrite newer coordinates if ping is older than existing lastPingAt
    const isStale =
      currentDriver.lastPingAt &&
      pingTimestamp.getTime() < currentDriver.lastPingAt.getTime() - 2000;

    if (!isStale) {
      await prisma.driver.update({
        where: { id: session.driverId },
        data: {
          currentLat: lat,
          currentLng: lng,
          lastPingAt: now,
        },
      });
    } else {
      // Just refresh heartbeat timestamp without overwriting newer coordinates
      await prisma.driver.update({
        where: { id: session.driverId },
        data: {
          lastPingAt: now,
        },
      });
    }

    let distanceToPickup: number | null = null;
    let isNearPickup = false;
    let isArrived = false;

    // 3. ACTIVE-TRIP tier: Insert TripTracking breadcrumbs & evaluate Geofence Arrival
    if (bookingId) {
      // Lean selective query on Booking: avoids heavy multi-table joins on every single ping
      const activeBooking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          assignedDriverId: session.driverId,
          status: { in: [BookingStatus.DRIVER_ACCEPTED, BookingStatus.DRIVER_EN_ROUTE, BookingStatus.TRIP_STARTED] },
        },
        select: {
          id: true,
          status: true,
          pickupLat: true,
          pickupLng: true,
          pickupOtp: true,
          assignedDriverId: true,
        },
      });

      if (activeBooking) {
        // Fetch the most recent TripTracking point to deduplicate stationary / negligible movement
        const lastTrackedPoint = await prisma.tripTracking.findFirst({
          where: { bookingId },
          orderBy: { recordedAt: 'desc' },
          select: { lat: true, lng: true, recordedAt: true },
        });

        const pointsToInsert = [];

        // Check if movement is significant (>= 12m) or heartbeat interval (>= 45s) has elapsed
        const shouldRecordPoint = (pointLat: number, pointLng: number, pointTime: Date) => {
          if (!lastTrackedPoint) return true;
          const dist = getDistanceInMeters(lastTrackedPoint.lat, lastTrackedPoint.lng, pointLat, pointLng);
          const elapsedSec = (pointTime.getTime() - lastTrackedPoint.recordedAt.getTime()) / 1000;
          return dist >= 12 || elapsedSec >= 45;
        };

        if (Array.isArray(batchedPoints) && batchedPoints.length > 0) {
          for (const pt of batchedPoints) {
            if (
              typeof pt.lat === 'number' &&
              typeof pt.lng === 'number' &&
              pt.lat >= -90 &&
              pt.lat <= 90 &&
              pt.lng >= -180 &&
              pt.lng <= 180 &&
              !(pt.lat === 0 && pt.lng === 0)
            ) {
              const ptTime = pt.recordedAt ? new Date(pt.recordedAt) : now;
              if (shouldRecordPoint(pt.lat, pt.lng, ptTime)) {
                pointsToInsert.push({
                  bookingId,
                  driverId: session.driverId,
                  lat: pt.lat,
                  lng: pt.lng,
                  recordedAt: ptTime,
                });
              }
            }
          }
        } else if (shouldRecordPoint(lat, lng, now)) {
          pointsToInsert.push({
            bookingId,
            driverId: session.driverId,
            lat,
            lng,
            recordedAt: now,
          });
        }

        if (pointsToInsert.length > 0) {
          await prisma.tripTracking.createMany({
            data: pointsToInsert,
          });

          // Emit realtime coordinates to customer map listeners
          RealtimeEvents.emitToBooking(bookingId, 'DRIVER_LOCATION', {
            bookingId,
            driverId: session.driverId,
            lat,
            lng,
            timestamp: now.getTime(),
          });
        }

        // --- GEOFENCE PROXIMITY & ARRIVAL ENGINE ---
        // Only run geofencing during the pickup phase (DRIVER_ACCEPTED or DRIVER_EN_ROUTE)
        if (
          (activeBooking.status === BookingStatus.DRIVER_ACCEPTED ||
            activeBooking.status === BookingStatus.DRIVER_EN_ROUTE) &&
          typeof activeBooking.pickupLat === 'number' &&
          typeof activeBooking.pickupLng === 'number'
        ) {
          distanceToPickup = getDistanceInMeters(
            lat,
            lng,
            activeBooking.pickupLat,
            activeBooking.pickupLng
          );

          isNearPickup = distanceToPickup <= 500;
          isArrived = distanceToPickup <= 80;

          if (isNearPickup || isArrived) {
            // Lazy load existing trip events and driver/vehicle details ONLY when in geofence zone
            const [existingEvents, driverDetail] = await Promise.all([
              prisma.tripEvent.findMany({
                where: {
                  bookingId: activeBooking.id,
                  type: { in: ['DRIVER_NEAR_PICKUP', 'DRIVER_ARRIVED'] },
                },
                select: { type: true },
              }),
              prisma.driver.findUnique({
                where: { id: session.driverId },
                select: {
                  user: { select: { fullName: true } },
                  vehicles: { select: { plateNumber: true, category: true }, take: 1 },
                },
              }),
            ]);

            const alreadyNear = existingEvents.some((e) => e.type === 'DRIVER_NEAR_PICKUP');
            const alreadyArrived = existingEvents.some((e) => e.type === 'DRIVER_ARRIVED');
            const driverName = driverDetail?.user?.fullName || 'Your Driver';
            const vehiclePlate = driverDetail?.vehicles?.[0]?.plateNumber || '';
            const vehicleModel = driverDetail?.vehicles?.[0]?.category || '';

            // Geofence Stage 1 (~500m): Driver approaching pickup
            if (isNearPickup && !alreadyNear) {
              const nearMsg = `🚕 ${driverName} is arriving at your pickup location (${Math.round(distanceToPickup)}m away). Please be ready!`;

              await prisma.tripEvent.create({
                data: {
                  bookingId: activeBooking.id,
                  type: 'DRIVER_NEAR_PICKUP',
                  payloadJson: {
                    distanceMeters: Math.round(distanceToPickup),
                    driverName,
                    vehiclePlate,
                    vehicleModel,
                    message: nearMsg,
                    timestamp: now.toISOString(),
                  },
                },
              });

              RealtimeEvents.emitToBooking(bookingId, 'DRIVER_NEAR_PICKUP', {
                bookingId,
                distanceMeters: Math.round(distanceToPickup),
                driverName,
                vehiclePlate,
                message: nearMsg,
              });
            }

            // Geofence Stage 2 (~80m): Driver Arrived -> Reveal Pickup OTP
            if (isArrived && !alreadyArrived) {
              const arrivedMsg = `📍 ${driverName} has arrived at your pickup location! Your OTP is ${activeBooking.pickupOtp || '----'}.`;

              await prisma.tripEvent.create({
                data: {
                  bookingId: activeBooking.id,
                  type: 'DRIVER_ARRIVED',
                  payloadJson: {
                    distanceMeters: Math.round(distanceToPickup),
                    pickupOtp: activeBooking.pickupOtp,
                    driverName,
                    vehiclePlate,
                    vehicleModel,
                    message: arrivedMsg,
                    timestamp: now.toISOString(),
                  },
                },
              });

              RealtimeEvents.emitToBooking(bookingId, 'DRIVER_ARRIVED', {
                bookingId,
                distanceMeters: Math.round(distanceToPickup),
                pickupOtp: activeBooking.pickupOtp,
                driverName,
                vehiclePlate,
                message: arrivedMsg,
              });
            }
          }
        }
      }
    }

    const res = NextResponse.json(
      {
        success: true,
        timestamp: now.toISOString(),
        distanceToPickup,
        isNearPickup,
        isArrived,
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/ping:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Ping failed' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
