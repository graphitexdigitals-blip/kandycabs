import { customerApiClient } from './api';
import { getSupabaseClient } from '@kandy-cabs/shared';

export type CustomerEventType =
  | 'DRIVER_LOCATION'
  | 'BOOKING_STATUS'
  | 'TRIP_COMPLETED'
  | 'PAYMENT_RECEIVED'
  | 'DRIVER_NEAR_PICKUP'
  | 'DRIVER_ARRIVED'
  | 'connected'
  | string;

type EventListener = (data: any) => void;

class CustomerRealtimeTracker {
  private supabaseChannel: any = null;
  private xhr: XMLHttpRequest | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private reconnectTimer: any = null;
  private isSupabaseConnected = false;
  private isSseConnected = false;
  private currentBookingId: string | null = null;
  private processedIndex = 0;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 15000;
  private lastProcessedTimestamp: Map<string, number> = new Map();

  public on(event: CustomerEventType, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  public emitLocal(event: string, data: any) {
    if (event === 'DRIVER_LOCATION' && data && typeof data.lat === 'number' && typeof data.lng === 'number') {
      const locKey = `${data.lat.toFixed(5)},${data.lng.toFixed(5)}`;
      const lastTime = this.lastProcessedTimestamp.get(locKey) || 0;
      const now = Date.now();
      if (now - lastTime < 3000) {
        return; // Skip duplicate identical coordinate burst within 3 seconds
      }
      this.lastProcessedTimestamp.set(locKey, now);
    }

    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(data);
        } catch (e) {
          console.error(`Error in customer realtime listener for ${event}:`, e);
        }
      });
    }
  }

  public trackBooking(bookingId: string) {
    if (this.currentBookingId === bookingId && (this.isSupabaseConnected || this.isSseConnected)) {
      return;
    }
    this.stop();
    this.currentBookingId = bookingId;
    this.connectSupabaseRealtime(bookingId);
  }

  public stop() {
    this.currentBookingId = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 1. Clean up Supabase Channel
    if (this.supabaseChannel) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          supabase.removeChannel(this.supabaseChannel);
        } else {
          this.supabaseChannel.unsubscribe();
        }
      } catch (_) {}
      this.supabaseChannel = null;
    }
    this.isSupabaseConnected = false;

    // 2. Clean up Fallback SSE
    if (this.xhr) {
      try {
        this.xhr.abort();
      } catch (_) {}
      this.xhr = null;
    }
    this.isSseConnected = false;
    this.processedIndex = 0;
    this.lastProcessedTimestamp.clear();
  }

  // --- PRIMARY: Supabase Realtime (PostgreSQL Replication Channel) ---
  private connectSupabaseRealtime(bookingId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      // Fall back directly to SSE if Supabase Client is unavailable
      this.connectFallbackSSE(bookingId);
      return;
    }

    try {
      const channelName = `customer-booking-${bookingId}-${Date.now()}`;
      this.supabaseChannel = supabase
        .channel(channelName)
        // 1. Listen for Booking row changes (Status, Driver Assignment, Odometer, etc.)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'Booking',
            filter: `id=eq.${bookingId}`,
          },
          (payload: any) => {
            const newBooking = payload.new;
            if (!newBooking) return;

            this.emitLocal('BOOKING_STATUS', newBooking);

            // Emit location if driver location fields are attached
            if (newBooking.driverCurrentLat != null && newBooking.driverCurrentLng != null) {
              this.emitLocal('DRIVER_LOCATION', {
                bookingId,
                lat: newBooking.driverCurrentLat,
                lng: newBooking.driverCurrentLng,
                driverId: newBooking.assignedDriverId,
              });
            }
          }
        )
        // 2. Listen for Trip Events (Proximity: Near Pickup, Arrived, etc.)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'TripEvent',
            filter: `bookingId=eq.${bookingId}`,
          },
          (payload: any) => {
            const newEvent = payload.new;
            if (!newEvent) return;

            if (newEvent.type === 'DRIVER_NEAR_PICKUP') {
              this.emitLocal('DRIVER_NEAR_PICKUP', newEvent);
            } else if (newEvent.type === 'DRIVER_ARRIVED') {
              this.emitLocal('DRIVER_ARRIVED', newEvent);
            }
          }
        )
        // 3. Listen for High-Precision GPS Breadcrumbs (TripTracking)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'TripTracking',
            filter: `bookingId=eq.${bookingId}`,
          },
          (payload: any) => {
            const newPoint = payload.new;
            if (!newPoint) return;

            this.emitLocal('DRIVER_LOCATION', {
              bookingId,
              lat: newPoint.lat,
              lng: newPoint.lng,
              heading: newPoint.heading,
              speed: newPoint.speed,
              timestamp: newPoint.createdAt,
            });
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            this.isSupabaseConnected = true;
            this.emitLocal('connected', { mode: 'SUPABASE_REALTIME', bookingId });
            // If fallback SSE was active, tear it down cleanly
            if (this.xhr) {
              try {
                this.xhr.abort();
              } catch (_) {}
              this.xhr = null;
              this.isSseConnected = false;
            }
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            this.isSupabaseConnected = false;
            // Fall back to SSE connection
            if (this.currentBookingId === bookingId && !this.isSseConnected) {
              this.connectFallbackSSE(bookingId);
            }
          }
        });
    } catch (err) {
      console.warn('[Customer Realtime] Supabase subscription failed, falling back to SSE:', err);
      this.isSupabaseConnected = false;
      this.connectFallbackSSE(bookingId);
    }
  }

  // --- FALLBACK: Next.js SSE Stream ---
  private connectFallbackSSE(bookingId: string) {
    if (!this.currentBookingId || this.isSupabaseConnected || this.xhr) return;

    const baseUrl = customerApiClient.getBaseUrl();
    const url = `${baseUrl}/api/customer/events?bookingId=${bookingId}`;

    try {
      const xhr = new XMLHttpRequest();
      this.xhr = xhr;
      this.processedIndex = 0;

      xhr.open('GET', url, true);
      xhr.setRequestHeader('Accept', 'text/event-stream');
      xhr.setRequestHeader('Cache-Control', 'no-cache');

      xhr.onreadystatechange = () => {
        if (!this.currentBookingId) return;

        if (xhr.readyState === 3 || xhr.readyState === 4) {
          const responseText = xhr.responseText || '';
          if (responseText.length > this.processedIndex) {
            const newChunk = responseText.substring(this.processedIndex);
            this.processedIndex = responseText.length;
            this.parseSSEChunk(newChunk);
          }
        }

        if (xhr.readyState === 4) {
          this.isSseConnected = false;
          this.xhr = null;
          if (this.currentBookingId && !this.isSupabaseConnected) {
            this.scheduleReconnect();
          }
        }
      };

      xhr.onerror = () => {
        this.isSseConnected = false;
        this.xhr = null;
        if (this.currentBookingId && !this.isSupabaseConnected) {
          this.scheduleReconnect();
        }
      };

      xhr.send();
    } catch (err) {
      console.warn('Customer fallback SSE error:', err);
      this.scheduleReconnect();
    }
  }

  private parseSSEChunk(chunk: string) {
    const blocks = chunk.split('\n\n');
    for (const block of blocks) {
      const lines = block.split('\n');
      let eventType = 'message';
      let dataStr = '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) {
          continue;
        }

        if (trimmed.startsWith('event:')) {
          eventType = trimmed.substring(6).trim();
        } else if (trimmed.startsWith('data:')) {
          dataStr = trimmed.substring(5).trim();
        }
      }

      if (eventType && dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          if (eventType === 'connected') {
            this.isSseConnected = true;
            this.reconnectDelay = 2000;
          }
          this.emitLocal(eventType, parsed);
        } catch {
          this.emitLocal(eventType, dataStr);
        }
      }
    }
  }

  private scheduleReconnect() {
    if (!this.currentBookingId || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.currentBookingId) {
        // Attempt primary Supabase Realtime first on reconnect
        this.connectSupabaseRealtime(this.currentBookingId);
      }
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }
}

export const customerRealtimeTracker = new CustomerRealtimeTracker();
