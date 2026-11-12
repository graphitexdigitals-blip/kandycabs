import fs from 'fs';
import path from 'path';
import { prisma } from '@kandy-cabs/db';
import type { Coupon, CouponDiscountType, CouponValidationResult } from '@kandy-cabs/shared';

const ROOT_DATA_FILE = path.join(process.cwd(), '..', '..', '.coupons_store.json');
const ADMIN_DATA_FILE = path.join(process.cwd(), '.coupons_store.json');

const DEFAULT_COUPONS: Coupon[] = [
  {
    id: 'coupon-welcome-100',
    code: 'WELCOME100',
    description: 'Welcome offer! Flat ₹100 off on your first cab booking',
    discountType: 'FIXED_AMOUNT',
    discountValue: 100,
    maxDiscount: null,
    minBookingAmount: 500,
    validFrom: new Date(Date.now() - 30 * 86400000).toISOString(),
    validTo: null,
    usageLimit: 500,
    usageCount: 18,
    isActive: true,
    applicableTripTypes: ['ALL'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'coupon-kandy-15',
    code: 'KANDY15',
    description: 'Special 15% discount up to ₹400 on outstation & round trips',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    maxDiscount: 400,
    minBookingAmount: 1200,
    validFrom: new Date(Date.now() - 15 * 86400000).toISOString(),
    validTo: null,
    usageLimit: 1000,
    usageCount: 42,
    isActive: true,
    applicableTripTypes: ['ROUND', 'ONEWAY'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'coupon-festive-500',
    code: 'FESTIVE500',
    description: 'Mega Festive Savings! Flat ₹500 off on long outstation bookings',
    discountType: 'FIXED_AMOUNT',
    discountValue: 500,
    maxDiscount: null,
    minBookingAmount: 3500,
    validFrom: new Date().toISOString(),
    validTo: new Date(Date.now() + 60 * 86400000).toISOString(),
    usageLimit: 250,
    usageCount: 9,
    isActive: true,
    applicableTripTypes: ['ALL'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'coupon-airport-10',
    code: 'AIRPORT10',
    description: '10% discount on Mangaluru & Bengaluru Airport transfers',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxDiscount: 250,
    minBookingAmount: 800,
    validFrom: new Date().toISOString(),
    validTo: null,
    usageLimit: 500,
    usageCount: 26,
    isActive: true,
    applicableTripTypes: ['AIRPORT'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let isTableInitialized = false;

export async function ensureCouponTable(): Promise<void> {
  if (isTableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Coupon" (
        "id" TEXT PRIMARY KEY,
        "code" TEXT UNIQUE NOT NULL,
        "description" TEXT,
        "discountType" TEXT NOT NULL DEFAULT 'FIXED_AMOUNT',
        "discountValue" DECIMAL(10, 2) NOT NULL,
        "maxDiscount" DECIMAL(10, 2),
        "minBookingAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0.0,
        "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "validTo" TIMESTAMP(3),
        "usageLimit" INTEGER,
        "usageCount" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "applicableTripTypes" TEXT[] DEFAULT ARRAY['ALL']::TEXT[],
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "Coupon_code_idx" ON "Coupon"("code");
      CREATE INDEX IF NOT EXISTS "Coupon_isActive_idx" ON "Coupon"("isActive");
      ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "couponCode" TEXT;
      ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "couponDiscount" DECIMAL(10, 2);
    `);
    isTableInitialized = true;
  } catch (err) {
    // If table creation fails or already exists, continue with file fallback
    console.warn('[couponStore] PostgreSQL table creation notice:', err);
    isTableInitialized = true;
  }
}

function readCouponsFromFile(): Coupon[] {
  try {
    const candidates = [ADMIN_DATA_FILE, ROOT_DATA_FILE];
    for (const f of candidates) {
      if (fs.existsSync(f)) {
        const raw = fs.readFileSync(f, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn('[couponStore] Error reading file store:', e);
  }
  return DEFAULT_COUPONS;
}

function writeCouponsToFile(coupons: Coupon[]): void {
  try {
    const serialized = JSON.stringify(coupons, null, 2);
    fs.writeFileSync(ADMIN_DATA_FILE, serialized, 'utf8');
    try {
      fs.writeFileSync(ROOT_DATA_FILE, serialized, 'utf8');
    } catch {}
  } catch (e) {
    console.warn('[couponStore] Error writing file store:', e);
  }
}

export async function getAllCoupons(): Promise<Coupon[]> {
  await ensureCouponTable();
  try {
    const rows: any = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Coupon" ORDER BY "createdAt" DESC;
    `);
    if (Array.isArray(rows) && rows.length > 0) {
      const formatted: Coupon[] = rows.map((r: any) => ({
        id: String(r.id),
        code: String(r.code).toUpperCase(),
        description: r.description || '',
        discountType: (r.discountType === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED_AMOUNT') as CouponDiscountType,
        discountValue: Number(r.discountValue),
        maxDiscount: r.maxDiscount != null ? Number(r.maxDiscount) : null,
        minBookingAmount: Number(r.minBookingAmount || 0),
        validFrom: new Date(r.validFrom).toISOString(),
        validTo: r.validTo ? new Date(r.validTo).toISOString() : null,
        usageLimit: r.usageLimit != null ? Number(r.usageLimit) : null,
        usageCount: Number(r.usageCount || 0),
        isActive: Boolean(r.isActive),
        applicableTripTypes: Array.isArray(r.applicableTripTypes) ? r.applicableTripTypes : ['ALL'],
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      }));
      writeCouponsToFile(formatted);
      return formatted;
    }
  } catch (err) {
    console.warn('[couponStore] DB read failed, falling back to file store:', err);
  }

  // Fallback to file store / defaults
  const fileCoupons = readCouponsFromFile();
  // Try to seed DB asynchronously
  seedCouponsToDb(fileCoupons).catch(() => {});
  return fileCoupons;
}

async function seedCouponsToDb(coupons: Coupon[]) {
  try {
    for (const c of coupons) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Coupon" ("id", "code", "description", "discountType", "discountValue", "maxDiscount", "minBookingAmount", "validFrom", "validTo", "usageLimit", "usageCount", "isActive", "applicableTripTypes", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT ("code") DO NOTHING;
      `,
        c.id,
        c.code.toUpperCase(),
        c.description || '',
        c.discountType,
        c.discountValue,
        c.maxDiscount,
        c.minBookingAmount,
        new Date(c.validFrom),
        c.validTo ? new Date(c.validTo) : null,
        c.usageLimit,
        c.usageCount,
        c.isActive,
        c.applicableTripTypes || ['ALL'],
        new Date(c.createdAt),
        new Date(c.updatedAt)
      );
    }
  } catch {}
}

export async function createCoupon(data: {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount?: number | null;
  minBookingAmount?: number;
  validFrom?: string;
  validTo?: string | null;
  usageLimit?: number | null;
  isActive?: boolean;
  applicableTripTypes?: string[];
}): Promise<Coupon> {
  await ensureCouponTable();
  const normalizedCode = data.code.trim().toUpperCase();
  if (!normalizedCode) throw new Error('Coupon code is required');
  if (data.discountValue <= 0) throw new Error('Discount value must be greater than 0');
  if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
    throw new Error('Percentage discount cannot exceed 100%');
  }

  const existing = await getCouponByCode(normalizedCode);
  if (existing) {
    throw new Error(`Coupon with code "${normalizedCode}" already exists`);
  }

  const newCoupon: Coupon = {
    id: `coupon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code: normalizedCode,
    description: data.description?.trim() || '',
    discountType: data.discountType,
    discountValue: Number(data.discountValue),
    maxDiscount: data.discountType === 'PERCENTAGE' && data.maxDiscount ? Number(data.maxDiscount) : null,
    minBookingAmount: Math.max(0, Number(data.minBookingAmount || 0)),
    validFrom: data.validFrom ? new Date(data.validFrom).toISOString() : new Date().toISOString(),
    validTo: data.validTo ? new Date(data.validTo).toISOString() : null,
    usageLimit: data.usageLimit != null ? Number(data.usageLimit) : null,
    usageCount: 0,
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    applicableTripTypes: Array.isArray(data.applicableTripTypes) && data.applicableTripTypes.length > 0 ? data.applicableTripTypes : ['ALL'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Try DB insert
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Coupon" ("id", "code", "description", "discountType", "discountValue", "maxDiscount", "minBookingAmount", "validFrom", "validTo", "usageLimit", "usageCount", "isActive", "applicableTripTypes", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);
    `,
      newCoupon.id,
      newCoupon.code,
      newCoupon.description,
      newCoupon.discountType,
      newCoupon.discountValue,
      newCoupon.maxDiscount,
      newCoupon.minBookingAmount,
      new Date(newCoupon.validFrom),
      newCoupon.validTo ? new Date(newCoupon.validTo) : null,
      newCoupon.usageLimit,
      newCoupon.usageCount,
      newCoupon.isActive,
      newCoupon.applicableTripTypes,
      new Date(newCoupon.createdAt),
      new Date(newCoupon.updatedAt)
    );
  } catch (err: any) {
    console.warn('[couponStore] DB insert error, writing to file backup:', err);
  }

  // 2. Write to file store
  const all = readCouponsFromFile();
  const updated = [newCoupon, ...all.filter(c => c.code !== normalizedCode)];
  writeCouponsToFile(updated);

  return newCoupon;
}

export async function updateCoupon(id: string, data: Partial<Coupon>): Promise<Coupon> {
  await ensureCouponTable();
  const all = await getAllCoupons();
  const index = all.findIndex(c => c.id === id || c.code === id.toUpperCase());
  if (index === -1) throw new Error('Coupon not found');

  const current = all[index];
  const updatedCoupon: Coupon = {
    ...current,
    ...data,
    code: data.code ? data.code.trim().toUpperCase() : current.code,
    discountValue: data.discountValue !== undefined ? Number(data.discountValue) : current.discountValue,
    maxDiscount: data.discountType === 'PERCENTAGE' || current.discountType === 'PERCENTAGE'
      ? (data.maxDiscount !== undefined ? (data.maxDiscount ? Number(data.maxDiscount) : null) : current.maxDiscount)
      : null,
    minBookingAmount: data.minBookingAmount !== undefined ? Number(data.minBookingAmount) : current.minBookingAmount,
    updatedAt: new Date().toISOString(),
  };

  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "Coupon"
      SET "code" = $1, "description" = $2, "discountType" = $3, "discountValue" = $4,
          "maxDiscount" = $5, "minBookingAmount" = $6, "validFrom" = $7, "validTo" = $8,
          "usageLimit" = $9, "isActive" = $10, "applicableTripTypes" = $11, "updatedAt" = $12
      WHERE "id" = $13 OR "code" = $13;
    `,
      updatedCoupon.code,
      updatedCoupon.description || '',
      updatedCoupon.discountType,
      updatedCoupon.discountValue,
      updatedCoupon.maxDiscount,
      updatedCoupon.minBookingAmount,
      new Date(updatedCoupon.validFrom),
      updatedCoupon.validTo ? new Date(updatedCoupon.validTo) : null,
      updatedCoupon.usageLimit,
      updatedCoupon.isActive,
      updatedCoupon.applicableTripTypes || ['ALL'],
      new Date(updatedCoupon.updatedAt),
      id
    );
  } catch (err) {
    console.warn('[couponStore] DB update error:', err);
  }

  all[index] = updatedCoupon;
  writeCouponsToFile(all);
  return updatedCoupon;
}

export async function deleteCoupon(id: string): Promise<boolean> {
  await ensureCouponTable();
  try {
    await prisma.$executeRawUnsafe(`
      DELETE FROM "Coupon" WHERE "id" = $1 OR "code" = $1;
    `, id);
  } catch (err) {
    console.warn('[couponStore] DB delete error:', err);
  }

  const all = readCouponsFromFile();
  const filtered = all.filter(c => c.id !== id && c.code !== id.toUpperCase());
  writeCouponsToFile(filtered);
  return true;
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const normalized = code.trim().toUpperCase();
  const all = await getAllCoupons();
  return all.find(c => c.code === normalized) || null;
}

export async function recordCouponUsage(code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "Coupon"
      SET "usageCount" = "usageCount" + 1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE UPPER("code") = $1;
    `, normalized);
  } catch {}

  const all = readCouponsFromFile();
  const target = all.find(c => c.code === normalized);
  if (target) {
    target.usageCount = (target.usageCount || 0) + 1;
    target.updatedAt = new Date().toISOString();
    writeCouponsToFile(all);
  }
}

/**
 * Validates a coupon code against a booking fare and returns the calculated discount
 */
export async function validateCoupon(
  code: string,
  fare: number,
  tripType?: string
): Promise<CouponValidationResult> {
  const normalized = (code || '').trim().toUpperCase();
  if (!normalized) {
    return { valid: false, message: 'Please enter a coupon code.' };
  }

  const coupon = await getCouponByCode(normalized);
  if (!coupon) {
    return {
      valid: false,
      message: `Coupon "${normalized}" is invalid or does not exist.`,
    };
  }

  if (!coupon.isActive) {
    return {
      valid: false,
      message: `Coupon "${normalized}" is currently paused or inactive.`,
    };
  }

  const now = new Date();
  if (coupon.validFrom && new Date(coupon.validFrom) > now) {
    return {
      valid: false,
      message: `Coupon "${normalized}" is not active yet. Starts on ${new Date(coupon.validFrom).toLocaleDateString()}.`,
    };
  }

  if (coupon.validTo && new Date(coupon.validTo) < now) {
    return {
      valid: false,
      message: `Coupon "${normalized}" has expired on ${new Date(coupon.validTo).toLocaleDateString()}.`,
    };
  }

  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    return {
      valid: false,
      message: `Coupon "${normalized}" redemption limit has been reached.`,
    };
  }

  if (coupon.applicableTripTypes && !coupon.applicableTripTypes.includes('ALL')) {
    if (tripType && !coupon.applicableTripTypes.includes(tripType)) {
      return {
        valid: false,
        message: `Coupon "${normalized}" is only valid for ${coupon.applicableTripTypes.join(', ')} trips.`,
      };
    }
  }

  const minFare = Number(coupon.minBookingAmount || 0);
  if (fare < minFare) {
    return {
      valid: false,
      message: `Coupon "${normalized}" requires a minimum booking fare of ₹${minFare.toLocaleString('en-IN')}. (Current fare: ₹${Math.round(fare).toLocaleString('en-IN')})`,
    };
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discountType === 'FIXED_AMOUNT') {
    discountAmount = Math.min(coupon.discountValue, fare);
  } else {
    // Percentage discount
    const rawDiscount = Math.round((fare * coupon.discountValue) / 100);
    discountAmount = coupon.maxDiscount
      ? Math.min(rawDiscount, coupon.maxDiscount)
      : rawDiscount;
    discountAmount = Math.min(discountAmount, fare);
  }

  const finalFare = Math.max(0, Math.round(fare - discountAmount));

  const successMessage =
    coupon.discountType === 'PERCENTAGE'
      ? `Promo "${coupon.code}" applied! ${coupon.discountValue}% OFF (Saved ₹${discountAmount.toLocaleString('en-IN')})`
      : `Promo "${coupon.code}" applied! Flat ₹${discountAmount.toLocaleString('en-IN')} OFF`;

  return {
    valid: true,
    message: successMessage,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount,
      minBookingAmount: coupon.minBookingAmount,
      discountAmount,
      finalFare,
    },
  };
}

