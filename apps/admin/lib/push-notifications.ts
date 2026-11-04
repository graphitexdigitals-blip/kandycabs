interface PushNotificationPayload {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

/**
 * Universal Cloud Push Notification dispatcher for Vercel
 * Supports both Expo Push API and Firebase Cloud Messaging (FCM).
 */
export async function sendCloudPushNotification(payload: PushNotificationPayload): Promise<{ success: boolean; result?: any; error?: string }> {
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  const validTokens = recipients.filter((t) => typeof t === 'string' && t.trim().length > 0);

  if (validTokens.length === 0) {
    return { success: false, error: 'No valid push tokens provided' };
  }

  // 1. Separate tokens into Expo Push tokens and native FCM tokens
  const expoTokens = validTokens.filter((t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));
  const fcmTokens = validTokens.filter((t) => !t.startsWith('ExponentPushToken[') && !t.startsWith('ExpoPushToken['));

  const results: any[] = [];

  // 2. Dispatch via Expo Push Service (Free, zero-config on Vercel)
  if (expoTokens.length > 0) {
    try {
      const messages = expoTokens.map((token) => ({
        to: token,
        sound: payload.sound || 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        priority: payload.priority || 'high',
        channelId: payload.channelId || 'driver-trips',
      }));

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const resData = await res.json().catch(() => ({}));
      results.push({ service: 'expo', data: resData });
    } catch (err: any) {
      console.error('[CloudPush] Expo push failed:', err?.message || err);
    }
  }

  // 3. Dispatch via Firebase Cloud Messaging (FCM) Legacy/HTTP API if FIREBASE_SERVER_KEY is configured
  const fcmServerKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
  if (fcmTokens.length > 0 && fcmServerKey) {
    for (const token of fcmTokens) {
      try {
        const res = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify({
            to: token,
            notification: {
              title: payload.title,
              body: payload.body,
              sound: 'default',
            },
            data: payload.data || {},
            priority: 'high',
          }),
        });
        const resData = await res.json().catch(() => ({}));
        results.push({ service: 'fcm', data: resData });
      } catch (err: any) {
        console.error('[CloudPush] FCM push failed:', err?.message || err);
      }
    }
  }

  return { success: results.length > 0, result: results };
}

