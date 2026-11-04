import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  BookingStatus,
  normalizePhoneNumber,
  VehicleCategory,
  FuelType,
} from '@kandy-cabs/shared';
import { getAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getSeatCountForCategory(cat: string) {
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
}

export async function PATCH(
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
    const body = await req.json();
    const {
      fullName,
      phone,
      licenseNumber,
      category,
      carModel,
      fuelType,
      carriageCapacity,
      plateNumber,
      payoutMethod,
      bankAccountHolderName,
      bankAccountNumber,
      bankIfsc,
      bankName,
      payoutUpiId,
      payoutPhone,
      payoutEmail,
      payoutStatus,
    } = body;

    const driver = await prisma.driver.findUnique({
      where: { id },
      include: {
        user: true,
        vehicles: { where: { deletedAt: null } },
      },
    });

    if (!driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // 1. Update User info (name & phone)
    if (fullName || phone) {
      const userData: any = {};
      if (fullName) userData.fullName = fullName.trim();
      if (phone) userData.phone = normalizePhoneNumber(phone);

      await prisma.user.update({
        where: { id: driver.userId },
        data: userData,
      });
    }

    // 2. Update Driver info (licenseNumber & adminNotes tags)
    const driverData: any = {};
    if (licenseNumber !== undefined && licenseNumber !== null) {
      driverData.licenseNumber = licenseNumber.trim().toUpperCase() || 'PENDING';
    }

    let notesToUpdate = driver.adminNotes || '';
    if (carModel !== undefined && carModel !== null) {
      notesToUpdate = notesToUpdate.replace(/\[Car Model:[^\]]+\]/g, '').trim();
      if (String(carModel).trim()) {
        const modelTag = `[Car Model: ${String(carModel).trim()}]`;
        notesToUpdate = notesToUpdate ? `${notesToUpdate} ${modelTag}` : modelTag;
      }
      driverData.adminNotes = notesToUpdate;
    }
    if (carriageCapacity !== undefined && carriageCapacity !== null) {
      const currentNotes = driverData.adminNotes !== undefined ? driverData.adminNotes : notesToUpdate;
      let cleaned = currentNotes.replace(/\[Luggage\/Carriage:[^\]]+\]/g, '').trim();
      if (String(carriageCapacity).trim() && !String(carriageCapacity).startsWith('None')) {
        const carriageTag = `[Luggage/Carriage: ${String(carriageCapacity).trim()}]`;
        cleaned = cleaned ? `${cleaned} ${carriageTag}` : carriageTag;
      }
      driverData.adminNotes = cleaned;
    }

    if (payoutMethod !== undefined) {
      driverData.payoutMethod = payoutMethod === 'UPI' ? 'UPI' : 'BANK';
    }
    if (bankAccountHolderName !== undefined) {
      driverData.bankAccountHolderName = bankAccountHolderName ? bankAccountHolderName.trim() : null;
    }
    if (bankAccountNumber !== undefined) {
      driverData.bankAccountNumber = bankAccountNumber ? bankAccountNumber.trim() : null;
    }
    if (bankIfsc !== undefined) {
      driverData.bankIfsc = bankIfsc ? bankIfsc.trim().toUpperCase() : null;
    }
    if (bankName !== undefined) {
      driverData.bankName = bankName ? bankName.trim() : null;
    }
    if (payoutUpiId !== undefined) {
      driverData.payoutUpiId = payoutUpiId ? payoutUpiId.trim() : null;
    }
    if (payoutPhone !== undefined) {
      driverData.payoutPhone = payoutPhone ? String(payoutPhone).trim() : null;
    }
    if (payoutEmail !== undefined) {
      driverData.payoutEmail = payoutEmail ? String(payoutEmail).trim() : null;
    }
    if (payoutStatus !== undefined) {
      driverData.payoutStatus = payoutStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING';
    }

    if (Object.keys(driverData).length > 0) {
      await prisma.driver.update({
        where: { id },
        data: driverData,
      });
    }

    // 3. Update or Create Vehicle specs
    const seatCount = category ? getSeatCountForCategory(category) : undefined;
    if (driver.vehicles.length > 0) {
      const vehicleId = driver.vehicles[0].id;
      const vehicleData: any = {};
      if (category) {
        vehicleData.category = category as VehicleCategory;
        vehicleData.seatCount = seatCount;
      }
      if (fuelType) vehicleData.fuelType = fuelType as FuelType;
      if (plateNumber !== undefined) {
        vehicleData.plateNumber = plateNumber ? plateNumber.trim().toUpperCase() : null;
      }

      if (Object.keys(vehicleData).length > 0) {
        await prisma.vehicle.update({
          where: { id: vehicleId },
          data: vehicleData,
        });
      }
    } else if (category || plateNumber || fuelType) {
      const selectedCategory = (category as VehicleCategory) || VehicleCategory.SEDAN;
      const selectedFuel = (fuelType as FuelType) || FuelType.DIESEL;
      await prisma.vehicle.create({
        data: {
          driverId: id,
          category: selectedCategory,
          fuelType: selectedFuel,
          seatCount: seatCount || getSeatCountForCategory(selectedCategory),
          plateNumber: plateNumber?.trim() ? plateNumber.trim().toUpperCase() : null,
          baseFarePerKm: 14.0,
          extraKmRate: 14.0,
          driverAllowance: 300.0,
        },
      });
    }

    // Return updated driver
    const updated = await prisma.driver.findUnique({
      where: { id },
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

    return NextResponse.json({
      success: true,
      message: 'Driver and vehicle details updated successfully',
      driver: {
        driverId: updated!.id,
        userId: updated!.userId,
        fullName: updated!.user.fullName,
        phone: updated!.user.phone,
        licenseNumber: updated!.licenseNumber,
        profilePhotoUrl: updated!.profilePhotoUrl,
        licenseDocUrl: updated!.licenseDocUrl,
        rcDocUrl: updated!.rcDocUrl,
        insuranceDocUrl: updated!.insuranceDocUrl,
        vehiclePhotos: updated!.vehiclePhotos || [],
        verificationStatus: updated!.verificationStatus,
        adminNotes: updated!.adminNotes,
        onlineStatus: updated!.onlineStatus,
        payoutMethod: updated!.payoutMethod || 'BANK',
        bankAccountHolderName: updated!.bankAccountHolderName || null,
        bankAccountNumber: updated!.bankAccountNumber || null,
        bankIfsc: updated!.bankIfsc || null,
        bankName: updated!.bankName || null,
        payoutUpiId: updated!.payoutUpiId || null,
        payoutPhone: updated!.payoutPhone || null,
        payoutEmail: updated!.payoutEmail || null,
        payoutStatus: updated!.payoutStatus || 'PENDING',
        vehicle: updated!.vehicles[0] || null,
        createdAt: updated!.user.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error updating driver:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update driver' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const driver = await prisma.driver.findUnique({
      where: { id },
      include: {
        user: true,
        assignedBookings: {
          where: {
            deletedAt: null,
            status: {
              in: [
                BookingStatus.DRIVER_ACCEPTED,
                BookingStatus.DRIVER_EN_ROUTE,
                BookingStatus.TRIP_STARTED,
              ],
            },
          },
        },
      },
    });

    if (!driver) {
      return NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
    }

    // Check if driver is on an active trip
    if (driver.assignedBookings && driver.assignedBookings.length > 0) {
      const activeRef = driver.assignedBookings[0].humanReadableRef;
      return NextResponse.json(
        {
          error: `Cannot delete driver while trip ${activeRef} is currently in progress. Please complete or reassign the trip first.`,
        },
        { status: 400 }
      );
    }

    // 1. Expire or delete all pending/active dispatches for this driver
    await prisma.bookingDispatch.deleteMany({
      where: { driverId: id },
    });

    // 2. Unassign / soft delete vehicle
    await prisma.vehicle.updateMany({
      where: { driverId: id },
      data: {
        driverId: null,
        deletedAt: new Date(),
      },
    });

    // 3. Clear assignedDriverId on any non-completed bookings to prevent lockups
    await prisma.booking.updateMany({
      where: {
        assignedDriverId: id,
        status: {
          in: [BookingStatus.PENDING_ADMIN, BookingStatus.DISPATCHED],
        },
      },
      data: {
        assignedDriverId: null,
      },
    });

    // 4. Try hard delete; if foreign key references past completed bookings, soft delete
    try {
      await prisma.driver.delete({
        where: { id },
      });
      // If user has no other customer role or records, delete user
      if (driver.userId) {
        try {
          await prisma.user.delete({
            where: { id: driver.userId },
          });
        } catch (_) {
          // Ignore if user has other dependencies
        }
      }
    } catch (_) {
      // Fallback: Soft delete driver
      await prisma.driver.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          onlineStatus: false,
          currentLat: null,
          currentLng: null,
        },
      });
      if (driver.userId) {
        await prisma.user.update({
          where: { id: driver.userId },
          data: {
            deletedAt: new Date(),
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: `Driver ${driver.user?.fullName || ''} deleted successfully.`,
    });
  } catch (error: any) {
    console.error('Error deleting driver:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete driver' },
      { status: 500 }
    );
  }
}
