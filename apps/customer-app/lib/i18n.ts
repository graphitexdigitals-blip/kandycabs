import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import en from '../locales/en.json';
import kn from '../locales/kn.json';
import hi from '../locales/hi.json';

export const LANGUAGE_STORAGE_KEY = 'kandy_cabs_customer_lang';
export const NEW_USER_FLAG_KEY = 'kandy_cabs_customer_is_new_user_v2';
export const NEW_USER_LANG_PROMPT_DONE_KEY = 'kandy_cabs_customer_lang_prompt_done_v2';

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
        saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      }
    } else {
      saved = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
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
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      }
    } else {
      await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, lang);
    }
    await i18n.changeLanguage(lang);
  } catch (e) {
    console.warn('Error changing language:', e);
  }
}

export async function flagNewUserRegistration(userId?: string | null): Promise<void> {
  try {
    const userFlagKey = userId ? `${NEW_USER_FLAG_KEY}_${userId}` : null;
    const userDoneKey = userId ? `${NEW_USER_LANG_PROMPT_DONE_KEY}_${userId}` : null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(NEW_USER_FLAG_KEY, 'true');
        if (userFlagKey) localStorage.setItem(userFlagKey, 'true');
        localStorage.removeItem(NEW_USER_LANG_PROMPT_DONE_KEY);
        if (userDoneKey) localStorage.removeItem(userDoneKey);
      }
    } else {
      await SecureStore.setItemAsync(NEW_USER_FLAG_KEY, 'true');
      if (userFlagKey) {
        await SecureStore.setItemAsync(userFlagKey, 'true');
      }
      try {
        await SecureStore.deleteItemAsync(NEW_USER_LANG_PROMPT_DONE_KEY);
      } catch {}
      if (userDoneKey) {
        try {
          await SecureStore.deleteItemAsync(userDoneKey);
        } catch {}
      }
    }
  } catch (e) {
    console.warn('Error flagging new user for language prompt:', e);
  }
}

export async function clearNewUserFlag(userId?: string | null): Promise<void> {
  try {
    const userFlagKey = userId ? `${NEW_USER_FLAG_KEY}_${userId}` : null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(NEW_USER_FLAG_KEY);
        if (userFlagKey) localStorage.removeItem(userFlagKey);
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(NEW_USER_FLAG_KEY);
      } catch {}
      if (userFlagKey) {
        try {
          await SecureStore.deleteItemAsync(userFlagKey);
        } catch {}
      }
    }
  } catch (e) {
    console.warn('Error clearing new user flag:', e);
  }
}

export async function isNewUserLangPromptNeeded(
  userOrId?: { id?: string | null; createdAt?: string | Date | null } | string | null
): Promise<boolean> {
  try {
    const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
    const createdAt = typeof userOrId === 'object' ? userOrId?.createdAt : null;

    const userDoneKey = userId ? `${NEW_USER_LANG_PROMPT_DONE_KEY}_${userId}` : null;
    const userFlagKey = userId ? `${NEW_USER_FLAG_KEY}_${userId}` : null;

    let userDone: string | null = null;
    let isNewGlobal: string | null = null;
    let isNewUser: string | null = null;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (userDoneKey) userDone = localStorage.getItem(userDoneKey);
        isNewGlobal = localStorage.getItem(NEW_USER_FLAG_KEY);
        if (userFlagKey) isNewUser = localStorage.getItem(userFlagKey);
      }
    } else {
      if (userDoneKey) userDone = await SecureStore.getItemAsync(userDoneKey);
      isNewGlobal = await SecureStore.getItemAsync(NEW_USER_FLAG_KEY);
      if (userFlagKey) isNewUser = await SecureStore.getItemAsync(userFlagKey);
    }

    // If this specific user already saw/dismissed the prompt, NEVER prompt again
    if (userDone === 'true') {
      return false;
    }

    // 1. Explicitly flagged as new registration
    if (isNewGlobal === 'true' || isNewUser === 'true') {
      return true;
    }

    // 2. Newly created account (within last 60 minutes)
    if (createdAt) {
      const createdTime = new Date(createdAt).getTime();
      const diffMinutes = (Date.now() - createdTime) / (1000 * 60);
      if (!isNaN(diffMinutes) && diffMinutes >= 0 && diffMinutes <= 60) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export async function markNewUserLangPromptDone(userId?: string | null): Promise<void> {
  try {
    const userDoneKey = userId ? `${NEW_USER_LANG_PROMPT_DONE_KEY}_${userId}` : null;
    const userFlagKey = userId ? `${NEW_USER_FLAG_KEY}_${userId}` : null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(NEW_USER_LANG_PROMPT_DONE_KEY, 'true');
        if (userDoneKey) localStorage.setItem(userDoneKey, 'true');
        localStorage.removeItem(NEW_USER_FLAG_KEY);
        if (userFlagKey) localStorage.removeItem(userFlagKey);
      }
    } else {
      await SecureStore.setItemAsync(NEW_USER_LANG_PROMPT_DONE_KEY, 'true');
      if (userDoneKey) {
        await SecureStore.setItemAsync(userDoneKey, 'true');
      }
      try {
        await SecureStore.deleteItemAsync(NEW_USER_FLAG_KEY);
      } catch {}
      if (userFlagKey) {
        try {
          await SecureStore.deleteItemAsync(userFlagKey);
        } catch {}
      }
    }
  } catch (e) {
    console.warn('Error marking language prompt done:', e);
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
