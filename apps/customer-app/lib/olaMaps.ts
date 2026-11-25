import { PlaceLocation } from './locations';

export const OLA_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY || 'VthnkL2YubtYXT4Q81L2m5dEmksdA9FIUy52rfi4';

export interface OlaAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types?: string[];
}

/**
 * Searches places across India via Ola Maps Places Autocomplete API
 */
export async function searchOlaPlaces(
  input: string,
  biasLocation?: { lat: number; lng: number }
): Promise<PlaceLocation[]> {
  const query = input.trim();
  if (!query || query.length < 2) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    let url = `https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(
      query
    )}&api_key=${OLA_MAPS_API_KEY}`;

    if (biasLocation && biasLocation.lat && biasLocation.lng) {
      url += `&location=${biasLocation.lat},${biasLocation.lng}&radius=50000`;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Request-Id': `kandy-search-${Date.now()}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn('[OlaMaps] Autocomplete failed with status:', res.status);
      return [];
    }

    const data = await res.json();
    if (!data.predictions || !Array.isArray(data.predictions)) {
      return [];
    }

    const results: PlaceLocation[] = data.predictions
      .filter((p: OlaAutocompletePrediction) => p && p.description)
      .map((p: OlaAutocompletePrediction) => {
        const main = p.structured_formatting?.main_text || p.description.split(',')[0].trim();
        const secondary = p.structured_formatting?.secondary_text || p.description;
        return {
          label: main,
          sublabel: secondary,
          lat: p.geometry?.location?.lat || 0,
          lng: p.geometry?.location?.lng || 0,
          source: 'OSM_LIVE' as const, // Compatible with existing category type
          category: (p.types?.includes('airport') ? 'AIRPORTS' : 'MANGALURU') as any,
          keywords: [main.toLowerCase(), ...(secondary ? [secondary.toLowerCase()] : [])],
        };
      });

    return results;
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('[OlaMaps] Autocomplete error:', err);
    }
    return [];
  }
}

/**
 * Forward geocodes an address string to coordinates (lat, lng) via Ola Maps
 */
export async function geocodeOlaAddress(
  address: string
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  const query = address.trim();
  if (!query) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const url = `https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(
      query
    )}&api_key=${OLA_MAPS_API_KEY}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Request-Id': `kandy-geo-${Date.now()}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.geocodingResults || !data.geocodingResults.length) return null;

    const top = data.geocodingResults[0];
    const loc = top.geometry?.location;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;

    return {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: top.formatted_address || query,
    };
  } catch (err) {
    console.warn('[OlaMaps] Geocode error:', err);
    return null;
  }
}

/**
 * Reverse geocodes coordinates (lat, lng) to an exact Indian address via Ola Maps
 */
export async function reverseGeocodeOla(
  lat: number,
  lng: number
): Promise<PlaceLocation | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const url = `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${OLA_MAPS_API_KEY}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Request-Id': `kandy-rev-${Date.now()}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.results || !data.results.length) return null;

    const top = data.results[0];
    const comps = top.address_components || [];
    const getComp = (type: string) =>
      comps.find((c: any) => c.types?.includes(type))?.long_name || '';
    const sublocality = getComp('sublocality') || getComp('neighborhood');
    const locality = getComp('locality') || getComp('administrative_area_level_3') || '';

    const rawName = top.name || top.formatted_address?.split(',')[0]?.trim() || '';
    const parts: string[] = [];
    if (rawName && !rawName.toLowerCase().includes('unnamed')) parts.push(rawName);
    if (sublocality && !parts.some((p) => p.toLowerCase().includes(sublocality.toLowerCase()))) {
      parts.push(sublocality);
    }
    if (locality && !parts.some((p) => p.toLowerCase().includes(locality.toLowerCase()))) {
      parts.push(locality);
    }

    const label = parts.length > 0 ? parts.join(', ') : (top.formatted_address || 'Current Location');
    const fullAddress = top.formatted_address || label;

    return {
      label,
      sublabel: fullAddress,
      lat: top.geometry?.location?.lat || lat,
      lng: top.geometry?.location?.lng || lng,
      source: 'OSM_LIVE' as const,
      category: 'MANGALURU',
    };
  } catch (err) {
    console.warn('[OlaMaps] Reverse geocode error:', err);
    return null;
  }
}

/**
 * Calculates road routing, distance (km), duration (minutes), and polyline via Ola Maps Directions
 */
export async function getOlaDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ distanceKm: number; durationMinutes: number; polyline?: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const url = `https://api.olamaps.io/routing/v1/directions?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&api_key=${OLA_MAPS_API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'X-Request-Id': `kandy-route-${Date.now()}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 'SUCCESS' || !data.routes || !data.routes.length) {
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs?.[0];
    const distanceMeters = leg?.distance ?? route.distance ?? 0;
    const durationSeconds = leg?.duration ?? route.duration ?? 0;

    return {
      distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
      durationMinutes: Math.round(durationSeconds / 60),
      polyline: route.overview_polyline,
    };
  } catch (err) {
    console.warn('[OlaMaps] Directions error:', err);
    return null;
  }
}
