import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  DEFAULT_CANCELLATION_CONFIG,
  CancellationRatesConfig,
  DEFAULT_TRIP_TYPE_CANCELLATION_RULES,
  SUPPORTED_TRIP_TYPES_FOR_CANCELLATION,
} from '@kandy-cabs/shared';
import { getAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let config: CancellationRatesConfig = {
      ...DEFAULT_CANCELLATION_CONFIG,
      rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
      tripTypeRules: { ...DEFAULT_TRIP_TYPE_CANCELLATION_RULES },
    };

    try {
      const rows = (await prisma.$queryRawUnsafe(`
        SELECT "value" FROM "SystemSetting" WHERE "key" = 'cancellation_charges' LIMIT 1;
      `)) as any[];

      if (rows && rows.length > 0 && rows[0].value) {
        const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        config = {
          windowHours: typeof val.windowHours === 'number' ? val.windowHours : DEFAULT_CANCELLATION_CONFIG.windowHours,
          rates: {
            ...DEFAULT_CANCELLATION_CONFIG.rates,
            ...(val.rates || {}),
          },
          tripTypeRules: {
            ...DEFAULT_TRIP_TYPE_CANCELLATION_RULES,
            ...(val.tripTypeRules || {}),
          },
        };
      }
    } catch (dbErr) {
      console.warn('Could not query SystemSetting, using default cancellation rates:', dbErr);
    }

    return NextResponse.json({ success: true, config, supportedTripTypes: SUPPORTED_TRIP_TYPES_FOR_CANCELLATION });
  } catch (error: any) {
    console.error('Error fetching admin cancellation rates:', error);
    return NextResponse.json(
      { success: false, config: DEFAULT_CANCELLATION_CONFIG, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    const body = await req.json();

    const windowHours = Number(body.windowHours ?? DEFAULT_CANCELLATION_CONFIG.windowHours);
    const inputRates = body.rates || {};

    const updatedRates: Record<string, number> = {
      ...DEFAULT_CANCELLATION_CONFIG.rates,
    };

    for (const [k, v] of Object.entries(inputRates)) {
      const num = Number(v);
      if (!isNaN(num) && num >= 0) {
        updatedRates[k] = num;
      }
    }

    const inputTripTypeRules = body.tripTypeRules || {};
    const updatedTripTypeRules: Record<string, any> = { ...DEFAULT_TRIP_TYPE_CANCELLATION_RULES };

    for (const trip of SUPPORTED_TRIP_TYPES_FOR_CANCELLATION) {
      const existing = inputTripTypeRules[trip.key] || DEFAULT_TRIP_TYPE_CANCELLATION_RULES[trip.key];
      const tripRates: Record<string, number> = {
        ...DEFAULT_CANCELLATION_CONFIG.rates,
        ...(existing?.rates || {}),
      };

      updatedTripTypeRules[trip.key] = {
        enabled: typeof existing?.enabled === 'boolean' ? existing.enabled : true,
        windowHours: typeof existing?.windowHours === 'number' && existing.windowHours >= 0 ? existing.windowHours : windowHours,
        rates: tripRates,
      };
    }

    const newConfig: CancellationRatesConfig = {
      windowHours: isNaN(windowHours) || windowHours < 0 ? 3 : windowHours,
      rates: updatedRates,
      tripTypeRules: updatedTripTypeRules,
    };

    const jsonStr = JSON.stringify(newConfig);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES ('cancellation_charges', '${jsonStr}'::jsonb, NOW())
      ON CONFLICT ("key") DO UPDATE
      SET "value" = '${jsonStr}'::jsonb, "updatedAt" = NOW();
    `);

    // Audit Log for rate changes
    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: session?.userId || null,
          action: 'CANCELLATION_CHARGES_UPDATED',
          entityType: 'SystemSetting',
          entityId: 'cancellation_charges',
          reason: `Updated cancellation charges across trip types & fleets: window=${newConfig.windowHours}hrs`,
        },
      });
    } catch (e) {
      console.warn('Could not create audit log:', e);
    }

    return NextResponse.json({ success: true, config: newConfig });
  } catch (error: any) {
    console.error('Error updating admin cancellation rates:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update cancellation rates' },
      { status: 500 }
    );
  }
}

