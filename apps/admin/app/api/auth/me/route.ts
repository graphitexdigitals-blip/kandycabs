import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, UserRole } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { isSessionSuperceded } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    // 1. Resolve token from cookie first, then Bearer header
    let token = req.cookies.get('kandy_session')?.value;

    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'No session or authentication token provided' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    // 2. Verify JWT token or dev/offline token
    let payload = await verifyAuthToken(token);
    if ((!payload || !payload.userId) && token.startsWith('token-')) {
      const phoneDigits = token.replace('token-', '').replace(/\D/g, '').slice(-10);
      const matchedUser = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: `+91${phoneDigits}` },
            { phone: phoneDigits },
            { phone: { contains: phoneDigits } },
          ],
        },
      });
      if (matchedUser) {
        payload = {
          userId: matchedUser.id,
          phone: matchedUser.phone,
          roles: matchedUser.roles as any,
        };
      }
    }

    if (!payload || !payload.userId) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired authentication token' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    // 3. Always query DB directly — never any cached/in-memory user object
    const user = await prisma.user.findUnique({
      where: {
        id: payload.userId,
        deletedAt: null,
      },
      include: {
        customer: {
          where: { deletedAt: null },
        },
        driver: {
          where: { deletedAt: null },
        },
      },
    });

    if (!user) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'User account not found or deactivated' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    if (isSessionSuperceded(payload, user)) {
      const res = NextResponse.json(
        {
          error: 'SESSION_TERMINATED',
          code: 'SESSION_TERMINATED',
          message: 'You have been logged out because this account was logged into another device. Please log in again.',
        },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const cleanFullName = user.fullName === 'Kandy Customer' ? '' : (user.fullName || '');

    const userProfile = {
      id: user.id,
      phone: user.phone,
      fullName: cleanFullName,
      preferredLanguage: ((user.customer?.savedAddresses as any)?.preferredLanguage) || null,
      roles: user.roles as UserRole[],
      createdAt: user.createdAt,
      customer: user.customer
        ? {
            id: user.customer.id,
            email: user.customer.email,
            savedAddresses: user.customer.savedAddresses,
          }
        : null,
      driver: user.driver
        ? {
            id: user.driver.id,
            licenseNumber: user.driver.licenseNumber,
            verificationStatus: user.driver.verificationStatus,
            onlineStatus: user.driver.onlineStatus,
            currentLat: user.driver.currentLat,
            currentLng: user.driver.currentLng,
          }
        : null,
    };

    const res = NextResponse.json({ user: userProfile }, { status: 200 });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in GET /api/auth/me:', error);
    const res = NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to resolve user session' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
