import { Platform, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { KandyApiClient, TokenStorage } from '@kandy-cabs/shared';

const SECURE_TOKEN_KEY = 'kandy_customer_token_v1';
const SECURE_USER_KEY = 'kandy_customer_user_v1';

// Persistent & Memory-backed token & profile storage for customer mobile app
class MobileTokenStorage implements TokenStorage {
  private token: string | null = null;
  private user: any | null = null;
  private listeners: Array<() => void> = [];
  private initialized: boolean = false;

  constructor() {
    this.hydrate();
  }

  private async hydrate() {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          this.token = localStorage.getItem(SECURE_TOKEN_KEY);
          const rawUser = localStorage.getItem(SECURE_USER_KEY);
          if (rawUser) this.user = JSON.parse(rawUser);
        }
      } else {
        const storedToken = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
        if (storedToken) this.token = storedToken;
        const storedUser = await SecureStore.getItemAsync(SECURE_USER_KEY);
        if (storedUser) this.user = JSON.parse(storedUser);
      }
    } catch (e) {
      console.warn('[TokenStorage] Hydration error:', e);
    } finally {
      this.initialized = true;
      this.notify();
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async getTokenAsync(): Promise<string | null> {
    if (this.token) return this.token;
    try {
      if (Platform.OS === 'web') {
        return typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(SECURE_TOKEN_KEY) : null;
      }
      return await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
    } catch {
      return this.token;
    }
  }

  setToken(token: string): void {
    const isDifferent = this.token !== token;
    this.token = token;
    if (isDifferent) {
      this.notify();
    }
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(SECURE_TOKEN_KEY, token);
        }
      } else {
        SecureStore.setItemAsync(SECURE_TOKEN_KEY, token).catch(() => {});
      }
    } catch (e) {
      console.warn('[TokenStorage] setToken error:', e);
    }
  }

  removeToken(): void {
    const isDifferent = this.token !== null || this.user !== null;
    this.token = null;
    this.user = null;
    if (isDifferent) {
      this.notify();
    }
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(SECURE_TOKEN_KEY);
          localStorage.removeItem(SECURE_USER_KEY);
        }
      } else {
        SecureStore.deleteItemAsync(SECURE_TOKEN_KEY).catch(() => {});
        SecureStore.deleteItemAsync(SECURE_USER_KEY).catch(() => {});
      }
    } catch (e) {
      console.warn('[TokenStorage] removeToken error:', e);
    }
  }

  getUser(): any | null {
    return this.user;
  }

  async getUserAsync(): Promise<any | null> {
    if (this.user) return this.user;
    try {
      if (Platform.OS === 'web') {
        const raw = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(SECURE_USER_KEY) : null;
        if (raw) {
          this.user = JSON.parse(raw);
          return this.user;
        }
        return null;
      }
      const stored = await SecureStore.getItemAsync(SECURE_USER_KEY);
      if (stored) {
        this.user = JSON.parse(stored);
        return this.user;
      }
      return null;
    } catch {
      return this.user;
    }
  }

  setUser(user: any | null): void {
    const isDifferent = JSON.stringify(this.user) !== JSON.stringify(user);
    this.user = user;
    if (isDifferent) {
      this.notify();
    }
    try {
      const serialized = user ? JSON.stringify(user) : '';
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          if (serialized) localStorage.setItem(SECURE_USER_KEY, serialized);
          else localStorage.removeItem(SECURE_USER_KEY);
        }
      } else {
        if (serialized) SecureStore.setItemAsync(SECURE_USER_KEY, serialized).catch(() => {});
        else SecureStore.deleteItemAsync(SECURE_USER_KEY).catch(() => {});
      }
    } catch (e) {
      console.warn('[TokenStorage] setUser error:', e);
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (e) {
        console.warn('Storage listener error:', e);
      }
    });
  }
}

export const customerTokenStorage = new MobileTokenStorage();

import Constants from 'expo-constants';
import { getAdminRegisteredCustomer } from './adminCustomers';

export const CANDIDATE_API_URLS = [
  'http://10.0.2.2:3001',
  'http://192.168.1.3:3001',
  'http://127.0.0.1:3001',
];

export function resolveDefaultApiUrl(): string {
  // Accurate detection of Android emulator vs Physical device
  const isAndroidEmulator =
    Platform.OS === 'android' &&
    (Platform.constants?.Brand === 'google' ||
      Platform.constants?.Model?.toLowerCase().includes('sdk') ||
      Platform.constants?.Model?.toLowerCase().includes('emulator') ||
      String((Platform.constants as any)?.Fingerprint || '').includes('generic'));

  const isPhysicalPhone = Platform.OS === 'android' ? !isAndroidEmulator : false;

  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.startsWith('http')) {
    // If running on a physical phone, 10.0.2.2 is an emulator-only loopback; map to PC Wi-Fi IP
    if (isPhysicalPhone && envUrl.includes('10.0.2.2')) {
      return envUrl.replace('10.0.2.2', '192.168.1.3').replace(/\/+$/, '');
    }
    // If running in Android emulator, map PC LAN IP to emulator loopback 10.0.2.2
    if (isAndroidEmulator && envUrl.includes('192.168.1.3')) {
      return envUrl.replace('192.168.1.3', '10.0.2.2').replace(/\/+$/, '');
    }
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

  if (Platform.OS === 'android') {
    if (isPhysicalPhone) {
      return 'https://kandycabs-production.up.railway.app';
    }
    return 'http://10.0.2.2:3001';
  }
  return 'https://kandycabs-production.up.railway.app';
}

let activeCustomerApiUrl: string = resolveDefaultApiUrl();

export function getDynamicBaseUrl(): string {
  return activeCustomerApiUrl;
}

export function setActiveBaseUrl(url: string) {
  if (url && url.startsWith('http')) {
    activeCustomerApiUrl = url.replace(/\/+$/, '');
  }
}

let hasShownSessionAlert = false;
export function handleSessionTerminated(message?: string) {
  customerTokenStorage.removeToken();
  if (!hasShownSessionAlert) {
    hasShownSessionAlert = true;
    const msg =
      message ||
      'You have been logged out because this account was logged into another device. Please log in again with OTP.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(msg);
      hasShownSessionAlert = false;
    } else {
      Alert.alert(
        'Session Expired',
        msg,
        [
          {
            text: 'OK',
            onPress: () => {
              hasShownSessionAlert = false;
            },
          },
        ],
        { cancelable: false }
      );
    }
  }
}

class ResilientCustomerApiClient extends KandyApiClient {
  async fetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const current = this.getBaseUrl();
    const isMutation = Boolean(options.method && options.method !== 'GET');
    const timeoutOverride = (options as any).timeoutMs || (isMutation ? 20000 : 12000);

    // 1. Try current active URL first
    try {
      return await super.fetch<T>(endpoint, { ...options, timeoutMs: timeoutOverride } as any);
    } catch (err: any) {
      // If session was terminated because another device logged in, handle immediately
      if (err?.code === 'SESSION_TERMINATED') {
        handleSessionTerminated(err?.message);
        throw err;
      }

      // If error is an explicit 401 Unauthorized or 400/404 business error, do not retry other servers
      if (err?.status && err.status >= 400 && err.status < 500 && err.status !== 408) {
        throw err;
      }

      // Do not retry mutations on other servers if it wasn't a connection error
      const isConnError =
        err?.status === 408 ||
        err?.status === 0 ||
        !err?.status ||
        /network|timeout|timed\s*out|aborted/i.test(err?.message || '');
      if (isMutation && !isConnError) {
        throw err;
      }

      console.warn(`[customerApiClient] Request to ${current}${endpoint} failed. Trying alternative API URLs...`);

      // 2. Try alternative candidate endpoints
      for (const candidate of CANDIDATE_API_URLS) {
        if (candidate === current) continue;
        try {
          const candidateUrl = `${candidate}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
          const res = await super.fetch<T>(candidateUrl, { ...options, timeoutMs: isMutation ? 20000 : 10000 } as any);
          // If successful, update active URL so subsequent calls are fast
          activeCustomerApiUrl = candidate;
          console.log(`[customerApiClient] Switched active API URL to ${candidate}`);
          return res;
        } catch (_) {
          // Continue to next candidate
        }
      }

      // 3. Fallback for profile requests if completely offline
      if (endpoint.includes('/api/auth/me')) {
        const cached = customerTokenStorage.getUser();
        const reg = getAdminRegisteredCustomer(cached?.phone);
        if (reg) {
          return {
            user: {
              id: reg.id,
              userId: reg.userId,
              phone: reg.phone,
              fullName: reg.fullName,
              email: reg.email,
              roles: ['CUSTOMER'],
              customer: {
                id: reg.customerId,
                email: reg.email,
                savedAddresses: reg.savedAddresses,
              },
            },
          } as any;
        }
      }

      throw err;
    }
  }
}

export const customerApiClient = new ResilientCustomerApiClient({
  baseUrl: getDynamicBaseUrl,
  tokenStorage: customerTokenStorage,
});

export function formatDisplayPhone(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  const tenDigits = digits.slice(-10);
  if (!tenDigits) return '';
  return `+91 ${tenDigits}`;
}

