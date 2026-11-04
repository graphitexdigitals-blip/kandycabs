import { NextRequest } from 'next/server';
import { getDriverSession } from '@/lib/driver-auth';
import { RealtimeEvents, DriverEventPayload } from '@/lib/realtime-events';
import { handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  const session = await getDriverSession(req);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Driver authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const driverId = session.driverId;
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connected event
      const initialMessage = `event: connected\ndata: ${JSON.stringify({
        driverId,
        timestamp: Date.now(),
        message: 'Real-time driver event channel established',
      })}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));

      // 2. Subscribe to driver events
      unsubscribe = RealtimeEvents.subscribeDriver(driverId, (event: DriverEventPayload) => {
        try {
          const sseChunk = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(sseChunk));
        } catch (err) {
          console.error('Error enqueueing driver SSE event:', err);
        }
      });

      // 3. Keep-alive heartbeat every 15 seconds
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      }, 15000);
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
