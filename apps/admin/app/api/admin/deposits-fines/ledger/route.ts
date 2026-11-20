import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import {
  DriverFineOrDepositRecord,
  LedgerRecordStatus,
  LedgerRecordType,
} from '@kandy-cabs/shared';

export const dynamic = 'force-dynamic';

const INITIAL_DEMO_RECORDS: DriverFineOrDepositRecord[] = [
  {
    id: 'REC-DEP-1001',
    driverId: 'drv-demo-1',
    driverName: 'Mohan Kumar',
    driverPhone: '+919876543210',
    vehiclePlate: 'KA 19 MD 4022',
    type: 'DEPOSIT',
    category: 'INITIAL_SECURITY_DEPOSIT',
    title: 'Driver Security Deposit (Active Escrow)',
    amount: 5000,
    status: 'PAID',
    paymentMethod: 'BANK_TRANSFER',
    remarks: 'Received via HDFC Bank NEFT at onboarding. Fully refundable upon contract clearance.',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    settledAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'REC-FINE-1002',
    driverId: 'drv-demo-1',
    driverName: 'Mohan Kumar',
    driverPhone: '+919876543210',
    vehiclePlate: 'KA 19 MD 4022',
    type: 'FINE',
    category: 'LATE_ARRIVAL',
    title: 'Late Arrival at Pickup (> 25 mins)',
    amount: 250,
    bookingRef: 'KC-2026-804669',
    status: 'DEDUCTED',
    remarks: 'Driver arrived 28 mins late for Mangaluru Airport pickup without dispatch notice.',
    paymentMethod: 'PAYOUT_DEDUCTION',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    settledAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'REC-FINE-1003',
    driverId: 'drv-demo-2',
    driverName: 'Ramesh Gowda',
    driverPhone: '+919845112233',
    vehiclePlate: 'KA 04 AK 8841',
    type: 'FINE',
    category: 'AC_REFUSAL',
    title: 'Vehicle AC Refusal / Passenger Complaint',
    amount: 200,
    bookingRef: 'KC-2026-619024',
    status: 'PENDING',
    remarks: 'Customer complaint verified: AC not turned on despite 34°C weather.',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'REC-DEP-1004',
    driverId: 'drv-demo-2',
    driverName: 'Ramesh Gowda',
    driverPhone: '+919845112233',
    vehiclePlate: 'KA 04 AK 8841',
    type: 'DEPOSIT',
    category: 'INSTALLMENT_DEPOSIT',
    title: 'Security Deposit (Installment 1 of 5)',
    amount: 1000,
    status: 'DEDUCTED',
    paymentMethod: 'PAYOUT_DEDUCTION',
    remarks: 'Auto-deducted 10% from weekly settlement toward ₹5,000 security deposit target.',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    settledAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'REC-FINE-1005',
    driverId: 'drv-demo-3',
    driverName: 'Suresh Shetty',
    driverPhone: '+919741556677',
    vehiclePlate: 'KA 20 B 9912',
    type: 'FINE',
    category: 'UNAUTHORIZED_CANCELLATION',
    title: 'Driver Trip Cancellation after Acceptance',
    amount: 500,
    bookingRef: 'KC-2026-559281',
    status: 'PENDING',
    remarks: 'Dropped trip 15 mins after accepting dispatch without vehicle breakdown proof.',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

async function getLedgerRecords(): Promise<DriverFineOrDepositRecord[]> {
  try {
    const rows = (await prisma.$queryRawUnsafe(`
      SELECT "value" FROM "SystemSetting" WHERE "key" = 'driver_deposits_fines_ledger' LIMIT 1;
    `)) as any[];

    if (rows && rows.length > 0 && rows[0].value) {
      const parsed = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      if (Array.isArray(parsed)) return parsed;
    }

    // Initialize with demo data if empty
    const serialized = JSON.stringify(INITIAL_DEMO_RECORDS).replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES ('driver_deposits_fines_ledger', '${serialized}'::jsonb, NOW())
      ON CONFLICT ("key") DO NOTHING;
    `);
    return INITIAL_DEMO_RECORDS;
  } catch (err) {
    console.warn('Could not read driver_deposits_fines_ledger:', err);
    return INITIAL_DEMO_RECORDS;
  }
}

async function saveLedgerRecords(records: DriverFineOrDepositRecord[]) {
  const serialized = JSON.stringify(records).replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`
    INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
    VALUES ('driver_deposits_fines_ledger', '${serialized}'::jsonb, NOW())
    ON CONFLICT ("key")
    DO UPDATE SET
      "value" = EXCLUDED."value",
      "updatedAt" = NOW();
  `);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get('type') || 'ALL';
    const statusFilter = searchParams.get('status') || 'ALL';
    const searchQuery = searchParams.get('search')?.toLowerCase().trim() || '';

    // Fetch records
    const allRecords = await getLedgerRecords();

    // Fetch live drivers for selection modal
    let driversList: any[] = [];
    try {
      const dbDrivers = await prisma.driver.findMany({
        where: { deletedAt: null },
        include: {
          user: { select: { fullName: true, phone: true } },
          vehicles: {
            where: { deletedAt: null },
            select: { plateNumber: true, category: true },
          },
        },
      });

      driversList = dbDrivers.map((d) => ({
        id: d.id,
        name: d.user?.fullName || 'Driver',
        phone: d.user?.phone || '',
        plateNumber: d.vehicles?.[0]?.plateNumber || 'No Vehicle',
        category: d.vehicles?.[0]?.category || 'SEDAN',
      }));
    } catch (e) {
      console.warn('Could not load db drivers, using fallback list:', e);
      driversList = [
        { id: 'drv-demo-1', name: 'Mohan Kumar', phone: '+919876543210', plateNumber: 'KA 19 MD 4022', category: 'SEDAN' },
        { id: 'drv-demo-2', name: 'Ramesh Gowda', phone: '+919845112233', plateNumber: 'KA 04 AK 8841', category: 'SUV' },
        { id: 'drv-demo-3', name: 'Suresh Shetty', phone: '+919741556677', plateNumber: 'KA 20 B 9912', category: 'CRYSTA' },
      ];
    }

    // Apply filtering
    let filtered = allRecords;
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter((r) => r.type === typeFilter);
    }
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.driverName.toLowerCase().includes(searchQuery) ||
          r.driverPhone.includes(searchQuery) ||
          (r.vehiclePlate && r.vehiclePlate.toLowerCase().includes(searchQuery)) ||
          r.title.toLowerCase().includes(searchQuery) ||
          (r.bookingRef && r.bookingRef.toLowerCase().includes(searchQuery))
      );
    }

    // Calculate KPI Totals
    const totalDepositsHeld = allRecords
      .filter((r) => r.type === 'DEPOSIT' && (r.status === 'PAID' || r.status === 'DEDUCTED'))
      .reduce((sum, r) => sum + r.amount, 0);

    const totalFinesImposed = allRecords
      .filter((r) => r.type === 'FINE' && r.status !== 'WAIVED')
      .reduce((sum, r) => sum + r.amount, 0);

    const totalFinesCollected = allRecords
      .filter((r) => r.type === 'FINE' && (r.status === 'PAID' || r.status === 'DEDUCTED'))
      .reduce((sum, r) => sum + r.amount, 0);

    const pendingFines = allRecords
      .filter((r) => r.type === 'FINE' && r.status === 'PENDING')
      .reduce((sum, r) => sum + r.amount, 0);

    return NextResponse.json({
      success: true,
      records: filtered,
      summary: {
        totalDepositsHeld,
        totalFinesImposed,
        totalFinesCollected,
        pendingFines,
        totalCount: allRecords.length,
      },
      drivers: driversList,
    });
  } catch (error: any) {
    console.error('Error fetching deposits & fines ledger:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { driverId, driverName, driverPhone, vehiclePlate, type, category, title, amount, bookingRef, remarks, paymentMethod } = body;

    if (!driverName || !amount || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Driver name and valid amount are required' }, { status: 400 });
    }

    const currentRecords = await getLedgerRecords();
    const newRecord: DriverFineOrDepositRecord = {
      id: `REC-${type === 'DEPOSIT' ? 'DEP' : 'FINE'}-${Date.now().toString().slice(-6)}`,
      driverId: driverId || `drv-${Date.now()}`,
      driverName,
      driverPhone: driverPhone || '',
      vehiclePlate: vehiclePlate || '',
      type: (type as LedgerRecordType) || 'FINE',
      category: category || 'CUSTOM',
      title: title || (type === 'DEPOSIT' ? 'Security Deposit' : 'Fine / Penalty'),
      amount: Number(amount),
      bookingRef: bookingRef?.trim() || undefined,
      status: type === 'DEPOSIT' && paymentMethod !== 'PAYOUT_DEDUCTION' ? 'PAID' : 'PENDING',
      remarks: remarks || '',
      paymentMethod: paymentMethod || (type === 'DEPOSIT' ? 'BANK_TRANSFER' : 'PAYOUT_DEDUCTION'),
      createdAt: new Date().toISOString(),
      settledAt: type === 'DEPOSIT' && paymentMethod !== 'PAYOUT_DEDUCTION' ? new Date().toISOString() : undefined,
    };

    const updated = [newRecord, ...currentRecords];
    await saveLedgerRecords(updated);

    return NextResponse.json({ success: true, record: newRecord });
  } catch (error: any) {
    console.error('Error adding ledger record:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, waiverReason } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, message: 'Record ID and new status are required' }, { status: 400 });
    }

    const currentRecords = await getLedgerRecords();
    let updatedRecord: DriverFineOrDepositRecord | null = null;

    const updatedList = currentRecords.map((r) => {
      if (r.id === id) {
        updatedRecord = {
          ...r,
          status: status as LedgerRecordStatus,
          waiverReason: waiverReason || r.waiverReason,
          settledAt: status === 'PAID' || status === 'DEDUCTED' || status === 'REFUNDED' ? new Date().toISOString() : r.settledAt,
        };
        return updatedRecord;
      }
      return r;
    });

    if (!updatedRecord) {
      return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
    }

    await saveLedgerRecords(updatedList);
    return NextResponse.json({ success: true, record: updatedRecord });
  } catch (error: any) {
    console.error('Error updating ledger record:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
