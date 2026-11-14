import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Linking,
  ActivityIndicator,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '../../components/SafeLinearGradient';
import { TripFlowHeader } from '../../components/TripFlowHeader';
import { useTranslation } from 'react-i18next';
import { driverApiClient } from '../../lib/api';
import { locationTracker } from '../../lib/location-tracker';
import { reverseGeocodeAddress } from '../../lib/reverse-geocoding';
import { parseViaStops } from '../dashboard';
import {
  formatTripDateTime,
  parseCustomerRequirements,
  extractCustomerNotes,
} from '../../lib/tripRequirements';
import {
  setTripWaitingState,
  getTripWaitingState,
  clearTripWaitingState,
  WaitingSession,
} from '../../lib/tripState';

const formatTimerDisplay = (totalSecs: number) => {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatTimeOfDay = (date: Date = new Date()) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getOrdinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const formatSessionDuration = (totalSecs: number) => {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

export default function DriverTripActiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchTrip = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await driverApiClient.fetch('/api/driver/status');
      if (res.success && res.activeBooking && res.activeBooking.id === bookingId) {
        if (res.activeBooking.status !== 'TRIP_STARTED' && res.activeBooking.status !== 'IN_PROGRESS') {
          router.replace({ pathname: '/trip/start', params: { bookingId } });
          return;
        }
        setBooking(res.activeBooking);
      }
    } catch (err) {
      console.error('Failed to fetch active trip:', err);
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    fetchTrip();
    if (bookingId) {
      // Active-Trip tier GPS logging (every 10s into TripTracking)
      locationTracker.startActiveTripTracking(bookingId);
    }
  }, [bookingId, fetchTrip]);

  const openDropNavigation = () => {
    if (!booking) return;
    const hasCoords = typeof booking.dropLat === 'number' && typeof booking.dropLng === 'number';
    const targetQuery = hasCoords
      ? `${booking.dropLat},${booking.dropLng}`
      : encodeURIComponent(booking.dropAddress || '');

    const androidNavUrl = `google.navigation:q=${targetQuery}&mode=d`;
    const universalFallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetQuery}&travelmode=driving`;
    const iosUrl = `maps:0,0?q=${targetQuery}`;

    if (Platform.OS === 'android') {
      Linking.openURL(androidNavUrl).catch(() => {
        Linking.openURL(universalFallbackUrl).catch(() => {});
      });
    } else if (Platform.OS === 'ios') {
      Linking.openURL(iosUrl).catch(() => {
        Linking.openURL(universalFallbackUrl).catch(() => {});
      });
    } else {
      Linking.openURL(universalFallbackUrl).catch(() => {});
    }
  };

  const handleProceedToComplete = () => {
    const dropLoc = booking?.dropAddress || 'Destination Drop Location';
    Alert.alert(
      t('active_trip.confirm_destination_title'),
      t('active_trip.confirm_destination_msg', { dropLoc }),
      [
        {
          text: t('active_trip.cancel'),
          style: 'cancel',
        },
        {
          text: t('active_trip.confirm_and_complete'),
          onPress: () => {
            router.push({
              pathname: '/trip/complete',
              params: { bookingId: bookingId || booking?.id },
            });
          },
        },
      ]
    );
  };

  const handleCallKandyCabs = () => {
    Linking.openURL('tel:+919900887777');
  };

  const handleVehicleBreakdown = () => {
    Alert.alert(
      t('active_trip.emergency_report_title'),
      t('active_trip.emergency_report_msg'),
      [
        { text: t('active_trip.cancel'), style: 'cancel' },
        {
          text: t('active_trip.report_and_call'),
          style: 'destructive',
          onPress: async () => {
            try {
              const coords = locationTracker.getCurrentCoordinates();
              const lat = coords.lat ?? 0;
              const lng = coords.lng ?? 0;
              let landmark = 'Live Highway GPS Location';
              try {
                if (lat && lng) {
                  const addr = await reverseGeocodeAddress(lat, lng);
                  if (addr) landmark = addr;
                }
              } catch (e) {
                // ignore
              }

              // 1. Send live GPS breakdown incident to backend -> triggers Admin Siren & Modal
              await driverApiClient.fetch('/api/driver/trip/breakdown', {
                method: 'POST',
                body: JSON.stringify({
                  bookingId,
                  latitude: lat,
                  longitude: lng,
                  landmark,
                  issueType: 'VEHICLE_BREAKDOWN',
                  notes: 'Driver reported vehicle breakdown from active trip screen.',
                }),
              });

              // 2. Immediately trigger direct normal phone call to Admin Helpline
              Linking.openURL('tel:+919900887777');
            } catch (err: any) {
              console.error('Breakdown report error:', err);
              // Fallback to direct call on any network issue
              Linking.openURL('tel:+919900887777');
            }
          },
        },
      ]
    );
  };

  // Waiting Timer State
  const [isWaitingActive, setIsWaitingActive] = useState(false);
  const [isWaitingPaused, setIsWaitingPaused] = useState(false);
  const [totalAccumulatedSeconds, setTotalAccumulatedSeconds] = useState(0);
  const [activeRunningStartedAt, setActiveRunningStartedAt] = useState<number | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [currentSessionSeconds, setCurrentSessionSeconds] = useState(0);
  const [currentSessionStartTime, setCurrentSessionStartTime] = useState<string | null>(null);
  const [waitingSessions, setWaitingSessions] = useState<WaitingSession[]>([]);

  // Restore saved waiting state for this booking
  useEffect(() => {
    const id = bookingId || booking?.id;
    if (!id) return;
    const saved = getTripWaitingState(id);
    if (saved) {
      setIsWaitingActive(saved.isWaitingActive);
      setIsWaitingPaused(saved.isWaitingPaused);
      setTotalAccumulatedSeconds(saved.totalAccumulatedSeconds);
      setActiveRunningStartedAt(saved.activeRunningStartedAt);
      setCurrentSessionStartTime(saved.currentSessionStartTime);
      setWaitingSessions(saved.sessions || []);

      let initialSecs = saved.totalAccumulatedSeconds;
      let sessionSecs = 0;
      if (saved.isWaitingActive && !saved.isWaitingPaused && saved.activeRunningStartedAt) {
        sessionSecs = Math.max(0, Math.floor((Date.now() - saved.activeRunningStartedAt) / 1000));
        initialSecs += sessionSecs;
      }
      setCurrentSessionSeconds(sessionSecs);
      setDisplaySeconds(initialSecs);
    }
  }, [bookingId, booking?.id]);

  // Live timer interval
  useEffect(() => {
    let interval: any = null;
    if (isWaitingActive && !isWaitingPaused && activeRunningStartedAt) {
      const calcSecs = () => {
        const now = Date.now();
        const sessionElapsed = Math.max(0, Math.floor((now - activeRunningStartedAt) / 1000));
        setCurrentSessionSeconds(sessionElapsed);
        setDisplaySeconds(totalAccumulatedSeconds + sessionElapsed);
      };
      calcSecs();
      interval = setInterval(calcSecs, 1000);
    } else if (isWaitingPaused || !isWaitingActive) {
      setCurrentSessionSeconds(0);
      setDisplaySeconds(totalAccumulatedSeconds);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isWaitingActive, isWaitingPaused, activeRunningStartedAt, totalAccumulatedSeconds]);

  const handleStartWaiting = () => {
    const now = Date.now();
    const timeStr = formatTimeOfDay(new Date(now));
    setIsWaitingActive(true);
    setIsWaitingPaused(false);
    setActiveRunningStartedAt(now);
    setCurrentSessionStartTime(timeStr);
    setCurrentSessionSeconds(0);

    const id = bookingId || booking?.id;
    if (id) {
      setTripWaitingState(id, {
        isWaitingActive: true,
        isWaitingPaused: false,
        activeRunningStartedAt: now,
        currentSessionStartTime: timeStr,
      });
      driverApiClient.fetch('/api/driver/trip/waiting', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: id,
          action: 'START',
          isWaitingActive: true,
          isWaitingPaused: false,
          currentSessionStartTime: timeStr,
          totalAccumulatedSeconds,
          sessions: waitingSessions,
        }),
      }).catch(() => {});
    }
  };

  const handlePauseWaiting = () => {
    const now = Date.now();
    let additionalSecs = 0;
    if (activeRunningStartedAt) {
      additionalSecs = Math.max(0, Math.floor((now - activeRunningStartedAt) / 1000));
    }
    const newTotal = totalAccumulatedSeconds + additionalSecs;
    setTotalAccumulatedSeconds(newTotal);
    setDisplaySeconds(newTotal);
    setActiveRunningStartedAt(null);
    setIsWaitingPaused(true);

    const id = bookingId || booking?.id;
    if (id) {
      setTripWaitingState(id, {
        isWaitingActive: true,
        isWaitingPaused: true,
        totalAccumulatedSeconds: newTotal,
        activeRunningStartedAt: null,
      });
      driverApiClient.fetch('/api/driver/trip/waiting', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: id,
          action: 'PAUSE',
          isWaitingActive: true,
          isWaitingPaused: true,
          totalAccumulatedSeconds: newTotal,
          sessions: waitingSessions,
        }),
      }).catch(() => {});
    }
  };

  const handleContinueWaiting = () => {
    const now = Date.now();
    setActiveRunningStartedAt(now);
    setIsWaitingPaused(false);

    const id = bookingId || booking?.id;
    if (id) {
      setTripWaitingState(id, {
        isWaitingActive: true,
        isWaitingPaused: false,
        activeRunningStartedAt: now,
      });
      driverApiClient.fetch('/api/driver/trip/waiting', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: id,
          action: 'START',
          isWaitingActive: true,
          isWaitingPaused: false,
          totalAccumulatedSeconds,
          sessions: waitingSessions,
        }),
      }).catch(() => {});
    }
  };

  const handleStopWaiting = () => {
    const sessionNum = waitingSessions.length + 1;
    const sessionLabel = `${getOrdinal(sessionNum)} Waiting`;
    Alert.alert(
      `Stop ${sessionLabel}?`,
      `Do you want to stop and record the customer waiting time for ${sessionLabel.toLowerCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop & Record',
          style: 'default',
          onPress: () => {
            const now = Date.now();
            let sessionSecs = 0;
            if (activeRunningStartedAt && !isWaitingPaused) {
              sessionSecs = Math.max(0, Math.floor((now - activeRunningStartedAt) / 1000));
            }
            const finalTotal = totalAccumulatedSeconds + sessionSecs;
            const stopTimeStr = formatTimeOfDay(new Date(now));

            const newSession: WaitingSession = {
              id: String(Date.now()),
              startedAt: currentSessionStartTime || stopTimeStr,
              stoppedAt: stopTimeStr,
              durationSeconds: sessionSecs,
            };

            const updatedSessions = [...waitingSessions, newSession];

            setIsWaitingActive(false);
            setIsWaitingPaused(false);
            setActiveRunningStartedAt(null);
            setCurrentSessionStartTime(null);
            setCurrentSessionSeconds(0);
            setTotalAccumulatedSeconds(finalTotal);
            setDisplaySeconds(finalTotal);
            setWaitingSessions(updatedSessions);

            const id = bookingId || booking?.id;
            if (id) {
              setTripWaitingState(id, {
                isWaitingActive: false,
                isWaitingPaused: false,
                activeRunningStartedAt: null,
                currentSessionStartTime: null,
                totalAccumulatedSeconds: finalTotal,
                sessions: updatedSessions,
              });
              // Sync waiting time live to backend
              driverApiClient.fetch('/api/driver/trip/waiting', {
                method: 'POST',
                body: JSON.stringify({
                  bookingId: id,
                  action: 'STOP_RECORD',
                  isWaitingActive: false,
                  isWaitingPaused: false,
                  totalAccumulatedSeconds: finalTotal,
                  durationSeconds: finalTotal,
                  waitingMinutes: Math.round(finalTotal / 60),
                  sessions: updatedSessions,
                  startedAt: currentSessionStartTime || stopTimeStr,
                  stoppedAt: stopTimeStr,
                }),
              }).catch(() => {});
            }
          },
        },
      ]
    );
  };

  const handleResetWaiting = () => {
    Alert.alert(
      'Reset Waiting Timer?',
      'Are you sure you want to clear all waiting sessions and reset the timer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: () => {
            setIsWaitingActive(false);
            setIsWaitingPaused(false);
            setTotalAccumulatedSeconds(0);
            setActiveRunningStartedAt(null);
            setDisplaySeconds(0);
            setCurrentSessionSeconds(0);
            setCurrentSessionStartTime(null);
            setWaitingSessions([]);
            const id = bookingId || booking?.id;
            if (id) {
              clearTripWaitingState(id);
              driverApiClient.fetch('/api/driver/trip/waiting', {
                method: 'POST',
                body: JSON.stringify({
                  bookingId: id,
                  action: 'RESET',
                  isWaitingActive: false,
                  isWaitingPaused: false,
                  totalAccumulatedSeconds: 0,
                  waitingMinutes: 0,
                  sessions: [],
                }),
              }).catch(() => {});
            }
          },
        },
      ]
    );
  };

  if (loading || !booking) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* 6-Step Flow Header: 1. Verify (✓) -> 2. Start (✓) -> 3. Odometer (✓) -> 4. OTP (✓) -> 5. On Trip (Active) -> 6. Drop */}
      <TripFlowHeader currentStep={5} />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Destination Drop Point Card & Navigation (Top Placement) */}
        <View style={styles.dropCard}>
          <View style={styles.dropHeaderRow}>
            <Ionicons name="location-sharp" size={16} color="#059669" />
            <Text style={styles.dropCardLabel}>{t('active_trip.destination_drop_point')}</Text>
          </View>
          
          <Text style={styles.dropAddressText} numberOfLines={2}>
            {booking.dropAddress || 'Destination Drop Location'}
          </Text>

          {/* Stylized Map Canvas Preview */}
          <View style={styles.mapCanvas}>
            {/* Water Coastline Area */}
            <View style={styles.mapWaterArea} />

            {/* Stylized Roads */}
            <View style={styles.mapRoadH1} />
            <View style={styles.mapRoadH2} />
            <View style={styles.mapRoadDiag1} />
            <View style={styles.mapRoadDiag2} />

            {/* Curved Blue Route Polyline */}
            <View style={styles.mapRouteCurve1} />
            <View style={styles.mapRouteCurve2} />

            {/* Driver Navigation Marker */}
            <View style={styles.driverMarkerContainer}>
              <View style={styles.driverMarkerOuterRing}>
                <View style={styles.driverMarkerInner}>
                  <Ionicons name="navigate" size={14} color="#ffffff" style={{ transform: [{ rotate: '45deg' }] }} />
                </View>
              </View>
            </View>

            {/* Destination Pin Marker */}
            <View style={styles.destinationPinContainer}>
              <Ionicons name="location-sharp" size={28} color="#ef4444" />
            </View>

            {/* Destination Tag Pill */}
            <View style={styles.destinationTagPill}>
              <Ionicons name="flag" size={12} color="#2563eb" style={{ marginRight: 4 }} />
              <Text style={styles.destinationTagText} numberOfLines={1}>
                {booking.dropAddress || 'Destination'}
              </Text>
            </View>

            {/* Small Selectable Floating Open Navigation Button (Inside Map, No Arrow, Low Padding) */}
            <TouchableOpacity
              style={styles.floatingNavBtn}
              onPress={openDropNavigation}
              activeOpacity={0.82}
            >
              <Ionicons name="navigate" size={13} color="#ffffff" style={{ marginRight: 5 }} />
              <Text style={styles.floatingNavBtnText}>{t('active_trip.navigate_to_drop') || 'Navigate'}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Actions Row: Vehicle Breakdown & Call KandyCabs */}
          <View style={styles.emergencyActionsRow}>
            {/* Breakdown Button */}
            <TouchableOpacity
              style={styles.breakdownPillButton}
              onPress={handleVehicleBreakdown}
              activeOpacity={0.82}
            >
              <View style={styles.breakdownGradient}>
                <Ionicons name="warning" size={16} color="#e11d48" style={{ marginRight: 6 }} />
                <Text
                  style={styles.breakdownPillText}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                >
                  {t('active_trip.vehicle_breakdown', 'Breakdown')}
                </Text>
                <Ionicons name="chevron-forward" size={15} color="#be123c" />
              </View>
            </TouchableOpacity>

            {/* KandyCabs Helpline Button */}
            <TouchableOpacity
              style={styles.callSupportPillButton}
              onPress={handleCallKandyCabs}
              activeOpacity={0.82}
            >
              <View style={styles.callSupportGradient}>
                <Ionicons name="call" size={17} color="#059669" style={{ marginRight: 6 }} />
                <Text
                  style={styles.callSupportPillText}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                >
                  {t('active_trip.call_kandy_cabs', 'KandyCabs')}
                </Text>
                <Ionicons name="chevron-forward" size={15} color="#047857" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Customer Waiting Timer Section */}
          <View style={styles.waitingSectionWrapper}>
            <View
              style={[
                styles.waitingCardCompact,
                isWaitingActive && styles.waitingCardActiveBorder,
                waitingSessions.length > 0 && !isWaitingActive && styles.waitingCardRecordedBorder,
              ]}
            >
              {/* Header row: Status / Timer / Action Button */}
              <View style={styles.waitingHeaderRow}>
                <View style={styles.waitingTriggerLeft}>
                  <Ionicons
                    name={
                      isWaitingActive
                        ? 'time'
                        : waitingSessions.length > 0
                        ? 'checkmark-circle'
                        : 'time-outline'
                    }
                    size={22}
                    color={
                      isWaitingActive
                        ? '#2563eb'
                        : waitingSessions.length > 0
                        ? '#059669'
                        : '#d97706'
                    }
                    style={styles.waitingIconPlain}
                  />
                  <View style={styles.waitingTriggerTexts}>
                    <Text
                      style={[
                        styles.waitingTriggerTitle,
                        isWaitingActive && { color: '#1d4ed8' },
                        waitingSessions.length > 0 && !isWaitingActive && { color: '#047857' },
                      ]}
                    >
                      {isWaitingActive
                        ? `${getOrdinal(waitingSessions.length + 1)} Waiting in Progress`
                        : waitingSessions.length > 0
                        ? `Waiting Recorded (${waitingSessions.length})`
                        : 'Customer Waiting'}
                    </Text>
                    {isWaitingActive ? (
                      <View style={styles.waitingLiveTimerRow}>
                        <Text style={styles.waitingTimerBig}>
                          {formatTimerDisplay(currentSessionSeconds)}
                        </Text>
                        {totalAccumulatedSeconds > 0 && (
                          <Text style={styles.waitingTotalSubTimer}>
                            (Total: {formatTimerDisplay(displaySeconds)})
                          </Text>
                        )}
                      </View>
                    ) : totalAccumulatedSeconds > 0 ? (
                      <Text style={styles.waitingTotalBadgeText}>
                        Total: {formatTimerDisplay(totalAccumulatedSeconds)}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Actions on right */}
                <View style={styles.waitingActionsRight}>
                  {isWaitingActive ? (
                    <TouchableOpacity
                      style={styles.waitingStopBtnCompact}
                      onPress={handleStopWaiting}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="stop" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.waitingStopBtnTextCompact}>Stop</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.waitingStartBtnCompact}
                        onPress={handleStartWaiting}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="play" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                        <Text style={styles.waitingStartBtnTextCompact}>
                          {waitingSessions.length === 0
                            ? 'Start'
                            : `Start ${getOrdinal(waitingSessions.length + 1)}`}
                        </Text>
                      </TouchableOpacity>
                      {waitingSessions.length > 0 && (
                        <TouchableOpacity
                          style={styles.waitingResetBtnCompact}
                          onPress={handleResetWaiting}
                          activeOpacity={0.8}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="refresh" size={13} color="#64748b" />
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>

              {/* Recorded Sessions Breakdown (shows 1st waiting, 2nd waiting, etc.) */}
              {waitingSessions.length > 0 && (
                <View style={styles.waitingSessionsListWrap}>
                  {waitingSessions.map((s, idx) => (
                    <View key={s.id || String(idx)} style={styles.waitingSessionItemRow}>
                      <View style={styles.waitingSessionOrdinalBadge}>
                        <Text style={styles.waitingSessionOrdinalText}>
                          {getOrdinal(idx + 1)} Waiting
                        </Text>
                      </View>
                      <View style={styles.waitingSessionTimesCol}>
                        <View style={styles.waitingTimePillGroup}>
                          <Text style={styles.waitingTimeLabel}>Start: </Text>
                          <Text style={styles.waitingTimeValue}>{s.startedAt}</Text>
                          <Text style={styles.waitingTimeArrow}>  ➔  </Text>
                          <Text style={styles.waitingTimeLabel}>Stop: </Text>
                          <Text style={styles.waitingTimeValue}>{s.stoppedAt || '—'}</Text>
                        </View>
                      </View>
                      <View style={styles.waitingSessionDurationWrap}>
                        <Text style={styles.waitingSessionDurationText}>
                          {formatSessionDuration(s.durationSeconds)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Multi-Drop Route Stops Card (if customer selected multiple locations, placed below main destination) */}
        {booking && parseViaStops(booking).length > 0 && (
          <View style={styles.multiStopsCard}>
            <View style={styles.multiStopsHeaderRow}>
              <View style={styles.multiStopsHeaderLeft}>
                <Ionicons name="git-commit-outline" size={17} color="#d97706" />
                <Text style={styles.multiStopsHeaderTitle}>Customer Selected Multiple Locations</Text>
              </View>
            </View>

            <View style={styles.stopsTimelineWrap}>
              {/* Pickup */}
              <View style={styles.timelinePoint}>
                <View style={styles.timelinePickupDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineAddress}>{booking.pickupAddress}</Text>
                </View>
              </View>

              {/* Each Intermediate Stop */}
              {parseViaStops(booking).map((stopName: string, sIdx: number) => (
                <View key={`active-stop-${sIdx}`}>
                  <View style={styles.timelineConnector} />
                  <View style={styles.timelinePoint}>
                    <View style={styles.timelineViaBadge}>
                      <Text style={styles.timelineViaNum}>{sIdx + 1}</Text>
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <Text style={[styles.timelineAddressBold, { flex: 1 }]}>{stopName}</Text>
                        <TouchableOpacity
                          style={styles.navigateStopSmallBtn}
                          onPress={() => {
                            const query = encodeURIComponent(stopName);
                            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=driving`);
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="navigate" size={12} color="#2563eb" style={{ marginRight: 3 }} />
                          <Text style={styles.navigateStopSmallText}>Navigate</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              ))}

              {/* Final Drop */}
              <View style={styles.timelineConnector} />
              <View style={styles.timelinePoint}>
                <View style={styles.timelineDropDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineAddress}>{booking.dropAddress}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Pinned Bottom Complete CTA Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={styles.completeButtonWrap}
          onPress={handleProceedToComplete}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={['#059669', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.completeButtonGradient}
          >
            <Ionicons name="location-sharp" size={20} color="#ffffff" style={{ marginRight: 10 }} />
            <Text style={styles.completeButtonText}>{t('active_trip.reached_destination')}</Text>
            <Ionicons name="arrow-forward" size={20} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerDividerV: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 10,
  },
  headerTextCol: {
    flex: 1,
  },
  headerStepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  headerLiveRadarText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#16a34a',
    letterSpacing: 0.8,
  },
  headerMainTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 1,
    letterSpacing: -0.2,
  },
  headerRefCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  headerRefText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.2,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  telemetryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  telemetryIconCircle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  telemetryTextCol: {
    flex: 1,
  },
  telemetryTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1d63ed',
    letterSpacing: 0.2,
  },
  telemetrySubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  telemetryShieldBadge: {
    marginLeft: 8,
  },
  dropCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  dropHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dropCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  dropAddressText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  mapCanvas: {
    height: 220,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  mapWaterArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '32%',
    backgroundColor: '#dbeafe',
    borderTopRightRadius: 60,
    borderBottomRightRadius: 100,
    opacity: 0.85,
  },
  mapRoadH1: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    height: 7,
    backgroundColor: '#e2e8f0',
    transform: [{ rotate: '-8deg' }],
  },
  mapRoadH2: {
    position: 'absolute',
    top: 140,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: '#e2e8f0',
    transform: [{ rotate: '14deg' }],
  },
  mapRoadDiag1: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: '42%',
    width: 6,
    backgroundColor: '#e2e8f0',
    transform: [{ rotate: '28deg' }],
  },
  mapRoadDiag2: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    right: '25%',
    width: 5,
    backgroundColor: '#e2e8f0',
    transform: [{ rotate: '-32deg' }],
  },
  mapRouteCurve1: {
    position: 'absolute',
    top: 120,
    left: '40%',
    width: 72,
    height: 5,
    backgroundColor: '#2563eb',
    transform: [{ rotate: '-38deg' }],
    borderRadius: 3,
  },
  mapRouteCurve2: {
    position: 'absolute',
    top: 75,
    left: '52%',
    width: 78,
    height: 5,
    backgroundColor: '#2563eb',
    transform: [{ rotate: '-20deg' }],
    borderRadius: 3,
  },
  driverMarkerContainer: {
    position: 'absolute',
    top: 135,
    left: '38%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
  },
  driverMarkerOuterRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarkerInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1d63ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  destinationPinContainer: {
    position: 'absolute',
    top: 55,
    right: 140,
  },
  destinationTagPill: {
    position: 'absolute',
    top: 60,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: '45%',
  },
  destinationTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
  },
  floatingNavBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#1d63ed',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  highlightBlack: {
    color: '#0f172a',
    fontWeight: '800',
  },
  navButton: {
    backgroundColor: '#1d63ed',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#1d63ed',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  navBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navButtonWrap: {
    borderRadius: 25,
    backgroundColor: '#1d4ed8',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  navButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 25,
  },
  navIconSection: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDividerV: {
    width: 1.2,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 10,
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.1,
    flex: 1,
  },
  emergencyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  breakdownPillButton: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  breakdownGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 24,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fecdd3',
    height: 46,
  },
  breakdownDividerV: {
    width: 1,
    height: 18,
    backgroundColor: '#fca5a5',
    marginHorizontal: 8,
  },
  breakdownPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#881337',
    letterSpacing: -0.2,
    flex: 1,
  },
  callSupportPillButton: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  callSupportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    height: 46,
  },
  callSupportDividerV: {
    width: 1,
    height: 18,
    backgroundColor: '#86efac',
    marginHorizontal: 8,
  },
  callSupportPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#064e3b',
    letterSpacing: -0.2,
    flex: 1,
  },
  waitingSectionWrapper: {
    marginTop: 10,
  },
  waitingCardCompact: {
    flexDirection: 'column',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fde68a',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  waitingCardActiveBorder: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  waitingCardRecordedBorder: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ffffff',
  },
  waitingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  waitingTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  waitingIconPlain: {
    marginRight: 10,
  },
  waitingTriggerTexts: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  waitingTriggerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
    letterSpacing: -0.2,
  },
  waitingLiveTimerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  waitingTimerBig: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  waitingTotalSubTimer: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  waitingTotalBadgeText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
    fontVariant: ['tabular-nums'],
  },
  waitingTriggerSub: {
    fontSize: 11,
    color: '#78350f',
    fontWeight: '500',
    marginTop: 2,
  },
  waitingActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waitingStartBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d97706',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  waitingStartBtnTextCompact: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  waitingStopBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  waitingStopBtnTextCompact: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  waitingPauseBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  waitingPauseBtnTextCompact: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '800',
  },
  waitingResumeBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d97706',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  waitingResumeBtnTextCompact: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  waitingFinishBtnCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  waitingResetBtnCompact: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  waitingActiveSessionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 8,
    gap: 6,
  },
  waitingActivePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  waitingActiveBannerText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1e40af',
  },
  waitingSessionsListWrap: {
    marginTop: 8,
  },
  waitingSessionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  waitingSessionOrdinalBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  waitingSessionOrdinalText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0369a1',
  },
  waitingSessionTimesCol: {
    flex: 1,
  },
  waitingTimePillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  waitingTimeLabel: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
  },
  waitingTimeValue: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '700',
  },
  waitingTimeArrow: {
    fontSize: 10.5,
    color: '#94a3b8',
    marginHorizontal: 2,
  },
  waitingSessionDurationWrap: {
    paddingLeft: 6,
  },
  waitingSessionDurationText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  metaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  metaItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  metaDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  metaLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaIconCircle: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLabel: {
    fontSize: 13.5,
    color: '#64748b',
    fontWeight: '600',
  },
  passengerRightCol: {
    alignItems: 'flex-end',
  },
  passengerNameText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  passengerCallCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 5,
    marginTop: 4,
  },
  passengerCallText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '800',
  },
  passengerLockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  passengerLockedText: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '600',
  },
  tripTypeVal: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ea580c',
  },
  pickupRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 10,
  },
  pickupLocationVal: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  odometerVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  odometerKmUnit: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0f172a',
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  destinationGuidanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 12,
  },
  guidanceIconCircleGreen: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceDividerV: {
    width: 1.2,
    height: 20,
    backgroundColor: '#10b981',
    marginHorizontal: 10,
  },
  destinationGuidanceText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
    flex: 1,
    fontWeight: '500',
  },
  highlightWhite: {
    color: '#0f172a',
    fontWeight: '800',
  },
  highlightGreenInline: {
    color: '#059669',
    fontWeight: '900',
  },
  completeButtonWrap: {
    borderRadius: 28,
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  completeButtonGradient: {
    height: 50,
    borderRadius: 28,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeDividerV: {
    width: 1.2,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 12,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'left',
  },
  multiStopsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  multiStopsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
  },
  multiStopsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  multiStopsHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  multiStopsCountPill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  multiStopsCountText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#b45309',
  },
  stopsTimelineWrap: {
    paddingLeft: 4,
  },
  timelinePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelinePickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16a34a',
    marginTop: 2,
    marginLeft: 3,
  },
  timelineViaBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineViaNum: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#92400e',
  },
  timelineDropDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#dc2626',
    marginTop: 2,
    marginLeft: 3,
  },
  timelineConnector: {
    width: 2,
    height: 18,
    backgroundColor: '#fde68a',
    marginLeft: 8,
    marginVertical: 3,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#16a34a',
    textTransform: 'uppercase',
  },
  timelineViaLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#b45309',
    textTransform: 'uppercase',
  },
  timelineDropLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#dc2626',
    textTransform: 'uppercase',
  },
  timelineAddress: {
    fontSize: 12.5,
    color: '#334155',
    fontWeight: '600',
    marginTop: 1,
  },
  timelineAddressBold: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
    marginTop: 2,
  },
  navigateStopSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  navigateStopSmallText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  tripDateValBold: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  todayPillActive: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginTop: 3,
  },
  todayPillActiveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#15803d',
  },
  reqsHeadingActive: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  reqPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  reqPillHighlightActive: {},
  reqPillWarningActive: {},
  reqPillInfoActive: {},
  reqLineSeparatorActive: {
    width: 1,
    height: 12,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  reqPillTextActive: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  reqPillTextHighlightActive: {
    color: '#9a3412',
  },
  reqPillTextWarningActive: {
    color: '#92400e',
  },
  reqPillTextInfoActive: {
    color: '#1d4ed8',
  },
  notesBoxActive: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  notesTextActive: {
    flex: 1,
    fontSize: 11,
    fontStyle: 'italic',
    color: '#475569',
  },
});
