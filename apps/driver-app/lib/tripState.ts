import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TRIP_PROCESS_KEY = 'kandy_trip_in_process_';
const listeners: Array<() => void> = [];

export function subscribeTripState(listener: () => void) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notifyTripState() {
  listeners.forEach((l) => {
    try {
      l();
    } catch (_) {}
  });
}

// In-memory cache for fast synchronous access during renders
const memoryState: Record<string, boolean> = {};

export async function setTripInProcess(bookingId: string, inProcess: boolean): Promise<void> {
  if (!bookingId) return;
  memoryState[bookingId] = inProcess;
  const key = `${TRIP_PROCESS_KEY}${bookingId}`;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (inProcess) {
          localStorage.setItem(key, 'true');
        } else {
          localStorage.removeItem(key);
        }
      }
    } else {
      if (inProcess) {
        await SecureStore.setItemAsync(key, 'true');
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    }
  } catch (_) {}
  notifyTripState();
}

export async function getTripInProcess(bookingId: string): Promise<boolean> {
  if (!bookingId) return false;
  if (typeof memoryState[bookingId] === 'boolean') {
    return memoryState[bookingId];
  }
  const key = `${TRIP_PROCESS_KEY}${bookingId}`;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = localStorage.getItem(key) === 'true';
        const changed = memoryState[bookingId] !== val;
        memoryState[bookingId] = val;
        if (changed) notifyTripState();
        return val;
      }
    } else {
      const val = (await SecureStore.getItemAsync(key)) === 'true';
      const changed = memoryState[bookingId] !== val;
      memoryState[bookingId] = val;
      if (changed) notifyTripState();
      return val;
    }
  } catch (_) {}
  return false;
}

export function getTripInProcessSync(bookingId: string): boolean {
  if (!bookingId) return false;
  if (typeof memoryState[bookingId] === 'boolean') {
    return memoryState[bookingId];
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    const val = localStorage.getItem(`${TRIP_PROCESS_KEY}${bookingId}`) === 'true';
    memoryState[bookingId] = val;
    return val;
  }
  return false;
}

const TRIP_VERIFIED_OTP_KEY = 'kandy_trip_verified_otp_';
const memoryVerifiedOtp: Record<string, string> = {};

export async function setVerifiedPickupOtp(bookingId: string, otp: string): Promise<void> {
  if (!bookingId || !otp) return;
  memoryVerifiedOtp[bookingId] = otp;
  const key = `${TRIP_VERIFIED_OTP_KEY}${bookingId}`;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, otp);
      }
    } else {
      await SecureStore.setItemAsync(key, otp);
    }
  } catch (_) {}
}

export async function getVerifiedPickupOtp(bookingId: string): Promise<string | null> {
  if (!bookingId) return null;
  if (memoryVerifiedOtp[bookingId]) {
    return memoryVerifiedOtp[bookingId];
  }
  const key = `${TRIP_VERIFIED_OTP_KEY}${bookingId}`;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = localStorage.getItem(key);
        if (val) {
          memoryVerifiedOtp[bookingId] = val;
          return val;
        }
      }
    } else {
      const val = await SecureStore.getItemAsync(key);
      if (val) {
        memoryVerifiedOtp[bookingId] = val;
        return val;
      }
    }
  } catch (_) {}
  return null;
}

export async function clearVerifiedPickupOtp(bookingId: string): Promise<void> {
  if (!bookingId) return;
  delete memoryVerifiedOtp[bookingId];
  const key = `${TRIP_VERIFIED_OTP_KEY}${bookingId}`;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (_) {}
}

const TRIP_SELFIE_KEY = 'kandy_trip_selfie_';
const memorySelfie: Record<string, { uri: string; location?: any }> = {};

export async function setVerifiedSelfie(bookingId: string, uri: string, location?: any): Promise<void> {
  if (!bookingId || !uri) return;
  memorySelfie[bookingId] = { uri, location };
  const key = `${TRIP_SELFIE_KEY}${bookingId}`;
  try {
    if (uri.length < 2048) {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(key, JSON.stringify({ uri, location }));
        }
      } else {
        await SecureStore.setItemAsync(key, JSON.stringify({ uri, location }));
      }
    }
  } catch (_) {}
}

export async function getVerifiedSelfie(bookingId: string): Promise<{ uri: string; location?: any } | null> {
  if (!bookingId) return null;
  if (memorySelfie[bookingId]) {
    return memorySelfie[bookingId];
  }
  const key = `${TRIP_SELFIE_KEY}${bookingId}`;
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        raw = localStorage.getItem(key);
      }
    } else {
      raw = await SecureStore.getItemAsync(key);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.uri) {
        memorySelfie[bookingId] = parsed;
        return parsed;
      }
    }
  } catch (_) {}
  return null;
}

export async function clearVerifiedSelfie(bookingId: string): Promise<void> {
  if (!bookingId) return;
  delete memorySelfie[bookingId];
  const key = `${TRIP_SELFIE_KEY}${bookingId}`;
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (_) {}
}

export interface TripCompletionDraft {
  finalOdometer?: string;
  odometerImageUri?: string | null;
  tollAmount?: string;
  parkingAmount?: string;
  photoLocation?: { lat: number; lng: number; time: string } | null;
  ocrResultText?: any;
}

const memoryCompletionDrafts: Record<string, TripCompletionDraft> = {};

export function setTripCompletionDraft(bookingId: string, draft: Partial<TripCompletionDraft>) {
  if (!bookingId) return;
  memoryCompletionDrafts[bookingId] = {
    ...(memoryCompletionDrafts[bookingId] || {}),
    ...draft,
  };
}

export function getTripCompletionDraft(bookingId: string): TripCompletionDraft | null {
  if (!bookingId) return null;
  return memoryCompletionDrafts[bookingId] || null;
}

export function clearTripCompletionDraft(bookingId: string) {
  if (!bookingId) return;
  delete memoryCompletionDrafts[bookingId];
}

export interface TripStartDraft {
  startingOdometer?: string;
  odometerImageUri?: string | null;
  photoLocation?: { lat: number; lng: number; time: string } | null;
  ocrResultText?: any;
  inspectionPhotos?: (string | null)[];
  driverSelfieUri?: string | null;
  pickupOtp?: string;
}

const memoryStartDrafts: Record<string, TripStartDraft> = {};

export function setTripStartDraft(bookingId: string, draft: Partial<TripStartDraft>) {
  if (!bookingId) return;
  memoryStartDrafts[bookingId] = {
    ...(memoryStartDrafts[bookingId] || {}),
    ...draft,
  };
}

export function getTripStartDraft(bookingId: string): TripStartDraft | null {
  if (!bookingId) return null;
  return memoryStartDrafts[bookingId] || null;
}

export function clearTripStartDraft(bookingId: string) {
  if (!bookingId) return;
  delete memoryStartDrafts[bookingId];
}

const memoryVerifiedBookings: Record<string, boolean> = {};

export async function setTripVerificationCompleted(bookingId: string, completed = true) {
  if (!bookingId) return;
  memoryVerifiedBookings[bookingId] = completed;
  try {
    if (completed) {
      await SecureStore.setItemAsync(`kandy_trip_verified_${bookingId}`, 'true');
    } else {
      await SecureStore.deleteItemAsync(`kandy_trip_verified_${bookingId}`);
    }
  } catch {}
}

export function isTripVerificationCompletedSync(bookingId: string): boolean {
  if (!bookingId) return false;
  return Boolean(memoryVerifiedBookings[bookingId]);
}

export async function isTripVerificationCompleted(bookingId: string): Promise<boolean> {
  if (!bookingId) return false;
  if (memoryVerifiedBookings[bookingId]) return true;
  try {
    const val = await SecureStore.getItemAsync(`kandy_trip_verified_${bookingId}`);
    if (val === 'true') {
      memoryVerifiedBookings[bookingId] = true;
      return true;
    }
  } catch {}
  return false;
}

const memoryReachedBookings: Record<string, boolean> = {};

export async function setTripPickupReached(bookingId: string, reached = true) {
  if (!bookingId) return;
  memoryReachedBookings[bookingId] = reached;
  try {
    if (reached) {
      await SecureStore.setItemAsync(`kandy_trip_reached_${bookingId}`, 'true');
    } else {
      await SecureStore.deleteItemAsync(`kandy_trip_reached_${bookingId}`);
    }
  } catch {}
}

export function isTripPickupReachedSync(bookingId: string): boolean {
  if (!bookingId) return false;
  return Boolean(memoryReachedBookings[bookingId]);
}

export async function isTripPickupReached(bookingId: string): Promise<boolean> {
  if (!bookingId) return false;
  if (memoryReachedBookings[bookingId]) return true;
  try {
    const val = await SecureStore.getItemAsync(`kandy_trip_reached_${bookingId}`);
    if (val === 'true') {
      memoryReachedBookings[bookingId] = true;
      return true;
    }
  } catch {}
  return false;
}

export async function clearTripPickupReached(bookingId: string) {
  if (!bookingId) return;
  delete memoryReachedBookings[bookingId];
  try {
    await SecureStore.deleteItemAsync(`kandy_trip_reached_${bookingId}`);
  } catch {}
}





