import 'fast-text-encoding';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { KandyApiClient, TokenStorage } from '@kandy-cabs/shared';
import Constants from 'expo-constants';

const SECURE_TOKEN_KEY = 'kandy_driver_token_v1';

// Persistent Hardware-Backed Token Storage for Driver Mobile App
class MobileTokenStorage implements TokenStorage {
  private memoryToken: string | null = null;

  async getToken(): Promise<string | null> {
    if (this.memoryToken) {
      return this.memoryToken;
    }
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          this.memoryToken = localStorage.getItem(SECURE_TOKEN_KEY);
        }
      } else {
        const stored = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
        this.memoryToken = stored;
      }
      return this.memoryToken;
    } catch (err) {
      console.warn('[TokenStorage] Failed to retrieve token from SecureStore:', err);
      return this.memoryToken;
    }
  }

  async setToken(token: string): Promise<void> {
    this.memoryToken = token;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(SECURE_TOKEN_KEY, token);
        }
      } else {
        await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
      }
    } catch (err) {
      console.warn('[TokenStorage] Failed to persist token to SecureStore:', err);
    }
  }

  async removeToken(): Promise<void> {
    this.memoryToken = null;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(SECURE_TOKEN_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
      }
    } catch (err) {
      console.warn('[TokenStorage] Failed to remove token from SecureStore:', err);
    }
  }
}

export const driverTokenStorage = new MobileTokenStorage();

const SECURE_API_URL_KEY = 'kandy_driver_api_url_v1';
export const DEFAULT_PROD_URL = 'https://kandycabs-8kew.vercel.app';
export const DEFAULT_DEV_PORT = '3001';
export const DEFAULT_LAN_HOST = '192.168.1.5';
export const DEFAULT_EMULATOR_HOST = '10.0.2.2';

export function resolveDefaultApiUrl(): string {
  // If env variable is provided and not pointing to remote Vercel
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('vercel.app')) {
    return envUrl.replace(/\/+$/, '');
  }

  // In development:
  if (__DEV__) {
    // 1. Check Expo Metro debugger host
    const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri) {
      const hostIp = hostUri.split(':')[0];
      if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
        return `http://${hostIp}:${DEFAULT_DEV_PORT}`;
      }
    }

    // 2. Android Emulator default host loopback
    if (Platform.OS === 'android') {
      return `http://${DEFAULT_EMULATOR_HOST}:${DEFAULT_DEV_PORT}`;
    }

    return `http://localhost:${DEFAULT_DEV_PORT}`;
  }

  return `http://${DEFAULT_LAN_HOST}:${DEFAULT_DEV_PORT}`;
}

export const DEFAULT_LAN_URL = resolveDefaultApiUrl();

let activeBaseUrl: string = resolveDefaultApiUrl();

// Hydrate saved custom API URL asynchronously
SecureStore.getItemAsync(SECURE_API_URL_KEY)
  .then((stored) => {
    // Only accept stored URL if it is not an old unreachable vercel domain in dev
    if (stored && stored.startsWith('http') && (!__DEV__ || !stored.includes('vercel.app'))) {
      activeBaseUrl = stored.replace(/\/+$/, '');
    }
  })
  .catch(() => {});

export function getDynamicBaseUrl(): string {
  return activeBaseUrl;
}

export async function setCustomApiUrl(url: string): Promise<string> {
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    throw new Error('Server URL must start with http:// or https://');
  }
  activeBaseUrl = clean;
  try {
    await SecureStore.setItemAsync(SECURE_API_URL_KEY, clean);
  } catch (_) {}
  return activeBaseUrl;
}

export async function resetApiUrlToLan(): Promise<string> {
  activeBaseUrl = DEFAULT_LAN_URL;
  try {
    await SecureStore.setItemAsync(SECURE_API_URL_KEY, DEFAULT_LAN_URL);
  } catch (_) {}
  return DEFAULT_LAN_URL;
}

export const driverApiClient = new KandyApiClient({
  baseUrl: getDynamicBaseUrl,
  tokenStorage: driverTokenStorage,
});
