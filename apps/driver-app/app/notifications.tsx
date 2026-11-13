import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { driverApiClient } from '../lib/api';
import * as SecureStore from 'expo-secure-store';
import { getExpiringDocuments } from '../lib/documentExpiry';
import { formatTripDateTime } from '../lib/tripRequirements';

export interface NotificationItem {
  id: string;
  type: 'DISPATCH' | 'TRIP' | 'KYC' | 'DUTY' | 'SYSTEM';
  title: string;
  message: string;
  subMessage?: string;
  timestamp: string;
  isRead: boolean;
  actionText?: string;
  payload?: any;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'DISPATCH' | 'TRIP' | 'SYSTEM'>('ALL');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const [dispatches, setDispatches] = useState<any[]>([]);
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [driver, setDriver] = useState<any>(null);
  const [onlineStatus, setOnlineStatus] = useState(false);

  // Load persisted read notification IDs
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('kandy_read_notifications');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setReadIds(new Set(parsed));
          }
        }
      } catch (_) {}
    })();
  }, []);

  const persistReadIds = async (newSet: Set<string>) => {
    try {
      await SecureStore.setItemAsync('kandy_read_notifications', JSON.stringify(Array.from(newSet)));
    } catch (_) {}
  };

  const fetchNotificationData = useCallback(async () => {
    try {
      const [statusRes, dispatchRes] = await Promise.all([
        driverApiClient.fetch('/api/driver/status').catch(() => null),
        driverApiClient.fetch('/api/driver/dispatches').catch(() => null),
      ]);

      if (statusRes?.success && statusRes?.driver) {
        setDriver(statusRes.driver);
        setOnlineStatus(Boolean(statusRes.driver.onlineStatus));
        setActiveBooking(statusRes.activeBooking || null);
        setUpcomingBookings(statusRes.upcomingBookings || []);
      }

      if (dispatchRes?.success && Array.isArray(dispatchRes.dispatches)) {
        setDispatches(dispatchRes.dispatches);
      }
    } catch (err) {
      console.warn('[Notifications] Fetch failed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotificationData();
  }, [fetchNotificationData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotificationData();
  }, [fetchNotificationData]);

  // Construct notifications list
  const notifications: NotificationItem[] = useMemo(() => {
    const list: NotificationItem[] = [];

    // 1. Pending Dispatches
    dispatches.forEach((d) => {
      const b = d?.booking || {};
      const tripTiming = formatTripDateTime(b?.scheduledAt);
      const tripDayLabel = tripTiming.isToday
        ? t('notifications_screen.today_time', { time: tripTiming.timeText, defaultValue: `today (${tripTiming.timeText})` })
        : tripTiming.isTomorrow
        ? t('notifications_screen.tomorrow_time', { time: tripTiming.timeText, defaultValue: `tomorrow (${tripTiming.timeText})` })
        : t('notifications_screen.on_date_time', { date: tripTiming.dateText, time: tripTiming.timeText, defaultValue: `on ${tripTiming.dateText} (${tripTiming.timeText})` });

      list.push({
        id: `dispatch-${d.id}`,
        type: 'DISPATCH',
        title: t('notifications_screen.dispatch_waiting_title', { ref: b.humanReadableRef || 'New Ride', defaultValue: `⚠️ Ride Waiting for Approval • ${b.humanReadableRef || 'New Ride'}` }),
        message: t('notifications_screen.dispatch_waiting_msg', { dayLabel: tripDayLabel, defaultValue: `Waiting for approval! Hurry up, the trip is ${tripDayLabel}!` }),
        subMessage: `${b.pickupAddress || t('notifications_screen.pickup_loc', 'Pickup Location')} ➔ ${b.dropAddress || t('notifications_screen.drop_loc', 'Destination')}${b.distanceKm ? ' • ' + b.distanceKm + ' km' : ''}`,
        timestamp: d.broadcastAt || d.createdAt || new Date().toISOString(),
        isRead: readIds.has(`dispatch-${d.id}`),
        actionText: t('notifications_screen.view_and_accept', 'View & Accept'),
        payload: { dispatchId: d.id, bookingId: b.id },
      });
    });

    // 2. Active Trip
    if (activeBooking) {
      const isTripInProcess =
        activeBooking.status === 'TRIP_STARTED' ||
        activeBooking.status === 'IN_PROGRESS';
      const tripTiming = formatTripDateTime(activeBooking.scheduledAt);
      const timeStr = tripTiming.timeText || new Date(activeBooking.scheduledAt || activeBooking.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      list.push({
        id: `trip-active-${activeBooking.id}`,
        type: 'TRIP',
        title: isTripInProcess
          ? t('notifications_screen.active_trip_title', { ref: activeBooking.humanReadableRef || '', defaultValue: `Active Trip in Progress • ${activeBooking.humanReadableRef || ''}` })
          : t('notifications_screen.trip_today_title', { ref: activeBooking.humanReadableRef || '', defaultValue: `⚠️ Trip Today: Be Ready • ${activeBooking.humanReadableRef || ''}` }),
        message: isTripInProcess
          ? `${activeBooking.pickupAddress || t('notifications_screen.pickup_loc', 'Pickup')} ➔ ${activeBooking.dropAddress || t('notifications_screen.drop_loc', 'Destination')}`
          : t('notifications_screen.pickup_today_msg', { time: timeStr, defaultValue: `Pickup scheduled for Today (${timeStr}) — Please be ready for departure!` }),
        subMessage: `Status: ${activeBooking.status || 'ON_ROUTE'}${activeBooking.customer?.user?.fullName ? ' • ' + t('notifications_screen.passenger', 'Passenger') + ': ' + activeBooking.customer.user.fullName : ''}`,
        timestamp: activeBooking.updatedAt || activeBooking.createdAt || new Date().toISOString(),
        isRead: readIds.has(`trip-active-${activeBooking.id}`),
        actionText: isTripInProcess ? t('notifications_screen.open_trip', 'Open Trip') : t('notifications_screen.start_trip', 'Start Trip'),
        payload: { bookingId: activeBooking.id },
      });
    }

    // 3. Upcoming Bookings
    upcomingBookings.forEach((ub) => {
      const tripTiming = formatTripDateTime(ub.scheduledAt);
      const timeStr = tripTiming.timeText || (ub.scheduledAt ? new Date(ub.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Scheduled');
      const dayLabel = tripTiming.isToday
        ? t('notifications_screen.today_time', { time: timeStr, defaultValue: `today (${timeStr})` })
        : tripTiming.isTomorrow
        ? t('notifications_screen.tomorrow_time', { time: timeStr, defaultValue: `tomorrow (${timeStr})` })
        : `${tripTiming.dateText} (${timeStr})`;

      list.push({
        id: `trip-upcoming-${ub.id}`,
        type: 'TRIP',
        title: tripTiming.isToday
          ? t('notifications_screen.upcoming_trip_today_title', { ref: ub.humanReadableRef || '', defaultValue: `⚠️ Upcoming Trip Today • ${ub.humanReadableRef || ''}` })
          : t('notifications_screen.confirmed_upcoming_title', { ref: ub.humanReadableRef || '', defaultValue: `Confirmed Upcoming Booking • ${ub.humanReadableRef || ''}` }),
        message: tripTiming.isToday
          ? t('notifications_screen.pickup_scheduled_today_msg', { time: timeStr, defaultValue: `Pickup scheduled for Today (${timeStr}) — Be ready today!` })
          : t('notifications_screen.pickup_scheduled_msg', { dayLabel: dayLabel, defaultValue: `Pickup scheduled for ${dayLabel}` }),
        subMessage: `${ub.pickupAddress || t('notifications_screen.pickup_loc', 'Pickup location')}`,
        timestamp: ub.createdAt || new Date().toISOString(),
        isRead: readIds.has(`trip-upcoming-${ub.id}`),
        actionText: t('notifications_screen.trip_details', 'Trip Details'),
        payload: { bookingId: ub.id },
      });
    });

    // 4. KYC Status & Auto Expiry Document Reminders
    if (driver) {
      const isApproved = driver.verificationStatus === 'APPROVED';
      const isRejected = driver.verificationStatus === 'REJECTED';
      const kycNotifId = `kyc-status-${driver.id || 'driver'}-${driver.verificationStatus || 'PENDING'}`;
      list.push({
        id: kycNotifId,
        type: 'KYC',
        title: isRejected
          ? t('notifications_screen.kyc_rejected_title', 'KYC Verification Rejected by Admin')
          : isApproved
          ? t('notifications_screen.driver_verified_title', 'Driver Profile Verified & Active')
          : t('notifications_screen.profile_review_title', 'Profile Under Review by Admin'),
        message: isRejected
          ? t('notifications_screen.reason_from_admin', { reason: driver.rejectionReason || t('notifications_screen.rejection_fallback_reason', 'Please fix and re-upload required documents'), defaultValue: `Reason from Admin: ${driver.rejectionReason || 'Please fix and re-upload required documents'}` })
          : isApproved
          ? t('notifications_screen.driver_verified_msg', 'Your driver documents are approved. You are ready to accept rides from Admin.')
          : t('notifications_screen.profile_under_review_msg', 'Your driver profile is currently under review by Admin.'),
        subMessage: isRejected
          ? t('notifications_screen.action_required_sub', 'Action required: Tap to update details and re-submit')
          : t('notifications_screen.license_vehicle_sub', { license: driver.licenseNumber || 'Active', vehicle: driver?.vehicle?.plateNumber || 'KA-01-SD-2002', defaultValue: `License: ${driver.licenseNumber || 'Active'} • Vehicle: ${driver?.vehicle?.plateNumber || 'KA-01-SD-2002'}` }),
        timestamp: new Date().toISOString(),
        isRead: readIds.has(kycNotifId),
        actionText: isApproved ? undefined : isRejected ? t('notifications_screen.fix_documents', 'Fix Documents') : t('notifications_screen.view_documents', 'View Documents'),
      });

      // 4b. Auto Expiring Documents Notifications (Active until updated with a renewed date)
      const expiringDocs = Array.isArray(driver.expiringDocuments)
        ? driver.expiringDocuments
        : (driver.docDates ? getExpiringDocuments(driver.docDates, 5) : []);

      expiringDocs.forEach((ed: any) => {
        const isExp = ed.status === 'EXPIRED';
        const notifId = `doc-expiry-${ed.docKey}-${ed.validTo}`;
        list.push({
          id: notifId,
          type: 'KYC',
          title: isExp
            ? t('notifications_screen.doc_expired_title', { name: ed.docName, defaultValue: `🚨 Document Expired: ${ed.docName}` })
            : t('notifications_screen.doc_expiring_soon_title', { name: ed.docName, defaultValue: `⚠️ Document Expiring Soon: ${ed.docName}` }),
          message: isExp
            ? t('notifications_screen.doc_expired_msg', { name: ed.docName, date: ed.expiryDateFormatted, defaultValue: `Your ${ed.docName} expired on ${ed.expiryDateFormatted}. Commercial vehicle compliance requires an active document. Please upload the renewed copy immediately.` })
            : t('notifications_screen.doc_expiring_soon_msg', { name: ed.docName, date: ed.expiryDateFormatted, label: ed.label, defaultValue: `Your ${ed.docName} expires on ${ed.expiryDateFormatted} (${ed.label}). Please upload the renewed copy before it expires to avoid dispatch suspension.` }),
          subMessage: t('notifications_screen.doc_sub', { name: ed.docName, defaultValue: `Document: ${ed.docName}` }) + (ed.docNumber ? ' • No: ' + ed.docNumber : ''),
          timestamp: new Date().toISOString(),
          isRead: readIds.has(notifId),
          actionText: t('notifications_screen.update_now', 'Update Now'),
          payload: { isExpiry: true, route: '/documents' },
        });
      });
    }

    // 5. Duty Status
    list.push({
      id: `duty-status-${onlineStatus ? 'online' : 'offline'}`,
      type: 'DUTY',
      title: onlineStatus
        ? t('notifications_screen.online_title', 'ONLINE: Currently ON-DUTY')
        : t('notifications_screen.offline_title', 'OFFLINE: Currently OFF-DUTY'),
      message: onlineStatus
        ? t('notifications_screen.online_msg', 'Direct Admin dispatches and radar broadcasts are active for your vehicle.')
        : t('notifications_screen.offline_msg', 'Go On-Duty from the Home screen whenever you are ready to receive ride assignments.'),
      timestamp: new Date().toISOString(),
      isRead: readIds.has(`duty-status-${onlineStatus ? 'online' : 'offline'}`),
    });

    return list;
  }, [dispatches, activeBooking, upcomingBookings, driver, onlineStatus, readIds, t]);

  const filteredNotifications = useMemo(() => {
    if (selectedFilter === 'ALL') return notifications;
    if (selectedFilter === 'DISPATCH') return notifications.filter((n) => n.type === 'DISPATCH');
    if (selectedFilter === 'TRIP') return notifications.filter((n) => n.type === 'TRIP');
    if (selectedFilter === 'SYSTEM') return notifications.filter((n) => n.type === 'KYC' || n.type === 'DUTY' || n.type === 'SYSTEM');
    return notifications;
  }, [notifications, selectedFilter]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const handleMarkAllRead = () => {
    const allIds = new Set<string>(notifications.map((n) => n.id));
    setReadIds(allIds);
    persistReadIds(allIds);
  };

  const handleItemPress = (item: NotificationItem) => {
    const updated = new Set([...readIds, item.id]);
    setReadIds(updated);
    persistReadIds(updated);

    if (item.type === 'DISPATCH') {
      router.replace('/dashboard');
    } else if (item.type === 'TRIP') {
      if (item.payload?.bookingId) {
        router.push({ pathname: '/trip/active', params: { bookingId: item.payload.bookingId } });
      } else {
        router.replace('/dashboard');
      }
    } else if (item.type === 'KYC') {
      router.push('/documents');
    }
  };

  const renderTypeIcon = (item: NotificationItem) => {
    if (item.payload?.isExpiry) {
      return <Ionicons name="warning" size={20} color="#ea580c" />;
    }
    switch (item.type) {
      case 'DISPATCH':
        return <Ionicons name="car-sport" size={20} color="#ea580c" />;
      case 'TRIP':
        return <Ionicons name="navigate-circle" size={20} color="#2563eb" />;
      case 'KYC':
        return <Ionicons name="shield-checkmark" size={20} color="#16a34a" />;
      case 'DUTY':
        return <Ionicons name="radio" size={20} color="#059669" />;
      default:
        return <Ionicons name="information-circle" size={20} color="#64748b" />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#162232" translucent={false} />

      {/* Top Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{t('notifications_screen.title', 'Notifications')}</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadCountBadge}>
              <Text style={styles.unreadCountText}>{t('notifications_screen.new_count', { count: unreadCount, defaultValue: `${unreadCount} new` })}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadButton} activeOpacity={0.7}>
            <Text style={styles.markReadText}>{t('notifications_screen.mark_read', 'Mark Read')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {(['ALL', 'DISPATCH', 'TRIP', 'SYSTEM'] as const).map((tab) => {
          const isActive = selectedFilter === tab;
          const labels = {
            ALL: t('notifications_screen.filter_all', 'All'),
            DISPATCH: t('notifications_screen.filter_dispatches', { count: dispatches.length, defaultValue: `Dispatches (${dispatches.length})` }),
            TRIP: t('notifications_screen.filter_rides', 'Rides'),
            SYSTEM: t('notifications_screen.filter_system', 'System'),
          };
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => setSelectedFilter(tab)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {labels[tab]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notifications List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={styles.loadingText}>{t('notifications_screen.loading', 'Loading notifications...')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />}
        >
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={44} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>{t('notifications_screen.empty_title', 'All Caught Up!')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('notifications_screen.empty_sub', 'No new notifications or trip updates at this moment.')}
              </Text>
            </View>
          ) : (
            filteredNotifications.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.notificationCard, !item.isRead && styles.notificationCardUnread]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.8}
              >
                <View style={styles.iconCircle}>{renderTypeIcon(item)}</View>

                <View style={styles.cardContent}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {!item.isRead && <View style={styles.unreadDot} />}
                  </View>

                  <Text style={styles.cardMessage} numberOfLines={2}>
                    {item.message}
                  </Text>

                  {item.subMessage && (
                    <Text style={styles.cardSubMessage} numberOfLines={1}>
                      {item.subMessage}
                    </Text>
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={styles.cardTime}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>

                    {item.actionText && (
                      <View style={styles.actionBtnPill}>
                        <Text style={styles.actionBtnText}>{item.actionText}</Text>
                        <Ionicons name="chevron-forward" size={13} color="#ea580c" />
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#162232',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'android' ? 12 : 10,
  },
  backButton: {
    padding: 6,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  unreadCountBadge: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadCountText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  markReadButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markReadText: {
    color: '#ea580c',
    fontSize: 13,
    fontWeight: '700',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: '#162232',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  notificationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  notificationCardUnread: {
    borderColor: '#fed7aa',
    backgroundColor: '#fffbf5',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ea580c',
  },
  cardMessage: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 4,
  },
  cardSubMessage: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  actionBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ea580c',
    marginRight: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
});

