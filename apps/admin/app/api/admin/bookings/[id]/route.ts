import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { getAdminSession } from '@/lib/auth';
import { resolveImageUrl } from '@/lib/resolveImageUrl';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin privileges required' },
        { status: 401 }
      );
    }

    const { id } = params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: { select: { id: true, fullName: true, phone: true } },
          },
        },
        assignedDriver: {
          include: {
            user: { select: { id: true, fullName: true, phone: true } },
            vehicles: true,
          },
        },
        vehicle: true,
        payments: {
          orderBy: { verifiedAt: 'desc' },
        },
        dispatches: {
          orderBy: { broadcastAt: 'desc' },
          include: {
            driver: {
              include: {
                user: { select: { fullName: true, phone: true } },
                vehicles: true,
              },
            },
          },
        },
        tripEvents: {
          orderBy: { createdAt: 'desc' },
        },
        tripTrackings: {
          orderBy: { recordedAt: 'desc' },
          take: 30,
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: 'Booking not found' },
        { status: 404 }
      );
    }

    // Fetch related audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Booking',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        actorUser: {
          select: { id: true, fullName: true, roles: true },
        },
      },
    });

    const formattedBooking = {
      ...booking,
      startingOdometerImagePath: resolveImageUrl(booking.startingOdometerImagePath) || null,
      finalOdometerImagePath: resolveImageUrl(booking.finalOdometerImagePath) || null,
      vehicleInspectionPhotos: Array.isArray(booking.vehicleInspectionPhotos)
        ? booking.vehicleInspectionPhotos.map((p) => resolveImageUrl(p)).filter(Boolean)
        : [],
    };

    return NextResponse.json(
      {
        success: true,
        booking: formattedBooking,
        auditLogs,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in GET /api/admin/bookings/[id]:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch booking details' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Admin privileges required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { driverAllowance, driverPayeeAmount, driverPaymentStatus } = body;

    const dataToUpdate: any = {};
    if (driverAllowance !== undefined) {
      dataToUpdate.driverAllowance = parseFloat(String(driverAllowance)) || 0;
    }
    if (driverPayeeAmount !== undefined) {
      dataToUpdate.driverPayeeAmount = parseFloat(String(driverPayeeAmount)) || 0;
    }
    if (driverPaymentStatus !== undefined) {
      dataToUpdate.driverPaymentStatus = driverPaymentStatus;
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: dataToUpdate,
      include: {
        customer: {
          include: {
            user: { select: { id: true, fullName: true, phone: true } },
          },
        },
        assignedDriver: {
          include: {
            user: { select: { id: true, fullName: true, phone: true } },
          },
        },
      },
    });

    // Record AuditLog
    await prisma.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: 'ADMIN_UPDATE_DRIVER_PAYMENT',
        entityType: 'Booking',
        entityId: id,
        reason: `Admin updated driver payment: Allowance=₹${driverAllowance ?? 'unchanged'}, Payee=₹${driverPayeeAmount ?? 'unchanged'}, Status=${driverPaymentStatus ?? 'unchanged'}`,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Driver payment details updated successfully',
        booking: updatedBooking,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/bookings/[id]:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update driver payment details' },
      { status: 500 }
    );
  }
}
