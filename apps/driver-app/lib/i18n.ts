import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import en from '../locales/en.json';
import kn from '../locales/kn.json';
import hi from '../locales/hi.json';

export const DRIVER_LANGUAGE_STORAGE_KEY = 'kandy_cabs_driver_lang';

export type AppLanguage = 'en' | 'kn' | 'hi';

export interface SupportedLanguage {
  code: AppLanguage;
  badge: string;
  label: string;
  nativeLabel: string;
  sublabel?: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    code: 'en',
    badge: 'EN',
    label: 'English',
    nativeLabel: 'English',
  },
  {
    code: 'kn',
    badge: 'ಕ',
    label: 'Kannada',
    nativeLabel: 'ಕನ್ನಡ',
  },
  {
    code: 'hi',
    badge: 'हि',
    label: 'Hindi',
    nativeLabel: 'हिन्दी',
  },
];

// Fallback detection from device locales / Intl
export function getDeviceLanguage(): AppLanguage {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const resolved = Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase() || '';
      if (resolved.startsWith('kn')) return 'kn';
      if (resolved.startsWith('hi')) return 'hi';
    }
  } catch (e) {
    console.warn('Locale detection fallback:', e);
  }
  return 'en';
}

export async function getPersistedLanguage(): Promise<AppLanguage> {
  try {
    let saved: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        saved = localStorage.getItem(DRIVER_LANGUAGE_STORAGE_KEY);
      }
    } else {
      saved = await SecureStore.getItemAsync(DRIVER_LANGUAGE_STORAGE_KEY);
    }
    if (saved === 'en' || saved === 'kn' || saved === 'hi') {
      return saved;
    }
  } catch (e) {
    console.warn('Error reading persisted language:', e);
  }
  return getDeviceLanguage();
}

export async function changeAppLanguage(lang: AppLanguage): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(DRIVER_LANGUAGE_STORAGE_KEY, lang);
      }
    } else {
      await SecureStore.setItemAsync(DRIVER_LANGUAGE_STORAGE_KEY, lang);
    }
    await i18n.changeLanguage(lang);
  } catch (e) {
    console.warn('Error changing language:', e);
  }
}

// Synchronous default init, immediately followed by async persisted language load
i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: en },
    kn: { translation: kn },
    hi: { translation: hi },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

// Load saved user preference or device locale asynchronously
getPersistedLanguage().then((preferredLang) => {
  if (preferredLang && preferredLang !== i18n.language) {
    i18n.changeLanguage(preferredLang);
  }
});

export default i18n;

