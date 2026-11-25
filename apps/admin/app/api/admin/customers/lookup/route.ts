import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin privileges required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawPhone = searchParams.get('phone')?.trim() || '';

    if (!rawPhone || rawPhone.length < 5) {
      return NextResponse.json({ success: true, found: false, customer: null });
    }

    // Clean phone number (strip spaces, dashes, parentheses)
    const digitsOnly = rawPhone.replace(/\D/g, '');
    const tenDigits = digitsOnly.slice(-10);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: { contains: tenDigits } },
          { phone: `+91${tenDigits}` },
          { phone: tenDigits },
        ],
      },
      include: {
        customer: {
          include: {
            bookings: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                pickupAddress: true,
                dropAddress: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: true, found: false, customer: null });
    }

    const recentBooking = user.customer?.bookings?.[0];

    return NextResponse.json({
      success: true,
      found: true,
      customer: {
        id: user.customer?.id || user.id,
        userId: user.id,
        fullName: user.fullName || '',
        phone: user.phone || rawPhone,
        email: user.customer?.email || '',
        recentPickup: recentBooking?.pickupAddress || '',
        recentDrop: recentBooking?.dropAddress || '',
      },
    });
  } catch (error: any) {
    console.error('[Admin Customer Lookup Error]:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Lookup failed' },
      { status: 500 }
    );
  }
}
