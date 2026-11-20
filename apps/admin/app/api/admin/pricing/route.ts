import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { VehicleCategory, TripType, FuelType, VEHICLE_RATES } from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const tripType = searchParams.get('tripType');

    const whereClause: any = {};
    if (category && category !== 'ALL') whereClause.category = category;
    if (tripType && tripType !== 'ALL') whereClause.tripType = tripType;

    let rules = await prisma.pricingRule.findMany({
      where: whereClause,
      orderBy: [{ category: 'asc' }, { tripType: 'asc' }],
    });

    const allRegisteredCategories = [
      VehicleCategory.HATCHBACK,
      VehicleCategory.SWIFT_DZIRE,
      VehicleCategory.TOYOTA_ETIOS,
      VehicleCategory.SUV_ERTIGA,
      VehicleCategory.SUV_CARENS,
      VehicleCategory.SUV_INNOVA,
      VehicleCategory.SUV_CRYSTA,
      VehicleCategory.TEMPO_TRAVELER,
      VehicleCategory.URBANIA,
      VehicleCategory.SEDAN,
      VehicleCategory.SUV,
      VehicleCategory.SUV_PREMIUM,
    ];
    const tripTypes = [
      TripType.ONEWAY,
      TripType.ROUND,
      TripType.AIRPORT,
      TripType.LOCAL,
      TripType.PACKAGE,
    ];
    const fuelTypes = [FuelType.DIESEL, FuelType.PETROL, FuelType.CNG];

    // Check if any registered categories are missing from the table
    const existingCats = await prisma.pricingRule.findMany({
      select: { category: true },
      distinct: ['category'],
    });
    const existingCatSet = new Set(existingCats.map((c) => c.category));
    const missingCats = allRegisteredCategories.filter((cat) => !existingCatSet.has(cat));

    if (missingCats.length > 0) {
      const defaultRules: any[] = [];
      for (const cat of missingCats) {
        const conf = VEHICLE_RATES[cat] || VEHICLE_RATES[VehicleCategory.SEDAN];
        for (const tt of tripTypes) {
          for (const ft of fuelTypes) {
            defaultRules.push({
              category: cat,
              tripType: tt,
              fuelType: ft,
              baseRatePerKm: conf.perKmRate[ft] || conf.perKmRate[FuelType.DIESEL] || 14.0,
              extraKmRate: conf.extraKmRate,
              driverAllowance: conf.driverAllowancePerDay,
              nightCharge: conf.nightCharge,
              gstRatePercent: 5.0,
              nightWindowStartHour: 22,
              nightWindowEndHour: 6,
              inclusions: ['Fuel charges', 'Driver fee', 'Standard GST'],
              exclusions: ['Tolls and parking', 'Inter-state permit taxes'],
              isActive: true,
            });
          }
        }
      }

      await prisma.pricingRule.createMany({
        data: defaultRules,
        skipDuplicates: true,
      });

      rules = await prisma.pricingRule.findMany({
        where: whereClause,
        orderBy: [{ category: 'asc' }, { tripType: 'asc' }],
      });
    }

    // Fetch driver pricing settings from SystemSetting
    const driverRulesSetting = await prisma.systemSetting.findUnique({
      where: { key: 'driver_pricing_rules' },
    }).catch(() => null);
    const driverRulesMap: Record<string, any> = (driverRulesSetting?.value as any) || {};

    const formatted = rules.map((r) => {
      const ruleKey = `${r.category}_${r.tripType}_${r.fuelType}`;
      const dRule = driverRulesMap[ruleKey] || {};
      const baseKm = Number(r.baseRatePerKm);
      const extraKm = Number(r.extraKmRate);

      return {
        id: r.id,
        category: r.category,
        tripType: r.tripType,
        fuelType: r.fuelType,
        baseRatePerKm: baseKm,
        extraKmRate: extraKm,
        extraKmThreshold: r.extraKmThreshold !== null && r.extraKmThreshold !== undefined ? Number(r.extraKmThreshold) : null,
        driverAllowance: Number(r.driverAllowance),
        nightCharge: Number(r.nightCharge),
        gstRatePercent: Number(r.gstRatePercent),
        nightWindowStartHour: r.nightWindowStartHour,
        nightWindowEndHour: r.nightWindowEndHour,
        // Driver Specific Payout Rates
        driverBaseRatePerKm: dRule.driverBaseRatePerKm !== undefined && dRule.driverBaseRatePerKm !== null
          ? Number(dRule.driverBaseRatePerKm)
          : Math.max(8, Math.round(baseKm * 0.77 * 10) / 10),
        driverExtraKmRate: dRule.driverExtraKmRate !== undefined && dRule.driverExtraKmRate !== null
          ? Number(dRule.driverExtraKmRate)
          : Math.max(8, Math.round(extraKm * 0.77 * 10) / 10),
        driverAllowanceDaily: dRule.driverAllowanceDaily !== undefined && dRule.driverAllowanceDaily !== null
          ? Number(dRule.driverAllowanceDaily)
          : Number(r.driverAllowance),
        driverNightCharge: dRule.driverNightCharge !== undefined && dRule.driverNightCharge !== null
          ? Number(dRule.driverNightCharge)
          : Math.round(Number(r.nightCharge) * 0.8),
        localPackage4hrBase: r.localPackage4hrBase !== null && r.localPackage4hrBase !== undefined ? Number(r.localPackage4hrBase) : null,
        localPackage4hrKm: r.localPackage4hrKm !== null && r.localPackage4hrKm !== undefined ? Number(r.localPackage4hrKm) : null,
        localPackage4hrExtraKmRate: r.localPackage4hrExtraKmRate !== null && r.localPackage4hrExtraKmRate !== undefined ? Number(r.localPackage4hrExtraKmRate) : Number(r.extraKmRate),
        localPackage8hrBase: r.localPackage8hrBase !== null && r.localPackage8hrBase !== undefined ? Number(r.localPackage8hrBase) : null,
        localPackage8hrKm: r.localPackage8hrKm !== null && r.localPackage8hrKm !== undefined ? Number(r.localPackage8hrKm) : null,
        localPackage8hrExtraKmRate: r.localPackage8hrExtraKmRate !== null && r.localPackage8hrExtraKmRate !== undefined ? Number(r.localPackage8hrExtraKmRate) : Number(r.extraKmRate),
        localPackage12hrBase: r.localPackage12hrBase !== null && r.localPackage12hrBase !== undefined ? Number(r.localPackage12hrBase) : null,
        localPackage12hrKm: r.localPackage12hrKm !== null && r.localPackage12hrKm !== undefined ? Number(r.localPackage12hrKm) : null,
        localPackage12hrExtraKmRate: r.localPackage12hrExtraKmRate !== null && r.localPackage12hrExtraKmRate !== undefined ? Number(r.localPackage12hrExtraKmRate) : Number(r.extraKmRate),
        extraHourRate: r.extraHourRate !== null && r.extraHourRate !== undefined ? Number(r.extraHourRate) : null,
        inclusions: r.inclusions,
        exclusions: r.exclusions,
        isActive: r.isActive,
      };
    });

    return NextResponse.json({ success: true, rules: formatted });
  } catch (error: any) {
    console.error('Error in GET /api/admin/pricing:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch pricing rules' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      category,
      tripType,
      fuelType,
      baseRatePerKm,
      extraKmRate,
      extraKmThreshold,
      driverAllowance,
      nightCharge,
      gstRatePercent = 5.0,
      nightWindowStartHour = 22,
      nightWindowEndHour = 6,
      driverBaseRatePerKm,
      driverExtraKmRate,
      driverAllowanceDaily,
      driverNightCharge,
      localPackage4hrBase,
      localPackage4hrKm,
      localPackage4hrExtraKmRate,
      localPackage8hrBase,
      localPackage8hrKm,
      localPackage8hrExtraKmRate,
      localPackage12hrBase,
      localPackage12hrKm,
      localPackage12hrExtraKmRate,
      extraHourRate,
      inclusions = [],
      exclusions = [],
      isActive = true,
    } = body;

    const parsedThreshold = extraKmThreshold !== undefined && extraKmThreshold !== null && extraKmThreshold !== '' && !isNaN(Number(extraKmThreshold)) && Number(extraKmThreshold) > 0
      ? Number(extraKmThreshold)
      : null;

    const rule = await prisma.pricingRule.upsert({
      where: {
        category_tripType_fuelType: {
          category,
          tripType,
          fuelType,
        },
      },
      update: {
        baseRatePerKm,
        extraKmRate: Number(extraKmRate || localPackage8hrExtraKmRate || 13),
        extraKmThreshold: parsedThreshold,
        driverAllowance,
        nightCharge,
        gstRatePercent,
        nightWindowStartHour: Number(nightWindowStartHour),
        nightWindowEndHour: Number(nightWindowEndHour),
        localPackage4hrBase: localPackage4hrBase !== undefined && localPackage4hrBase !== null && localPackage4hrBase !== '' ? Number(localPackage4hrBase) : null,
        localPackage4hrKm: localPackage4hrKm !== undefined && localPackage4hrKm !== null && localPackage4hrKm !== '' ? Number(localPackage4hrKm) : null,
        localPackage4hrExtraKmRate: localPackage4hrExtraKmRate !== undefined && localPackage4hrExtraKmRate !== null && localPackage4hrExtraKmRate !== '' ? Number(localPackage4hrExtraKmRate) : null,
        localPackage8hrBase: localPackage8hrBase !== undefined && localPackage8hrBase !== null && localPackage8hrBase !== '' ? Number(localPackage8hrBase) : null,
        localPackage8hrKm: localPackage8hrKm !== undefined && localPackage8hrKm !== null && localPackage8hrKm !== '' ? Number(localPackage8hrKm) : null,
        localPackage8hrExtraKmRate: localPackage8hrExtraKmRate !== undefined && localPackage8hrExtraKmRate !== null && localPackage8hrExtraKmRate !== '' ? Number(localPackage8hrExtraKmRate) : null,
        localPackage12hrBase: localPackage12hrBase !== undefined && localPackage12hrBase !== null && localPackage12hrBase !== '' ? Number(localPackage12hrBase) : null,
        localPackage12hrKm: localPackage12hrKm !== undefined && localPackage12hrKm !== null && localPackage12hrKm !== '' ? Number(localPackage12hrKm) : null,
        localPackage12hrExtraKmRate: localPackage12hrExtraKmRate !== undefined && localPackage12hrExtraKmRate !== null && localPackage12hrExtraKmRate !== '' ? Number(localPackage12hrExtraKmRate) : null,
        extraHourRate: extraHourRate !== undefined && extraHourRate !== null && extraHourRate !== '' ? Number(extraHourRate) : null,
        inclusions,
        exclusions,
        isActive,
      },
      create: {
        category,
        tripType,
        fuelType,
        baseRatePerKm,
        extraKmRate: Number(extraKmRate || localPackage8hrExtraKmRate || 13),
        extraKmThreshold: parsedThreshold,
        driverAllowance,
        nightCharge,
        gstRatePercent,
        nightWindowStartHour: Number(nightWindowStartHour),
        nightWindowEndHour: Number(nightWindowEndHour),
        localPackage4hrBase: localPackage4hrBase !== undefined && localPackage4hrBase !== null && localPackage4hrBase !== '' ? Number(localPackage4hrBase) : null,
        localPackage4hrKm: localPackage4hrKm !== undefined && localPackage4hrKm !== null && localPackage4hrKm !== '' ? Number(localPackage4hrKm) : null,
        localPackage4hrExtraKmRate: localPackage4hrExtraKmRate !== undefined && localPackage4hrExtraKmRate !== null && localPackage4hrExtraKmRate !== '' ? Number(localPackage4hrExtraKmRate) : null,
        localPackage8hrBase: localPackage8hrBase !== undefined && localPackage8hrBase !== null && localPackage8hrBase !== '' ? Number(localPackage8hrBase) : null,
        localPackage8hrKm: localPackage8hrKm !== undefined && localPackage8hrKm !== null && localPackage8hrKm !== '' ? Number(localPackage8hrKm) : null,
        localPackage8hrExtraKmRate: localPackage8hrExtraKmRate !== undefined && localPackage8hrExtraKmRate !== null && localPackage8hrExtraKmRate !== '' ? Number(localPackage8hrExtraKmRate) : null,
        localPackage12hrBase: localPackage12hrBase !== undefined && localPackage12hrBase !== null && localPackage12hrBase !== '' ? Number(localPackage12hrBase) : null,
        localPackage12hrKm: localPackage12hrKm !== undefined && localPackage12hrKm !== null && localPackage12hrKm !== '' ? Number(localPackage12hrKm) : null,
        localPackage12hrExtraKmRate: localPackage12hrExtraKmRate !== undefined && localPackage12hrExtraKmRate !== null && localPackage12hrExtraKmRate !== '' ? Number(localPackage12hrExtraKmRate) : null,
        extraHourRate: extraHourRate !== undefined && extraHourRate !== null && extraHourRate !== '' ? Number(extraHourRate) : null,
        inclusions,
        exclusions,
        isActive,
      },
    });

    // Upsert driver pricing rule into SystemSetting
    const ruleKey = `${category}_${tripType}_${fuelType}`;
    let savedDriverRule: any = {};
    try {
      const existingSetting = await prisma.systemSetting.findUnique({
        where: { key: 'driver_pricing_rules' },
      }).catch(() => null);
      const driverRulesMap = (existingSetting?.value as any) || {};

      savedDriverRule = {
        driverBaseRatePerKm: driverBaseRatePerKm !== undefined && driverBaseRatePerKm !== null && driverBaseRatePerKm !== '' ? Number(driverBaseRatePerKm) : (driverRulesMap[ruleKey]?.driverBaseRatePerKm ?? Math.max(8, Math.round(Number(baseRatePerKm) * 0.77 * 10) / 10)),
        driverExtraKmRate: driverExtraKmRate !== undefined && driverExtraKmRate !== null && driverExtraKmRate !== '' ? Number(driverExtraKmRate) : (driverRulesMap[ruleKey]?.driverExtraKmRate ?? Math.max(8, Math.round(Number(extraKmRate || baseRatePerKm) * 0.77 * 10) / 10)),
        driverAllowanceDaily: driverAllowanceDaily !== undefined && driverAllowanceDaily !== null && driverAllowanceDaily !== '' ? Number(driverAllowanceDaily) : (driverRulesMap[ruleKey]?.driverAllowanceDaily ?? Number(driverAllowance || 300)),
        driverNightCharge: driverNightCharge !== undefined && driverNightCharge !== null && driverNightCharge !== '' ? Number(driverNightCharge) : (driverRulesMap[ruleKey]?.driverNightCharge ?? Math.round(Number(nightCharge || 250) * 0.8)),
      };

      driverRulesMap[ruleKey] = {
        ...(driverRulesMap[ruleKey] || {}),
        ...savedDriverRule,
      };

      await prisma.systemSetting.upsert({
        where: { key: 'driver_pricing_rules' },
        update: { value: driverRulesMap },
        create: { key: 'driver_pricing_rules', value: driverRulesMap },
      });
    } catch (driverSettingErr) {
      console.warn('Could not persist driver_pricing_rules in SystemSetting:', driverSettingErr);
    }

    await prisma.auditLog.create({
      data: {
        action: 'PRICING_RULE_SAVED',
        entityType: 'PricingRule',
        entityId: rule.id,
        reason: `Updated fare rule for ${category} × ${tripType} × ${fuelType}: Base ₹${baseRatePerKm}/km (Driver ₹${savedDriverRule.driverBaseRatePerKm || 'N/A'}/km), Extra ₹${extraKmRate}/km`,
      },
    });

    return NextResponse.json({
      success: true,
      rule: {
        ...rule,
        ...savedDriverRule,
      },
    });
  } catch (error: any) {
    console.error('Error saving pricing rule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save pricing rule' },
      { status: 500 }
    );
  }
}
