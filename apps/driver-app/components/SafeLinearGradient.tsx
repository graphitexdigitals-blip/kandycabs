import React, { useMemo } from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

let ExpoLinearGradient: any = null;
try {
  // Use native Expo LinearGradient when available (Expo Go / prebuild)
  ExpoLinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (_) {
  ExpoLinearGradient = null;
}

export interface LinearGradientProps extends ViewProps {
  colors: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
  children?: React.ReactNode;
}

function parseColor(str: string): [number, number, number, number] {
  if (!str) return [255, 255, 255, 1];
  if (str === 'transparent') return [255, 255, 255, 0];
  const rgba = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgba) {
    return [
      parseInt(rgba[1], 10),
      parseInt(rgba[2], 10),
      parseInt(rgba[3], 10),
      rgba[4] !== undefined ? parseFloat(rgba[4]) : 1,
    ];
  }
  // Hex color #RRGGBB or #RGB
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 1];
  }
  return [255, 255, 255, 1];
}

/**
 * Drop-in replacement for Expo's LinearGradient.
 * Uses native ExpoLinearGradient when available for GPU-accelerated smooth gradients,
 * with pure JavaScript fallback if native module is absent.
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
  if (ExpoLinearGradient) {
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
  }

  const isHorizontal = Math.abs((end.x ?? 1) - (start.x ?? 0)) >= Math.abs((end.y ?? 0) - (start.y ?? 0));
  const fallbackBg = colors && colors.length > 0 ? colors[Math.floor(colors.length / 2)] : 'transparent';

  const slices = useMemo(() => {
    if (!colors || colors.length <= 1) return [];

    const numSlices = 48;
    const defaultLocs = colors.map((_, i) => i / (colors.length - 1));
    const locs = locations && locations.length === colors.length ? locations : defaultLocs;

    const result: string[] = [];
    for (let i = 0; i < numSlices; i++) {
      const t = i / (numSlices - 1);
      let idx = 0;
      while (idx < locs.length - 1 && locs[idx + 1] < t) {
        idx++;
      }
      const c1 = parseColor(colors[idx]);
      const c2 = parseColor(colors[Math.min(idx + 1, colors.length - 1)]);
      const l1 = locs[idx];
      const l2 = locs[Math.min(idx + 1, colors.length - 1)];
      const factor = l2 === l1 ? 0 : Math.min(1, Math.max(0, (t - l1) / (l2 - l1)));

      const r = Math.round(c1[0] + (c2[0] - c1[0]) * factor);
      const g = Math.round(c1[1] + (c2[1] - c1[1]) * factor);
      const b = Math.round(c1[2] + (c2[2] - c1[2]) * factor);
      const a = +(c1[3] + (c2[3] - c1[3]) * factor).toFixed(3);

      result.push(`rgba(${r}, ${g}, ${b}, ${a})`);
    }
    return result;
  }, [colors, locations]);

  if (!colors || colors.length === 0) {
    return <View style={style} {...rest}>{children}</View>;
  }

  if (colors.length === 1) {
    return (
      <View style={[{ backgroundColor: colors[0] }, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <View style={[{ overflow: 'hidden', backgroundColor: fallbackBg }, style]} {...rest}>
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { flexDirection: isHorizontal ? 'row' : 'column' },
        ]}
        pointerEvents="none"
      >
        {slices.map((sliceColor, idx) => (
          <View
            key={idx}
            style={{
              flex: 1,
              backgroundColor: sliceColor,
            }}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

export default LinearGradient;
