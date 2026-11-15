import { parseSafeIsoDate } from '../utils/dateTime';
import { VehicleCategory } from '../types';

export type CancellationChargeMode = 'FIXED_RATE' | 'ADVANCE_NON_REFUNDABLE' | 'FREE';

export interface TripTypeCancellationRule {
  mode?: CancellationChargeMode; // 'FIXED_RATE' | 'ADVANCE_NON_REFUNDABLE' | 'FREE'
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
    mode: 'FIXED_RATE',
    enabled: true,
    windowHours: 3,
    rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
  },
  ROUND: {
    mode: 'FIXED_RATE',
    enabled: true,
    windowHours: 3,
    rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
  },
  AIRPORT: {
    mode: 'FIXED_RATE',
    enabled: true,
    windowHours: 3,
    rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
  },
  LOCAL: {
    mode: 'FIXED_RATE',
    enabled: true,
    windowHours: 3,
    rates: { ...DEFAULT_CANCELLATION_CONFIG.rates },
  },
  PACKAGE: {
    mode: 'FIXED_RATE',
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

export interface CancellationEvaluationResult {
  mode: CancellationChargeMode;
  isWithinWindow: boolean;
  hoursUntilPickup: number;
  cancellationCharge: number;
  refundAmount: number;
  freeCancellation: boolean;
  windowHours: number;
  applicableFeeIfCancelled: number;
  chargeEnabled: boolean;
  tripType: string;
  isAdvanceNonRefundable: boolean;
  policyDescription: string;
}

/**
 * Evaluates whether cancellation fee applies based on admin's selected policy mode:
 * 1. ADVANCE_NON_REFUNDABLE: Advance payment received is retained as the cancellation fee (0 refund).
 * 2. FIXED_RATE: Fleet rate (₹500 / ₹1000) applies if cancelled within windowHours before scheduled pickup. Excess advance is refunded.
 * 3. FREE: Free cancellation (₹0 fee); 100% advance refunded.
 */
export function evaluateCancellationCharge(
  scheduledAt: Date | string,
  category: string | undefined | null,
  cancelTime: Date | string = new Date(),
  config: Partial<CancellationRatesConfig> = {},
  tripType?: string | null,
  advanceAmount: number = 0
): CancellationEvaluationResult {
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

  // Resolve Mode
  let mode: CancellationChargeMode = 'FIXED_RATE';
  if (tripRule?.mode) {
    mode = tripRule.mode;
  } else if (tripRule && tripRule.enabled === false) {
    mode = 'FREE';
  } else {
    mode = 'FIXED_RATE';
  }

  const pickupMs = parseSafeIsoDate(scheduledAt).getTime();
  const cancelMs = parseSafeIsoDate(cancelTime).getTime();
  const hoursUntilPickup = (pickupMs - cancelMs) / (1000 * 60 * 60);
  const roundedHours = Math.round(hoursUntilPickup * 10) / 10;

  const windowHours = tripRule?.windowHours ?? config.windowHours ?? DEFAULT_CANCELLATION_CONFIG.windowHours;
  const rates = tripRule?.rates ?? config.rates ?? DEFAULT_CANCELLATION_CONFIG.rates;
  const applicableFleetFee = getCancellationFeeForCategory(category, rates);

  // 1. FREE CANCELLATION
  if (mode === 'FREE') {
    return {
      mode: 'FREE',
      isWithinWindow: false,
      hoursUntilPickup: roundedHours,
      cancellationCharge: 0,
      refundAmount: Math.max(0, advanceAmount),
      freeCancellation: true,
      windowHours,
      applicableFeeIfCancelled: 0,
      chargeEnabled: false,
      tripType: tripKey,
      isAdvanceNonRefundable: false,
      policyDescription: '100% Free Cancellation. Full advance payment will be refunded.',
    };
  }

  // 2. ADVANCE PAYMENT NON-REFUNDABLE
  if (mode === 'ADVANCE_NON_REFUNDABLE') {
    const charge = advanceAmount > 0 ? advanceAmount : 0;
    return {
      mode: 'ADVANCE_NON_REFUNDABLE',
      isWithinWindow: true,
      hoursUntilPickup: roundedHours,
      cancellationCharge: charge,
      refundAmount: 0,
      freeCancellation: false,
      windowHours,
      applicableFeeIfCancelled: charge,
      chargeEnabled: true,
      tripType: tripKey,
      isAdvanceNonRefundable: true,
      policyDescription: 'Advance payment received is non-refundable upon cancellation and will be charged as the cancellation fee.',
    };
  }

  // 3. FIXED FLEET RATE (WINDOW BASED, e.g. ₹500 / ₹1000)
  // Cancellation charges apply within the window before scheduled pickup time (0 < hoursUntilPickup <= windowHours).
  const isWithinWindow = hoursUntilPickup > 0 && hoursUntilPickup <= windowHours;
  const cancellationCharge = isWithinWindow ? applicableFleetFee : 0;
  const refundAmount = Math.max(0, advanceAmount - cancellationCharge);

  return {
    mode: 'FIXED_RATE',
    isWithinWindow,
    hoursUntilPickup: roundedHours,
    cancellationCharge,
    refundAmount,
    freeCancellation: !isWithinWindow,
    windowHours,
    applicableFeeIfCancelled: applicableFleetFee,
    chargeEnabled: true,
    tripType: tripKey,
    isAdvanceNonRefundable: false,
    policyDescription: isWithinWindow
      ? `Cancellation within ${windowHours} hours of pickup incurs ₹${applicableFleetFee} fee. Remaining advance of ₹${refundAmount.toFixed(2)} is refunded.`
      : `Free cancellation up to ${windowHours} hours before pickup. Cancellations within ${windowHours}h incur standard fleet fee (₹${applicableFleetFee}).`,
  };
}

/**
 * Returns user-friendly presentation details for UI badges and review cards.
 */
export function getTripCancellationPolicyBadge(
  ruleOrConfig: TripTypeCancellationRule | Partial<CancellationRatesConfig> | undefined,
  tripType?: string | null,
  category?: string | null
): {
  mode: CancellationChargeMode;
  title: string;
  shortLabel: string;
  description: string;
  isAdvanceNonRefundable: boolean;
  isFree: boolean;
  windowHours: number;
  feeAmount: number;
} {
  let rule: TripTypeCancellationRule | undefined;
  let windowHours = 3;

  if (ruleOrConfig && 'rates' in ruleOrConfig && 'enabled' in ruleOrConfig) {
    rule = ruleOrConfig as TripTypeCancellationRule;
    windowHours = rule.windowHours || 3;
  } else if (ruleOrConfig && 'tripTypeRules' in ruleOrConfig) {
    const config = ruleOrConfig as Partial<CancellationRatesConfig>;
    const normTripType = String(tripType || 'ONEWAY').trim().toUpperCase().replace(/_/g, '');
    const tripKey =
      Object.keys(config.tripTypeRules || {}).find(
        (k) => k.replace(/_/g, '').toUpperCase() === normTripType
      ) || 'ONEWAY';
    rule = config.tripTypeRules?.[tripKey];
    windowHours = rule?.windowHours ?? config.windowHours ?? 3;
  }

  let mode: CancellationChargeMode = 'FIXED_RATE';
  if (rule?.mode) {
    mode = rule.mode;
  } else if (rule && rule.enabled === false) {
    mode = 'FREE';
  } else {
    mode = 'FIXED_RATE';
  }

  const feeAmount = getCancellationFeeForCategory(category, rule?.rates);

  if (mode === 'ADVANCE_NON_REFUNDABLE') {
    return {
      mode: 'ADVANCE_NON_REFUNDABLE',
      title: 'Advance Non-Refundable',
      shortLabel: 'Advance as Fee (Non-Refundable)',
      description: 'Advance payment received is non-refundable upon cancellation and will be charged as the cancellation fee.',
      isAdvanceNonRefundable: true,
      isFree: false,
      windowHours,
      feeAmount,
    };
  }

  if (mode === 'FREE') {
    return {
      mode: 'FREE',
      title: 'Free Cancellation',
      shortLabel: '100% Free Cancellation',
      description: 'Zero cancellation charges. If you cancel this booking, 100% of your advance payment will be refunded.',
      isAdvanceNonRefundable: false,
      isFree: true,
      windowHours,
      feeAmount: 0,
    };
  }

  return {
    mode: 'FIXED_RATE',
    title: 'Fleet Rate Policy',
    shortLabel: `Free cancel >${windowHours}h • ₹${feeAmount} within ${windowHours}h`,
    description: `Free cancellation up to ${windowHours} hours before pickup. Cancellations within ${windowHours} hours incur ₹${feeAmount} cancellation fee and excess advance is refunded.`,
    isAdvanceNonRefundable: false,
    isFree: false,
    windowHours,
    feeAmount,
  };
}
