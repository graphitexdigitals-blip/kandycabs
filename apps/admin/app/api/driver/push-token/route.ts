import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

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

    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : null;

    if (!token) {
      const res = NextResponse.json(
        { success: false, message: 'Valid push token required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    await prisma.driver.update({
      where: { id: session.driverId },
      data: { pushToken: token },
    });

    const res = NextResponse.json({
      success: true,
      message: 'Push token registered successfully',
    });
    return setCorsHeaders(res);
  } catch (err: any) {
    console.error('[PushToken] Registration failed:', err);
    const res = NextResponse.json(
      { success: false, message: err?.message || 'Failed to register push token' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

