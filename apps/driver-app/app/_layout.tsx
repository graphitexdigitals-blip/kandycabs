import 'fast-text-encoding';
import '@kandy-cabs/shared';
import React from 'react';
import { LogBox } from 'react-native';
import { Stack } from 'expo-router';
import '../lib/location-tracker';
import '../lib/i18n';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Suppress development yellow box overlays so they do not block driver workflow
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#ffffff' } }}>
        <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="login" options={{ title: 'Driver Sign In', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="onboarding" options={{ title: 'Driver Onboarding', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="dashboard" options={{ title: 'Driver Dashboard', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="documents" options={{ title: 'Driver Documents', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="payout-details" options={{ title: 'Settlement & Bank Details', contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="trip" options={{ contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen name="+not-found" options={{ contentStyle: { backgroundColor: '#ffffff' } }} />
      </Stack>
    </ErrorBoundary>
  );
}
