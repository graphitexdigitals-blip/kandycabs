import { Platform } from 'react-native';
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
    this.token = token;
    this.notify();
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
    this.token = null;
    this.user = null;
    this.notify();
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

  setUser(user: any | null): void {
    this.user = user;
    this.notify();
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

export function getDynamicBaseUrl(): string {
  if (__DEV__) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  return 'https://web-rgwp.vercel.app';
}

export const customerApiClient = new KandyApiClient({
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

