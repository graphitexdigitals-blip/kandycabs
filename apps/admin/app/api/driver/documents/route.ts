import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { DriverVerificationStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const session = await getDriverSession(req);
    if (!session) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Driver authentication required' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const driver = await prisma.driver.findUnique({
      where: { id: session.driverId },
      include: {
        user: { select: { fullName: true, phone: true } },
        vehicles: {
          where: { deletedAt: null },
          select: { id: true, category: true, plateNumber: true, fuelType: true, seatCount: true },
        },
      },
    });

    if (!driver) {
      const res = NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    let carModel: string | null = null;
    let carriageCapacity: string | null = null;
    if (driver.adminNotes) {
      const modelMatch = driver.adminNotes.match(/\[Car Model:\s*([^\]]+)\]/);
      if (modelMatch && modelMatch[1]) carModel = modelMatch[1].trim();

      const carriageMatch = driver.adminNotes.match(/\[Luggage\/Carriage:\s*([^\]]+)\]/);
      if (carriageMatch && carriageMatch[1]) carriageCapacity = carriageMatch[1].trim();
    }

    const response = NextResponse.json(
      {
        success: true,
        documents: {
          licenseNumber: driver.licenseNumber,
          profilePhotoUrl: driver.profilePhotoUrl,
          licenseDocUrl: driver.licenseDocUrl,
          rcDocUrl: driver.rcDocUrl,
          insuranceDocUrl: driver.insuranceDocUrl,
          vehiclePhotos: driver.vehiclePhotos || [],
          verificationStatus: driver.verificationStatus,
          adminNotes: driver.adminNotes,
          carModel,
          carriageCapacity,
          vehicle: driver.vehicles[0] || null,
        },
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in GET /api/driver/documents:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch documents' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
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
      licenseNumber,
      profilePhotoUrl,
      licenseDocUrl,
      rcDocUrl,
      insuranceDocUrl,
      vehiclePhotos = [],
      plateNumber,
      category,
      carModel,
      fuelType,
      carriageCapacity,
    } = body;

    const dataToUpdate: any = {
      verificationStatus: DriverVerificationStatus.PENDING,
    };

    if (licenseNumber !== undefined && licenseNumber !== null) {
      dataToUpdate.licenseNumber = String(licenseNumber).trim().toUpperCase();
    }
    if (profilePhotoUrl !== undefined) {
      dataToUpdate.profilePhotoUrl = profilePhotoUrl;
    }
    if (licenseDocUrl !== undefined) {
      dataToUpdate.licenseDocUrl = licenseDocUrl;
    }
    if (rcDocUrl !== undefined) {
      dataToUpdate.rcDocUrl = rcDocUrl;
    }
    if (insuranceDocUrl !== undefined) {
      dataToUpdate.insuranceDocUrl = insuranceDocUrl;
    }
    if (Array.isArray(vehiclePhotos)) {
      dataToUpdate.vehiclePhotos = vehiclePhotos;
    }

    let notesToUpdate = session.driver.adminNotes || '';
    if (carModel !== undefined && carModel !== null && String(carModel).trim()) {
      const modelTag = `[Car Model: ${String(carModel).trim()}]`;
      notesToUpdate = notesToUpdate.replace(/\[Car Model:[^\]]+\]/g, '').trim();
      notesToUpdate = notesToUpdate ? `${notesToUpdate} ${modelTag}` : modelTag;
      dataToUpdate.adminNotes = notesToUpdate;
    }
    if (carriageCapacity !== undefined && carriageCapacity !== null && String(carriageCapacity).trim()) {
      const carriageTag = `[Luggage/Carriage: ${String(carriageCapacity).trim()}]`;
      notesToUpdate = notesToUpdate.replace(/\[Luggage\/Carriage:[^\]]+\]/g, '').trim();
      notesToUpdate = notesToUpdate ? `${notesToUpdate} ${carriageTag}` : carriageTag;
      dataToUpdate.adminNotes = notesToUpdate;
    }

    const updatedDriver = await prisma.driver.update({
      where: { id: session.driverId },
      data: dataToUpdate,
      include: {
        user: { select: { fullName: true, phone: true } },
        vehicles: { where: { deletedAt: null } },
      },
    });

    const getSeatCountForCategory = (cat: string) => {
      switch (cat) {
        case 'TEMPO_TRAVELER':
          return 12;
        case 'SUV_PREMIUM':
          return 7;
        case 'SUV':
          return 6;
        case 'SEDAN':
        case 'HATCHBACK':
        default:
          return 4;
      }
    };

    if (updatedDriver.vehicles.length > 0) {
      const vId = updatedDriver.vehicles[0].id;
      const vehicleData: any = {};
      if (plateNumber) vehicleData.plateNumber = String(plateNumber).trim().toUpperCase();
      if (category) {
        vehicleData.category = category;
        vehicleData.seatCount = getSeatCountForCategory(category);
      }
      if (fuelType) vehicleData.fuelType = fuelType;

      if (Object.keys(vehicleData).length > 0) {
        await prisma.vehicle.update({
          where: { id: vId },
          data: vehicleData,
        });
      }
    } else if (category || plateNumber || fuelType) {
      const selectedCategory = category || 'SEDAN';
      const selectedFuelType = fuelType || 'DIESEL';
      await prisma.vehicle.create({
        data: {
          driverId: session.driverId,
          category: selectedCategory,
          fuelType: selectedFuelType,
          seatCount: getSeatCountForCategory(selectedCategory),
          plateNumber: plateNumber ? String(plateNumber).trim().toUpperCase() : 'PENDING',
          baseFarePerKm: 14.0,
          extraKmRate: 14.0,
          driverAllowance: 300.0,
        },
      });
    }

    // Log audit event
    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: 'DRIVER_DOCUMENTS_UPLOADED',
        entityType: 'Driver',
        entityId: session.driverId,
        reason: `Driver uploaded KYC documents, vehicle specs (${category || 'N/A'}, ${plateNumber || 'N/A'}, ${fuelType || 'N/A'}) & carriage details`,
      },
    });

    const refreshedDriver = await prisma.driver.findUnique({
      where: { id: session.driverId },
      include: {
        user: { select: { fullName: true, phone: true } },
        vehicles: { where: { deletedAt: null } },
      },
    });

    const response = NextResponse.json(
      {
        success: true,
        message: 'Driver documents, vehicle details, and carriage info saved successfully. Sent for Admin Verification.',
        driver: refreshedDriver,
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in POST /api/driver/documents:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to update documents' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
