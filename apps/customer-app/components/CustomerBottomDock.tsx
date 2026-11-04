import React, { memo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Linking, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { safeNavigate } from '../lib/safeNav';

const COLOR_ACTIVE = 'rgb(240, 117, 15)'; // Match app orange
const COLOR_INACTIVE = 'rgba(255, 255, 255, 0.72)'; // Crisp white against deep navy
const COLOR_BG = 'rgb(22, 34, 50)'; // Deep Navy
const COLOR_BORDER = '#101925';

interface CustomerBottomDockProps {
  activeTab?: 'HOME' | 'BOOKINGS' | 'SUPPORT' | 'PROFILE';
  onPressProfile?: () => void;
  onPressBookings?: () => void;
  isAbsolute?: boolean;
}

export const CustomerBottomDock = memo(function CustomerBottomDock({
  activeTab = 'HOME',
  onPressProfile,
  onPressBookings,
  isAbsolute = true,
}: CustomerBottomDockProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const bottomPadding = Math.max(6, insets.bottom);

  const handleSupport = () => {
    safeNavigate(() => {
      if (activeTab === 'SUPPORT') return;
      router.push('/support');
    });
  };

  const handleBookings = () => {
    safeNavigate(() => {
      if (onPressBookings) {
        onPressBookings();
      } else {
        router.push('/my-bookings');
      }
    });
  };

  const handleHome = () => {
    safeNavigate(() => {
      router.push('/');
    });
  };

  const handleProfile = () => {
    safeNavigate(() => {
      if (onPressProfile) {
        onPressProfile();
      } else {
        router.push('/profile');
      }
    });
  };

  return (
    <View style={[styles.container, !isAbsolute && styles.containerRelative, { paddingBottom: bottomPadding }]}>
      <View style={styles.dock}>
        {/* Home Tab */}
        <TouchableOpacity
          style={styles.dockTab}
          onPress={handleHome}
          activeOpacity={0.7}
        >
          {activeTab === 'HOME' && <View style={styles.activeTopIndicator} />}
          <Ionicons
            name={activeTab === 'HOME' ? 'home' : 'home-outline'}
            size={24}
            color={activeTab === 'HOME' ? COLOR_ACTIVE : COLOR_INACTIVE}
          />
          <Text
            style={[styles.dockTabLabel, activeTab === 'HOME' && styles.dockTabLabelActive]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.8}
          >
            {t('nav.home')}
          </Text>
        </TouchableOpacity>

        {/* My Bookings Tab */}
        <TouchableOpacity
          style={styles.dockTab}
          onPress={handleBookings}
          activeOpacity={0.7}
        >
          {activeTab === 'BOOKINGS' && <View style={styles.activeTopIndicator} />}
          <Ionicons
            name={activeTab === 'BOOKINGS' ? 'calendar' : 'calendar-outline'}
            size={24}
            color={activeTab === 'BOOKINGS' ? COLOR_ACTIVE : COLOR_INACTIVE}
          />
          <Text
            style={[styles.dockTabLabel, activeTab === 'BOOKINGS' && styles.dockTabLabelActive]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.8}
          >
            {t('nav.bookings')}
          </Text>
        </TouchableOpacity>

        {/* Support Tab */}
        <TouchableOpacity
          style={styles.dockTab}
          onPress={handleSupport}
          activeOpacity={0.7}
        >
          {activeTab === 'SUPPORT' && <View style={styles.activeTopIndicator} />}
          <Ionicons
            name={activeTab === 'SUPPORT' ? 'headset' : 'headset-outline'}
            size={24}
            color={activeTab === 'SUPPORT' ? COLOR_ACTIVE : COLOR_INACTIVE}
          />
          <Text
            style={[styles.dockTabLabel, activeTab === 'SUPPORT' && styles.dockTabLabelActive]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.8}
          >
            {t('nav.support')}
          </Text>
        </TouchableOpacity>

        {/* Profile Tab */}
        <TouchableOpacity
          style={styles.dockTab}
          onPress={handleProfile}
          activeOpacity={0.7}
        >
          {activeTab === 'PROFILE' && <View style={styles.activeTopIndicator} />}
          <Ionicons
            name={activeTab === 'PROFILE' ? 'person' : 'person-outline'}
            size={24}
            color={activeTab === 'PROFILE' ? COLOR_ACTIVE : COLOR_INACTIVE}
          />
          <Text
            style={[styles.dockTabLabel, activeTab === 'PROFILE' && styles.dockTabLabelActive]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.8}
          >
            {t('nav.profile')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLOR_BG,
    borderTopWidth: 1,
    borderTopColor: COLOR_BORDER,
    paddingBottom: 10,
    paddingTop: 5,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
      },
    }),
  },
  containerRelative: {
    position: 'relative',
    bottom: undefined,
    left: undefined,
    right: undefined,
  },
  dock: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  dockTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    position: 'relative',
  },
  activeTopIndicator: {
    position: 'absolute',
    top: -5,
    width: 26,
    height: 2.5,
    backgroundColor: COLOR_ACTIVE,
    borderRadius: 2,
  },
  dockTabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLOR_INACTIVE,
    marginTop: 2,
  },
  dockTabLabelActive: {
    color: COLOR_ACTIVE,
    fontWeight: '800',
  },
});
