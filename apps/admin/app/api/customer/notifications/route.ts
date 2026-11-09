import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@kandy-cabs/db';
import { verifyAuthToken, BookingStatus } from '@kandy-cabs/shared';
import { setCorsHeaders, handleOptions } from '@/lib/cors';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

interface NotificationItem {
  id: string;
  type:
    | 'WELCOME'
    | 'OFFER'
    | 'DRIVER_ASSIGNED'
    | 'DRIVER_EN_ROUTE'
    | 'DRIVER_ARRIVED'
    | 'TRIP_STARTED'
    | 'TRIP_COMPLETED'
    | 'BOOKING_RECEIVED'
    | 'ADMIN_ANNOUNCEMENT';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  category: 'ALL' | 'RIDES' | 'OFFERS';
  actionUrl?: string;
  actionLabel?: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  bookingRef?: string;
  otp?: string;
}

export async function GET(req: NextRequest) {
  try {
    const notifications: NotificationItem[] = [];

    // 1. Authenticate customer if token is present
    let token = req.cookies.get('kandy_session')?.value;
    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    let user: any = null;
    let customer: any = null;

    if (token) {
      try {
        const payload = await verifyAuthToken(token);
        if (payload?.userId) {
          user = await prisma.user.findUnique({
            where: { id: payload.userId },
            include: { customer: true },
          });
          customer = user?.customer;
        }
      } catch (authErr) {
        // Continue gracefully as guest if token is expired or invalid
      }
    }

    // 2. If logged in, fetch customer's recent bookings to generate live ride notifications
    if (user && customer) {
      const customerIds = [customer.id];
      if (user.phone) {
        const usersWithPhone = await prisma.user.findMany({
          where: { phone: user.phone },
          select: { customer: { select: { id: true } } },
        });
        for (const u of usersWithPhone) {
          if (u.customer && !customerIds.includes(u.customer.id)) {
            customerIds.push(u.customer.id);
          }
        }
      }

      const bookings = await prisma.booking.findMany({
        where: {
          customerId: { in: customerIds },
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          assignedDriver: {
            include: {
              user: { select: { fullName: true, phone: true } },
              vehicles: true,
            },
          },
          vehicle: true,
          tripEvents: true,
        },
      });

      bookings.forEach((b: any) => {
        const driverName = b.assignedDriver?.user?.fullName || 'Assigned Driver';
        const vehicle = b.vehicle || b.assignedDriver?.vehicles?.[0];
        const vehicleDesc = vehicle
          ? `${(vehicle.category || b.category || 'Sedan').toUpperCase()} • ${vehicle.plateNumber || 'Verified'}`
          : (b.category || 'Sedan').toUpperCase();
        const ref = b.humanReadableRef;

        // Notification: Fleet Availability Approved (Ready to Pay Advance)
        const isFleetApproved = b.tripEvents?.some((e: any) => e.type === 'FLEET_APPROVED');
        if (isFleetApproved && b.advancePaymentStatus === 'PENDING') {
          notifications.push({
            id: `notif-fleet-approved-${b.id}`,
            type: 'ADMIN_ANNOUNCEMENT',
            title: 'Fleet Availability Confirmed!',
            message: `Admin has verified and approved fleet availability for your ${vehicleDesc} ride (${ref}). You can now complete your advance payment.`,
            timestamp: b.updatedAt ? b.updatedAt.toISOString() : b.createdAt.toISOString(),
            read: false,
            category: 'RIDES',
            actionUrl: '/my-bookings',
            actionLabel: 'Pay Advance',
            icon: 'checkmark-circle',
            iconColor: '#059669',
            iconBg: '#ecfdf5',
            bookingRef: ref,
          });
        }

        const hasArrived = b.tripEvents?.some((e: any) => e.type === 'DRIVER_ARRIVED');
        const hasNear = b.tripEvents?.some((e: any) => e.type === 'DRIVER_NEAR_PICKUP');

        // Notification: Driver Reached Pickup
        if (
          (b.status === BookingStatus.DRIVER_ACCEPTED || b.status === BookingStatus.DRIVER_EN_ROUTE) &&
          (hasArrived || hasNear)
        ) {
          notifications.push({
            id: `notif-arrived-${b.id}`,
            type: 'DRIVER_ARRIVED',
            title: 'Driver Reached Pickup Point',
            message: `Your chauffeur ${driverName} has reached your pickup spot. Share OTP to board your cab safely.`,
            timestamp: b.updatedAt ? b.updatedAt.toISOString() : b.createdAt.toISOString(),
            read: false,
            category: 'RIDES',
            actionUrl: '/my-bookings',
            actionLabel: 'View Ride OTP',
            icon: 'shield-checkmark',
            iconColor: '#059669',
            iconBg: '#ecfdf5',
            bookingRef: ref,
            otp: b.pickupOtp || undefined,
          });
        }

        // Notification: Driver on Trip / En Route
        if (b.status === BookingStatus.DRIVER_EN_ROUTE) {
          notifications.push({
            id: `notif-enroute-${b.id}`,
            type: 'DRIVER_EN_ROUTE',
            title: 'Driver on Trip (En Route)',
            message: `Chauffeur ${driverName} is on the way to your pickup location. Please be ready.`,
            timestamp: b.updatedAt ? b.updatedAt.toISOString() : b.createdAt.toISOString(),
            read: false,
            category: 'RIDES',
            actionUrl: '/my-bookings',
            actionLabel: 'Track Driver',
            icon: 'car-sport',
            iconColor: '#0284c7',
            iconBg: '#f0f9ff',
            bookingRef: ref,
          });
        }

        // Notification: Driver Details Assigned
        if (
          b.status === BookingStatus.DRIVER_ACCEPTED ||
          b.status === BookingStatus.DRIVER_EN_ROUTE ||
          b.status === BookingStatus.TRIP_STARTED
        ) {
          notifications.push({
            id: `notif-assigned-${b.id}`,
            type: 'DRIVER_ASSIGNED',
            title: 'Driver Details Assigned',
            message: `Chauffeur ${driverName} is assigned to trip ${ref}. Vehicle: ${vehicleDesc}.`,
            timestamp: b.createdAt ? b.createdAt.toISOString() : new Date().toISOString(),
            read: false,
            category: 'RIDES',
            actionUrl: '/my-bookings',
            actionLabel: 'View Details',
            icon: 'person',
            iconColor: '#103A75',
            iconBg: '#eff6ff',
            bookingRef: ref,
          });
        }

        // Notification: Start Your Ride
        if (b.status === BookingStatus.TRIP_STARTED) {
          notifications.push({
            id: `notif-started-${b.id}`,
            type: 'TRIP_STARTED',
            title: 'Start Your Ride — Trip In Progress',
            message: `Your journey for booking ${ref} has begun. Have a comfortable and safe ride with Kandy Cabs!`,
            timestamp: b.updatedAt ? b.updatedAt.toISOString() : b.createdAt.toISOString(),
            read: false,
            category: 'RIDES',
            actionUrl: '/my-bookings',
            actionLabel: 'Active Trip',
            icon: 'navigate',
            iconColor: '#7c3aed',
            iconBg: '#f5f3ff',
            bookingRef: ref,
          });
        }

        // Notification: Trip Completed & Rating
        if (b.status === BookingStatus.TRIP_COMPLETED) {
          notifications.push({
            id: `notif-completed-${b.id}`,
            type: 'TRIP_COMPLETED',
            title: 'Trip Completed Successfully',
            message: `Your ride ${ref} is completed. Thank you for traveling with Kandy Cabs! Download your tax invoice anytime.`,
            timestamp: b.updatedAt ? b.updatedAt.toISOString() : b.createdAt.toISOString(),
            read: true,
            category: 'RIDES',
            actionUrl: '/my-bookings',
            actionLabel: 'View Tax Invoice',
            icon: 'checkmark-done-circle',
            iconColor: '#15803d',
            iconBg: '#f0fdf4',
            bookingRef: ref,
          });
        }

        // Notification: Booking Confirmed
        if (b.status === BookingStatus.PENDING_ADMIN) {
          notifications.push({
            id: `notif-pending-${b.id}`,
            type: 'BOOKING_RECEIVED',
            title: 'Ride Booking Confirmed',
            message: `Booking ${ref} received for ${b.pickupCity || 'your route'}. Dispatching closest verified chauffeur.`,
            timestamp: b.createdAt.toISOString(),
            read: false,
            category: 'RIDES',
            actionUrl: '/my-bookings',
            actionLabel: 'View Status',
            icon: 'time',
            iconColor: '#b45309',
            iconBg: '#fffbeb',
            bookingRef: ref,
          });
        }
      });
    }

    // 3. Admin Announcements & Updates from Admin Store
    try {
      const bannerPaths = [
        path.join(process.cwd(), '..', '..', '.banners_store.json'),
        path.join(process.cwd(), '.banners_store.json'),
        path.join(process.cwd(), '..', 'admin', '.banners_store.json'),
      ];
      for (const bp of bannerPaths) {
        if (fs.existsSync(bp)) {
          const raw = fs.readFileSync(bp, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.filter((item: any) => item.isActive).forEach((item: any, idx: number) => {
              notifications.push({
                id: `admin-banner-${item.id || idx}`,
                type: 'ADMIN_ANNOUNCEMENT',
                title: item.badge || item.tagline || 'Special Announcement',
                message: item.subTagline || item.tagline || 'New verified travel update from Kandy Cabs administration.',
                timestamp: item.createdAt || new Date(Date.now() - 3600000 * (idx + 1)).toISOString(),
                read: false,
                category: 'OFFERS',
                actionUrl: item.linkUrl || '/',
                actionLabel: item.btnText || 'Explore Now',
                icon: 'megaphone',
                iconColor: '#103A75',
                iconBg: '#eff6ff',
              });
            });
            break;
          }
        }
      }
    } catch (e) {
      // Ignore banner load error
    }

    // 4. Special Offers & Promotion Updates
    notifications.push({
      id: 'notif-offer-airport',
      type: 'OFFER',
      title: 'There is an Offer: Flat 10% OFF Airport Rides',
      message: 'Catch your flights without stress! Enjoy 10% off on all Mangaluru (IXE) & Bengaluru (BLR) Airport transfers with code FLYKANDY.',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      read: false,
      category: 'OFFERS',
      actionUrl: '/',
      actionLabel: 'Book Airport Cab',
      icon: 'gift',
      iconColor: '#ea580c',
      iconBg: '#fff7ed',
    });

    notifications.push({
      id: 'notif-welcome-back',
      type: 'WELCOME',
      title: 'Welcome Back to Kandy Cabs!',
      message: 'Plan your next outstation or round-trip getaway with zero toll surprises and verified AC fleets.',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      read: true,
      category: 'ALL',
      actionUrl: '/',
      actionLabel: 'Book Now',
      icon: 'sparkles',
      iconColor: '#0284c7',
      iconBg: '#f0f9ff',
    });

    notifications.push({
      id: 'notif-welcome-install',
      type: 'WELCOME',
      title: 'Thank You for Installing Kandy Cabs!',
      message: 'Welcome to Karnataka\'s most trusted intercity cab platform. 24/7 dedicated support and top-rated chauffeurs guaranteed on every ride.',
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      read: true,
      category: 'ALL',
      actionUrl: '/',
      actionLabel: 'Start Traveling',
      icon: 'heart',
      iconColor: '#e11d48',
      iconBg: '#fff1f2',
    });

    // 5. Sort notifications by timestamp descending (most recent first)
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const res = NextResponse.json({
      success: true,
      notifications,
      totalCount: notifications.length,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
    return setCorsHeaders(res);
  } catch (error: any) {
    console.error('[API] /api/customer/notifications error:', error);
    const res = NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch notifications', notifications: [] },
      { status: 500 }
    );
    return setCorsHeaders(res);
  }
}
