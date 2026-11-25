import '../polyfills';
import '@kandy-cabs/shared';
import '../lib/i18n';
import React, { useEffect, useState } from 'react';
import { LogBox, StatusBar, View, Text, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GlobalTripReviewWatcher } from '../components/GlobalTripReviewWatcher';
import { QuickBookingFab } from '../components/QuickBookingFab';

// Enforce global Roboto font family so custom phone themes/fonts do not override app typography
try {
  if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
  (Text as any).defaultProps.style = [{ fontFamily: 'Roboto' }, (Text as any).defaultProps.style];

  if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
  (TextInput as any).defaultProps.style = [{ fontFamily: 'Roboto' }, (TextInput as any).defaultProps.style];

  const OrigText = Text as any;
  if (OrigText && OrigText.render && !OrigText.render.__robotoPatched) {
    const origTextRender = OrigText.render;
    OrigText.render = function (...args: any[]) {
      const element = origTextRender.apply(this, args);
      if (element && element.props) {
        return React.cloneElement(element, {
          style: [{ fontFamily: 'Roboto' }, element.props.style],
        });
      }
      return element;
    };
    OrigText.render.__robotoPatched = true;
  }
} catch (_) {}

// Keep splash screen visible until custom Roboto fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

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
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="light-content" backgroundColor="#162636" />
      <Stack
        initialRouteName="login"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#f8fafc' },
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
      <QuickBookingFab />
    </View>
  );
}
