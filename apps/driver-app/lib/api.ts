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

export function getDynamicBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  return 'https://kandycabs.vercel.app';
}

export const driverApiClient = new KandyApiClient({
  baseUrl: getDynamicBaseUrl,
  tokenStorage: driverTokenStorage,
});
