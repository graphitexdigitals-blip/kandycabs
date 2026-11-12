export type CouponDiscountType = 'FIXED_AMOUNT' | 'PERCENTAGE';

export interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number; // ₹ amount or % percentage
  maxDiscount?: number | null; // Cap for percentage discounts (e.g. up to ₹500)
  minBookingAmount: number; // Minimum fare required to avail coupon (e.g. ₹500)
  validFrom: string; // ISO date string
  validTo?: string | null; // ISO date string or null for lifetime
  usageLimit?: number | null; // Max total redemptions allowed (null for unlimited)
  usageCount: number; // Number of times redeemed so far
  isActive: boolean;
  applicableTripTypes?: string[]; // e.g. ['ALL'] or ['ONEWAY', 'ROUND', 'AIRPORT', 'LOCAL', 'PACKAGE']
  createdAt: string;
  updatedAt: string;
}

export interface CouponValidationRequest {
  code: string;
  fare: number;
  tripType?: string;
  customerId?: string;
}

export interface CouponValidationResult {
  valid: boolean;
  message: string;
  coupon?: {
    id: string;
    code: string;
    description?: string;
    discountType: CouponDiscountType;
    discountValue: number;
    maxDiscount?: number | null;
    minBookingAmount: number;
    discountAmount: number; // Calculated discount in ₹
    finalFare: number; // Fare after discount
  };
}

