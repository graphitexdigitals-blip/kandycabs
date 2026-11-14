import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { DEFAULT_NIGHT_CHARGE_SETTINGS } from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let settings = { ...DEFAULT_NIGHT_CHARGE_SETTINGS };

    try {
      const rows = (await prisma.$queryRawUnsafe(`
        SELECT "value" FROM "SystemSetting" WHERE "key" = 'night_charge_settings' LIMIT 1;
      `)) as any[];

      if (rows && rows.length > 0 && rows[0].value) {
        const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        settings = {
          enabled: typeof val.enabled === 'boolean' ? val.enabled : DEFAULT_NIGHT_CHARGE_SETTINGS.enabled,
          applicableTripTypes: Array.isArray(val.applicableTripTypes) ? val.applicableTripTypes : DEFAULT_NIGHT_CHARGE_SETTINGS.applicableTripTypes,
        };
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
          VALUES ('night_charge_settings', '${JSON.stringify(DEFAULT_NIGHT_CHARGE_SETTINGS)}'::jsonb, NOW())
          ON CONFLICT ("key") DO NOTHING;
        `);
      }
    } catch (dbErr) {
      console.warn('Could not query night_charge_settings:', dbErr);
    }

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error('Error fetching night charge settings:', error);
    return NextResponse.json(
      { success: false, settings: DEFAULT_NIGHT_CHARGE_SETTINGS, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const enabled = Boolean(body.enabled !== false);
    const applicableTripTypes = Array.isArray(body.applicableTripTypes)
      ? body.applicableTripTypes
      : DEFAULT_NIGHT_CHARGE_SETTINGS.applicableTripTypes;

    const newSettings = { enabled, applicableTripTypes };

    await prisma.$executeRawUnsafe(`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES ('night_charge_settings', '${JSON.stringify(newSettings)}'::jsonb, NOW())
      ON CONFLICT ("key") DO UPDATE
      SET "value" = '${JSON.stringify(newSettings)}'::jsonb, "updatedAt" = NOW();
    `);

    return NextResponse.json({ success: true, settings: newSettings });
  } catch (error: any) {
    console.error('Error saving night charge settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save night charge settings' },
      { status: 500 }
    );
  }
}

