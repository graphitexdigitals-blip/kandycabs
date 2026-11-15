export interface TripTypeAllowanceRule {
  tripType: string;
  label: string;
  dayAllowanceEnabled: boolean;
  nightAllowanceEnabled: boolean;
  dayRateOverride?: number | null;
  nightRateOverride?: number | null;
  notes?: string;
}

export interface ChauffeurAllowanceConfig {
  enabled: boolean;
  dayWindowStartHour: number; // e.g. 6 (6 AM)
  dayWindowEndHour: number;   // e.g. 20 (8 PM)
  nightWindowStartHour: number; // e.g. 20 (8 PM)
  nightWindowEndHour: number;   // e.g. 6 (6 AM)
  fleetRates: Record<string, { dayAllowance: number; nightAllowance: number }>;
  rules: Record<string, TripTypeAllowanceRule>;
}

export const DEFAULT_CHAUFFEUR_FLEET_RATES: Record<string, { dayAllowance: number; nightAllowance: number }> = {
  HATCHBACK: { dayAllowance: 300, nightAllowance: 250 },
  SWIFT_DZIRE: { dayAllowance: 350, nightAllowance: 250 },
  TOYOTA_ETIOS: { dayAllowance: 350, nightAllowance: 250 },
  SEDAN: { dayAllowance: 350, nightAllowance: 250 },
  SUV: { dayAllowance: 400, nightAllowance: 300 },
  SUV_ERTIGA: { dayAllowance: 400, nightAllowance: 300 },
  SUV_CARENS: { dayAllowance: 450, nightAllowance: 300 },
  SUV_INNOVA: { dayAllowance: 500, nightAllowance: 350 },
  SUV_CRYSTA: { dayAllowance: 500, nightAllowance: 350 },
  SUV_PREMIUM: { dayAllowance: 500, nightAllowance: 350 },
  TEMPO_TRAVELER: { dayAllowance: 600, nightAllowance: 500 },
  URBANIA: { dayAllowance: 650, nightAllowance: 500 },
};

export const DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG: ChauffeurAllowanceConfig = {
  enabled: true,
  dayWindowStartHour: 6,   // 6 AM
  dayWindowEndHour: 20,   // 8 PM
  nightWindowStartHour: 20, // 8 PM
  nightWindowEndHour: 6,   // 6 AM
  fleetRates: DEFAULT_CHAUFFEUR_FLEET_RATES,
  rules: {
    ONEWAY: {
      tripType: 'ONEWAY',
      label: 'One Way Outstation',
      dayAllowanceEnabled: true,
      nightAllowanceEnabled: false,
      notes: 'Chauffeur Allowance included',
    },
    ROUND: {
      tripType: 'ROUND',
      label: 'Round Trip',
      dayAllowanceEnabled: true,
      nightAllowanceEnabled: true,
      notes: 'Only day included 6 AM to 8 PM; 8 PM to 6 AM to be included',
    },
    LOCAL: {
      tripType: 'LOCAL',
      label: 'Local Rental Package',
      dayAllowanceEnabled: false,
      nightAllowanceEnabled: false,
      notes: 'No day Allowance; 8 PM to 6 AM excluded',
    },
    AIRPORT: {
      tripType: 'AIRPORT',
      label: 'Airport Transfers',
      dayAllowanceEnabled: false,
      nightAllowanceEnabled: false,
      notes: 'No allowance',
    },
    CORPORATE: {
      tripType: 'CORPORATE',
      label: 'Corporate Travel',
      dayAllowanceEnabled: true,
      nightAllowanceEnabled: true,
      notes: 'Same as round trip',
    },
    PACKAGE: {
      tripType: 'PACKAGE',
      label: 'Pilgrimage Tour / Tour Package',
      dayAllowanceEnabled: true,
      nightAllowanceEnabled: true,
      notes: 'Same as round trip',
    },
  },
};

/**
 * Checks if a given timestamp falls in the night window (e.g. 8:00 PM to 6:00 AM)
 */
export function isNightChauffeurWindow(
  date: Date | string,
  startHour: number = 20,
  endHour: number = 6
): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const hours = d.getHours();
  if (startHour > endHour) {
    return hours >= startHour || hours < endHour;
  }
  return hours >= startHour && hours < endHour;
}

export interface ChauffeurAllowanceResult {
  dayAllowance: number;
  nightAllowance: number;
  totalAllowance: number;
  isDayIncluded: boolean;
  isNightIncluded: boolean;
  summaryText: string;
  ruleNotes: string;
}

/**
 * Calculates chauffeur allowance (driver bata) for a trip given its parameters and configuration.
 */
export function calculateTripChauffeurAllowance(params: {
  tripType: string;
  category?: string;
  scheduledAt?: Date | string;
  durationDays?: number;
  config?: ChauffeurAllowanceConfig;
}): ChauffeurAllowanceResult {
  const config = params.config || DEFAULT_CHAUFFEUR_ALLOWANCE_CONFIG;
  if (!config.enabled) {
    return {
      dayAllowance: 0,
      nightAllowance: 0,
      totalAllowance: 0,
      isDayIncluded: false,
      isNightIncluded: false,
      summaryText: 'Chauffeur allowance disabled in settings',
      ruleNotes: 'Disabled',
    };
  }

  const rawType = (params.tripType || 'ONEWAY').toUpperCase();
  // Map aliases to standard rule keys
  let normalizedType = rawType;
  if (rawType.includes('LOCAL') || rawType.includes('RENTAL')) {
    normalizedType = 'LOCAL';
  } else if (rawType.includes('AIRPORT')) {
    normalizedType = 'AIRPORT';
  } else if (rawType.includes('ROUND')) {
    normalizedType = 'ROUND';
  } else if (rawType.includes('CORP')) {
    normalizedType = 'CORPORATE';
  } else if (rawType.includes('PILGRIM') || rawType.includes('TOUR') || rawType.includes('PACKAGE')) {
    normalizedType = 'PACKAGE';
  } else if (rawType.includes('ONE') || rawType.includes('WAY')) {
    normalizedType = 'ONEWAY';
  }

  const rule = config.rules[normalizedType] || config.rules.ONEWAY;
  const rawCat = (params.category || 'SEDAN').toUpperCase();
  const fleetRate = config.fleetRates[rawCat] || config.fleetRates.SEDAN || { dayAllowance: 350, nightAllowance: 250 };

  const days = Math.max(1, params.durationDays || 1);
  let dayAllowance = 0;
  let nightAllowance = 0;

  // Day Allowance Calculation
  if (rule.dayAllowanceEnabled) {
    const rate = typeof rule.dayRateOverride === 'number' ? rule.dayRateOverride : fleetRate.dayAllowance;
    dayAllowance = rate * days;
  }

  // Night Allowance Calculation
  const isNightTime = params.scheduledAt
    ? isNightChauffeurWindow(params.scheduledAt, config.nightWindowStartHour, config.nightWindowEndHour)
    : false;

  if (rule.nightAllowanceEnabled && isNightTime) {
    const nightRate = typeof rule.nightRateOverride === 'number' ? rule.nightRateOverride : fleetRate.nightAllowance;
    nightAllowance = nightRate;
  }

  const totalAllowance = dayAllowance + nightAllowance;
  let summaryText = '';
  if (totalAllowance === 0) {
    summaryText = `No allowance (${rule.notes || 'Excluded'})`;
  } else if (nightAllowance > 0) {
    summaryText = `₹${totalAllowance} (Day: ₹${dayAllowance} + Night: ₹${nightAllowance})`;
  } else {
    summaryText = `₹${totalAllowance} (${rule.dayAllowanceEnabled ? 'Day allowance included' : ''})`;
  }

  return {
    dayAllowance,
    nightAllowance,
    totalAllowance,
    isDayIncluded: rule.dayAllowanceEnabled,
    isNightIncluded: rule.nightAllowanceEnabled && isNightTime,
    summaryText,
    ruleNotes: rule.notes || '',
  };
}
