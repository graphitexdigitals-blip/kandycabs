import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
  Image,
  Animated,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OLA_MAPS_API_KEY, getOlaDirections } from '../lib/olaMaps';

interface OlaRouteMapViewProps {
  driverLocation?: { lat: number; lng: number } | null;
  destinationLocation?: { lat: number; lng: number } | null;
  destinationAddress?: string;
  isPickup?: boolean;
  height?: number;
  onOpenNavigation?: () => void;
}

export function OlaRouteMapView({
  driverLocation,
  destinationLocation,
  destinationAddress = 'Mangaluru Airport (IXE)',
  isPickup = true,
  height = 240,
  onOpenNavigation,
}: OlaRouteMapViewProps) {
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMinutes: number;
    polyline?: string;
  } | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(1);

  // Fallback default coordinates if not provided (Mangaluru)
  const dLat = driverLocation?.lat ?? 12.9141;
  const dLng = driverLocation?.lng ?? 74.8560;
  const destLat = destinationLocation?.lat ?? 12.9614;
  const destLng = destinationLocation?.lng ?? 74.8900;

  // Animated values for smooth pinch-to-zoom and pan
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Gesture state trackers
  const baseScale = useRef(1);
  const pinchStartDist = useRef(0);
  const lastPan = useRef({ x: 0, y: 0 });
  const lastTap = useRef(0);

  // Calculate dynamic zoom based on distance
  const zoomLevel = useMemo(() => {
    const dist = routeInfo?.distanceKm ?? 15;
    if (dist < 3) return 14;
    if (dist < 8) return 13;
    if (dist < 22) return 12;
    if (dist < 50) return 11;
    return 10;
  }, [routeInfo?.distanceKm]);

  // Center coordinate between driver and destination
  const centerLat = ((dLat + destLat) / 2).toFixed(4);
  const centerLng = ((dLng + destLng) / 2).toFixed(4);

  // High-res Ola Maps 2D Static Map URL
  const mapImageUrl = useMemo(() => {
    const markerDriver = encodeURIComponent(`${dLng.toFixed(4)},${dLat.toFixed(4)}|blue|scale:0.9`);
    const markerDest = encodeURIComponent(`${destLng.toFixed(4)},${destLat.toFixed(4)}|red|scale:0.9`);
    return `https://api.olamaps.io/tiles/v1/styles/default-light-standard/static/${centerLng},${centerLat},${zoomLevel}/700x380.png?markers=${markerDriver}&markers=${markerDest}&api_key=${OLA_MAPS_API_KEY}`;
  }, [centerLng, centerLat, zoomLevel, dLat, dLng, destLat, destLng]);

  // Fetch real road routing from Ola Maps Directions API
  useEffect(() => {
    let isCancelled = false;
    async function loadDirections() {
      try {
        const origin = { lat: dLat, lng: dLng };
        const destination = { lat: destLat, lng: destLng };
        const result = await getOlaDirections(origin, destination);
        if (!isCancelled && result) {
          setRouteInfo(result);
        }
      } catch (e) {
        console.warn('[OlaRouteMapView] Directions error:', e);
      }
    }

    loadDirections();
    return () => {
      isCancelled = true;
    };
  }, [dLat, dLng, destLat, destLng]);

  // Smooth reset to 1.0x overview
  const resetZoomAndPan = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      baseScale.current = 1;
      lastPan.current = { x: 0, y: 0 };
      setCurrentZoom(1);
    });
  };

  // Two-finger pinch and drag gesture responder
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const touches = evt.nativeEvent.touches;
          if (touches.length === 2) {
            pinchStartDist.current = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY
            );
          } else if (touches.length === 1) {
            // Double-tap detection
            const now = Date.now();
            if (now - lastTap.current < 300) {
              if (baseScale.current > 1.2) {
                resetZoomAndPan();
              } else {
                Animated.spring(scale, {
                  toValue: 2.2,
                  friction: 6,
                  tension: 40,
                  useNativeDriver: true,
                }).start(() => {
                  baseScale.current = 2.2;
                  setCurrentZoom(2.2);
                });
              }
            }
            lastTap.current = now;
          }
        },
        onPanResponderMove: (evt, gestureState) => {
          const touches = evt.nativeEvent.touches;
          if (touches.length === 2) {
            // Two-finger Pinch to Zoom
            const dist = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY
            );
            if (pinchStartDist.current > 0) {
              const factor = dist / pinchStartDist.current;
              let nextScale = baseScale.current * factor;
              if (nextScale < 0.95) nextScale = 0.95;
              if (nextScale > 3.8) nextScale = 3.8;
              scale.setValue(nextScale);
              setCurrentZoom(Math.round(nextScale * 10) / 10);
            }
          } else if (touches.length === 1 && baseScale.current > 1.05) {
            // Pan around map when zoomed in
            const maxPanX = (baseScale.current - 1) * 160;
            const maxPanY = (baseScale.current - 1) * 90;
            const nextX = Math.max(-maxPanX, Math.min(maxPanX, lastPan.current.x + gestureState.dx));
            const nextY = Math.max(-maxPanY, Math.min(maxPanY, lastPan.current.y + gestureState.dy));
            pan.setValue({ x: nextX, y: nextY });
          }
        },
        onPanResponderRelease: (evt, gestureState) => {
          const touches = evt.nativeEvent.touches;
          if (touches.length === 0) {
            // Save base scale
            // @ts-ignore
            const finalScale = scale._value ?? baseScale.current;
            if (finalScale < 1.05) {
              resetZoomAndPan();
            } else {
              baseScale.current = Math.min(3.5, Math.max(1, finalScale));
              // @ts-ignore
              const finalX = pan.x._value ?? 0;
              // @ts-ignore
              const finalY = pan.y._value ?? 0;
              lastPan.current = { x: finalX, y: finalY };
            }
          }
        },
      }),
    []
  );

  const handleOpenNav = () => {
    if (onOpenNavigation) {
      onOpenNavigation();
      return;
    }
    const navUrl = Platform.select({
      ios: `maps://app?saddr=${dLat},${dLng}&daddr=${destLat},${destLng}`,
      android: `google.navigation:q=${destLat},${destLng}&mode=d`,
      default: `https://www.google.com/maps/dir/?api=1&origin=${dLat},${dLng}&destination=${destLat},${destLng}&travelmode=driving`,
    });
    Linking.openURL(navUrl).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&origin=${dLat},${dLng}&destination=${destLat},${destLng}&travelmode=driving`
      );
    });
  };

  const safeDestName = destinationAddress.replace(/['"\\]/g, ' ').slice(0, 30);

  return (
    <View style={[styles.container, { height }]}>
      {/* Interactive Map Surface with Native Pan & Pinch Gesture */}
      <View style={styles.gestureSurface} {...panResponder.panHandlers}>
        <Animated.Image
          source={{ uri: mapImageUrl }}
          style={[
            styles.mapImage,
            {
              transform: [
                { scale },
                { translateX: pan.x },
                { translateY: pan.y },
              ],
            },
          ]}
          resizeMode="cover"
          onLoadStart={() => setImageLoading(true)}
          onLoadEnd={() => setImageLoading(false)}
        />
      </View>

      {/* Loading Overlay */}
      {imageLoading && (
        <View style={styles.loadingBackdrop}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Loading Ola Maps...</Text>
        </View>
      )}

      {/* Top Floating ETA & Distance Pill from Ola Directions */}
      <View style={styles.topInfoPill}>
        <Ionicons name="navigate" size={13} color="#2563eb" style={{ marginRight: 5 }} />
        <Text style={styles.topInfoText}>
          {routeInfo
            ? `${routeInfo.distanceKm} km • ${routeInfo.durationMinutes} mins`
            : 'Calculating route...'}
        </Text>
      </View>

      {/* Top Right Floating Re-center & Zoom Reset Button */}
      <TouchableOpacity
        style={styles.recenterBtn}
        onPress={resetZoomAndPan}
        activeOpacity={0.8}
        accessibilityLabel="Reset map zoom"
      >
        <Ionicons
          name={currentZoom > 1.1 ? 'scan-outline' : 'locate'}
          size={18}
          color="#0f172a"
        />
      </TouchableOpacity>

      {/* Floating Destination Landmark Pill */}
      <View style={styles.destinationTagPill}>
        <Ionicons
          name={isPickup ? 'pin' : 'airplane'}
          size={12}
          color="#ef4444"
          style={{ marginRight: 4 }}
        />
        <Text style={styles.destinationTagText} numberOfLines={1}>
          {safeDestName}
        </Text>
      </View>

      {/* Bottom Floating "Open Navigation" Action Button */}
      <TouchableOpacity
        style={styles.floatingNavBtn}
        onPress={handleOpenNav}
        activeOpacity={0.85}
      >
        <Ionicons name="navigate" size={14} color="#ffffff" style={{ marginRight: 6 }} />
        <Text style={styles.floatingNavBtnText}>Open Navigation</Text>
      </TouchableOpacity>

      {/* Bottom Left Ola Maps Watermark Branding */}
      <View style={styles.brandBadge}>
        <Text style={styles.brandBadgeText}>Ola Maps</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  gestureSurface: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  mapImage: {
    width: '112%',
    height: '112%',
  },
  loadingBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(241, 245, 249, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  topInfoPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topInfoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  recenterBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  destinationTagPill: {
    position: 'absolute',
    bottom: 50,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    maxWidth: 190,
  },
  destinationTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  floatingNavBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7.5,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  floatingNavBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  brandBadge: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  brandBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
