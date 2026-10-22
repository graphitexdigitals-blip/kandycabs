import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { ALL_LOCATIONS, PlaceLocation } from '../lib/locations';

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: PlaceLocation) => void;
  title: string;
  currentValue?: string;
  isPickup?: boolean;
}

type TabCategory = 'ALL' | 'AIRPORTS' | 'RAILWAY' | 'MANGALURU' | 'OUTSTATION';

interface LocationMeta {
  iconName: keyof typeof Ionicons.glyphMap;
  badgeLabel: string;
  badgeBg: string;
  badgeColor: string;
  iconBg: string;
  iconColor: string;
}

function getLocationMeta(loc: PlaceLocation): LocationMeta {
  const text = `${loc.label} ${loc.sublabel || ''} ${loc.keywords?.join(' ') || ''}`.toLowerCase();

  // 1. Train / Railway Stations - STRICT: Never show airport icon for railway!
  if (
    text.includes('railway') ||
    text.includes('train') ||
    text.includes('railway station') ||
    (text.includes('station') && !text.includes('police') && !text.includes('fire'))
  ) {
    return {
      iconName: 'train',
      badgeLabel: 'TRAIN',
      badgeBg: '#eef2ff',
      badgeColor: '#4338ca',
      iconBg: '#e0e7ff',
      iconColor: '#4f46e5',
    };
  }

  // 2. Bus Terminals / Stands
  if (
    text.includes('bus stand') ||
    text.includes('ksrtc') ||
    text.includes('terminus') ||
    text.includes('bus terminal')
  ) {
    return {
      iconName: 'bus',
      badgeLabel: 'BUS',
      badgeBg: '#f0fdfa',
      badgeColor: '#0f766e',
      iconBg: '#ccfbf1',
      iconColor: '#0d9488',
    };
  }

  // 3. Genuine Airports Only
  if (
    (loc.category === 'AIRPORTS' || text.includes('airport') || text.includes('aerodrome') || text.includes('ixe') || text.includes('blr') || text.includes('flight')) &&
    !text.includes('railway') &&
    !text.includes('train')
  ) {
    return {
      iconName: 'airplane',
      badgeLabel: 'AIRPORT',
      badgeBg: '#f0f9ff',
      badgeColor: '#0369a1',
      iconBg: '#e0f2fe',
      iconColor: '#0284c7',
    };
  }

  // 4. Temples / Shrines / Cultural
  if (
    text.includes('temple') ||
    text.includes('shrine') ||
    text.includes('church') ||
    text.includes('cathedral') ||
    text.includes('darga') ||
    text.includes('mandir') ||
    text.includes('chapel')
  ) {
    return {
      iconName: 'sparkles',
      badgeLabel: 'TEMPLE',
      badgeBg: '#fffbeb',
      badgeColor: '#b45309',
      iconBg: '#fef3c7',
      iconColor: '#d97706',
    };
  }

  // 5. Hospitals / Medical
  if (
    text.includes('hospital') ||
    text.includes('medical') ||
    text.includes('clinic') ||
    text.includes('health') ||
    text.includes('kshema')
  ) {
    return {
      iconName: 'medkit',
      badgeLabel: 'MEDICAL',
      badgeBg: '#fff1f2',
      badgeColor: '#be123c',
      iconBg: '#ffe4e6',
      iconColor: '#e11d48',
    };
  }

  // 6. Colleges / Universities / IT Parks
  if (
    text.includes('college') ||
    text.includes('university') ||
    text.includes('campus') ||
    text.includes('institute') ||
    text.includes('sjec') ||
    text.includes('nitk') ||
    text.includes('infosys')
  ) {
    return {
      iconName: 'school',
      badgeLabel: 'CAMPUS',
      badgeBg: '#f5f3ff',
      badgeColor: '#6d28d9',
      iconBg: '#ede9fe',
      iconColor: '#7c3aed',
    };
  }

  // 7. Malls & Shopping
  if (
    text.includes('mall') ||
    text.includes('shopping') ||
    text.includes('centre') ||
    text.includes('market')
  ) {
    return {
      iconName: 'cart',
      badgeLabel: 'MALL',
      badgeBg: '#ecfdf5',
      badgeColor: '#047857',
      iconBg: '#d1fae5',
      iconColor: '#059669',
    };
  }

  // 8. Outstation Destinations
  if (loc.category === 'OUTSTATION') {
    return {
      iconName: 'car',
      badgeLabel: 'OUTSTATION',
      badgeBg: '#fff7ed',
      badgeColor: '#c2410c',
      iconBg: '#fed7aa',
      iconColor: '#ea580c',
    };
  }

  // Default: City / Local Area
  return {
    iconName: 'location',
    badgeLabel: 'LOCAL',
    badgeBg: '#f8fafc',
    badgeColor: '#475569',
    iconBg: '#f1f5f9',
    iconColor: '#64748b',
  };
}

export function LocationPickerModal({
  visible,
  onClose,
  onSelect,
  title,
  currentValue,
  isPickup,
}: LocationPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<TabCategory>('ALL');
  const [gpsLoading, setGpsLoading] = useState(false);

  const filteredLocations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ALL_LOCATIONS.filter((loc) => {
      const text = `${loc.label} ${loc.sublabel || ''} ${loc.keywords?.join(' ') || ''}`.toLowerCase();
      const isRailway =
        text.includes('railway') ||
        text.includes('train') ||
        text.includes('railway station') ||
        (text.includes('station') && !text.includes('police'));

      // Category filter
      if (activeCategory === 'AIRPORTS') {
        if (isRailway) return false;
        if (loc.category !== 'AIRPORTS' && !text.includes('airport')) return false;
      } else if (activeCategory === 'RAILWAY') {
        if (!isRailway) return false;
      } else if (activeCategory === 'MANGALURU') {
        if (loc.category !== 'MANGALURU') return false;
      } else if (activeCategory === 'OUTSTATION') {
        if (loc.category !== 'OUTSTATION') return false;
      }

      if (!query) return true;

      const labelMatch = loc.label.toLowerCase().includes(query);
      const sublabelMatch = loc.sublabel?.toLowerCase().includes(query) || false;
      const keywordMatch = loc.keywords?.some((k) => k.toLowerCase().includes(query)) || false;

      return labelMatch || sublabelMatch || keywordMatch;
    });
  }, [searchQuery, activeCategory]);

  const handleUseCurrentLocation = async () => {
    setGpsLoading(true);
    try {
      // 1. Check if device master GPS / Location service is turned on
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (Platform.OS === 'android') {
          try {
            // Trigger native Android system "Turn on Location" prompt dialog
            await Location.enableNetworkProviderAsync();
          } catch {
            Alert.alert(
              'Location Services Disabled',
              'Please turn on GPS Location in your phone settings to detect your current position.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
            );
            setGpsLoading(false);
            return;
          }
        } else {
          Alert.alert(
            'Location Services Disabled',
            'Please turn on Location in Settings to detect your current position.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          setGpsLoading(false);
          return;
        }
      }

      // 2. Request / Check App Location Permission
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }

      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow location permission in Settings to auto-fill your current pickup point.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() },
          ]
        );
        setGpsLoading(false);
        return;
      }

      // 3. Obtain fresh current GPS position (prevent cached stale points)
      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
      }).catch(async () => {
        return await Location.getLastKnownPositionAsync({
          maxAge: 3000,
        });
      });

      if (!loc) {
        throw new Error('Unable to obtain GPS fix');
      }

      const { latitude, longitude } = loc.coords;

      // 4. Reverse geocode coordinates using OpenStreetMap (OSM) Live Service
      let label = '';
      let sublabel = '';
      let hasResolvedAddress = false;

      // Try OpenStreetMap Nominatim for exact street & locality
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        const osmRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en',
              'User-Agent': 'KandyCabsCustomerApp/1.0',
            },
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        if (osmRes.ok) {
          const data = await osmRes.json();
          const addr = data.address || {};

          const road = addr.road || addr.pedestrian || addr.street || addr.amenity || addr.building || addr.shop || '';
          const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || '';
          const city = addr.city || addr.town || addr.municipality || addr.village || addr.state_district || 'Mangaluru';
          const postcode = addr.postcode || '';

          const labelParts: string[] = [];
          if (road) labelParts.push(road);
          if (locality && locality !== road) labelParts.push(locality);
          if (city && !labelParts.some((p) => p.toLowerCase().includes(city.toLowerCase()))) {
            labelParts.push(city);
          }

          if (labelParts.length > 0) {
            label = labelParts.join(', ');
            hasResolvedAddress = true;
          } else if (data.display_name) {
            label = data.display_name.split(',').slice(0, 3).join(', ').trim();
            hasResolvedAddress = true;
          }

          const subParts = [locality, city, addr.state, postcode].filter(Boolean);
          sublabel = subParts.filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Detected via Live GPS';
        } else {
          throw new Error('OSM Reverse failed');
        }
      } catch {
        // Fallback to Native Expo Reverse Geocoder
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });

          if (addresses && addresses.length > 0) {
            const addr = addresses[0];
            const road = addr.street || addr.name || '';
            const district = addr.district || '';
            const cleanDistrict = district.toLowerCase().includes('division') ? '' : district;
            const city = addr.city || 'Mangaluru';

            const parts = [road, cleanDistrict, city].filter(Boolean);
            if (parts.length > 0) {
              label = parts.filter((v, i, a) => a.indexOf(v) === i).join(', ');
              hasResolvedAddress = true;
            }
            sublabel = [city, addr.region, addr.postalCode].filter(Boolean).join(', ') || 'Detected via Live GPS';
          }
        } catch {
          // Native reverse geocode failed (no network / offline)
        }
      }

      // If offline / no network, show 'No Network Connection' error instead of setting coordinates
      if (!hasResolvedAddress || !label.trim()) {
        Alert.alert(
          'No Network Connection',
          'Could not fetch location address because your device is offline or has no network connection. Please check your internet connection or pick a location from the list below.',
          [{ text: 'OK' }]
        );
        return;
      }

      const placeLoc: PlaceLocation = {
        label,
        sublabel,
        lat: latitude,
        lng: longitude,
        source: 'OSM_LIVE',
      };

      onSelect(placeLoc);
      onClose();
    } catch (e: any) {
      Alert.alert(
        'Location / Network Error',
        'Could not obtain an accurate location address. Please ensure GPS and Internet connection are enabled, or select a landmark from the list below.',
        [{ text: 'OK' }]
      );
    } finally {
      setGpsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#103A75" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>Tap landmark or type to search</Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={19} color="#64748b" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search airport, railway station, locality..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && Platform.OS !== 'ios' && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* GPS Location Button for Pickup */}
          {isPickup && (
            <TouchableOpacity
              style={styles.gpsButton}
              onPress={handleUseCurrentLocation}
              disabled={gpsLoading}
              activeOpacity={0.8}
            >
              <View style={styles.gpsIconCircle}>
                {gpsLoading ? (
                  <ActivityIndicator size="small" color="#ea580c" />
                ) : (
                  <Ionicons name="navigate" size={16} color="#ea580c" />
                )}
              </View>
              <View style={styles.gpsTextCol}>
                <Text style={styles.gpsButtonTitle}>Use My Current Live Location</Text>
                <Text style={styles.gpsButtonSubtitle}>Auto-detect accurate GPS position</Text>
              </View>
              <View style={styles.gpsBadge}>
                <View style={styles.gpsLiveDot} />
                <Text style={styles.gpsBadgeText}>GPS</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Category Tabs */}
          <View style={styles.categoryTabsWrapper}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabs}
              data={[
                { id: 'ALL' as TabCategory, label: 'All', icon: 'grid-outline' as const },
                { id: 'AIRPORTS' as TabCategory, label: 'Airports', icon: 'airplane-outline' as const },
                { id: 'RAILWAY' as TabCategory, label: 'Railway', icon: 'train-outline' as const },
                { id: 'MANGALURU' as TabCategory, label: 'Mangaluru', icon: 'business-outline' as const },
                { id: 'OUTSTATION' as TabCategory, label: 'Outstation', icon: 'car-outline' as const },
              ]}
              keyExtractor={(tab) => tab.id}
              renderItem={({ item: tab }) => {
                const isActive = activeCategory === tab.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.categoryTab,
                      isActive && styles.categoryTabActive,
                    ]}
                    onPress={() => setActiveCategory(tab.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={13}
                      color={isActive ? '#ffffff' : '#64748b'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.categoryTabText,
                        isActive && styles.categoryTabTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* Locations List */}
          <FlatList
            data={filteredLocations}
            keyExtractor={(item, index) => `${item.label}-${index}`}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = currentValue === item.label;
              const meta = getLocationMeta(item);

              return (
                <TouchableOpacity
                  style={[styles.locationItem, isSelected && styles.locationItemSelected]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <View style={[styles.iconContainer, { backgroundColor: meta.iconBg }]}>
                    <Ionicons
                      name={meta.iconName}
                      size={18}
                      color={meta.iconColor}
                    />
                  </View>
                  <View style={styles.locationTextContainer}>
                    <View style={styles.labelRow}>
                      <Text
                        style={[styles.locationLabel, isSelected && styles.locationLabelSelected]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      <View style={[styles.typeBadge, { backgroundColor: meta.badgeBg }]}>
                        <Text style={[styles.typeBadgeText, { color: meta.badgeColor }]}>
                          {meta.badgeLabel}
                        </Text>
                      </View>
                    </View>
                    {item.sublabel ? (
                      <Text style={styles.locationSublabel} numberOfLines={1}>
                        {item.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={20} color="#ea580c" />
                  ) : (
                    <Ionicons name="chevron-forward" size={15} color="#cbd5e1" />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>No matching locations found</Text>
                <Text style={styles.emptySubtitle}>Try searching by locality, area or station name</Text>
              </View>
            }
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#103A75',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#103A75',
    fontWeight: '500',
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginHorizontal: 16,
    marginTop: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  gpsIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  gpsTextCol: {
    flex: 1,
  },
  gpsButtonTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c2410c',
  },
  gpsButtonSubtitle: {
    fontSize: 11,
    color: '#9a3412',
    marginTop: 1,
    fontWeight: '500',
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ea580c',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gpsLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#4ade80',
    marginRight: 4,
  },
  gpsBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  categoryTabsWrapper: {
    marginTop: 10,
    marginBottom: 6,
  },
  categoryTabs: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryTabActive: {
    backgroundColor: '#EE5C21',
    borderColor: '#EE5C21',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  locationItemSelected: {
    borderColor: '#ea580c',
    backgroundColor: '#fffaf5',
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#103A75',
    marginRight: 6,
  },
  locationLabelSelected: {
    color: '#ea580c',
  },
  locationSublabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
});
