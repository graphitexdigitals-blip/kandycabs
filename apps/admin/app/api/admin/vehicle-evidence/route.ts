import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  normalizePhoneNumber,
  UserRole,
  DriverVerificationStatus,
  VehicleCategory,
  FuelType,
} from '@kandy-cabs/shared';
import { getExpiringDocuments } from '@/lib/documentExpiry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'ALL';

    const whereClause: any = {
      deletedAt: null,
    };
    if (status !== 'ALL' && status !== 'EXPIRING') {
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

    const formattedDrivers = drivers.map((d) => {
      let docDates: Record<string, any> = {};
      let extraDocs: Record<string, any> = {};

      let carModel: string | null = null;
      let carriageCapacity: string | null = null;

      if (d.adminNotes) {
        const modelMatch = d.adminNotes.match(/\[Car Model:\s*([^\]]+)\]/);
        if (modelMatch && modelMatch[1]) carModel = modelMatch[1].trim();

        const carriageMatch = d.adminNotes.match(/\[Luggage\/Carriage:\s*([^\]]+)\]/);
        if (carriageMatch && carriageMatch[1]) carriageCapacity = carriageMatch[1].trim();

        const datesMatch = d.adminNotes.match(/\[DocDates:\s*(\{.*?\})\]/);
        if (datesMatch && datesMatch[1]) {
          try {
            docDates = JSON.parse(datesMatch[1]);
          } catch {}
        }

        const extraMatch = d.adminNotes.match(/\[ExtraDocs:\s*(\{.*?\})\]/);
        if (extraMatch && extraMatch[1]) {
          try {
            extraDocs = JSON.parse(extraMatch[1]);
            if (!docDates || Object.keys(docDates).length === 0) {
              if (extraDocs.docDates) docDates = extraDocs.docDates;
            }
          } catch {}
        }
      }

      let multiVehicles: any[] = [];
      let profileExtra: Record<string, any> = {};
      if (d.adminNotes) {
        const multiMatch = d.adminNotes.match(/\[MultiVehicles:\s*(\[[\s\S]*?\])\]/);
        if (multiMatch && multiMatch[1]) {
          try {
            multiVehicles = JSON.parse(multiMatch[1]);
          } catch {}
        }

        const profileMatch = d.adminNotes.match(/\[ProfileExtra:\s*(\{.*?\})\]/);
        if (profileMatch && profileMatch[1]) {
          try {
            profileExtra = JSON.parse(profileMatch[1]);
          } catch {}
        }
      }

      const expiringDocuments = getExpiringDocuments(docDates, 5);

      return {
        driverId: d.id,
        userId: d.userId,
        fullName: d.user.fullName,
        phone: d.user.phone,
        email: profileExtra.email || null,
        altPhone: profileExtra.altPhone || profileExtra.emergencyContact || null,
        emergencyContact: profileExtra.emergencyContact || profileExtra.altPhone || null,
        city: profileExtra.city || null,
        address: profileExtra.address || null,
        experienceYears: profileExtra.experienceYears || null,
        licenseNumber: d.licenseNumber,
        profilePhotoUrl: d.profilePhotoUrl,
        licenseDocUrl: d.licenseDocUrl,
        rcDocUrl: d.rcDocUrl,
        insuranceDocUrl: d.insuranceDocUrl,
        aadhaarDocUrl: extraDocs.aadhaarDocUrl || null,
        panDocUrl: extraDocs.panDocUrl || null,
        fitnessDocUrl: extraDocs.fitnessDocUrl || null,
        taxDocUrl: extraDocs.taxDocUrl || null,
        permitDocUrl: extraDocs.permitDocUrl || null,
        pucDocUrl: extraDocs.pucDocUrl || null,
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
        carModel,
        carriageCapacity,
        vehicle: d.vehicles[0] || null,
        vehicles: d.vehicles,
        vehiclesList: multiVehicles.length > 0 ? multiVehicles : (d.vehicles.length > 0 ? d.vehicles.map((v, i) => ({
          id: v.id || `veh-${i + 1}`,
          plateNumber: v.plateNumber && v.plateNumber !== 'PENDING' && !v.plateNumber.startsWith('KA 01 TR 0000') ? v.plateNumber : '',
          category: v.category || 'SEDAN',
          carModel: carModel || '',
          fuelType: v.fuelType || 'DIESEL',
          carriageCapacity: carriageCapacity || 'No',
          rcDocUrl: d.rcDocUrl || null,
          insuranceDocUrl: d.insuranceDocUrl || null,
          fitnessDocUrl: extraDocs.fitnessDocUrl || null,
          taxDocUrl: extraDocs.taxDocUrl || null,
          permitDocUrl: extraDocs.permitDocUrl || null,
          pucDocUrl: extraDocs.pucDocUrl || null,
          docDates: (docDates && Object.keys(docDates).length > 0) ? docDates : (extraDocs.docDates || {}),
        })) : []),
        docDates,
        expiringDocuments,
        hasExpiringDocs: expiringDocuments.length > 0,
        createdAt: d.user.createdAt.toISOString(),
      };
    });

    const counts = {
      all: formattedDrivers.length,
      pending: formattedDrivers.filter((d) => d.verificationStatus === 'PENDING').length,
      approved: formattedDrivers.filter((d) => d.verificationStatus === 'APPROVED').length,
      rejected: formattedDrivers.filter((d) => d.verificationStatus === 'REJECTED').length,
      expiringSoon: formattedDrivers.filter((d) => d.hasExpiringDocs).length,
    };

    const finalDrivers = status === 'EXPIRING'
      ? formattedDrivers.filter((d) => d.hasExpiringDocs)
      : formattedDrivers;

    return NextResponse.json({
      success: true,
      counts,
      drivers: finalDrivers,
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
