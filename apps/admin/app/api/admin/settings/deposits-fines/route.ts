import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  DEFAULT_DEPOSITS_AND_FINES_CONFIG,
  DepositsAndFinesConfig,
} from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let config: DepositsAndFinesConfig = { ...DEFAULT_DEPOSITS_AND_FINES_CONFIG };

    try {
      const rows = (await prisma.$queryRawUnsafe(`
        SELECT "value" FROM "SystemSetting" WHERE "key" = 'security_deposit_fine_settings' LIMIT 1;
      `)) as any[];

      if (rows && rows.length > 0 && rows[0].value) {
        const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;

        let mergedFineRules = Array.isArray(val.fineRules) && val.fineRules.length > 0
          ? [...val.fineRules]
          : [...DEFAULT_DEPOSITS_AND_FINES_CONFIG.fineRules];

        // Ensure newly added default fine rules (like BAD_CUSTOMER_FEEDBACK) exist in the list
        for (const defRule of DEFAULT_DEPOSITS_AND_FINES_CONFIG.fineRules) {
          if (!mergedFineRules.some((r) => r.code === defRule.code || r.id === defRule.id)) {
            mergedFineRules.push(defRule);
          }
        }

        config = {
          securityDeposit: {
            ...DEFAULT_DEPOSITS_AND_FINES_CONFIG.securityDeposit,
            ...(val.securityDeposit || {}),
            categoryOverrides: {
              ...DEFAULT_DEPOSITS_AND_FINES_CONFIG.securityDeposit.categoryOverrides,
              ...(val.securityDeposit?.categoryOverrides || {}),
            },
          },
          fineRules: mergedFineRules,
          autoDeductFromPayout: typeof val.autoDeductFromPayout === 'boolean'
            ? val.autoDeductFromPayout
            : DEFAULT_DEPOSITS_AND_FINES_CONFIG.autoDeductFromPayout,
          suspensionFineThreshold: typeof val.suspensionFineThreshold === 'number'
            ? val.suspensionFineThreshold
            : DEFAULT_DEPOSITS_AND_FINES_CONFIG.suspensionFineThreshold,
          updatedAt: val.updatedAt,
        };
      } else {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
          VALUES ('security_deposit_fine_settings', '${JSON.stringify(DEFAULT_DEPOSITS_AND_FINES_CONFIG)}'::jsonb, NOW())
          ON CONFLICT ("key") DO NOTHING;
        `);
      }
    } catch (dbErr) {
      console.warn('Could not query security_deposit_fine_settings:', dbErr);
    }

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error('Error fetching deposits & fines settings:', error);
    return NextResponse.json(
      { success: false, config: DEFAULT_DEPOSITS_AND_FINES_CONFIG, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const configToSave: DepositsAndFinesConfig = {
      securityDeposit: {
        enabled: Boolean(body.securityDeposit?.enabled ?? true),
        defaultAmount: Math.max(0, Number(body.securityDeposit?.defaultAmount || 5000)),
        minWalletThreshold: Math.max(0, Number(body.securityDeposit?.minWalletThreshold || 1000)),
        allowInstallmentDeduction: Boolean(body.securityDeposit?.allowInstallmentDeduction ?? true),
        installmentPercentage: Math.min(100, Math.max(1, Number(body.securityDeposit?.installmentPercentage || 10))),
        refundLockPeriodDays: Math.max(0, Number(body.securityDeposit?.refundLockPeriodDays || 30)),
        categoryOverrides: body.securityDeposit?.categoryOverrides || DEFAULT_DEPOSITS_AND_FINES_CONFIG.securityDeposit.categoryOverrides,
      },
      fineRules: Array.isArray(body.fineRules) ? body.fineRules : DEFAULT_DEPOSITS_AND_FINES_CONFIG.fineRules,
      autoDeductFromPayout: Boolean(body.autoDeductFromPayout ?? true),
      suspensionFineThreshold: Math.max(0, Number(body.suspensionFineThreshold || 2500)),
      updatedAt: new Date().toISOString(),
    };

    const serialized = JSON.stringify(configToSave).replace(/'/g, "''");

    await prisma.$executeRawUnsafe(`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES ('security_deposit_fine_settings', '${serialized}'::jsonb, NOW())
      ON CONFLICT ("key")
      DO UPDATE SET
        "value" = EXCLUDED."value",
        "updatedAt" = NOW();
    `);

    return NextResponse.json({ success: true, config: configToSave });
  } catch (error: any) {
    console.error('Error saving deposits & fines settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
