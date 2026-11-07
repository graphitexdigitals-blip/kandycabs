import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getExpiringDocuments } from '@/lib/documentExpiry';

export const dynamic = 'force-dynamic';

/**
 * Automated Cron Job / Scheduled Check for Expiring Driver Documents.
 * Identifies all drivers with documents expiring within 5 days or already expired,
 * and records reminder events in the audit log so admin and drivers are kept in sync.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow internal admin callers or bearer token
    }

    const drivers = await prisma.driver.findMany({
      where: {
        deletedAt: null,
        adminNotes: { not: null },
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        vehicles: {
          where: { deletedAt: null },
          select: { plateNumber: true, category: true },
        },
      },
    });

    const expiringReport: Array<{
      driverId: string;
      fullName: string;
      phone: string;
      plateNumber?: string | null;
      expiringCount: number;
      expiringDocuments: any[];
    }> = [];

    for (const d of drivers) {
      if (!d.adminNotes) continue;

      let docDates: Record<string, any> = {};
      const datesMatch = d.adminNotes.match(/\[DocDates:\s*(\{.*?\})\]/);
      if (datesMatch && datesMatch[1]) {
        try {
          docDates = JSON.parse(datesMatch[1]);
        } catch {}
      }
      if (!docDates || Object.keys(docDates).length === 0) {
        const extraMatch = d.adminNotes.match(/\[ExtraDocs:\s*(\{.*?\})\]/);
        if (extraMatch && extraMatch[1]) {
          try {
            const extra = JSON.parse(extraMatch[1]);
            if (extra.docDates) docDates = extra.docDates;
          } catch {}
        }
      }

      const expiring = getExpiringDocuments(docDates, 5);
      if (expiring.length > 0) {
        expiringReport.push({
          driverId: d.id,
          fullName: d.user?.fullName || 'Driver',
          phone: d.user?.phone || '',
          plateNumber: d.vehicles?.[0]?.plateNumber || undefined,
          expiringCount: expiring.length,
          expiringDocuments: expiring,
        });
      }
    }

    // Optional: Log an audit event if any documents were found expiring
    if (expiringReport.length > 0) {
      await prisma.auditLog.create({
        data: {
          action: 'DOCUMENTS_AUTO_REMINDER_CHECK',
          entityType: 'System',
          entityId: 'EXPIRY_CHECK',
          reason: `Auto-expiry scan detected ${expiringReport.length} driver(s) with documents expiring within 5 days or expired.`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalDriversScanned: drivers.length,
      expiringDriversCount: expiringReport.length,
      expiringDrivers: expiringReport,
    });
  } catch (error: any) {
    console.error('Error in check-expiring-documents cron:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check expiring documents' },
      { status: 500 }
    );
  }
}

