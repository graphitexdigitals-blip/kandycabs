import * as Location from 'expo-location';
import { reverseGeocodeOla } from './olaMaps';

/**
 * Reverse geocodes latitude and longitude into a clean, human-readable address.
 * Primary: Ola Maps live service. Fallback: Native expo-location.
 */
export async function reverseGeocodeAddress(
  lat: number | null | undefined,
  lng: number | null | undefined,
  fallbackAddress?: string
): Promise<string> {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return fallbackAddress || 'Location unavailable';
  }

  // 1. Primary: Ola Maps Reverse Geocode
  try {
    const olaPlace = await reverseGeocodeOla(lat, lng);
    if (olaPlace && olaPlace.label) {
      return olaPlace.label;
    }
  } catch (err) {
    console.warn('[DriverApp] Ola reverse geocode error:', err);
  }

  // 2. Secondary: Native Expo reverse geocoder
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });

    if (results && results.length > 0) {
      const r = results[0];
      const components: string[] = [];

      if (r.name && r.name !== r.street) {
        components.push(r.name);
      }
      if (r.street) {
        components.push(r.street);
      }
      if (r.district || r.subregion) {
        const area = r.district || r.subregion;
        if (area && !components.includes(area)) {
          components.push(area);
        }
      }
      if (r.city && !components.includes(r.city)) {
        components.push(r.city);
      }
      if (r.region && !components.includes(r.region)) {
        components.push(r.region);
      }
      if (r.postalCode) {
        components.push(r.postalCode);
      }

      if (components.length > 0) {
        return components.join(', ');
      }
    }
  } catch (err) {
    console.warn('reverseGeocodeAddress error:', err);
  }

  // Graceful fallback
  if (fallbackAddress) {
    return fallbackAddress;
  }
  return `GPS [${lat.toFixed(5)}, ${lng.toFixed(5)}]`;
}
