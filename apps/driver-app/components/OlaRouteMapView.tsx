import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
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
  const webViewRef = useRef<WebView>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMinutes: number;
    polyline?: string;
  } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Fallback default coordinates if not provided (Mangaluru)
  const dLat = driverLocation?.lat ?? 12.9141;
  const dLng = driverLocation?.lng ?? 74.8560;
  const destLat = destinationLocation?.lat ?? 12.9614;
  const destLng = destinationLocation?.lng ?? 74.8900;

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
          if (mapLoaded && webViewRef.current) {
            webViewRef.current.postMessage(
              JSON.stringify({
                type: 'SET_ROUTE',
                polyline: result.polyline || '',
                driver: [dLat, dLng],
                dest: [destLat, destLng],
              })
            );
          }
        }
      } catch (e) {
        console.warn('[OlaRouteMapView] Directions fetch error:', e);
      }
    }

    loadDirections();
    return () => {
      isCancelled = true;
    };
  }, [dLat, dLng, destLat, destLng, mapLoaded]);

  // Push driver live GPS updates into the active map
  useEffect(() => {
    if (mapLoaded && webViewRef.current && driverLocation) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: 'UPDATE_DRIVER_LOCATION',
          lat: driverLocation.lat,
          lng: driverLocation.lng,
        })
      );
    }
  }, [driverLocation?.lat, driverLocation?.lng, mapLoaded]);

  const handleRecenter = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: 'RECENTER',
        })
      );
    }
  };

  const htmlContent = useMemo(() => {
    const safeDestName = destinationAddress.replace(/['"\\]/g, ' ').slice(0, 32);
    const initialPolyline = routeInfo?.polyline || '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #f8fafc; }

    /* Custom Navigation Vehicle Marker */
    .driver-pin {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #2563eb;
      border: 3px solid #ffffff;
      box-shadow: 0 3px 8px rgba(37, 99, 235, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .driver-pin svg {
      width: 16px;
      height: 16px;
      fill: #ffffff;
      transform: rotate(45deg);
    }

    /* Custom Destination Pin Marker */
    .dest-pin-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: translate(-50%, -100%);
    }
    .dest-svg {
      width: 28px;
      height: 28px;
      fill: #ef4444;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
    .dest-pill {
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      white-space: nowrap;
      margin-top: -3px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      border: 1px solid #e2e8f0;
    }

    /* Hide Leaflet bottom attribution clutter */
    .leaflet-control-attribution {
      display: none !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    function decodePolyline(str) {
      if (!str) return [];
      var index = 0, len = str.length;
      var lat = 0, lng = 0;
      var coordinates = [];
      while (index < len) {
        var b, shift = 0, result = 0;
        do {
          b = str.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        shift = 0;
        result = 0;
        do {
          b = str.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        // Leaflet takes [lat, lng]
        coordinates.push([lat * 1e-5, lng * 1e-5]);
      }
      return coordinates;
    }

    var driverLat = ${dLat};
    var driverLng = ${dLng};
    var destLat = ${destLat};
    var destLng = ${destLng};
    var initialPoly = "${initialPolyline}";

    // Initialize 2D Canvas Leaflet Map (0 WebGL required - 100% stable in WebView)
    var map = L.map('map', {
      center: [driverLat, driverLng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });

    // High quality, fast tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Vehicle icon
    var driverIcon = L.divIcon({
      className: '',
      html: '<div class="driver-pin"><svg viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    var driverMarker = L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(map);

    // Destination icon
    var destIcon = L.divIcon({
      className: '',
      html: '<div class="dest-pin-wrapper"><svg class="dest-svg" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg><div class="dest-pill">${safeDestName}</div></div>',
      iconSize: [120, 48],
      iconAnchor: [60, 48]
    });
    var destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(map);

    // Route polyline layers (casing + primary blue road)
    var routeCasingLayer = null;
    var routeMainLayer = null;

    function renderRoute(polyStr) {
      var pts = decodePolyline(polyStr);
      if (!pts || pts.length < 2) {
        pts = [[driverLat, driverLng], [destLat, destLng]];
      }

      if (routeCasingLayer) map.removeLayer(routeCasingLayer);
      if (routeMainLayer) map.removeLayer(routeMainLayer);

      // White outline casing for high visibility
      routeCasingLayer = L.polyline(pts, {
        color: '#ffffff',
        weight: 7,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // Royal blue navigation road polyline
      routeMainLayer = L.polyline(pts, {
        color: '#2563eb',
        weight: 4.5,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // Smoothly fit bounds
      var bounds = L.latLngBounds(pts);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
    }

    renderRoute(initialPoly);

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
    }

    // Message handler from React Native
    function handleRNMessage(msg) {
      try {
        var data = JSON.parse(msg);
        if (data.type === 'UPDATE_DRIVER_LOCATION') {
          driverLat = data.lat;
          driverLng = data.lng;
          driverMarker.setLatLng([driverLat, driverLng]);
        } else if (data.type === 'SET_ROUTE') {
          if (data.driver) {
            driverLat = data.driver[0];
            driverLng = data.driver[1];
            driverMarker.setLatLng([driverLat, driverLng]);
          }
          if (data.dest) {
            destLat = data.dest[0];
            destLng = data.dest[1];
            destMarker.setLatLng([destLat, destLng]);
          }
          if (data.polyline) {
            renderRoute(data.polyline);
          }
        } else if (data.type === 'RECENTER') {
          var pts = [[driverLat, driverLng], [destLat, destLng]];
          map.fitBounds(L.latLngBounds(pts), { padding: [45, 45], maxZoom: 16, animate: true });
        }
      } catch (err) {}
    }

    window.addEventListener('message', function(e) { handleRNMessage(e.data); });
    document.addEventListener('message', function(e) { handleRNMessage(e.data); });
  </script>
</body>
</html>`;
  }, [dLat, dLng, destLat, destLng, destinationAddress, routeInfo?.polyline]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webView}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowFileAccess={true}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'MAP_READY') {
              setMapLoaded(true);
            }
          } catch (_) {}
        }}
      />

      {/* Top Floating ETA & Distance Pill */}
      {routeInfo && (
        <View style={styles.topInfoPill}>
          <Ionicons name="navigate" size={13} color="#2563eb" style={{ marginRight: 5 }} />
          <Text style={styles.topInfoText}>
            {routeInfo.distanceKm} km • {routeInfo.durationMinutes} mins
          </Text>
        </View>
      )}

      {/* Re-center Map Floating Crosshair Button */}
      <TouchableOpacity
        style={styles.recenterBtn}
        onPress={handleRecenter}
        activeOpacity={0.8}
        accessibilityLabel="Re-center map"
      >
        <Ionicons name="locate" size={18} color="#0f172a" />
      </TouchableOpacity>

      {/* Bottom Floating "Open Navigation" Action Button */}
      {onOpenNavigation && (
        <TouchableOpacity
          style={styles.floatingNavBtn}
          onPress={onOpenNavigation}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={14} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.floatingNavBtnText}>Open Navigation</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
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
  floatingNavBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
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
