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

    // Check if phone number is already registered
    const existingUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        roles: true,
        deletedAt: true,
        driver: { select: { id: true, verificationStatus: true, deletedAt: true } },
      },
    });

    const isDriver = !!(
      existingUser &&
      !existingUser.deletedAt &&
      existingUser.driver &&
      !existingUser.driver.deletedAt
    );

    // Allow both existing drivers and new driver partner registrations
    const isNewDriver = body.role === 'DRIVER' && (!existingUser || !isDriver);

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

    let resolvedExistingName = existingUser?.fullName?.trim() || '';
    if (!resolvedExistingName || resolvedExistingName === 'Kandy Customer' || resolvedExistingName.toLowerCase() === 'customer') {
      resolvedExistingName = '';
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
        include: {
          customer: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      const pastName = pastBooking?.customer?.user?.fullName?.trim();
      if (pastName && pastName.length > 0 && pastName.toLowerCase() !== 'customer') {
        resolvedExistingName = pastName;
      }
    }

    const responsePayload: any = {
      success: true,
      message: 'OTP sent successfully',
      isRegistered: !!existingUser || Boolean(resolvedExistingName),
      existingName: resolvedExistingName || null,
      roles: existingUser?.roles || [],
      isDriver,
      driverStatus: existingUser?.driver?.verificationStatus || null,
    };

    if (shouldExposeDebugOtp(normalizedPhone)) {
      responsePayload.debugOtp = otp;
    }

    const res = NextResponse.json(responsePayload, { status: 200 });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/auth/send-otp:', error);
    let errorMsg = error.message || 'Failed to send OTP';
    if (
      errorMsg.includes('tenant/user') ||
      errorMsg.includes('ENOTFOUND') ||
      errorMsg.includes("Can't reach database")
    ) {
      errorMsg =
        'Supabase database is currently sleeping or paused. Please open your Supabase Dashboard (https://supabase.com/dashboard/project/kkerjotsahmkwbldjdhf) and click "Restore / Unpause Project" to resume.';
    }
    const res = NextResponse.json(
      { success: false, message: errorMsg },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
