import { parseSafeIsoDate } from '../utils/dateTime';
import { VehicleCategory } from '../types';

export interface TripTypeCancellationRule {
  enabled: boolean; // true = charges apply; false = NO cancellation charges needed (Free cancellation)
  windowHours: number; // default: 3 hours
  rates: Record<string, number>;
}

export interface CancellationRatesConfig {
  windowHours: number; // global fallback
  rates: Record<string, number>; // global fallback
  tripTypeRules?: Record<string, TripTypeCancellationRule>;
}

export const DEFAULT_CANCELLATION_CONFIG: CancellationRatesConfig = {
  windowHours: 3,
  rates: {
    [VehicleCategory.HATCHBACK]: 500, // Compact (WagonR, Tiago)
    [VehicleCategory.SWIFT_DZIRE]: 500, // Dzire
    [VehicleCategory.TOYOTA_ETIOS]: 500, // Etios
    [VehicleCategory.SEDAN]: 500, // General Sedan
    [VehicleCategory.SUV]: 1000,
    [VehicleCategory.SUV_ERTIGA]: 1000,
    [VehicleCategory.SUV_CARENS]: 1000,
    [VehicleCategory.SUV_INNOVA]: 1000,
    [VehicleCategory.SUV_CRYSTA]: 1000,
    [VehicleCategory.SUV_PREMIUM]: 1000,
    [VehicleCategory.TEMPO_TRAVELER]: 1000,
    [VehicleCategory.URBANIA]: 1000,
  },
};

export const SUPPORTED_TRIP_TYPES_FOR_CANCELLATION = [
  { key: 'ONEWAY', label: 'One Way', desc: 'Point-to-point drop-off trips' },
  { key: 'ROUND', label: 'Round Trip', desc: 'Same-cab return journeys' },
  { key: 'AIRPORT', label: 'Airport Transfer', desc: 'Airport pickups & drops' },
  { key: 'LOCAL', label: 'Local Rental', desc: 'Hourly city rental packages (4h, 8h, 12h)' },
  { key: 'PACKAGE', label: 'Tour & Pilgrimage', desc: 'Outstation holiday & temple tour packages' },
] as const;

export const DEFAULT_TRIP_TYPE_CANCELLATION_RULES: Record<string, TripTypeCancellationRule> = {
  ONEWAY: {
    enabled: true,
    windowHours: 3,
    rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
  },
  ROUND: {
    enabled: true,
    windowHours: 3,
    rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
  },
  AIRPORT: {
    enabled: true,
    windowHours: 3,
    rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
  },
  LOCAL: {
    enabled: true,
    windowHours: 3,
    rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
  },
  PACKAGE: {
    enabled: true,
    windowHours: 3,
    rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
  },
};

export interface FleetCancellationMeta {
  category: string;
  name: string;
  group: 'COMPACT_SEDAN' | 'REST_FLEETS';
  defaultRate: number;
}

export const ALL_FLEET_CATEGORIES_FOR_CANCELLATION: FleetCancellationMeta[] = [
  { category: 'HATCHBACK', name: 'Hatchback / Compact (WagonR, Tiago)', group: 'COMPACT_SEDAN', defaultRate: 500 },
  { category: 'SWIFT_DZIRE', name: 'Swift Dzire (Sedan)', group: 'COMPACT_SEDAN', defaultRate: 500 },
  { category: 'TOYOTA_ETIOS', name: 'Toyota Etios (Sedan)', group: 'COMPACT_SEDAN', defaultRate: 500 },
  { category: 'SEDAN', name: 'General Sedan', group: 'COMPACT_SEDAN', defaultRate: 500 },
  { category: 'SUV', name: 'General SUV', group: 'REST_FLEETS', defaultRate: 1000 },
  { category: 'SUV_ERTIGA', name: 'Maruti Ertiga (SUV / 6+1)', group: 'REST_FLEETS', defaultRate: 1000 },
  { category: 'SUV_CARENS', name: 'Kia Carens (SUV / 6+1)', group: 'REST_FLEETS', defaultRate: 1000 },
  { category: 'SUV_INNOVA', name: 'Toyota Innova (SUV / 7+1)', group: 'REST_FLEETS', defaultRate: 1000 },
  { category: 'SUV_CRYSTA', name: 'Innova Crysta (Premium SUV)', group: 'REST_FLEETS', defaultRate: 1000 },
  { category: 'SUV_PREMIUM', name: 'Premium SUV', group: 'REST_FLEETS', defaultRate: 1000 },
  { category: 'TEMPO_TRAVELER', name: 'Tempo Traveller (12-17 Seater)', group: 'REST_FLEETS', defaultRate: 1000 },
  { category: 'URBANIA', name: 'Force Urbania (Luxury Van)', group: 'REST_FLEETS', defaultRate: 1000 },
];

/**
 * Resolves the cancellation charge for a specific vehicle category or fleet name.
 * Compact, Dzire, Etios, Sedan -> default ₹500
 * Rest of all fleets -> default ₹1000
 */
export function getCancellationFeeForCategory(
  category: string | undefined | null,
  customRates?: Record<string, number>
): number {
  if (!category) return 1000;
  const rates = { ...DEFAULT_CANCELLATION_CONFIG.rates, ...(customRates || {}) };
  const catUpper = String(category).trim().toUpperCase();

  // 1. Direct key match
  if (typeof rates[catUpper] === 'number') {
    return rates[catUpper];
  }

  // 2. Keyword/substring match for Compact / Dzire / Etios
  if (
    catUpper.includes('HATCHBACK') ||
    catUpper.includes('COMPACT') ||
    catUpper.includes('WAGONR') ||
    catUpper.includes('TIAGO')
  ) {
    return rates[VehicleCategory.HATCHBACK] ?? 500;
  }
  if (catUpper.includes('DZIRE') || catUpper.includes('SWIFT')) {
    return rates[VehicleCategory.SWIFT_DZIRE] ?? rates[VehicleCategory.SEDAN] ?? 500;
  }
  if (catUpper.includes('ETIOS')) {
    return rates[VehicleCategory.TOYOTA_ETIOS] ?? rates[VehicleCategory.SEDAN] ?? 500;
  }
  if (catUpper.includes('SEDAN')) {
    return rates[VehicleCategory.SEDAN] ?? 500;
  }

  // 3. Fallback for rest of fleets
  return rates[catUpper] ?? 1000;
}

/**
 * Evaluates whether cancellation fee applies based on trip type, 3-hour pickup window, and fleet category.
 * - If tripType has cancellation charges disabled (e.g. "no need of cancellation charges on this trip"): returns ₹0 (Free Cancellation).
 * - If within windowHours before pickup: applicable fleet cancellation charge applies.
 * - If more than windowHours before pickup: free cancellation (₹0).
 */
export function evaluateCancellationCharge(
  scheduledAt: Date | string,
  category: string | undefined | null,
  cancelTime: Date | string = new Date(),
  config: Partial<CancellationRatesConfig> = {},
  tripType?: string | null
): {
  isWithinWindow: boolean;
  hoursUntilPickup: number;
  cancellationCharge: number;
  freeCancellation: boolean;
  windowHours: number;
  applicableFeeIfCancelled: number;
  chargeEnabled: boolean;
  tripType: string;
} {
  const normTripType = String(tripType || 'ONEWAY').trim().toUpperCase().replace(/_/g, '');
  const tripKey =
    Object.keys(config.tripTypeRules || {}).find(
      (k) => k.replace(/_/g, '').toUpperCase() === normTripType
    ) ||
    (normTripType.includes('ROUND')
      ? 'ROUND'
      : normTripType.includes('AIRPORT')
      ? 'AIRPORT'
      : normTripType.includes('LOCAL')
      ? 'LOCAL'
      : normTripType.includes('PACKAGE') || normTripType.includes('TOUR')
      ? 'PACKAGE'
      : 'ONEWAY');

  const tripRule = config.tripTypeRules?.[tripKey];
  // If rule exists, check its enabled flag; if no rule or rule.enabled !== false, defaults to true
  const chargeEnabled = tripRule ? Boolean(tripRule.enabled) : true;

  const pickupMs = parseSafeIsoDate(scheduledAt).getTime();
  const cancelMs = parseSafeIsoDate(cancelTime).getTime();
  const hoursUntilPickup = (pickupMs - cancelMs) / (1000 * 60 * 60);

  // If cancellation charges are turned OFF for this trip type
  if (!chargeEnabled) {
    return {
      isWithinWindow: false,
      hoursUntilPickup: Math.round(hoursUntilPickup * 10) / 10,
      cancellationCharge: 0,
      freeCancellation: true,
      windowHours: tripRule?.windowHours ?? config.windowHours ?? DEFAULT_CANCELLATION_CONFIG.windowHours,
      applicableFeeIfCancelled: 0,
      chargeEnabled: false,
      tripType: tripKey,
    };
  }

  const windowHours = tripRule?.windowHours ?? config.windowHours ?? DEFAULT_CANCELLATION_CONFIG.windowHours;
  const rates = tripRule?.rates ?? config.rates ?? DEFAULT_CANCELLATION_CONFIG.rates;

  const applicableFee = getCancellationFeeForCategory(category, rates);
  // Cancellation charges apply ONLY within the window before scheduled pickup time (0 < hoursUntilPickup <= windowHours).
  // If cancelled more than windowHours in advance (>3h) or if scheduled pickup time has already passed (<= 0), cancellation fee does not apply (Free Cancellation).
  const isWithinWindow = hoursUntilPickup > 0 && hoursUntilPickup <= windowHours;

  return {
    isWithinWindow,
    hoursUntilPickup: Math.round(hoursUntilPickup * 10) / 10,
    cancellationCharge: isWithinWindow ? applicableFee : 0,
    freeCancellation: !isWithinWindow,
    windowHours,
    applicableFeeIfCancelled: applicableFee,
    chargeEnabled: true,
    tripType: tripKey,
  };
}

