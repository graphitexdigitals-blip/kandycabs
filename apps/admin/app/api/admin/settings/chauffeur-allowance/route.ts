import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG,
  ChauffeurAllowanceConfig,
} from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let settings: ChauffeurAllowanceConfig = { ...DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG };

    try {
      const rows = (await prisma.$queryRawUnsafe(`
        SELECT "value" FROM "SystemSetting" WHERE "key" = 'chauffeur_allowance_settings' LIMIT 1;
      `)) as any[];

      if (rows && rows.length > 0 && rows[0].value) {
        const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        settings = {
          enabled: typeof val.enabled === 'boolean' ? val.enabled : DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG.enabled,
          dayWindowStartHour: typeof val.dayWindowStartHour === 'number' ? val.dayWindowStartHour : DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG.dayWindowStartHour,
          dayWindowEndHour: typeof val.dayWindowEndHour === 'number' ? val.dayWindowEndHour : DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG.dayWindowEndHour,
          nightWindowStartHour: typeof val.nightWindowStartHour === 'number' ? val.nightWindowStartHour : DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG.nightWindowStartHour,
          nightWindowEndHour: typeof val.nightWindowEndHour === 'number' ? val.nightWindowEndHour : DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG.nightWindowEndHour,
          fleetRates: {
            ...DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG.fleetRates,
            ...(val.fleetRates || {}),
          },
          rules: {
            ...DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG.rules,
            ...(val.rules || {}),
          },
        };
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
          VALUES ('chauffeur_allowance_settings', '${JSON.stringify(DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG)}'::jsonb, NOW())
          ON CONFLICT ("key") DO NOTHING;
        `);
      }
    } catch (dbErr) {
      console.warn('Could not query chauffeur_allowance_settings:', dbErr);
    }

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error('Error fetching chauffeur allowance settings:', error);
    return NextResponse.json(
      { success: false, settings: DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const newSettings: ChauffeurAllowanceConfig = {
      enabled: Boolean(body.enabled !== false),
      dayWindowStartHour: typeof body.dayWindowStartHour === 'number' ? body.dayWindowStartHour : 6,
      dayWindowEndHour: typeof body.dayWindowEndHour === 'number' ? body.dayWindowEndHour : 20,
      nightWindowStartHour: typeof body.nightWindowStartHour === 'number' ? body.nightWindowStartHour : 20,
      nightWindowEndHour: typeof body.nightWindowEndHour === 'number' ? body.nightWindowEndHour : 6,
      fleetRates: {
        ...DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG.fleetRates,
        ...(body.fleetRates || {}),
      },
      rules: {
        ...DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG.rules,
        ...(body.rules || {}),
      },
    };

    const serialized = JSON.stringify(newSettings).replace(/'/g, "''");

    await prisma.$executeRawUnsafe(`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES ('chauffeur_allowance_settings', '${serialized}'::jsonb, NOW())
      ON CONFLICT ("key") DO UPDATE
      SET "value" = '${serialized}'::jsonb, "updatedAt" = NOW();
    `);

    return NextResponse.json({ success: true, settings: newSettings });
  } catch (error: any) {
    console.error('Error saving chauffeur allowance settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save chauffeur allowance settings' },
      { status: 500 }
    );
  }
}
