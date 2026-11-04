import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getDriverSession } from '@/lib/driver-auth';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const session = await getDriverSession(req);
    if (!session) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Driver authentication required' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const driver = await prisma.driver.findUnique({
      where: { id: session.driverId },
      select: {
        id: true,
        payoutMethod: true,
        bankAccountHolderName: true,
        bankAccountNumber: true,
        bankIfsc: true,
        bankName: true,
        payoutUpiId: true,
        payoutPhone: true,
        payoutEmail: true,
        payoutStatus: true,
      },
    });

    if (!driver) {
      const res = NextResponse.json(
        { error: 'Driver not found' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    const res = NextResponse.json({
      success: true,
      payout: {
        payoutMethod: driver.payoutMethod || 'BANK',
        bankAccountHolderName: driver.bankAccountHolderName || '',
        bankAccountNumber: driver.bankAccountNumber || '',
        bankIfsc: driver.bankIfsc || '',
        bankName: driver.bankName || '',
        payoutUpiId: driver.payoutUpiId || '',
        payoutPhone: driver.payoutPhone || session.user.phone || '',
        payoutEmail: driver.payoutEmail || session.user.email || '',
        payoutStatus: driver.payoutStatus || 'PENDING',
      },
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in GET /api/driver/payout:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch payout details' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getDriverSession(req);
    if (!session) {
      const res = NextResponse.json(
        { error: 'Unauthorized', message: 'Driver authentication required' },
        { status: 401 }
      );
      return setCorsHeaders(res);
    }

    const body = await req.json();
    const {
      payoutMethod = 'BANK',
      bankAccountHolderName,
      bankAccountNumber,
      bankIfsc,
      bankName,
      payoutUpiId,
      payoutPhone,
      payoutEmail,
    } = body;

    const method = payoutMethod === 'UPI' ? 'UPI' : 'BANK';

    if (method === 'BANK') {
      if (!bankAccountHolderName || typeof bankAccountHolderName !== 'string' || !bankAccountHolderName.trim()) {
        const res = NextResponse.json(
          { success: false, message: 'Account holder name is required for bank transfer' },
          { status: 400 }
        );
        return setCorsHeaders(res);
      }
      if (!bankAccountNumber || typeof bankAccountNumber !== 'string' || !bankAccountNumber.trim()) {
        const res = NextResponse.json(
          { success: false, message: 'Bank account number is required' },
          { status: 400 }
        );
        return setCorsHeaders(res);
      }
      if (!bankIfsc || typeof bankIfsc !== 'string' || !bankIfsc.trim()) {
        const res = NextResponse.json(
          { success: false, message: 'IFSC code is required for bank transfer' },
          { status: 400 }
        );
        return setCorsHeaders(res);
      }
    } else {
      // UPI transfer
      if (!bankAccountHolderName || typeof bankAccountHolderName !== 'string' || !bankAccountHolderName.trim()) {
        const res = NextResponse.json(
          { success: false, message: "Driver's full name is required for UPI payout" },
          { status: 400 }
        );
        return setCorsHeaders(res);
      }
      if (!payoutUpiId || typeof payoutUpiId !== 'string' || !payoutUpiId.includes('@')) {
        const res = NextResponse.json(
          { success: false, message: 'Valid UPI ID is required (e.g. driver@oksbi)' },
          { status: 400 }
        );
        return setCorsHeaders(res);
      }
    }

    const updatedDriver = await prisma.driver.update({
      where: { id: session.driverId },
      data: {
        payoutMethod: method,
        bankAccountHolderName: bankAccountHolderName.trim(),
        bankAccountNumber: method === 'BANK' ? bankAccountNumber.trim() : null,
        bankIfsc: method === 'BANK' ? bankIfsc.trim().toUpperCase() : null,
        bankName: method === 'BANK' && bankName ? bankName.trim() : null,
        payoutUpiId: method === 'UPI' ? payoutUpiId.trim() : null,
        payoutPhone: payoutPhone ? String(payoutPhone).trim() : null,
        payoutEmail: payoutEmail ? String(payoutEmail).trim() : null,
        // Mark as PENDING verification on each update
        payoutStatus: 'PENDING',
      },
    });

    const res = NextResponse.json({
      success: true,
      message: 'Payout details saved successfully',
      payout: {
        payoutMethod: updatedDriver.payoutMethod,
        bankAccountHolderName: updatedDriver.bankAccountHolderName,
        bankAccountNumber: updatedDriver.bankAccountNumber,
        bankIfsc: updatedDriver.bankIfsc,
        bankName: updatedDriver.bankName,
        payoutUpiId: updatedDriver.payoutUpiId,
        payoutPhone: updatedDriver.payoutPhone,
        payoutEmail: updatedDriver.payoutEmail,
        payoutStatus: updatedDriver.payoutStatus,
      },
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/payout:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to save payout details' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

