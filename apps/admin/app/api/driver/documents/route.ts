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
    let extraDocs: Record<string, any> = {};
    let docDates: Record<string, any> = {};
    let multiVehicles: any[] = [];

    if (driver.adminNotes) {
      const multiMatch = driver.adminNotes.match(/\[MultiVehicles:\s*(\[[\s\S]*?\])\]/);
      if (multiMatch && multiMatch[1]) {
        try {
          multiVehicles = JSON.parse(multiMatch[1]);
        } catch {}
      }

      const modelMatch = driver.adminNotes.match(/\[Car Model:\s*([^\]]+)\]/);
      if (modelMatch && modelMatch[1]) carModel = modelMatch[1].trim();

      const carriageMatch = driver.adminNotes.match(/\[Luggage\/Carriage:\s*([^\]]+)\]/);
      if (carriageMatch && carriageMatch[1]) carriageCapacity = carriageMatch[1].trim();

      const datesMatch = driver.adminNotes.match(/\[DocDates:\s*(\{.*?\})\]/);
      if (datesMatch && datesMatch[1]) {
        try {
          docDates = JSON.parse(datesMatch[1]);
        } catch {}
      }

      const extraMatch = driver.adminNotes.match(/\[ExtraDocs:\s*(\{.*?\})\]/);
      if (extraMatch && extraMatch[1]) {
        try {
          extraDocs = JSON.parse(extraMatch[1]);
        } catch {}
      }
    }

    let rejectionReason: string | null = null;
    if (driver.adminNotes) {
      const rejMatch = driver.adminNotes.match(/\[RejectionReason:\s*([^\]]+)\]/);
      if (rejMatch && rejMatch[1]) {
        rejectionReason = rejMatch[1].replace(/\[.*?\]/g, '').trim();
      } else if (driver.verificationStatus === 'REJECTED') {
        const cleanNotes = driver.adminNotes.replace(/\[.*?\]/g, '').trim();
        if (cleanNotes) rejectionReason = cleanNotes;
      }
    }

    const response = NextResponse.json(
      {
        success: true,
        documents: {
          fullName: driver.user?.fullName || '',
          licenseNumber: driver.licenseNumber,
          profilePhotoUrl: driver.profilePhotoUrl,
          licenseDocUrl: driver.licenseDocUrl,
          rcDocUrl: driver.rcDocUrl,
          insuranceDocUrl: driver.insuranceDocUrl,
          aadhaarDocUrl: extraDocs.aadhaarDocUrl || null,
          panDocUrl: extraDocs.panDocUrl || null,
          fitnessDocUrl: extraDocs.fitnessDocUrl || null,
          taxDocUrl: extraDocs.taxDocUrl || null,
          permitDocUrl: extraDocs.permitDocUrl || null,
          pucDocUrl: extraDocs.pucDocUrl || null,
          extraDocs,
          docDates: (docDates && Object.keys(docDates).length > 0) ? docDates : (extraDocs.docDates || {}),
          vehiclePhotos: driver.vehiclePhotos || [],
          verificationStatus: driver.verificationStatus,
          rejectionReason,
          adminNotes: driver.adminNotes,
          carModel,
          carriageCapacity,
          vehicle: driver.vehicles[0] || null,
          vehicles: multiVehicles.length > 0 ? multiVehicles : (
            driver.vehicles.length > 0 ? driver.vehicles.map((v, i) => ({
              id: v.id || `veh-${i + 1}`,
              plateNumber: v.plateNumber && v.plateNumber !== 'PENDING' && !v.plateNumber.startsWith('KA 01 TR 0000') ? v.plateNumber : '',
              category: v.category || 'SEDAN',
              carModel: carModel || '',
              fuelType: v.fuelType || 'DIESEL',
              carriageCapacity: carriageCapacity || 'No',
              rcDocUrl: driver.rcDocUrl || null,
              insuranceDocUrl: driver.insuranceDocUrl || null,
              fitnessDocUrl: extraDocs.fitnessDocUrl || null,
              taxDocUrl: extraDocs.taxDocUrl || null,
              permitDocUrl: extraDocs.permitDocUrl || null,
              pucDocUrl: extraDocs.pucDocUrl || null,
              docDates: (docDates && Object.keys(docDates).length > 0) ? docDates : (extraDocs.docDates || {}),
            })) : []
          ),
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
      fullName,
      licenseNumber,
      profilePhotoUrl,
      licenseDocUrl,
      rcDocUrl,
      insuranceDocUrl,
      aadhaarDocUrl,
      panDocUrl,
      fitnessDocUrl,
      taxDocUrl,
      permitDocUrl,
      pucDocUrl,
      docDates: reqDocDates,
      extraDocs: reqExtraDocs,
      vehiclePhotos = [],
      plateNumber,
      category,
      carModel,
      fuelType,
      carriageCapacity,
    } = body;

    const isNewKycDocUploaded = Boolean(licenseDocUrl || rcDocUrl || insuranceDocUrl || aadhaarDocUrl || panDocUrl);
    const dataToUpdate: any = {};
    if (session.driver.verificationStatus !== DriverVerificationStatus.APPROVED || isNewKycDocUploaded) {
      dataToUpdate.verificationStatus = DriverVerificationStatus.PENDING;
    }

    if (licenseNumber !== undefined && licenseNumber !== null) {
      const cleanLicense = String(licenseNumber).trim().toUpperCase();
      dataToUpdate.licenseNumber = cleanLicense || 'PENDING';
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

    // Persist additional KYC & compliance documents in adminNotes
    let existingExtraDocs: Record<string, any> = {};
    const extraMatch = notesToUpdate.match(/\[ExtraDocs:\s*(\{.*?\})\]/);
    if (extraMatch && extraMatch[1]) {
      try {
        existingExtraDocs = JSON.parse(extraMatch[1]);
      } catch {}
    }
    const mergedExtraDocs = {
      ...existingExtraDocs,
      ...(reqExtraDocs || {}),
      ...(aadhaarDocUrl !== undefined ? { aadhaarDocUrl } : {}),
      ...(panDocUrl !== undefined ? { panDocUrl } : {}),
      ...(fitnessDocUrl !== undefined ? { fitnessDocUrl } : {}),
      ...(taxDocUrl !== undefined ? { taxDocUrl } : {}),
      ...(permitDocUrl !== undefined ? { permitDocUrl } : {}),
      ...(pucDocUrl !== undefined ? { pucDocUrl } : {}),
    };
    if (Object.keys(mergedExtraDocs).length > 0) {
      const extraTag = `[ExtraDocs: ${JSON.stringify(mergedExtraDocs)}]`;
      notesToUpdate = notesToUpdate.replace(/\[ExtraDocs:[^\]]+\]/g, '').trim();
      notesToUpdate = notesToUpdate ? `${notesToUpdate} ${extraTag}` : extraTag;
      dataToUpdate.adminNotes = notesToUpdate;
    }

    if (reqDocDates && typeof reqDocDates === 'object') {
      let existingDocDates: Record<string, any> = {};
      const datesMatch = notesToUpdate.match(/\[DocDates:\s*(\{.*?\})\]/);
      if (datesMatch && datesMatch[1]) {
        try {
          existingDocDates = JSON.parse(datesMatch[1]);
        } catch {}
      }
      const mergedDocDates = { ...existingDocDates, ...reqDocDates };
      const datesTag = `[DocDates: ${JSON.stringify(mergedDocDates)}]`;
      notesToUpdate = notesToUpdate.replace(/\[DocDates:[^\]]+\]/g, '').trim();
      notesToUpdate = notesToUpdate ? `${notesToUpdate} ${datesTag}` : datesTag;
      dataToUpdate.adminNotes = notesToUpdate;
    }

    // Multi-vehicle array support
    const reqVehicles = Array.isArray(body.vehicles) && body.vehicles.length > 0 ? body.vehicles : null;
    if (reqVehicles) {
      const multiVehiclesTag = `[MultiVehicles: ${JSON.stringify(reqVehicles)}]`;
      notesToUpdate = notesToUpdate.replace(/\[MultiVehicles:[\s\S]*?\]/g, '').trim();
      notesToUpdate = notesToUpdate ? `${notesToUpdate} ${multiVehiclesTag}` : multiVehiclesTag;
      dataToUpdate.adminNotes = notesToUpdate;
    }

    if (fullName !== undefined && fullName !== null && String(fullName).trim()) {
      try {
        await prisma.user.update({
          where: { id: session.userId },
          data: { fullName: String(fullName).trim() },
        });
      } catch (userErr) {
        console.warn('Could not update user fullName:', userErr);
      }
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

    if (reqVehicles && reqVehicles.length > 0) {
      for (let i = 0; i < reqVehicles.length; i++) {
        const vItem = reqVehicles[i];
        const vCategory = vItem.category || 'SEDAN';
        const vFuel = vItem.fuelType || 'DIESEL';
        const vPlate = vItem.plateNumber ? String(vItem.plateNumber).trim().toUpperCase() : 'PENDING';
        const vSeats = getSeatCountForCategory(vCategory);

        if (i < updatedDriver.vehicles.length) {
          await prisma.vehicle.update({
            where: { id: updatedDriver.vehicles[i].id },
            data: {
              category: vCategory,
              fuelType: vFuel,
              seatCount: vSeats,
              plateNumber: vPlate,
            },
          });
        } else {
          await prisma.vehicle.create({
            data: {
              driverId: session.driverId,
              category: vCategory,
              fuelType: vFuel,
              seatCount: vSeats,
              plateNumber: vPlate,
              baseFarePerKm: 14.0,
              extraKmRate: 14.0,
              driverAllowance: 300.0,
            },
          });
        }
      }
    } else if (updatedDriver.vehicles.length > 0) {
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
