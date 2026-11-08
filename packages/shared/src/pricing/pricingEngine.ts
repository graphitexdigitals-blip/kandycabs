import { VehicleCategory, FuelType, TripType } from '../types';
import {
  VehicleRateConfig,
  PricingCalculationInput,
  PricingBreakdown,
} from './types';

export const VEHICLE_RATES: Record<VehicleCategory, VehicleRateConfig> = {
  [VehicleCategory.HATCHBACK]: {
    category: VehicleCategory.HATCHBACK,
    name: 'Swift or equivalent',
    description: 'Swift, WagonR, Tiago or equivalent',
    seats: 4,
    luggage: 2,
    perKmRate: {
      [FuelType.CNG]: 11.0,
      [FuelType.PETROL]: 12.0,
      [FuelType.DIESEL]: 13.0,
    },
    extraKmRate: 13.0,
    driverAllowancePerDay: 300.0,
    nightCharge: 250.0,
    minRoundTripKmPerDay: 250,
    localPackages: [
      { hours: 4, km: 40, basePrice: 1000 },
      { hours: 8, km: 80, basePrice: 1800 },
    ],
  },
  [VehicleCategory.SEDAN]: {
    category: VehicleCategory.SEDAN,
    name: 'Dzire or equivalent',
    description: 'Dzire, Etios, Amaze or equivalent',
    seats: 4,
    luggage: 3,
    perKmRate: {
      [FuelType.CNG]: 13.0,
      [FuelType.PETROL]: 14.0,
      [FuelType.DIESEL]: 15.0,
    },
    extraKmRate: 15.0,
    driverAllowancePerDay: 350.0,
    nightCharge: 250.0,
    minRoundTripKmPerDay: 250,
    localPackages: [
      { hours: 4, km: 40, basePrice: 1200 },
      { hours: 8, km: 80, basePrice: 2200 },
    ],
  },
  [VehicleCategory.SUV]: {
    category: VehicleCategory.SUV,
    name: 'Ertiga or equivalent',
    description: 'Ertiga, Triber, Carens or equivalent',
    seats: 6,
    luggage: 4,
    perKmRate: {
      [FuelType.CNG]: 16.0,
      [FuelType.PETROL]: 17.0,
      [FuelType.DIESEL]: 18.0,
    },
    extraKmRate: 19.0,
    driverAllowancePerDay: 400.0,
    nightCharge: 300.0,
    minRoundTripKmPerDay: 250,
    localPackages: [
      { hours: 4, km: 40, basePrice: 1600 },
      { hours: 8, km: 80, basePrice: 2800 },
    ],
  },
  [VehicleCategory.SUV_PREMIUM]: {
    category: VehicleCategory.SUV_PREMIUM,
    name: 'Innova Crysta or equivalent',
    description: 'Innova Crysta, Safari or equivalent',
    seats: 7,
    luggage: 5,
    perKmRate: {
      [FuelType.CNG]: 22.0,
      [FuelType.PETROL]: 23.0,
      [FuelType.DIESEL]: 24.0,
    },
    extraKmRate: 25.0,
    driverAllowancePerDay: 500.0,
    nightCharge: 350.0,
    minRoundTripKmPerDay: 250,
    localPackages: [
      { hours: 4, km: 40, basePrice: 2200 },
      { hours: 8, km: 80, basePrice: 3800 },
    ],
  },
  [VehicleCategory.TEMPO_TRAVELER]: {
    category: VehicleCategory.TEMPO_TRAVELER,
    name: 'Tempo Traveller or equivalent',
    description: 'Force Traveller luxury group carrier',
    seats: 12,
    luggage: 10,
    perKmRate: {
      [FuelType.CNG]: 28.0,
      [FuelType.PETROL]: 29.0,
      [FuelType.DIESEL]: 30.0,
    },
    extraKmRate: 32.0,
    driverAllowancePerDay: 600.0,
    nightCharge: 500.0,
    minRoundTripKmPerDay: 300,
    localPackages: [
      { hours: 4, km: 40, basePrice: 3000 },
      { hours: 8, km: 80, basePrice: 5500 },
    ],
  },
  [VehicleCategory.SWIFT_DZIRE]: {
    category: VehicleCategory.SWIFT_DZIRE,
    name: 'Sedan – Swift Dzire',
    description: 'Maruti Suzuki Dzire or equivalent',
    seats: 4,
    luggage: 3,
    perKmRate: {
      [FuelType.CNG]: 13.0,
      [FuelType.PETROL]: 14.0,
      [FuelType.DIESEL]: 15.0,
    },
    extraKmRate: 15.0,
    driverAllowancePerDay: 350.0,
    nightCharge: 250.0,
    minRoundTripKmPerDay: 250,
    localPackages: [
      { hours: 4, km: 40, basePrice: 1200 },
      { hours: 8, km: 80, basePrice: 2200 },
    ],
  },
  [VehicleCategory.TOYOTA_ETIOS]: {
    category: VehicleCategory.TOYOTA_ETIOS,
    name: 'Sedan – Toyota Etios',
    description: 'Toyota Etios Diesel with Large Boot Space',
    seats: 4,
    luggage: 4,
    perKmRate: {
      [FuelType.CNG]: 13.0,
      [FuelType.PETROL]: 14.0,
      [FuelType.DIESEL]: 15.0,
    },
    extraKmRate: 15.0,
    driverAllowancePerDay: 350.0,
    nightCharge: 250.0,
    minRoundTripKmPerDay: 250,
    localPackages: [
      { hours: 4, km: 40, basePrice: 1200 },
      { hours: 8, km: 80, basePrice: 2200 },
    ],
  },
  [VehicleCategory.SUV_ERTIGA]: {
    category: VehicleCategory.SUV_ERTIGA,
    name: 'SUVs Ertiga',
    description: 'Maruti Suzuki Ertiga or equivalent',
    seats: 6,
    luggage: 4,
    perKmRate: {
      [FuelType.CNG]: 16.0,
      [FuelType.PETROL]: 17.0,
      [FuelType.DIESEL]: 18.0,
    },
    extraKmRate: 19.0,
    driverAllowancePerDay: 400.0,
    nightCharge: 300.0,
    minRoundTripKmPerDay: 250,
    localPackages: [
      { hours: 4, km: 40, basePrice: 1600 },
      { hours: 8, km: 80, basePrice: 2800 },
    ],
  },
  [VehicleCategory.SUV_CARENS]: {
    category: VehicleCategory.SUV_CARENS,
    name: 'SUVs Kia Carens',
    description: 'Kia Carens Diesel Luxury 6+1',
    seats: 6,
    luggage: 4,
    perKmRate: {
      [FuelType.CNG]: 17.0,
      [FuelType.PETROL]: 18.0,
      [FuelType.DIESEL]: 19.0,
    },
    extraKmRate: 20.0,
    driverAllowancePerDay: 450.0,
    nightCharge: 300.0,
    minRoundTripKmPerDay: 250,
    localPackages: [
      { hours: 4, km: 40, basePrice: 1800 },
      { hours: 8, km: 80, basePrice: 3200 },
    ],
  },
  [VehicleCategory.SUV_INNOVA]: {
    category: VehicleCategory.SUV_INNOVA,
    name: 'SUVs Toyota Innova',
    description: 'Toyota Innova Diesel 7+1 Touring',
    seats: 7,
    luggage: 5,
    perKmRate: {
      [FuelType.CNG]: 19.0,
      [FuelType.PETROL]: 20.0,
      [FuelType.DIESEL]: 21.0,
    },
    extraKmRate: 22.0,
    driverAllowancePerDay: 500.0,
    nightCharge: 350.0,
    minRoundTripKmPerDay: 250,
    localPackages: [
      { hours: 4, km: 40, basePrice: 2000 },
      { hours: 8, km: 80, basePrice: 3500 },
    ],
  },
  [VehicleCategory.SUV_CRYSTA]: {
    category: VehicleCategory.SUV_CRYSTA,
    name: 'SUVs Innova Crysta',
    description: 'Toyota Innova Crysta Diesel Luxury',
    seats: 7,
    luggage: 5,
    perKmRate: {
      [FuelType.CNG]: 22.0,
      [FuelType.PETROL]: 23.0,
      [FuelType.DIESEL]: 24.0,
    },
    extraKmRate: 25.0,
    driverAllowancePerDay: 500.0,
    nightCharge: 350.0,
    minRoundTripKmPerDay: 250,
    localPackages: [
      { hours: 4, km: 40, basePrice: 2200 },
      { hours: 8, km: 80, basePrice: 3800 },
    ],
  },
  [VehicleCategory.URBANIA]: {
    category: VehicleCategory.URBANIA,
    name: 'Force Urbania',
    description: '10/13/17 Seater Force Urbania AC Luxury Van',
    seats: 17,
    luggage: 10,
    perKmRate: {
      [FuelType.CNG]: 30.0,
      [FuelType.PETROL]: 31.0,
      [FuelType.DIESEL]: 32.0,
    },
    extraKmRate: 34.0,
    driverAllowancePerDay: 650.0,
    nightCharge: 500.0,
    minRoundTripKmPerDay: 300,
    localPackages: [
      { hours: 4, km: 40, basePrice: 3500 },
      { hours: 8, km: 80, basePrice: 6500 },
    ],
  },
};

/**
 * Checks if a given timestamp falls in the night window (default 10:00 PM to 6:00 AM)
 */
export function isNightTimeWindow(
  date: Date | string,
  startHour: number = 22,
  endHour: number = 6
): boolean {
  const d = new Date(date);
  const hours = d.getHours();
  if (startHour > endHour) {
    return hours >= startHour || hours < endHour;
  }
  return hours >= startHour && hours < endHour;
}

/**
 * Server-authoritative pure pricing function.
 * Calculates exact fare, night charge, taxes, advance (25%), and balance (75%).
 */
export function calculateFare(input: PricingCalculationInput): PricingBreakdown {
  const {
    category,
    tripType,
    distanceKm,
    scheduledAt,
    durationDays = 1,
    couponCode,
    overrides,
  } = input;

  const config = VEHICLE_RATES[category] || VEHICLE_RATES[VehicleCategory.SEDAN];
  const fuelType = input.fuelType || (category === VehicleCategory.HATCHBACK ? FuelType.PETROL : FuelType.DIESEL);
  
  const ratePerKm = overrides?.ratePerKm !== undefined ? overrides.ratePerKm : (config.perKmRate[fuelType] || config.perKmRate[FuelType.DIESEL] || 14.0);
  const extraKmRate = overrides?.extraKmRate !== undefined ? overrides.extraKmRate : config.extraKmRate;
  const extraKmThreshold = overrides?.extraKmThreshold !== undefined && overrides.extraKmThreshold > 0 ? overrides.extraKmThreshold : undefined;
  const driverAllowancePerDay = overrides?.driverAllowance !== undefined ? overrides.driverAllowance : config.driverAllowancePerDay;
  const nightChargeAmount = overrides?.nightCharge !== undefined ? overrides.nightCharge : config.nightCharge;
  const minRoundTripKmPerDay = overrides?.minRoundTripKmPerDay !== undefined ? overrides.minRoundTripKmPerDay : config.minRoundTripKmPerDay;
  const gstRatePercent = overrides?.gstRatePercent !== undefined ? overrides.gstRatePercent : 5.0;

  const isNight = isNightTimeWindow(
    scheduledAt,
    overrides?.nightWindowStartHour ?? 22,
    overrides?.nightWindowEndHour ?? 6
  );
  const nightCharge = isNight ? nightChargeAmount : 0;

  let billableDistanceKm = distanceKm;
  let baseFare = 0;
  let extraKmCharge = 0;
  let driverAllowance = 0;

  const days = Math.max(1, durationDays);

  switch (tripType) {
    case TripType.ROUND: {
      // Round trip: min km/day rule or custom admin extraKmThreshold
      const dailyMin = extraKmThreshold || minRoundTripKmPerDay;
      const minRequiredKm = days * dailyMin;
      const totalEstimatedKm = distanceKm * 2;
      
      if (totalEstimatedKm > minRequiredKm) {
        billableDistanceKm = totalEstimatedKm;
        baseFare = minRequiredKm * ratePerKm;
        extraKmCharge = (totalEstimatedKm - minRequiredKm) * extraKmRate;
      } else {
        billableDistanceKm = minRequiredKm;
        baseFare = billableDistanceKm * ratePerKm;
      }
      driverAllowance = days * driverAllowancePerDay;
      break;
    }
    case TripType.ONEWAY: {
      // If admin configured a custom extraKmThreshold (e.g. 50 km, 100 km)
      if (extraKmThreshold) {
        if (distanceKm > extraKmThreshold) {
          billableDistanceKm = distanceKm;
          baseFare = extraKmThreshold * ratePerKm;
          extraKmCharge = (distanceKm - extraKmThreshold) * extraKmRate;
        } else {
          billableDistanceKm = extraKmThreshold;
          baseFare = billableDistanceKm * ratePerKm;
        }
      } else {
        // Default standard minimum 50 km for oneway outstation/city rides
        billableDistanceKm = Math.max(distanceKm, 50);
        baseFare = billableDistanceKm * ratePerKm;
      }
      // Driver allowance for long oneway trips (> 200 km)
      if (billableDistanceKm > 200) {
        driverAllowance = driverAllowancePerDay;
      }
      break;
    }
    case TripType.AIRPORT: {
      // Minimum 35 km for airport transfers or custom admin threshold
      const airportThreshold = extraKmThreshold || 35;
      if (distanceKm > airportThreshold) {
        billableDistanceKm = distanceKm;
        baseFare = airportThreshold * ratePerKm;
        extraKmCharge = (distanceKm - airportThreshold) * extraKmRate;
      } else {
        billableDistanceKm = airportThreshold;
        baseFare = billableDistanceKm * ratePerKm;
      }
      break;
    }
    case TripType.LOCAL:
    case TripType.PACKAGE: {
      const hours = input.packageHours || 8;
      let pkgKm = 80;
      let basePrice = 2200;
      let pkgExtraKmRate = extraKmRate;

      if (hours <= 4) {
        pkgKm = overrides?.localPackage4hrKm || extraKmThreshold || 40;
        const default4hr = config.localPackages?.find((p) => p.hours === 4)?.basePrice || 1200;
        basePrice = overrides?.localPackage4hrBase !== undefined ? overrides.localPackage4hrBase : default4hr;
        pkgExtraKmRate = overrides?.localPackage4hrExtraKmRate !== undefined ? overrides.localPackage4hrExtraKmRate : extraKmRate;
      } else if (hours <= 8) {
        pkgKm = overrides?.localPackage8hrKm || extraKmThreshold || 80;
        const default8hr = config.localPackages?.find((p) => p.hours === 8)?.basePrice || 2200;
        basePrice = overrides?.localPackage8hrBase !== undefined ? overrides.localPackage8hrBase : default8hr;
        pkgExtraKmRate = overrides?.localPackage8hrExtraKmRate !== undefined ? overrides.localPackage8hrExtraKmRate : extraKmRate;
      } else {
        // 12 Hours or custom extended local package
        pkgKm = overrides?.localPackage12hrKm || (overrides?.localPackage8hrKm ? Math.round(overrides.localPackage8hrKm * 1.5) : 120);
        const default12hr = overrides?.localPackage8hrBase ? Math.round(overrides.localPackage8hrBase * 1.45) : 3200;
        basePrice = overrides?.localPackage12hrBase !== undefined ? overrides.localPackage12hrBase : default12hr;
        pkgExtraKmRate = overrides?.localPackage12hrExtraKmRate !== undefined ? overrides.localPackage12hrExtraKmRate : extraKmRate;
      }

      baseFare = basePrice;
      billableDistanceKm = Math.max(distanceKm, pkgKm);
      if (distanceKm > pkgKm) {
        extraKmCharge = (distanceKm - pkgKm) * pkgExtraKmRate;
      }
      break;
    }
    default: {
      billableDistanceKm = Math.max(distanceKm, 50);
      baseFare = billableDistanceKm * ratePerKm;
    }
  }

  // Pet Friendly surcharge (flat ₹500 standard convenience/sanitization fee)
  const hasPet = Boolean(input.hasPet);
  const petCharge = hasPet ? (input.petFee !== undefined ? input.petFee : 500) : 0;

  // Pre-tax subtotal
  let subtotal = baseFare + extraKmCharge + driverAllowance + nightCharge + petCharge;

  // Coupon discount logic
  let discount = 0;
  if (couponCode) {
    const code = couponCode.trim().toUpperCase();
    if (code === 'KANDY10') {
      discount = Math.min(Math.round(subtotal * 0.1), 500); // 10% max ₹500
    } else if (code === 'FIRST50') {
      discount = 50;
    }
  }

  subtotal = Math.max(0, subtotal - discount);

  // Dynamic GST calculation
  const gstAmount = Math.round(subtotal * (gstRatePercent / 100) * 100) / 100;
  const totalFare = Math.round((subtotal + gstAmount) * 100) / 100;

  // 30% Advance, 70% Balance
  const advanceAmount = Math.round(totalFare * 0.30);
  const balanceAmount = Math.round((totalFare - advanceAmount) * 100) / 100;

  return {
    category,
    fuelType,
    tripType,
    billableDistanceKm: Math.round(billableDistanceKm * 10) / 10,
    actualDistanceKm: Math.round(distanceKm * 10) / 10,
    baseFare: Math.round(baseFare * 100) / 100,
    extraKmCharge: Math.round(extraKmCharge * 100) / 100,
    extraKmThreshold,
    driverAllowance: Math.round(driverAllowance * 100) / 100,
    nightCharge: Math.round(nightCharge * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    gstAmount,
    discount,
    totalFare,
    advanceAmount,
    balanceAmount,
    isNightTime: isNight,
    ratePerKm,
    hasPet,
    petCharge,
  };
}
