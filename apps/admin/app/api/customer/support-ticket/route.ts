import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    let token = req.cookies.get('kandy_session')?.value;
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    let actorUserId: string | null = null;
    if (token) {
      try {
        const payload = await verifyAuthToken(token);
        if (payload?.userId) {
          actorUserId = payload.userId;
        }
      } catch {
        // Token optional for public app support
      }
    }

    const body = await req.json();
    const { category, description, bookingRef, customerName, customerPhone, customerEmail } = body;

    if (!category || !description?.trim()) {
      const res = NextResponse.json(
        { success: false, message: 'Issue category and description are required.' },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    // Generate unique Ticket ID
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const ticketId = `TCK-${Date.now().toString().slice(-4)}${randomSuffix.toString().slice(-3)}`;

    const ticketPayload = {
      ticketId,
      category,
      description: description.trim(),
      bookingRef: bookingRef?.trim() || null,
      customerName: customerName?.trim() || 'Guest Customer',
      customerPhone: customerPhone?.trim() || null,
      customerEmail: customerEmail?.trim() || null,
      submittedAt: new Date().toISOString(),
    };

    // Save ticket into database AuditLog for tracking and compliance
    try {
      await prisma.auditLog.create({
        data: {
          actorUserId: actorUserId || null,
          action: 'SUPPORT_TICKET_SUBMITTED',
          entityType: 'SupportTicket',
          entityId: ticketId,
          reason: JSON.stringify(ticketPayload),
        },
      });
    } catch (dbErr) {
      console.warn('[SupportTicket] Failed to save into audit log, continuing:', dbErr);
    }

    const res = NextResponse.json({
      success: true,
      ticketId,
      message: 'Support request received successfully. Our technical support team will contact you shortly.',
      data: ticketPayload,
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('[SupportTicket] Error submitting support ticket:', error);
    const res = NextResponse.json(
      { success: false, message: error?.message || 'Failed to submit support ticket.' },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
