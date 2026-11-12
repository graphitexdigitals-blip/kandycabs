import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
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
      },
    });

    if (!driver) {
      const res = NextResponse.json({ error: 'Driver not found' }, { status: 404 });
      return setCorsHeaders(res);
    }

    let profileExtra: Record<string, any> = {};
    if (driver.adminNotes) {
      const profileMatch = driver.adminNotes.match(/\[ProfileExtra:\s*(\{.*?\})\]/);
      if (profileMatch && profileMatch[1]) {
        try {
          profileExtra = JSON.parse(profileMatch[1]);
        } catch {}
      }
    }

    const response = NextResponse.json({
      success: true,
      driver: {
        id: driver.id,
        userId: driver.userId,
        fullName: driver.user?.fullName || '',
        phone: driver.user?.phone || '',
        licenseNumber: driver.licenseNumber,
        profilePhotoUrl: driver.profilePhotoUrl,
        verificationStatus: driver.verificationStatus,
        emergencyContact: profileExtra.emergencyContact || profileExtra.altPhone || '',
        altPhone: profileExtra.altPhone || profileExtra.emergencyContact || '',
        email: profileExtra.email || '',
        experienceYears: profileExtra.experienceYears || '5',
        city: profileExtra.city || 'Mangaluru',
        address: profileExtra.address || '',
      },
    });
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in GET /api/driver/profile:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch driver profile' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

export async function PATCH(req: NextRequest) {
  return handleUpdateProfile(req);
}

export async function POST(req: NextRequest) {
  return handleUpdateProfile(req);
}

async function handleUpdateProfile(req: NextRequest) {
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
      profilePhotoUrl,
      licenseNumber,
      altPhone,
      emergencyContact,
      email,
      experienceYears,
      city,
      address,
    } = body;

    // 1. Update user full name
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

    // 2. Prepare driver data
    const driverUpdateData: any = {};

    if (profilePhotoUrl !== undefined && profilePhotoUrl !== null) {
      driverUpdateData.profilePhotoUrl = profilePhotoUrl;
    }

    if (licenseNumber !== undefined && licenseNumber !== null && String(licenseNumber).trim()) {
      driverUpdateData.licenseNumber = String(licenseNumber).trim().toUpperCase();
    }

    // 3. Update ProfileExtra inside adminNotes
    const currentDriver = await prisma.driver.findUnique({
      where: { id: session.driverId },
      select: { adminNotes: true },
    });

    let notesToUpdate = currentDriver?.adminNotes || '';
    let existingProfileExtra: Record<string, any> = {};

    const profileMatch = notesToUpdate.match(/\[ProfileExtra:\s*(\{.*?\})\]/);
    if (profileMatch && profileMatch[1]) {
      try {
        existingProfileExtra = JSON.parse(profileMatch[1]);
      } catch {}
    }

    const mergedProfileExtra = {
      ...existingProfileExtra,
      ...(altPhone !== undefined ? { altPhone: String(altPhone).trim() } : {}),
      ...(emergencyContact !== undefined ? { emergencyContact: String(emergencyContact).trim() } : {}),
      ...(email !== undefined ? { email: String(email).trim() } : {}),
      ...(experienceYears !== undefined ? { experienceYears: String(experienceYears).trim() } : {}),
      ...(city !== undefined ? { city: String(city).trim() } : {}),
      ...(address !== undefined ? { address: String(address).trim() } : {}),
    };

    const profileTag = `[ProfileExtra: ${JSON.stringify(mergedProfileExtra)}]`;
    notesToUpdate = notesToUpdate.replace(/\[ProfileExtra:[^\]]+\]/g, '').trim();
    notesToUpdate = notesToUpdate ? `${notesToUpdate} ${profileTag}` : profileTag;
    driverUpdateData.adminNotes = notesToUpdate;

    const updatedDriver = await prisma.driver.update({
      where: { id: session.driverId },
      data: driverUpdateData,
      include: {
        user: { select: { fullName: true, phone: true } },
      },
    });

    const response = NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      driver: {
        id: updatedDriver.id,
        fullName: updatedDriver.user?.fullName || '',
        phone: updatedDriver.user?.phone || '',
        licenseNumber: updatedDriver.licenseNumber,
        profilePhotoUrl: updatedDriver.profilePhotoUrl,
        verificationStatus: updatedDriver.verificationStatus,
        ...mergedProfileExtra,
      },
    });
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error updating driver profile:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to update profile' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

