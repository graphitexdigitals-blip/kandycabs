import { driverApiClient, driverTokenStorage } from './api';
import { getSupabaseClient } from '@kandy-cabs/shared';

export type DriverEventType =
  | 'DISPATCH_NEW'
  | 'DISPATCH_REVOKED'
  | 'TRIP_STATUS'
  | 'PROFILE_UPDATED'
  | 'connected'
  | string;

type EventListener = (data: any) => void;

class DriverRealtimeClient {
  private supabaseChannel: any = null;
  private xhr: XMLHttpRequest | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private reconnectTimer: any = null;
  private isSupabaseConnected = false;
  private isSseConnected = false;
  private isStopped = true;
  private processedIndex = 0;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 15000;

  public on(event: DriverEventType, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  public emitLocal(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(data);
        } catch (e) {
          console.error(`Error in driver realtime listener for ${event}:`, e);
        }
      });
    }
  }

  public start() {
    this.isStopped = false;
    if (this.isSupabaseConnected || this.isSseConnected) {
      return;
    }
    this.connectSupabaseRealtime();
  }

  public stop() {
    this.isStopped = true;
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
  }

  // --- PRIMARY: Supabase Realtime (PostgreSQL Replication Channel) ---
  private async connectSupabaseRealtime() {
    if (this.isStopped) return;

    const token = await driverTokenStorage.getToken();
    if (!token) {
      this.scheduleReconnect(3000);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      this.connectFallbackSSE();
      return;
    }

    try {
      // Decode driver token payload for driverId if available
      let driverId: string | null = null;
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const payloadJson = JSON.parse(
            typeof atob === 'function' ? atob(payloadBase64) : Buffer.from(payloadBase64, 'base64').toString('utf8')
          );
          driverId = payloadJson.driverId || payloadJson.id || payloadJson.sub || null;
        }
      } catch (_) {}

      const channelName = driverId
        ? `driver-channel-${driverId}-${Date.now()}`
        : `driver-channel-global-${Date.now()}`;

      let channelBuilder = supabase.channel(channelName);

      if (driverId) {
        // Scoped to driver's own dispatches, assigned bookings, and profile
        channelBuilder = channelBuilder
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'DriverDispatch',
              filter: `driverId=eq.${driverId}`,
            },
            (payload: any) => {
              if (payload.eventType === 'INSERT') {
                this.emitLocal('DISPATCH_NEW', payload.new);
              } else if (payload.eventType === 'UPDATE' && payload.new.status !== 'PENDING') {
                this.emitLocal('DISPATCH_REVOKED', {
                  dispatchId: payload.new.id,
                  bookingId: payload.new.bookingId,
                });
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'Booking',
              filter: `assignedDriverId=eq.${driverId}`,
            },
            (payload: any) => {
              this.emitLocal('TRIP_STATUS', payload.new);
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'Driver',
              filter: `id=eq.${driverId}`,
            },
            (payload: any) => {
              this.emitLocal('PROFILE_UPDATED', payload.new);
            }
          );
      } else {
        // Global driver broadcast listener
        channelBuilder = channelBuilder.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'DriverDispatch',
          },
          (payload: any) => {
            if (payload.eventType === 'INSERT') {
              this.emitLocal('DISPATCH_NEW', payload.new);
            }
          }
        );
      }

      this.supabaseChannel = channelBuilder.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.isSupabaseConnected = true;
          this.emitLocal('connected', { mode: 'SUPABASE_REALTIME' });
          if (this.xhr) {
            try {
              this.xhr.abort();
            } catch (_) {}
            this.xhr = null;
            this.isSseConnected = false;
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isSupabaseConnected = false;
          if (!this.isStopped && !this.isSseConnected) {
            this.connectFallbackSSE();
          }
        }
      });
    } catch (err) {
      console.warn('[Driver Realtime] Supabase subscription failed, falling back to SSE:', err);
      this.isSupabaseConnected = false;
      this.connectFallbackSSE();
    }
  }

  // --- FALLBACK: Next.js SSE Stream ---
  private async connectFallbackSSE() {
    if (this.isStopped || this.isSupabaseConnected || this.xhr) return;

    const token = await driverTokenStorage.getToken();
    if (!token) {
      this.scheduleReconnect(3000);
      return;
    }

    const baseUrl = driverApiClient.getBaseUrl();
    const url = `${baseUrl}/api/driver/events`;

    try {
      const xhr = new XMLHttpRequest();
      this.xhr = xhr;
      this.processedIndex = 0;

      xhr.open('GET', url, true);
      xhr.setRequestHeader('Accept', 'text/event-stream');
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.onreadystatechange = () => {
        if (this.isStopped) return;

        try {
          if (xhr.readyState === 3 || xhr.readyState === 4) {
            let responseText = '';
            try {
              responseText = xhr.responseText || '';
            } catch (_) {
              // In React Native on Android, responseText may not be available until readyState is 4
              return;
            }
            if (responseText && responseText.length > this.processedIndex) {
              const newChunk = responseText.substring(this.processedIndex);
              this.processedIndex = responseText.length;
              this.parseSSEChunk(newChunk);
            }
          }

          if (xhr.readyState === 4) {
            this.isSseConnected = false;
            this.xhr = null;
            if (!this.isStopped && !this.isSupabaseConnected) {
              this.scheduleReconnect();
            }
          }
        } catch (stateErr) {
          console.warn('[Driver Realtime] SSE state error:', stateErr);
        }
      };

      xhr.onerror = () => {
        this.isSseConnected = false;
        this.xhr = null;
        if (!this.isStopped && !this.isSupabaseConnected) {
          this.scheduleReconnect();
        }
      };

      xhr.send();
    } catch (err) {
      console.warn('Driver fallback SSE error:', err);
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

  private scheduleReconnect(explicitDelay?: number) {
    if (this.isStopped || this.reconnectTimer) return;

    const delay = explicitDelay || this.reconnectDelay;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isStopped) {
        this.connectSupabaseRealtime();
      }
    }, delay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }
}

export const driverRealtimeClient = new DriverRealtimeClient();
