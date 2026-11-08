export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum DriverVerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum VehicleCategory {
  HATCHBACK = 'HATCHBACK',
  SEDAN = 'SEDAN',
  SUV = 'SUV',
  SUV_PREMIUM = 'SUV_PREMIUM',
  TEMPO_TRAVELER = 'TEMPO_TRAVELER',
  SWIFT_DZIRE = 'SWIFT_DZIRE',
  TOYOTA_ETIOS = 'TOYOTA_ETIOS',
  SUV_ERTIGA = 'SUV_ERTIGA',
  SUV_CARENS = 'SUV_CARENS',
  SUV_INNOVA = 'SUV_INNOVA',
  SUV_CRYSTA = 'SUV_CRYSTA',
  URBANIA = 'URBANIA',
}

export enum FuelType {
  CNG = 'CNG',
  DIESEL = 'DIESEL',
  PETROL = 'PETROL',
}

export enum TripType {
  ONEWAY = 'ONEWAY',
  ROUND = 'ROUND',
  LOCAL = 'LOCAL',
  AIRPORT = 'AIRPORT',
  PACKAGE = 'PACKAGE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum BookingStatus {
  PENDING_ADMIN = 'PENDING_ADMIN',
  DISPATCHED = 'DISPATCHED',
  DRIVER_ACCEPTED = 'DRIVER_ACCEPTED',
  DRIVER_EN_ROUTE = 'DRIVER_EN_ROUTE',
  TRIP_STARTED = 'TRIP_STARTED',
  TRIP_COMPLETED = 'TRIP_COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum DispatchStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentType {
  ADVANCE = 'ADVANCE',
  BALANCE = 'BALANCE',
}

export interface HealthCheckResponse {
  status: 'ok' | 'db_unreachable';
  timestamp?: string;
  uptime?: number;
}

export interface FleetCategoryItem {
  id: string;
  category: VehicleCategory;
  name: string;
  description?: string | null;
  seatCount: number;
  luggageCount: number;
  cngRate?: number;
  petrolRate?: number;
  dieselRate?: number;
  extraKmRate?: number;
  driverAllowance?: number;
  nightCharge?: number;
  minRoundTripKmPerDay?: number;
  hasCarrier?: boolean;
  carrierCapacityText?: string | null;
  carrierExcludedCars?: string | null;
  carrierExcludedReason?: string | null;
  isContactOnly?: boolean;
  imageUrl?: string | null;
  isActive: boolean;
}

export interface PricingRuleItem {
  id: string;
  category: VehicleCategory;
  tripType: TripType;
  fuelType: FuelType;
  baseRatePerKm: number;
  extraKmRate: number;
  driverAllowance: number;
  nightCharge: number;
  gstRatePercent: number;
  nightWindowStartHour: number;
  nightWindowEndHour: number;
  inclusions: string[];
  exclusions: string[];
  isActive: boolean;
}

export interface PaymentSummary {
  totalRevenue: number;
  totalBookings: number;
  paidCount: number;
  partiallyPaidCount: number;
  pendingCount: number;
}

export interface OdometerEvidenceItem {
  bookingId: string;
  humanReadableRef: string;
  customerName: string;
  customerPhone: string;
  driverName?: string;
  driverPhone?: string;
  vehiclePlate?: string;
  category: VehicleCategory;
  scheduledAt: string;
  tripType: TripType;
  startingOdometer?: number | null;
  startingOdometerImagePath?: string | null;
  finalOdometer?: number | null;
  finalOdometerImagePath?: string | null;
  odometerDistanceKm?: number | null;
  gpsTrackedDistanceKm?: number | null;
  estimatedDistanceKm: number;
  discrepancyPercent?: number | null;
  hasDiscrepancy: boolean;
  status: BookingStatus;
}

export interface VehicleEvidenceItem {
  driverId: string;
  userId: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
  licenseDocUrl?: string | null;
  rcDocUrl?: string | null;
  insuranceDocUrl?: string | null;
  vehiclePhotos: string[];
  verificationStatus: DriverVerificationStatus;
  adminNotes?: string | null;
  vehicle?: {
    category: VehicleCategory;
    fuelType: FuelType;
    plateNumber?: string | null;
    seatCount: number;
  } | null;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  actorUserId?: string | null;
  actorName?: string;
  actorPhone?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  createdAt: string;
}
