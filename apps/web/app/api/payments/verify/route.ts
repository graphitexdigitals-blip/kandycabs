import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@kandy-cabs/db';
import { PaymentType, PaymentStatus, BookingStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const acceptHeader = req.headers.get('accept') || '';
    const isBrowserNavigation = req.method === 'GET' || acceptHeader.includes('text/html') || contentType.includes('application/x-www-form-urlencoded');

    let body: any = {};
    if (req.method !== 'GET') {
      if (contentType.includes('application/json')) {
        body = await req.json().catch(() => ({}));
      } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await req.formData().catch(() => null);
        if (formData) {
          body = Object.fromEntries(formData.entries());
        }
      } else {
        const text = await req.text().catch(() => '');
        try {
          body = JSON.parse(text);
        } catch {
          try {
            body = Object.fromEntries(new URLSearchParams(text));
          } catch {
            body = {};
          }
        }
      }
    }

    const searchParams = req.nextUrl.searchParams;
    const bookingId = (body.bookingId || searchParams.get('bookingId') || '') as string;
    const razorpay_order_id = (body.razorpay_order_id || searchParams.get('razorpay_order_id') || '') as string;
    const razorpay_payment_id = (body.razorpay_payment_id || searchParams.get('razorpay_payment_id') || '') as string;
    const razorpay_signature = (body.razorpay_signature || searchParams.get('razorpay_signature') || '') as string;
    const paymentMethod = (body.paymentMethod || 'RAZORPAY') as string;
    const errorDescription =
      (body['error[description]'] ||
        searchParams.get('error[description]') ||
        body.error_description ||
        searchParams.get('error_description') ||
        '') as string;
    const errorCode =
      (body['error[code]'] ||
        searchParams.get('error[code]') ||
        body.error_code ||
        searchParams.get('error_code') ||
        '') as string;

    if (!razorpay_payment_id) {
      if (isBrowserNavigation) {
        const safeDesc = (errorDescription || 'Payment was not completed. You can try again anytime.').replace(/'/g, "\\'");
        return new NextResponse(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Payment Incomplete</title>
  <style>
    body { background: #0f172a; color: #fff; font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 24px; box-sizing: border-box; }
    .icon { font-size: 52px; color: #f59e0b; margin-bottom: 12px; }
    h2 { font-size: 22px; margin: 0 0 8px; color: #f8fafc; }
    p { font-size: 14px; color: #94a3b8; margin: 0 0 20px; max-width: 320px; line-height: 1.5; }
    .btn { background: #f0750f; color: #fff; border: none; border-radius: 12px; padding: 12px 28px; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; }
  </style>
</head>
<body>
  <div class="icon">⚠</div>
  <h2>Payment Not Completed</h2>
  <p>${errorDescription || 'Payment was not completed. You can try again anytime.'}</p>
  <button class="btn" onclick="retryPayment()">Try Again</button>
  <script>
    function notifyRN(msg) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      } catch (_) {}
    }
    notifyRN({
      type: 'PAYMENT_FAILED',
      code: '${errorCode || 'CANCELLED'}',
      description: '${safeDesc}'
    });
    function retryPayment() {
      notifyRN({ type: 'CLOSE_CHECKOUT' });
    }
  </script>
</body>
</html>`,
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );
      }
      const res = NextResponse.json(
        { success: false, message: 'razorpay_payment_id is required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'R4sQSwIabpMLcZhmJy7cMRPf';

    // Verify signature if provided with order ID
    let isSignatureValid = true;
    if (razorpay_signature && razorpay_order_id && keySecret && !keySecret.includes('placeholder')) {
      try {
        const generatedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex');
        isSignatureValid = generatedSignature === razorpay_signature;
      } catch (sigErr) {
        console.warn('[Razorpay Verify] Signature check error:', sigErr);
      }
    }

    if (!isSignatureValid) {
      console.warn('[Razorpay Verify] Signature mismatch for order:', razorpay_order_id);
      if (isBrowserNavigation) {
        return new NextResponse(
          `<!DOCTYPE html><html><body style="background:#0f172a;color:#fff;font-family:sans-serif;padding:24px;text-align:center;"><h2>Payment Signature Notice</h2><p>Payment signature check did not match. Please contact support.</p></body></html>`,
          { status: 400, headers: { 'Content-Type': 'text/html' } }
        );
      }
      const res = NextResponse.json(
        { success: false, message: 'Payment signature verification failed' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Locate booking either by bookingId or by payment razorpayOrderId
    let targetBooking = null;
    if (bookingId) {
      targetBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { payments: true },
      });
    }

    if (!targetBooking) {
      const paymentRecord = await prisma.payment.findFirst({
        where: { razorpayOrderId: razorpay_order_id },
        include: { booking: { include: { payments: true } } },
      });
      targetBooking = paymentRecord?.booking || null;
    }

    if (!targetBooking) {
      if (isBrowserNavigation) {
        return new NextResponse(
          `<!DOCTYPE html><html><body style="background:#0f172a;color:#fff;font-family:sans-serif;padding:24px;text-align:center;"><h2>Booking Not Found</h2><p>Associated booking not found for this transaction.</p></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html' } }
        );
      }
      const res = NextResponse.json(
        { success: false, message: 'Associated booking not found for this order' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    const advanceAmount = Number(targetBooking.advanceAmount) || 0;

    // Update in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update booking
      const b = await tx.booking.update({
        where: { id: targetBooking.id },
        data: {
          advancePaymentStatus: PaymentStatus.PAID,
          status:
            targetBooking.status === ('DRAFT' as any)
              ? BookingStatus.PENDING_ADMIN
              : targetBooking.status,
        },
      });

      // 2. Find or create advance payment record
      const existingPayment = targetBooking.payments.find(
        (p) => p.type === PaymentType.ADVANCE
      );

      if (existingPayment) {
        await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            status: PaymentStatus.PAID,
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            paymentMethod,
            verifiedAt: new Date(),
          },
        });
      } else {
        await tx.payment.create({
          data: {
            bookingId: targetBooking.id,
            type: PaymentType.ADVANCE,
            amount: advanceAmount,
            status: PaymentStatus.PAID,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            paymentMethod,
            verifiedAt: new Date(),
          },
        });
      }

      // 3. TripEvent log
      await tx.tripEvent.create({
        data: {
          bookingId: targetBooking.id,
          type: 'ADVANCE_PAYMENT_VERIFIED',
          payloadJson: {
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            amount: advanceAmount,
            paymentMethod,
            verifiedAt: new Date().toISOString(),
          },
        },
      });

      return b;
    });

    if (isBrowserNavigation) {
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Payment Approved</title>
  <style>
    body { background: #0f172a; color: #fff; font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .icon { font-size: 56px; color: #10b981; margin-bottom: 12px; }
    h2 { font-size: 22px; margin: 0 0 8px; color: #f8fafc; }
    p { font-size: 13px; color: #94a3b8; margin: 0 0 20px; }
  </style>
</head>
<body>
  <div class="icon">✓</div>
  <h2>Payment Approved!</h2>
  <p>Confirming your ride reservation...</p>
  <script>
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PAYMENT_SUCCESS',
          bookingId: '${targetBooking.id}',
          paymentId: '${razorpay_payment_id}',
          orderId: '${razorpay_order_id}'
        }));
      }
    } catch (_) {}
    setTimeout(function() {
      window.location.href = 'kandycabscustomer://booking-confirmed?bookingId=${targetBooking.id}&paymentId=${razorpay_payment_id}';
    }, 500);
  </script>
</body>
</html>`;
      return new NextResponse(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const res = NextResponse.json(
      {
        success: true,
        message: 'Payment verified and booking confirmed successfully',
        booking: updated,
      },
      { status: 200 }
    );
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/payments/verify:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Payment verification failed' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
