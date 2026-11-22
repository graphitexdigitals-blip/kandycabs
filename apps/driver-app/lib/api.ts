import '../polyfills';
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

const SECURE_API_URL_KEY = 'kandy_driver_api_url_v2';
export const PROD_API_URL = 'https://proven-differences-sole-replace.trycloudflare.com';
export const DEFAULT_DEV_PORT = '3001';
export const DEFAULT_LAN_HOST = '192.168.29.207';
export const DEFAULT_EMULATOR_HOST = '10.0.2.2';
export const DEFAULT_LOCAL_URL = 'http://127.0.0.1:3001';

export function resolveDefaultApiUrl(): string {
  // 1. In Expo dev client / Expo Go, dynamically detect the host machine IP
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri || (Constants as any)?.manifest?.debuggerHost || (Constants as any)?.expoGoConfig?.debuggerHost;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && host !== '127.0.0.1' && host !== 'localhost') {
        return `http://${host}:3001`;
      }
    }
  }

  // 2. EXPO_PUBLIC_API_URL if valid and not an outdated dead IP
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.startsWith('http')) {
    if (!envUrl.includes('192.168.1.3') && !envUrl.includes('192.168.1.5')) {
      if (__DEV__ && (envUrl.includes('127.0.0.1') || envUrl.includes('localhost'))) {
        const hostUri = Constants.expoConfig?.hostUri || (Constants as any)?.manifest?.debuggerHost;
        if (hostUri) {
          const host = hostUri.split(':')[0];
          if (host && host !== '127.0.0.1' && host !== 'localhost') {
            return envUrl.replace(/127\.0\.0\.1|localhost/, host).replace(/\/+$/, '');
          }
        }
      }
      return envUrl.replace(/\/+$/, '');
    }
  }

  // 3. Fallback: Production Vercel endpoint (enables drivers on 4G cellular data to always connect)
  return PROD_API_URL;
}

export const DEFAULT_LAN_URL = resolveDefaultApiUrl();
export const DEFAULT_PROD_URL = PROD_API_URL;

let activeBaseUrl: string = resolveDefaultApiUrl();

// Hydrate saved custom API URL asynchronously
SecureStore.getItemAsync(SECURE_API_URL_KEY)
  .then((stored) => {
    // Purge outdated/dead IPs from SecureStore
    if (stored && (stored.includes('192.168.1.3') || stored.includes('192.168.1.5'))) {
      SecureStore.deleteItemAsync(SECURE_API_URL_KEY).catch(() => {});
      stored = null;
    }
    if (stored && stored.startsWith('http')) {
      activeBaseUrl = stored.replace(/\/+$/, '');
    } else {
      activeBaseUrl = resolveDefaultApiUrl();
    }
    console.log('[driverApiClient] Active API Base URL:', activeBaseUrl);
  })
  .catch(() => {});

// Clean up any old key from previous versions
SecureStore.deleteItemAsync('kandy_driver_api_url_v1').catch(() => {});

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

class ResilientDriverApiClient extends KandyApiClient {
  async fetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      return await super.fetch<T>(endpoint, options);
    } catch (err: any) {
      const current = this.getBaseUrl();
      const isLocal = current.includes('192.168.') || current.includes('10.0.') || current.includes('localhost') || current.includes('127.0.0.1');

      // If local server timed out or failed (e.g. driver switched from Wi-Fi to 4G cellular), fail over to production
      if (isLocal) {
        console.warn(`[driverApiClient] Primary local API (${current}) failed, trying fallback to ${PROD_API_URL}...`);
        const fallbackUrl = `${PROD_API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        try {
          const res = await super.fetch<T>(fallbackUrl, options);
          activeBaseUrl = PROD_API_URL;
          return res;
        } catch (_) {
          throw err;
        }
      } else if (current.includes('vercel.app')) {
        // If production fails, try local LAN as fallback if available
        const localLanUrl = `http://${DEFAULT_LAN_HOST}:3001`;
        const fallbackUrl = `${localLanUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        try {
          const res = await super.fetch<T>(fallbackUrl, { ...options, timeoutMs: 3000 } as any);
          activeBaseUrl = localLanUrl;
          return res;
        } catch (_) {
          throw err;
        }
      }
      throw err;
    }
  }
}

export const driverApiClient = new ResilientDriverApiClient({
  baseUrl: getDynamicBaseUrl,
  tokenStorage: driverTokenStorage,
});
