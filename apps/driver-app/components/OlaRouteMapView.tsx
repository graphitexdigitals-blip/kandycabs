import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getOlaDirections } from '../lib/olaMaps';

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
  height = 230,
  onOpenNavigation,
}: OlaRouteMapViewProps) {
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMinutes: number;
    polyline?: string;
  } | null>(null);

  // Fallback default coordinates if not provided (Mangaluru)
  const dLat = driverLocation?.lat ?? 12.9141;
  const dLng = driverLocation?.lng ?? 74.8560;
  const destLat = destinationLocation?.lat ?? 12.9614;
  const destLng = destinationLocation?.lng ?? 74.8900;

  // Fetch real road routing, distance, and duration from Ola Maps Directions API
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
    <TouchableOpacity
      style={[styles.container, { height }]}
      onPress={handleOpenNav}
      activeOpacity={0.96}
      accessibilityLabel="Tap to open turn-by-turn navigation"
    >
      {/* Background Clean Stylized Map Canvas */}
      <View style={styles.mapCanvas}>
        {/* Soft Water / Coastline boundary */}
        <View style={styles.mapWaterArea} />

        {/* Clean Arterial Road Grid */}
        <View style={styles.roadH1} />
        <View style={styles.roadH2} />
        <View style={styles.roadV1} />
        <View style={styles.roadDiag1} />
        <View style={styles.roadDiag2} />

        {/* Dynamic Route Polyline Path */}
        <View style={styles.routeCasing1} />
        <View style={styles.routeCurve1} />
        <View style={styles.routeCasing2} />
        <View style={styles.routeCurve2} />

        {/* Driver Navigation Vehicle Marker with Subtle Pulse */}
        <View style={styles.driverMarkerContainer}>
          <View style={styles.driverPulse} />
          <View style={styles.driverMarkerInner}>
            <Ionicons
              name="navigate"
              size={14}
              color="#ffffff"
              style={{ transform: [{ rotate: '45deg' }] }}
            />
          </View>
        </View>

        {/* Destination Pin Marker */}
        <View style={styles.destinationPinContainer}>
          <Ionicons name="location-sharp" size={28} color="#ef4444" />
        </View>

        {/* Destination Name Tag Pill */}
        <View style={styles.destinationTagPill}>
          <Ionicons
            name={isPickup ? 'pin' : 'airplane'}
            size={12}
            color="#2563eb"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.destinationTagText} numberOfLines={1}>
            {safeDestName}
          </Text>
        </View>

        {/* Top Floating ETA & Distance Pill from Directions */}
        <View style={styles.topInfoPill}>
          <Ionicons name="navigate" size={13} color="#2563eb" style={{ marginRight: 5 }} />
          <Text style={styles.topInfoText}>
            {routeInfo
              ? `${routeInfo.distanceKm} km • ${routeInfo.durationMinutes} mins`
              : 'Calculating route...'}
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
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#eef2f6',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  mapCanvas: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  mapWaterArea: {
    position: 'absolute',
    top: -20,
    left: -40,
    width: 170,
    height: 320,
    backgroundColor: '#dbeafe',
    borderTopRightRadius: 180,
    borderBottomRightRadius: 120,
    opacity: 0.85,
  },
  roadH1: {
    position: 'absolute',
    top: 55,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  roadH2: {
    position: 'absolute',
    top: 155,
    left: 0,
    right: 0,
    height: 7,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  roadV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '52%',
    width: 8,
    backgroundColor: '#ffffff',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e2e8f0',
  },
  roadDiag1: {
    position: 'absolute',
    top: -30,
    left: '25%',
    width: 14,
    height: 320,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '-35deg' }],
    borderColor: '#e2e8f0',
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  roadDiag2: {
    position: 'absolute',
    top: 20,
    right: '15%',
    width: 10,
    height: 280,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '42deg' }],
    borderColor: '#e2e8f0',
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  routeCasing1: {
    position: 'absolute',
    bottom: 84,
    left: '38%',
    width: 76,
    height: 8,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    transform: [{ rotate: '-46deg' }],
  },
  routeCurve1: {
    position: 'absolute',
    bottom: 85,
    left: '39%',
    width: 74,
    height: 5,
    backgroundColor: '#2563eb',
    borderRadius: 3,
    transform: [{ rotate: '-46deg' }],
  },
  routeCasing2: {
    position: 'absolute',
    top: 67,
    left: '54%',
    width: 44,
    height: 8,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    transform: [{ rotate: '-18deg' }],
  },
  routeCurve2: {
    position: 'absolute',
    top: 68,
    left: '55%',
    width: 42,
    height: 5,
    backgroundColor: '#2563eb',
    borderRadius: 3,
    transform: [{ rotate: '-18deg' }],
  },
  driverMarkerContainer: {
    position: 'absolute',
    bottom: 58,
    left: '34%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverPulse: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(37, 99, 235, 0.22)',
  },
  driverMarkerInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  destinationPinContainer: {
    position: 'absolute',
    top: 50,
    right: '34%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  destinationTagPill: {
    position: 'absolute',
    top: 54,
    right: '12%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    maxWidth: 160,
  },
  destinationTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
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
    shadowOpacity: 0.12,
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
});
