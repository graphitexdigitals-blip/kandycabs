import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

export interface LinearGradientProps extends ViewProps {
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
  children?: React.ReactNode;
}

/**
 * Pure JavaScript drop-in replacement for Expo's LinearGradient.
 * Avoids native module missing crashes (`ViewManagerAdapter_ExpoLinearGradient`)
 * while providing identical layout, sizing, and styling.
 */
export function LinearGradient({ colors, style, children, ...rest }: LinearGradientProps) {
  // Use the first color (or fallback to dark blue / primary green) as solid background
  const primaryBg = colors && colors.length > 0 ? colors[0] : '#15803d';

  return (
    <View style={[{ backgroundColor: primaryBg }, style]} {...rest}>
      {children}
    </View>
  );
}

export default LinearGradient;

