import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  verifyAuthToken,
  UserRole,
  DriverVerificationStatus,
  VehicleCategory,
  FuelType,
} from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const {
      fullName,
      licenseNumber,
      category = VehicleCategory.SEDAN,
      fuelType = FuelType.DIESEL,
      plateNumber,
      seatCount = 4,
      licenseDocUrl,
      rcDocUrl,
      insuranceDocUrl,
      vehiclePhotos = [],
    } = body;

    if (!licenseNumber || !plateNumber) {
      const res = NextResponse.json(
        { success: false, message: 'License number and Vehicle plate number are required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Execute atomic onboarding transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update user fullName & add DRIVER role if not present
      const user = await tx.user.findUnique({ where: { id: payload.userId } });
      const roles = user?.roles || [];
      if (!roles.includes(UserRole.DRIVER)) {
        roles.push(UserRole.DRIVER);
      }

      await tx.user.update({
        where: { id: payload.userId },
        data: {
          fullName: fullName || user?.fullName,
          roles,
        },
      });

      // 2. Upsert Driver profile
      const driver = await tx.driver.upsert({
        where: { userId: payload.userId },
        update: {
          licenseNumber,
          licenseDocUrl: licenseDocUrl || null,
          rcDocUrl: rcDocUrl || null,
          insuranceDocUrl: insuranceDocUrl || null,
          vehiclePhotos: Array.isArray(vehiclePhotos) ? vehiclePhotos : [],
          verificationStatus: DriverVerificationStatus.PENDING,
        },
        create: {
          userId: payload.userId,
          licenseNumber,
          licenseDocUrl: licenseDocUrl || null,
          rcDocUrl: rcDocUrl || null,
          insuranceDocUrl: insuranceDocUrl || null,
          vehiclePhotos: Array.isArray(vehiclePhotos) ? vehiclePhotos : [],
          verificationStatus: DriverVerificationStatus.PENDING,
          onlineStatus: false,
        },
      });

      // 3. Create or link Vehicle
      const vehicle = await tx.vehicle.create({
        data: {
          driverId: driver.id,
          category: category as VehicleCategory,
          fuelType: fuelType as FuelType,
          plateNumber: plateNumber.toUpperCase().trim(),
          seatCount: Number(seatCount),
          baseFarePerKm: 14.0,
          extraKmRate: 15.0,
          driverAllowance: 350.0,
        },
      });

      // 4. Create AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: payload.userId,
          action: 'DRIVER_ONBOARDING_SUBMITTED',
          entityType: 'Driver',
          entityId: driver.id,
          reason: `Driver submitted onboarding with vehicle ${plateNumber}`,
        },
      });

      return { driver, vehicle };
    }, {
      maxWait: 10000,
      timeout: 25000,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Onboarding documents submitted successfully. Verification pending.',
        driver: result.driver,
        vehicle: result.vehicle,
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in POST /api/driver/onboarding:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Onboarding failed' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
