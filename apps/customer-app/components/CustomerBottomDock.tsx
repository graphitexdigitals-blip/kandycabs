import React, { memo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Linking, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeNavigate } from '../lib/safeNav';

interface CustomerBottomDockProps {
  activeTab?: 'HOME' | 'BOOKINGS' | 'SUPPORT' | 'PROFILE';
  onPressProfile?: () => void;
  onPressBookings?: () => void;
}

export const CustomerBottomDock = memo(function CustomerBottomDock({
  activeTab = 'HOME',
  onPressProfile,
  onPressBookings,
}: CustomerBottomDockProps) {
  const router = useRouter();

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
    <View style={styles.container}>
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
            size={22}
            color={activeTab === 'HOME' ? '#ea580c' : '#103A75'}
          />
          <Text style={[styles.dockTabLabel, activeTab === 'HOME' && styles.dockTabLabelActive]}>
            Home
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
            size={22}
            color={activeTab === 'BOOKINGS' ? '#ea580c' : '#103A75'}
          />
          <Text style={[styles.dockTabLabel, activeTab === 'BOOKINGS' && styles.dockTabLabelActive]}>
            My Bookings
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
            size={22}
            color={activeTab === 'SUPPORT' ? '#ea580c' : '#103A75'}
          />
          <Text style={[styles.dockTabLabel, activeTab === 'SUPPORT' && styles.dockTabLabelActive]}>
            Support
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
            size={22}
            color={activeTab === 'PROFILE' ? '#ea580c' : '#103A75'}
          />
          <Text style={[styles.dockTabLabel, activeTab === 'PROFILE' && styles.dockTabLabelActive]}>
            Profile
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
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingBottom: 10,
    paddingTop: 5,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2.5,
      },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
    }),
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
    backgroundColor: '#ea580c',
    borderRadius: 2,
  },
  dockTabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#103A75',
    marginTop: 1.5,
  },
  dockTabLabelActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
});
