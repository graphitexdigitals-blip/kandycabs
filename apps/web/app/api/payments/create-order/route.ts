import { NextRequest, NextResponse } from 'next/server';
import {
  VehicleCategory,
  TripType,
  calculateFare,
} from '@kandy-cabs/shared';
import { calculateRouteDistance } from '@/lib/distance';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      amount,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      category = VehicleCategory.SEDAN,
      fuelType,
      tripType = TripType.ONEWAY,
      scheduledAt = new Date().toISOString(),
      durationDays = 1,
      packageHours = 8,
      couponCode,
      receipt,
      notes = {},
    } = body;

    let payableAmount: number;

    // 1. If explicit amount is passed from review/payment bar, honor it directly
    if (typeof amount === 'number' && amount > 0) {
      payableAmount = Math.round(amount);
    } else {
      // Otherwise calculate authoritative fare from route
      let distanceKm = 50;
      if (
        typeof pickupLat === 'number' &&
        typeof pickupLng === 'number' &&
        typeof dropLat === 'number' &&
        typeof dropLng === 'number'
      ) {
        const route = await calculateRouteDistance(pickupLat, pickupLng, dropLat, dropLng);
        distanceKm = route.distanceKm;
      }

      const pricing = calculateFare({
        category,
        fuelType,
        tripType,
        distanceKm,
        scheduledAt,
        durationDays,
        packageHours,
        couponCode,
      });

      payableAmount = Math.round(pricing.advanceAmount);
    }

    const amountInPaise = payableAmount * 100;
    const keyId =
      process.env.RAZORPAY_KEY_ID ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      'rzp_test_U3IkpH9yGG0oyk';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'R4sQSwIabpMLcZhmJy7cMRPf';

    let orderId = `order_mock_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Call official Razorpay Orders API
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
            receipt: receipt || `rcpt_${Date.now()}`,
            notes: {
              category: String(category),
              tripType: String(tripType),
              ...notes,
            },
          }),
        });

        if (razorpayRes.ok) {
          const rzpData = (await razorpayRes.json()) as any;
          orderId = rzpData.id;
        } else {
          const errText = await razorpayRes.text();
          console.warn('Razorpay order creation response not ok:', errText);
        }
      } catch (e) {
        console.warn('Razorpay request failed, fallback to mock orderId:', e);
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
