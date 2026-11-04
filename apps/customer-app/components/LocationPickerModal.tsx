import React, { useState, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { ALL_LOCATIONS, PlaceLocation, isAirportLocation, isSameLocation } from '../lib/locations';

export interface StopItem {
  id: string;
  label: string;
  location?: PlaceLocation;
}

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect?: (location: PlaceLocation) => void;
  title?: string;
  currentValue?: string;
  isPickup?: boolean;
  initialTarget?: 'PICKUP' | 'STOP' | 'DROP';
  initialStopIndex?: number;
  pickupValue?: string;
  dropValue?: string;
  pickupLocation?: PlaceLocation | null;
  dropLocation?: PlaceLocation | null;
  viaStops?: PlaceLocation[];
  onSelectPickup?: (location: PlaceLocation) => void;
  onSelectDrop?: (location: PlaceLocation) => void;
  onAddStop?: (location: PlaceLocation) => void;
  onRemoveStop?: (index: number) => void;
  onConfirmRoute?: (route: {
    pickup: PlaceLocation | null;
    drop: PlaceLocation | null;
    stops: PlaceLocation[];
  }) => void;
  hideDrop?: boolean;
  hideStops?: boolean;
  singleLocationOnly?: boolean;
  pickupPlaceholder?: string;
  dropPlaceholder?: string;
  pickupAirportsOnly?: boolean;
  dropAirportsOnly?: boolean;
  airportsOnly?: boolean;
}

export function LocationPickerModal({
  visible,
  onClose,
  onSelect,
  title = 'Select Location',
  currentValue,
  isPickup,
  initialTarget,
  initialStopIndex = 0,
  pickupValue,
  dropValue,
  pickupLocation,
  dropLocation,
  viaStops,
  onSelectPickup,
  onSelectDrop,
  onAddStop,
  onRemoveStop,
  onConfirmRoute,
  hideDrop,
  hideStops,
  singleLocationOnly,
  pickupPlaceholder,
  dropPlaceholder,
  pickupAirportsOnly,
  dropAirportsOnly,
  airportsOnly,
}: LocationPickerModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isSmallDevice = windowWidth < 380 || windowHeight < 700;
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const pickupInputRef = useRef<TextInput>(null);
  const stopInputRefs = useRef<{ [key: number]: TextInput | null }>({});
  const dropInputRef = useRef<TextInput>(null);
  const routeCardScrollRef = useRef<ScrollView>(null);

  const [pickupText, setPickupText] = useState(
    pickupValue || (isPickup !== false ? currentValue : '') || ''
  );
  const [dropText, setDropText] = useState(
    hideDrop ? '' : (dropValue || (isPickup === false ? currentValue : '') || '')
  );
  const [pickupItem, setPickupItem] = useState<PlaceLocation | null>(pickupLocation || null);
  const [dropItem, setDropItem] = useState<PlaceLocation | null>(dropLocation || null);
  const [stops, setStops] = useState<StopItem[]>(() => {
    if (hideDrop || singleLocationOnly || hideStops) return [];
    let initStops: StopItem[] = [];
    if (viaStops && viaStops.length > 0) {
      initStops = viaStops.map((s, idx) => ({
        id: `stop-${idx}-${Date.now()}`,
        label: s.label,
        location: s,
      }));
    }
    if (initialTarget === 'STOP') {
      if (
        initialStopIndex !== undefined &&
        initialStopIndex >= initStops.length &&
        initStops.length < 12
      ) {
        initStops.push({
          id: `stop-${initStops.length}-${Date.now()}`,
          label: '',
        });
      } else if (initStops.length === 0) {
        initStops = [{ id: `stop-0-${Date.now()}`, label: '' }];
      }
    }
    return initStops;
  });

  const [activeStopIndex, setActiveStopIndex] = useState<number>(initialStopIndex || 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [activeTarget, setActiveTarget] = useState<'PICKUP' | 'STOP' | 'DROP'>(
    hideDrop || singleLocationOnly
      ? (isPickup !== false ? 'PICKUP' : 'DROP')
      : (initialTarget || (isPickup !== false ? 'PICKUP' : 'DROP'))
  );

  const prevVisibleRef = useRef(false);

  // Synchronize state only when modal first opens
  React.useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      const p = pickupValue || (isPickup !== false ? currentValue : '') || '';
      const d = hideDrop ? '' : (dropValue || (isPickup === false ? currentValue : '') || '');

      const initialPickupItem = pickupLocation || (p ? ALL_LOCATIONS.find((l) => l.label.toLowerCase() === p.trim().toLowerCase()) || null : null);
      const initialDropItem = dropLocation || (d ? ALL_LOCATIONS.find((l) => l.label.toLowerCase() === d.trim().toLowerCase()) || null : null);
      setPickupItem(initialPickupItem);
      setDropItem(initialDropItem);

      let initStops: StopItem[] = [];
      if (!hideDrop && !singleLocationOnly && !hideStops && viaStops && viaStops.length > 0) {
        initStops = viaStops.map((s, idx) => ({
          id: `stop-${idx}-${Date.now()}`,
          label: s.label,
          location: s,
        }));
      }

      const target = hideDrop || singleLocationOnly
        ? (isPickup !== false ? 'PICKUP' : 'DROP')
        : (initialTarget || (isPickup !== false ? 'PICKUP' : 'DROP'));

      let sIdx = 0;
      if (!hideDrop && !singleLocationOnly && target === 'STOP') {
        // If clicking "+ Add Stop X" (e.g. initialStopIndex >= initStops.length), automatically append the new stop row!
        if (
          initialStopIndex !== undefined &&
          initialStopIndex >= initStops.length &&
          initStops.length < 12
        ) {
          const newIdx = initStops.length;
          initStops.push({
            id: `stop-${newIdx}-${Date.now()}`,
            label: '',
          });
          sIdx = newIdx;
        } else if (
          initialStopIndex !== undefined &&
          initialStopIndex >= 0 &&
          initialStopIndex < initStops.length
        ) {
          sIdx = initialStopIndex;
        } else if (initStops.length === 0) {
          initStops.push({
            id: `stop-0-${Date.now()}`,
            label: '',
          });
          sIdx = 0;
        } else {
          sIdx = Math.max(0, initStops.length - 1);
        }
      } else {
        sIdx = Math.max(0, initStops.length - 1);
      }

      setPickupText(p);
      setDropText(d);
      setStops(initStops);
      setActiveTarget(target);
      setActiveStopIndex(sIdx);
      setSearchQuery('');

      if (target === 'PICKUP') {
        setTimeout(() => pickupInputRef.current?.focus(), 150);
      } else if (target === 'DROP') {
        setTimeout(() => dropInputRef.current?.focus(), 150);
      } else if (target === 'STOP') {
        setTimeout(() => {
          routeCardScrollRef.current?.scrollToEnd({ animated: true });
          stopInputRefs.current[sIdx]?.focus();
        }, 150);
      }
    }
    prevVisibleRef.current = visible;
  }, [visible, pickupValue, dropValue, pickupLocation, dropLocation, viaStops, currentValue, isPickup, initialTarget, initialStopIndex, hideDrop, hideStops, singleLocationOnly, pickupAirportsOnly, dropAirportsOnly, airportsOnly]);

  const isTargetAirportOnly = useMemo(() => {
    if (airportsOnly) return true;
    if (activeTarget === 'PICKUP' && pickupAirportsOnly) return true;
    if (activeTarget === 'DROP' && dropAirportsOnly) return true;
    return false;
  }, [airportsOnly, activeTarget, pickupAirportsOnly, dropAirportsOnly]);

  const modalTitle = useMemo(() => {
    if (hideDrop || singleLocationOnly) {
      if (title) return title;
      return isPickup !== false
        ? t('modals.locationPicker.selectPickupLocation', { defaultValue: 'Select Pickup Location' })
        : t('modals.locationPicker.selectDropLocation', { defaultValue: 'Select Drop Location' });
    }
    if (activeTarget === 'PICKUP') {
      return pickupAirportsOnly
        ? t('modals.locationPicker.selectPickupAirport', { defaultValue: 'Select Pickup Airport' })
        : t('modals.locationPicker.selectPickupLocation', { defaultValue: 'Select Pickup Location' });
    }
    if (activeTarget === 'DROP') {
      return dropAirportsOnly
        ? t('modals.locationPicker.selectDestAirport', { defaultValue: 'Select Destination Airport' })
        : t('modals.locationPicker.selectDropLocation', { defaultValue: 'Select Drop Location' });
    }
    if (activeTarget === 'STOP') {
      return t('modals.locationPicker.selectStopLocation', { index: activeStopIndex + 1, defaultValue: `Select Stop ${activeStopIndex + 1}` });
    }
    return title || t('modals.locationPicker.title', { defaultValue: 'Select Location' });
  }, [title, hideDrop, singleLocationOnly, isPickup, activeTarget, pickupAirportsOnly, dropAirportsOnly, activeStopIndex, t]);

  const baseLocations = useMemo(() => {
    if (isTargetAirportOnly) {
      return ALL_LOCATIONS.filter(isAirportLocation);
    }
    return ALL_LOCATIONS;
  }, [isTargetAirportOnly]);

  const filteredLocations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return baseLocations;

    return baseLocations.filter((loc) => {
      const labelMatch = loc.label.toLowerCase().includes(query);
      const sublabelMatch = loc.sublabel?.toLowerCase().includes(query) || false;
      const keywordMatch = loc.keywords?.some((k) => k.toLowerCase().includes(query)) || false;

      return labelMatch || sublabelMatch || keywordMatch;
    });
  }, [searchQuery, baseLocations]);

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

      // 3. Obtain current GPS position (fast fix with fallback)
      let loc = await Location.getLastKnownPositionAsync({ maxAge: 60000 });
      if (!loc) {
        loc = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            mayShowUserSettingsDialog: true,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('GPS timeout')), 4000)
          ),
        ]).catch(async () => {
          return await Location.getLastKnownPositionAsync();
        });
      }

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
        const timeout = setTimeout(() => controller.abort(), 2000);

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

      if (hideDrop || singleLocationOnly) {
        if (isPickup !== false) {
          if (dropLocation && isSameLocation(placeLoc, dropLocation)) {
            Alert.alert(
              t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
              t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
            );
            return;
          }
          setPickupItem(placeLoc);
          setPickupText(placeLoc.label);
          onSelectPickup?.(placeLoc);
          onSelect?.(placeLoc);
          onConfirmRoute?.({
            pickup: placeLoc,
            drop: null,
            stops: [],
          });
          onClose();
        } else {
          if (pickupLocation && isSameLocation(placeLoc, pickupLocation)) {
            Alert.alert(
              t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
              t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
            );
            return;
          }
          setDropItem(placeLoc);
          setDropText(placeLoc.label);
          onSelectDrop?.(placeLoc);
          onSelect?.(placeLoc);
          onConfirmRoute?.({
            pickup: null,
            drop: placeLoc,
            stops: [],
          });
          onClose();
        }
        return;
      }

      if (activeTarget === 'PICKUP') {
        if (dropText.trim() && isSameLocation(placeLoc, dropItem || dropText)) {
          Alert.alert(
            t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
            t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
          );
          return;
        }
        const matchStop = stops.find((s) => s.label && isSameLocation(placeLoc, s.location || s.label));
        if (matchStop) {
          Alert.alert(
            t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
            t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
          );
          return;
        }
        setPickupItem(placeLoc);
        setPickupText(placeLoc.label);
        onSelectPickup?.(placeLoc);
        setSearchQuery('');
        if (stops.length > 0 && !stops[0].label) {
          setActiveTarget('STOP');
          setActiveStopIndex(0);
        } else {
          setActiveTarget('DROP');
        }
      } else if (activeTarget === 'STOP') {
        if (pickupText.trim() && isSameLocation(placeLoc, pickupItem || pickupText)) {
          Alert.alert(
            t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
            t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
          );
          return;
        }
        if (dropText.trim() && isSameLocation(placeLoc, dropItem || dropText)) {
          Alert.alert(
            t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
            t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
          );
          return;
        }
        const matchOtherStop = stops.find(
          (s, idx) => idx !== activeStopIndex && s.label && isSameLocation(placeLoc, s.location || s.label)
        );
        if (matchOtherStop) {
          Alert.alert(
            t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
            t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
          );
          return;
        }
        setStops((prev) =>
          prev.map((s, idx) =>
            idx === activeStopIndex ? { ...s, label: placeLoc.label, location: placeLoc } : s
          )
        );
        setSearchQuery('');
        if (activeStopIndex + 1 < stops.length) {
          setActiveStopIndex(activeStopIndex + 1);
        } else {
          setActiveTarget('DROP');
        }
      } else {
        if (pickupText.trim() && isSameLocation(placeLoc, pickupItem || pickupText)) {
          Alert.alert(
            t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
            t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
          );
          return;
        }
        const matchStop = stops.find((s) => s.label && isSameLocation(placeLoc, s.location || s.label));
        if (matchStop) {
          Alert.alert(
            t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
            t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
          );
          return;
        }
        setDropItem(placeLoc);
        setDropText(placeLoc.label);
        onSelectDrop?.(placeLoc);
        setSearchQuery('');
        if (!pickupText) {
          setActiveTarget('PICKUP');
        }
      }
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

  const handleAddStop = () => {
    if (stops.length >= 12) {
      Alert.alert('Maximum Stops', 'You can add up to 12 stops per route.');
      return;
    }
    const newIdx = stops.length;
    const newStop: StopItem = {
      id: `stop-${Date.now()}-${newIdx}`,
      label: '',
    };
    setStops((prev) => [...prev, newStop]);
    setActiveTarget('STOP');
    setActiveStopIndex(newIdx);
    setSearchQuery('');
    setTimeout(() => {
      routeCardScrollRef.current?.scrollToEnd({ animated: true });
      stopInputRefs.current[newIdx]?.focus();
    }, 150);
  };

  const handleRemoveStop = (indexToRemove: number) => {
    const nextStops = stops.filter((_, idx) => idx !== indexToRemove);
    setStops(nextStops);
    onRemoveStop?.(indexToRemove);
    if (activeTarget === 'STOP') {
      if (nextStops.length === 0) {
        setActiveTarget('DROP');
        setActiveStopIndex(0);
      } else if (activeStopIndex >= nextStops.length) {
        setActiveStopIndex(nextStops.length - 1);
      }
    }
  };

  const handleUpdateStopText = (index: number, text: string) => {
    setStops((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, label: text } : s))
    );
    setSearchQuery(text);
  };

  const handleConfirmAndClose = () => {
    let pLoc: PlaceLocation | null = null;
    if (pickupText.trim()) {
      if (pickupItem && pickupItem.label.toLowerCase() === pickupText.trim().toLowerCase()) {
        pLoc = pickupItem;
      } else {
        const match = ALL_LOCATIONS.find(
          (l) => l.label.toLowerCase() === pickupText.trim().toLowerCase()
        );
        pLoc = match || {
          label: pickupText.trim(),
          sublabel: 'Pickup Location',
          lat: 12.9141,
          lng: 74.8560,
        };
      }
      onSelectPickup?.(pLoc);
      if (isPickup !== false) onSelect?.(pLoc);
    }

    if (hideDrop || singleLocationOnly) {
      if (isPickup !== false) {
        onConfirmRoute?.({
          pickup: pLoc,
          drop: null,
          stops: [],
        });
      } else {
        let dLoc: PlaceLocation | null = null;
        if (dropText.trim()) {
          if (dropItem && dropItem.label.toLowerCase() === dropText.trim().toLowerCase()) {
            dLoc = dropItem;
          } else {
            const match = ALL_LOCATIONS.find(
              (l) => l.label.toLowerCase() === dropText.trim().toLowerCase()
            );
            dLoc = match || {
              label: dropText.trim(),
              sublabel: 'Destination',
              lat: 12.9141,
              lng: 74.8560,
            };
          }
          onSelectDrop?.(dLoc);
          onSelect?.(dLoc);
        }
        onConfirmRoute?.({
          pickup: null,
          drop: dLoc,
          stops: [],
        });
      }
      onClose();
      return;
    }

    const validStops: PlaceLocation[] = stops
      .filter((s) => s.label.trim().length > 0)
      .map((s) => {
        if (s.location) return s.location;
        const match = ALL_LOCATIONS.find(
          (l) => l.label.toLowerCase() === s.label.trim().toLowerCase()
        );
        return (
          match || {
            label: s.label.trim(),
            sublabel: 'Via Stop',
            lat: 12.9141,
            lng: 74.8560,
          }
        );
      });

    let dLoc: PlaceLocation | null = null;
    if (dropText.trim()) {
      if (dropItem && dropItem.label.toLowerCase() === dropText.trim().toLowerCase()) {
        dLoc = dropItem;
      } else {
        const match = ALL_LOCATIONS.find(
          (l) => l.label.toLowerCase() === dropText.trim().toLowerCase()
        );
        dLoc = match || {
          label: dropText.trim(),
          sublabel: 'Destination',
          lat: 12.9141,
          lng: 74.8560,
        };
      }
      onSelectDrop?.(dLoc);
      if (!isPickup) onSelect?.(dLoc);
    }

    if (pickupText.trim() && dropText.trim() && isSameLocation(pLoc || pickupText, dLoc || dropText)) {
      Alert.alert(
        t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
        t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
      );
      return;
    }

    if (pickupText.trim() && validStops.some((s) => isSameLocation(pLoc || pickupText, s))) {
      Alert.alert(
        t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
        t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
      );
      return;
    }

    if (dropText.trim() && validStops.some((s) => isSameLocation(dLoc || dropText, s))) {
      Alert.alert(
        t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
        t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
      );
      return;
    }

    onConfirmRoute?.({
      pickup: pLoc,
      drop: dLoc,
      stops: validStops,
    });

    onClose();
  };

  const currentPickupDisplay = pickupValue || (isPickup ? currentValue : '') || ', Mangaluru, Karnataka 575001, India';
  const currentDropDisplay = dropValue || (!isPickup ? currentValue : '') || t('modals.locationPicker.enterDrop', { defaultValue: 'Drop location' });

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { paddingTop: topInset }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          {/* Header */}
          <View style={[styles.header, isSmallDevice && { paddingHorizontal: 12, paddingBottom: 8 }]}>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, isSmallDevice && { width: 34, height: 34, borderRadius: 17 }]} activeOpacity={0.7}>
              <Ionicons name="close" size={isSmallDevice ? 18 : 20} color="rgb(22, 34, 50)" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text
                style={[styles.headerTitle, isSmallDevice && { fontSize: 16 }]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {modalTitle}
              </Text>
              <Text style={[styles.headerSubtitle, isSmallDevice && { fontSize: 11 }]} numberOfLines={1}>
                {hideDrop || singleLocationOnly
                  ? t('modals.locationPicker.tapLandmarkOrType', { defaultValue: 'Tap landmark or type address' })
                  : activeTarget === 'PICKUP'
                  ? t('modals.locationPicker.editingPickup', { defaultValue: 'Editing Pickup • Tap landmark or type' })
                  : activeTarget === 'STOP'
                  ? t('modals.locationPicker.editingStop', { index: activeStopIndex + 1, defaultValue: `Editing Stop ${activeStopIndex + 1} • Tap landmark or type` })
                  : t('modals.locationPicker.editingDrop', { defaultValue: 'Editing Drop • Tap landmark or type' })}
              </Text>
            </View>
            {((!hideDrop && !singleLocationOnly && pickupText.trim().length > 0 && dropText.trim().length > 0) ||
              ((hideDrop || singleLocationOnly) && (isPickup !== false ? pickupText.trim().length > 0 : dropText.trim().length > 0))) ? (
              <TouchableOpacity onPress={handleConfirmAndClose} style={[styles.headerDoneBtn, isSmallDevice && { paddingHorizontal: 10, paddingVertical: 5 }]} activeOpacity={0.7}>
                <Text style={[styles.headerDoneText, isSmallDevice && { fontSize: 12.5 }]}>
                  {t('common.done', { defaultValue: 'Done' })}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: isSmallDevice ? 32 : 36 }} />
            )}
          </View>

          {/* Connected Multi-Stop Route Card (Supporting up to 12 stops) */}
          <View style={[styles.routeCardWrapper, isSmallDevice && { marginHorizontal: 10, marginTop: 6 }]}>
            <ScrollView
              ref={routeCardScrollRef}
              style={styles.routeCardScroll}
              contentContainerStyle={styles.routeCard}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={stops.length > 2}
            >
              {/* Timeline Column */}
              <View style={[styles.timelineCol, (hideDrop || singleLocationOnly) && { justifyContent: 'center' }]}>
                <Ionicons
                  name="location-sharp"
                  size={20}
                  color={singleLocationOnly && isPickup === false ? '#ef4444' : '#16a34a'}
                />
                {!hideDrop && !singleLocationOnly && (
                  <>
                    <View style={styles.timelineLine} />
                    {!hideStops && stops.map((stop, idx) => {
                      const isStopActive = activeTarget === 'STOP' && activeStopIndex === idx;
                      return (
                        <React.Fragment key={`tl-${stop.id || idx}`}>
                          <View
                            style={[
                              styles.circleStopNode,
                              isStopActive && styles.circleStopNodeActive,
                            ]}
                          >
                            <Text style={styles.circleStopText}>{idx + 1}</Text>
                          </View>
                          <View style={styles.timelineLine} />
                        </React.Fragment>
                      );
                    })}
                    <Ionicons name="location-sharp" size={20} color="#ef4444" />
                  </>
                )}
              </View>

              {/* Route Fields Column */}
              <View style={styles.routeFieldsCol}>
                {/* Pickup Row with TextInput */}
                {(!singleLocationOnly || isPickup !== false) && (
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => {
                      setActiveTarget('PICKUP');
                      setSearchQuery(pickupAirportsOnly ? '' : pickupText);
                      pickupInputRef.current?.focus();
                    }}
                    style={[
                      styles.routeFieldRow,
                      activeTarget === 'PICKUP' && styles.routeFieldRowActive,
                    ]}
                  >
                    <TextInput
                      ref={pickupInputRef}
                      style={[
                        styles.routeInput,
                        activeTarget === 'PICKUP' && styles.routeInputActive,
                      ]}
                      value={pickupText}
                      onChangeText={(t) => {
                        setPickupText(t);
                        setSearchQuery(t);
                      }}
                      onFocus={() => {
                        setActiveTarget('PICKUP');
                        setSearchQuery(pickupAirportsOnly ? '' : pickupText);
                      }}
                      placeholder={
                        pickupPlaceholder ||
                        (pickupAirportsOnly ? t('modals.locationPicker.enterAirport', { defaultValue: 'Enter airport location' }) : t('modals.locationPicker.enterPickup', { defaultValue: 'Enter pickup location' }))
                      }
                      placeholderTextColor="#94a3b8"
                    />
                    {pickupText.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setPickupText('');
                          setSearchQuery('');
                          pickupInputRef.current?.focus();
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        style={{ paddingHorizontal: 4 }}
                      >
                        <Ionicons name="close-circle" size={17} color="#94a3b8" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                )}

                {/* Multiple Stops & Drop Rows (only when drop is allowed) */}
                {!hideDrop && !singleLocationOnly && (
                  <>
                    {!hideStops && stops.map((stop, idx) => {
                      const isStopActive = activeTarget === 'STOP' && activeStopIndex === idx;
                      return (
                        <React.Fragment key={`field-${stop.id || idx}`}>
                          <View style={styles.routeDivider} />
                          <TouchableOpacity
                            activeOpacity={0.95}
                            onPress={() => {
                              setActiveTarget('STOP');
                              setActiveStopIndex(idx);
                              setSearchQuery(stop.label);
                              stopInputRefs.current[idx]?.focus();
                            }}
                            style={[
                              styles.routeFieldRow,
                              isStopActive && styles.routeFieldRowActive,
                            ]}
                          >
                            <TextInput
                              ref={(ref) => {
                                stopInputRefs.current[idx] = ref;
                              }}
                              style={[
                                styles.routeInput,
                                isStopActive && styles.routeInputActive,
                              ]}
                              value={stop.label}
                              onChangeText={(t) => handleUpdateStopText(idx, t)}
                              onFocus={() => {
                                setActiveTarget('STOP');
                                setActiveStopIndex(idx);
                                setSearchQuery(stop.label);
                              }}
                              placeholder={t('modals.locationPicker.addStopPlaceholder', { defaultValue: `Add Stop ${idx + 1}`, index: idx + 1 })}
                              placeholderTextColor="#475569"
                            />
                            <View style={styles.stopActions}>
                              {stop.label.length > 0 && (
                                <TouchableOpacity
                                  onPress={() => {
                                    handleUpdateStopText(idx, '');
                                    setSearchQuery('');
                                    stopInputRefs.current[idx]?.focus();
                                  }}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  activeOpacity={0.7}
                                  style={{ marginRight: 6 }}
                                >
                                  <Ionicons name="close-circle" size={17} color="#94a3b8" />
                                </TouchableOpacity>
                              )}
                              <Ionicons
                                name="reorder-two-outline"
                                size={21}
                                color="#475569"
                                style={{ marginRight: 8 }}
                              />
                              <TouchableOpacity
                                onPress={() => handleRemoveStop(idx)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="close" size={17} color="#64748b" />
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        </React.Fragment>
                      );
                    })}

                    <View style={styles.routeDivider} />

                    {/* Drop Row with TextInput */}
                    <TouchableOpacity
                      activeOpacity={0.95}
                      onPress={() => {
                        setActiveTarget('DROP');
                        setSearchQuery(dropAirportsOnly ? '' : dropText);
                        dropInputRef.current?.focus();
                      }}
                      style={[
                        styles.routeFieldRow,
                        activeTarget === 'DROP' && styles.routeFieldRowActive,
                      ]}
                    >
                      <TextInput
                        ref={dropInputRef}
                        style={[
                          styles.routeInput,
                          activeTarget === 'DROP' && styles.routeInputActive,
                        ]}
                        value={dropText}
                        onChangeText={(t) => {
                          setDropText(t);
                          setSearchQuery(t);
                        }}
                        onFocus={() => {
                          setActiveTarget('DROP');
                          setSearchQuery(dropAirportsOnly ? '' : dropText);
                        }}
                        placeholder={
                          dropPlaceholder ||
                          (dropAirportsOnly ? t('modals.locationPicker.enterAirport', { defaultValue: 'Enter airport location' }) : t('modals.locationPicker.enterDrop', { defaultValue: 'Drop location' }))
                        }
                        placeholderTextColor="#64748b"
                      />
                      {dropText.length > 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            setDropText('');
                            setSearchQuery('');
                            dropInputRef.current?.focus();
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                          style={{ paddingHorizontal: 4 }}
                        >
                          <Ionicons name="close-circle" size={17} color="#94a3b8" />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {/* Single Location Only Drop Row (e.g. return drop modal where isPickup === false) */}
                {singleLocationOnly && isPickup === false && (
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => {
                      setActiveTarget('DROP');
                      setSearchQuery(dropAirportsOnly ? '' : dropText);
                      dropInputRef.current?.focus();
                    }}
                    style={[
                      styles.routeFieldRow,
                      activeTarget === 'DROP' && styles.routeFieldRowActive,
                    ]}
                  >
                    <TextInput
                      ref={dropInputRef}
                      style={[
                        styles.routeInput,
                        activeTarget === 'DROP' && styles.routeInputActive,
                      ]}
                      value={dropText}
                      onChangeText={(t) => {
                        setDropText(t);
                        setSearchQuery(t);
                      }}
                      onFocus={() => {
                        setActiveTarget('DROP');
                        setSearchQuery(dropAirportsOnly ? '' : dropText);
                      }}
                      placeholder={
                        dropPlaceholder ||
                        (dropAirportsOnly ? t('modals.locationPicker.enterAirport', { defaultValue: 'Enter airport location' }) : t('modals.locationPicker.enterDrop', { defaultValue: 'Enter drop location' }))
                      }
                      placeholderTextColor="#94a3b8"
                    />
                    {dropText.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setDropText('');
                          setSearchQuery('');
                          dropInputRef.current?.focus();
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        style={{ paddingHorizontal: 4 }}
                      >
                        <Ionicons name="close-circle" size={17} color="#94a3b8" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>

          {/* Action Pills: Current Location & Add Stops (Right side of Current Location) */}
          <View style={[styles.actionPillsRow, isSmallDevice && { paddingHorizontal: 10, marginTop: 6 }]}>
            {!isTargetAirportOnly && isPickup !== false && (
              <TouchableOpacity
                style={styles.currentLocationPill}
                onPress={handleUseCurrentLocation}
                disabled={gpsLoading}
                activeOpacity={0.7}
              >
                <View style={styles.currentLocationIconCircle}>
                  {gpsLoading ? (
                    <ActivityIndicator size="small" color="rgb(240, 117, 15)" />
                  ) : (
                    <Ionicons name="navigate" size={15} color="rgb(240, 117, 15)" />
                  )}
                </View>
                <Text style={styles.currentLocationText}>
                  {t('modals.locationPicker.useCurrentLocation', { defaultValue: 'Use my location' })}
                </Text>
              </TouchableOpacity>
            )}

            {isTargetAirportOnly && (
              <View style={styles.airportNoticePill}>
                <View style={styles.airportNoticeIconCircle}>
                  <Ionicons name="airplane" size={13} color="rgb(240, 117, 15)" />
                </View>
                <Text style={styles.airportNoticeText}>{t('modals.locationPicker.airportOnly', { defaultValue: 'Airport Locations Only' })}</Text>
              </View>
            )}

            {!isTargetAirportOnly && !hideDrop && !singleLocationOnly && !hideStops && stops.length < 12 && (
              <TouchableOpacity
                style={[styles.addStopsPill, isPickup === false && { marginLeft: 'auto' }]}
                onPress={handleAddStop}
                activeOpacity={0.7}
              >
                <View style={styles.addStopsIconCircle}>
                  <Ionicons name="add" size={16} color="rgb(22, 34, 50)" />
                </View>
                <Text style={styles.addStopsText}>
                  {stops.length === 0 ? t('modals.locationPicker.addStops', { defaultValue: 'Add stops' }) : t('modals.locationPicker.addStopNum', { defaultValue: `Add Stop ${stops.length + 1}`, number: stops.length + 1 })}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Locations List (Starts immediately below Action Pills, Search Bar Removed) */}
          <FlatList
            data={filteredLocations}
            keyExtractor={(item, index) => `${item.label}-${index}`}
            contentContainerStyle={[styles.listContent, isSmallDevice && { paddingHorizontal: 10, paddingTop: 2 }]}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            renderItem={({ item }) => {
              const isItemAirport = isAirportLocation(item);
              const isSelected =
                (activeTarget === 'PICKUP' && pickupText === item.label) ||
                (activeTarget === 'STOP' && stops[activeStopIndex]?.label === item.label) ||
                (activeTarget === 'DROP' && dropText === item.label) ||
                currentValue === item.label;
              const pinColor = isItemAirport ? 'rgb(240, 117, 15)' : (activeTarget === 'DROP' ? '#ef4444' : '#16a34a');

              return (
                <TouchableOpacity
                  style={[styles.locationItem, isSelected && styles.locationItemSelected, isSmallDevice && { paddingVertical: 10, paddingHorizontal: 10 }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (hideDrop || singleLocationOnly) {
                      if (isPickup !== false) {
                        if (dropLocation && isSameLocation(item, dropLocation)) {
                          Alert.alert(
                            t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
                            t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
                          );
                          return;
                        }
                        setPickupItem(item);
                        setPickupText(item.label);
                        onSelectPickup?.(item);
                        onSelect?.(item);
                        onConfirmRoute?.({
                          pickup: item,
                          drop: null,
                          stops: [],
                        });
                        onClose();
                      } else {
                        if (pickupLocation && isSameLocation(item, pickupLocation)) {
                          Alert.alert(
                            t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
                            t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
                          );
                          return;
                        }
                        setDropItem(item);
                        setDropText(item.label);
                        onSelectDrop?.(item);
                        onSelect?.(item);
                        onConfirmRoute?.({
                          pickup: null,
                          drop: item,
                          stops: [],
                        });
                        onClose();
                      }
                      return;
                    }

                    if (activeTarget === 'PICKUP') {
                      if (dropText.trim() && isSameLocation(item, dropItem || dropText)) {
                        Alert.alert(
                          t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
                          t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
                        );
                        return;
                      }
                      const matchStop = stops.find((s) => s.label && isSameLocation(item, s.location || s.label));
                      if (matchStop) {
                        Alert.alert(
                          t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
                          t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
                        );
                        return;
                      }
                      setPickupItem(item);
                      setPickupText(item.label);
                      onSelectPickup?.(item);
                      setSearchQuery('');
                      if (stops.length > 0 && !stops[0].label) {
                        setActiveTarget('STOP');
                        setActiveStopIndex(0);
                      } else {
                        setActiveTarget('DROP');
                      }
                    } else if (activeTarget === 'STOP') {
                      if (pickupText.trim() && isSameLocation(item, pickupItem || pickupText)) {
                        Alert.alert(
                          t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
                          t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
                        );
                        return;
                      }
                      if (dropText.trim() && isSameLocation(item, dropItem || dropText)) {
                        Alert.alert(
                          t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
                          t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
                        );
                        return;
                      }
                      const matchOtherStop = stops.find(
                        (s, idx) => idx !== activeStopIndex && s.label && isSameLocation(item, s.location || s.label)
                      );
                      if (matchOtherStop) {
                        Alert.alert(
                          t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
                          t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
                        );
                        return;
                      }
                      setStops((prev) =>
                        prev.map((s, idx) =>
                          idx === activeStopIndex ? { ...s, label: item.label, location: item } : s
                        )
                      );
                      setSearchQuery('');
                      if (activeStopIndex + 1 < stops.length) {
                        setActiveStopIndex(activeStopIndex + 1);
                      } else {
                        setActiveTarget('DROP');
                      }
                    } else {
                      if (pickupText.trim() && isSameLocation(item, pickupItem || pickupText)) {
                        Alert.alert(
                          t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
                          t('modals.locationPicker.sameLocationMsg', { defaultValue: 'Pickup and drop location cannot be the same. Please choose a different destination.' })
                        );
                        return;
                      }
                      const matchStop = stops.find((s) => s.label && isSameLocation(item, s.location || s.label));
                      if (matchStop) {
                        Alert.alert(
                          t('modals.locationPicker.sameLocationTitle', { defaultValue: 'Same Location Selected' }),
                          t('modals.locationPicker.sameStopMsg', { defaultValue: 'Stop location cannot be the same as pickup or drop location.' })
                        );
                        return;
                      }
                      setDropItem(item);
                      setDropText(item.label);
                      onSelectDrop?.(item);
                      setSearchQuery('');
                      if (!pickupText) {
                        setActiveTarget('PICKUP');
                      }
                    }
                  }}
                >
                  <View style={[styles.iconContainer, isItemAirport && styles.airportIconContainer, isSmallDevice && { width: 26, marginRight: 8 }]}>
                    <Ionicons
                      name={isItemAirport ? 'airplane' : 'location-sharp'}
                      size={isItemAirport ? (isSmallDevice ? 17 : 19) : (isSmallDevice ? 20 : 23)}
                      color={pinColor}
                    />
                  </View>
                  <View style={styles.locationTextContainer}>
                    <Text
                      style={[
                        styles.locationLabel,
                        isSelected && styles.locationLabelSelected,
                        isSmallDevice && { fontSize: 13.5 },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                      minimumFontScale={0.8}
                    >
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text
                        style={[styles.locationSublabel, isSmallDevice && { fontSize: 11.5 }]}
                        numberOfLines={1}
                      >
                        {item.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={isSmallDevice ? 19 : 22} color="rgb(240, 117, 15)" />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name={isTargetAirportOnly ? 'airplane-outline' : 'location-outline'} size={48} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>
                  {isTargetAirportOnly ? t('modals.locationPicker.noAirports', { defaultValue: 'No matching airports found' }) : t('modals.locationPicker.noLocations', { defaultValue: 'No matching locations found' })}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {isTargetAirportOnly ? t('modals.locationPicker.trySearchAirport', { defaultValue: 'Try searching airport name or city' }) : t('modals.locationPicker.trySearchLandmark', { defaultValue: 'Try searching or selecting a landmark' })}
                </Text>
              </View>
            }
          />

          {/* Confirm Button */}
          {((!hideDrop && !singleLocationOnly && pickupText.trim().length > 0 && dropText.trim().length > 0) ||
            ((hideDrop || singleLocationOnly) && (isPickup !== false ? pickupText.trim().length > 0 : dropText.trim().length > 0))) && (
            <View
              style={[
                styles.confirmDock,
                { paddingBottom: Math.max(insets.bottom, 12) },
                isSmallDevice && { paddingHorizontal: 12, paddingVertical: 8 },
              ]}
            >
              <TouchableOpacity
                style={[styles.confirmBtn, isSmallDevice && { paddingVertical: 10 }]}
                activeOpacity={0.85}
                onPress={handleConfirmAndClose}
              >
                <Text style={[styles.confirmBtnText, isSmallDevice && { fontSize: 13.5 }]}>
                  {hideDrop || singleLocationOnly
                    ? (isPickup !== false ? t('common.confirm', { defaultValue: 'Confirm Pickup' }) : t('common.confirm', { defaultValue: 'Confirm Location' }))
                    : t('modals.locationPicker.confirmRoute', { defaultValue: 'Confirm Route' })}
                </Text>
                <Ionicons name="arrow-forward" size={isSmallDevice ? 16 : 18} color="#ffffff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          )}
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
    color: 'rgb(22, 34, 50)',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    fontWeight: '500',
  },
  headerDoneBtn: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgb(240, 117, 15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgb(240, 117, 15)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  headerDoneText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  // Connected Route Card (supporting up to 12 stops)
  routeCardWrapper: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    maxHeight: 240,
    overflow: 'hidden',
  },
  routeCardScroll: {
    maxHeight: 240,
  },
  routeCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  timelineCol: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  timelineLine: {
    width: 2.5,
    flex: 1,
    backgroundColor: '#475569',
    marginVertical: 3,
  },
  circleStopNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleStopNodeActive: {
    backgroundColor: 'rgb(240, 117, 15)',
    borderColor: 'rgb(240, 117, 15)',
  },
  circleStopText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  routeFieldsCol: {
    flex: 1,
    marginLeft: 8,
  },
  routeFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Platform.OS === 'ios' ? 7 : 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  routeFieldRowActive: {
    backgroundColor: '#fffaf5',
    borderColor: 'rgb(240, 117, 15)',
  },
  routeInput: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    paddingHorizontal: 4,
    letterSpacing: -0.2,
  },
  routeInputActive: {
    color: 'rgb(22, 34, 50)',
    fontWeight: '800',
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  stopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },

  // Action Pills Row: Current Location & Add Stops
  actionPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
  },
  currentLocationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 3.5,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  currentLocationIconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    marginLeft: 4,
  },
  currentLocationText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.2,
  },
  addStopsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 3.5,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  addStopsIconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    marginLeft: 4,
  },
  addStopsText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.2,
  },

  confirmDock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(240, 117, 15)',
    paddingVertical: 13,
    borderRadius: 24,
    shadowColor: 'rgb(240, 117, 15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
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
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
  },
  locationItemSelected: {
    borderColor: 'rgb(240, 117, 15)',
    backgroundColor: '#fffaf5',
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  locationLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.2,
  },
  locationLabelSelected: {
    color: 'rgb(240, 117, 15)',
  },
  locationSublabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2.5,
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
  airportNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  airportNoticeIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  airportNoticeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#c2410c',
  },
  airportIconContainer: {
    backgroundColor: '#fff7ed',
    borderRadius: 15,
  },
});
