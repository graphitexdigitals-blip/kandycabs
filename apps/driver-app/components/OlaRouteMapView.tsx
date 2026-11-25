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

  // Fallback default coordinates if not provided
  const dLat = driverLocation?.lat ?? 12.9141;
  const dLng = driverLocation?.lng ?? 74.8560;
  const destLat = destinationLocation?.lat ?? 12.9614;
  const destLng = destinationLocation?.lng ?? 74.8900;

  // Fetch real road routing from Ola Maps Directions
  useEffect(() => {
    let isCancelled = false;
    async function loadDirections() {
      try {
        const origin = { lat: dLat, lng: dLng };
        const destination = { lat: destLat, lng: destLng };
        const result = await getOlaDirections(origin, destination);
        if (!isCancelled && result) {
          setRouteInfo(result);
          // Send polyline and route to WebView if already loaded
          if (mapLoaded && webViewRef.current) {
            webViewRef.current.postMessage(
              JSON.stringify({
                type: 'SET_ROUTE',
                polyline: result.polyline || '',
                driver: [dLng, dLat],
                dest: [destLng, destLat],
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
          lng: driverLocation.lng,
          lat: driverLocation.lat,
        })
      );
    }
  }, [driverLocation?.lat, driverLocation?.lng, mapLoaded]);

  const handleRecenter = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: 'RECENTER',
          driver: [dLng, dLat],
          dest: [destLng, destLat],
        })
      );
    }
  };

  const htmlContent = useMemo(() => {
    const safeDestName = destinationAddress.replace(/['"\\]/g, ' ').slice(0, 35);
    const initialPolyline = routeInfo?.polyline || '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #e2e8f0; }

    /* Custom Navigation Vehicle Marker */
    .driver-marker {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #2563eb;
      border: 3px solid #ffffff;
      box-shadow: 0 3px 8px rgba(37, 99, 235, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.4s ease-out;
    }
    .driver-marker svg {
      width: 16px;
      height: 16px;
      fill: #ffffff;
      transform: rotate(45deg);
    }

    /* Custom Destination Pin Marker */
    .dest-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .dest-pin {
      width: 26px;
      height: 26px;
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
      margin-top: -4px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      border: 1px solid #e2e8f0;
    }

    /* Hide MapLibre Watermark / Attribution clutter for mini card */
    .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left {
      transform: scale(0.75);
      transform-origin: bottom left;
      opacity: 0.7;
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
        coordinates.push([lng * 1e-5, lat * 1e-5]);
      }
      return coordinates;
    }

    var apiKey = "${OLA_MAPS_API_KEY}";
    var driverCoords = [${dLng}, ${dLat}];
    var destCoords = [${destLng}, ${destLat}];
    var initialPoly = "${initialPolyline}";

    var map = new maplibregl.Map({
      container: 'map',
      style: 'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=' + apiKey,
      center: driverCoords,
      zoom: 13,
      touchZoomRotate: true,
      dragPan: true,
      attributionControl: false,
      transformRequest: function(url) {
        if (url && url.indexOf('api.olamaps.io') !== -1 && url.indexOf('api_key=') === -1) {
          return {
            url: url + (url.indexOf('?') !== -1 ? '&' : '?') + 'api_key=' + apiKey
          };
        }
        return { url: url };
      }
    });

    map.on('error', function(e) {
      console.warn('MapLibre internal error:', e);
    });

    // Create Vehicle Marker
    var driverEl = document.createElement('div');
    driverEl.className = 'driver-marker';
    driverEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>';
    var driverMarker = new maplibregl.Marker({ element: driverEl })
      .setLngLat(driverCoords)
      .addTo(map);

    // Create Destination Marker
    var destEl = document.createElement('div');
    destEl.className = 'dest-marker';
    destEl.innerHTML = '<svg class="dest-pin" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg><div class="dest-pill">${safeDestName}</div>';
    var destMarker = new maplibregl.Marker({ element: destEl })
      .setLngLat(destCoords)
      .addTo(map);

    function fitRouteBounds() {
      var bounds = new maplibregl.LngLatBounds();
      bounds.extend(driverCoords);
      bounds.extend(destCoords);
      map.fitBounds(bounds, { padding: 45, maxZoom: 15, duration: 800 });
    }

    function drawRoute(polyStr) {
      var coords = decodePolyline(polyStr);
      if (!coords || coords.length < 2) {
        coords = [driverCoords, destCoords];
      }

      var geojson = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      };

      if (map.getSource('route')) {
        map.getSource('route').setData(geojson);
      } else {
        map.addSource('route', {
          type: 'geojson',
          data: geojson
        });

        // Casing glow for route
        map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': 7,
            'line-opacity': 0.8
          }
        });

        // Main Route line
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#2563eb',
            'line-width': 4.5
          }
        });
      }
    }

    map.on('load', function() {
      if (initialPoly) {
        drawRoute(initialPoly);
      } else {
        drawRoute('');
      }
      fitRouteBounds();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
      }
    });

    // Listen to messages from React Native
    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'UPDATE_DRIVER_LOCATION') {
          driverCoords = [data.lng, data.lat];
          driverMarker.setLngLat(driverCoords);
        } else if (data.type === 'SET_ROUTE') {
          if (data.driver) driverCoords = data.driver;
          if (data.dest) destCoords = data.dest;
          driverMarker.setLngLat(driverCoords);
          destMarker.setLngLat(destCoords);
          if (data.polyline) {
            drawRoute(data.polyline);
          }
          fitRouteBounds();
        } else if (data.type === 'RECENTER') {
          fitRouteBounds();
        }
      } catch (err) {}
    });

    document.addEventListener('message', function(event) {
      window.dispatchEvent(new MessageEvent('message', { data: event.data }));
    });
  </script>
</body>
</html>`;
  }, [dLat, dLng, destLat, destLng, destinationAddress, routeInfo?.polyline]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: 'https://api.olamaps.io' }}
        style={styles.webView}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowFileAccess={true}
        androidLayerType="hardware"
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
