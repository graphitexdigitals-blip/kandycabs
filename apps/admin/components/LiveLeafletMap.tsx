'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { BookingStatus } from '@kandy-cabs/shared';

export interface DriverMapMarker {
  id: string;
  userId: string;
  user: { fullName: string; phone: string };
  licenseNumber: string;
  onlineStatus: boolean;
  currentLat: number | null;
  currentLng: number | null;
  lastPingAt: string | null;
  vehicles: { category: string; plateNumber: string }[];
  assignedBookings: {
    id: string;
    humanReadableRef: string;
    status: BookingStatus;
    tripType: string;
    pickupAddress: string;
    dropAddress: string;
  }[];
}

interface LiveLeafletMapProps {
  drivers: DriverMapMarker[];
  selectedDriver: DriverMapMarker | null;
  onSelectDriver: (driver: DriverMapMarker | null) => void;
  breadcrumbs: { id?: string; lat: number; lng: number; recordedAt: string }[];
}

export default function LiveLeafletMap({
  drivers,
  selectedDriver,
  onSelectDriver,
  breadcrumbs,
}: LiveLeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const polylineLayerRef = useRef<any>(null);
  const [mapTheme, setMapTheme] = useState<'osm' | 'hot'>('osm');
  const tileLayerRef = useRef<any>(null);
  const hasFittedInitialBounds = useRef(false);
  const markersMapRef = useRef<Map<string, any>>(new Map());

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically import leaflet
    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Fix default marker icon issues if any standard icons used
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapInstanceRef.current) {
        // Initial center: Bengaluru (12.9716, 77.5946)
        const map = L.map(mapContainerRef.current, {
          center: [12.9716, 77.5946],
          zoom: 12,
          zoomControl: false,
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Add OpenStreetMap Tile Layer
        const initialTile = L.tileLayer(
          mapTheme === 'hot'
            ? 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'
            : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }
        ).addTo(map);

        tileLayerRef.current = initialTile;
        markersLayerRef.current = L.layerGroup().addTo(map);
        polylineLayerRef.current = L.layerGroup().addTo(map);

        mapInstanceRef.current = map;

        // Ensure Leaflet calculates container geometry accurately
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 200);

        const handleResize = () => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        };
        window.addEventListener('resize', handleResize);
      }
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer on Theme Change
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    import('leaflet').then((L) => {
      if (tileLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current);
      }
      const newTile = L.tileLayer(
        mapTheme === 'hot'
          ? 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'
          : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }
      ).addTo(mapInstanceRef.current);
      tileLayerRef.current = newTile;
    });
  }, [mapTheme]);

  const lastCenteredDriverIdRef = useRef<string | null>(null);

  // Update Driver Markers on Map (Smooth in-place updates without viewport jumping)
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    import('leaflet').then((L) => {
      const markersLayer = markersLayerRef.current;
      const validDriverLatLngs: [number, number][] = [];
      const activeIds = new Set<string>();

      drivers.forEach((driver) => {
        let lat = driver.currentLat;
        let lng = driver.currentLng;

        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        // Normalize Android emulator default coordinates (Googleplex 37.42, -122.08) or negative longitudes to Karnataka hub
        if ((Math.abs(lat - 37.42) < 1.0 && Math.abs(lng - (-122.08)) < 1.0) || lng < 0) {
          lat = 12.9716;
          lng = 77.5946;
        }
        validDriverLatLngs.push([lat, lng]);
        activeIds.add(driver.id);

        const isSelected = selectedDriver?.id === driver.id;
        const vehicle = driver.vehicles[0];
        const activeTripBooking = driver.assignedBookings.find((b) => b.status === 'TRIP_STARTED');
        const enRouteBooking = !activeTripBooking && driver.assignedBookings.find((b) => b.status === 'DRIVER_EN_ROUTE');

        const isTripInProgress = Boolean(activeTripBooking);
        const isEnRoute = Boolean(enRouteBooking);

        const statusColor = isTripInProgress
          ? '#f59e0b'
          : isEnRoute
          ? '#3b82f6'
          : '#10b981';

        const statusText = isTripInProgress
          ? 'Trip in Progress'
          : isEnRoute
          ? 'En-Route'
          : 'Idle / Available';

        // Custom HTML DivIcon for Driver
        const customIcon = L.divIcon({
          className: 'custom-driver-leaflet-pin',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
          popupAnchor: [0, -24],
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
              <!-- Pulsing Ring for Active Live Tracking -->
              <div style="
                position: absolute;
                top: 0;
                left: 0;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: ${statusColor}33;
                border: 2px solid ${statusColor};
                animation: leafletPulse 2s infinite ease-in-out;
                z-index: 1;
              "></div>
              
              <!-- Car Pin Icon -->
              <div style="
                position: relative;
                z-index: 2;
                width: 36px;
                height: 36px;
                margin-top: 4px;
                border-radius: 12px;
                background: #0f172a;
                border: 2.5px solid ${isSelected ? '#ffffff' : statusColor};
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
                transition: transform 0.2s;
              ">
                🚕
              </div>

              <!-- Driver Name Tag on Map -->
              <div style="
                position: absolute;
                top: 42px;
                white-space: nowrap;
                background: rgba(15, 23, 42, 0.92);
                color: #ffffff;
                font-size: 10px;
                font-weight: 800;
                padding: 2px 7px;
                border-radius: 6px;
                border: 1px solid ${statusColor};
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                z-index: 3;
                pointer-events: none;
              ">
                ${driver.user.fullName.split(' ')[0]}
              </div>
            </div>
          `,
        });

        // Popup Content
        const popupContent = `
          <div style="font-family: system-ui, sans-serif; min-width: 180px; padding: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="font-size: 13px; color: #0f172a;">${driver.user.fullName}</strong>
              <span style="font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor};">
                ${statusText}
              </span>
            </div>
            <div style="font-size: 11px; color: #475569; line-height: 1.4;">
              <div>📞 <strong>Phone:</strong> ${driver.user.phone}</div>
              <div>🚗 <strong>Vehicle:</strong> ${vehicle?.plateNumber || 'N/A'} (${vehicle?.category || 'Standard'})</div>
              <div>📍 <strong>GPS:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
              <div>⏱️ <strong>Last Ping:</strong> ${driver.lastPingAt ? new Date(driver.lastPingAt).toLocaleTimeString() : 'Just now'}</div>
            </div>
          </div>
        `;

        let marker = markersMapRef.current.get(driver.id);
        if (marker) {
          // Smoothly animate existing marker to new location without moving the map
          marker.setLatLng([lat, lng]);
          marker.setIcon(customIcon);
          marker.setPopupContent(popupContent);
          if (marker.isPopupOpen()) {
            marker.getPopup()?.setContent(popupContent);
          }
        } else {
          marker = L.marker([lat, lng], { icon: customIcon }).addTo(markersLayer);
          marker.on('click', () => {
            lastCenteredDriverIdRef.current = driver.id;
            onSelectDriver(driver);
            if (mapInstanceRef.current && typeof driver.currentLat === 'number' && typeof driver.currentLng === 'number') {
              mapInstanceRef.current.panTo([driver.currentLat, driver.currentLng], { animate: true, duration: 0.6 });
            }
          });
          marker.bindPopup(popupContent);
          markersMapRef.current.set(driver.id, marker);
        }

        if (isSelected && !marker.isPopupOpen()) {
          marker.openPopup();
        }
      });

      // Clean up markers for removed drivers
      markersMapRef.current.forEach((marker, id) => {
        if (!activeIds.has(id)) {
          markersLayer.removeLayer(marker);
          markersMapRef.current.delete(id);
        }
      });

      // Only fit bounds automatically once on initial page load
      if (!hasFittedInitialBounds.current && validDriverLatLngs.length > 0) {
        hasFittedInitialBounds.current = true;
        mapInstanceRef.current.fitBounds(L.latLngBounds(validDriverLatLngs), { padding: [60, 60], maxZoom: 15 });
      }

      // If a new driver selection happened explicitly, center once
      if (selectedDriver && lastCenteredDriverIdRef.current !== selectedDriver.id && typeof selectedDriver.currentLat === 'number' && typeof selectedDriver.currentLng === 'number') {
        lastCenteredDriverIdRef.current = selectedDriver.id;
        mapInstanceRef.current.panTo([selectedDriver.currentLat, selectedDriver.currentLng], {
          animate: true,
          duration: 0.6,
        });
      }
    });
  }, [drivers, selectedDriver, onSelectDriver]);

  // Render GPS Breadcrumbs Trail for Selected Driver's Active Trip (Polyline only, no forced fitBounds)
  useEffect(() => {
    if (!mapInstanceRef.current || !polylineLayerRef.current) return;

    import('leaflet').then((L) => {
      const polyLayer = polylineLayerRef.current;
      polyLayer.clearLayers();

      if (breadcrumbs && breadcrumbs.length > 1) {
        const latLngs: [number, number][] = breadcrumbs.map((pt) => [pt.lat, pt.lng]);

        // Draw glowing polyline
        L.polyline(latLngs, {
          color: '#6366f1',
          weight: 5,
          opacity: 0.85,
          dashArray: '8, 8',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(polyLayer);

        // Start point marker (Pickup / Trip origin)
        const startPt = breadcrumbs[0];
        const startIcon = L.divIcon({
          className: 'custom-breadcrumb-start-pin',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          html: `
            <div style="
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: #10b981;
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: 900;
              border: 2px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            ">
              A
            </div>
          `,
        });
        L.marker([startPt.lat, startPt.lng], { icon: startIcon })
          .bindTooltip('Trip Start GPS Location')
          .addTo(polyLayer);
      }
    });
  }, [breadcrumbs]);

  const handleFocusDriver = (driver: DriverMapMarker) => {
    if (!mapInstanceRef.current || typeof driver.currentLat !== 'number' || typeof driver.currentLng !== 'number') return;
    mapInstanceRef.current.panTo([driver.currentLat, driver.currentLng], { animate: true, duration: 0.6 });
    const marker = markersMapRef.current.get(driver.id);
    if (marker) marker.openPopup();
  };

  const handleResetView = () => {
    if (!mapInstanceRef.current) return;
    import('leaflet').then((L) => {
      const validPoints: [number, number][] = drivers
        .filter((d) => typeof d.currentLat === 'number' && typeof d.currentLng === 'number')
        .map((d) => [d.currentLat!, d.currentLng!]);

      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints);
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      } else {
        mapInstanceRef.current.setView([12.9716, 77.5946], 12);
      }
      lastCenteredDriverIdRef.current = null;
      onSelectDriver(null);
    });
  };

  return (
    <div className="relative w-full h-full min-h-[550px] flex-1 bg-slate-950 overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }} />

      {/* Map Pulse Style Definition */}
      <style jsx global>{`
        @keyframes leafletPulse {
          0% {
            transform: scale(0.9);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.4);
            opacity: 0.2;
          }
          100% {
            transform: scale(0.9);
            opacity: 0.9;
          }
        }
        .leaflet-container {
          background-color: #090d16 !important;
          font-family: inherit;
        }
        .leaflet-popup-content-wrapper {
          background: #ffffff !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4) !important;
        }
        .leaflet-popup-tip {
          background: #ffffff !important;
        }
      `}</style>
    </div>
  );
}
