import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { driverApiClient } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';

type VehicleCategoryType = 'HATCHBACK' | 'SEDAN' | 'SUV' | 'SUV_PREMIUM' | 'TEMPO_TRAVELER';
type FuelTypeVal = 'DIESEL' | 'PETROL' | 'CNG';

const VEHICLE_CATEGORIES: Array<{
  id: VehicleCategoryType;
  title: string;
  defaultModel: string;
  models: string;
  seats: string;
  image: any;
}> = [
  {
    id: 'HATCHBACK',
    title: 'Hatchback',
    defaultModel: 'Maruti Suzuki WagonR',
    models: 'WagonR, Swift, Tiago, i10',
    seats: '4 Seats',
    image: require('../assets/images/fleet-hatchback.png'),
  },
  {
    id: 'SEDAN',
    title: 'Sedan',
    defaultModel: 'Maruti Suzuki Dzire',
    models: 'Dzire, Etios, Aura, Amaze',
    seats: '4 Seats',
    image: require('../assets/images/fleet-sedan.png'),
  },
  {
    id: 'SUV',
    title: 'SUV 6+1',
    defaultModel: 'Maruti Suzuki Ertiga',
    models: 'Ertiga, Carens, Triber, XL6',
    seats: '6 Seats',
    image: require('../assets/images/fleet-suv.png'),
  },
  {
    id: 'SUV_PREMIUM',
    title: 'SUV Premium 7+1',
    defaultModel: 'Toyota Innova Crysta',
    models: 'Innova Crysta, Hycross, XUV700',
    seats: '7 Seats',
    image: require('../assets/images/fleet-crysta.png'),
  },
  {
    id: 'TEMPO_TRAVELER',
    title: 'Tempo Traveller',
    defaultModel: 'Force Traveller 12 Seater',
    models: 'Force Traveller, Winger, Urbania',
    seats: '12 Seats',
    image: require('../assets/images/fleet-traveller.png'),
  },
];

const FUEL_TYPES: Array<{
  id: FuelTypeVal;
  label: string;
  iconName: 'funnel' | 'ellipse';
  iconColor: string;
}> = [
  { id: 'DIESEL', label: 'Diesel', iconName: 'funnel', iconColor: 'rgb(240, 117, 15)' },
  { id: 'PETROL', label: 'Petrol', iconName: 'funnel', iconColor: '#ef4444' },
  { id: 'CNG', label: 'CNG (Green)', iconName: 'ellipse', iconColor: '#16a34a' },
];

const CARRIAGE_OPTIONS = [
  'None (No Carriage / Luggage Space)',
  '2 Large Bags (Standard Boot)',
  '3 Large Bags (Spacious Boot)',
  '4 Large Bags (SUV Boot Space)',
  '5+ Large Bags (Max Cargo)',
  'Roof Carrier Included (Heavy Luggage / Hill Trips)',
];

export default function DriverDocumentsUploadScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Driver Identity & License
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseDocUrl, setLicenseDocUrl] = useState<string | null>(null);
  const [rcDocUrl, setRcDocUrl] = useState<string | null>(null);
  const [insuranceDocUrl, setInsuranceDocUrl] = useState<string | null>(null);

  // Vehicle & Carriage Specs
  const [plateNumber, setPlateNumber] = useState('KA-01-SD-2002');
  const [category, setCategory] = useState<VehicleCategoryType | null>('SEDAN');
  const [carModel, setCarModel] = useState('');
  const [fuelType, setFuelType] = useState<FuelTypeVal | null>('DIESEL');
  const [carriageCapacity, setCarriageCapacity] = useState<string | null>(null);

  // Accordion & Dropdown States
  const [step1Expanded, setStep1Expanded] = useState(false);
  const [step2Expanded, setStep2Expanded] = useState(true);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [carriageDropdownOpen, setCarriageDropdownOpen] = useState(false);

  const [verificationStatus, setVerificationStatus] = useState('PENDING');
  const [adminNotes, setAdminNotes] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await driverApiClient.fetch('/api/driver/documents');
      if (res.success && res.documents) {
        const d = res.documents;
        setProfilePhotoUrl(d.profilePhotoUrl || null);
        setLicenseNumber(d.licenseNumber && d.licenseNumber !== 'PENDING' ? d.licenseNumber : '');
        setLicenseDocUrl(d.licenseDocUrl || null);
        setRcDocUrl(d.rcDocUrl || null);
        setInsuranceDocUrl(d.insuranceDocUrl || null);
        setVerificationStatus(d.verificationStatus || 'PENDING');
        setAdminNotes(d.adminNotes || null);

        if (d.vehicle) {
          if (
            d.vehicle.plateNumber &&
            d.vehicle.plateNumber !== 'PENDING' &&
            !d.vehicle.plateNumber.startsWith('KA 01 TR 0000')
          ) {
            setPlateNumber(d.vehicle.plateNumber);
            if (d.vehicle.category) {
              setCategory(d.vehicle.category as VehicleCategoryType);
            }
            if (d.vehicle.fuelType) {
              setFuelType(d.vehicle.fuelType as FuelTypeVal);
            }
          }
        }

        if (d.carModel) {
          setCarModel(d.carModel);
        } else if (d.adminNotes) {
          const matchModel = d.adminNotes.match(/\[Car Model:\s*([^\]]+)\]/);
          if (matchModel && matchModel[1]) {
            setCarModel(matchModel[1].trim());
          }
        }

        if (d.carriageCapacity) {
          setCarriageCapacity(d.carriageCapacity);
        } else if (d.adminNotes) {
          const match = d.adminNotes.match(/\[Luggage\/Carriage:\s*([^\]]+)\]/);
          if (match && match[1]) {
            setCarriageCapacity(match[1].trim());
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  // Image Picker Helper
  const pickImage = async (
    target: 'profile' | 'license' | 'rc' | 'insurance',
    mode: 'camera' | 'library'
  ) => {
    try {
      const isProfile = target === 'profile';
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
        allowsEditing: true,
        aspect: isProfile ? [1, 1] : undefined,
      };

      let result;
      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera access is required to take photo.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(pickerOptions);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Photo library access is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        if (target === 'profile') {
          setProfilePhotoUrl(uri);
        } else if (target === 'license') {
          setLicenseDocUrl(uri);
        } else if (target === 'rc') {
          setRcDocUrl(uri);
        } else if (target === 'insurance') {
          setInsuranceDocUrl(uri);
        }
      }
    } catch (err: any) {
      console.error('Error selecting image:', err);
      Alert.alert('Image Error', err.message || 'Failed to select image');
    }
  };

  const handleSelectOptions = (target: 'profile' | 'license' | 'rc' | 'insurance') => {
    const title =
      target === 'profile'
        ? 'Driver Profile Photo'
        : target === 'license'
        ? 'Driving License Photo'
        : target === 'rc'
        ? 'RC Certificate Photo'
        : 'Vehicle Insurance Photo';
    Alert.alert(
      title,
      'Choose source for uploading photo:',
      [
        { text: '📷 Take Photo with Camera', onPress: () => pickImage(target, 'camera') },
        { text: '🖼️ Choose from Gallery', onPress: () => pickImage(target, 'library') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleFillDemoPhotos = () => {
    setProfilePhotoUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80');
    setLicenseDocUrl('https://images.unsplash.com/photo-1584433144859-1fc3ab64a957?w=800&auto=format&fit=crop&q=80');
    setRcDocUrl('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80');
    setInsuranceDocUrl('https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80');
    if (!licenseNumber) setLicenseNumber('KA-01-2023-0089745');
    setPlateNumber('KA-01-SD-2002');
    setCategory('SEDAN');
    setCarModel('Maruti Suzuki Dzire');
    setFuelType('DIESEL');
    setCarriageCapacity('2 Large Bags (Standard Boot)');
    Alert.alert('⚡ Demo Values Loaded', 'Filled sample verified vehicle specifications (KA-01-SD-2002 Sedan Dzire) and KYC documents.');
  };

  const handleSubmit = async () => {
    if (!plateNumber.trim()) {
      Alert.alert('Required Field', 'Please enter your Vehicle Plate / Registration number (e.g. KA-01-SD-2002).');
      return;
    }

    if (!category) {
      Alert.alert('Required Field', 'Please select your Vehicle Category (Segment).');
      return;
    }

    if (!carModel.trim()) {
      Alert.alert('Required Field', 'Please enter which car make & model you drive (e.g. Maruti Suzuki Dzire).');
      return;
    }

    if (!fuelType) {
      Alert.alert('Required Field', 'Please select your Vehicle Fuel Type (Diesel, Petrol, or CNG).');
      return;
    }

    if (!carriageCapacity) {
      Alert.alert('Required Field', 'Please select your Vehicle Carriage / Luggage capacity.');
      return;
    }

    const allDocsAttached = !!(licenseDocUrl && rcDocUrl && insuranceDocUrl);

    setSubmitting(true);
    try {
      const res = await driverApiClient.fetch('/api/driver/documents', {
        method: 'POST',
        body: JSON.stringify({
          profilePhotoUrl,
          licenseNumber: licenseNumber ? licenseNumber.trim().toUpperCase() : 'PENDING',
          plateNumber: plateNumber ? plateNumber.trim().toUpperCase() : null,
          category,
          carModel: carModel.trim(),
          fuelType,
          carriageCapacity: carriageCapacity ? carriageCapacity.trim() : 'None',
          licenseDocUrl,
          rcDocUrl,
          insuranceDocUrl,
        }),
      });

      if (res.success) {
        await fetchDocuments();
        Alert.alert(
          '✓ Saved & Submitted',
          allDocsAttached
            ? 'Your vehicle specifications and all KYC documents have been saved and submitted to Kandy Cabs Admin Review.'
            : 'Vehicle details saved! Make sure to upload all KYC documents for final activation.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/dashboard'),
            },
          ]
        );
      } else {
        Alert.alert('Submission Error', res.message || 'Failed to submit documents');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save documents');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategoryObj = VEHICLE_CATEGORIES.find((c) => c.id === category);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="rgb(240, 117, 15)" />
        <Text style={{ color: '#0f172a', marginTop: 12, fontWeight: '700', fontSize: 13 }}>
          Loading Registration...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ============================================================ */}
        {/* HERO HEADER: Back Btn, Title on Right Side, & Car Cutout     */}
        {/* ============================================================ */}
        <View style={styles.heroHeaderContainer}>
          <View style={styles.heroRow}>
            <TouchableOpacity
              style={styles.backCircleBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color="#0f172a" />
            </TouchableOpacity>

            <View style={styles.heroTitleColumn}>
              <Text style={styles.heroTitleMain}>Vehicle & KYC</Text>
              <Text style={styles.heroTitleMain}>Registration</Text>
              <Text style={styles.heroSubtitle}>
                Complete your details to start receiving ride requests.
              </Text>
            </View>

            <View style={styles.heroCarImageBox}>
              <Image
                source={require('../assets/images/fleet-sedan.png')}
                style={styles.heroCarImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        {/* ============================================================ */}
        {/* SECURITY & DATA PROTECTION BANNER                            */}
        {/* ============================================================ */}
        <View style={styles.securityBannerCard}>
          <View style={styles.securityShieldCircle}>
            <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.securityBannerTitle}>Your information is safe and secure</Text>
            <Text style={styles.securityBannerSub}>We keep your data protected.</Text>
          </View>
        </View>

        {/* ============================================================ */}
        {/* STEP 1: Driver Profile Setup (Driver Photo at First)         */}
        {/* ============================================================ */}
        <View style={styles.stepCardWhite}>
          <View style={styles.stepCardHeaderRow}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.stepTitleText}>Driver Profile Photo</Text>
              <Text style={styles.stepSubtitleTextMini}>
                Upload a clear selfie or portrait photo for customer verification.
              </Text>
            </View>
            <View style={[styles.badgePill, profilePhotoUrl ? styles.badgeGreen : styles.badgeAmber]}>
              <Text style={profilePhotoUrl ? styles.badgeGreenText : styles.badgeAmberText}>
                {profilePhotoUrl ? '✓ Uploaded' : 'Required'}
              </Text>
            </View>
          </View>

          {/* Driver Photo Upload Card */}
          <TouchableOpacity
            style={styles.driverPhotoCard}
            onPress={() => handleSelectOptions('profile')}
            activeOpacity={0.8}
          >
            <View style={styles.driverAvatarCircle}>
              {profilePhotoUrl ? (
                <Image source={{ uri: profilePhotoUrl }} style={styles.driverAvatarImg} />
              ) : (
                <View style={styles.driverAvatarPlaceholder}>
                  <Ionicons name="person" size={26} color="#0f2744" />
                </View>
              )}
              <View style={styles.avatarCameraBadge}>
                <Ionicons name="camera" size={11} color="#ffffff" />
              </View>
            </View>

            <View style={styles.driverPhotoTextBox}>
              <Text style={styles.driverPhotoTitle}>Driver Profile Photo</Text>
              <Text style={styles.driverPhotoSubtitle}>(Selfie / Front-Facing Portrait)</Text>
              <Text style={styles.driverPhotoHelp}>
                {profilePhotoUrl ? 'Tap to change or take new photo' : 'Required for customer identification'}
              </Text>
            </View>

            <View style={profilePhotoUrl ? styles.docCardUploadedBtn : styles.docCardUploadBtn}>
              {profilePhotoUrl ? (
                <>
                  <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                  <Text style={styles.docCardUploadedText}>Uploaded</Text>
                  <Ionicons name="chevron-forward" size={10} color="#16a34a" style={{ marginLeft: 2 }} />
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={12} color="rgb(240, 117, 15)" />
                  <Text style={styles.docCardUploadText}>Upload</Text>
                  <Ionicons name="chevron-forward" size={10} color="rgb(240, 117, 15)" style={{ marginLeft: 2 }} />
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* STEP 2: Vehicle & Carriage Details                           */}
        {/* ============================================================ */}
        <View style={styles.stepCardWhite}>
          <TouchableOpacity
            style={styles.stepCardHeaderRow}
            onPress={() => setStep2Expanded(!step2Expanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepTitleText}>Vehicle & Carriage Details</Text>
            <Ionicons
              name={step2Expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#0f172a"
            />
          </TouchableOpacity>

          {step2Expanded && (
            <View style={styles.step2ContentWrapper}>
              {/* Row 1: Vehicle Plate / Registration Number */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldIconBox}>
                  <Ionicons name="card" size={20} color="#0f2744" />
                </View>

                <View style={styles.fieldBody}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabelText}>Vehicle Plate / Registration Number</Text>
                    <View style={[styles.badgePill, plateNumber ? styles.badgeGreen : styles.badgeAmber]}>
                      <Text style={plateNumber ? styles.badgeGreenText : styles.badgeAmberText}>
                        {plateNumber ? '✓ Filled' : 'Required'}
                      </Text>
                    </View>
                  </View>

                  <TextInput
                    style={styles.plateInputClean}
                    value={plateNumber}
                    onChangeText={(val) => setPlateNumber(val.toUpperCase())}
                    placeholder="KA-01-SD-2002"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {/* Row 2: Vehicle Category (Segment) */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldIconBox}>
                  <Ionicons name="car-sport" size={20} color="#0f2744" />
                </View>

                <View style={styles.fieldBody}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabelText}>Vehicle Category (Segment)</Text>
                    <View style={[styles.badgePill, category ? styles.badgeGreen : styles.badgeAmber]}>
                      <Text style={category ? styles.badgeGreenText : styles.badgeAmberText}>
                        {category ? '✓ Selected' : 'Required'}
                      </Text>
                    </View>
                  </View>

                  {/* Category Dropdown Trigger */}
                  <TouchableOpacity
                    style={styles.categorySelectBox}
                    onPress={() => {
                      setCategoryDropdownOpen(!categoryDropdownOpen);
                      if (carriageDropdownOpen) setCarriageDropdownOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={selectedCategoryObj?.image || require('../assets/images/fleet-sedan.png')}
                      style={styles.categoryThumbnail}
                      resizeMode="contain"
                    />
                    <View style={styles.categoryInfoCol}>
                      <Text style={styles.categoryTitleText}>
                        {selectedCategoryObj?.title || 'Sedan'}
                      </Text>
                      <Text style={styles.categorySubmodelsText} numberOfLines={1}>
                        {selectedCategoryObj?.models || 'Dzire, Etios, Aura, Amaze'}
                      </Text>
                    </View>
                    <Ionicons
                      name={categoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#0f172a"
                    />
                  </TouchableOpacity>

                  {/* Dropdown Menu */}
                  {categoryDropdownOpen && (
                    <View style={styles.dropdownMenu}>
                      {VEHICLE_CATEGORIES.map((cat, idx) => {
                        const isSelected = category === cat.id;
                        const isLast = idx === VEHICLE_CATEGORIES.length - 1;
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            style={[
                              styles.dropdownItem,
                              isSelected && styles.dropdownItemSelected,
                              !isLast && styles.dropdownItemBorder,
                            ]}
                            onPress={() => {
                              setCategory(cat.id);
                              setCategoryDropdownOpen(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <Image
                              source={cat.image}
                              style={styles.categoryThumbnail}
                              resizeMode="contain"
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[styles.dropdownItemTitle, isSelected && { color: 'rgb(240, 117, 15)' }]}>
                                  {cat.title}
                                </Text>
                                <View style={styles.seatPillOrange}>
                                  <Text style={styles.seatPillOrangeText}>{cat.seats}</Text>
                                </View>
                              </View>
                              <Text style={styles.dropdownItemModels}>{cat.models}</Text>
                            </View>
                            {isSelected && <Ionicons name="checkmark" size={16} color="rgb(240, 117, 15)" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>

              {/* Row 3: Which Car (Make & Model Name) */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldIconBox}>
                  <Ionicons name="car" size={20} color="#0f2744" />
                </View>

                <View style={styles.fieldBody}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabelText}>Which Car (Make & Model Name)</Text>
                    <View style={[styles.badgePill, carModel.trim() ? styles.badgeGreen : styles.badgeAmber]}>
                      <Text style={carModel.trim() ? styles.badgeGreenText : styles.badgeAmberText}>
                        {carModel.trim() ? '✓ Filled' : 'Required'}
                      </Text>
                    </View>
                  </View>

                  <TextInput
                    style={styles.textInputField}
                    value={carModel}
                    onChangeText={setCarModel}
                    placeholder="e.g. Maruti Suzuki Dzire / Toyota Innova Crysta"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              {/* Row 4: Fuel Type */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldIconBox}>
                  <Ionicons name="funnel" size={17} color="#0f2744" />
                </View>

                <View style={styles.fieldBody}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabelText}>Fuel Type</Text>
                    <View style={[styles.badgePill, fuelType ? styles.badgeGreen : styles.badgeAmber]}>
                      <Text style={fuelType ? styles.badgeGreenText : styles.badgeAmberText}>
                        {fuelType ? `✓ ${fuelType.charAt(0) + fuelType.slice(1).toLowerCase()}` : 'Required'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.fieldHelpText}>Select the fuel engine type of your vehicle</Text>

                  <View style={styles.fuelSegmentRow}>
                    {FUEL_TYPES.map((f) => {
                      const isSelected = fuelType === f.id;
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[styles.fuelBtn, isSelected ? styles.fuelBtnActive : styles.fuelBtnInactive]}
                          onPress={() => setFuelType(f.id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={f.iconName} size={12} color={f.iconColor} style={{ marginRight: 4 }} />
                          <Text style={[styles.fuelBtnText, isSelected && styles.fuelBtnTextActive]}>
                            {f.label}{isSelected ? ' ✓' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Row 5: Carriage / Luggage Capacity (How Much) */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldIconBox}>
                  <Ionicons name="briefcase" size={20} color="#0f2744" />
                </View>

                <View style={styles.fieldBody}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabelText}>Carriage / Luggage Capacity (How Much)</Text>
                    <View style={[styles.badgePill, carriageCapacity ? styles.badgeGreen : styles.badgeAmber]}>
                      <Text style={carriageCapacity ? styles.badgeGreenText : styles.badgeAmberText}>
                        {carriageCapacity ? '✓ Selected' : 'Required'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.fieldHelpText}>Tap to select luggage boot / roof carrier allowance.</Text>

                  {/* Carriage Dropdown Trigger */}
                  <TouchableOpacity
                    style={styles.carriageSelectBox}
                    onPress={() => {
                      setCarriageDropdownOpen(!carriageDropdownOpen);
                      if (categoryDropdownOpen) setCategoryDropdownOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="briefcase" size={18} color="rgb(240, 117, 15)" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.carriageTitleText,
                          !carriageCapacity && { color: '#0f172a' },
                        ]}
                        numberOfLines={1}
                      >
                        {carriageCapacity || 'Select Luggage / Carriage Allowance'}
                      </Text>
                      <Text style={styles.carriageSubText}>
                        {carriageCapacity ? 'Boot space or roof carrier capacity' : 'Tap to select allowance'}
                      </Text>
                    </View>
                    <Ionicons
                      name={carriageDropdownOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#0f172a"
                    />
                  </TouchableOpacity>

                  {/* Dropdown Menu */}
                  {carriageDropdownOpen && (
                    <View style={styles.dropdownMenu}>
                      {CARRIAGE_OPTIONS.map((opt, idx) => {
                        const isSelected = carriageCapacity === opt;
                        const isLast = idx === CARRIAGE_OPTIONS.length - 1;
                        return (
                          <TouchableOpacity
                            key={opt}
                            style={[
                              styles.dropdownItem,
                              isSelected && styles.dropdownItemSelected,
                              !isLast && styles.dropdownItemBorder,
                            ]}
                            onPress={() => {
                              setCarriageCapacity(opt);
                              setCarriageDropdownOpen(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={
                                opt.startsWith('None')
                                  ? 'close-circle-outline'
                                  : opt.includes('Roof')
                                  ? 'car-outline'
                                  : 'briefcase-outline'
                              }
                              size={16}
                              color={isSelected ? 'rgb(240, 117, 15)' : '#64748b'}
                            />
                            <Text
                              style={[
                                styles.dropdownItemTitle,
                                { flex: 1, marginLeft: 8 },
                                isSelected && { color: 'rgb(240, 117, 15)', fontWeight: '800' },
                              ]}
                              numberOfLines={1}
                            >
                              {opt}
                            </Text>
                            {isSelected && <Ionicons name="checkmark" size={16} color="rgb(240, 117, 15)" />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ============================================================ */}
        {/* STEP 3: Vehicle Identity & KYC Documents                     */}
        {/* ============================================================ */}
        <View style={styles.stepCardWhite}>
          <View style={styles.step3HeaderBetween}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.stepTitleText}>Vehicle & KYC Documents</Text>
              <Text style={styles.stepSubtitleTextMini}>Upload the required documents for vehicle verification.</Text>
            </View>

            <View style={styles.verificationBadgeBlue}>
              <Ionicons name="shield-checkmark" size={12} color="#1d4ed8" style={{ marginRight: 4 }} />
              <Text style={styles.verificationBadgeBlueText}>Verification</Text>
              <Ionicons name="chevron-forward" size={10} color="#1d4ed8" style={{ marginLeft: 2 }} />
            </View>
          </View>

          {/* 3 Document Upload Cards (DL, RC, Insurance) */}
          <View style={styles.docsRowGrid}>
            {/* 1. Driving License */}
            <TouchableOpacity
              style={styles.docUploadCard}
              onPress={() => handleSelectOptions('license')}
              activeOpacity={0.8}
            >
              <View style={styles.docIconCircle}>
                <Ionicons name="card" size={20} color="#0f2744" />
              </View>
              <Text style={styles.docCardTitle} numberOfLines={2}>
                Driving License{'\n'}(DL Copy)
              </Text>
              {licenseDocUrl ? (
                <View style={styles.docCardUploadedBtn}>
                  <Ionicons name="checkmark-circle" size={11} color="#16a34a" />
                  <Text style={styles.docCardUploadedText}>Uploaded</Text>
                  <Ionicons name="chevron-forward" size={10} color="#16a34a" style={{ marginLeft: 2 }} />
                </View>
              ) : (
                <View style={styles.docCardUploadBtn}>
                  <Ionicons name="cloud-upload-outline" size={12} color="rgb(240, 117, 15)" />
                  <Text style={styles.docCardUploadText}>Upload</Text>
                  <Ionicons name="chevron-forward" size={10} color="rgb(240, 117, 15)" style={{ marginLeft: 2 }} />
                </View>
              )}
            </TouchableOpacity>

            {/* 2. RC Book */}
            <TouchableOpacity
              style={styles.docUploadCard}
              onPress={() => handleSelectOptions('rc')}
              activeOpacity={0.8}
            >
              <View style={styles.docIconCircle}>
                <Ionicons name="document-text" size={20} color="#0f2744" />
              </View>
              <Text style={styles.docCardTitle} numberOfLines={2}>
                RC Book /{'\n'}Certificate
              </Text>
              {rcDocUrl ? (
                <View style={styles.docCardUploadedBtn}>
                  <Ionicons name="checkmark-circle" size={11} color="#16a34a" />
                  <Text style={styles.docCardUploadedText}>Uploaded</Text>
                  <Ionicons name="chevron-forward" size={10} color="#16a34a" style={{ marginLeft: 2 }} />
                </View>
              ) : (
                <View style={styles.docCardUploadBtn}>
                  <Ionicons name="cloud-upload-outline" size={12} color="rgb(240, 117, 15)" />
                  <Text style={styles.docCardUploadText}>Upload</Text>
                  <Ionicons name="chevron-forward" size={10} color="rgb(240, 117, 15)" style={{ marginLeft: 2 }} />
                </View>
              )}
            </TouchableOpacity>

            {/* 3. Vehicle Insurance */}
            <TouchableOpacity
              style={styles.docUploadCard}
              onPress={() => handleSelectOptions('insurance')}
              activeOpacity={0.8}
            >
              <View style={styles.docIconCircle}>
                <Ionicons name="shield-checkmark" size={20} color="#0f2744" />
              </View>
              <Text style={styles.docCardTitle} numberOfLines={2}>
                Vehicle Insurance{'\n'}Policy
              </Text>
              {insuranceDocUrl ? (
                <View style={styles.docCardUploadedBtn}>
                  <Ionicons name="checkmark-circle" size={11} color="#16a34a" />
                  <Text style={styles.docCardUploadedText}>Uploaded</Text>
                  <Ionicons name="chevron-forward" size={10} color="#16a34a" style={{ marginLeft: 2 }} />
                </View>
              ) : (
                <View style={styles.docCardUploadBtn}>
                  <Ionicons name="cloud-upload-outline" size={12} color="rgb(240, 117, 15)" />
                  <Text style={styles.docCardUploadText}>Upload</Text>
                  <Ionicons name="chevron-forward" size={10} color="rgb(240, 117, 15)" style={{ marginLeft: 2 }} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================ */}
        {/* SUBMIT BUTTON: Vibrant Orange with Arrow Circle              */}
        {/* ============================================================ */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <View style={styles.submitLeftBox}>
                <Ionicons name="cloud-upload-outline" size={22} color="#ffffff" />
                <Text style={styles.submitButtonText}>Save & Submit to Admin Review</Text>
              </View>
              <View style={styles.submitChevronCircle}>
                <Ionicons name="chevron-forward" size={15} color="rgb(240, 117, 15)" />
              </View>
            </>
          )}
        </TouchableOpacity>

        {/* Footer Note */}
        <Text style={styles.footerNoteText}>
          ⓘ Once submitted, your details will be reviewed by the admin panel.
        </Text>

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 20,
  },

  /* Hero Header Container */
  heroHeaderContainer: {
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 6,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  backCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
    marginRight: 10,
    marginTop: 2,
  },
  heroTitleColumn: {
    flex: 1,
    paddingRight: 6,
  },
  heroTitleMain: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 25,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
  heroCarImageBox: {
    width: 120,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  heroCarImage: {
    width: '100%',
    height: '100%',
  },

  /* Security & Privacy Banner */
  securityBannerCard: {
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  securityShieldCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0f2744',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  securityBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  securityBannerSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },

  /* Step Cards */
  stepCardWhite: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 15,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  stepCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgb(240, 117, 15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
  },
  stepTitleText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  stepSubtitleText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    marginTop: 6,
  },
  stepSubtitleTextMini: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 16,
  },

  /* Driver Profile Photo Card (Above at First) */
  driverPhotoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  driverAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    position: 'relative',
    marginRight: 12,
  },
  driverAvatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  driverAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#edf7ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgb(240, 117, 15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  driverPhotoTextBox: {
    flex: 1,
    paddingRight: 6,
  },
  driverPhotoTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  driverPhotoSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  driverPhotoHelp: {
    fontSize: 10.5,
    color: '#94a3b8',
    marginTop: 3,
  },

  /* Step 2 Content */
  step2ContentWrapper: {
    marginTop: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
  },
  fieldIconBox: {
    width: 26,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    marginTop: 2,
  },
  fieldBody: {
    flex: 1,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  fieldHelpText: {
    fontSize: 11.5,
    color: '#64748b',
    marginBottom: 6,
  },

  /* Badges */
  badgePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeGreen: {
    backgroundColor: '#ecfdf5',
  },
  badgeGreenText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#16a34a',
  },
  badgeAmber: {
    backgroundColor: '#fff7ed',
  },
  badgeAmberText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#d97706',
  },
  seatPillGrey: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  seatPillGreyText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },

  /* Clean Input Fields */
  plateInputClean: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    height: 42,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  textInputField: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    height: 42,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0f172a',
  },

  /* Category Selector */
  categorySelectBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryThumbnail: {
    width: 52,
    height: 28,
  },
  categoryInfoCol: {
    flex: 1,
    paddingHorizontal: 8,
  },
  categoryTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  seatPillOrange: {
    backgroundColor: 'rgb(240, 117, 15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  seatPillOrangeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  categorySubmodelsText: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },

  /* Fuel Buttons */
  fuelSegmentRow: {
    flexDirection: 'row',
    gap: 7,
  },
  fuelBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fuelBtnActive: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: 'rgb(240, 117, 15)',
  },
  fuelBtnInactive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fuelBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  fuelBtnTextActive: {
    color: 'rgb(240, 117, 15)',
  },

  /* Carriage Selector */
  carriageSelectBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  carriageTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  carriageSubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },

  /* Dropdown Menus */
  dropdownMenu: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  dropdownItemSelected: {
    backgroundColor: '#fff7ed',
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  dropdownItemModels: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },

  /* Step 3 Header */
  step3HeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verificationBadgeBlue: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationBadgeBlueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },

  /* 4 KYC Document Cards Grid */
  docsRowGrid: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 13,
  },
  docUploadCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 134,
  },
  docIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#edf7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  docCardTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 3,
  },
  docCardUploadBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  docCardUploadText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
    marginHorizontal: 3,
  },
  docCardUploadedBtn: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  docCardUploadedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
    marginHorizontal: 3,
  },

  /* Submit Action Button */
  submitButton: {
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 28,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 20,
    shadowColor: 'rgb(240, 117, 15)',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  submitLeftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  submitChevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Footer Note */
  footerNoteText: {
    marginTop: 11,
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
    paddingHorizontal: 12,
  },
});
