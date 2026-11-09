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

const KNOWN_DRIVERS: Record<string, { fullName: string; plateNumber: string; category: string }> = {
  '9587425635': { fullName: 'Rakshith', plateNumber: 'KA 01 MJ 2023', category: 'SEDAN' },
  '9900447660': { fullName: 'Mohan Kumar', plateNumber: 'KA-01-SD-2045', category: 'SEDAN' },
  '9880933504': { fullName: 'Mohan', plateNumber: 'KA-01-SD-2045', category: 'SEDAN' },
  '8105536270': { fullName: 'Asha', plateNumber: 'KA-01-SD-2085', category: 'SEDAN' },
};

export async function getDriverSession(req: NextRequest): Promise<DriverSession | null> {
  // Mobile app Authorization header MUST take precedence over browser cookies
  let token: string | undefined;
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  if (!token) {
    token = req.cookies.get('kandy_session')?.value;
  }

  if (!token) {
    return null;
  }

  const now = Date.now();
  const cached = sessionCache.get(token);
  if (cached && now < cached.expiresAt) {
    return cached.session;
  }

  // 1. Support local dev mobile session tokens: driver_session_<phone>_<timestamp>
  if (token.startsWith('driver_session_')) {
    const parts = token.split('_');
    const phone = parts[2];
    if (phone) {
      const cleanPhone = phone.replace(/^\+91/, '').trim();
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: cleanPhone },
            { phone: `+91${cleanPhone}` },
            { phone: phone },
          ],
          deletedAt: null,
        },
        include: {
          driver: {
            include: {
              vehicles: { where: { deletedAt: null } },
            },
          },
        },
      });

      if (user && !user.driver) {
        const newDriver = await prisma.driver.create({
          data: {
            userId: user.id,
            licenseNumber: 'PENDING',
            verificationStatus: 'PENDING',
          },
          include: {
            vehicles: { where: { deletedAt: null } },
          },
        });
        user.driver = newDriver;
        if (!user.roles.includes(UserRole.DRIVER)) {
          await prisma.user.update({
            where: { id: user.id },
            data: { roles: Array.from(new Set([...user.roles, UserRole.DRIVER])) },
          });
        }
      }

      if (!user) {
        user = await prisma.user.create({
          data: {
            phone: `+91${cleanPhone}`,
            fullName: 'Driver Partner',
            roles: [UserRole.DRIVER],
            driver: {
              create: {
                licenseNumber: 'PENDING',
                verificationStatus: 'PENDING',
              },
            },
          },
          include: {
            driver: {
              include: {
                vehicles: { where: { deletedAt: null } },
              },
            },
          },
        });
      }

      // Auto-heal known driver identity and vehicle if unassigned or default placeholder
      const known = KNOWN_DRIVERS[cleanPhone];
      if (known && user) {
        if (!user.fullName || user.fullName === 'Driver Partner') {
          user.fullName = known.fullName;
          await prisma.user.update({
            where: { id: user.id },
            data: { fullName: known.fullName },
          }).catch(() => {});
        }
        if (user.driver) {
          if (user.driver.verificationStatus !== 'APPROVED') {
            user.driver.verificationStatus = 'APPROVED';
            await prisma.driver.update({
              where: { id: user.driver.id },
              data: { verificationStatus: 'APPROVED' },
            }).catch(() => {});
          }
          if (!user.driver.vehicles || user.driver.vehicles.length === 0) {
            const newVeh = await prisma.vehicle.create({
              data: {
                driver: { connect: { id: user.driver.id } },
                category: known.category as any,
                fuelType: 'PETROL',
                seatCount: 4,
                plateNumber: known.plateNumber,
                baseFarePerKm: 14.0,
                extraKmRate: 14.0,
                driverAllowance: 300.0,
              },
            }).catch(() => null);
            if (newVeh) {
              user.driver.vehicles = [newVeh];
            }
          }
        }
      }

      if (user && user.driver) {
        const session: DriverSession = {
          userId: user.id,
          driverId: user.driver.id,
          driver: user.driver,
          user,
        };
        sessionCache.set(token, { session, expiresAt: now + 15000 });
        return session;
      }
    }
  }

  // 2. Standard JWT Token Verification
  const payload = await verifyAuthToken(token);
  if (payload && payload.userId) {
    let user = await prisma.user.findUnique({
      where: { id: payload.userId, deletedAt: null },
      include: {
        driver: {
          include: {
            vehicles: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (user && !user.driver) {
      const newDriver = await prisma.driver.create({
        data: {
          userId: user.id,
          licenseNumber: 'PENDING',
          verificationStatus: 'PENDING',
        },
        include: {
          vehicles: { where: { deletedAt: null } },
        },
      });
      user.driver = newDriver;
      if (!user.roles.includes(UserRole.DRIVER)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { roles: Array.from(new Set([...user.roles, UserRole.DRIVER])) },
        });
      }
    }

    if (user && user.driver && !user.driver.deletedAt) {
      const session: DriverSession = {
        userId: user.id,
        driverId: user.driver.id,
        driver: user.driver,
        user,
      };
      sessionCache.set(token, { session, expiresAt: now + 15000 });
      return session;
    }
  }

  // 3. In dev mode, fallback to first active driver if token could not be resolved
  if (process.env.NODE_ENV !== 'production') {
    const fallbackUser = await prisma.user.findFirst({
      where: { driver: { isNot: null }, deletedAt: null },
      include: {
        driver: {
          include: {
            vehicles: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (fallbackUser && fallbackUser.driver) {
      const session: DriverSession = {
        userId: fallbackUser.id,
        driverId: fallbackUser.driver.id,
        driver: fallbackUser.driver,
        user: fallbackUser,
      };
      sessionCache.set(token, { session, expiresAt: now + 15000 });
      return session;
    }
  }

  sessionCache.set(token, { session: null, expiresAt: now + 10000 });
  return null;
}
