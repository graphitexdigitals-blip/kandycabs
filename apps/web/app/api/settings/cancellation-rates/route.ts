import { NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  DEFAULT_CANCELLATION_CONFIG,
  CancellationRatesConfig,
  DEFAULT_TRIP_TYPE_CANCELLATION_RULES,
  SUPPORTED_TRIP_TYPES_FOR_CANCELLATION,
} from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

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

    const res = NextResponse.json({ success: true, config, supportedTripTypes: SUPPORTED_TRIP_TYPES_FOR_CANCELLATION });
    return setCorsHeaders(res);
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error fetching cancellation rates:', error);
    const res = NextResponse.json(
      { success: false, config: DEFAULT_CANCELLATION_CONFIG, error: error.message },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

