import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  normalizePhoneNumber,
  UserRole,
  DriverVerificationStatus,
  VehicleCategory,
  FuelType,
} from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'ALL';

    const whereClause: any = {
      deletedAt: null,
    };
    if (status !== 'ALL') {
      whereClause.verificationStatus = status;
    }

    const drivers = await prisma.driver.findMany({
      where: whereClause,
      orderBy: { user: { createdAt: 'desc' } },
      include: {
        user: { select: { fullName: true, phone: true, createdAt: true } },
        vehicles: {
          where: { deletedAt: null },
          select: {
            id: true,
            category: true,
            fuelType: true,
            seatCount: true,
            plateNumber: true,
          },
        },
      },
    });

    const formattedDrivers = drivers.map((d) => ({
      driverId: d.id,
      userId: d.userId,
      fullName: d.user.fullName,
      phone: d.user.phone,
      licenseNumber: d.licenseNumber,
      profilePhotoUrl: d.profilePhotoUrl,
      licenseDocUrl: d.licenseDocUrl,
      rcDocUrl: d.rcDocUrl,
      insuranceDocUrl: d.insuranceDocUrl,
      vehiclePhotos: d.vehiclePhotos || [],
      verificationStatus: d.verificationStatus,
      adminNotes: d.adminNotes,
      onlineStatus: d.onlineStatus,
      payoutMethod: d.payoutMethod || 'BANK',
      bankAccountHolderName: d.bankAccountHolderName || null,
      bankAccountNumber: d.bankAccountNumber || null,
      bankIfsc: d.bankIfsc || null,
      bankName: d.bankName || null,
      payoutUpiId: d.payoutUpiId || null,
      payoutPhone: d.payoutPhone || null,
      payoutEmail: d.payoutEmail || null,
      payoutStatus: d.payoutStatus || 'PENDING',
      vehicle: d.vehicles[0] || null,
      createdAt: d.user.createdAt.toISOString(),
    }));

    const counts = {
      all: formattedDrivers.length,
      pending: formattedDrivers.filter((d) => d.verificationStatus === 'PENDING').length,
      approved: formattedDrivers.filter((d) => d.verificationStatus === 'APPROVED').length,
      rejected: formattedDrivers.filter((d) => d.verificationStatus === 'REJECTED').length,
    };

    return NextResponse.json({
      success: true,
      counts,
      drivers: formattedDrivers,
    });
  } catch (error: any) {
    console.error('Error fetching vehicle evidence:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch vehicle evidence' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, phone, licenseNumber, category, plateNumber, fuelType } = body;

    if (!fullName || !phone) {
      return NextResponse.json(
        { error: 'Full name and mobile number are required' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);

    // 1. Create or update User
    const user = await prisma.user.upsert({
      where: { phone: normalizedPhone },
      update: {
        fullName,
        roles: { set: [UserRole.DRIVER] },
      },
      create: {
        phone: normalizedPhone,
        fullName,
        roles: [UserRole.DRIVER],
      },
    });

    // 2. Create or update Driver in PENDING status for document upload
    const driver = await prisma.driver.upsert({
      where: { userId: user.id },
      update: {
        licenseNumber: licenseNumber?.trim() || 'PENDING',
        verificationStatus: DriverVerificationStatus.PENDING,
        onlineStatus: false,
      },
      create: {
        userId: user.id,
        licenseNumber: licenseNumber?.trim() || 'PENDING',
        verificationStatus: DriverVerificationStatus.PENDING,
        onlineStatus: false,
      },
    });

    // 3. Create or attach Vehicle only if category or plateNumber was provided by admin
    if (category || plateNumber) {
      const vehicleCat = (category as VehicleCategory) || VehicleCategory.SEDAN;
      const vehicleFuel = (fuelType as FuelType) || FuelType.DIESEL;

      const fleetConfig = await prisma.fleetCategory.findUnique({
        where: { category: vehicleCat },
      });

      const baseFare = fleetConfig
        ? vehicleFuel === FuelType.CNG
          ? fleetConfig.cngRate
          : vehicleFuel === FuelType.PETROL
          ? fleetConfig.petrolRate
          : fleetConfig.dieselRate
        : 13.0;

      await prisma.vehicle.create({
        data: {
          driverId: driver.id,
          category: vehicleCat,
          fuelType: vehicleFuel,
          seatCount: fleetConfig?.seatCount || (vehicleCat === VehicleCategory.SUV_PREMIUM ? 7 : vehicleCat === VehicleCategory.SUV ? 6 : 4),
          baseFarePerKm: baseFare || 14.0,
          extraKmRate: fleetConfig?.extraKmRate || 14.0,
          driverAllowance: fleetConfig?.driverAllowance || 300.0,
          plateNumber: plateNumber?.trim() ? plateNumber.trim().toUpperCase() : null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Driver account registered in Pending state. Driver can now log into the Driver App and upload documents.',
      driverId: driver.id,
    });
  } catch (error: any) {
    console.error('Error adding driver:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add driver' },
      { status: 500 }
    );
  }
}
