import 'fast-text-encoding';
import * as Location from 'expo-location';
import { Linking, Platform, PermissionsAndroid } from 'react-native';
import { driverApiClient } from './api';

// Safe dynamic resolution: guard against missing native module ExpoTaskManager in pre-built APKs
let TaskManager: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  TaskManager = require('expo-task-manager');
} catch (_) {
  // Native module not linked in base APK; fallback gracefully to foreground watcher
  TaskManager = null;
}

export const BACKGROUND_LOCATION_TASK = 'KANDY_ACTIVE_TRIP_BACKGROUND_LOCATION';

export interface LocationPoint {
  lat: number;
  lng: number;
  recordedAt: string;
}

export type LocationServiceStatus =
  | 'NOT_STARTED'
  | 'CHECKING_PERMISSIONS'
  | 'PERMISSION_DENIED'
  | 'SERVICES_DISABLED'
  | 'ACQUIRING'
  | 'READY'
  | 'ERROR';

export type LocationSource = 'lastKnown' | 'live' | 'background' | 'manual' | 'none';

export interface LocationState {
  lat: number | null;
  lng: number | null;
  source: LocationSource;
  status: LocationServiceStatus;
  timestamp: number | null;
  errorMessage?: string;
}

export type LocationChangeListener = (
  lat: number | null,
  lng: number | null,
  state: LocationState
) => void;

// Safe FIFO memory queue for batched location points (max 20 to prevent unbounded memory growth)
const MAX_BATCHED_POINTS = 20;

class LocationTrackerService {
  private isTracking: boolean = false;
  private currentTier: 'IDLE' | 'ACTIVE_TRIP' = 'IDLE';
  private currentBgMode: 'IDLE' | 'ACTIVE_TRIP' | null = null;
  private activeBookingId: string | null = null;
  private intervalTimer: any = null;
  private watchSubscription: Location.LocationSubscription | null = null;
  private batchedPoints: LocationPoint[] = [];
  private hasForegroundPermission: boolean = false;
  private hasBackgroundPermission: boolean = false;
  private lastPingTime: number = 0;
  private listeners: Set<LocationChangeListener> = new Set();

  // Coordinates state: null until a real device fix is acquired
  private currentLat: number | null = null;
  private currentLng: number | null = null;
  private currentSource: LocationSource = 'none';
  private currentStatus: LocationServiceStatus = 'NOT_STARTED';
  private lastTimestamp: number | null = null;
  private errorMessage: string | undefined = undefined;
  private hasInitialFix: boolean = false;

  private lastSentLat: number = 0;
  private lastSentLng: number = 0;
  private isPinging: boolean = false;

  public isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  public getActiveBookingId(): string | null {
    return this.activeBookingId;
  }

  public getStatus(): LocationServiceStatus {
    return this.currentStatus;
  }

  public getState(): LocationState {
    return {
      lat: this.currentLat,
      lng: this.currentLng,
      source: this.currentSource,
      status: this.currentStatus,
      timestamp: this.lastTimestamp,
      errorMessage: this.errorMessage,
    };
  }

  public addListener(listener: LocationChangeListener) {
    this.listeners.add(listener);
    // Immediately emit current state to new subscriber
    listener(this.currentLat, this.currentLng, this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(this.currentLat, this.currentLng, state);
      } catch (_) {}
    });
  }

  public async requestPermissions(): Promise<{ granted: boolean; status: LocationServiceStatus; error?: string }> {
    try {
      this.currentStatus = 'CHECKING_PERMISSIONS';
      this.notifyListeners();

      // 1. Verify device location services (GPS hardware) are enabled
      const isLocationServicesEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationServicesEnabled) {
        try {
          if (Platform.OS === 'android') {
            await Location.enableNetworkProviderAsync();
          }
        } catch (_) {}

        const recheck = await Location.hasServicesEnabledAsync();
        if (!recheck) {
          this.currentStatus = 'SERVICES_DISABLED';
          this.hasForegroundPermission = false;
          this.errorMessage = 'Location Services (GPS) are disabled on this device.';
          this.notifyListeners();
          return { granted: false, status: 'SERVICES_DISABLED', error: this.errorMessage };
        }
      }

      // 2. Request runtime foreground location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        this.currentStatus = 'PERMISSION_DENIED';
        this.hasForegroundPermission = false;
        this.errorMessage = 'Foreground location permission was denied by the user.';
        this.notifyListeners();
        return { granted: false, status: 'PERMISSION_DENIED', error: this.errorMessage };
      }

      // 3. Request runtime notification permission on Android 13+ (API 33+) for status bar alerts
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        } catch (_) {}
      }

      this.hasForegroundPermission = true;
      this.errorMessage = undefined;
      this.currentStatus = this.hasInitialFix ? 'READY' : 'ACQUIRING';
      this.notifyListeners();
      return { granted: true, status: this.currentStatus };
    } catch (err: any) {
      console.warn('[LocationTracker] Permission request failed:', err);
      this.currentStatus = 'ERROR';
      this.hasForegroundPermission = false;
      this.errorMessage = err?.message || 'Failed to request location permissions';
      this.notifyListeners();
      return { granted: false, status: 'ERROR', error: this.errorMessage };
    }
  }

  public async requestBackgroundPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      this.hasBackgroundPermission = status === 'granted';
      if (!this.hasBackgroundPermission) {
        console.warn('[BackgroundGPS] Background location permission not granted by user; falling back to foreground watcher.');
      }
      return this.hasBackgroundPermission;
    } catch (err: any) {
      console.warn('[BackgroundGPS] Background permission request error:', err?.message || err);
      this.hasBackgroundPermission = false;
      return false;
    }
  }

  public async openLocationSettings() {
    try {
      if (Platform.OS === 'android') {
        try {
          await Location.enableNetworkProviderAsync();
        } catch (_) {
          await Linking.openSettings();
        }
      } else {
        await Linking.openSettings();
      }
    } catch (_) {
      await Linking.openSettings();
    }
  }

  // Normalize Android emulator Googleplex GPS coordinates to Karnataka / Bengaluru hub
  private normalizeCoordinates(lat: number, lng: number): { lat: number; lng: number } {
    if ((Math.abs(lat - 37.42) < 1.0 && Math.abs(lng - (-122.08)) < 1.0) || lng < 0) {
      return { lat: 12.9716, lng: 77.5946 };
    }
    return { lat, lng };
  }

  // Calculate distance between two lat/lng points in meters
  private getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  public async startIdleTracking() {
    if (this.isTracking && this.currentTier === 'IDLE') {
      await this.ensureBackgroundLocationStarted(null);
      return;
    }
    this.currentTier = 'IDLE';
    this.activeBookingId = null;
    await this.startWatchAndHeartbeat(
      Location.Accuracy.Balanced,
      15000, // 15s watcher interval
      25,    // 25m distance threshold
      30000  // 30s heartbeat
    );
    // Start Android persistent foreground notification showing Online / On-Duty status
    await this.ensureBackgroundLocationStarted(null);
  }

  public async startActiveTripTracking(bookingId: string) {
    if (this.isTracking && this.currentTier === 'ACTIVE_TRIP' && this.activeBookingId === bookingId) {
      await this.ensureBackgroundLocationStarted(bookingId);
      return;
    }

    this.currentTier = 'ACTIVE_TRIP';
    this.activeBookingId = bookingId;

    // 1. Start foreground watcher & heartbeat for responsive in-app updates (~10s active interval)
    await this.startWatchAndHeartbeat(
      Location.Accuracy.High,
      8000,  // 8s watcher interval
      12,    // 12m distance threshold
      10000  // 10s heartbeat
    );

    // 2. Start Android background location task with active trip notification
    await this.ensureBackgroundLocationStarted(bookingId);
  }

  private async ensureBackgroundLocationStarted(bookingId?: string | null) {
    try {
      if (!TaskManager || typeof TaskManager.isTaskDefined !== 'function') {
        // Safe fallback: TaskManager native module not present; foreground watcher is active
        return;
      }
      if (Platform.OS === 'android') {
        try {
          await this.requestBackgroundPermissions();
        } catch (_) {}

        const isTrip = Boolean(bookingId);
        const targetMode = isTrip ? 'ACTIVE_TRIP' : 'IDLE';

        const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (isRunning && this.currentBgMode === targetMode) {
          // Already running in the desired mode
          return;
        }

        if (isRunning) {
          // Restart to update notification content and parameters dynamically
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }

        const notificationTitle = isTrip ? 'Kandy Cabs — Active Ride' : 'Kandy Cabs Driver Partner';
        const notificationBody = isTrip
          ? 'ON TRIP: Live GPS tracking enabled'
          : 'ONLINE: Ready for ride assignments';
        const notificationColor = isTrip ? '#ea580c' : '#008860';

        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: isTrip ? Location.Accuracy.High : Location.Accuracy.Balanced,
          timeInterval: isTrip ? 10000 : 30000,       // 30s when idle, 10s on active trip
          distanceInterval: isTrip ? 15 : 30,          // 30m when idle, 15m on active trip
          deferredUpdatesInterval: isTrip ? 10000 : 30000,
          deferredUpdatesDistance: isTrip ? 15 : 30,
          foregroundService: {
            notificationTitle,
            notificationBody,
            notificationColor,
            killServiceOnDestroy: false,
          },
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
        });
        this.currentBgMode = targetMode;
        console.log(`[BackgroundService] Foreground notification started: ${notificationTitle} (${notificationBody})`);
      }
    } catch (err: any) {
      console.warn('[BackgroundGPS] Failed to start background location updates:', err?.message || err);
    }
  }

  private async stopBackgroundLocationUpdates() {
    try {
      this.currentBgMode = null;
      if (!TaskManager || typeof TaskManager.isTaskDefined !== 'function') {
        return;
      }
      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('[BackgroundService] Foreground notification stopped (Off-Duty)');
      }
    } catch (err: any) {
      // Ignore if task was not running
    }
  }

  public async stopTracking() {
    // 1. Stop background task if running
    await this.stopBackgroundLocationUpdates();

    // 2. Stop foreground watcher & interval timer
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isTracking = false;
    this.activeBookingId = null;
  }

  public async sendFinalTrackingPoint(bookingId?: string) {
    const bId = bookingId || this.activeBookingId;
    if (this.currentLat != null && this.currentLng != null) {
      try {
        await driverApiClient.fetch('/api/driver/ping', {
          method: 'POST',
          body: JSON.stringify({
            lat: this.currentLat,
            lng: this.currentLng,
            bookingId: bId,
            batchedPoints: [
              {
                lat: this.currentLat,
                lng: this.currentLng,
                recordedAt: new Date().toISOString(),
              },
            ],
          }),
        });
        console.log('[BackgroundGPS] Location sent (final trip point)');
      } catch (err: any) {
        console.error('[BackgroundGPS] API error (final trip point):', err?.message || err);
      }
    }
  }

  public updateManualPosition(lat: number, lng: number) {
    this.currentLat = lat;
    this.currentLng = lng;
    this.currentSource = 'manual';
    this.hasInitialFix = true;
    this.currentStatus = 'READY';
    this.lastTimestamp = Date.now();
    this.notifyListeners();
    this.throttledSendLocationPing(true);
  }

  public async handleBackgroundLocationUpdate(locationObj: Location.LocationObject) {
    if (!locationObj || !locationObj.coords) return;
    const rawCoords = locationObj.coords;
    const { lat: latitude, lng: longitude } = this.normalizeCoordinates(rawCoords.latitude, rawCoords.longitude);

    this.currentLat = latitude;
    this.currentLng = longitude;
    this.currentSource = 'background';
    this.hasInitialFix = true;
    this.currentStatus = 'READY';
    this.lastTimestamp = locationObj.timestamp || Date.now();
    this.notifyListeners();

    // Push into FIFO batched queue
    const point: LocationPoint = {
      lat: latitude,
      lng: longitude,
      recordedAt: new Date(this.lastTimestamp).toISOString(),
    };
    this.enqueuePoint(point);

    // Send location ping
    await this.sendLocationPing();
  }

  private enqueuePoint(point: LocationPoint) {
    this.batchedPoints.push(point);
    if (this.batchedPoints.length > MAX_BATCHED_POINTS) {
      // FIFO eviction to cap queue size
      this.batchedPoints = this.batchedPoints.slice(-MAX_BATCHED_POINTS);
    }
  }

  private async acquireInitialPosition() {
    // 1. Fast immediate fix from OS cache (< 50ms)
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 600000, // up to 10 min cache
      });
      if (lastKnown && lastKnown.coords) {
        const rawCoords = lastKnown.coords;
        const { lat: latitude, lng: longitude } = this.normalizeCoordinates(rawCoords.latitude, rawCoords.longitude);
        if (__DEV__) {
          console.log(`[LocationTracker] Acquired lastKnown location: lat=${latitude}, lng=${longitude}`);
        }
        if (this.currentSource !== 'live' && this.currentSource !== 'background') {
          this.currentLat = latitude;
          this.currentLng = longitude;
          this.currentSource = 'lastKnown';
          this.hasInitialFix = true;
          this.currentStatus = 'READY';
          this.lastTimestamp = Date.now();
          this.notifyListeners();
          this.throttledSendLocationPing(true);
        }
      }
    } catch (e) {
      if (__DEV__) {
        console.log('[LocationTracker] getLastKnownPositionAsync unavailable, waiting for live fix');
      }
    }

    // 2. Single-shot fetch with bounded 5-second timeout (never blocks the watcher pipeline)
    this.fetchFreshCurrentPosition(5000);
  }

  private async fetchFreshCurrentPosition(timeoutMs: number = 5000) {
    try {
      const fetchPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
      const loc = await Promise.race([fetchPromise, timeoutPromise]);

      if (loc && loc.coords) {
        const rawCoords = loc.coords;
        const { lat: latitude, lng: longitude } = this.normalizeCoordinates(rawCoords.latitude, rawCoords.longitude);
        if (__DEV__) {
          console.log(`[LocationTracker] Acquired live single-shot location: lat=${latitude}, lng=${longitude}`);
        }
        this.currentLat = latitude;
        this.currentLng = longitude;
        this.currentSource = 'live';
        this.hasInitialFix = true;
        this.currentStatus = 'READY';
        this.lastTimestamp = Date.now();
        this.notifyListeners();
        this.throttledSendLocationPing(true);
      }
    } catch (err) {
      if (__DEV__) {
        console.log('[LocationTracker] Single-shot getCurrentPositionAsync completed or timed out');
      }
    }
  }

  private async startWatchAndHeartbeat(
    accuracy: Location.Accuracy,
    timeInterval: number,
    distanceInterval: number,
    heartbeatMs: number
  ) {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    this.isTracking = true;

    // Check & request permissions
    const permResult = await this.requestPermissions();
    if (!permResult.granted) {
      return;
    }

    // Trigger fast initial acquisition asynchronously (non-blocking)
    this.acquireInitialPosition();

    // Start continuous live GPS watcher
    try {
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy,
          timeInterval,
          distanceInterval,
          mayShowUserSettingsDialog: true,
        },
        (loc) => {
          if (loc && loc.coords) {
            const rawCoords = loc.coords;
            const { lat: latitude, lng: longitude } = this.normalizeCoordinates(rawCoords.latitude, rawCoords.longitude);
            const coordAccuracy = rawCoords.accuracy;

            // Accuracy filter: ignore noisy fixes (> 300m uncertainty)
            if (coordAccuracy != null && coordAccuracy > 300) {
              return;
            }

            const deltaMeters =
              this.currentLat != null && this.currentLng != null
                ? this.getDistanceMeters(this.currentLat, this.currentLng, latitude, longitude)
                : 999;

            const movementThreshold = this.currentTier === 'ACTIVE_TRIP' ? 5 : 15;

            if (deltaMeters >= movementThreshold || !this.hasInitialFix || this.currentSource !== 'live') {
              this.currentLat = latitude;
              this.currentLng = longitude;
              this.currentSource = 'live';
              this.hasInitialFix = true;
              this.currentStatus = 'READY';
              this.lastTimestamp = Date.now();
              this.notifyListeners();
              this.throttledSendLocationPing(false);
            }
          }
        }
      );
    } catch (err: any) {
      console.warn('[LocationTracker] Failed to start Location.watchPositionAsync:', err);
      this.currentStatus = 'ERROR';
      this.errorMessage = err?.message || 'Failed to start GPS location watcher';
      this.notifyListeners();
    }

    // Periodic heartbeat to maintain live driver location telemetry
    this.intervalTimer = setInterval(() => {
      if (this.currentLat != null && this.currentLng != null) {
        this.throttledSendLocationPing(true);
      }
    }, heartbeatMs);
  }

  public async forceImmediatePing() {
    if (!this.hasForegroundPermission) {
      const permResult = await this.requestPermissions();
      if (!permResult.granted) return;
    }
    await this.acquireInitialPosition();
  }

  // Throttled ping: avoids HTTP spam if pings happen within minInterval
  private throttledSendLocationPing(force: boolean = false) {
    if (this.currentLat == null || this.currentLng == null) {
      return;
    }

    const now = Date.now();
    const minInterval = this.currentTier === 'ACTIVE_TRIP' ? 8000 : 25000;
    const minDistance = this.currentTier === 'ACTIVE_TRIP' ? 12 : 30;
    const timeSinceLastPing = now - this.lastPingTime;
    const distanceSinceLastSent = this.getDistanceMeters(
      this.lastSentLat,
      this.lastSentLng,
      this.currentLat,
      this.currentLng
    );

    if (force || timeSinceLastPing >= minInterval || distanceSinceLastSent >= minDistance) {
      const point: LocationPoint = {
        lat: this.currentLat,
        lng: this.currentLng,
        recordedAt: new Date().toISOString(),
      };
      this.enqueuePoint(point);
      this.sendLocationPing();
    }
  }

  private async sendLocationPing() {
    if (this.isPinging || this.currentLat == null || this.currentLng == null) return;
    this.isPinging = true;

    this.lastPingTime = Date.now();
    this.lastSentLat = this.currentLat;
    this.lastSentLng = this.currentLng;

    const pointsToSend = [...this.batchedPoints];

    try {
      await driverApiClient.fetch('/api/driver/ping', {
        method: 'POST',
        body: JSON.stringify({
          lat: this.currentLat,
          lng: this.currentLng,
          bookingId: this.activeBookingId,
          batchedPoints: pointsToSend,
        }),
      });

      console.log(`[BackgroundGPS] Location sent: lat=${this.currentLat}, lng=${this.currentLng}, bookingId=${this.activeBookingId || 'IDLE'}`);

      // Successfully synced: clear points that were successfully delivered
      this.batchedPoints = this.batchedPoints.filter((p) => !pointsToSend.includes(p));
    } catch (error: any) {
      console.error('[BackgroundGPS] API error:', error?.message || error);
      // Retain in batchedPoints for retry on next ping
    } finally {
      this.isPinging = false;
    }
  }

  public getCurrentCoordinates() {
    return {
      lat: this.currentLat,
      lng: this.currentLng,
      source: this.currentSource,
      status: this.currentStatus,
      hasInitialFix: this.hasInitialFix,
      tier: this.currentTier,
      isTracking: this.isTracking,
    };
  }
}

export const locationTracker = new LocationTrackerService();

// Register background task at module scope only if TaskManager native module is available
try {
  if (TaskManager && typeof TaskManager.isTaskDefined === 'function' && typeof TaskManager.defineTask === 'function') {
    if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
      TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: { data: any; error: any }) => {
        if (error) {
          console.error('[BackgroundGPS] API error:', error?.message || error);
          return;
        }
        if (data) {
          const { locations } = data as { locations: Location.LocationObject[] };
          if (locations && locations.length > 0) {
            const latest = locations[locations.length - 1];
            console.log(`[BackgroundGPS] Location received: lat=${latest.coords.latitude}, lng=${latest.coords.longitude}, time=${new Date(latest.timestamp || Date.now()).toISOString()}`);
            await locationTracker.handleBackgroundLocationUpdate(latest);
          }
        }
      });
    }
  }
} catch (err) {
  console.warn('[BackgroundGPS] TaskManager unavailable; background service skipped:', err);
}
