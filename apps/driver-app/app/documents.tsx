import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
  KeyboardAvoidingView,
  BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from '../components/SafeLinearGradient';
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
}> = [
  { id: 'DIESEL', label: 'Diesel' },
  { id: 'PETROL', label: 'Petrol' },
  { id: 'CNG', label: 'CNG' },
];

const CARRIAGE_OPTIONS = ['Yes', 'No'];

const AVAILABLE_YEARS = Array.from({ length: 61 }, (_, i) => 1995 + i); // 1995 to 2055

export type DocTarget =
  | 'profile'
  | 'license'
  | 'aadhaar'
  | 'pan'
  | 'rc'
  | 'insurance'
  | 'fitness'
  | 'tax'
  | 'permit'
  | 'puc';

export interface DocValidity {
  docNumber?: string;
  validFrom?: string; // DD/MM/YYYY
  validTo?: string;   // DD/MM/YYYY (expired date)
}

export const DOC_CONFIGS: Record<DocTarget, {
  name: string;
  shortTitle: string;
  icon: any;
  hasDocNumber: boolean;
  numberPlaceholder: string;
  numberLabel: string;
  hasValidFrom: boolean;
  fromLabel: string;
  hasValidTo: boolean;
  toLabel: string;
}> = {
  profile: {
    name: 'Driver Profile Photo',
    shortTitle: 'Profile Photo',
    icon: 'person',
    hasDocNumber: false,
    numberPlaceholder: '',
    numberLabel: '',
    hasValidFrom: false,
    fromLabel: '',
    hasValidTo: false,
    toLabel: '',
  },
  license: {
    name: 'Driving License (DL)',
    shortTitle: 'Driving License',
    icon: 'card',
    hasDocNumber: true,
    numberPlaceholder: 'e.g. KA-01-2021-0089745',
    numberLabel: 'Driving License Number (DL)',
    hasValidFrom: true,
    fromLabel: 'Issue Date',
    hasValidTo: true,
    toLabel: 'Expiry Date',
  },
  aadhaar: {
    name: 'Aadhaar Card',
    shortTitle: 'Aadhaar Card',
    icon: 'finger-print',
    hasDocNumber: true,
    numberPlaceholder: 'e.g. 5412 8890 4892',
    numberLabel: 'Aadhaar Number (12 Digits)',
    hasValidFrom: false,
    fromLabel: '',
    hasValidTo: false,
    toLabel: '',
  },
  pan: {
    name: 'PAN Card',
    shortTitle: 'PAN Card',
    icon: 'id-card-outline',
    hasDocNumber: true,
    numberPlaceholder: 'e.g. ABCDE1234F',
    numberLabel: 'PAN Card Number (10 Digits)',
    hasValidFrom: false,
    fromLabel: '',
    hasValidTo: false,
    toLabel: '',
  },
  rc: {
    name: 'RC Registration Certificate',
    shortTitle: 'RC Certificate',
    icon: 'rc-book',
    hasDocNumber: true,
    numberPlaceholder: 'e.g. KA-01-SD-2002',
    numberLabel: 'Registration Number',
    hasValidFrom: true,
    fromLabel: 'Registration Date',
    hasValidTo: false,
    toLabel: '',
  },
  insurance: {
    name: 'Vehicle Insurance Policy',
    shortTitle: 'Vehicle Insurance',
    icon: 'insurance-car',
    hasDocNumber: true,
    numberPlaceholder: 'e.g. POL-98765432-00',
    numberLabel: 'Insurance Policy Number',
    hasValidFrom: true,
    fromLabel: 'Policy Start Date',
    hasValidTo: true,
    toLabel: 'Policy Expiry Date',
  },
  fitness: {
    name: 'Fitness Certificate (FC Book)',
    shortTitle: 'Fitness Certificate',
    icon: 'speedometer-outline',
    hasDocNumber: true,
    numberPlaceholder: 'e.g. FC-KA01-2024-88',
    numberLabel: 'Fitness Certificate Number (FC)',
    hasValidFrom: true,
    fromLabel: 'Issue Date',
    hasValidTo: true,
    toLabel: 'Expiry Date',
  },
  tax: {
    name: 'Road Tax / Motor Vehicle Tax Receipt',
    shortTitle: 'Road Tax',
    icon: 'tax-paid',
    hasDocNumber: true,
    numberPlaceholder: 'e.g. TAX-KA-2024-410',
    numberLabel: 'Tax Receipt / Challan Number',
    hasValidFrom: true,
    fromLabel: 'Tax Payment Date',
    hasValidTo: true,
    toLabel: 'Tax Paid-Up-To Date',
  },
  permit: {
    name: 'Commercial / Tourist Permit',
    shortTitle: 'Permit',
    icon: 'newspaper-outline',
    hasDocNumber: true,
    numberPlaceholder: 'e.g. KA-CC-2023-7721',
    numberLabel: 'Permit Number',
    hasValidFrom: true,
    fromLabel: 'Permit Start Date',
    hasValidTo: true,
    toLabel: 'Permit Expiry Date',
  },
  puc: {
    name: 'PUC Emission Certificate',
    shortTitle: 'PUC Emission\nCertificate',
    icon: 'puc-emission',
    hasDocNumber: true,
    numberPlaceholder: 'e.g. PUC-KA-881920',
    numberLabel: 'PUC / Emission Test Number',
    hasValidFrom: true,
    fromLabel: 'Issue Date',
    hasValidTo: true,
    toLabel: 'Expiry Date',
  },
};

export interface VehicleItem {
  id: string;
  plateNumber: string;
  category: VehicleCategoryType;
  carModel: string;
  fuelType: FuelTypeVal;
  carriageCapacity: string | null;
  rcDocUrl: string | null;
  insuranceDocUrl: string | null;
  fitnessDocUrl: string | null;
  taxDocUrl: string | null;
  permitDocUrl: string | null;
  pucDocUrl: string | null;
  docDates: Record<string, DocValidity>;
}

export default function DriverDocumentsUploadScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ vehicleIndex?: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Multiple Vehicles Fleet State
  const [vehiclesList, setVehiclesList] = useState<VehicleItem[]>([
    {
      id: 'veh-1',
      plateNumber: '',
      category: 'SEDAN',
      carModel: '',
      fuelType: 'DIESEL',
      carriageCapacity: 'No',
      rcDocUrl: null,
      insuranceDocUrl: null,
      fitnessDocUrl: null,
      taxDocUrl: null,
      permitDocUrl: null,
      pucDocUrl: null,
      docDates: {},
    },
  ]);
  const [activeVehicleIndex, setActiveVehicleIndex] = useState<number>(0);

  // Driver Identity & KYC Documents
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseDocUrl, setLicenseDocUrl] = useState<string | null>(null);
  const [aadhaarDocUrl, setAadhaarDocUrl] = useState<string | null>(null);
  const [panDocUrl, setPanDocUrl] = useState<string | null>(null);

  // Vehicle Documents & Permits
  const [rcDocUrl, setRcDocUrl] = useState<string | null>(null);
  const [insuranceDocUrl, setInsuranceDocUrl] = useState<string | null>(null);
  const [fitnessDocUrl, setFitnessDocUrl] = useState<string | null>(null);
  const [taxDocUrl, setTaxDocUrl] = useState<string | null>(null);
  const [permitDocUrl, setPermitDocUrl] = useState<string | null>(null);
  const [pucDocUrl, setPucDocUrl] = useState<string | null>(null);

  // Manual Document Validity Dates (From, To / Expired Date)
  const [docDates, setDocDates] = useState<Record<string, DocValidity>>({});

  // Active Document Modal State
  const [activeModalTarget, setActiveModalTarget] = useState<DocTarget | null>(null);
  const [modalDocNumber, setModalDocNumber] = useState('');
  const [modalValidFrom, setModalValidFrom] = useState('');
  const [modalValidTo, setModalValidTo] = useState('');

  // Interactive Calendar Date Picker State
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<'from' | 'to'>('from');
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | null>(null);
  const [calendarViewMode, setCalendarViewMode] = useState<'days' | 'years'>('days');

  // Driver Details
  const [fullName, setFullName] = useState('');

  // Vehicle & Carriage Specs
  const [plateNumber, setPlateNumber] = useState('');
  const [category, setCategory] = useState<VehicleCategoryType | null>('SEDAN');
  const [carModel, setCarModel] = useState('');
  const [fuelType, setFuelType] = useState<FuelTypeVal | null>('DIESEL');
  const [carriageCapacity, setCarriageCapacity] = useState<string | null>(null);

  // Accordion & Dropdown States
  const [step1Expanded, setStep1Expanded] = useState(true);
  const [step2Expanded, setStep2Expanded] = useState(true);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [carriageDropdownOpen, setCarriageDropdownOpen] = useState(false);

  const [verificationStatus, setVerificationStatus] = useState('PENDING');
  const [adminNotes, setAdminNotes] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isInitialSaved, setIsInitialSaved] = useState(false);

  useEffect(() => {
    fetchDocuments(true);
  }, []);

  const fetchDocuments = async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const res = await driverApiClient.fetch('/api/driver/documents');
      if (res.success && res.documents) {
        const d = res.documents;
        const alreadySubmitted = !!(
          d.licenseDocUrl ||
          d.rcDocUrl ||
          d.insuranceDocUrl ||
          d.profilePhotoUrl ||
          (d.licenseNumber && d.licenseNumber !== 'PENDING') ||
          (d.vehicle?.plateNumber && d.vehicle.plateNumber !== 'PENDING' && !d.vehicle.plateNumber.startsWith('KA 01 TR 0000'))
        );
        setIsInitialSaved(alreadySubmitted || d.verificationStatus === 'APPROVED');
        if (d.fullName && d.fullName !== 'Driver Partner') {
          setFullName(d.fullName);
        }
        setProfilePhotoUrl(d.profilePhotoUrl || null);
        setLicenseNumber(d.licenseNumber && d.licenseNumber !== 'PENDING' ? d.licenseNumber : '');
        setLicenseDocUrl(d.licenseDocUrl || null);
        setAadhaarDocUrl(d.aadhaarDocUrl || null);
        setPanDocUrl(d.panDocUrl || null);
        setRcDocUrl(d.rcDocUrl || null);
        setInsuranceDocUrl(d.insuranceDocUrl || null);
        setFitnessDocUrl(d.fitnessDocUrl || null);
        setTaxDocUrl(d.taxDocUrl || null);
        setPermitDocUrl(d.permitDocUrl || null);
        setPucDocUrl(d.pucDocUrl || null);
        setVerificationStatus(d.verificationStatus || 'PENDING');
        setAdminNotes(d.adminNotes || null);

        let parsedRej = d.rejectionReason || null;
        if (!parsedRej && d.adminNotes) {
          const rejMatch = d.adminNotes.match(/\[RejectionReason:\s*([^\]]+)\]/);
          if (rejMatch && rejMatch[1]) {
            parsedRej = rejMatch[1].trim();
          } else if (d.verificationStatus === 'REJECTED') {
            const cleanNotes = d.adminNotes.replace(/\[[A-Za-z0-9_\/]+:\s*.*?\]/g, '').trim();
            if (cleanNotes) parsedRej = cleanNotes;
          }
        }
        setRejectionReason(parsedRej);

        if (d.docDates && typeof d.docDates === 'object') {
          setDocDates(d.docDates);
        }

        // Multi-vehicle array population
        if (Array.isArray(d.vehicles) && d.vehicles.length > 0) {
          setVehiclesList(d.vehicles);
          const rawIdx = searchParams?.vehicleIndex !== undefined ? Number(searchParams.vehicleIndex) : 0;
          const targetIdx = !isNaN(rawIdx) && rawIdx >= 0 && rawIdx < d.vehicles.length ? rawIdx : 0;
          setActiveVehicleIndex(targetIdx);
          const targetVeh = d.vehicles[targetIdx];
          setPlateNumber(targetVeh.plateNumber && targetVeh.plateNumber !== 'PENDING' && !targetVeh.plateNumber.startsWith('KA 01 TR 0000') ? targetVeh.plateNumber : '');
          setCategory((targetVeh.category as VehicleCategoryType) || 'SEDAN');
          setCarModel(targetVeh.carModel || '');
          setFuelType((targetVeh.fuelType as FuelTypeVal) || 'DIESEL');
          setCarriageCapacity(targetVeh.carriageCapacity || 'No');
          setRcDocUrl(targetVeh.rcDocUrl || null);
          setInsuranceDocUrl(targetVeh.insuranceDocUrl || null);
          setFitnessDocUrl(targetVeh.fitnessDocUrl || null);
          setTaxDocUrl(targetVeh.taxDocUrl || null);
          setPermitDocUrl(targetVeh.permitDocUrl || null);
          setPucDocUrl(targetVeh.pucDocUrl || null);
          if (targetVeh.docDates && typeof targetVeh.docDates === 'object') {
            setDocDates((prev) => ({ ...prev, ...targetVeh.docDates }));
          }
        } else {
          let resolvedPlate = '';
          let resolvedCategory: VehicleCategoryType = 'SEDAN';
          let resolvedFuel: FuelTypeVal = 'DIESEL';

          if (d.vehicle) {
            if (
              d.vehicle.plateNumber &&
              d.vehicle.plateNumber !== 'PENDING' &&
              !d.vehicle.plateNumber.startsWith('KA 01 TR 0000')
            ) {
              resolvedPlate = d.vehicle.plateNumber;
            }
            if (d.vehicle.category) {
              resolvedCategory = d.vehicle.category as VehicleCategoryType;
            }
            if (d.vehicle.fuelType) {
              resolvedFuel = d.vehicle.fuelType as FuelTypeVal;
            }
          }

          let resolvedModel = d.carModel || '';
          if (!resolvedModel && d.adminNotes) {
            const matchModel = d.adminNotes.match(/\[Car Model:\s*([^\]]+)\]/);
            if (matchModel && matchModel[1]) resolvedModel = matchModel[1].trim();
          }

          let resolvedCarriage = d.carriageCapacity || 'No';
          if (!resolvedCarriage && d.adminNotes) {
            const match = d.adminNotes.match(/\[Luggage\/Carriage:\s*([^\]]+)\]/);
            if (match && match[1]) resolvedCarriage = match[1].trim();
          }

          setPlateNumber(resolvedPlate);
          setCategory(resolvedCategory);
          setCarModel(resolvedModel);
          setFuelType(resolvedFuel);
          setCarriageCapacity(resolvedCarriage);

          const fallbackVeh: VehicleItem = {
            id: d.vehicle?.id || 'veh-1',
            plateNumber: resolvedPlate,
            category: resolvedCategory,
            carModel: resolvedModel,
            fuelType: resolvedFuel,
            carriageCapacity: resolvedCarriage,
            rcDocUrl: d.rcDocUrl || null,
            insuranceDocUrl: d.insuranceDocUrl || null,
            fitnessDocUrl: d.fitnessDocUrl || null,
            taxDocUrl: d.taxDocUrl || null,
            permitDocUrl: d.permitDocUrl || null,
            pucDocUrl: d.pucDocUrl || null,
            docDates: d.docDates || {},
          };
          setVehiclesList([fallbackVeh]);
          setActiveVehicleIndex(0);
        }
      }
    } catch (err: any) {
      console.error('Failed to load documents:', err);
    } finally {
      try {
        const token = await driverApiClient.getToken();
        let currentPhone = '';
        if (token && token.startsWith('driver_session_')) {
          currentPhone = token.split('_')[2] || '';
        }
        const cached = await SecureStore.getItemAsync('kandy_cached_driver');
        if (cached) {
          const cd = JSON.parse(cached);
          const cachedPhone = (cd.phone || '').replace(/\D/g, '').slice(-10);
          if (!currentPhone || cachedPhone === currentPhone) {
            if (cd.rejectionReason) {
              setRejectionReason(cd.rejectionReason);
            }
            if (cd.verificationStatus) {
              setVerificationStatus(cd.verificationStatus);
            }
            if (
              cd.verificationStatus === 'APPROVED' ||
              cd.licenseDocUrl ||
              cd.rcDocUrl ||
              cd.profilePhotoUrl ||
              (cd.vehicle?.plateNumber && cd.vehicle.plateNumber !== 'PENDING' && !cd.vehicle.plateNumber.startsWith('KA 01 TR 0000')) ||
              (cd.vehicleNumber && cd.vehicleNumber !== 'PENDING' && cd.vehicleNumber !== '' && !cd.vehicleNumber.startsWith('KA 01 TR 0000'))
            ) {
              setIsInitialSaved(true);
            }
          }
        }
      } catch (_) {}
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const handleGoBack = () => {
    if (isInitialSaved) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/dashboard');
      }
      return;
    }

    // New user who has not completed or saved details
    const hasUnsavedEdits = !!(
      (fullName && fullName.trim() && fullName.trim() !== 'Driver Partner') ||
      profilePhotoUrl ||
      licenseDocUrl ||
      rcDocUrl ||
      insuranceDocUrl ||
      (plateNumber && plateNumber.trim() !== 'KA-01-SD-2002' && plateNumber.trim() !== 'PENDING') ||
      carModel
    );

    if (hasUnsavedEdits) {
      Alert.alert(
        'Exit Registration?',
        'You have unsaved details. Do you want to discard them and return to the sign-in screen?',
        [
          { text: 'Stay & Complete', style: 'cancel' },
          {
            text: 'Discard & Exit',
            style: 'destructive',
            onPress: () => {
              router.replace('/login');
            },
          },
        ]
      );
    } else {
      router.replace('/login');
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      handleGoBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isInitialSaved, fullName, profilePhotoUrl, licenseDocUrl, rcDocUrl, insuranceDocUrl, plateNumber, carModel]);

  const getDocUrl = (target: DocTarget): string | null => {
    switch (target) {
      case 'profile': return profilePhotoUrl;
      case 'license': return licenseDocUrl;
      case 'aadhaar': return aadhaarDocUrl;
      case 'pan': return panDocUrl;
      case 'rc': return rcDocUrl;
      case 'insurance': return insuranceDocUrl;
      case 'fitness': return fitnessDocUrl;
      case 'tax': return taxDocUrl;
      case 'permit': return permitDocUrl;
      case 'puc': return pucDocUrl;
      default: return null;
    }
  };

  const updateActiveVehicle = useCallback((fields: Partial<VehicleItem>) => {
    setVehiclesList((prev) => {
      const copy = [...prev];
      if (copy[activeVehicleIndex]) {
        copy[activeVehicleIndex] = {
          ...copy[activeVehicleIndex],
          ...fields,
        };
      }
      return copy;
    });
  }, [activeVehicleIndex]);

  const handleAddVehicle = () => {
    // 1. Snapshot current form fields into current vehicle
    const currentVeh: VehicleItem = {
      id: vehiclesList[activeVehicleIndex]?.id || `veh-${activeVehicleIndex + 1}`,
      plateNumber,
      category: category || 'SEDAN',
      carModel,
      fuelType: fuelType || 'DIESEL',
      carriageCapacity,
      rcDocUrl,
      insuranceDocUrl,
      fitnessDocUrl,
      taxDocUrl,
      permitDocUrl,
      pucDocUrl,
      docDates: {
        ...(vehiclesList[activeVehicleIndex]?.docDates || {}),
        rc: docDates.rc,
        insurance: docDates.insurance,
        fitness: docDates.fitness,
        tax: docDates.tax,
        permit: docDates.permit,
        puc: docDates.puc,
      },
    };

    const updatedList = [...vehiclesList];
    updatedList[activeVehicleIndex] = currentVeh;

    // 2. Append new blank vehicle
    const newIdx = updatedList.length;
    const newVeh: VehicleItem = {
      id: `veh-${Date.now()}`,
      plateNumber: '',
      category: 'SEDAN',
      carModel: '',
      fuelType: 'DIESEL',
      carriageCapacity: 'No',
      rcDocUrl: null,
      insuranceDocUrl: null,
      fitnessDocUrl: null,
      taxDocUrl: null,
      permitDocUrl: null,
      pucDocUrl: null,
      docDates: {},
    };
    updatedList.push(newVeh);
    setVehiclesList(updatedList);
    setActiveVehicleIndex(newIdx);

    // 3. Clear active form fields for newly added vehicle
    setPlateNumber('');
    setCategory('SEDAN');
    setCarModel('');
    setFuelType('DIESEL');
    setCarriageCapacity('No');
    setRcDocUrl(null);
    setInsuranceDocUrl(null);
    setFitnessDocUrl(null);
    setTaxDocUrl(null);
    setPermitDocUrl(null);
    setPucDocUrl(null);
    setDocDates((prev) => {
      const nextDates = { ...prev };
      delete nextDates.rc;
      delete nextDates.insurance;
      delete nextDates.fitness;
      delete nextDates.tax;
      delete nextDates.permit;
      delete nextDates.puc;
      return nextDates;
    });

    Alert.alert(
      '🚗 Vehicle Added',
      `Vehicle ${newIdx + 1} added! Please enter its registration plate, make & model, and upload its compliance documents (RC, Insurance, etc.).`
    );
  };

  const handleSwitchVehicle = (targetIdx: number) => {
    if (targetIdx === activeVehicleIndex || targetIdx < 0 || targetIdx >= vehiclesList.length) return;

    // Save current active vehicle
    const currentVeh: VehicleItem = {
      id: vehiclesList[activeVehicleIndex]?.id || `veh-${activeVehicleIndex + 1}`,
      plateNumber,
      category: category || 'SEDAN',
      carModel,
      fuelType: fuelType || 'DIESEL',
      carriageCapacity,
      rcDocUrl,
      insuranceDocUrl,
      fitnessDocUrl,
      taxDocUrl,
      permitDocUrl,
      pucDocUrl,
      docDates: {
        ...(vehiclesList[activeVehicleIndex]?.docDates || {}),
        rc: docDates.rc,
        insurance: docDates.insurance,
        fitness: docDates.fitness,
        tax: docDates.tax,
        permit: docDates.permit,
        puc: docDates.puc,
      },
    };
    const updatedList = [...vehiclesList];
    updatedList[activeVehicleIndex] = currentVeh;
    setVehiclesList(updatedList);

    // Switch to target
    setActiveVehicleIndex(targetIdx);
    const targetVeh = updatedList[targetIdx];
    setPlateNumber(targetVeh.plateNumber || '');
    setCategory(targetVeh.category || 'SEDAN');
    setCarModel(targetVeh.carModel || '');
    setFuelType(targetVeh.fuelType || 'DIESEL');
    setCarriageCapacity(targetVeh.carriageCapacity || 'No');
    setRcDocUrl(targetVeh.rcDocUrl || null);
    setInsuranceDocUrl(targetVeh.insuranceDocUrl || null);
    setFitnessDocUrl(targetVeh.fitnessDocUrl || null);
    setTaxDocUrl(targetVeh.taxDocUrl || null);
    setPermitDocUrl(targetVeh.permitDocUrl || null);
    setPucDocUrl(targetVeh.pucDocUrl || null);
    setDocDates((prev) => ({
      ...prev,
      ...(targetVeh.docDates || {}),
    }));
  };

  // If vehicleIndex query param changes or screen is navigated to with a specific vehicle
  useEffect(() => {
    if (searchParams?.vehicleIndex !== undefined && vehiclesList.length > 0) {
      const idx = Number(searchParams.vehicleIndex);
      if (!isNaN(idx) && idx >= 0 && idx < vehiclesList.length && idx !== activeVehicleIndex) {
        handleSwitchVehicle(idx);
      }
    }
  }, [searchParams?.vehicleIndex, vehiclesList.length]);

  // If navigated with addNewVehicle query param to add another vehicle
  const hasAddedVehicleRef = React.useRef(false);
  useEffect(() => {
    if (searchParams?.addNewVehicle === 'true' && !loading && !hasAddedVehicleRef.current) {
      hasAddedVehicleRef.current = true;
      handleAddVehicle();
    }
  }, [searchParams?.addNewVehicle, loading]);

  const handleRemoveVehicle = (idxToRemove: number) => {
    if (vehiclesList.length <= 1) {
      Alert.alert('Cannot Remove', 'You must have at least one vehicle registered.');
      return;
    }
    const target = vehiclesList[idxToRemove];
    Alert.alert(
      'Remove Vehicle?',
      `Are you sure you want to remove Vehicle ${idxToRemove + 1} (${target.plateNumber || target.carModel || 'Unnamed'}) and its documents?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const nextList = vehiclesList.filter((_, i) => i !== idxToRemove);
            const nextIdx = Math.min(
              activeVehicleIndex >= idxToRemove ? Math.max(0, activeVehicleIndex - 1) : activeVehicleIndex,
              nextList.length - 1
            );
            setVehiclesList(nextList);
            setActiveVehicleIndex(nextIdx);

            const nextActive = nextList[nextIdx];
            setPlateNumber(nextActive.plateNumber || '');
            setCategory(nextActive.category || 'SEDAN');
            setCarModel(nextActive.carModel || '');
            setFuelType(nextActive.fuelType || 'DIESEL');
            setCarriageCapacity(nextActive.carriageCapacity || 'No');
            setRcDocUrl(nextActive.rcDocUrl || null);
            setInsuranceDocUrl(nextActive.insuranceDocUrl || null);
            setFitnessDocUrl(nextActive.fitnessDocUrl || null);
            setTaxDocUrl(nextActive.taxDocUrl || null);
            setPermitDocUrl(nextActive.permitDocUrl || null);
            setPucDocUrl(nextActive.pucDocUrl || null);
            setDocDates((prev) => ({
              ...prev,
              ...(nextActive.docDates || {}),
            }));
          },
        },
      ]
    );
  };

  const setDocUrl = (target: DocTarget, url: string | null) => {
    switch (target) {
      case 'profile': setProfilePhotoUrl(url); break;
      case 'license': setLicenseDocUrl(url); break;
      case 'aadhaar': setAadhaarDocUrl(url); break;
      case 'pan': setPanDocUrl(url); break;
      case 'rc':
        setRcDocUrl(url);
        updateActiveVehicle({ rcDocUrl: url });
        break;
      case 'insurance':
        setInsuranceDocUrl(url);
        updateActiveVehicle({ insuranceDocUrl: url });
        break;
      case 'fitness':
        setFitnessDocUrl(url);
        updateActiveVehicle({ fitnessDocUrl: url });
        break;
      case 'tax':
        setTaxDocUrl(url);
        updateActiveVehicle({ taxDocUrl: url });
        break;
      case 'permit':
        setPermitDocUrl(url);
        updateActiveVehicle({ permitDocUrl: url });
        break;
      case 'puc':
        setPucDocUrl(url);
        updateActiveVehicle({ pucDocUrl: url });
        break;
    }
  };

  const openDocModal = (target: DocTarget) => {
    setActiveModalTarget(target);
    const current = docDates[target] || {};
    setModalDocNumber(current.docNumber || (target === 'license' ? licenseNumber : ''));
    setModalValidFrom(current.validFrom || '');
    setModalValidTo(current.validTo || '');
  };

  const saveModalDocDetails = () => {
    if (!activeModalTarget) return;
    const updated = {
      ...docDates,
      [activeModalTarget]: {
        docNumber: modalDocNumber.trim(),
        validFrom: modalValidFrom.trim(),
        validTo: modalValidTo.trim(),
      },
    };
    setDocDates(updated);
    if (activeModalTarget === 'license' && modalDocNumber.trim()) {
      setLicenseNumber(modalDocNumber.trim().toUpperCase());
    }

    if (['rc', 'insurance', 'fitness', 'tax', 'permit', 'puc'].includes(activeModalTarget)) {
      setVehiclesList((prev) => {
        const copy = [...prev];
        if (copy[activeVehicleIndex]) {
          copy[activeVehicleIndex] = {
            ...copy[activeVehicleIndex],
            docDates: {
              ...(copy[activeVehicleIndex].docDates || {}),
              [activeModalTarget]: {
                docNumber: modalDocNumber.trim(),
                validFrom: modalValidFrom.trim(),
                validTo: modalValidTo.trim(),
              },
            },
          };
        }
        return copy;
      });
    }

    setActiveModalTarget(null);
  };

  const applyQuickYearsPreset = (years: number) => {
    let baseDate = new Date();
    if (modalValidFrom.trim()) {
      const parts = modalValidFrom.trim().split(/[\/\-\.]/);
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          baseDate = new Date(y, m, d);
        }
      }
    } else {
      const dStr = String(baseDate.getDate()).padStart(2, '0');
      const mStr = String(baseDate.getMonth() + 1).padStart(2, '0');
      const yStr = String(baseDate.getFullYear());
      setModalValidFrom(`${dStr}/${mStr}/${yStr}`);
    }

    const expDate = new Date(baseDate);
    expDate.setFullYear(expDate.getFullYear() + years);
    expDate.setDate(expDate.getDate() - 1);

    const expD = String(expDate.getDate()).padStart(2, '0');
    const expM = String(expDate.getMonth() + 1).padStart(2, '0');
    const expY = String(expDate.getFullYear());
    setModalValidTo(`${expD}/${expM}/${expY}`);
  };

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const parseDateStr = (str: string): Date | null => {
    if (!str || !str.trim()) return null;
    const parts = str.trim().split(/[\/\-\.]/);
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (!isNaN(d) && !isNaN(m) && !isNaN(y) && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
        return new Date(y, m, d);
      }
    }
    return null;
  };

  const formatDateStr = (date: Date): string => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const openDatePicker = (target: 'from' | 'to') => {
    setCalendarTarget(target);
    const existingStr = target === 'from' ? modalValidFrom : modalValidTo;
    const parsed = parseDateStr(existingStr);
    const activeDate = parsed || new Date();
    setCalendarYear(activeDate.getFullYear());
    setCalendarMonth(activeDate.getMonth());
    setCalendarSelectedDate(parsed || (target === 'from' ? new Date() : null));
    setCalendarViewMode('days');
    setCalendarVisible(true);
  };

  const selectDayFromCalendar = (day: number) => {
    const selected = new Date(calendarYear, calendarMonth, day);
    setCalendarSelectedDate(selected);
    const formatted = formatDateStr(selected);
    if (calendarTarget === 'from') {
      setModalValidFrom(formatted);
    } else {
      setModalValidTo(formatted);
    }
  };

  const applyTodayInCalendar = () => {
    const today = new Date();
    setCalendarYear(today.getFullYear());
    setCalendarMonth(today.getMonth());
    setCalendarSelectedDate(today);
    const formatted = formatDateStr(today);
    if (calendarTarget === 'from') {
      setModalValidFrom(formatted);
    } else {
      setModalValidTo(formatted);
    }
  };

  const changeCalendarMonth = (delta: number) => {
    let newM = calendarMonth + delta;
    let newY = calendarYear;
    if (newM > 11) {
      newM = 0;
      newY += 1;
    } else if (newM < 0) {
      newM = 11;
      newY -= 1;
    }
    setCalendarMonth(newM);
    setCalendarYear(newY);
  };

  const changeCalendarYear = (delta: number) => {
    setCalendarYear((y) => y + delta);
  };

  // Image Picker Helper
  const pickImage = async (
    target: DocTarget,
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

        setDocUrl(target, uri);
      }
    } catch (err: any) {
      console.error('Error selecting image:', err);
      Alert.alert('Image Error', err.message || 'Failed to select image');
    }
  };

  const handleSelectOptions = (target: DocTarget) => {
    const titles: Record<DocTarget, string> = {
      profile: 'Driver Profile Photo',
      license: 'Driving License',
      aadhaar: 'Aadhaar Card',
      pan: 'PAN Card',
      rc: 'RC Certificate',
      insurance: 'Vehicle Insurance Policy',
      fitness: 'Fitness Certificate (FC)',
      tax: 'Road Tax Receipt',
      permit: 'Commercial Permit',
      puc: 'PUC Emission Certificate',
    };
    Alert.alert(
      titles[target] || 'Upload Document',
      'Choose source for uploading photo:',
      [
        { text: '📷 Take Photo with Camera', onPress: () => pickImage(target, 'camera') },
        { text: '🖼️ Choose from Gallery', onPress: () => pickImage(target, 'library') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleFillDemoPhotos = () => {
    setFullName('Ramesh Kumar');
    setProfilePhotoUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80');
    setLicenseDocUrl('https://images.unsplash.com/photo-1584433144859-1fc3ab64a957?w=800&auto=format&fit=crop&q=80');
    setAadhaarDocUrl('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80');
    setPanDocUrl('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80');
    setLicenseNumber('KA-01-2023-0089745');

    // Fill Vehicle 1: Dzire Sedan
    const v1: VehicleItem = {
      id: 'veh-1',
      plateNumber: 'KA-01-SD-2002',
      category: 'SEDAN',
      carModel: 'Maruti Suzuki Dzire',
      fuelType: 'DIESEL',
      carriageCapacity: 'Yes',
      rcDocUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
      insuranceDocUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
      fitnessDocUrl: 'https://images.unsplash.com/photo-1584433144859-1fc3ab64a957?w=800&auto=format&fit=crop&q=80',
      taxDocUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
      permitDocUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
      pucDocUrl: 'https://images.unsplash.com/photo-1584433144859-1fc3ab64a957?w=800&auto=format&fit=crop&q=80',
      docDates: {
        rc: { docNumber: 'KA-01-SD-2002', validFrom: '10/01/2022', validTo: '09/01/2037' },
        insurance: { docNumber: 'POL-98765432-00', validFrom: '15/01/2026', validTo: '14/01/2027' },
        fitness: { docNumber: 'FC-KA01-2024-88', validFrom: '20/02/2024', validTo: '19/02/2026' },
        tax: { docNumber: 'TAX-KA-2024-410', validFrom: '01/04/2025', validTo: '31/03/2026' },
        permit: { docNumber: 'KA-CC-2023-7721', validFrom: '01/06/2023', validTo: '31/05/2028' },
        puc: { docNumber: 'PUC-KA-881920', validFrom: '01/09/2026', validTo: '28/02/2027' },
      },
    };

    // Fill Vehicle 2: Innova Crysta SUV
    const v2: VehicleItem = {
      id: 'veh-2',
      plateNumber: 'KA-01-SD-2085',
      category: 'SUV',
      carModel: 'Toyota Innova Crysta',
      fuelType: 'DIESEL',
      carriageCapacity: 'Yes',
      rcDocUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
      insuranceDocUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
      fitnessDocUrl: 'https://images.unsplash.com/photo-1584433144859-1fc3ab64a957?w=800&auto=format&fit=crop&q=80',
      taxDocUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
      permitDocUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
      pucDocUrl: 'https://images.unsplash.com/photo-1584433144859-1fc3ab64a957?w=800&auto=format&fit=crop&q=80',
      docDates: {
        rc: { docNumber: 'KA-01-SD-2085', validFrom: '15/05/2023', validTo: '14/05/2038' },
        insurance: { docNumber: 'POL-11223344-00', validFrom: '01/02/2026', validTo: '31/01/2027' },
        fitness: { docNumber: 'FC-KA01-2025-12', validFrom: '10/03/2025', validTo: '09/03/2027' },
        tax: { docNumber: 'TAX-KA-2025-99', validFrom: '01/04/2025', validTo: '31/03/2026' },
        permit: { docNumber: 'KA-CC-2024-901', validFrom: '01/07/2024', validTo: '30/06/2029' },
        puc: { docNumber: 'PUC-KA-990011', validFrom: '01/10/2026', validTo: '31/03/2027' },
      },
    };

    setVehiclesList([v1, v2]);
    setActiveVehicleIndex(0);

    setPlateNumber(v1.plateNumber);
    setCategory(v1.category);
    setCarModel(v1.carModel);
    setFuelType(v1.fuelType);
    setCarriageCapacity(v1.carriageCapacity);
    setRcDocUrl(v1.rcDocUrl);
    setInsuranceDocUrl(v1.insuranceDocUrl);
    setFitnessDocUrl(v1.fitnessDocUrl);
    setTaxDocUrl(v1.taxDocUrl);
    setPermitDocUrl(v1.permitDocUrl);
    setPucDocUrl(v1.pucDocUrl);

    setDocDates({
      license: { docNumber: 'KA-01-2023-0089745', validFrom: '15/03/2023', validTo: '14/03/2043' },
      aadhaar: { docNumber: '5412 8890 4892', validFrom: '2015', validTo: 'Permanent' },
      pan: { docNumber: 'ABCDE1234F', validFrom: '2018', validTo: 'Permanent' },
      ...v1.docDates,
    });

    Alert.alert('⚡ Demo Fleet Loaded', 'Filled 2 verified vehicles (Vehicle 1: Dzire Sedan & Vehicle 2: Innova Crysta SUV) and all compliance documents with validity dates.');
  };

  const handleSubmit = async () => {
    if (!fullName || !fullName.trim()) {
      Alert.alert('Required Detail', 'Please enter your Full Name as per official KYC documents (Driving License / Aadhaar).');
      return;
    }

    if (!profilePhotoUrl) {
      Alert.alert('Required Detail', 'Please upload your Driver Profile Photo (Selfie / Portrait).');
      return;
    }

    if (!licenseDocUrl) {
      Alert.alert('Required Document', 'Please upload your Driving License.');
      return;
    }

    if (!aadhaarDocUrl) {
      Alert.alert('Required Document', 'Please upload your Aadhaar Card.');
      return;
    }

    // Compile vehicles list syncing current active form inputs
    const compiledVehicles = vehiclesList.map((v, idx) => {
      if (idx === activeVehicleIndex) {
        return {
          ...v,
          plateNumber: plateNumber ? plateNumber.trim().toUpperCase() : v.plateNumber,
          category: category || v.category || 'SEDAN',
          carModel: carModel ? carModel.trim() : v.carModel,
          fuelType: fuelType || v.fuelType || 'DIESEL',
          carriageCapacity: carriageCapacity || v.carriageCapacity || 'No',
          rcDocUrl,
          insuranceDocUrl,
          fitnessDocUrl,
          taxDocUrl,
          permitDocUrl,
          pucDocUrl,
          docDates: {
            ...(v.docDates || {}),
            rc: docDates.rc,
            insurance: docDates.insurance,
            fitness: docDates.fitness,
            tax: docDates.tax,
            permit: docDates.permit,
            puc: docDates.puc,
          },
        };
      }
      return v;
    });

    // Validate each vehicle in the fleet
    for (let i = 0; i < compiledVehicles.length; i++) {
      const veh = compiledVehicles[i];
      const vehLabel = `Vehicle ${i + 1}`;
      if (!veh.plateNumber || !veh.plateNumber.trim()) {
        Alert.alert('Required Vehicle Detail', `Please enter the Registration Plate number for ${vehLabel}.`);
        handleSwitchVehicle(i);
        return;
      }
      if (!veh.carModel || !veh.carModel.trim()) {
        Alert.alert('Required Vehicle Detail', `Please enter the make & model for ${vehLabel} (${veh.plateNumber}).`);
        handleSwitchVehicle(i);
        return;
      }
      if (!veh.rcDocUrl) {
        Alert.alert('Required Document', `Please upload the Vehicle RC Certificate for ${vehLabel} (${veh.plateNumber}).`);
        handleSwitchVehicle(i);
        return;
      }
      if (!veh.insuranceDocUrl) {
        Alert.alert('Required Document', `Please upload the Vehicle Insurance Policy document for ${vehLabel} (${veh.plateNumber}).`);
        handleSwitchVehicle(i);
        return;
      }
    }

    setSubmitting(true);
    try {
      const primaryVeh = compiledVehicles[0];
      const res = await driverApiClient.fetch('/api/driver/documents', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          profilePhotoUrl,
          licenseNumber: licenseNumber ? licenseNumber.trim().toUpperCase() : 'PENDING',
          plateNumber: primaryVeh.plateNumber ? primaryVeh.plateNumber.trim().toUpperCase() : null,
          category: primaryVeh.category,
          carModel: primaryVeh.carModel.trim(),
          fuelType: primaryVeh.fuelType,
          carriageCapacity: primaryVeh.carriageCapacity ? primaryVeh.carriageCapacity.trim() : 'No',
          licenseDocUrl,
          aadhaarDocUrl,
          panDocUrl,
          rcDocUrl: primaryVeh.rcDocUrl,
          insuranceDocUrl: primaryVeh.insuranceDocUrl,
          fitnessDocUrl: primaryVeh.fitnessDocUrl,
          taxDocUrl: primaryVeh.taxDocUrl,
          permitDocUrl: primaryVeh.permitDocUrl,
          pucDocUrl: primaryVeh.pucDocUrl,
          docDates,
          vehicles: compiledVehicles,
        }),
      });

      // Save driver profile & fleet locally
      const driverProfileToCache = {
        fullName: fullName.trim(),
        verificationStatus: 'PENDING',
        profilePhotoUrl,
        licenseNumber: licenseNumber ? licenseNumber.trim().toUpperCase() : 'PENDING',
        vehicle: {
          plateNumber: primaryVeh.plateNumber ? primaryVeh.plateNumber.trim().toUpperCase() : 'PENDING',
          model: primaryVeh.carModel ? primaryVeh.carModel.trim() : 'Sedan',
          category: primaryVeh.category || 'SEDAN',
          seatCount: primaryVeh.category === 'TEMPO_TRAVELER' ? 12 : primaryVeh.category === 'SUV_PREMIUM' ? 7 : primaryVeh.category === 'SUV' ? 6 : 4,
        },
      };
      try {
        await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(driverProfileToCache));
        await SecureStore.setItemAsync('kandy_cached_vehicles', JSON.stringify(compiledVehicles));
      } catch (_) {}

      if (res.success) {
        await fetchDocuments(false);
        Alert.alert(
          '✓ Registration Submitted',
          `Saved ${compiledVehicles.length} vehicle(s) and driver KYC for ${fullName.trim()}! Details have been submitted to Kandy Cabs Admin Review.`,
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
      console.warn('Backend save documents failed, saving locally:', err?.message);
      const primaryVeh = compiledVehicles[0];
      const driverProfileToCache = {
        fullName: fullName.trim(),
        verificationStatus: 'PENDING',
        profilePhotoUrl,
        licenseNumber: licenseNumber ? licenseNumber.trim().toUpperCase() : 'PENDING',
        vehicle: {
          plateNumber: primaryVeh.plateNumber ? primaryVeh.plateNumber.trim().toUpperCase() : 'PENDING',
          model: primaryVeh.carModel ? primaryVeh.carModel.trim() : 'Sedan',
          category: primaryVeh.category || 'SEDAN',
          seatCount: primaryVeh.category === 'TEMPO_TRAVELER' ? 12 : primaryVeh.category === 'SUV_PREMIUM' ? 7 : primaryVeh.category === 'SUV' ? 6 : 4,
        },
      };
      try {
        await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(driverProfileToCache));
        await SecureStore.setItemAsync('kandy_cached_vehicles', JSON.stringify(compiledVehicles));
        const localDocData = {
          fullName: fullName.trim(),
          plateNumber,
          category,
          carModel,
          fuelType,
          carriageCapacity,
          profilePhotoUrl,
          licenseDocUrl,
          rcDocUrl,
          insuranceDocUrl,
          aadhaarDocUrl,
          panDocUrl,
          fitnessDocUrl,
          taxDocUrl,
          permitDocUrl,
          pucDocUrl,
          docDates,
          vehicles: compiledVehicles,
          verificationStatus: 'PENDING',
        };
        await SecureStore.setItemAsync('kandy_cached_documents', JSON.stringify(localDocData));
      } catch (_) {}

      Alert.alert(
        'Submission Saved Locally',
        `Details saved for ${fullName.trim()}. Server connection error: ${err?.message || 'Check connection'}.`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/dashboard'),
          },
        ]
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCategoryObj = VEHICLE_CATEGORIES.find((c) => c.id === category);
  const modalConfig = activeModalTarget ? DOC_CONFIGS[activeModalTarget] : null;
  const modalPhotoUrl = activeModalTarget ? getDocUrl(activeModalTarget) : null;

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
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ============================================================ */}
        {/* TOP BAR: Clean & Compact Header without Car Image Cutout      */}
        {/* ============================================================ */}
        <View style={styles.cleanTopBar}>
          <TouchableOpacity
            style={styles.backCircleBtn}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color="#0f172a" />
          </TouchableOpacity>

          <View style={styles.cleanTopBarTitleBox}>
            <Text style={styles.cleanTopBarTitle}>Upload All Details</Text>
            <Text style={styles.cleanTopBarSubtitle}>Complete vehicle info & KYC documents</Text>
          </View>

          <TouchableOpacity
            style={styles.demoPillBtn}
            onPress={handleFillDemoPhotos}
            activeOpacity={0.7}
          >
            <Ionicons name="flash" size={11} color="rgb(240, 117, 15)" />
            <Text style={styles.demoPillText}>Demo</Text>
          </TouchableOpacity>
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
        {/* ADMIN KYC REJECTION BANNER WITH SPECIFIC REASON             */}
        {/* ============================================================ */}
        {verificationStatus === 'REJECTED' && (
          <View style={styles.rejectionNoticeCard}>
            {/* Header Row */}
            <View style={styles.rejectionHeaderRow}>
              <View style={styles.rejectionIconCircle}>
                <Ionicons name="alert" size={20} color="#ffffff" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rejectionTitle}>KYC Verification Rejected</Text>
                <Text style={styles.rejectionSubtitle}>
                  All documents you submitted did not meet our guidelines.
                </Text>
              </View>
            </View>

            {/* Admin Reason / Feedback Box */}
            <View style={styles.rejectionReasonBox}>
              <View style={styles.rejectionReasonHeaderRow}>
                <Ionicons name="document-text" size={16} color="#c90016" style={{ marginRight: 6 }} />
                <Text style={styles.rejectionReasonLabel}>Admin Reason / Feedback:</Text>
              </View>
              <View style={styles.rejectionReasonPill}>
                <Text style={styles.rejectionReasonText}>
                  {rejectionReason || 'Violation'}
                </Text>
              </View>
            </View>

            {/* Guidance Tip Row with Lightbulb */}
            <View style={styles.rejectionFooterRow}>
              <Ionicons name="bulb-outline" size={18} color="#dc2626" style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={styles.rejectionFooterText}>
                Please update the required information or upload correct documents as per the guidelines.
              </Text>
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* STEP 1: Driver Profile & Personal Details                   */}
        {/* ============================================================ */}
        <View style={styles.stepCardWhite}>
          <View style={styles.stepCardHeaderRow}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.stepTitleText}>Driver Personal Details & Photo</Text>
              <Text style={styles.stepSubtitleTextMini}>
                Enter your official name and upload a clear portrait photo for customer verification.
              </Text>
            </View>
            <View style={[styles.badgePill, (fullName.trim() && profilePhotoUrl) ? styles.badgeGreen : styles.badgeAmber]}>
              <Text style={(fullName.trim() && profilePhotoUrl) ? styles.badgeGreenText : styles.badgeAmberText}>
                {(fullName.trim() && profilePhotoUrl) ? '✓ Completed' : 'Required'}
              </Text>
            </View>
          </View>

          {/* Driver Full Name Input Section */}
          <View style={styles.driverNameContainer}>
            <View style={styles.driverNameLabelRow}>
              <Ionicons name="person-circle" size={16} color="#0f2744" style={{ marginRight: 6 }} />
              <Text style={styles.driverNameLabel}>Driver Full Name</Text>
              <Text style={styles.driverNameRequiredStar}>*</Text>
            </View>
            <View style={styles.driverNameInputWrapper}>
              <TextInput
                style={styles.driverNameInput}
                placeholder="e.g. Ramesh Kumar (as per Driving License)"
                placeholderTextColor="#94a3b8"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                returnKeyType="done"
              />
              {fullName.trim().length > 0 ? (
                <View style={styles.driverNameCheckPill}>
                  <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                  <Text style={styles.driverNameCheckText}>Filled</Text>
                </View>
              ) : null}
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                  <Text style={styles.docCardUploadedText}>Uploaded</Text>
                  <Ionicons name="chevron-forward" size={10} color="#16a34a" style={{ marginLeft: 2 }} />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="cloud-upload-outline" size={12} color="#0f2744" />
                  <Text style={styles.docCardUploadText}>Upload</Text>
                  <Ionicons name="chevron-forward" size={10} color="#0f2744" style={{ marginLeft: 2 }} />
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* MULTI-VEHICLE FLEET SELECTOR & ADD VEHICLE                   */}
        {/* ============================================================ */}
        <View style={styles.multiVehicleCard}>
          <View style={styles.multiVehicleHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={styles.multiVehicleIconBadge}>
                <Ionicons name="car-sport" size={18} color="#ffffff" />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.multiVehicleHeaderTitle}>Your Vehicles</Text>
                  <View style={styles.vehicleCountPill}>
                    <Text style={styles.vehicleCountPillText}>{vehiclesList.length}</Text>
                  </View>
                </View>
                <Text style={styles.multiVehicleHeaderSubtitle}>
                  Register 1 or more vehicles for bookings
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.addVehicleBtnTop}
              onPress={handleAddVehicle}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={16} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.addVehicleBtnTopText}>+ Add Vehicle</Text>
            </TouchableOpacity>
          </View>

          {/* Horizontal Vehicle Tabs / Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vehicleChipsScrollContent}
            style={{ marginTop: 12 }}
          >
            {vehiclesList.map((veh, idx) => {
              const isSelected = idx === activeVehicleIndex;
              const docsCount = [
                veh.rcDocUrl,
                veh.insuranceDocUrl,
                veh.fitnessDocUrl,
                veh.taxDocUrl,
                veh.permitDocUrl,
                veh.pucDocUrl,
              ].filter(Boolean).length;
              const isReady = !!(veh.plateNumber && veh.carModel && docsCount >= 2);

              return (
                <TouchableOpacity
                  key={veh.id || idx}
                  style={[
                    styles.vehicleTabChip,
                    isSelected ? styles.vehicleTabChipActive : styles.vehicleTabChipInactive,
                  ]}
                  onPress={() => handleSwitchVehicle(idx)}
                  activeOpacity={0.8}
                >
                  <View style={styles.vehicleChipTopRow}>
                    <View style={[styles.vehicleChipIconCircle, isSelected && styles.vehicleChipIconCircleActive]}>
                      <Ionicons
                        name="car"
                        size={13}
                        color={isSelected ? '#ffffff' : '#0f2744'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.vehicleChipPlate,
                        isSelected && styles.vehicleChipPlateActive,
                      ]}
                      numberOfLines={1}
                    >
                      {veh.plateNumber || `Vehicle ${idx + 1}`}
                    </Text>
                  </View>

                  <View style={styles.vehicleChipBottomRow}>
                    <Text
                      style={[
                        styles.vehicleChipModel,
                        isSelected && styles.vehicleChipModelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {veh.carModel || veh.category || 'Sedan'}
                    </Text>

                    <View style={[styles.vehicleChipBadge, isSelected && styles.vehicleChipBadgeActive]}>
                      {isReady ? (
                        <Ionicons name="checkmark-circle" size={13} color={isSelected ? '#ffffff' : '#16a34a'} />
                      ) : (
                        <Text style={[styles.vehicleChipBadgeText, isSelected && { color: '#ffffff' }]}>
                          {docsCount}/6
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Active Vehicle Status Bar & Remove Button */}
          <View style={styles.activeVehicleBanner}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.activeVehicleDot} />
                <Text style={styles.activeVehicleBannerLabel}>
                  Editing Vehicle {activeVehicleIndex + 1} of {vehiclesList.length}:
                </Text>
              </View>
              <Text style={styles.activeVehicleBannerName} numberOfLines={1}>
                {carModel || 'Model Pending'} • {plateNumber || 'Plate Number Pending'}
              </Text>
            </View>

            {vehiclesList.length > 1 && (
              <TouchableOpacity
                style={styles.removeVehicleBtn}
                onPress={() => handleRemoveVehicle(activeVehicleIndex)}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={14} color="#dc2626" style={{ marginRight: 4 }} />
                <Text style={styles.removeVehicleBtnText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
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
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.stepTitleText}>Vehicle & Carriage Details</Text>
              <Text style={styles.stepSubtitleTextMini}>
                {plateNumber ? `${plateNumber} • ${carModel || category || 'Sedan'}` : 'Vehicle registration, model & specifications'}
              </Text>
            </View>
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
                    onChangeText={(val) => {
                      const u = val.toUpperCase();
                      setPlateNumber(u);
                      updateActiveVehicle({ plateNumber: u });
                    }}
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
                              updateActiveVehicle({ category: cat.id });
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
                    onChangeText={(val) => {
                      setCarModel(val);
                      updateActiveVehicle({ carModel: val });
                    }}
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
                          onPress={() => {
                            setFuelType(f.id);
                            updateActiveVehicle({ fuelType: f.id });
                          }}
                          activeOpacity={0.75}
                        >
                          <View style={[styles.radioCircleOuter, isSelected && styles.radioCircleOuterActive]}>
                            {isSelected && <View style={styles.radioCircleInner} />}
                          </View>
                          <Text style={[styles.fuelBtnText, isSelected && styles.fuelBtnTextActive]}>
                            {f.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Row 5: Carriage / Roof Carrier (Yes or No) */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldIconBox}>
                  <Ionicons name="car-outline" size={20} color="#0f2744" />
                </View>

                <View style={styles.fieldBody}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabelText}>Carriage / Luggage Carrier</Text>
                    <View style={[styles.badgePill, carriageCapacity ? styles.badgeGreen : styles.badgeAmber]}>
                      <Text style={carriageCapacity ? styles.badgeGreenText : styles.badgeAmberText}>
                        {carriageCapacity ? `✓ ${carriageCapacity}` : 'Required'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.fieldHelpText}>Does your vehicle have a roof carrier / luggage carriage?</Text>

                  {/* Yes or No Segment Buttons (Radio Button Style) */}
                  <View style={styles.carriageSegmentRow}>
                    <TouchableOpacity
                      style={[
                        styles.carriageBtn,
                        carriageCapacity === 'Yes' ? styles.carriageBtnActive : styles.carriageBtnInactive,
                      ]}
                      onPress={() => {
                        setCarriageCapacity('Yes');
                        updateActiveVehicle({ carriageCapacity: 'Yes' });
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.radioCircleOuter, carriageCapacity === 'Yes' && styles.radioCircleOuterActive]}>
                        {carriageCapacity === 'Yes' && <View style={styles.radioCircleInner} />}
                      </View>
                      <Text
                        style={[
                          styles.carriageBtnText,
                          carriageCapacity === 'Yes' && styles.carriageBtnTextActive,
                        ]}
                      >
                        Yes
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.carriageBtn,
                        carriageCapacity === 'No' ? styles.carriageBtnActive : styles.carriageBtnInactive,
                      ]}
                      onPress={() => {
                        setCarriageCapacity('No');
                        updateActiveVehicle({ carriageCapacity: 'No' });
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.radioCircleOuter, carriageCapacity === 'No' && styles.radioCircleOuterActive]}>
                        {carriageCapacity === 'No' && <View style={styles.radioCircleInner} />}
                      </View>
                      <Text
                        style={[
                          styles.carriageBtnText,
                          carriageCapacity === 'No' && styles.carriageBtnTextActive,
                        ]}
                      >
                        No
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ============================================================ */}
        {/* STEP 3: Driver Identity & KYC Documents                      */}
        {/* ============================================================ */}
        <View style={styles.stepCardWhite}>
          <View style={styles.step3HeaderBetween}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.stepTitleText}>Driver Identity & KYC Documents</Text>
              <Text style={styles.stepSubtitleTextMini}>Driving Licence, Aadhaar Card & PAN Card verification.</Text>
            </View>

            <View style={styles.verificationBadgeBlue}>
              <Ionicons name="person" size={12} color="#1d4ed8" style={{ marginRight: 4 }} />
              <Text style={styles.verificationBadgeBlueText}>
                {[licenseDocUrl, aadhaarDocUrl, panDocUrl].filter(Boolean).length}/3 Uploaded
              </Text>
            </View>
          </View>

          {/* Driver KYC Row: DL, Aadhaar, PAN */}
          <View style={styles.docsRowGrid}>
            {[
              { target: 'license' as const, title: 'Driving License', icon: 'card' as const, url: licenseDocUrl },
              { target: 'aadhaar' as const, title: 'Aadhaar Card', icon: 'finger-print' as const, url: aadhaarDocUrl },
              { target: 'pan' as const, title: 'PAN Card', icon: 'id-card-outline' as const, url: panDocUrl },
            ].map((item) => (
              <TouchableOpacity
                key={item.target}
                style={styles.docUploadCard}
                onPress={() => openDocModal(item.target)}
                activeOpacity={0.8}
              >
                <View style={styles.docCardTopBlock}>
                  <View style={styles.docIconCircle}>
                    <Ionicons name={item.icon} size={32} color="#0f2744" />
                  </View>
                  <Text style={styles.docCardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {docDates[item.target]?.validTo ? (
                    <View style={styles.cardExpPill}>
                      <Text style={styles.cardExpPillText} numberOfLines={1}>
                        Exp: {docDates[item.target]?.validTo}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {item.url ? (
                  <View style={styles.docCardUploadedBtn}>
                    <Ionicons name="checkmark-circle" size={11} color="#16a34a" />
                    <Text style={styles.docCardUploadedText}>Uploaded</Text>
                    <Ionicons name="chevron-forward" size={10} color="#16a34a" style={{ marginLeft: 2 }} />
                  </View>
                ) : (
                  <View style={styles.docCardUploadBtn}>
                    <Ionicons name="cloud-upload-outline" size={12} color="#0f2744" />
                    <Text style={styles.docCardUploadText}>Upload</Text>
                    <Ionicons name="chevron-forward" size={10} color="#0f2744" style={{ marginLeft: 2 }} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ============================================================ */}
        {/* STEP 4: Vehicle Compliance & Commercial Permits              */}
        {/* ============================================================ */}
        <View style={styles.stepCardWhite}>
          <View style={styles.step3HeaderBetween}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.stepTitleText}>Vehicle Documents & Permits</Text>
              <Text style={styles.stepSubtitleTextMini}>
                Uploading for: {plateNumber || carModel || `Vehicle ${activeVehicleIndex + 1}`} ({category || 'Sedan'})
              </Text>
            </View>

            <View style={styles.verificationBadgeBlue}>
              <Ionicons name="car-sport" size={12} color="#1d4ed8" style={{ marginRight: 4 }} />
              <Text style={styles.verificationBadgeBlueText}>
                {[rcDocUrl, insuranceDocUrl, fitnessDocUrl, taxDocUrl, permitDocUrl, pucDocUrl].filter(Boolean).length}/6 Uploaded
              </Text>
            </View>
          </View>

          {/* Quick Vehicle Switcher inside Step 4 when driver has multiple vehicles */}
          {vehiclesList.length > 1 && (
            <View style={styles.step4VehicleSwitchRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.step4VehicleSwitchLabel}>Active Vehicle for Documents:</Text>
                <Text style={styles.step4VehicleSwitchSub}>Tap to switch vehicle</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {vehiclesList.map((v, i) => {
                  const isCurrent = i === activeVehicleIndex;
                  const vDocs = [v.rcDocUrl, v.insuranceDocUrl, v.fitnessDocUrl, v.taxDocUrl, v.permitDocUrl, v.pucDocUrl].filter(Boolean).length;
                  return (
                    <TouchableOpacity
                      key={v.id || i}
                      style={[styles.step4VehiclePill, isCurrent && styles.step4VehiclePillActive]}
                      onPress={() => handleSwitchVehicle(i)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="car"
                        size={13}
                        color={isCurrent ? '#ffffff' : '#0f2744'}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={[styles.step4VehiclePillText, isCurrent && styles.step4VehiclePillTextActive]}>
                        {v.plateNumber || `Vehicle ${i + 1}`}
                      </Text>
                      <View style={[styles.step4VehiclePillBadge, isCurrent && styles.step4VehiclePillBadgeActive]}>
                        <Text style={[styles.step4VehiclePillBadgeText, isCurrent && { color: '#ffffff' }]}>
                          {vDocs}/6
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Row 1: RC Certificate, Insurance, Fitness Certificate */}
          <View style={styles.docsRowGrid}>
            {[
              { target: 'rc' as const, title: 'RC Certificate', icon: 'rc-book' as const, url: rcDocUrl },
              { target: 'insurance' as const, title: 'Vehicle Insurance', icon: 'insurance-car' as const, url: insuranceDocUrl },
              { target: 'fitness' as const, title: 'Fitness Certificate', icon: 'speedometer-outline' as const, url: fitnessDocUrl },
            ].map((item) => (
              <TouchableOpacity
                key={item.target}
                style={styles.docUploadCard}
                onPress={() => openDocModal(item.target)}
                activeOpacity={0.8}
              >
                <View style={styles.docCardTopBlock}>
                  <View style={styles.docIconCircle}>
                    {item.target === 'rc' ? (
                      <Image
                        source={require('../assets/images/rc-book-icon.png')}
                        style={{ width: 36, height: 36, tintColor: '#0f2744' }}
                        resizeMode="contain"
                      />
                    ) : item.target === 'insurance' ? (
                      <Image
                        source={require('../assets/images/insurance-car-icon.png')}
                        style={{ width: 36, height: 36, tintColor: '#0f2744' }}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons name={item.icon} size={32} color="#0f2744" />
                    )}
                  </View>
                  <Text style={styles.docCardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {docDates[item.target]?.validTo ? (
                    <View style={styles.cardExpPill}>
                      <Text style={styles.cardExpPillText} numberOfLines={1}>
                        Exp: {docDates[item.target]?.validTo}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {item.url ? (
                  <View style={styles.docCardUploadedBtn}>
                    <Ionicons name="checkmark-circle" size={11} color="#16a34a" />
                    <Text style={styles.docCardUploadedText}>Uploaded</Text>
                    <Ionicons name="chevron-forward" size={10} color="#16a34a" style={{ marginLeft: 2 }} />
                  </View>
                ) : (
                  <View style={styles.docCardUploadBtn}>
                    <Ionicons name="cloud-upload-outline" size={12} color="#0f2744" />
                    <Text style={styles.docCardUploadText}>Upload</Text>
                    <Ionicons name="chevron-forward" size={10} color="#0f2744" style={{ marginLeft: 2 }} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Row 2: Road Tax, Permit, PUC Certificate */}
          <View style={[styles.docsRowGrid, { marginTop: 10 }]}>
            {[
              { target: 'tax' as const, title: 'Road Tax', icon: 'tax-paid' as const, url: taxDocUrl },
              { target: 'permit' as const, title: 'Permit', icon: 'newspaper-outline' as const, url: permitDocUrl },
              { target: 'puc' as const, title: 'PUC Emission\nCertificate', icon: 'puc-emission' as const, url: pucDocUrl },
            ].map((item) => (
              <TouchableOpacity
                key={item.target}
                style={styles.docUploadCard}
                onPress={() => openDocModal(item.target)}
                activeOpacity={0.8}
              >
                <View style={styles.docCardTopBlock}>
                  <View style={styles.docIconCircle}>
                    {item.target === 'tax' ? (
                      <Image
                        source={require('../assets/images/tax-paid-icon.png')}
                        style={{ width: 36, height: 36, tintColor: '#0f2744' }}
                        resizeMode="contain"
                      />
                    ) : item.target === 'puc' ? (
                      <Image
                        source={require('../assets/images/puc-emission-icon.png')}
                        style={{ width: 36, height: 36, tintColor: '#0f2744' }}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons name={item.icon} size={32} color="#0f2744" />
                    )}
                  </View>
                  <Text style={styles.docCardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {docDates[item.target]?.validTo ? (
                    <View style={styles.cardExpPill}>
                      <Text style={styles.cardExpPillText} numberOfLines={1}>
                        Exp: {docDates[item.target]?.validTo}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {item.url ? (
                  <View style={styles.docCardUploadedBtn}>
                    <Ionicons name="checkmark-circle" size={11} color="#16a34a" />
                    <Text style={styles.docCardUploadedText}>Uploaded</Text>
                    <Ionicons name="chevron-forward" size={10} color="#16a34a" style={{ marginLeft: 2 }} />
                  </View>
                ) : (
                  <View style={styles.docCardUploadBtn}>
                    <Ionicons name="cloud-upload-outline" size={12} color="#0f2744" />
                    <Text style={styles.docCardUploadText}>Upload</Text>
                    <Ionicons name="chevron-forward" size={10} color="#0f2744" style={{ marginLeft: 2 }} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <View style={styles.submitLeftBox}>
                <Ionicons name="cloud-upload-outline" size={22} color="#ffffff" />
                <Text style={styles.submitButtonText}>
                  {vehiclesList.length > 1
                    ? `Save & Submit (${String(vehiclesList.length).padStart(2, '0')} Vehicles)`
                    : 'Save & Submit'}
                </Text>
              </View>
              <View style={styles.submitChevronCircle}>
                <Ionicons name="chevron-forward" size={15} color="#0f2744" />
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Footer Note */}
        <Text style={styles.footerNoteText}>
          ⓘ Once submitted, your details will be reviewed by the admin panel.
        </Text>

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* ============================================================ */}
      {/* MANUAL DOCUMENT & VALIDITY EXPIRY DETAILS MODAL SHEET        */}
      {/* ============================================================ */}
      <Modal
        visible={activeModalTarget !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveModalTarget(null)}
      >
        {activeModalTarget !== null && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setActiveModalTarget(null)}
          />
          <View style={styles.modalSheetContainer}>
            {/* Drag Handle */}
            <View style={styles.modalDragHandle} />

            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderIconCircle}>
                {activeModalTarget === 'rc' ? (
                  <Image
                    source={require('../assets/images/rc-book-icon.png')}
                    style={{ width: 32, height: 32, tintColor: '#0f2744' }}
                    resizeMode="contain"
                  />
                ) : activeModalTarget === 'insurance' ? (
                  <Image
                    source={require('../assets/images/insurance-car-icon.png')}
                    style={{ width: 32, height: 32, tintColor: '#0f2744' }}
                    resizeMode="contain"
                  />
                ) : activeModalTarget === 'tax' ? (
                  <Image
                    source={require('../assets/images/tax-paid-icon.png')}
                    style={{ width: 32, height: 32, tintColor: '#0f2744' }}
                    resizeMode="contain"
                  />
                ) : activeModalTarget === 'puc' ? (
                  <Image
                    source={require('../assets/images/puc-emission-icon.png')}
                    style={{ width: 32, height: 32, tintColor: '#0f2744' }}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons
                    name={modalConfig?.icon || 'document-text'}
                    size={30}
                    color="#0f2744"
                  />
                )}
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.modalSheetTitle} numberOfLines={1}>
                  {modalConfig?.name || 'Document Details'}
                </Text>
                <Text style={styles.modalSheetSub}>
                  Attach photo and enter validity details manually
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setActiveModalTarget(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollBody}
              keyboardShouldPersistTaps="handled"
            >
              {/* Photo Upload / Attachment Section */}
              <View style={styles.modalSectionCard}>
                <Text style={styles.modalSectionHeader}>1. Document Photo / Scan</Text>
                {modalPhotoUrl ? (
                  <View style={styles.modalPhotoAttachedWrapper}>
                    <Image
                      source={{ uri: modalPhotoUrl }}
                      style={styles.modalPhotoPreviewImg}
                      resizeMode="cover"
                    />
                    <View style={styles.modalPhotoOverlayActions}>
                      <TouchableOpacity
                        style={styles.modalPhotoActionBtn}
                        onPress={() => activeModalTarget && pickImage(activeModalTarget, 'camera')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="camera" size={14} color="#0f2744" />
                        <Text style={styles.modalPhotoActionBtnText}>Retake Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.modalPhotoActionBtn}
                        onPress={() => activeModalTarget && pickImage(activeModalTarget, 'library')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="images" size={14} color="#0f2744" />
                        <Text style={styles.modalPhotoActionBtnText}>Change Photo</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.modalUploadPlaceholderBox}>
                    <Ionicons name="cloud-upload-outline" size={30} color="rgb(240, 117, 15)" />
                    <Text style={styles.modalUploadPromptText}>
                      Upload a clear image of original document
                    </Text>
                    <View style={styles.modalUploadDualBtnRow}>
                      <TouchableOpacity
                        style={styles.modalSourceBtnPrimary}
                        onPress={() => activeModalTarget && pickImage(activeModalTarget, 'camera')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="camera" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.modalSourceBtnPrimaryText}>Take Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.modalSourceBtnSecondary}
                        onPress={() => activeModalTarget && pickImage(activeModalTarget, 'library')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="images-outline" size={15} color="#0f2744" style={{ marginRight: 6 }} />
                        <Text style={styles.modalSourceBtnSecondaryText}>Choose Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* Manual Validity Dates & Number Section */}
              <View style={styles.modalSectionCard}>
                <Text style={styles.modalSectionHeader}>2. Enter Details Manually</Text>

                {/* Document Number */}
                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalFieldLabel}>
                    {modalConfig?.numberLabel || 'Document Number'}
                  </Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={modalDocNumber}
                    onChangeText={(t) => setModalDocNumber(t.toUpperCase())}
                    placeholder={modalConfig?.numberPlaceholder || 'Enter number'}
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                  />
                </View>

                {/* Conditional Dates Section */}
                {modalConfig?.hasValidFrom && modalConfig?.hasValidTo ? (
                  <View>
                    {/* Two Column: Issue/Start Date and Expiry Date */}
                    <View style={styles.modalTwoColDatesRow}>
                      <View style={{ flex: 1, marginRight: 6 }}>
                        <Text style={styles.modalFieldLabel}>
                          {modalConfig.fromLabel}
                        </Text>
                        <TouchableOpacity
                          style={styles.datePickerTriggerBtn}
                          onPress={() => openDatePicker('from')}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="calendar-outline" size={16} color="rgb(240, 117, 15)" style={{ marginRight: 6 }} />
                          <Text
                            style={[
                              styles.datePickerValText,
                              !modalValidFrom && styles.datePickerPlaceholderText,
                            ]}
                            numberOfLines={1}
                          >
                            {modalValidFrom || 'DD/MM/YYYY'}
                          </Text>
                          <Ionicons name="chevron-down" size={13} color="#94a3b8" />
                        </TouchableOpacity>
                      </View>

                      <View style={{ flex: 1, marginLeft: 6 }}>
                        <Text style={[styles.modalFieldLabel, { color: '#b45309' }]}>
                          {modalConfig.toLabel}
                        </Text>
                        <TouchableOpacity
                          style={[styles.datePickerTriggerBtn, styles.datePickerTriggerBtnExpiry]}
                          onPress={() => openDatePicker('to')}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="time-outline" size={16} color="#b45309" style={{ marginRight: 6 }} />
                          <Text
                            style={[
                              styles.datePickerValText,
                              { color: modalValidTo ? '#92400e' : '#94a3b8' },
                              !modalValidTo && styles.datePickerPlaceholderText,
                            ]}
                            numberOfLines={1}
                          >
                            {modalValidTo || 'DD/MM/YYYY'}
                          </Text>
                          <Ionicons name="chevron-down" size={13} color="#b45309" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Quick Preset Buttons for Expiry Date */}
                    <View style={styles.quickPresetRow}>
                      <Text style={styles.quickPresetLabel}>Quick presets:</Text>
                      <TouchableOpacity
                        style={styles.quickPresetPill}
                        onPress={() => applyQuickYearsPreset(1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickPresetPillText}>+1 Year</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickPresetPill}
                        onPress={() => applyQuickYearsPreset(2)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickPresetPillText}>+2 Yrs</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickPresetPill}
                        onPress={() => applyQuickYearsPreset(5)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickPresetPillText}>+5 Yrs</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {/* RC Book: Registration Date Only (No Valid To date required) */}
                {modalConfig?.hasValidFrom && !modalConfig?.hasValidTo ? (
                  <View style={styles.modalFieldGroup}>
                    <Text style={styles.modalFieldLabel}>
                      {modalConfig.fromLabel}
                    </Text>
                    <TouchableOpacity
                      style={styles.datePickerTriggerBtn}
                      onPress={() => openDatePicker('from')}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="calendar-outline" size={17} color="rgb(240, 117, 15)" style={{ marginRight: 8 }} />
                      <Text
                        style={[
                          styles.datePickerValText,
                          !modalValidFrom && styles.datePickerPlaceholderText,
                        ]}
                        numberOfLines={1}
                      >
                        {modalValidFrom || 'Select Registration Date (DD/MM/YYYY)'}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#94a3b8" />
                    </TouchableOpacity>
                    <Text style={styles.docHelperTextNotice}>
                      ⓘ Registration date as printed on RC Book. Expiry date is not required.
                    </Text>
                  </View>
                ) : null}

                {/* Permanent Documents with no expiry (Aadhaar & PAN) */}
                {!modalConfig?.hasValidFrom && !modalConfig?.hasValidTo && modalConfig?.hasDocNumber ? (
                  <View style={styles.permanentDocNotice}>
                    <Ionicons name="infinite" size={18} color="#16a34a" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.permanentDocNoticeTitle}>Permanent Validity</Text>
                      <Text style={styles.permanentDocNoticeText}>
                        This identity document does not expire in India. No expiry date is required.
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Save / Done Button */}
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveModalDocDetails}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.modalSaveButtonText}>Save Document Details</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
        )}
      </Modal>

      {/* ============================================================ */}
      {/* INTERACTIVE CALENDAR DATE PICKER MODAL                       */}
      {/* ============================================================ */}
      <Modal
        visible={calendarVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCalendarVisible(false)}
      >
        {calendarVisible && (
          <TouchableOpacity
            style={styles.calModalOverlay}
            activeOpacity={1}
            onPress={() => setCalendarVisible(false)}
          >
          <TouchableOpacity
            style={styles.calDialogCard}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Calendar Dialog Header */}
            <View style={styles.calDialogHeader}>
              <View style={styles.calHeaderIconBox}>
                <Ionicons
                  name={calendarTarget === 'from' ? 'calendar' : 'time'}
                  size={18}
                  color="rgb(240, 117, 15)"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.calDialogTitle}>
                  {calendarTarget === 'from'
                    ? modalConfig?.fromLabel || 'Select Issue / From Date'
                    : modalConfig?.toLabel || 'Select Valid To / Expired Date'}
                </Text>
                <Text style={styles.calDialogSelectedText}>
                  {calendarSelectedDate
                    ? formatDateStr(calendarSelectedDate)
                    : (calendarTarget === 'from' ? modalValidFrom : modalValidTo) || 'Select date'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.calDialogCloseBtn}
                onPress={() => setCalendarVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Month & Year Navigation Row */}
            <View style={styles.calNavRow}>
              {/* Month Selector */}
              <View style={styles.calMonthNav}>
                <TouchableOpacity
                  style={styles.calNavArrowBtn}
                  onPress={() => changeCalendarMonth(-1)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={16} color="#0f2744" />
                </TouchableOpacity>
                <Text style={styles.calMonthText}>
                  {MONTH_NAMES[calendarMonth]}
                </Text>
                <TouchableOpacity
                  style={styles.calNavArrowBtn}
                  onPress={() => changeCalendarMonth(1)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={16} color="#0f2744" />
                </TouchableOpacity>
              </View>

              {/* Year Selector with Stepper & Direct Year Picker Click */}
              <View style={[styles.calYearNav, calendarViewMode === 'years' && styles.calYearNavActive]}>
                <TouchableOpacity
                  style={styles.calNavArrowBtn}
                  onPress={() => changeCalendarYear(-1)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={15} color="#0f2744" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.calYearCenterBtn}
                  onPress={() => setCalendarViewMode(calendarViewMode === 'years' ? 'days' : 'years')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.calYearText, calendarViewMode === 'years' && { color: 'rgb(240, 117, 15)' }]}>
                    {calendarYear}
                  </Text>
                  <Ionicons
                    name={calendarViewMode === 'years' ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color={calendarViewMode === 'years' ? 'rgb(240, 117, 15)' : 'rgb(240, 117, 15)'}
                    style={{ marginLeft: 3 }}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.calNavArrowBtn}
                  onPress={() => changeCalendarYear(1)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={15} color="#0f2744" />
                </TouchableOpacity>
              </View>
            </View>

            {calendarViewMode === 'years' ? (
              /* Year Selector Grid Mode */
              <View style={styles.calYearPickerView}>
                <View style={styles.calYearPickerTopBar}>
                  <Text style={styles.calYearPickerTitle}>Select Year (Tap to pick):</Text>
                  <TouchableOpacity
                    style={styles.calCloseYearPickerBtn}
                    onPress={() => setCalendarViewMode('days')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.calCloseYearPickerBtnText}>Days Calendar</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.calYearGridScrollView}
                  contentContainerStyle={styles.calYearGridContent}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {AVAILABLE_YEARS.map((y) => {
                    const isSelected = calendarYear === y;
                    const isCurrent = new Date().getFullYear() === y;
                    return (
                      <TouchableOpacity
                        key={y}
                        style={[
                          styles.calYearCell,
                          isSelected && styles.calYearCellSelected,
                          isCurrent && !isSelected && styles.calYearCellCurrent,
                        ]}
                        onPress={() => {
                          setCalendarYear(y);
                          setCalendarViewMode('days');
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.calYearCellText,
                            isSelected && styles.calYearCellTextSelected,
                            isCurrent && !isSelected && styles.calYearCellTextCurrent,
                          ]}
                        >
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <View>
                {/* Days of Week Header */}
                <View style={styles.calWeekdaysRow}>
                  {WEEK_DAYS.map((w, idx) => (
                    <View key={idx} style={styles.calDayCell}>
                      <Text style={[styles.calWeekdayText, idx === 0 && { color: '#ef4444' }]}>
                        {w}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.calGridContainer}>
                  {(() => {
                    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
                    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                    const prevMonthDays = new Date(calendarYear, calendarMonth, 0).getDate();
                    const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;

                    const cells = [];
                    for (let i = 0; i < totalCells; i++) {
                      if (i < firstDayIndex) {
                        // Previous month
                        const prevDay = prevMonthDays - firstDayIndex + i + 1;
                        cells.push(
                          <View key={`prev-${i}`} style={styles.calDayCell}>
                            <Text style={styles.calDayTextMuted}>{prevDay}</Text>
                          </View>
                        );
                      } else if (i >= firstDayIndex + daysInMonth) {
                        // Next month
                        const nextDay = i - (firstDayIndex + daysInMonth) + 1;
                        cells.push(
                          <View key={`next-${i}`} style={styles.calDayCell}>
                            <Text style={styles.calDayTextMuted}>{nextDay}</Text>
                          </View>
                        );
                      } else {
                        // Current month day
                        const dayNum = i - firstDayIndex + 1;
                        const isSelected =
                          calendarSelectedDate &&
                          calendarSelectedDate.getFullYear() === calendarYear &&
                          calendarSelectedDate.getMonth() === calendarMonth &&
                          calendarSelectedDate.getDate() === dayNum;

                        const today = new Date();
                        const isToday =
                          today.getFullYear() === calendarYear &&
                          today.getMonth() === calendarMonth &&
                          today.getDate() === dayNum;

                        cells.push(
                          <TouchableOpacity
                            key={`cur-${dayNum}`}
                            style={[
                              styles.calDayCell,
                              styles.calDayCellActive,
                              isSelected && styles.calDayCellSelected,
                              isToday && !isSelected && styles.calDayCellToday,
                            ]}
                            onPress={() => selectDayFromCalendar(dayNum)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.calDayText,
                                isSelected && styles.calDayTextSelected,
                                isToday && !isSelected && styles.calDayTextToday,
                              ]}
                            >
                              {dayNum}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    }
                    return cells;
                  })()}
                </View>
              </View>
            )}

            {/* Action Bar */}
            <View style={styles.calActionBar}>
              <TouchableOpacity
                style={styles.calTodayBtn}
                onPress={applyTodayInCalendar}
                activeOpacity={0.7}
              >
                <Ionicons name="today-outline" size={15} color="#0f2744" style={{ marginRight: 4 }} />
                <Text style={styles.calTodayBtnText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.calConfirmBtn}
                onPress={() => setCalendarVisible(false)}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.calConfirmBtnText}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
        )}
      </Modal>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 32) + 12 : 16,
    paddingBottom: 24,
  },

  /* Clean Compact Top Bar */
  cleanTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 12,
  },
  cleanTopBarTitleBox: {
    flex: 1,
    paddingRight: 8,
  },
  cleanTopBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  cleanTopBarSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
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
    marginRight: 12,
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

  /* Driver Full Name Input Section */
  driverNameContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  driverNameLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  driverNameLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f2744',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  driverNameRequiredStar: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 3,
  },
  driverNameInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  driverNameInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    paddingVertical: 0,
  },
  driverNameCheckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  driverNameCheckText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    marginLeft: 4,
  },
  driverNameHintText: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 5,
    lineHeight: 14,
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

  /* Fuel Buttons & Radio Button Design (No Card Background / No Card Border) */
  fuelSegmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  fuelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 6,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  fuelBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  fuelBtnInactive: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  fuelBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#475569',
  },
  fuelBtnTextActive: {
    color: 'rgb(240, 117, 15)',
    fontWeight: '800',
  },

  /* Radio Button Indicator Circles */
  radioCircleOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#ffffff',
  },
  radioCircleOuterActive: {
    borderColor: 'rgb(240, 117, 15)',
  },
  radioCircleInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: 'rgb(240, 117, 15)',
  },

  /* Carriage Segment (Yes / No - No Card Background / No Card Border) */
  carriageSegmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 26,
    marginTop: 8,
  },
  carriageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 6,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  carriageBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  carriageBtnInactive: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  carriageBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  carriageBtnTextActive: {
    color: 'rgb(240, 117, 15)',
    fontWeight: '800',
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
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 122,
  },
  docCardTopBlock: {
    alignItems: 'center',
    width: '100%',
  },
  docIconCircle: {
    width: 38,
    height: 38,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  docCardTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 14.5,
    marginTop: 1,
    paddingHorizontal: 2,
  },
  docCardUploadBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#0f2744',
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
    color: '#0f2744',
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

  /* Submit Action Button (Dark Blue Background) */
  submitButton: {
    backgroundColor: '#0f2744',
    borderRadius: 28,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 20,
    shadowColor: '#0f2744',
    shadowOpacity: 0.25,
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

  /* Demo Pill Button */
  demoPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  demoPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
    marginLeft: 3,
  },

  /* Card Expiry Pill */
  cardExpPill: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 4,
    maxWidth: '96%',
  },
  cardExpPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#92400e',
    textAlign: 'center',
  },

  /* Modal Overlay & Bottom Sheet */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  modalBackdropTouch: {
    flex: 1,
  },
  modalSheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 10,
  },
  modalDragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHeaderIconCircle: {
    width: 38,
    height: 38,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modalSheetTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSheetSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollBody: {
    paddingTop: 12,
    paddingBottom: 24,
  },

  /* Modal Sections */
  modalSectionCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  modalSectionHeader: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },

  /* Modal Photo Preview & Buttons */
  modalPhotoAttachedWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  modalPhotoPreviewImg: {
    width: '100%',
    height: 150,
  },
  modalPhotoOverlayActions: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  modalPhotoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  modalPhotoActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f2744',
  },
  modalUploadPlaceholderBox: {
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  modalUploadPromptText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 6,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalUploadDualBtnRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  modalSourceBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(240, 117, 15)',
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalSourceBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalSourceBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalSourceBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f2744',
  },

  /* Modal Fields */
  modalFieldGroup: {
    marginBottom: 10,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
  },
  modalTextInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalTwoColDatesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dateInputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10,
  },
  dateTextInputInner: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
    padding: 0,
  },

  /* Quick Presets */
  quickPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  quickPresetLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginRight: 2,
  },
  quickPresetPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  quickPresetPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
  },

  /* Permanent Doc Notice */
  docHelperTextNotice: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  permanentDocNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  permanentDocNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#16a34a',
  },
  permanentDocNoticeText: {
    fontSize: 11,
    color: '#15803d',
    marginTop: 1,
  },

  /* Modal Save Button */
  modalSaveButton: {
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 12,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgb(240, 117, 15)',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
    marginTop: 4,
  },
  modalSaveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },

  /* Date Picker Trigger Buttons */
  datePickerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    height: 42,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },
  datePickerTriggerBtnExpiry: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffdf5',
  },
  datePickerValText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  datePickerPlaceholderText: {
    color: '#94a3b8',
    fontWeight: '600',
  },

  /* Calendar Modal Overlay & Card */
  calModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  calDialogCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 10,
  },
  calDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  calHeaderIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  calDialogTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  calDialogSelectedText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
    marginTop: 2,
  },
  calDialogCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Month & Year Nav */
  calNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  calMonthNav: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  calMonthText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  calYearNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  calYearNavActive: {
    borderColor: 'rgb(240, 117, 15)',
    backgroundColor: '#fff7ed',
  },
  calYearCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  calYearText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  calNavArrowBtn: {
    padding: 3,
  },

  /* Year Picker Mode Grid */
  calYearPickerView: {
    marginTop: 8,
    marginBottom: 6,
  },
  calYearPickerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  calYearPickerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  calCloseYearPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgb(240, 117, 15)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  calCloseYearPickerBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  calYearGridScrollView: {
    maxHeight: 210,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  calYearGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 6,
    justifyContent: 'flex-start',
  },
  calYearCell: {
    width: '23%',
    height: 38,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calYearCellSelected: {
    backgroundColor: 'rgb(240, 117, 15)',
    borderColor: 'rgb(240, 117, 15)',
  },
  calYearCellCurrent: {
    borderColor: 'rgb(240, 117, 15)',
    borderWidth: 1.5,
  },
  calYearCellText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  calYearCellTextSelected: {
    color: '#ffffff',
    fontWeight: '900',
  },
  calYearCellTextCurrent: {
    color: 'rgb(240, 117, 15)',
    fontWeight: '800',
  },

  /* Quick Year Chips */
  calYearChipsRow: {
    paddingVertical: 6,
    gap: 6,
  },
  calYearChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  calYearChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: 'rgb(240, 117, 15)',
  },
  calYearChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  calYearChipTextActive: {
    color: 'rgb(240, 117, 15)',
  },

  /* Weekdays & Grid */
  calWeekdaysRow: {
    flexDirection: 'row',
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 4,
  },
  calWeekdayText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748b',
    textAlign: 'center',
  },
  calGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  calDayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayCellActive: {
    borderRadius: 19,
  },
  calDayCellSelected: {
    backgroundColor: 'rgb(240, 117, 15)',
  },
  calDayCellToday: {
    borderWidth: 1.5,
    borderColor: 'rgb(240, 117, 15)',
    borderRadius: 19,
  },
  calDayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  calDayTextSelected: {
    color: '#ffffff',
    fontWeight: '900',
  },
  calDayTextToday: {
    color: 'rgb(240, 117, 15)',
    fontWeight: '900',
  },
  calDayTextMuted: {
    fontSize: 11.5,
    color: '#cbd5e1',
  },

  /* Action Bar */
  calActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 10,
  },
  calTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  calTodayBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f2744',
  },
  calConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(240, 117, 15)',
    paddingVertical: 9,
    borderRadius: 10,
  },
  calConfirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  /* Admin KYC Rejection Banner Styles (Redesigned per Reference) */
  rejectionNoticeCard: {
    backgroundColor: '#fff5f5',
    borderWidth: 1.5,
    borderColor: '#fecaca',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#dc2626',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  rejectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rejectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#c90016',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#c90016',
  },
  rejectionSubtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '500',
  },
  rejectionReasonBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  rejectionReasonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rejectionReasonLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#c90016',
  },
  rejectionReasonPill: {
    backgroundColor: '#fee2e2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  rejectionReasonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 19,
  },
  rejectionFooterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
  },
  rejectionFooterText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },

  /* Multi-Vehicle Fleet Selector Styles */
  multiVehicleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f2744',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  multiVehicleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  multiVehicleIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0f2744',
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiVehicleHeaderTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  vehicleCountPill: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  vehicleCountPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f2744',
  },
  multiVehicleHeaderSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  addVehicleBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgb(240, 117, 15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: 'rgb(240, 117, 15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addVehicleBtnTopText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  vehicleChipsScrollContent: {
    paddingVertical: 4,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vehicleTabChip: {
    minWidth: 145,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1.5,
  },
  vehicleTabChipActive: {
    backgroundColor: '#0f2744',
    borderColor: '#0f2744',
    shadowColor: '#0f2744',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  vehicleTabChipInactive: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  vehicleChipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleChipIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  vehicleChipIconCircleActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  vehicleChipPlate: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  vehicleChipPlateActive: {
    color: '#ffffff',
  },
  vehicleChipBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 6,
  },
  vehicleChipModel: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
  },
  vehicleChipModelActive: {
    color: '#cbd5e1',
  },
  vehicleChipBadge: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleChipBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  vehicleChipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  addMoreVehicleChip: {
    minWidth: 140,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: 'rgb(240, 117, 15)',
    borderStyle: 'dashed',
    backgroundColor: '#fff7ed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addMoreVehicleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreVehicleChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgb(240, 117, 15)',
  },
  activeVehicleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeVehicleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16a34a',
    marginRight: 6,
  },
  activeVehicleBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activeVehicleBannerName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  removeVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  removeVehicleBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#dc2626',
  },
  step4VehicleSwitchRow: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  step4VehicleSwitchLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  step4VehicleSwitchSub: {
    fontSize: 10.5,
    color: '#94a3b8',
    fontWeight: '500',
  },
  step4VehiclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    gap: 4,
  },
  step4VehiclePillActive: {
    backgroundColor: '#0f2744',
    borderColor: '#0f2744',
  },
  step4VehiclePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  step4VehiclePillTextActive: {
    color: '#ffffff',
  },
  step4VehiclePillBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 2,
  },
  step4VehiclePillBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  step4VehiclePillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
});
