import { NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import {
  DEFAULT_AIRPORT_ROUTES,
  DEFAULT_AIRPORT_FIXED_FARES,
  AirportRatesConfig,
} from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

const DEFAULT_CONFIG: AirportRatesConfig = {
  routes: DEFAULT_AIRPORT_ROUTES,
  defaultFixedFares: DEFAULT_AIRPORT_FIXED_FARES,
  defaultThresholdKm: 35,
  unlistedPricingMode: 'PER_KM',
};

export async function GET() {
  try {
    let config = { ...DEFAULT_CONFIG };
    try {
      const rows = (await prisma.$queryRawUnsafe(`
        SELECT "value" FROM "SystemSetting" WHERE "key" = 'airport_city_rates' LIMIT 1;
      `)) as any[];

      if (rows && rows.length > 0 && rows[0].value) {
        const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        config = {
          routes: Array.isArray(val.routes) && val.routes.length > 0 ? val.routes : DEFAULT_CONFIG.routes,
          defaultFixedFares: val.defaultFixedFares && typeof val.defaultFixedFares === 'object' ? val.defaultFixedFares : DEFAULT_CONFIG.defaultFixedFares,
          defaultThresholdKm: typeof val.defaultThresholdKm === 'number' ? val.defaultThresholdKm : 35,
          unlistedPricingMode: val.unlistedPricingMode === 'FIXED_FARE' ? 'FIXED_FARE' : 'PER_KM',
        };
      }
    } catch {
      // fallback
    }
    const res = NextResponse.json({ success: true, config });
    return setCorsHeaders(res);
  } catch (error: any) {
    const res = NextResponse.json({ success: false, config: DEFAULT_CONFIG });
    return setCorsHeaders(res);
  }
}

