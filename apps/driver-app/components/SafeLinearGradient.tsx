import React from 'react';
import { View, ViewProps, UIManager } from 'react-native';

let ExpoLinearGradient: any = null;
try {
  ExpoLinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  ExpoLinearGradient = null;
}

let isNativeAvailableCached: boolean | null = null;
function checkNativeAvailable(): boolean {
  if (isNativeAvailableCached === null) {
    try {
      isNativeAvailableCached = Boolean(
        ExpoLinearGradient &&
        (UIManager.getViewManagerConfig?.('ExpoLinearGradient') ||
         (UIManager as any)['ExpoLinearGradient'])
      );
    } catch {
      isNativeAvailableCached = false;
    }
  }
  return isNativeAvailableCached;
}

export interface LinearGradientProps extends ViewProps {
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
  children?: React.ReactNode;
}

/**
 * Drop-in safe replacement for Expo's LinearGradient.
 * Uses native ExpoLinearGradient when linked in UIManager for true GPU-accelerated smooth gradients.
 * If native module is absent, smoothly falls back to a solid background color,
 * completely avoiding subpixel slice lines or rendering gaps.
 */
export function LinearGradient({
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  locations,
  style,
  children,
  ...rest
}: LinearGradientProps) {
  if (ExpoLinearGradient && checkNativeAvailable()) {
    try {
      return (
        <ExpoLinearGradient
          colors={colors}
          start={start}
          end={end}
          locations={locations}
          style={style}
          {...rest}
        >
          {children}
        </ExpoLinearGradient>
      );
    } catch (_) {
      isNativeAvailableCached = false;
    }
  }

  // Pure smooth solid fallback (avoids subpixel slice lines/artifacts on Android screens)
  const fallbackBg = colors && colors.length > 0 ? colors[0] : 'transparent';

  return (
    <View style={[{ backgroundColor: fallbackBg }, style]} {...rest}>
      {children}
    </View>
  );
}

export default LinearGradient;
