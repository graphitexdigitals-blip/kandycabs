import 'fast-text-encoding';
import '@kandy-cabs/shared';
import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import '../lib/location-tracker';
import '../lib/i18n';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Suppress development yellow box overlays so they do not block driver workflow
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const router = useRouter();

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
        <Stack.Screen name="notifications" options={{ title: 'Updates & Notifications', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="trip" options={{ contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="+not-found" options={{ contentStyle: { backgroundColor: '#ffffff' } }} />
      </Stack>
    </ErrorBoundary>
  );
}
