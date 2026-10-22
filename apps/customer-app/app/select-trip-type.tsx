import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeNavigate } from '../lib/safeNav';

export interface TripTypeOption {
  id: string;
  title: string;
  subtitle: string;
  iconName: string;
  iconFamily?: 'Ionicons' | 'MaterialCommunityIcons';
  category: 'ONEWAY' | 'ROUND' | 'AIRPORT' | 'LOCAL' | 'CORPORATE' | 'TOUR';
}

const TRIP_TYPES: TripTypeOption[] = [
  {
    id: 'ONEWAY',
    title: 'One-Way Drop',
    subtitle: 'Inter-city & inter-state travel',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'arrow-right-bold',
    category: 'ONEWAY',
  },
  {
    id: 'ROUND',
    title: 'Round Trip',
    subtitle: 'Multi-day journeys',
    iconFamily: 'MaterialCommunityIcons',
    iconName: 'swap-horizontal-bold',
    category: 'ROUND',
  },
  {
    id: 'AIRPORT',
    title: 'Airport Transfer',
    subtitle: 'Pickup & drop to airport',
    iconFamily: 'Ionicons',
    iconName: 'airplane',
    category: 'AIRPORT',
  },
  {
    id: 'LOCAL',
    title: 'Local Rental',
    subtitle: 'Hourly packages',
    iconName: 'time',
    category: 'LOCAL',
  },
  {
    id: 'CORPORATE',
    title: 'Corporate Travel',
    subtitle: 'Business & official travel',
    iconName: 'briefcase',
    category: 'CORPORATE',
  },
  {
    id: 'TOUR',
    title: 'Tour & Pilgrimage',
    subtitle: 'Family tours and pilgrimages',
    iconName: 'business',
    category: 'TOUR',
  },
];

export default function SelectTripTypeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const initialSelected = (params.selected as string) || (params.tripType as string) || 'ONEWAY';
  const [selectedId, setSelectedId] = useState<string>(initialSelected);

  const handleSelectTrip = (item: TripTypeOption) => {
    setSelectedId(item.id);
    safeNavigate(() => {
      // Smooth transition to Enter Trip Details screen
      router.push({
        pathname: '/trip-details',
        params: {
          tripType: item.id,
          category: item.category,
          pickup: (params.pickup as string) || '',
          drop: (params.drop as string) || '',
        },
      });
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: topInset }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Trip Type</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardList}>
          {TRIP_TYPES.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.tripCard,
                  isSelected ? styles.tripCardSelected : styles.tripCardUnselected,
                ]}
                onPress={() => handleSelectTrip(item)}
                activeOpacity={0.8}
              >
                {/* Left Icon Container */}
                <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                  {item.iconFamily === 'MaterialCommunityIcons' ? (
                    <MaterialCommunityIcons
                      name={item.iconName as any}
                      size={28}
                      color="#ea580c"
                    />
                  ) : (
                    <Ionicons
                      name={item.iconName as any}
                      size={28}
                      color="#ea580c"
                    />
                  )}
                </View>

                {/* Text Content */}
                <View style={styles.textContainer}>
                  <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                </View>

                {/* Right Indicator */}
                {isSelected ? (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#103A75',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  cardList: {
    gap: 12,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
  },
  tripCardUnselected: {
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  tripCardSelected: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
    ...Platform.select({
      ios: {
        shadowColor: '#ea580c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconContainerSelected: {
    backgroundColor: '#ffedd5',
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#103A75',
    marginBottom: 4,
  },
  cardTitleSelected: {
    color: '#103A75',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '400',
  },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
