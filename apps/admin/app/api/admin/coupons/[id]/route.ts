import { NextRequest, NextResponse } from 'next/server';
import { updateCoupon, deleteCoupon } from '@/lib/couponStore';
import { getAdminSession } from '@/lib/auth';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function PATCH(
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
    const body = await req.json().catch(() => ({}));

    const updated = await updateCoupon(id, body);

    const res = NextResponse.json({
      success: true,
      message: `Coupon "${updated.code}" updated successfully!`,
      coupon: updated,
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/coupons/[id]:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to update coupon' },
      { status: 400 }
    );
    return setCorsHeaders(res);
  }
}

export async function DELETE(
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
    await deleteCoupon(id);

    const res = NextResponse.json({
      success: true,
      message: 'Coupon deleted successfully!',
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/coupons/[id]:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to delete coupon' },
      { status: 400 }
    );
    return setCorsHeaders(res);
  }
}

