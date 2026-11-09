import { NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

const DEFAULT_PET_RATES = {
  cat: 200,
  dog: 500,
  bird: 100,
};

export async function GET() {
  try {
    let rates = { ...DEFAULT_PET_RATES };
    try {
      const rows = (await prisma.$queryRawUnsafe(`
        SELECT "value" FROM "SystemSetting" WHERE "key" = 'pet_rates' LIMIT 1;
      `)) as any[];

      if (rows && rows.length > 0 && rows[0].value) {
        const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        rates = {
          cat: typeof val.cat === 'number' ? val.cat : DEFAULT_PET_RATES.cat,
          dog: typeof val.dog === 'number' ? val.dog : DEFAULT_PET_RATES.dog,
          bird: typeof val.bird === 'number' ? val.bird : DEFAULT_PET_RATES.bird,
        };
      }
    } catch (e) {
      // fallback to defaults
    }
    const res = NextResponse.json({ success: true, rates });
    return setCorsHeaders(res);
  } catch (error: any) {
    const res = NextResponse.json({ success: false, rates: DEFAULT_PET_RATES });
    return setCorsHeaders(res);
  }
}
