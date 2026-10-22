import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookingStatus } from '@kandy-cabs/shared';
import { customerApiClient, customerTokenStorage } from '../lib/api';
import { customerRealtimeTracker } from '../lib/realtime-client';
import { reviewManager } from '../lib/reviewManager';
import { DriverRatingModal } from './DriverRatingModal';

export function GlobalTripReviewWatcher() {
  const [ratingBooking, setRatingBooking] = useState<any | null>(null);
  const activeRideIdRef = useRef<string | null>(null);
  const isCheckingRef = useRef<boolean>(false);

  // Sync state with reviewManager
  useEffect(() => {
    const unsub = reviewManager.subscribe((booking) => {
      setRatingBooking(booking);
    });
    return () => unsub();
  }, []);

  const checkBookings = useCallback(async () => {
    const token = customerTokenStorage.getToken();
    if (!token || isCheckingRef.current) return;

    isCheckingRef.current = true;
    try {
      const res = await customerApiClient.fetch('/api/customer/bookings/list?category=ALL&limit=8');
      if (res && res.success && Array.isArray(res.bookings)) {
        const list = res.bookings;

        // 1. Identify active ride
        const activeRide = list.find(
          (b: any) =>
            b.status === BookingStatus.DRIVER_ACCEPTED ||
            b.status === BookingStatus.DRIVER_EN_ROUTE ||
            b.status === BookingStatus.TRIP_STARTED
        );

        if (activeRide) {
          activeRideIdRef.current = activeRide.id;
          customerRealtimeTracker.trackBooking(activeRide.id);
        } else {
          // If we previously had an active ride that just completed
          if (activeRideIdRef.current) {
            const previousId = activeRideIdRef.current;
            activeRideIdRef.current = null;
            const justCompleted = list.find(
              (b: any) =>
                b.id === previousId &&
                b.status === BookingStatus.TRIP_COMPLETED &&
                !b.customerRating &&
                !reviewManager.isDismissed(b.id)
            );
            if (justCompleted) {
              reviewManager.showReview(justCompleted);
              return;
            }
          }
        }

        // 2. Auto-prompt review if there is any unreviewed completed ride
        const unreviewed = list.find(
          (b: any) =>
            b.status === BookingStatus.TRIP_COMPLETED &&
            !b.customerRating &&
            !reviewManager.isDismissed(b.id)
        );

        if (unreviewed && !reviewManager.getCurrentBooking()) {
          reviewManager.showReview(unreviewed);
        }
      }
    } catch (_) {
      // Non-blocking background check
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkBookings();

    // Re-check on token changes
    const unsubAuth = customerTokenStorage.subscribe(() => {
      checkBookings();
    });

    // Realtime booking status listener
    const handleStatusUpdate = async (payload: any) => {
      if (!payload) return;
      const bId = payload.id || payload.bookingId;
      const status = payload.status;

      if (status === BookingStatus.TRIP_COMPLETED && bId && !reviewManager.isDismissed(bId)) {
        // If driver completed the trip, stop active tracking
        activeRideIdRef.current = null;

        // If the payload has full driver & vehicle metadata, pop it up directly
        if (payload.assignedDriver && payload.humanReadableRef) {
          reviewManager.showReview(payload);
          return;
        }

        // Otherwise fetch full details immediately so modal shows complete driver & cab information
        try {
          const res = await customerApiClient.fetch('/api/customer/bookings/list?category=ALL&limit=5');
          if (res && res.bookings) {
            const match = res.bookings.find((b: any) => b.id === bId);
            if (match && !match.customerRating) {
              reviewManager.showReview(match);
              return;
            }
          }
        } catch (_) {}

        // Fallback with current payload
        reviewManager.showReview(payload);
      } else {
        // Refresh active booking state on any other status change
        checkBookings();
      }
    };

    const unsubStatus = customerRealtimeTracker.on('BOOKING_STATUS', handleStatusUpdate);
    const unsubComplete = customerRealtimeTracker.on('TRIP_COMPLETED', handleStatusUpdate);

    // Watchdog polling: 4 seconds if an active ride is in progress, 12 seconds idle
    const interval = setInterval(() => {
      checkBookings();
    }, activeRideIdRef.current ? 4000 : 10000);

    return () => {
      unsubAuth();
      unsubStatus();
      unsubComplete();
      clearInterval(interval);
    };
  }, [checkBookings]);

  if (!ratingBooking) {
    return null;
  }

  return (
    <DriverRatingModal
      booking={ratingBooking}
      isOpen={!!ratingBooking}
      onClose={() => {
        reviewManager.closeReview();
      }}
      onRatingSubmitted={(ratingData) => {
        reviewManager.markSubmitted(ratingData);
      }}
    />
  );
}
