import { NextRequest, NextResponse } from 'next/server';
import { getAllCoupons, updateCoupon } from '@/lib/couponStore';
import { getAdminSession } from '@/lib/auth';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return setCorsHeaders(res);
    }

    const { id } = params;
    const all = await getAllCoupons();
    const coupon = all.find((c) => c.id === id || c.code === id.toUpperCase());
    if (!coupon) {
      const res = NextResponse.json({ success: false, message: 'Coupon not found' }, { status: 404 });
      return setCorsHeaders(res);
    }

    const updated = await updateCoupon(coupon.id, { isActive: !coupon.isActive });

    const res = NextResponse.json({
      success: true,
      message: `Coupon "${updated.code}" is now ${updated.isActive ? 'ACTIVE' : 'INACTIVE'}`,
      coupon: updated,
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/admin/coupons/[id]/toggle:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to toggle status' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

