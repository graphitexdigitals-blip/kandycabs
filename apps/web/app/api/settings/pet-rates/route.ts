import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

const DEFAULT_PET_RATES = {
  cat: 200,
  dog: 500,
  bird: 100,
};

export async function OPTIONS() {
  return handleOptions();
}

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
      } else {
        // Seed default pet_rates row
        await prisma.$executeRawUnsafe(`
          INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
          VALUES ('pet_rates', '${JSON.stringify(DEFAULT_PET_RATES)}'::jsonb, NOW())
          ON CONFLICT ("key") DO NOTHING;
        `);
      }
    } catch (dbErr) {
      console.warn('Could not query SystemSetting, using default pet rates:', dbErr);
    }

    const res = NextResponse.json({ success: true, rates });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error fetching pet rates:', error);
    const res = NextResponse.json(
      { success: false, rates: DEFAULT_PET_RATES, error: error.message },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cat = Number(body.cat ?? DEFAULT_PET_RATES.cat);
    const dog = Number(body.dog ?? DEFAULT_PET_RATES.dog);
    const bird = Number(body.bird ?? DEFAULT_PET_RATES.bird);

    if (isNaN(cat) || isNaN(dog) || isNaN(bird) || cat < 0 || dog < 0 || bird < 0) {
      const res = NextResponse.json(
        { success: false, error: 'Rates must be positive numbers' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const newRates = { cat, dog, bird };
    const jsonStr = JSON.stringify(newRates);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES ('pet_rates', '${jsonStr}'::jsonb, NOW())
      ON CONFLICT ("key") DO UPDATE
      SET "value" = '${jsonStr}'::jsonb, "updatedAt" = NOW();
    `);

    const res = NextResponse.json({ success: true, rates: newRates });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error updating pet rates:', error);
    const res = NextResponse.json(
      { success: false, error: error.message || 'Failed to update pet rates' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

