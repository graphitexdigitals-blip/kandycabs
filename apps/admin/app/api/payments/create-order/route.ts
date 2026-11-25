import { NextRequest, NextResponse } from 'next/server';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      amount,
      receipt,
      notes = {},
      bookingId,
      customerName,
      customerPhone,
      customerEmail,
    } = body;

    let payableAmount = typeof amount === 'number' && amount > 0 ? Math.round(amount) : 500;
    const amountInPaise = payableAmount * 100;

    const keyId =
      process.env.RAZORPAY_KEY_ID ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      'rzp_test_U3IkpH9yGG0oyk';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'R4sQSwIabpMLcZhmJy7cMRPf';

    let orderId = `order_mock_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    if (
      keyId &&
      !keyId.includes('placeholder') &&
      keySecret &&
      !keySecret.includes('placeholder')
    ) {
      try {
        const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
        const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: 'INR',
            receipt: receipt || `rcpt_${bookingId || Date.now()}`,
            notes: {
              bookingId: bookingId || '',
              customerName: customerName || '',
              customerPhone: customerPhone || '',
              ...notes,
            },
          }),
        });

        if (razorpayRes.ok) {
          const rzpData = (await razorpayRes.json()) as any;
          orderId = rzpData.id;
        } else {
          const errText = await razorpayRes.text();
          console.warn('[Razorpay Admin] Order creation response not ok:', errText);
        }
      } catch (e) {
        console.warn('[Razorpay Admin] Request failed, fallback to mock orderId:', e);
      }
    }

    const response = NextResponse.json(
      {
        success: true,
        orderId,
        amount: payableAmount,
        amountInPaise,
        currency: 'INR',
        keyId,
      },
      { status: 200 }
    );
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error in POST /api/payments/create-order:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to create payment order' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
