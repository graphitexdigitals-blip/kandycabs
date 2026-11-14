import { NextRequest, NextResponse } from 'next/server';
import {
  VehicleCategory,
  FuelType,
  TripType,
  calculateFare,
  VEHICLE_RATES,
  QuoteRequest,
  QuoteResponse,
} from '@kandy-cabs/shared';
import { prisma } from '@kandy-cabs/db';
import { calculateRouteDistance, calculateMultiPointRouteDistance } from '@/lib/distance';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

// In-Memory Database Cache for Pricing Rules & Fleet (2s TTL for real-time responsiveness)
interface DbPricingCache {
  rules: any[];
  fleet: any[];
  nightSettings: any;
  airportRates: any;
  expiresAt: number;
}

let dbPricingCache: DbPricingCache | null = null;
const DB_PRICING_CACHE_TTL_MS = 2 * 1000; // 2s

async function getCachedPricingData() {
  const now = Date.now();
  if (dbPricingCache && now < dbPricingCache.expiresAt) {
    return {
      rules: dbPricingCache.rules,
      fleet: dbPricingCache.fleet,
      nightSettings: dbPricingCache.nightSettings,
      airportRates: dbPricingCache.airportRates,
    };
  }

  const [dbPricingRules, dbFleetCategories, systemSettings] = await Promise.all([
    prisma.pricingRule.findMany({ where: { isActive: true } }).catch(() => []),
    prisma.fleetCategory.findMany({ where: { isActive: true } }).catch(() => []),
    prisma.systemSetting.findMany({
      where: { key: { in: ['night_charge_settings', 'airport_city_rates'] } },
    }).catch(() => []),
  ]);

  let nightSettings = null;
  let airportRates = null;
  for (const s of systemSettings) {
    if (s.key === 'night_charge_settings') nightSettings = s.value;
    if (s.key === 'airport_city_rates') airportRates = s.value;
  }

  dbPricingCache = {
    rules: dbPricingRules,
    fleet: dbFleetCategories,
    nightSettings,
    airportRates,
    expiresAt: now + DB_PRICING_CACHE_TTL_MS,
  };

  return {
    rules: dbPricingRules,
    fleet: dbFleetCategories,
    nightSettings,
    airportRates,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: QuoteRequest = await req.json();
    const {
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      stops = [],
      tripType = TripType.ONEWAY,
      scheduledAt = new Date().toISOString(),
      durationDays = 1,
      packageHours = 8,
      category,
      fuelType,
      couponCode,
    } = body;

    // 1. Calculate server-authoritative distance (never trust client)
    let distanceKm = 50; // default for local
    let durationMins = 60;

    if (
      typeof pickupLat === 'number' &&
      typeof pickupLng === 'number' &&
      typeof dropLat === 'number' &&
      typeof dropLng === 'number'
    ) {
      if (tripType === TripType.ROUND) {
        // Construct waypoint path: Pickup -> Stop 1 -> Stop 2 -> Drop -> Pickup (return)
        const waypoints: { lat: number; lng: number }[] = [{ lat: pickupLat, lng: pickupLng }];
        if (Array.isArray(stops) && stops.length > 0) {
          for (const s of stops) {
            if (typeof s.lat === 'number' && typeof s.lng === 'number') {
              waypoints.push({ lat: s.lat, lng: s.lng });
            }
          }
        }
        waypoints.push({ lat: dropLat, lng: dropLng });
        // Return leg to pickup
        waypoints.push({ lat: pickupLat, lng: pickupLng });

        const route = await calculateMultiPointRouteDistance(waypoints);
        distanceKm = route.distanceKm;
        durationMins = route.durationMins;
      } else {
        const route = await calculateRouteDistance(pickupLat, pickupLng, dropLat, dropLng);
        distanceKm = route.distanceKm;
        durationMins = route.durationMins;
      }
    }

    // 2. Load dynamic pricing rules, fleet categories, & settings from in-memory cached database snapshot
    const {
      rules: dbPricingRules,
      fleet: dbFleetCategories,
      nightSettings,
      airportRates,
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

    // 3. Compute quotes for categories
    const categoriesToQuote = category
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

    const quotes = categoriesToQuote.map((cat) => {
      const config = VEHICLE_RATES[cat] || VEHICLE_RATES[VehicleCategory.SEDAN];
      const dbFleet = fleetMap.get(cat);

      // Determine strictly enabled fuels for this category configured in Admin Panel
      const isCngOn = dbFleet ? Boolean(dbFleet.cngEnabled) : (cat === VehicleCategory.HATCHBACK || cat === VehicleCategory.SEDAN || cat === VehicleCategory.SUV || cat === VehicleCategory.SUV_ERTIGA);
      const isPetrolOn = dbFleet ? Boolean(dbFleet.petrolEnabled) : (cat !== VehicleCategory.TEMPO_TRAVELER && cat !== VehicleCategory.SWIFT_DZIRE && cat !== VehicleCategory.TOYOTA_ETIOS);
      const isDieselOn = dbFleet ? Boolean(dbFleet.dieselEnabled) : (cat !== VehicleCategory.HATCHBACK);

      const candidateFuels = [
        {
          fuelType: FuelType.CNG,
          isEnabled: isCngOn,
          rate: config.perKmRate[FuelType.CNG] || 11.0,
        },
        {
          fuelType: FuelType.PETROL,
          isEnabled: isPetrolOn,
          rate: config.perKmRate[FuelType.PETROL] || 12.0,
        },
        {
          fuelType: FuelType.DIESEL,
          isEnabled: isDieselOn,
          rate: config.perKmRate[FuelType.DIESEL] || 13.0,
        },
      ];

      // Calculate pricing for each enabled candidate fuel
      const fuelOptions = candidateFuels
        .filter((f) => f.isEnabled)
        .map((f) => {
          const dbRuleKey = `${cat}_${tripType}_${f.fuelType}`;
          const dbRule = pricingRuleMap.get(dbRuleKey);

          const overrides: any = {
            ratePerKm: dbRule ? Number(dbRule.baseRatePerKm) : f.rate,
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
            overrides,
            pickupAddress: body.pickupAddress,
            dropAddress: body.dropAddress,
            airportCityRates: airportRates,
          });

          return {
            fuelType: f.fuelType,
            ratePerKm: f.rate,
            pricing,
            isEnabled: true,
          };
        });

      // Selected fuel option (match requested fuelType or fallback to first available)
      const selectedOption =
        (fuelType && fuelOptions.find((fo) => fo.fuelType === fuelType)) ||
        fuelOptions.find((fo) => fo.fuelType === (cat === VehicleCategory.HATCHBACK ? FuelType.PETROL : FuelType.DIESEL)) ||
        fuelOptions[0] || {
          fuelType: FuelType.DIESEL,
          ratePerKm: 14.0,
          pricing: calculateFare({
            category: cat,
            tripType,
            distanceKm,
            scheduledAt,
            durationDays,
            packageHours,
            couponCode,
          }),
          isEnabled: true,
        };

      return {
        category: cat,
        name: dbFleet?.name || config.name,
        description: dbFleet?.description || config.description,
        seats: dbFleet?.seatCount || config.seats,
        luggage: dbFleet?.luggageCount || config.luggage,
        fuelTypes: fuelOptions.map((fo) => fo.fuelType),
        pricing: selectedOption.pricing,
        fuelOptions,
      };
    });

    const responsePayload: QuoteResponse = {
      success: true,
      distanceKm,
      estimatedDurationMins: durationMins,
      quotes,
    };

    const res = NextResponse.json(responsePayload, { status: 200 });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/pricing/quote:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to compute fare quote' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
