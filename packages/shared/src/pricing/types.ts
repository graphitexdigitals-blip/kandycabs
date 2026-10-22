import { VehicleCategory, FuelType, TripType } from '../types';

export interface VehicleRateConfig {
  category: VehicleCategory;
  name: string;
  description: string;
  seats: number;
  luggage: number;
  perKmRate: Record<FuelType, number>;
  extraKmRate: number;
  driverAllowancePerDay: number;
  nightCharge: number;
  minRoundTripKmPerDay: number;
  localPackages?: {
    hours: number;
    km: number;
    basePrice: number;
  }[];
}

export interface DynamicRateOverrides {
  ratePerKm?: number;
  extraKmRate?: number;
  extraKmThreshold?: number;
  driverAllowance?: number;
  nightCharge?: number;
  gstRatePercent?: number;
  nightWindowStartHour?: number;
  nightWindowEndHour?: number;
  minRoundTripKmPerDay?: number;
  localPackage4hrBase?: number;
  localPackage4hrKm?: number;
  localPackage4hrExtraKmRate?: number;
  localPackage8hrBase?: number;
  localPackage8hrKm?: number;
  localPackage8hrExtraKmRate?: number;
  localPackage12hrBase?: number;
  localPackage12hrKm?: number;
  localPackage12hrExtraKmRate?: number;
  extraHourRate?: number;
}

export interface PricingCalculationInput {
  category: VehicleCategory;
  fuelType?: FuelType;
  tripType: TripType;
  distanceKm: number;
  scheduledAt: Date | string;
  durationDays?: number;
  packageHours?: number;
  couponCode?: string;
  overrides?: DynamicRateOverrides;
  hasPet?: boolean;
  petFee?: number;
}

export interface PricingBreakdown {
  category: VehicleCategory;
  fuelType: FuelType;
  tripType: TripType;
  billableDistanceKm: number;
  actualDistanceKm: number;
  baseFare: number;
  extraKmCharge: number;
  extraKmThreshold?: number;
  driverAllowance: number;
  nightCharge: number;
  subtotal: number;
  gstAmount: number; // 5% GST
  discount: number;
  totalFare: number;
  advanceAmount: number; // 25%
  balanceAmount: number; // 75%
  isNightTime: boolean;
  ratePerKm: number;
  hasPet?: boolean;
  petCharge?: number;
}

export interface QuoteRequest {
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropAddress: string;
  dropLat: number;
  dropLng: number;
  tripType: TripType;
  scheduledAt: string;
  durationDays?: number;
  packageHours?: number;
  stops?: { address: string; lat: number; lng: number }[];
  category?: VehicleCategory;
  fuelType?: FuelType;
  couponCode?: string;
}

export interface FuelQuoteOption {
  fuelType: FuelType;
  ratePerKm: number;
  pricing: PricingBreakdown;
  isEnabled: boolean;
}

export interface QuoteResponse {
  success: boolean;
  distanceKm: number;
  estimatedDurationMins?: number;
  quotes: {
    category: VehicleCategory;
    name: string;
    description: string;
    seats: number;
    luggage: number;
    fuelTypes: FuelType[];
    pricing: PricingBreakdown;
    fuelOptions?: FuelQuoteOption[];
  }[];
}
