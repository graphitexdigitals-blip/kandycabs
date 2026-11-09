import React from 'react';
import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f172a' },
      }}
    >
      <Stack.Screen name="en-route" />
      <Stack.Screen name="odometer" />
      <Stack.Screen name="start" />
      <Stack.Screen name="inspection" />
      <Stack.Screen name="active" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
