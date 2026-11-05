import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

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

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  dispatches?: any[];
  activeBooking?: any;
  upcomingBookings?: any[];
  driver?: any;
  onlineStatus?: boolean;
  onSelectDispatch?: (dispatchId: string) => void;
  onSelectBooking?: (bookingId: string) => void;
}

export function NotificationsModal({
  visible,
  onClose,
  dispatches = [],
  activeBooking,
  upcomingBookings = [],
  driver,
  onlineStatus = false,
  onSelectDispatch,
  onSelectBooking,
}: NotificationsModalProps) {
  const { t } = useTranslation();
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'DISPATCH' | 'TRIP' | 'SYSTEM'>('ALL');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Dynamically assemble notifications from live dispatches, trips, and driver status
  const notifications: NotificationItem[] = useMemo(() => {
    const list: NotificationItem[] = [];

    // 1. Pending Dispatches from Admin
    dispatches.forEach((d) => {
      const b = d?.booking || {};
      list.push({
        id: `dispatch-${d.id}`,
        type: 'DISPATCH',
        title: `New Ride Dispatched • ${b.humanReadableRef || 'Admin Broadcast'}`,
        message: `${b.pickupAddress || 'Pickup'} ➔ ${b.dropAddress || 'Destination'}`,
        subMessage: `${b.distanceKm ? b.distanceKm + ' km • ' : ''}${b.tripType || 'ONE WAY'}${b.customer?.user?.fullName ? ' • ' + b.customer.user.fullName : ''}`,
        timestamp: d.broadcastAt || d.createdAt || new Date().toISOString(),
        isRead: readIds.has(`dispatch-${d.id}`),
        actionText: 'View Ride',
        payload: { dispatchId: d.id, bookingId: b.id },
      });
    });

    // 2. Active Trip Notification
    if (activeBooking) {
      list.push({
        id: `trip-active-${activeBooking.id}`,
        type: 'TRIP',
        title: `Active Trip in Progress • ${activeBooking.humanReadableRef || ''}`,
        message: `${activeBooking.pickupAddress || 'Pickup'} ➔ ${activeBooking.dropAddress || 'Destination'}`,
        subMessage: `Status: ${activeBooking.status || 'IN_PROGRESS'}${activeBooking.customer?.user?.fullName ? ' • Passenger: ' + activeBooking.customer.user.fullName : ''}`,
        timestamp: activeBooking.updatedAt || activeBooking.createdAt || new Date().toISOString(),
        isRead: readIds.has(`trip-active-${activeBooking.id}`),
        actionText: 'Open Trip',
        payload: { bookingId: activeBooking.id },
      });
    }

    // 3. Upcoming Assigned Bookings
    upcomingBookings.forEach((ub) => {
      list.push({
        id: `trip-upcoming-${ub.id}`,
        type: 'TRIP',
        title: `Confirmed Upcoming Booking • ${ub.humanReadableRef || ''}`,
        message: `Pickup scheduled at ${ub.scheduledAt ? new Date(ub.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Scheduled'}`,
        subMessage: `${ub.pickupAddress || 'Pickup location'}`,
        timestamp: ub.createdAt || new Date().toISOString(),
        isRead: readIds.has(`trip-upcoming-${ub.id}`),
        actionText: 'Trip Details',
        payload: { bookingId: ub.id },
      });
    });

    // 4. KYC / Verification Status
    if (driver) {
      const isApproved = driver.verificationStatus === 'APPROVED';
      list.push({
        id: `kyc-status-${driver.id}`,
        type: 'KYC',
        title: isApproved ? 'Driver Profile Verified & Active' : 'Profile Under Review by Admin',
        message: isApproved
          ? 'Your documents have been verified. You are eligible to accept ride assignments.'
          : 'Your driver documents are being reviewed. Please keep documents updated.',
        subMessage: `License: ${driver.licenseNumber || 'Active'} • Vehicle: ${driver?.vehicle?.plateNumber || 'KA-01-SD-2002'}`,
        timestamp: new Date().toISOString(),
        isRead: readIds.has(`kyc-status-${driver.id}`),
      });
    }

    // 5. Duty Status Notification
    list.push({
      id: `duty-status-${onlineStatus ? 'online' : 'offline'}`,
      type: 'DUTY',
      title: onlineStatus ? 'ONLINE: Currently ON-DUTY' : 'OFFLINE: Currently OFF-DUTY',
      message: onlineStatus
        ? 'Direct Admin dispatches and radar broadcasts are active for your vehicle.'
        : 'Go On-Duty from the Home screen whenever you are ready to receive ride assignments.',
      timestamp: new Date().toISOString(),
      isRead: readIds.has(`duty-status-${onlineStatus ? 'online' : 'offline'}`),
    });

    return list;
  }, [dispatches, activeBooking, upcomingBookings, driver, onlineStatus, readIds]);

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
  };

  const handleItemPress = (item: NotificationItem) => {
    setReadIds((prev) => new Set([...prev, item.id]));
    if (item.type === 'DISPATCH' && item.payload?.dispatchId && onSelectDispatch) {
      onClose();
      onSelectDispatch(item.payload.dispatchId);
    } else if (item.type === 'TRIP' && item.payload?.bookingId && onSelectBooking) {
      onClose();
      onSelectBooking(item.payload.bookingId);
    }
  };

  const renderTypeIcon = (type: NotificationItem['type']) => {
    switch (type) {
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
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>{unreadCount} new</Text>
              </View>
            )}
          </View>

          {unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadButton} activeOpacity={0.7}>
              <Text style={styles.markReadText}>Mark Read</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterBar}>
          {(['ALL', 'DISPATCH', 'TRIP', 'SYSTEM'] as const).map((tab) => {
            const isActive = selectedFilter === tab;
            const labels = {
              ALL: 'All',
              DISPATCH: `Dispatches (${dispatches.length})`,
              TRIP: 'Rides',
              SYSTEM: 'System',
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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={44} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptySubtitle}>
                No new notifications or trip updates at this moment.
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
                <View style={styles.iconCircle}>{renderTypeIcon(item.type)}</View>

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
      </SafeAreaView>
    </Modal>
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

