import '../polyfills';
import '@kandy-cabs/shared';
import '../lib/i18n';
import React, { useEffect } from 'react';
import { LogBox, StatusBar, Text as RNText, TextInput as RNTextInput } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GlobalTripReviewWatcher } from '../components/GlobalTripReviewWatcher';
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

// Suppress development yellow box overlays
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Roboto': require('../assets/fonts/Roboto-Regular.ttf'),
    'Roboto-Regular': require('../assets/fonts/Roboto-Regular.ttf'),
    'Roboto-Medium': require('../assets/fonts/Roboto-Medium.ttf'),
    'Roboto-Bold': require('../assets/fonts/Roboto-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
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
