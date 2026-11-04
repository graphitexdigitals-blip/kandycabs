import { EventEmitter } from 'events';

// Global singleton across the Node.js process
declare global {
  var __kandyRealtimeEmitter: EventEmitter | undefined;
}

function getEmitter(): EventEmitter {
  if (!global.__kandyRealtimeEmitter) {
    const emitter = new EventEmitter();
    // Allow large numbers of concurrent driver/customer subscribers without warning
    emitter.setMaxListeners(2000);
    global.__kandyRealtimeEmitter = emitter;
  }
  return global.__kandyRealtimeEmitter;
}

export const realtimeEmitter = getEmitter();

export type DriverRealtimeEventType =
  | 'DISPATCH_NEW'
  | 'DISPATCH_REVOKED'
  | 'TRIP_STATUS'
  | 'PROFILE_UPDATED';

export type BookingRealtimeEventType =
  | 'DRIVER_LOCATION'
  | 'BOOKING_STATUS'
  | 'TRIP_COMPLETED'
  | 'PAYMENT_RECEIVED'
  | 'DRIVER_NEAR_PICKUP'
  | 'DRIVER_ARRIVED';

export interface DriverEventPayload {
  type: DriverRealtimeEventType;
  driverId: string;
  data: any;
  timestamp: number;
}

export interface BookingEventPayload {
  type: BookingRealtimeEventType;
  bookingId: string;
  data: any;
  timestamp: number;
}

export const RealtimeEvents = {
  // --- DRIVER SCOPED EVENTS ---
  emitToDriver(driverId: string, type: DriverRealtimeEventType, data: any) {
    const payload: DriverEventPayload = {
      type,
      driverId,
      data,
      timestamp: Date.now(),
    };
    realtimeEmitter.emit(`driver:${driverId}`, payload);
  },

  emitToAllDrivers(type: DriverRealtimeEventType, data: any) {
    const payload: DriverEventPayload = {
      type,
      driverId: 'ALL',
      data,
      timestamp: Date.now(),
    };
    realtimeEmitter.emit('driver:ALL', payload);
  },

  subscribeDriver(driverId: string, listener: (payload: DriverEventPayload) => void) {
    const channel = `driver:${driverId}`;
    const allChannel = 'driver:ALL';

    realtimeEmitter.on(channel, listener);
    realtimeEmitter.on(allChannel, listener);

    return () => {
      realtimeEmitter.off(channel, listener);
      realtimeEmitter.off(allChannel, listener);
    };
  },

  // --- BOOKING SCOPED EVENTS (Customer & Driver Live Tracking) ---
  emitToBooking(bookingId: string, type: BookingRealtimeEventType, data: any) {
    const payload: BookingEventPayload = {
      type,
      bookingId,
      data,
      timestamp: Date.now(),
    };
    realtimeEmitter.emit(`booking:${bookingId}`, payload);
  },

  subscribeBooking(bookingId: string, listener: (payload: BookingEventPayload) => void) {
    const channel = `booking:${bookingId}`;
    realtimeEmitter.on(channel, listener);

    return () => {
      realtimeEmitter.off(channel, listener);
    };
  },
};
