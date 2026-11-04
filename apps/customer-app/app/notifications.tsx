import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { customerApiClient } from '../lib/api';

const READ_NOTIFS_STORAGE_KEY = 'kandy_customer_read_notifs_v1';
const DISMISSED_NOTIFS_STORAGE_KEY = 'kandy_customer_dismissed_notifs_v1';

export interface NotificationItem {
  id: string;
  type:
    | 'WELCOME'
    | 'OFFER'
    | 'DRIVER_ASSIGNED'
    | 'DRIVER_EN_ROUTE'
    | 'DRIVER_ARRIVED'
    | 'TRIP_STARTED'
    | 'TRIP_COMPLETED'
    | 'BOOKING_RECEIVED'
    | 'ADMIN_ANNOUNCEMENT';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  category: 'ALL' | 'RIDES' | 'OFFERS';
  actionUrl?: string;
  actionLabel?: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  bookingRef?: string;
  otp?: string;
}

// Built-in initial notifications in case of offline/guest mode
const FALLBACK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'fallback-welcome-install',
    type: 'WELCOME',
    title: 'Thank You for Installing Kandy Cabs!',
    message: 'Welcome to Karnataka’s #1 intercity & airport taxi platform. Enjoy transparent flat fares, no surge charges, and 24/7 verified chauffeurs.',
    timestamp: new Date().toISOString(),
    read: false,
    category: 'ALL',
    actionUrl: '/',
    actionLabel: 'Book a Ride Now',
    icon: 'heart',
    iconColor: '#e11d48',
    iconBg: '#fff1f2',
  },
  {
    id: 'fallback-welcome-back',
    type: 'WELCOME',
    title: 'Welcome Back to Kandy Cabs!',
    message: 'Planning your next travel? Reserve verified AC cabs for One-Way intercity drops, Round Trips, or Airport transfers across Mangaluru & Bengaluru.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    read: false,
    category: 'ALL',
    actionUrl: '/',
    actionLabel: 'Explore Cabs',
    icon: 'sparkles',
    iconColor: '#0284c7',
    iconBg: '#f0f9ff',
  },
  {
    id: 'fallback-offer-airport',
    type: 'OFFER',
    title: 'There is an Offer: 10% OFF Airport Transfers',
    message: 'Special Airport Savings! Get flat 10% discount on Mangaluru (IXE) & Bengaluru (BLR) Airport pickups & drops. Use code FLYKANDY at booking.',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    read: false,
    category: 'OFFERS',
    actionUrl: '/',
    actionLabel: 'Book Airport Cab',
    icon: 'gift',
    iconColor: 'rgb(240, 117, 15)',
    iconBg: '#fff7ed',
  },
  {
    id: 'fallback-ride-ready',
    type: 'DRIVER_ARRIVED',
    title: 'Driver Details & Proximity Alerts',
    message: 'Whenever a driver is allocated to your booking, live updates with their photo, vehicle number, arrival distance, and Ride OTP will appear here.',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    read: true,
    category: 'RIDES',
    actionUrl: '/my-bookings',
    actionLabel: 'View Bookings',
    icon: 'shield-checkmark',
    iconColor: '#059669',
    iconBg: '#ecfdf5',
  },
];

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'ALL' | 'RIDES' | 'OFFERS'>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Load read notification IDs from local storage
  const loadReadIds = async (): Promise<Set<string>> => {
    try {
      const stored = await SecureStore.getItemAsync(READ_NOTIFS_STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) {
          const idSet = new Set<string>(ids);
          setReadIds(idSet);
          return idSet;
        }
      }
    } catch (e) {
      // Ignore storage error
    }
    return new Set<string>();
  };

  const persistReadIds = async (ids: Set<string>) => {
    try {
      await SecureStore.setItemAsync(READ_NOTIFS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
    } catch (e) {
      // Ignore storage error
    }
  };

  // Load dismissed notification IDs from local storage
  const loadDismissedIds = async (): Promise<Set<string>> => {
    try {
      const stored = await SecureStore.getItemAsync(DISMISSED_NOTIFS_STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) {
          const idSet = new Set<string>(ids);
          setDismissedIds(idSet);
          return idSet;
        }
      }
    } catch (e) {
      // Ignore storage error
    }
    return new Set<string>();
  };

  const persistDismissedIds = async (ids: Set<string>) => {
    try {
      await SecureStore.setItemAsync(DISMISSED_NOTIFS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
    } catch (e) {
      // Ignore storage error
    }
  };

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [currentReadIds, currentDismissedIds] = await Promise.all([
        loadReadIds(),
        loadDismissedIds(),
      ]);

      const res: any = await customerApiClient.fetch('/api/customer/notifications');
      if (res && res.success && Array.isArray(res.notifications) && res.notifications.length > 0) {
        const mapped = res.notifications
          .filter((n: NotificationItem) => !currentDismissedIds.has(n.id))
          .map((n: NotificationItem) => ({
            ...n,
            read: currentReadIds.has(n.id) || n.read,
          }));
        setNotifications(mapped);
      } else {
        // Fallback to initial notifications
        const fallbackMapped = FALLBACK_NOTIFICATIONS
          .filter((n) => !currentDismissedIds.has(n.id))
          .map((n) => ({
            ...n,
            read: currentReadIds.has(n.id) || n.read,
          }));
        setNotifications(fallbackMapped);
      }
    } catch (err) {
      // Offline fallback
      const [currentReadIds, currentDismissedIds] = await Promise.all([
        loadReadIds(),
        loadDismissedIds(),
      ]);
      const fallbackMapped = FALLBACK_NOTIFICATIONS
        .filter((n) => !currentDismissedIds.has(n.id))
        .map((n) => ({
          ...n,
          read: currentReadIds.has(n.id) || n.read,
        }));
      setNotifications(fallbackMapped);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark single notification as read
  const handleMarkAsRead = (id: string, actionUrl?: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistReadIds(next);
      return next;
    });

    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );

    if (actionUrl) {
      router.push(actionUrl as any);
    }
  };

  // Dismiss single notification
  const handleDismissNotification = (id: string, e?: any) => {
    e?.stopPropagation?.();
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistDismissedIds(next);
      return next;
    });
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    persistReadIds(allIds);
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  // Format relative time helper
  const formatTimeAgo = (isoDate: string): string => {
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 2) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'ALL') return notifications;
    if (activeTab === 'RIDES') return notifications.filter((n) => n.category === 'RIDES');
    if (activeTab === 'OFFERS') return notifications.filter((n) => n.category === 'OFFERS');
    return notifications;
  }, [notifications, activeTab]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read && !readIds.has(n.id)).length,
    [notifications, readIds]
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={true} />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topInset + 6 }]}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color="rgb(22, 34, 50)" />
          </TouchableOpacity>

          <View style={styles.headerTitleCol}>
            <View style={styles.titleWithBadgeRow}>
              <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit={true}>
                {t('notifications.title', { defaultValue: 'Notifications' })}
              </Text>
              {unreadCount > 0 && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountText}>{unreadCount} New</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>Live ride updates, offers & alerts</Text>
          </View>

          <View style={styles.headerRightActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={styles.markAllBtn}
                onPress={handleMarkAllAsRead}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-done" size={18} color="rgb(240, 117, 15)" />
                <Text style={styles.markAllBtnText}>Read all</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.headerCloseBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="rgb(22, 34, 50)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Tabs */}
        <View style={[styles.tabBar, isSmallDevice && { paddingHorizontal: 6 }]}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'ALL' && styles.tabItemActive]}
            onPress={() => setActiveTab('ALL')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="albums-outline"
              size={15}
              color={activeTab === 'ALL' ? '#ffffff' : '#64748b'}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.tabItemText, activeTab === 'ALL' && styles.tabItemTextActive]} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.75}>
              {t('notifications.all', { defaultValue: 'All' })} ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'RIDES' && styles.tabItemActive]}
            onPress={() => setActiveTab('RIDES')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="car-sport-outline"
              size={15}
              color={activeTab === 'RIDES' ? '#ffffff' : '#64748b'}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.tabItemText, activeTab === 'RIDES' && styles.tabItemTextActive]} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.75}>
              {t('notifications.rides', { defaultValue: 'Rides' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'OFFERS' && styles.tabItemActive]}
            onPress={() => setActiveTab('OFFERS')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="gift-outline"
              size={15}
              color={activeTab === 'OFFERS' ? '#ffffff' : '#64748b'}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.tabItemText, activeTab === 'OFFERS' && styles.tabItemTextActive]} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.75}>
              {t('notifications.offers', { defaultValue: 'Offers' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="rgb(22, 34, 50)" />
          <Text style={styles.loadingText}>Fetching updates & alerts...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 36) },
            isSmallDevice && { paddingHorizontal: 10 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(true)}
              colors={['rgb(240, 117, 15)', 'rgb(22, 34, 50)']}
              tintColor="rgb(240, 117, 15)"
            />
          }
        >
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={38} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>No Notifications Found</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'RIDES'
                  ? 'Active driver arrivals and ride tracking alerts will appear here.'
                  : activeTab === 'OFFERS'
                  ? 'Exclusive outstation discounts and promo announcements will appear here.'
                  : "You're all caught up! New updates on your rides and promotions will be listed here."}
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => router.push('/')}
                activeOpacity={0.8}
              >
                <Ionicons name="car-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.emptyActionBtnText}>Explore Cabs & Travel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mainFeedBox}>
              {filteredNotifications.map((notif, index) => {
                const isUnread = !notif.read && !readIds.has(notif.id);

                return (
                  <View key={notif.id}>
                    <TouchableOpacity
                      style={[styles.notifCard, isUnread && styles.notifCardUnread]}
                      onPress={() => handleMarkAsRead(notif.id, notif.actionUrl)}
                      activeOpacity={0.85}
                    >
                      {/* Top Header Row: Icon + Tag/Time & Title */}
                      <View style={styles.notifHeaderRow}>
                        <View style={styles.notifIconCircle}>
                          <Ionicons
                            name={(notif.icon as any) || 'notifications'}
                            size={30}
                            color={notif.iconColor || 'rgb(22, 34, 50)'}
                          />
                        </View>

                        <View style={styles.notifHeaderContent}>
                          {/* Top Meta: Category Tag & Timestamp */}
                          <View style={styles.notifMetaRow}>
                            <View style={styles.notifTagPill}>
                              <Text style={styles.notifTagText}>
                                {notif.type === 'OFFER'
                                  ? 'PROMOTION'
                                  : notif.type === 'WELCOME'
                                  ? 'WELCOME'
                                  : notif.type === 'DRIVER_ARRIVED'
                                  ? 'DRIVER REACHED'
                                  : notif.type === 'DRIVER_EN_ROUTE'
                                  ? 'DRIVER EN ROUTE'
                                  : notif.type === 'DRIVER_ASSIGNED'
                                  ? 'DRIVER DETAILS'
                                  : notif.type === 'TRIP_STARTED'
                                  ? 'ON TRIP'
                                  : notif.type === 'TRIP_COMPLETED'
                                  ? 'COMPLETED'
                                  : 'UPDATE'}
                              </Text>
                            </View>

                            <View style={styles.notifTimeWrapper}>
                              <Text style={styles.notifTimeText}>{formatTimeAgo(notif.timestamp)}</Text>
                              {isUnread && <View style={styles.unreadDot} />}
                              <TouchableOpacity
                                style={styles.cardCloseBtn}
                                onPress={(e) => handleDismissNotification(notif.id, e)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                activeOpacity={0.6}
                              >
                                <Ionicons name="close" size={17} color="#94a3b8" />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Notification Title */}
                          <Text style={[styles.notifTitle, isUnread && styles.notifTitleBold]}>
                            {notif.title}
                          </Text>
                        </View>
                      </View>

                      {/* Body Content (<p> message) - Aligned directly to the left */}
                      <Text style={styles.notifMessage}>{notif.message}</Text>

                      {/* Optional OTP highlight pill */}
                      {notif.otp && (
                        <View style={styles.otpHighlightPill}>
                          <Ionicons name="pricetag" size={15} color="#065f46" style={{ marginRight: 5 }} />
                          <Text style={styles.otpHighlightLabel}>Pickup OTP:</Text>
                          <Text style={styles.otpHighlightCode}>{notif.otp}</Text>
                        </View>
                      )}

                      {/* Optional Booking Reference pill */}
                      {notif.bookingRef && (
                        <View style={styles.refHighlightRow}>
                          <Ionicons name="car" size={14} color="rgb(22, 34, 50)" style={{ marginRight: 4 }} />
                          <Text style={styles.refHighlightText}>{notif.bookingRef}</Text>
                        </View>
                      )}

                      {/* Action Button - Aligned directly to the left */}
                      {notif.actionLabel && (
                        <View style={styles.actionBtnRow}>
                          <Text style={styles.actionBtnText}>{notif.actionLabel}</Text>
                          <Ionicons name="arrow-forward" size={15} color="rgb(240, 117, 15)" />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Half-width separator line centered in the middle */}
                    {index < filteredNotifications.length - 1 && (
                      <View style={styles.halfSeparator} />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* Persistent Bottom Close Bar */}
      <View style={[styles.bottomCloseBarWrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.bottomCloseBarBtn}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Ionicons name="close-circle" size={21} color="#ffffff" style={{ marginRight: 7 }} />
          <Text style={styles.bottomCloseBarText}>Close Notifications</Text>
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
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8edf5',
    paddingHorizontal: 16,
    paddingBottom: 10,
    elevation: 3,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleCol: {
    flex: 1,
  },
  titleWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.3,
  },
  unreadCountBadge: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  unreadCountText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
  },
  headerSubtitle: {
    fontSize: 13.5,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 4,
  },
  markAllBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabItemActive: {
    backgroundColor: 'rgb(22, 34, 50)',
    borderColor: 'rgb(22, 34, 50)',
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  tabItemTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 12,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  mainFeedBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8edf5',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
    marginTop: 20,
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
    fontSize: 18.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgb(22, 34, 50)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  notifCard: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  notifCardUnread: {
    backgroundColor: '#fffdfb',
  },
  halfSeparator: {
    height: 1.2,
    width: '45%',
    backgroundColor: '#e8edf5',
    alignSelf: 'center',
    marginVertical: 2,
    borderRadius: 1,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notifIconCircle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 0,
  },
  notifHeaderContent: {
    flex: 1,
  },
  notifMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  notifTagPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  notifTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.4,
  },
  notifTimeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  notifTimeText: {
    fontSize: 12.5,
    color: '#94a3b8',
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgb(240, 117, 15)',
  },
  notifTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    marginBottom: 2,
    lineHeight: 22,
  },
  notifTitleBold: {
    fontWeight: '900',
    color: '#091e42',
  },
  notifMessage: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20.5,
    marginBottom: 9,
  },
  otpHighlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 9,
  },
  otpHighlightLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#065f46',
    marginRight: 4,
  },
  otpHighlightCode: {
    fontSize: 15,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  refHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  refHighlightText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCloseBtn: {
    marginLeft: 6,
    padding: 2,
  },
  bottomCloseBarWrapper: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e8edf5',
    paddingHorizontal: 16,
    paddingTop: 10,
    elevation: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  bottomCloseBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(22, 34, 50)',
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
    shadowColor: 'rgb(22, 34, 50)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  bottomCloseBarText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
