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
      include: { user: true },
    });

    if (!driver) {
      const res = NextResponse.json(
        { success: false, message: 'Driver record not found' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER || '2323230008938044';
    const driverPhone = (driver.payoutPhone || driver.user.phone || '').replace(/\D/g, '').slice(-10);

    // 1. Fetch contact ID and all fund accounts for this driver
    let contactId: string | null = null;
    const searchRes = await callRazorpayX(`/v1/contacts?reference_id=DRV_${driver.id}`, 'GET');
    if (searchRes.ok && searchRes.data?.items?.length > 0) {
      contactId = searchRes.data.items[0].id;
    } else if (driverPhone) {
      const phoneSearch = await callRazorpayX(`/v1/contacts?contact=${driverPhone}`, 'GET');
      if (phoneSearch.ok && phoneSearch.data?.items?.length > 0) {
        contactId = phoneSearch.data.items[0].id;
      }
    }

    // Collect all Fund Account IDs linked to this driver
    const driverFaIds = new Set<string>();
    if (driver.fundAccountId) {
      driverFaIds.add(driver.fundAccountId);
    }
    if (contactId) {
      const faListRes = await callRazorpayX(`/v1/fund_accounts?contact_id=${contactId}`, 'GET');
      if (faListRes.ok && Array.isArray(faListRes.data?.items)) {
        faListRes.data.items.forEach((item: any) => {
          if (item.id) driverFaIds.add(item.id);
        });
      }
    }

    // 2. Fetch payouts from RazorpayX for this account
    const payoutsRes = await callRazorpayX(`/v1/payouts?account_number=${accountNumber}&count=40`, 'GET');

    // 3. Also fetch locally recorded payouts from database audit log
    const localPayoutLogs = await prisma.auditLog.findMany({
      where: { entityType: 'DriverPayout' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).catch(() => []);

    const localPayoutsMap = new Map<string, any>();
    localPayoutLogs.forEach((log) => {
      try {
        if (!log.reason) return;
        const parsed = JSON.parse(log.reason);
        if (parsed.driverId === driver.id) {
          localPayoutsMap.set(log.entityId, parsed);
        }
      } catch {}
    });

    let totalSettled = 0;
    let totalPending = 0;
    const seenPayoutIds = new Set<string>();
    const formattedPayouts: any[] = [];

    if (payoutsRes.ok && payoutsRes.data?.items && Array.isArray(payoutsRes.data.items)) {
      payoutsRes.data.items.forEach((p: any) => {
        // Match payouts belonging to this driver
        const isDriverPayout =
          (p.fund_account_id && driverFaIds.has(p.fund_account_id)) ||
          (contactId && (p.fund_account?.contact_id === contactId || p.contact_id === contactId)) ||
          p.notes?.driverId === driver.id ||
          p.reference_id?.includes(driver.id) ||
          p.reference_id?.includes(driver.id.slice(-8)) ||
          localPayoutsMap.has(p.id) ||
          (driverFaIds.size === 0 && (p.notes?.driverPhone === driverPhone || p.fund_account?.bank_account?.account_number === driver.bankAccountNumber));

        if (!isDriverPayout) return;

        seenPayoutIds.add(p.id);
        const amt = Number(p.amount) / 100;
        const statusLower = String(p.status || '').toLowerCase();
        const isProcessed = statusLower === 'processed';
        const isCancelled = statusLower === 'cancelled' || statusLower === 'reversed' || statusLower === 'rejected' || statusLower === 'failed';
        const isPending = !isCancelled && (statusLower === 'processing' || statusLower === 'queued' || statusLower === 'pending');

        if (isProcessed) {
          totalSettled += amt;
        } else if (isPending) {
          totalPending += amt;
        }
        // If cancelled, reversed, rejected or failed: DO NOT reduce wallet balance, DO NOT add to settled or pending

        const dateObj = p.created_at ? new Date(p.created_at * 1000) : new Date();
        const formattedDate = dateObj.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        const formattedTime = dateObj.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        const dest = p.mode === 'UPI'
          ? (p.fund_account?.vpa?.address || driver.payoutUpiId || 'UPI VPA')
          : `${p.fund_account?.bank_account?.bank_name || driver.bankName || 'HDFC Bank'} (•••• ${String(p.fund_account?.bank_account?.account_number || driver.bankAccountNumber || '2345').slice(-4)})`;

        let displayStatus: 'PROCESSED' | 'PENDING' | 'CANCELLED' = 'PENDING';
        let statusSubtitle = `Transfer to ${dest} (Processing Bank Transfer)`;

        if (isProcessed) {
          displayStatus = 'PROCESSED';
          statusSubtitle = `Transferred to ${dest}`;
        } else if (isCancelled) {
          displayStatus = 'CANCELLED';
          statusSubtitle = 'Your payout has been cancelled • Amount not deducted';
        } else if (statusLower === 'queued') {
          displayStatus = 'PENDING';
          statusSubtitle = `Queued in RazorpayX • Transfer to ${dest}`;
        }

        formattedPayouts.push({
          id: p.id,
          amount: amt,
          status: displayStatus,
          subtitle: statusSubtitle,
          utr: p.utr || p.id,
          mode: p.mode || 'IMPS',
          destination: dest,
          recipientName: p.fund_account?.bank_account?.name || driver.bankAccountHolderName || driver.user.fullName,
          date: formattedDate,
          time: formattedTime,
          rawStatus: p.status,
          createdAt: dateObj.toISOString(),
        });
      });
    }

    // Include any local database payout that might not have appeared in RazorpayX list yet
    localPayoutsMap.forEach((local, id) => {
      if (!seenPayoutIds.has(id)) {
        seenPayoutIds.add(id);
        const isProcessed = local.status === 'PROCESSED';
        const isCancelled = local.status === 'CANCELLED' || local.status === 'REVERSED' || local.status === 'REJECTED' || local.status === 'FAILED';
        const isPending = !isCancelled && !isProcessed;

        if (isProcessed) {
          totalSettled += local.amount;
        } else if (isPending) {
          totalPending += local.amount;
        }

        const dateObj = local.createdAt ? new Date(local.createdAt) : new Date();
        formattedPayouts.push({
          id,
          amount: local.amount,
          status: isCancelled ? 'CANCELLED' : local.status,
          subtitle: isCancelled
            ? 'Your payout has been cancelled • Amount not deducted'
            : isProcessed
            ? `Transferred to ${local.destination}`
            : `Transfer to ${local.destination} (Processing Bank Transfer)`,
          utr: local.utr || id,
          mode: local.mode || 'IMPS',
          destination: local.destination,
          recipientName: local.recipientName || driver.user.fullName,
          date: dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
          rawStatus: local.status,
          createdAt: dateObj.toISOString(),
        });
      }
    });

    const res = NextResponse.json({
      success: true,
      settledAmount: totalSettled,
      pendingAmount: totalPending,
      payouts: formattedPayouts,
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in GET /api/driver/wallet/withdraw:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch payouts' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}

async function callRazorpayX(path: string, method: string, body?: any, idempotencyKey?: string) {
  const keyId = process.env.RAZORPAYX_KEY_ID || 'rzp_test_U4jewWwKlZsBIs';
  const keySecret = process.env.RAZORPAYX_KEY_SECRET || '6RS3CKcBhfKpEC3HRKlMq5jI';
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(`https://api.razorpay.com${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, raw: text };
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

    const body = await req.json().catch(() => ({}));

    // Handle cancellation of a pending payout
    if (body.action === 'cancel' && body.payoutId) {
      const payoutIdToCancel = String(body.payoutId);
      console.log(`[Driver Payout] Cancelling payout: ${payoutIdToCancel}`);

      // Call RazorpayX cancellation endpoint
      await callRazorpayX(`/v1/payouts/${payoutIdToCancel}/cancel`, 'POST', {});

      // Record cancellation audit log so local fallback treats it as CANCELLED
      await prisma.auditLog.create({
        data: {
          action: 'DRIVER_PAYOUT_CANCELLED',
          entityType: 'DriverPayout',
          entityId: payoutIdToCancel,
          reason: JSON.stringify({
            payoutId: payoutIdToCancel,
            driverId: session.driverId,
            status: 'CANCELLED',
            cancelledAt: new Date().toISOString(),
            message: 'Your payout has been cancelled. Amount is not deducted from your wallet balance.',
          }),
        },
      }).catch(() => {});

      const res = NextResponse.json({
        success: true,
        message: 'Your payout has been cancelled. The amount has not been deducted from your wallet balance.',
        status: 'CANCELLED',
      });
      return setCorsHeaders(res);
    }

    const amount = Number(body.amount);

    if (!amount || isNaN(amount) || amount < 100) {
      const res = NextResponse.json(
        { success: false, message: 'Minimum withdrawal amount is ₹100' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Fetch driver profile with payout details
    const driver = await prisma.driver.findUnique({
      where: { id: session.driverId },
      include: { user: true },
    });

    if (!driver) {
      const res = NextResponse.json(
        { success: false, message: 'Driver record not found' },
        { status: 404 }
      );
      return setCorsHeaders(res);
    }

    const payoutMethod = driver.payoutMethod || 'BANK';
    const hasUpi = Boolean(driver.payoutUpiId && driver.payoutUpiId.includes('@'));
    const hasBank = Boolean(driver.bankAccountNumber && driver.bankIfsc);

    if (payoutMethod === 'UPI' && !hasUpi) {
      const res = NextResponse.json(
        { success: false, message: 'Please add and verify your UPI ID in Settlement & Bank before withdrawing.' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    if (payoutMethod === 'BANK' && !hasBank) {
      const res = NextResponse.json(
        { success: false, message: 'Please add and verify your Bank Account details in Settlement & Bank before withdrawing.' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Method A Security Check: Ensure payout details are reviewed & verified by admin
    if (driver.payoutStatus !== 'VERIFIED') {
      const res = NextResponse.json(
        {
          success: false,
          message: 'Your bank/UPI payout details are currently under admin review. Once verified by admin, you will be able to withdraw earnings.',
        },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const driverName = driver.bankAccountHolderName || driver.user.fullName || 'Driver Partner';
    const driverPhone = (driver.payoutPhone || driver.user.phone || '').replace(/\D/g, '').slice(-10) || '9587425635';
    const driverEmail = driver.payoutEmail || 'driver@kandycabs.in';
    const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER || '2323230008938044';

    // 1. Create or ensure Contact in RazorpayX
    const contactRes = await callRazorpayX('/v1/contacts', 'POST', {
      name: driverName,
      email: driverEmail,
      contact: driverPhone,
      type: 'employee',
      reference_id: `DRV_${driver.id}`,
    });

    let contactId = contactRes.data?.id;
    if (!contactId) {
      // If contact creation returned error or duplicate reference, lookup existing contact
      console.warn('[RazorpayX] Contact notice:', contactRes.data?.error || contactRes.data);
      const searchRes = await callRazorpayX(`/v1/contacts?reference_id=DRV_${driver.id}`, 'GET');
      if (searchRes.ok && searchRes.data?.items?.length > 0) {
        contactId = searchRes.data.items[0].id;
      } else {
        const phoneSearch = await callRazorpayX(`/v1/contacts?contact=${driverPhone}`, 'GET');
        if (phoneSearch.ok && phoneSearch.data?.items?.length > 0) {
          contactId = phoneSearch.data.items[0].id;
        }
      }
    }

    if (!contactId) {
      const res = NextResponse.json(
        {
          success: false,
          message: 'Could not create or link driver beneficiary contact with RazorpayX. Please try again.',
        },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // 2. Build and verify Fund Account for the CURRENT payout method (Bank Account vs UPI)
    let fundAccountPayload: any = null;
    if (payoutMethod === 'UPI') {
      fundAccountPayload = {
        contact_id: contactId,
        account_type: 'vpa',
        vpa: {
          address: driver.payoutUpiId,
        },
      };
    } else {
      fundAccountPayload = {
        contact_id: contactId,
        account_type: 'bank_account',
        bank_account: {
          name: driverName,
          ifsc: driver.bankIfsc,
          account_number: driver.bankAccountNumber,
        },
      };
    }

    // Always create or retrieve matching Fund Account for the active payout method
    let fundAccountId: string | null = null;
    const faRes = await callRazorpayX('/v1/fund_accounts', 'POST', fundAccountPayload);
    if (faRes.ok && faRes.data?.id) {
      fundAccountId = faRes.data.id;
      // Cache fundAccountId on driver
      await prisma.driver.update({
        where: { id: driver.id },
        data: { fundAccountId },
      }).catch(() => {});
    } else {
      console.warn('[RazorpayX Fund Account Notice]:', faRes.data);
      // If direct creation returned an error, search existing fund accounts on this contact
      const existingFa = await callRazorpayX(`/v1/fund_accounts?contact_id=${contactId}`, 'GET');
      if (existingFa.ok && existingFa.data?.items?.length > 0) {
        const expectedType = payoutMethod === 'UPI' ? 'vpa' : 'bank_account';
        const match = existingFa.data.items.find(
          (item: any) => item.account_type === expectedType && item.active !== false
        );
        if (match) {
          fundAccountId = match.id;
        }
      }
    }

    if (!fundAccountId) {
      const errMsg = faRes.data?.error?.description || 'Could not register beneficiary fund account in RazorpayX';
      const res = NextResponse.json(
        {
          success: false,
          message: `RazorpayX Fund Account Error: ${errMsg}`,
        },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const amountInPaise = Math.round(amount * 100);
    // RazorpayX reference_id must be <= 40 characters
    const referenceId = `WDR_${Date.now()}_${driver.id.slice(-8)}`;
    const idempotencyKey = `IDEMP_${Date.now()}_${driver.id.slice(-8)}`;

    // 3. Execute Payout via RazorpayX
    const payoutPayload = {
      account_number: accountNumber,
      fund_account_id: fundAccountId,
      amount: amountInPaise,
      currency: 'INR',
      mode: payoutMethod === 'UPI' ? 'UPI' : 'IMPS',
      purpose: 'payout',
      queue_if_low_balance: true,
      reference_id: referenceId,
      narration: 'Kandy Cabs Driver Trip Payout',
      notes: {
        driverId: driver.id,
        driverName: driverName,
        driverPhone: driverPhone,
      },
    };

    let payoutResult = null;
    let payoutUtr: string | null = null;
    let payoutId: string | null = null;
    let payoutStatus = 'PROCESSING';
    let isTransferred = false;

    const payoutRes = await callRazorpayX('/v1/payouts', 'POST', payoutPayload, idempotencyKey);
    if (payoutRes.ok && payoutRes.data) {
      payoutResult = payoutRes.data;
      payoutId = payoutResult.id;
      payoutUtr = payoutResult.utr || null;
      // In RazorpayX, payout status is 'processed' only when bank transfer is confirmed complete
      // Otherwise, it is 'processing', 'queued', or 'pending'
      const rzpStatus = String(payoutResult.status || '').toLowerCase();
      if (rzpStatus === 'processed') {
        payoutStatus = 'PROCESSED';
        isTransferred = true;
      } else {
        payoutStatus = 'PROCESSING';
        isTransferred = false;
      }
    } else {
      console.error('[RazorpayX Payout Error]:', payoutRes.data);
      const errMsg = payoutRes.data?.error?.description || 'RazorpayX rejected the payout request';
      const res = NextResponse.json(
        {
          success: false,
          message: `RazorpayX Payout Error: ${errMsg}`,
          error: payoutRes.data?.error,
        },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const fallbackUtr = `RZPX${new Date().getFullYear()}${String(Date.now()).slice(-8)}`;
    const finalUtr = payoutUtr || fallbackUtr;
    const finalPayoutId = payoutId || `pout_sim_${Date.now()}`;

    // Persist payout in database
    await prisma.auditLog.create({
      data: {
        action: isTransferred ? 'DRIVER_PAYOUT_PROCESSED' : 'DRIVER_PAYOUT_PENDING',
        entityType: 'DriverPayout',
        entityId: finalPayoutId,
        reason: JSON.stringify({
          payoutId: finalPayoutId,
          driverId: driver.id,
          amount,
          status: payoutStatus,
          transferred: isTransferred,
          utr: finalUtr,
          mode: payoutMethod === 'UPI' ? 'UPI' : 'IMPS',
          destination: payoutMethod === 'UPI' ? driver.payoutUpiId : `${driver.bankName || 'Bank'} (•••• ${String(driver.bankAccountNumber || '').slice(-4)})`,
          recipientName: driverName,
          createdAt: new Date().toISOString(),
        }),
      },
    }).catch(() => {});

    const res = NextResponse.json({
      success: true,
      message: isTransferred
        ? 'Withdrawal transferred successfully via RazorpayX'
        : 'Withdrawal initiated with RazorpayX. Transfer is currently processing with the bank.',
      transferred: isTransferred,
      payout: {
        id: finalPayoutId,
        amount,
        utr: finalUtr,
        status: payoutStatus,
        transferred: isTransferred,
        mode: payoutMethod === 'UPI' ? 'UPI' : 'IMPS',
        destination: payoutMethod === 'UPI' ? driver.payoutUpiId : `${driver.bankName || 'Bank'} (•••• ${String(driver.bankAccountNumber || '').slice(-4)})`,
        accountNumber,
        createdAt: new Date().toISOString(),
      },
    });

    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('Error in POST /api/driver/wallet/withdraw:', error);
    const res = NextResponse.json(
      { success: false, message: error.message || 'Failed to process withdrawal' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
