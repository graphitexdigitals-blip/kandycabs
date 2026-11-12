import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Linking,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatDisplayPhone } from '../lib/api';
import { formatTitleCase } from '../constants/typography';

interface HamburgerDrawerProps {
  visible: boolean;
  onClose: () => void;
  user: any | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onNavigateSection: (section: 'BOOKING' | 'FLEET' | 'WHY_US' | 'HOW_IT_WORKS') => void;
}

export function HamburgerDrawer({
  visible,
  onClose,
  user,
  onOpenAuth,
  onLogout,
  onNavigateSection,
}: HamburgerDrawerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const handleCallSupport = () => {
    Linking.openURL('tel:+918045689000');
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingTop: topInset + 8 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.userInfo}>
              {user ? (
                <TouchableOpacity
                  style={styles.userInfoTouchable}
                  activeOpacity={0.7}
                  onPress={() => {
                    onClose();
                    router.push('/profile');
                  }}
                >
                  <View style={styles.avatar}>
                    {user.profilePhoto ? (
                      <Image source={{ uri: user.profilePhoto }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>
                        {(user.fullName && user.fullName.toLowerCase() !== 'customer' && user.fullName.toLowerCase() !== 'kandy customer') ? user.fullName.trim()[0].toUpperCase() : 'K'}
                      </Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.userName}>
                      {(user.fullName && user.fullName.toLowerCase() !== 'customer' && user.fullName.toLowerCase() !== 'kandy customer')
                        ? formatTitleCase(user.fullName)
                        : 'Valued Customer'}
                    </Text>
                    <Text style={styles.userPhone}>{formatDisplayPhone(user.phone)}</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <Image
                  source={require('../assets/images/logo.png')}
                  style={styles.drawerLogo}
                  resizeMode="contain"
                />
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#1e293b" />
            </TouchableOpacity>
          </View>

          {/* Navigation Links */}
          <View style={styles.menuList}>
            {/* My Profile (If user logged in) */}
            {user && (
              <TouchableOpacity
                style={styles.myProfileBtn}
                onPress={() => {
                  onClose();
                  router.push('/profile');
                }}
              >
                <View style={styles.myBookingsLeft}>
                  <Ionicons name="person-circle-outline" size={20} color="rgb(240, 117, 15)" />
                  <Text style={styles.myBookingsText}>{t('profile.myProfile', { defaultValue: 'My Profile' })}</Text>
                </View>
                <View style={styles.ridesBadge}>
                  <Text style={styles.ridesBadgeText}>{t('common.viewDetails', { defaultValue: 'View Details' })} →</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* My Bookings */}
            {user && (
              <TouchableOpacity
                style={styles.myBookingsBtn}
                onPress={() => {
                  onClose();
                  router.push('/my-bookings');
                }}
              >
                <View style={styles.myBookingsLeft}>
                  <Ionicons name="receipt-outline" size={18} color="#0284c7" />
                  <Text style={[styles.myBookingsText, { color: '#0369a1' }]}>{t('profile.myBookings', { defaultValue: 'My Bookings & Invoices' })}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}

            {/* Book Cab Online (Highlight) */}
            <TouchableOpacity
              style={styles.highlightBtn}
              onPress={() => {
                onClose();
                onNavigateSection('BOOKING');
              }}
            >
              <Text style={styles.highlightBtnText}>{t('modals.drawer.bookRide', { defaultValue: 'Book Cab Online' })}</Text>
              <View style={styles.instantBadge}>
                <Text style={styles.instantBadgeText}>Instant</Text>
              </View>
            </TouchableOpacity>

            {/* Fleet & Rates */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onNavigateSection('FLEET');
              }}
            >
              <Text style={styles.menuItemText}>{t('modals.drawer.viewFleet', { defaultValue: 'Fleet & Rates' })}</Text>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </TouchableOpacity>

            {/* Why Choose Us */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onNavigateSection('WHY_US');
              }}
            >
              <Text style={styles.menuItemText}>{t('modals.drawer.whyKandy', { defaultValue: 'Why Choose Us' })}</Text>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </TouchableOpacity>

            {/* How It Works */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                onNavigateSection('HOW_IT_WORKS');
              }}
            >
              <Text style={styles.menuItemText}>{t('modals.drawer.howItWorks', { defaultValue: 'How It Works' })}</Text>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Admin Portal Shortcut (If user is Admin) */}
            {user?.roles?.includes('ADMIN') && (
              <TouchableOpacity
                style={styles.adminBtn}
                onPress={() => {
                  onClose();
                  Linking.openURL('http://localhost:3001');
                }}
              >
                <Ionicons name="shield-checkmark" size={18} color="#d97706" />
                <Text style={styles.adminBtnText}>Admin Operations Dashboard</Text>
                <Ionicons name="open-outline" size={16} color="#d97706" />
              </TouchableOpacity>
            )}

            {/* 24/7 Support with Call Icon */}
            <TouchableOpacity style={styles.supportCard} onPress={handleCallSupport}>
              <Ionicons name="call" size={18} color="#16a34a" />
              <View style={styles.supportTextContainer}>
                <Text style={styles.supportLabel}>24/7 Helpline Support</Text>
                <Text style={styles.supportPhone}>+91 80456 89000</Text>
              </View>
            </TouchableOpacity>

            {/* Auth Button */}
            {user ? (
              <TouchableOpacity
                style={styles.signOutBtn}
                onPress={() => {
                  onClose();
                  onLogout();
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#dc2626" />
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.signInBtn}
                onPress={() => {
                  onClose();
                  onOpenAuth();
                }}
              >
                <Ionicons name="log-in-outline" size={18} color="rgb(240, 117, 15)" />
                <Text style={styles.signInText}>Sign In / Register</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-start',
  },
  container: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgb(240, 117, 15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  userName: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  userPhone: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: 'rgb(240, 117, 15)',
    letterSpacing: 0.5,
  },
  drawerLogo: {
    width: 140,
    height: 36,
  },
  closeBtn: {
    padding: 5,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  userInfoTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuList: {
    paddingTop: 8,
  },
  myProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  myBookingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  myBookingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  myBookingsText: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
  },
  ridesBadge: {
    backgroundColor: 'rgb(240, 117, 15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ridesBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  highlightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgb(240, 117, 15)',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
  },
  highlightBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  instantBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  instantBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 6,
  },
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  adminBtnText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
    marginLeft: 6,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  supportTextContainer: {
    marginLeft: 10,
  },
  supportLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  supportPhone: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    marginTop: 1,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
  },
  signInText: {
    color: 'rgb(240, 117, 15)',
    fontSize: 12,
    fontWeight: '800',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
  },
  signOutText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },
});
