import { NextRequest, NextResponse } from 'next/server';
import {
  VehicleCategory,
  FuelType,
  TripType,
  calculateFare,
  VEHICLE_RATES,
} from '@kandy-cabs/shared';
import { prisma } from '@kandy-cabs/db';
import { calculateRouteDistance, calculateMultiPointRouteDistance } from '@/lib/distance';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

// In-Memory Database Cache for Pricing Rules & Fleet (3s TTL for real-time responsiveness)
interface DbPricingCache {
  rules: any[];
  fleet: any[];
  nightSettings: any;
  airportRates: any;
  chauffeurSettings: any;
  driverPricingRules: any;
  expiresAt: number;
}

let dbPricingCache: DbPricingCache | null = null;
const DB_PRICING_CACHE_TTL_MS = 3 * 1000; // 3s

async function getCachedPricingData() {
  const now = Date.now();
  if (dbPricingCache && now < dbPricingCache.expiresAt) {
    return {
      rules: dbPricingCache.rules,
      fleet: dbPricingCache.fleet,
      nightSettings: dbPricingCache.nightSettings,
      airportRates: dbPricingCache.airportRates,
      chauffeurSettings: dbPricingCache.chauffeurSettings,
      driverPricingRules: dbPricingCache.driverPricingRules,
    };
  }

  const [dbPricingRules, dbFleetCategories, systemSettings] = await Promise.all([
    prisma.pricingRule.findMany({ where: { isActive: true } }).catch(() => []),
    prisma.fleetCategory.findMany({ where: { isActive: true } }).catch(() => []),
    prisma.systemSetting.findMany({
      where: { key: { in: ['night_charge_settings', 'airport_city_rates', 'chauffeur_allowance_settings', 'driver_pricing_rules'] } },
    }).catch(() => []),
  ]);

  let nightSettings: any = null;
  let airportRates: any = null;
  let chauffeurSettings: any = null;
  let driverPricingRules: any = {};
  for (const s of systemSettings) {
    if (s.key === 'night_charge_settings') nightSettings = s.value;
    if (s.key === 'airport_city_rates') airportRates = s.value;
    if (s.key === 'chauffeur_allowance_settings') chauffeurSettings = s.value;
    if (s.key === 'driver_pricing_rules') driverPricingRules = (s.value as any) || {};
  }

  dbPricingCache = {
    rules: dbPricingRules,
    fleet: dbFleetCategories,
    nightSettings,
    airportRates,
    chauffeurSettings,
    driverPricingRules,
    expiresAt: now + DB_PRICING_CACHE_TTL_MS,
  };

  return {
    rules: dbPricingRules,
    fleet: dbFleetCategories,
    nightSettings,
    airportRates,
    chauffeurSettings,
    driverPricingRules,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      viaStops = [],
      stops = [],
      tripType = TripType.ONEWAY,
      scheduledAt = new Date().toISOString(),
      durationDays = 1,
      packageHours = 8,
      category,
      fuelType,
      couponCode,
      hasPet = false,
      petFee = 0,
      pickupAddress,
      dropAddress,
    } = body;

    const allStops = Array.isArray(viaStops) && viaStops.length > 0 ? viaStops : (Array.isArray(stops) ? stops : []);

    // 1. Calculate server-authoritative route distance (OSRM highway routing)
    let distanceKm = tripType === TripType.LOCAL ? (packageHours === 4 ? 40 : packageHours === 8 ? 80 : 120) : 50;
    let durationMins = 60;

    if (
      typeof pickupLat === 'number' &&
      typeof pickupLng === 'number' &&
      typeof dropLat === 'number' &&
      typeof dropLng === 'number' &&
      tripType !== TripType.LOCAL
    ) {
      if (tripType === TripType.ROUND) {
        // Construct waypoint path: Pickup -> Via 1 -> ... -> Drop -> Pickup (return)
        const waypoints: { lat: number; lng: number }[] = [{ lat: pickupLat, lng: pickupLng }];
        for (const s of allStops) {
          if (s && typeof s.lat === 'number' && typeof s.lng === 'number') {
            waypoints.push({ lat: s.lat, lng: s.lng });
          }
        }
        waypoints.push({ lat: dropLat, lng: dropLng });
        waypoints.push({ lat: pickupLat, lng: pickupLng });

        const route = await calculateMultiPointRouteDistance(waypoints);
        distanceKm = route.distanceKm;
        durationMins = route.durationMins;
      } else if (allStops.length > 0) {
        // One-Way with Via Stops
        const waypoints: { lat: number; lng: number }[] = [{ lat: pickupLat, lng: pickupLng }];
        for (const s of allStops) {
          if (s && typeof s.lat === 'number' && typeof s.lng === 'number') {
            waypoints.push({ lat: s.lat, lng: s.lng });
          }
        }
        waypoints.push({ lat: dropLat, lng: dropLng });

        const route = await calculateMultiPointRouteDistance(waypoints);
        distanceKm = route.distanceKm;
        durationMins = route.durationMins;
      } else {
        const route = await calculateRouteDistance(pickupLat, pickupLng, dropLat, dropLng);
        distanceKm = route.distanceKm;
        durationMins = route.durationMins;
      }
    }

    // 2. Load live dynamic pricing rules & system settings from Admin Database
    const {
      rules: dbPricingRules,
      fleet: dbFleetCategories,
      nightSettings,
      airportRates,
      chauffeurSettings,
      driverPricingRules = {},
    } = await getCachedPricingData();

    const fleetMap = new Map<string, any>();
    for (const f of dbFleetCategories) {
      fleetMap.set(f.category, f);
    }

    const pricingRuleMap = new Map<string, any>();
    for (const r of dbPricingRules) {
      const key = `${r.category}_${r.tripType}_${r.fuelType}`;
      pricingRuleMap.set(key, r);
    }

    // 3. Compute quotes for all vehicle categories
    const categoriesToQuote = category && category !== 'ALL'
      ? [category]
      : [
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

    const quotes: any[] = [];
    const quotesByCategory: Record<string, any> = {};

    for (const cat of categoriesToQuote) {
      const config = VEHICLE_RATES[cat as VehicleCategory] || VEHICLE_RATES[VehicleCategory.SEDAN];
      const dbFleet = fleetMap.get(cat);

      // Determine strictly enabled fuels for this category configured in Admin Panel
      const isCngOn = dbFleet ? Boolean(dbFleet.cngEnabled) : (cat === VehicleCategory.HATCHBACK || cat === VehicleCategory.SEDAN || cat === VehicleCategory.SUV || cat === VehicleCategory.SUV_ERTIGA);
      const isPetrolOn = dbFleet ? Boolean(dbFleet.petrolEnabled) : (cat !== VehicleCategory.TEMPO_TRAVELER && cat !== VehicleCategory.SWIFT_DZIRE && cat !== VehicleCategory.TOYOTA_ETIOS);
      const isDieselOn = dbFleet ? Boolean(dbFleet.dieselEnabled) : (cat !== VehicleCategory.HATCHBACK);

      const candidateFuels = [
        {
          fuelType: FuelType.CNG,
          isEnabled: isCngOn,
          defaultRate: config.perKmRate[FuelType.CNG] || 11.0,
        },
        {
          fuelType: FuelType.PETROL,
          isEnabled: isPetrolOn,
          defaultRate: config.perKmRate[FuelType.PETROL] || 12.0,
        },
        {
          fuelType: FuelType.DIESEL,
          isEnabled: isDieselOn,
          defaultRate: config.perKmRate[FuelType.DIESEL] || 13.0,
        },
      ];

      const fuelOptions = candidateFuels
        .filter((f) => f.isEnabled)
        .map((f) => {
          const dbRuleKey = `${cat}_${tripType}_${f.fuelType}`;
          const dbRule = pricingRuleMap.get(dbRuleKey);
          const dRule = driverPricingRules[dbRuleKey] || {};

          const overrides: any = {
            ratePerKm: dbRule ? Number(dbRule.baseRatePerKm) : f.defaultRate,
            extraKmRate: dbRule ? Number(dbRule.extraKmRate) : dbFleet ? Number(dbFleet.extraKmRate) : undefined,
            extraKmThreshold: dbRule?.extraKmThreshold ? Number(dbRule.extraKmThreshold) : dbFleet?.extraKmThreshold ? Number(dbFleet.extraKmThreshold) : undefined,
            driverAllowance: dbRule ? Number(dbRule.driverAllowance) : dbFleet ? Number(dbFleet.driverAllowance) : undefined,
            nightCharge: dbRule ? Number(dbRule.nightCharge) : dbFleet ? Number(dbFleet.nightCharge) : undefined,
            nightChargeEnabled: nightSettings ? Boolean(nightSettings.enabled) : true,
            applicableNightTripTypes: nightSettings?.applicableTripTypes,
            gstRatePercent: dbRule ? Number(dbRule.gstRatePercent) : undefined,
            nightWindowStartHour: dbRule ? dbRule.nightWindowStartHour : undefined,
            nightWindowEndHour: dbRule ? dbRule.nightWindowEndHour : undefined,
            minRoundTripKmPerDay: dbFleet ? Number(dbFleet.minRoundTripKmPerDay) : undefined,
            localPackage4hrBase: dbRule?.localPackage4hrBase ? Number(dbRule.localPackage4hrBase) : dbFleet?.localPackage4hrBase ? Number(dbFleet.localPackage4hrBase) : undefined,
            localPackage4hrKm: dbRule?.localPackage4hrKm ? Number(dbRule.localPackage4hrKm) : dbFleet?.localPackage4hrKm ? Number(dbFleet.localPackage4hrKm) : 40,
            localPackage4hrExtraKmRate: dbRule?.localPackage4hrExtraKmRate ? Number(dbRule.localPackage4hrExtraKmRate) : undefined,
            localPackage8hrBase: dbRule?.localPackage8hrBase ? Number(dbRule.localPackage8hrBase) : dbFleet?.localPackage8hrBase ? Number(dbFleet.localPackage8hrBase) : undefined,
            localPackage8hrKm: dbRule?.localPackage8hrKm ? Number(dbRule.localPackage8hrKm) : dbFleet?.localPackage8hrKm ? Number(dbFleet.localPackage8hrKm) : 80,
            localPackage8hrExtraKmRate: dbRule?.localPackage8hrExtraKmRate ? Number(dbRule.localPackage8hrExtraKmRate) : undefined,
            localPackage12hrBase: dbRule?.localPackage12hrBase ? Number(dbRule.localPackage12hrBase) : dbFleet?.localPackage12hrBase ? Number(dbFleet.localPackage12hrBase) : undefined,
            localPackage12hrKm: dbRule?.localPackage12hrKm ? Number(dbRule.localPackage12hrKm) : dbFleet?.localPackage12hrKm ? Number(dbFleet.localPackage12hrKm) : 120,
            localPackage12hrExtraKmRate: dbRule?.localPackage12hrExtraKmRate ? Number(dbRule.localPackage12hrExtraKmRate) : undefined,
            extraHourRate: dbRule?.extraHourRate ? Number(dbRule.extraHourRate) : dbFleet?.extraHourRate ? Number(dbFleet.extraHourRate) : undefined,
            driverBaseRatePerKm: dRule.driverBaseRatePerKm !== undefined && dRule.driverBaseRatePerKm !== null ? Number(dRule.driverBaseRatePerKm) : undefined,
            driverExtraKmRate: dRule.driverExtraKmRate !== undefined && dRule.driverExtraKmRate !== null ? Number(dRule.driverExtraKmRate) : undefined,
            driverAllowanceDaily: dRule.driverAllowanceDaily !== undefined && dRule.driverAllowanceDaily !== null ? Number(dRule.driverAllowanceDaily) : undefined,
            driverNightCharge: dRule.driverNightCharge !== undefined && dRule.driverNightCharge !== null ? Number(dRule.driverNightCharge) : undefined,
            chauffeurConfig: chauffeurSettings,
          };

          const pricing = calculateFare({
            category: cat,
            fuelType: f.fuelType,
            tripType,
            distanceKm,
            scheduledAt,
            durationDays,
            packageHours,
            couponCode,
            hasPet,
            petFee,
            overrides,
            pickupAddress,
            dropAddress,
            airportCityRates: airportRates,
            chauffeurConfig: chauffeurSettings,
          });

          return {
            fuelType: f.fuelType,
            ratePerKm: overrides.ratePerKm,
            pricing,
            isEnabled: true,
          };
        });

      // Default to preferred fuel for category
      const preferredFuel = cat === VehicleCategory.HATCHBACK
        ? FuelType.CNG
        : cat === VehicleCategory.SWIFT_DZIRE || cat === VehicleCategory.TOYOTA_ETIOS
        ? FuelType.DIESEL
        : FuelType.DIESEL;

      const selectedOption =
        (fuelType && fuelOptions.find((fo) => fo.fuelType === fuelType)) ||
        fuelOptions.find((fo) => fo.fuelType === preferredFuel) ||
        fuelOptions[0] || {
          fuelType: FuelType.DIESEL,
          ratePerKm: 13.0,
          pricing: calculateFare({
            category: cat,
            tripType,
            distanceKm,
            scheduledAt,
            durationDays,
            packageHours,
            couponCode,
            chauffeurConfig: chauffeurSettings,
          }),
          isEnabled: true,
        };

      const quoteItem = {
        category: cat,
        name: dbFleet?.name || config.name,
        description: dbFleet?.description || config.description,
        ratePerKm: selectedOption.ratePerKm,
        billableDistanceKm: selectedOption.pricing.billableDistanceKm ?? distanceKm,
        driverAllowance: selectedOption.pricing.driverAllowance ?? 0,
        baseFare: selectedOption.pricing.baseFare,
        nightFee: selectedOption.pricing.nightFee ?? 0,
        petFee: selectedOption.pricing.petFee ?? 0,
        subtotal: selectedOption.pricing.subtotal,
        gstAmount: selectedOption.pricing.gstAmount,
        totalFare: selectedOption.pricing.totalFare,
        advanceAmount: selectedOption.pricing.advanceAmount,
        balanceAmount: selectedOption.pricing.balanceAmount,
        pricing: selectedOption.pricing,
        fuelOptions,
      };

      quotes.push(quoteItem);
      quotesByCategory[cat] = quoteItem;
    }

    const responsePayload = {
      success: true,
      distanceKm,
      durationMins,
      tripType,
      quotes,
      quotesByCategory,
    };

    const res = NextResponse.json(responsePayload, { status: 200 });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in /api/customer/quote:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to compute fare quote' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

export async function GET(req: NextRequest) {
  // Allow GET with query params
  const { searchParams } = new URL(req.url);
  const pickupLat = parseFloat(searchParams.get('pickupLat') || '');
  const pickupLng = parseFloat(searchParams.get('pickupLng') || '');
  const dropLat = parseFloat(searchParams.get('dropLat') || '');
  const dropLng = parseFloat(searchParams.get('dropLng') || '');
  const tripType = (searchParams.get('tripType') as TripType) || TripType.ONEWAY;
  const category = searchParams.get('category') || undefined;

  const mockReq = {
    json: async () => ({
      pickupLat: isNaN(pickupLat) ? undefined : pickupLat,
      pickupLng: isNaN(pickupLng) ? undefined : pickupLng,
      dropLat: isNaN(dropLat) ? undefined : dropLat,
      dropLng: isNaN(dropLng) ? undefined : dropLng,
      tripType,
      category,
    }),
  } as any;

  return POST(mockReq);
}
