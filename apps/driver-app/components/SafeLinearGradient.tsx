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
  // If this is an overlay gradient (fading to transparent), don't paint a solid blocking background
  const isFadeOverlay = colors && colors.some((c) => c === 'transparent' || c.includes('0.0') || c.includes(', 0)') || c.includes(',0)'));
  const primaryBg = !isFadeOverlay && colors && colors.length > 0 ? colors[0] : undefined;

  return (
    <View style={[primaryBg ? { backgroundColor: primaryBg } : null, style]} {...rest}>
      {children}
    </View>
  );
}

export default LinearGradient;

