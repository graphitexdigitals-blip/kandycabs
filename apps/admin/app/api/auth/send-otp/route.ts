import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  normalizePhoneNumber,
  isValidIndianPhoneNumber,
  generateOtp,
  hashOtp,
  sendOtpSms,
  isTestAccountAllowed,
  shouldExposeDebugOtp,
  OTP_SEND_LIMIT,
  OTP_SEND_WINDOW_MS,
} from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone } = body;

    if (!phone || typeof phone !== 'string') {
      const res = NextResponse.json(
        { success: false, message: 'Valid phone number is required' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    if (!isValidIndianPhoneNumber(phone)) {
      const res = NextResponse.json(
        { success: false, message: 'Please provide a valid 10-digit Indian phone number' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    // Fixed test accounts: always in dev, in production only with ALLOW_TEST_ACCOUNTS=true
    const isTestAccount = isTestAccountAllowed(normalizedPhone);

    if (!isTestAccount) {
      const recentSends = await prisma.otpVerification.count({
        where: {
          phone: normalizedPhone,
          createdAt: { gt: new Date(Date.now() - OTP_SEND_WINDOW_MS) },
        },
      });
      if (recentSends >= OTP_SEND_LIMIT) {
        const res = NextResponse.json(
          { success: false, message: 'Too many OTP requests. Please try again in a few minutes.' },
          { status: 429 }
        );
        return setCorsHeaders(res);
      }
    }

    const otp = isTestAccount ? '1234' : generateOtp(4);
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Check if phone number is already registered in DB or has prior bookings
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { phone: phone.trim().replace(/\D/g, '') },
          { phone: `+91${phone.trim().replace(/\D/g, '').slice(-10)}` },
        ],
      },
      select: {
        id: true,
        fullName: true,
        roles: true,
      },
    });

    let resolvedExistingName = existingUser?.fullName?.trim() || '';
    if (!resolvedExistingName || resolvedExistingName === 'Kandy Customer') {
      const pastBooking = await prisma.booking.findFirst({
        where: {
          customer: {
            user: {
              OR: [
                { phone: normalizedPhone },
                { phone: phone.trim().replace(/\D/g, '').slice(-10) },
              ],
            },
          },
        },
        select: {
          customer: {
            select: {
              user: {
                select: { fullName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (pastBooking?.customer?.user?.fullName && pastBooking.customer.user.fullName.trim().length > 0) {
        resolvedExistingName = pastBooking.customer.user.fullName.trim();
      }
    }

    // Save OTP to database
    const otpRecord = await prisma.otpVerification.create({
      data: {
        phone: normalizedPhone,
        otpHash,
        expiresAt,
      },
    });

    // Dispatch OTP SMS via MSG91. Test accounts have fixed OTPs and no real SMS.
    if (!isTestAccount) {
      const smsResult = await sendOtpSms(normalizedPhone, otp);
      if (!smsResult.success) {
        // Don't leave a usable OTP behind for a message that was never sent
        await prisma.otpVerification.delete({ where: { id: otpRecord.id } }).catch(() => {});
        const res = NextResponse.json(
          { success: false, message: 'We could not send the OTP right now. Please try again shortly.' },
          { status: 502 }
        );
        return setCorsHeaders(res);
      }
    }

    const responsePayload: any = {
      success: true,
      message: 'OTP sent successfully',
      isRegistered: !!existingUser || Boolean(resolvedExistingName),
      existingName: resolvedExistingName || null,
    };

    if (shouldExposeDebugOtp(normalizedPhone)) {
      responsePayload.debugOtp = otp;
    }

    const res = NextResponse.json(responsePayload, { status: 200 });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/auth/send-otp:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to send OTP' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
