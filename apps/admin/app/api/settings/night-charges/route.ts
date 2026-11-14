import { NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import { DEFAULT_NIGHT_CHARGE_SETTINGS } from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

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
      }
    } catch {
      // fallback
    }
    const res = NextResponse.json({ success: true, settings });
    return setCorsHeaders(res);
  } catch (error: any) {
    const res = NextResponse.json({ success: false, settings: DEFAULT_NIGHT_CHARGE_SETTINGS });
    return setCorsHeaders(res);
  }
}

