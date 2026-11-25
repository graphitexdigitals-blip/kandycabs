import React, { memo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BottomNavigationBarProps {
  activeTab: 'HOME' | 'MY_TRIPS' | 'SUPPORT' | 'PROFILE';
  onTabChange: (tab: 'HOME' | 'MY_TRIPS' | 'SUPPORT' | 'PROFILE') => void;
  hasPendingDocuments: boolean;
  bottomInset: number;
}

export const BottomNavigationBar = memo(function BottomNavigationBar({
  activeTab,
  onTabChange,
  hasPendingDocuments,
  bottomInset,
}: BottomNavigationBarProps) {
  const tabs = [
    { id: 'HOME' as const, label: 'Dashboard', icon: 'speedometer' as const, iconOutline: 'speedometer-outline' as const },
    { id: 'MY_TRIPS' as const, label: 'Trips & Pay', icon: 'car' as const, iconOutline: 'car-outline' as const },
    { id: 'SUPPORT' as const, label: 'Support', icon: 'help-buoy' as const, iconOutline: 'help-buoy-outline' as const },
    { id: 'PROFILE' as const, label: 'Profile', icon: 'person' as const, iconOutline: 'person-outline' as const, alert: hasPendingDocuments },
  ];

  return (
    <View style={[styles.container, { paddingBottom: Math.max(bottomInset, 8) }]}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Ionicons
                  name={isActive ? tab.icon : tab.iconOutline}
                  size={20}
                  color={isActive ? '#fb923c' : '#94a3b8'}
                />
                {tab.alert && (
                  <View style={styles.badgeAlert}>
                    <Text style={styles.badgeAlertText}>!</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#162636',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(234, 88, 12, 0.12)',
  },
  iconContainer: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 3,
  },
  tabLabelActive: {
    color: '#fb923c',
    fontWeight: '800',
  },
  badgeAlert: {
    position: 'absolute',
    top: -3,
    right: -7,
    backgroundColor: '#ef4444',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#162636',
  },
  badgeAlertText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
});
