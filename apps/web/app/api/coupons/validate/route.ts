import { NextRequest, NextResponse } from 'next/server';
import { validateCoupon } from '@/lib/couponStore';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, fare, tripType } = body;

    if (!code || typeof code !== 'string') {
      const res = NextResponse.json(
        { valid: false, message: 'Please enter a coupon code.' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const numericFare = Number(fare) || 0;
    const result = await validateCoupon(code, numericFare, tripType);

    const res = NextResponse.json(result, {
      status: result.valid ? 200 : 400,
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/coupons/validate:', error);
    const res = NextResponse.json(
      { valid: false, message: error.message || 'Failed to validate coupon code' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

