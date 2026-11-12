import { NextRequest, NextResponse } from 'next/server';
import { getAllCoupons, createCoupon } from '@/lib/couponStore';
import { getAdminSession } from '@/lib/auth';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return setCorsHeaders(res);
    }

    const coupons = await getAllCoupons();

    // Summary statistics for dashboard cards
    const totalCoupons = coupons.length;
    const activeCoupons = coupons.filter((c) => c.isActive).length;
    const fixedAmountCoupons = coupons.filter((c) => c.discountType === 'FIXED_AMOUNT').length;
    const percentageCoupons = coupons.filter((c) => c.discountType === 'PERCENTAGE').length;
    const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);

    const res = NextResponse.json({
      success: true,
      stats: {
        totalCoupons,
        activeCoupons,
        fixedAmountCoupons,
        percentageCoupons,
        totalRedemptions,
      },
      coupons,
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in GET /api/admin/coupons:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch coupons', coupons: [] },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return setCorsHeaders(res);
    }

    const body = await req.json().catch(() => ({}));
    if (!body.code || !body.discountValue || !body.discountType) {
      const res = NextResponse.json(
        { success: false, message: 'Code, discount type, and discount value are required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const newCoupon = await createCoupon({
      code: body.code,
      description: body.description,
      discountType: body.discountType,
      discountValue: Number(body.discountValue),
      maxDiscount: body.maxDiscount ? Number(body.maxDiscount) : null,
      minBookingAmount: body.minBookingAmount ? Number(body.minBookingAmount) : 0,
      validFrom: body.validFrom,
      validTo: body.validTo || null,
      usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      applicableTripTypes: body.applicableTripTypes,
    });

    const res = NextResponse.json(
      {
        success: true,
        message: `Coupon "${newCoupon.code}" created successfully!`,
        coupon: newCoupon,
      },
      { status: 201 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/admin/coupons:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to create coupon' },
      { status: 400 }
    );
    return setCorsHeaders(res);
  }
}

