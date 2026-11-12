import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  normalizePhoneNumber,
  isValidIndianPhoneNumber,
  generateOtp,
  hashOtp,
  sendOtpSms,
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

    const otp = generateOtp(4);
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Save OTP to database
    await prisma.otpVerification.create({
      data: {
        phone: normalizedPhone,
        otpHash,
        expiresAt,
      },
    });

    // Dispatch OTP SMS
    await sendOtpSms(normalizedPhone, otp);

    const isDev = process.env.NODE_ENV !== 'production';
    const isPlaceholderSms = !process.env.SMS_PROVIDER_API_KEY || process.env.SMS_PROVIDER_API_KEY.includes('placeholder');
    const enableDemoOtp = process.env.ENABLE_DEMO_OTP !== 'false';

    let resolvedExistingName = existingUser?.fullName?.trim() || '';
    if (!resolvedExistingName || resolvedExistingName === 'Kandy Customer') {
      const pastBooking = await prisma.booking.findFirst({
        where: {
          OR: [
            { customerPhone: normalizedPhone },
            { customerPhone: phone.trim().replace(/\D/g, '').slice(-10) },
          ],
        },
        select: { customerName: true },
        orderBy: { createdAt: 'desc' },
      });
      if (pastBooking?.customerName && pastBooking.customerName.trim().length > 0) {
        resolvedExistingName = pastBooking.customerName.trim();
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

    if (isDev || isPlaceholderSms || enableDemoOtp) {
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
