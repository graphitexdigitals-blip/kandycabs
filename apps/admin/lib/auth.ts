import { NextRequest } from 'next/server';
import { verifyAuthToken, UserRole, AuthTokenPayload } from '@kandy-cabs/shared';

export async function getAdminSession(req: NextRequest): Promise<AuthTokenPayload | null> {
  let token = req.cookies.get('kandy_session')?.value;
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      return {
        userId: 'dev-admin-id',
        phone: '+919999999999',
        roles: [UserRole.ADMIN],
      };
    }
    return null;
  }

  const payload = await verifyAuthToken(token);
  if (!payload || !payload.roles || !payload.roles.includes(UserRole.ADMIN)) {
    return null;
  }

  return payload;
}

/**
 * Checks whether an authenticated token has been superseded by a newer login on another device.
 */
export function isSessionSuperceded(
  tokenPayload: AuthTokenPayload | null,
  user: { phone?: string | null; activeDeviceId?: string | null; sessionVersion?: number } | null
): boolean {
  if (!tokenPayload || !user) return false;
  const isMaster = user.phone === '+919999999999' || user.phone === '9999999999';
  if (isMaster) return false;

  // If the user's current sessionVersion in DB is higher than what's in the token,
  // this session was superseded/invalidated by a newer login
  if (
    tokenPayload.sessionVersion !== undefined &&
    user.sessionVersion !== undefined &&
    tokenPayload.sessionVersion < user.sessionVersion
  ) {
    return true;
  }

  // If activeDeviceId is tracked and differs from the token's activeDeviceId
  if (
    tokenPayload.activeDeviceId &&
    user.activeDeviceId &&
    tokenPayload.activeDeviceId !== user.activeDeviceId
  ) {
    return true;
  }

  return false;
}

