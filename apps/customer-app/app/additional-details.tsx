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
  TextInput,
  Switch,
  Image,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import BookingFlowHeader from '../components/BookingFlowHeader';

interface LuggageOption {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const LUGGAGE_OPTIONS: LuggageOption[] = [
  {
    id: 'NORMAL',
    label: 'Normal Luggage',
    shortLabel: 'Normal Luggage',
    description: '2 Standard suitcases',
    icon: 'bag-handle-outline',
  },
  {
    id: 'HAND_BAGS',
    label: 'Hand Bags Only',
    shortLabel: 'Hand Bags Only',
    description: 'Backpacks & small bags',
    icon: 'briefcase-outline',
  },
  {
    id: 'EXTRA_HEAVY',
    label: 'Heavy / Extra Luggage',
    shortLabel: 'Heavy Luggage',
    description: '3+ Large suitcases / cargo',
    icon: 'cube-outline',
  },
  {
    id: 'NO_LUGGAGE',
    label: 'No Luggage',
    shortLabel: 'No Luggage',
    description: 'Cabin bags only',
    icon: 'walk-outline',
  },
];

interface QuickTagItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const QUICK_TAGS: QuickTagItem[] = [
  { id: 'baby', label: 'Baby on Board', icon: 'heart-outline' },
  { id: 'boot', label: 'Extra Boot Space', icon: 'cube-outline' },
  { id: 'silent', label: 'Silent Ride', icon: 'volume-mute-outline' },
  { id: 'elderly', label: 'Elderly Passenger', icon: 'accessibility-outline' },
  { id: 'pet', label: 'Pet Friendly', icon: 'paw-outline' },
];

export default function AdditionalDetailsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  // Vehicle and Route params passed from select-cab
  const pickup = (params.pickup as string) || 'Mangaluru Airport (IXE)';
  const drop = (params.drop as string) || 'Bengaluru (Bangalore)';
  const pickupDate = (params.date as string) || '28-09-2026';
  const pickupTime = (params.time as string) || '09:00';
  const tripType = (params.tripType as string) || 'ONEWAY';
  const localHours = (params.localHours as string) || '8';
  const category = (params.category as string) || 'HATCHBACK';
  const selectedVehicleName = (params.selectedVehicleName as string) || 'Compact';
  const ratePerKm = (params.ratePerKm as string) || '11';
  const minKm = (params.minKm as string) || '50';
  const maxSeats = Number(params.maxSeats) || 4;
  const hasCarrier = (params.hasCarrier as string) === 'true';
  const carrierText = (params.carrierText as string) || '';
  const carrierExcludedCars = (params.carrierExcludedCars as string) || '';
  const seaterVariant = (params.seaterVariant as string) || '';
  const seaterLabel = (params.seaterLabel as string) || '';
  const wheelbase = (params.wheelbase as string) || '';

  // 1. Number of Passengers state (Default to maxSeats or 4)
  const [passengerCount, setPassengerCount] = useState<number>(
    maxSeats >= 10 ? Math.min(maxSeats, 10) : Math.min(4, maxSeats)
  );

  // 2. Luggage Details state
  const [selectedLuggage, setSelectedLuggage] = useState<string>('No Luggage');

  // 3. Roof Carrier state
  const [requestCarrier, setRequestCarrier] = useState<boolean>(false);

  // 4. Special Requirements state
  const [specialRequirements, setSpecialRequirements] = useState<string>('');

  const handleDecrement = () => {
    if (passengerCount > 1) {
      setPassengerCount((prev) => prev - 1);
    }
  };

  const handleIncrement = () => {
    if (passengerCount < maxSeats) {
      setPassengerCount((prev) => prev + 1);
    }
  };

  const toggleQuickTag = (tagLabel: string) => {
    const isPresent = specialRequirements.includes(tagLabel);
    if (isPresent) {
      const regex = new RegExp(`(^|,\\s*)${tagLabel}`, 'g');
      const updated = specialRequirements.replace(regex, '').replace(/^,\s*/, '').trim();
      setSpecialRequirements(updated);
    } else {
      const updated = specialRequirements.trim()
        ? `${specialRequirements.trim()}, ${tagLabel}`
        : tagLabel;
      setSpecialRequirements(updated);
    }
  };

  const handleProceed = () => {
    router.push({
      pathname: '/booking',
      params: {
        ...params,
        passengers: String(passengerCount),
        luggage: selectedLuggage,
        requestCarrier: requestCarrier ? 'true' : 'false',
        hasPet: specialRequirements.includes('Pet Friendly') ? 'true' : 'false',
        specialRequirements: specialRequirements.trim(),
      },
    });
  };

  const getVehicleImage = (cat: string) => {
    switch (cat?.toUpperCase()) {
      case 'HATCHBACK':
        return require('../assets/images/fleet-hatchback.png');
      case 'SWIFT_DZIRE':
      case 'SEDAN':
        return require('../assets/images/fleet-sedan.png');
      case 'TOYOTA_ETIOS':
        return require('../assets/images/fleet-4-sedan.png');
      case 'SUV_ERTIGA':
      case 'SUV':
        return require('../assets/images/fleet-suv.png');
      case 'SUV_CRYSTA':
      case 'CRYSTA':
        return require('../assets/images/fleet-crysta.png');
      case 'TEMPO_TRAVELER':
      case 'TRAVELLER':
        return require('../assets/images/fleet-traveller.png');
      case 'URBANIA':
        return require('../assets/images/fleet-urbania.png');
      default:
        return require('../assets/images/fleet-hatchback.png');
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat?.toUpperCase()) {
      case 'HATCHBACK':
        return 'ECONOMY CHOICE';
      case 'SEDAN':
        return 'MOST POPULAR';
      case 'SUV':
        return 'FAMILY SPACIOUS';
      case 'CRYSTA':
        return 'VIP LUXURY';
      case 'TRAVELLER':
      case 'URBANIA':
        return 'GROUP TRAVEL';
      default:
        return 'ASSURED CAB';
    }
  };

  const getTripTypeLabel = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'ROUND_TRIP':
        return 'Round Trip';
      case 'LOCAL':
        return `Rental (${localHours}h)`;
      case 'AIRPORT':
        return 'Airport';
      case 'ONEWAY':
      default:
        return 'One-Way';
    }
  };

  const pickupCity = pickup.split(',')[0].trim();
  const dropCity = drop.split(',')[0].trim();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* Header Bar */}
      <BookingFlowHeader
        currentStep={2}
        title={t('additionalDetails.title', { defaultValue: 'Vehicle Options' })}
        subStepLabel={t('additionalDetails.subtitle', { defaultValue: 'Luggage & Travellers' })}
        topInset={0}
        onBack={() => router.back()}
        onStep1Press={() => {
          router.navigate({
            pathname: '/trip-details',
            params: {
              ...params,
              tripType,
            },
          });
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 85, 105) },
            isSmallDevice && { paddingHorizontal: 10 },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* 1. Selected Vehicle Hero Card */}
          <View style={styles.vehicleHeroCard}>
            <View style={styles.vehicleHeroTopRow}>
              <View style={styles.vehicleImageWrap}>
                <Image
                  source={getVehicleImage(category)}
                  style={styles.vehicleHeroImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.vehicleHeroInfo}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{getCategoryBadge(category)}</Text>
                </View>
                <Text style={styles.vehicleHeroName} numberOfLines={1}>
                  {selectedVehicleName}
                </Text>
                <View style={styles.specsPillRow}>
                  <View style={styles.microSpec}>
                    <Ionicons name="people" size={11} color="#64748b" />
                    <Text style={styles.microSpecText}>{maxSeats} Seats</Text>
                  </View>
                  <View style={styles.microSpec}>
                    <Ionicons name="briefcase" size={11} color="#64748b" />
                    <Text style={styles.microSpecText}>
                      {maxSeats >= 6 ? '4+ Bags' : '2-3 Bags'}
                    </Text>
                  </View>
                  <View style={styles.microSpec}>
                    <Ionicons name="snow" size={11} color="#64748b" />
                    <Text style={styles.microSpecText}>AC</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Clean Route Strip */}
            <View style={styles.routePillStrip}>
              <Ionicons name="navigate-circle" size={15} color="rgb(240, 117, 15)" />
              <Text style={styles.routePillText} numberOfLines={1}>
                {pickupCity} ➔ {dropCity}
              </Text>
              <View style={styles.tripTypeBadge}>
                <Text style={styles.tripTypeBadgeText}>{getTripTypeLabel(tripType)}</Text>
              </View>
            </View>
          </View>

          {/* 2. Passengers & Luggage Card */}
          <View style={styles.cardSection}>
            {/* Passengers Row */}
            <View style={styles.passengerRow}>
              <View style={styles.passengerTextGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="people-outline" size={18} color="#0f172a" />
                  <Text style={styles.cardSectionTitle}>Travellers</Text>
                </View>
                <Text style={styles.cardSectionSubtitle}>
                  {passengerCount} of max {maxSeats} seats selected
                </Text>
              </View>

              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={[styles.stepperBtn, passengerCount <= 1 && styles.stepperBtnDisabled]}
                  onPress={handleDecrement}
                  disabled={passengerCount <= 1}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="remove"
                    size={16}
                    color={passengerCount <= 1 ? '#cbd5e1' : '#0f172a'}
                  />
                </TouchableOpacity>

                <View style={styles.stepperValueContainer}>
                  <Text style={styles.stepperValueText}>{passengerCount}</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.stepperBtn,
                    passengerCount >= maxSeats && styles.stepperBtnDisabled,
                  ]}
                  onPress={handleIncrement}
                  disabled={passengerCount >= maxSeats}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name="add"
                    size={16}
                    color={passengerCount >= maxSeats ? '#cbd5e1' : '#0f172a'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.cardDivider} />

            {/* Luggage 2x2 Grid */}
            <View style={styles.luggageSection}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="bag-handle-outline" size={17} color="#0f172a" />
                <Text style={styles.cardSectionTitle}>Luggage Load</Text>
              </View>

              <View style={styles.luggageGrid}>
                {LUGGAGE_OPTIONS.map((item) => {
                  const isSelected = selectedLuggage === item.label;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.luggageGridItem, isSelected && styles.luggageGridItemSelected]}
                      onPress={() => setSelectedLuggage(item.label)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.luggageIconCircle,
                          isSelected && styles.luggageIconCircleSelected,
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={16}
                          color={isSelected ? 'rgb(240, 117, 15)' : '#64748b'}
                        />
                      </View>
                      <View style={styles.luggageItemTexts}>
                        <Text
                          style={[
                            styles.luggageItemTitle,
                            isSelected && styles.luggageItemTitleSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item.shortLabel}
                        </Text>
                        <Text
                          style={[
                            styles.luggageItemDesc,
                            isSelected && styles.luggageItemDescSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {item.description}
                        </Text>
                      </View>
                      {isSelected ? (
                        <View style={styles.checkedBadge}>
                          <Ionicons name="checkmark-circle" size={15} color="rgb(240, 117, 15)" />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Roof Carrier Option */}
            {hasCarrier ? (
              <>
                <View style={styles.cardDivider} />
                <TouchableOpacity
                  style={styles.carrierCard}
                  onPress={() => setRequestCarrier((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <View style={styles.carrierIconBox}>
                    <Image
                      source={require('../assets/images/roof-carrier-icon.png')}
                      style={{ width: 25, height: 21, resizeMode: 'contain', tintColor: 'rgb(240, 117, 15)' }}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.carrierTitle}>
                        Roof Luggage Carrier
                      </Text>
                      {requestCarrier ? (
                        <View style={styles.carrierAddedBadge}>
                          <Text style={styles.carrierAddedBadgeText}>Added ✓</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.carrierDesc}>
                      {carrierText || 'Up to 45 kg rooftop luggage space'}
                    </Text>
                  </View>

                  <View pointerEvents="none">
                    <Switch
                      value={requestCarrier}
                      trackColor={{ false: '#cbd5e1', true: 'rgb(240, 117, 15)' }}
                      thumbColor="#ffffff"
                      ios_backgroundColor="#cbd5e1"
                    />
                  </View>
                </TouchableOpacity>
              </>
            ) : null}

            {carrierExcludedCars ? (
              <View style={styles.carrierNoteBox}>
                <Ionicons name="information-circle-outline" size={14} color="#b45309" />
                <Text style={styles.carrierNoteText}>{carrierExcludedCars}</Text>
              </View>
            ) : null}
          </View>

          {/* 3. Ride Preferences & Special Notes Card */}
          <View style={styles.cardSection}>
            <View style={styles.preferencesHeader}>
              <Ionicons name="options-outline" size={17} color="#0f172a" />
              <Text style={styles.cardSectionTitle}>Ride Preferences</Text>
              <Text style={styles.optionalHint}>(Optional)</Text>
            </View>

            {/* Quick Suggestion Pills */}
            <View style={styles.quickTagsContainer}>
              {QUICK_TAGS.map((tagItem) => {
                const isSelected = specialRequirements.includes(tagItem.label);
                return (
                  <TouchableOpacity
                    key={tagItem.id}
                    style={[
                      styles.quickTagPill,
                      isSelected && styles.quickTagPillSelected,
                    ]}
                    onPress={() => toggleQuickTag(tagItem.label)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={tagItem.icon}
                      size={13}
                      color={isSelected ? 'rgb(240, 117, 15)' : '#64748b'}
                    />
                    <Text
                      style={[
                        styles.quickTagText,
                        isSelected && styles.quickTagTextSelected,
                      ]}
                    >
                      {tagItem.id === 'pet' ? 'Pet Friendly (+₹500)' : tagItem.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Refined Text Input */}
            <TextInput
              style={styles.notesInput}
              placeholder="Any special notes (e.g. child seat, extra stops, elderly assistance)..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={2}
              value={specialRequirements}
              onChangeText={setSpecialRequirements}
              textAlignVertical="top"
            />
          </View>

          <View style={{ height: 90 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Sticky Action Button */}
      <View style={[styles.bottomDock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.proceedButton}
          onPress={handleProceed}
          activeOpacity={0.85}
        >
          <Text style={styles.proceedButtonText} numberOfLines={1} adjustsFontSizeToFit={true}>
            {t('additionalDetails.continueToReview', { defaultValue: 'Continue to Review' })}
          </Text>
          <Ionicons name="arrow-forward" size={17} color="#ffffff" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
  },

  // 1. Vehicle Hero Card
  vehicleHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  vehicleHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vehicleImageWrap: {
    width: 90,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 4,
  },
  vehicleHeroImage: {
    width: '100%',
    height: '100%',
  },
  vehicleHeroInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  vehicleHeroName: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  specsPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  microSpec: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  microSpecText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  routePillStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  routePillText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    marginLeft: 5,
    marginRight: 6,
  },
  tripTypeBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  tripTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
  },

  // Generic Card Section
  cardSection: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  cardSectionSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },

  // Passengers Row
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passengerTextGroup: {
    flex: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    gap: 2,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
    backgroundColor: '#f8fafc',
  },
  stepperValueContainer: {
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: {
    fontSize: 15,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },

  // Luggage Section
  luggageSection: {},
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  luggageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  luggageGridItem: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    gap: 7,
    position: 'relative',
  },
  luggageGridItemSelected: {
    backgroundColor: '#fff7ed',
    borderColor: 'rgb(240, 117, 15)',
  },
  luggageIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  luggageIconCircleSelected: {
    backgroundColor: '#ffedd5',
    borderColor: '#fed7aa',
  },
  luggageItemTexts: {
    flex: 1,
  },
  luggageItemTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  luggageItemTitleSelected: {
    color: 'rgb(240, 117, 15)',
    fontWeight: '800',
  },
  luggageItemDesc: {
    fontSize: 9,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1,
  },
  luggageItemDescSelected: {
    color: '#9a3412',
  },
  checkedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },

  // Roof Carrier
  carrierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  carrierIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  carrierTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  carrierAddedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  carrierAddedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
  },
  carrierDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  carrierNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fffbeb',
    marginTop: 8,
  },
  carrierNoteText: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: '600',
    flex: 1,
  },

  // Preferences & Notes
  preferencesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  optionalHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  quickTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  quickTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 9,
    paddingVertical: 5.5,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickTagPillSelected: {
    backgroundColor: '#fff7ed',
    borderColor: 'rgb(240, 117, 15)',
  },
  quickTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  quickTagTextSelected: {
    color: 'rgb(240, 117, 15)',
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 52,
    fontSize: 12,
    color: 'rgb(22, 34, 50)',
    fontWeight: '500',
  },

  // Bottom Sticky Action Button
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  proceedButton: {
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgb(240, 117, 15)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  proceedButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
