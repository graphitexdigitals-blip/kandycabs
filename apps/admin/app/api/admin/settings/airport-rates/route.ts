import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  DEFAULT_AIRPORT_ROUTES,
  DEFAULT_AIRPORT_FIXED_FARES,
  AirportRatesConfig,
} from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

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
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
          VALUES ('airport_city_rates', '${JSON.stringify(DEFAULT_CONFIG)}'::jsonb, NOW())
          ON CONFLICT ("key") DO NOTHING;
        `);
      }
    } catch (dbErr) {
      console.warn('Could not query airport_city_rates:', dbErr);
    }

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error('Error fetching airport rates config:', error);
    return NextResponse.json(
      { success: false, config: DEFAULT_CONFIG, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const routes = Array.isArray(body.routes) ? body.routes : DEFAULT_CONFIG.routes;
    const defaultFixedFares = body.defaultFixedFares && typeof body.defaultFixedFares === 'object'
      ? body.defaultFixedFares
      : DEFAULT_CONFIG.defaultFixedFares;
    const defaultThresholdKm = Number(body.defaultThresholdKm) || 35;

    const newConfig: AirportRatesConfig = {
      routes,
      defaultFixedFares,
      defaultThresholdKm,
      unlistedPricingMode: body.unlistedPricingMode === 'FIXED_FARE' ? 'FIXED_FARE' : 'PER_KM',
    };

    await prisma.$executeRawUnsafe(`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES ('airport_city_rates', '${JSON.stringify(newConfig)}'::jsonb, NOW())
      ON CONFLICT ("key") DO UPDATE
      SET "value" = '${JSON.stringify(newConfig)}'::jsonb, "updatedAt" = NOW();
    `);

    return NextResponse.json({ success: true, config: newConfig });
  } catch (error: any) {
    console.error('Error saving airport rates config:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save airport rates config' },
      { status: 500 }
    );
  }
}

