import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { FloatingCallAssistant } from '../../components/FloatingCallAssistant';

export default function TripLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      >
        <Stack.Screen name="inspection" />
        <Stack.Screen name="en-route" />
        <Stack.Screen name="odometer" />
        <Stack.Screen name="start" />
        <Stack.Screen name="active" />
        <Stack.Screen name="complete" />
      </Stack>
      <FloatingCallAssistant />
    </View>
  );
}
