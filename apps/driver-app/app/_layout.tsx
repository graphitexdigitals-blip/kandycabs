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
import { LogBox, Platform, PermissionsAndroid, Text as RNText, TextInput as RNTextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import '../lib/location-tracker';
import '../lib/i18n';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { APP_FONT, resolveRobotoStyle } from '../constants/typography';

// Keep splash screen visible until custom Roboto fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

// Globally intercept RNText & RNTextInput to apply universal clean Roboto sans-serif typography
// This prevents OEM themes (e.g., OnePlus Serif font settings) from overriding app styles.
const originalTextRender = (RNText as any).__originalRender || (RNText as any).render;
if (typeof originalTextRender === 'function') {
  (RNText as any).__originalRender = originalTextRender;
  (RNText as any).render = function (props: any, ref: any) {
    const robotoOverride = resolveRobotoStyle(props?.style);
    if (!robotoOverride) {
      return originalTextRender.call(this, props, ref);
    }
    const mergedProps = {
      ...props,
      style: [props?.style, robotoOverride],
    };
    return originalTextRender.call(this, mergedProps, ref);
  };
}

const originalInputRender = (RNTextInput as any).__originalRender || (RNTextInput as any).render;
if (typeof originalInputRender === 'function') {
  (RNTextInput as any).__originalRender = originalInputRender;
  (RNTextInput as any).render = function (props: any, ref: any) {
    const robotoOverride = resolveRobotoStyle(props?.style);
    if (!robotoOverride) {
      return originalInputRender.call(this, props, ref);
    }
    const mergedProps = {
      ...props,
      style: [props?.style, robotoOverride],
    };
    return originalInputRender.call(this, mergedProps, ref);
  };
}

console.log('[DEBUG_DRIVER] _layout.tsx loaded at top level');

// Suppress development yellow box overlays so they do not block driver workflow
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  console.log('[DEBUG_DRIVER] RootLayout component rendered');
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    'Roboto': require('../assets/fonts/Roboto-Regular.ttf'),
    'Roboto-Regular': require('../assets/fonts/Roboto-Regular.ttf'),
    'Roboto-Medium': require('../assets/fonts/Roboto-Medium.ttf'),
    'Roboto-Bold': require('../assets/fonts/Roboto-Bold.ttf'),
  });

  console.log('[DEBUG_DRIVER] fontsLoaded status:', fontsLoaded, 'fontError:', fontError);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

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

  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }
    const t = setTimeout(() => {
      console.log('[DEBUG_DRIVER] Force-showing app layout via timeout fallback');
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  if (!ready && !fontsLoaded) {
    return null;
  }

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
