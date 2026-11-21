import '../polyfills';
import '@kandy-cabs/shared';
import '../lib/i18n';
import React, { useEffect, useState } from 'react';
import { LogBox, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GlobalTripReviewWatcher } from '../components/GlobalTripReviewWatcher';

// Keep splash screen visible until custom Roboto fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

// Suppress development yellow box overlays
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Roboto': require('../assets/fonts/Roboto-Regular.ttf'),
    'Roboto-Regular': require('../assets/fonts/Roboto-Regular.ttf'),
    'Roboto-Medium': require('../assets/fonts/Roboto-Medium.ttf'),
    'Roboto-Bold': require('../assets/fonts/Roboto-Bold.ttf'),
  });

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }
    // Safety timer ensures app renders smoothly even if font load delays
    const timer = setTimeout(() => {
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  if (!ready && !fontsLoaded) {
    return null;
  }

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
        <Stack.Screen name="notifications" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <GlobalTripReviewWatcher />
    </>
  );
}
