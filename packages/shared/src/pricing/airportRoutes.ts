import { VehicleCategory, TripType } from '../types';

export interface AirportRouteRate {
  id: string;
  fromCity: string;
  toCity: string;
  name: string;
  fixedFares: Record<string, number>;
}

export interface AirportRatesConfig {
  routes: AirportRouteRate[];
  defaultFixedFares: Record<string, number>;
  defaultThresholdKm?: number;
  unlistedPricingMode?: 'PER_KM' | 'FIXED_FARE'; // Default: 'PER_KM' (Charge as per km rate)
}

export interface NightChargeSettings {
  enabled: boolean;
  applicableTripTypes: (TripType | string)[];
}

export const DEFAULT_NIGHT_CHARGE_SETTINGS: NightChargeSettings = {
  enabled: true,
  applicableTripTypes: ['ONEWAY', 'ROUND', 'AIRPORT'],
};

export const DEFAULT_AIRPORT_ROUTES: AirportRouteRate[] = [
  {
    id: 'ixe_blr',
    fromCity: 'Mangalore',
    toCity: 'Bangalore',
    name: 'Mangalore Airport (IXE) ⇄ Bengaluru / Bangalore',
    fixedFares: {
      [VehicleCategory.HATCHBACK]: 4800,
      [VehicleCategory.SWIFT_DZIRE]: 5200,
      [VehicleCategory.TOYOTA_ETIOS]: 5600,
      [VehicleCategory.SUV_ERTIGA]: 6600,
      [VehicleCategory.SUV_CARENS]: 7400,
      [VehicleCategory.SUV_INNOVA]: 8200,
      [VehicleCategory.SUV_CRYSTA]: 9200,
      [VehicleCategory.TEMPO_TRAVELER]: 12500,
      [VehicleCategory.URBANIA]: 15000,
      [VehicleCategory.SEDAN]: 5200,
      [VehicleCategory.SUV]: 6600,
      [VehicleCategory.SUV_PREMIUM]: 9200,
    },
  },
  {
    id: 'ixe_coorg',
    fromCity: 'Mangalore',
    toCity: 'Coorg',
    name: 'Mangalore Airport (IXE) ⇄ Coorg / Madikeri Airport Hub',
    fixedFares: {
      [VehicleCategory.HATCHBACK]: 2400,
      [VehicleCategory.SWIFT_DZIRE]: 2700,
      [VehicleCategory.TOYOTA_ETIOS]: 2900,
      [VehicleCategory.SUV_ERTIGA]: 3500,
      [VehicleCategory.SUV_CARENS]: 3900,
      [VehicleCategory.SUV_INNOVA]: 4400,
      [VehicleCategory.SUV_CRYSTA]: 4900,
      [VehicleCategory.TEMPO_TRAVELER]: 6800,
      [VehicleCategory.URBANIA]: 7800,
      [VehicleCategory.SEDAN]: 2700,
      [VehicleCategory.SUV]: 3500,
      [VehicleCategory.SUV_PREMIUM]: 4900,
    },
  },
  {
    id: 'blr_ixe',
    fromCity: 'Bangalore',
    toCity: 'Mangalore',
    name: 'Bengaluru / Bangalore ⇄ Mangalore Airport (IXE)',
    fixedFares: {
      [VehicleCategory.HATCHBACK]: 4800,
      [VehicleCategory.SWIFT_DZIRE]: 5200,
      [VehicleCategory.TOYOTA_ETIOS]: 5600,
      [VehicleCategory.SUV_ERTIGA]: 6600,
      [VehicleCategory.SUV_CARENS]: 7400,
      [VehicleCategory.SUV_INNOVA]: 8200,
      [VehicleCategory.SUV_CRYSTA]: 9200,
      [VehicleCategory.TEMPO_TRAVELER]: 12500,
      [VehicleCategory.URBANIA]: 15000,
      [VehicleCategory.SEDAN]: 5200,
      [VehicleCategory.SUV]: 6600,
      [VehicleCategory.SUV_PREMIUM]: 9200,
    },
  },
];

export const DEFAULT_AIRPORT_FIXED_FARES: Record<string, number> = {
  [VehicleCategory.HATCHBACK]: 799,
  [VehicleCategory.SWIFT_DZIRE]: 899,
  [VehicleCategory.TOYOTA_ETIOS]: 999,
  [VehicleCategory.SUV_ERTIGA]: 1299,
  [VehicleCategory.SUV_CARENS]: 1499,
  [VehicleCategory.SUV_INNOVA]: 1699,
  [VehicleCategory.SUV_CRYSTA]: 1999,
  [VehicleCategory.TEMPO_TRAVELER]: 2999,
  [VehicleCategory.URBANIA]: 3499,
  [VehicleCategory.SEDAN]: 899,
  [VehicleCategory.SUV]: 1299,
  [VehicleCategory.SUV_PREMIUM]: 1999,
};

/**
 * Matches an airport route bidirectionally based on pickup and drop strings.
 */
export function matchAirportRoute(
  pickup: string | undefined,
  drop: string | undefined,
  routes: AirportRouteRate[] = DEFAULT_AIRPORT_ROUTES
): AirportRouteRate | null {
  if (!pickup || !drop) return null;
  const p = pickup.toLowerCase();
  const d = drop.toLowerCase();

  for (const route of routes) {
    const f = route.fromCity.toLowerCase();
    const t = route.toCity.toLowerCase();

    // Direct match (forward or backward)
    const matchForward = (p.includes(f) && d.includes(t));
    const matchBackward = (p.includes(t) && d.includes(f));
    if (matchForward || matchBackward) {
      return route;
    }

    // Common regional hub keywords
    const isMangaloreP = /mangaluru|mangalore|ixe|bajpe/i.test(p);
    const isMangaloreD = /mangaluru|mangalore|ixe|bajpe/i.test(d);
    const isBangaloreP = /bangalore|bengaluru|blr|kempegowda|devanahalli/i.test(p);
    const isBangaloreD = /bangalore|bengaluru|blr|kempegowda|devanahalli/i.test(d);
    const isCoorgP = /coorg|madikeri|kodagu|kushalnagar/i.test(p);
    const isCoorgD = /coorg|madikeri|kodagu|kushalnagar/i.test(d);

    if ((f === 'mangalore' || f === 'mangaluru') && (t === 'bangalore' || t === 'bengaluru')) {
      if ((isMangaloreP && isBangaloreD) || (isBangaloreP && isMangaloreD)) return route;
    }
    if ((f === 'mangalore' || f === 'mangaluru') && (t === 'coorg' || t === 'madikeri')) {
      if ((isMangaloreP && isCoorgD) || (isCoorgP && isMangaloreD)) return route;
    }
  }

  return null;
}

/**
 * For Airport Transfers, all rides are strictly billed as per-KM rate (No fixed prices).
 */
export function getAirportFareForVehicle(
  _category?: string,
  _pickup?: string,
  _drop?: string,
  _customRoutes?: AirportRouteRate[],
  _customDefaultFares?: Record<string, number>,
  _unlistedPricingMode?: 'PER_KM' | 'FIXED_FARE'
): { fixedFare: number; routeName: string; isMatchedRoute: boolean } {
  // All airport transfers are strictly charged as per-KM rate
  return {
    fixedFare: 0,
    routeName: '',
    isMatchedRoute: false,
  };
}

