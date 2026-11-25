import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'kandy_customer_device_id_v1';
let cachedDeviceId: string | null = null;

function generateUniqueDeviceId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart1 = Math.random().toString(36).substring(2, 10);
  const randomPart2 = Math.random().toString(36).substring(2, 10);
  return `dev_${timestamp}_${randomPart1}_${randomPart2}`;
}

/**
 * Returns a persistent device ID unique to this phone installation.
 * Survives app restarts and sessions, ensuring single-device login integrity.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        let storedId = localStorage.getItem(DEVICE_ID_KEY);
        if (!storedId) {
          storedId = generateUniqueDeviceId();
          localStorage.setItem(DEVICE_ID_KEY, storedId);
        }
        cachedDeviceId = storedId;
        return storedId;
      }
    } else {
      let storedId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (!storedId) {
        storedId = generateUniqueDeviceId();
        await SecureStore.setItemAsync(DEVICE_ID_KEY, storedId);
      }
      cachedDeviceId = storedId;
      return storedId;
    }
  } catch (err) {
    console.warn('[deviceId] Error accessing SecureStore:', err);
  }

  if (!cachedDeviceId) {
    cachedDeviceId = generateUniqueDeviceId();
  }
  return cachedDeviceId;
}
