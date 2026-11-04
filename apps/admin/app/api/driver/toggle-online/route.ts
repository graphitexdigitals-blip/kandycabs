import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { DriverVerificationStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getDriverSession(req);
    if (!session) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Driver authentication required' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const body = await req.json().catch(() => ({}));
    const newStatus = typeof body.onlineStatus === 'boolean' ? body.onlineStatus : !session.driver.onlineStatus;

    if (newStatus && session.driver.verificationStatus !== DriverVerificationStatus.APPROVED) {
      const res = NextResponse.json(
        {
          success: false,
          message: 'Your account is pending verification. You can only go On-Duty once approved by Admin.',
        },
        { status: 403 }
      );
      return setCorsHeaders(res);
    }

    const updatedDriver = await prisma.driver.update({
      where: { id: session.driverId },
      data: {
        onlineStatus: newStatus,
        lastPingAt: new Date(),
      },
    });

    const response = NextResponse.json(
      {
        success: true,
        onlineStatus: updatedDriver.onlineStatus,
        message: updatedDriver.onlineStatus ? 'You are now ON-DUTY' : 'You are now OFF-DUTY',
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in PATCH /api/driver/toggle-online:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to toggle status' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
