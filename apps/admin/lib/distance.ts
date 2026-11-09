/**
 * Calculates straight-line distance using the Haversine formula
 */
function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calibrates realistic driving duration based on Indian road terrain & journey distance:
 * - City / Local (<= 10 km): ~22 km/h (traffic, signals, speed breakers) -> 5.4 km = 15 mins
 * - Urban / Suburbs (10 - 30 km): ~26 km/h -> 20 km = 46 mins
 * - Regional / Coastal Highway (30 - 100 km): ~42 km/h -> 60 km = 1 hr 26 mins
 * - Intercity / Ghats Highway (> 100 km): ~50 km/h (Western Ghats hairpin curves, toll plazas) -> 343 km = 6 hr 52 mins
 */
export function calculateRealisticDurationMins(distanceKm: number, rawOsrmDurationMins?: number): number {
  if (distanceKm <= 1) return 5;
  if (distanceKm <= 10) {
    return Math.max(Math.round((distanceKm / 22) * 60), 5);
  }
  if (distanceKm <= 30) {
    return Math.round((distanceKm / 26) * 60);
  }
  if (distanceKm <= 100) {
    return Math.round((distanceKm / 42) * 60);
  }
  return Math.round((distanceKm / 50) * 60);
}

export interface RouteDistanceResult {
  distanceKm: number;
  durationMins: number;
}

// In-Memory High-Performance LRU Route Cache (2-Hour TTL)
interface RouteCacheEntry {
  result: RouteDistanceResult;
  expiresAt: number;
}

const MAX_ROUTE_CACHE_SIZE = 5000;
const ROUTE_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 Hours
const routeMemoryCache = new Map<string, RouteCacheEntry>();

// In-flight Promise Coalescing to prevent concurrent duplicate OSRM HTTP requests
const inFlightRoutes = new Map<string, Promise<RouteDistanceResult>>();

function getPointCacheKey(lat1: number, lng1: number, lat2: number, lng2: number): string {
  return `osrm_route:${lat1.toFixed(4)},${lng1.toFixed(4)}->${lat2.toFixed(4)},${lng2.toFixed(4)}`;
}

function getFromCache(key: string): RouteDistanceResult | null {
  const entry = routeMemoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    routeMemoryCache.delete(key);
    return null;
  }
  // LRU touch
  routeMemoryCache.delete(key);
  routeMemoryCache.set(key, entry);
  return entry.result;
}

function saveToCache(key: string, result: RouteDistanceResult): void {
  if (routeMemoryCache.size >= MAX_ROUTE_CACHE_SIZE) {
    const oldestKey = routeMemoryCache.keys().next().value;
    if (oldestKey) routeMemoryCache.delete(oldestKey);
  }
  routeMemoryCache.set(key, {
    result,
    expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
  });
}

/**
 * Server-authoritative distance calculation.
 * Never trusts client-submitted distances.
 * Uses OpenStreetMap OSRM road routing engine with high-availability mirror fallback, in-memory LRU cache,
 * and in-flight request coalescing to eliminate duplicate external calls.
 */
export async function calculateRouteDistance(
  pickupLat: number,
  pickupLng: number,
  dropLat: number,
  dropLng: number
): Promise<RouteDistanceResult> {
  // If identical coords
  if (
    Math.abs(pickupLat - dropLat) < 0.0001 &&
    Math.abs(pickupLng - dropLng) < 0.0001
  ) {
    return { distanceKm: 1, durationMins: 5 };
  }

  // 1. Fast Cache Lookup (< 0.1ms)
  const cacheKey = getPointCacheKey(pickupLat, pickupLng, dropLat, dropLng);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  // 2. In-Flight Request Coalescing: If an identical route is being fetched right now, await its shared Promise
  if (inFlightRoutes.has(cacheKey)) {
    return inFlightRoutes.get(cacheKey)!;
  }

  const osrmEndpoints = [
    `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropLng},${dropLat}?overview=false`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${pickupLng},${pickupLat};${dropLng},${dropLat}?overview=false`,
  ];

  // 3. Parallel Fast Race across mirrors with aggressive 1500ms timeout
  const fetchMirror = async (url: string): Promise<RouteDistanceResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) {
        const data = (await response.json()) as any;
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
          const rawDurationMins = Math.round(route.duration / 60);
          const calibratedDurationMins = calculateRealisticDurationMins(distanceKm, rawDurationMins);
          return {
            distanceKm: Math.max(distanceKm, 0.5),
            durationMins: calibratedDurationMins,
          };
        }
      }
      throw new Error('OSRM Invalid Response');
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  };

  const routePromise = (async (): Promise<RouteDistanceResult> => {
    try {
      const result = await Promise.any(osrmEndpoints.map(fetchMirror));
      saveToCache(cacheKey, result);
      return result;
    } catch (_) {
      // Fallback: Calibrated Haversine with 1.30x road curvature factor
      const straightLineKm = haversineDistanceKm(pickupLat, pickupLng, dropLat, dropLng);
      const roadFactor = 1.30;
      const estimatedKm = Math.round(straightLineKm * roadFactor * 10) / 10;
      const estimatedDuration = calculateRealisticDurationMins(estimatedKm);

      const fallbackResult = {
        distanceKm: Math.max(estimatedKm, 1),
        durationMins: estimatedDuration,
      };
      saveToCache(cacheKey, fallbackResult);
      return fallbackResult;
    }
  })();

  inFlightRoutes.set(cacheKey, routePromise);

  try {
    return await routePromise;
  } finally {
    inFlightRoutes.delete(cacheKey);
  }
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

/**
 * Calculates total route distance across multiple waypoints (pickup -> stop 1 -> stop 2 ... -> drop -> return)
 */
export async function calculateMultiPointRouteDistance(
  points: RoutePoint[]
): Promise<RouteDistanceResult> {
  if (!points || points.length < 2) {
    return { distanceKm: 10, durationMins: 30 };
  }

  // Check multi-point cache
  const multiCacheKey = `osrm_multi:${points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('->')}`;
  const cachedMulti = getFromCache(multiCacheKey);
  if (cachedMulti) {
    return cachedMulti;
  }

  if (inFlightRoutes.has(multiCacheKey)) {
    return inFlightRoutes.get(multiCacheKey)!;
  }

  const multiPromise = (async (): Promise<RouteDistanceResult> => {
    // 1. Try OSRM with all waypoints concatenated
    try {
      const coordsString = points.map((p) => `${p.lng},${p.lat}`).join(';');
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=false`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        const data = (await response.json()) as any;
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
          const durationMins = calculateRealisticDurationMins(distanceKm, Math.round(route.duration / 60));
          const multiResult = {
            distanceKm: Math.max(distanceKm, 5),
            durationMins,
          };
          saveToCache(multiCacheKey, multiResult);
          return multiResult;
        }
      }
    } catch (_) {
      // Fallback to sequential leg calculation
    }

    // 2. Sum of each leg using calculateRouteDistance
    let totalKm = 0;
    let totalMins = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const leg = await calculateRouteDistance(
        points[i].lat,
        points[i].lng,
        points[i + 1].lat,
        points[i + 1].lng
      );
      totalKm += leg.distanceKm;
      totalMins += leg.durationMins;
    }

    const combinedResult = {
      distanceKm: Math.round(totalKm * 10) / 10,
      durationMins: totalMins,
    };
    saveToCache(multiCacheKey, combinedResult);
    return combinedResult;
  })();

  inFlightRoutes.set(multiCacheKey, multiPromise);

  try {
    return await multiPromise;
  } finally {
    inFlightRoutes.delete(multiCacheKey);
  }
}
