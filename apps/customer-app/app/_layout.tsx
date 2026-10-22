import 'fast-text-encoding';
import '@kandy-cabs/shared';
import React from 'react';
import { LogBox, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import { GlobalTripReviewWatcher } from '../components/GlobalTripReviewWatcher';

// Suppress development yellow box overlays
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <Stack
        initialRouteName="login"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#ffffff' },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="index" />
        <Stack.Screen name="select-trip-type" />
        <Stack.Screen name="trip-details" />
        <Stack.Screen name="select-cab" />
        <Stack.Screen name="additional-details" />
        <Stack.Screen name="booking/index" />
        <Stack.Screen name="my-bookings" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="support" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <GlobalTripReviewWatcher />
    </>
  );
}
