import { NextRequest } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, UserRole } from '@kandy-cabs/shared';

export interface DriverSession {
  userId: string;
  driverId: string;
  driver: any;
  user: any;
}

// In-memory short-lived session cache (15s TTL) to prevent hammering Supabase on rapid pings/polls
const sessionCache = new Map<string, { session: DriverSession | null; expiresAt: number }>();

export async function getDriverSession(req: NextRequest): Promise<DriverSession | null> {
  let token = req.cookies.get('kandy_session')?.value;
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) return null;

  const now = Date.now();
  const cached = sessionCache.get(token);
  if (cached && now < cached.expiresAt) {
    return cached.session;
  }

  const payload = await verifyAuthToken(token);
  if (!payload || !payload.userId) {
    sessionCache.set(token, { session: null, expiresAt: now + 10000 });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId, deletedAt: null },
    include: {
      driver: {
        include: {
          vehicles: { where: { deletedAt: null } },
        },
      },
    },
  });

  if (!user || !user.driver || user.driver.deletedAt) {
    sessionCache.set(token, { session: null, expiresAt: now + 10000 });
    return null;
  }

  const session: DriverSession = {
    userId: user.id,
    driverId: user.driver.id,
    driver: user.driver,
    user,
  };

  sessionCache.set(token, { session, expiresAt: now + 15000 });
  return session;
}
