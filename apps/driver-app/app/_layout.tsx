import '../polyfills';

// Patch global Response to prevent whatwg-fetch RangeError on status 0
if (typeof global !== 'undefined' && (global as any).Response) {
  const OrigResponse = (global as any).Response;
  try {
    new OrigResponse(null, { status: 0 });
  } catch (_) {
    const SafeResponse = function (this: any, body?: any, init?: any) {
      if (init && typeof init.status === 'number' && (init.status < 200 || init.status > 599)) {
        init = {
          ...init,
          status: init.status === 0 ? 503 : Math.min(Math.max(init.status, 200), 599),
          statusText: init.statusText || (init.status === 0 ? 'Network Error' : 'Unknown'),
        };
      }
      return new OrigResponse(body, init);
    };
    SafeResponse.prototype = OrigResponse.prototype;
    Object.assign(SafeResponse, OrigResponse);
    try {
      (global as any).Response = SafeResponse;
    } catch (_) {}
  }
}

import '@kandy-cabs/shared';
import React, { useEffect } from 'react';
import { LogBox, Platform, PermissionsAndroid } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import '../lib/location-tracker';
import '../lib/i18n';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Suppress development yellow box overlays so they do not block driver workflow
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const router = useRouter();

  // Request Notification permission immediately on app startup (Android 13+ / API 33+)
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          const hasNotif = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          if (!hasNotif) {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
          }
        } catch (err) {
          console.warn('[RootLayout] Error requesting notification permission:', err);
        }
      }
    })();
  }, []);

  // Handle deep links from notifications when app is launched or opened from background
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      if (
        parsed.path === 'notifications' ||
        parsed.queryParams?.section === 'notifications' ||
        url.includes('notifications')
      ) {
        setTimeout(() => {
          router.push('/notifications');
        }, 150);
      }
    };

    Linking.getInitialURL().then(handleUrl).catch(() => {});
    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => sub.remove();
  }, [router]);

  return (
    <ErrorBoundary>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#ffffff' } }}>
        <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="login" options={{ title: 'Driver Sign In', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="onboarding" options={{ title: 'Driver Onboarding', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="dashboard" options={{ title: 'Driver Dashboard', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="documents" options={{ title: 'Driver Documents', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="payout-details" options={{ title: 'Settlement & Bank Details', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="terms" options={{ title: 'Terms & Conditions', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="trip" options={{ contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="+not-found" options={{ contentStyle: { backgroundColor: '#ffffff' } }} />
      </Stack>
    </ErrorBoundary>
  );
}
