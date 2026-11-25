'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { TripType, VehicleCategory, PaymentStatus } from '@kandy-cabs/shared';
import { ALL_LOCATIONS, PlaceLocation, calculateGeoDistanceKm } from '@/lib/locations';
import { calculateRouteDistance } from '@/lib/distance';
import {
  IconPhone,
  IconUser,
  IconMail,
  IconMapPin,
  IconCalendar,
  IconClock,
  IconCar,
  IconCash,
  IconCheckCircle,
  IconAlert,
  IconX,
  IconUsers,
  IconPackage,
  IconPlane,
} from '@/components/Icons';

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (booking: any) => void;
}

export interface FleetOption {
  id: string;
  category: VehicleCategory;
  name: string;
  models: string;
  passengers: number;
  luggage: number;
  fuel: string;
  baseKmRate: number;
  minKm: number;
  badge?: string;
  badgeClass?: string;
  hasCarrier: boolean;
}

export const REGISTERED_FLEETS: FleetOption[] = [
  {
    id: 'HATCHBACK',
    category: VehicleCategory.HATCHBACK,
    name: 'Sedan – Compact',
    models: 'Toyota Glanza, WagonR, Tiago',
    passengers: 4,
    luggage: 2,
    fuel: 'CNG / Petrol',
    baseKmRate: 11,
    minKm: 50,
    badge: 'Economy Choice',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    hasCarrier: false,
  },
  {
    id: 'SWIFT_DZIRE',
    category: VehicleCategory.SEDAN,
    name: 'Sedan – Swift Dzire',
    models: 'Maruti Suzuki Dzire',
    passengers: 4,
    luggage: 3,
    fuel: 'Diesel',
    baseKmRate: 13,
    minKm: 60,
    hasCarrier: false,
  },
  {
    id: 'TOYOTA_ETIOS',
    category: VehicleCategory.SEDAN,
    name: 'Sedan – Toyota Etios',
    models: 'Toyota Etios (Diesel Boot)',
    passengers: 4,
    luggage: 4,
    fuel: 'Diesel with Boot',
    baseKmRate: 14,
    minKm: 60,
    badge: 'Recommended',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    hasCarrier: false,
  },
  {
    id: 'SUV_ERTIGA',
    category: VehicleCategory.SUV,
    name: 'SUV – Ertiga',
    models: 'Maruti Suzuki Ertiga',
    passengers: 6,
    luggage: 4,
    fuel: 'CNG / Petrol',
    baseKmRate: 16,
    minKm: 80,
    badge: 'Family & Group',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    hasCarrier: true,
  },
  {
    id: 'SUV_CARENS',
    category: VehicleCategory.SUV,
    name: 'SUV – Kia Carens',
    models: 'Kia Carens Diesel Luxury',
    passengers: 6,
    luggage: 4,
    fuel: 'Diesel',
    baseKmRate: 18,
    minKm: 80,
    badge: 'Premium 6-Seater',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    hasCarrier: true,
  },
  {
    id: 'SUV_INNOVA',
    category: VehicleCategory.SUV_INNOVA,
    name: 'SUV – Toyota Innova',
    models: 'Toyota Innova 7+1 Touring',
    passengers: 7,
    luggage: 5,
    fuel: 'Diesel',
    baseKmRate: 19,
    minKm: 90,
    badge: 'Popular 7-Seater',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    hasCarrier: true,
  },
  {
    id: 'SUV_CRYSTA',
    category: VehicleCategory.SUV_INNOVA,
    name: 'SUV – Innova Crysta',
    models: 'Innova Crysta Diesel Luxury',
    passengers: 7,
    luggage: 5,
    fuel: 'Diesel',
    baseKmRate: 20,
    minKm: 100,
    badge: 'Executive Luxury',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    hasCarrier: true,
  },
  {
    id: 'TEMPO_TRAVELER',
    category: VehicleCategory.TEMPO_TRAVELER,
    name: 'Tempo Traveller',
    models: 'Force Traveller 12-17 Seater',
    passengers: 14,
    luggage: 10,
    fuel: 'Diesel',
    baseKmRate: 26,
    minKm: 150,
    badge: 'Large Group',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    hasCarrier: true,
  },
];

export const calculateFleetFare = (fleet: FleetOption, km: number, type: TripType): number => {
  if (km <= 0) return 0;
  const minKm = type === TripType.ROUND ? Math.max(km, 250) : Math.max(km, fleet.minKm);
  return Math.round(minKm * fleet.baseKmRate * 1.15);
};

export function CreateBookingModal({ isOpen, onClose, onSuccess }: CreateBookingModalProps) {
  // Form State
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [existingCustomerInfo, setExistingCustomerInfo] = useState<any | null>(null);
  const [isLookingUpPhone, setIsLookingUpPhone] = useState(false);

  // Trip Config
  const [tripType, setTripType] = useState<TripType>(TripType.ONEWAY);
  const [selectedFleetId, setSelectedFleetId] = useState<string>('TOYOTA_ETIOS');
  const selectedFleet = useMemo(
    () => REGISTERED_FLEETS.find((f) => f.id === selectedFleetId) || REGISTERED_FLEETS[2],
    [selectedFleetId]
  );
  const [category, setCategory] = useState<VehicleCategory>(VehicleCategory.SEDAN);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropAddress, setDropAddress] = useState('');
  const [pickupPlace, setPickupPlace] = useState<PlaceLocation | null>(null);
  const [dropPlace, setDropPlace] = useState<PlaceLocation | null>(null);

  // Location dropdown & OSM state
  const [isPickupFocused, setIsPickupFocused] = useState(false);
  const [isDropFocused, setIsDropFocused] = useState(false);
  const [osmPickupResults, setOsmPickupResults] = useState<PlaceLocation[]>([]);
  const [isSearchingOsmPickup, setIsSearchingOsmPickup] = useState(false);
  const [osmDropResults, setOsmDropResults] = useState<PlaceLocation[]>([]);
  const [isSearchingOsmDrop, setIsSearchingOsmDrop] = useState(false);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [distanceSource, setDistanceSource] = useState<'AUTO' | 'MANUAL'>('AUTO');

  const pickupContainerRef = useRef<HTMLDivElement>(null);
  const dropContainerRef = useRef<HTMLDivElement>(null);

  // Date & Time
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);
  const [pickupDate, setPickupDate] = useState(tomorrowStr);
  const [pickupTime, setPickupTime] = useState('09:00');

  // Pricing & Advance
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [estimatedFare, setEstimatedFare] = useState<string>('');
  const [advanceAmount, setAdvanceAmount] = useState<string>('');
  const [advancePaymentStatus, setAdvancePaymentStatus] = useState<PaymentStatus>(PaymentStatus.PENDING);
  const [driverPayeeAmount, setDriverPayeeAmount] = useState<string>('');
  const [showFareBreakdown, setShowFareBreakdown] = useState(false);

  // Additional Requirements
  const [passengers, setPassengers] = useState<number>(1);
  const [isLuggageSectionOpen, setIsLuggageSectionOpen] = useState(false);
  const [smallBags, setSmallBags] = useState<number>(0);
  const [mediumBags, setMediumBags] = useState<number>(0);
  const [largeBags, setLargeBags] = useState<number>(0);
  const [extraLargeBags, setExtraLargeBags] = useState<number>(0);

  // Care & Ride Preferences
  const [isSeniorCitizen, setIsSeniorCitizen] = useState(false);
  const [isBabyOnBoard, setIsBabyOnBoard] = useState(false);
  const [isPregnancyFriendly, setIsPregnancyFriendly] = useState(false);
  const [isHandicapped, setIsHandicapped] = useState(false);
  const [isPetFriendly, setIsPetFriendly] = useState(false);
  const [selectedPetType, setSelectedPetType] = useState<'dog' | 'cat' | 'bird'>('dog');
  const [requestCarrier, setRequestCarrier] = useState(false);
  const [needAirportDrop, setNeedAirportDrop] = useState(false);
  const [needAirportPickup, setNeedAirportPickup] = useState(false);
  const [needReturnJourney, setNeedReturnJourney] = useState(false);
  const [flightNumber, setFlightNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Driver Assignment (Optional)
  const [assignedDriverId, setAssignedDriverId] = useState('');
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch online drivers when modal opens & reset fresh state
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSuccessToast('');
      setPickupAddress('');
      setDropAddress('');
      setPickupPlace(null);
      setDropPlace(null);
      setDistanceKm('');
      setEstimatedFare('');
      setAdvanceAmount('');
      setDriverPayeeAmount('');
      setDistanceSource('AUTO');
      setPassengers(1);
      setSmallBags(0);
      setMediumBags(0);
      setLargeBags(0);
      setExtraLargeBags(0);
      setIsSeniorCitizen(false);
      setIsBabyOnBoard(false);
      setIsPregnancyFriendly(false);
      setIsHandicapped(false);
      setIsPetFriendly(false);
      setRequestCarrier(false);
      setNeedAirportDrop(false);
      setNeedAirportPickup(false);
      setNeedReturnJourney(false);
      setFlightNumber('');
      setNotes('');
      fetch('/api/admin/drivers/online')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.drivers)) {
            setAvailableDrivers(data.drivers);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const totalBags = smallBags + mediumBags + largeBags + extraLargeBags;

  const luggageSummary = useMemo(() => {
    const parts: string[] = [];
    if (smallBags > 0) parts.push(`${smallBags} Small`);
    if (mediumBags > 0) parts.push(`${mediumBags} Med (10kg)`);
    if (largeBags > 0) parts.push(`${largeBags} Lrg (20kg)`);
    if (extraLargeBags > 0) parts.push(`${extraLargeBags} XL (30kg)`);
    return parts.length > 0 ? parts.join(', ') : 'No bags added';
  }, [smallBags, mediumBags, largeBags, extraLargeBags]);

  const compiledSpecialRequirements = useMemo(() => {
    const items: string[] = [];
    if (isSeniorCitizen) items.push('Senior Citizens (Above 60)');
    if (isBabyOnBoard) items.push('Baby on Board');
    if (isPregnancyFriendly) items.push('Pregnancy Friendly');
    if (isHandicapped) items.push('Accessibility / Wheelchair Support');
    if (isPetFriendly) items.push(`Pet Friendly (${selectedPetType.toUpperCase()})`);
    if (requestCarrier) items.push('Roof Carrier Required');
    if (needAirportDrop) items.push('Airport Drop');
    if (needAirportPickup) items.push(`Airport Pickup ${flightNumber ? `(Flight: ${flightNumber})` : ''}`);
    if (needReturnJourney) items.push('Return Journey Later');
    if (notes.trim()) items.push(`Note: ${notes.trim()}`);
    return items.join(' • ');
  }, [
    isSeniorCitizen,
    isBabyOnBoard,
    isPregnancyFriendly,
    isHandicapped,
    isPetFriendly,
    selectedPetType,
    requestCarrier,
    needAirportDrop,
    needAirportPickup,
    flightNumber,
    needReturnJourney,
    notes,
  ]);

  // Recalculate default fare when distance or fleet changes
  const handleDistanceChange = (kmStr: string) => {
    setDistanceKm(kmStr);
    const km = parseFloat(kmStr) || 0;
    if (km > 0) {
      const calculatedTotal = calculateFleetFare(selectedFleet, km, tripType);
      setEstimatedFare(String(calculatedTotal));
      const calcAdv = Math.round(calculatedTotal * 0.3);
      setAdvanceAmount(String(calcAdv));
      const calcDriver = Math.round(calculatedTotal * 0.77);
      setDriverPayeeAmount(String(calcDriver));
    } else {
      setEstimatedFare('');
      setAdvanceAmount('');
      setDriverPayeeAmount('');
    }
  };

  const handleSelectFleet = (fleet: FleetOption) => {
    setSelectedFleetId(fleet.id);
    setCategory(fleet.category);
    if (passengers > fleet.passengers) {
      setPassengers(fleet.passengers);
    }
    if (!fleet.hasCarrier && requestCarrier) {
      setRequestCarrier(false);
    }
    const km = parseFloat(distanceKm) || 0;
    if (km > 0) {
      const calculatedTotal = calculateFleetFare(fleet, km, tripType);
      setEstimatedFare(String(calculatedTotal));
      setAdvanceAmount(String(Math.round(calculatedTotal * 0.3)));
      setDriverPayeeAmount(String(Math.round(calculatedTotal * 0.77)));
    }
  };

  const handleTripTypeChange = (newType: TripType) => {
    setTripType(newType);
    if (newType === TripType.AIRPORT) {
      setNeedAirportDrop(true);
    }
    const km = parseFloat(distanceKm) || 0;
    if (km > 0) {
      const calculatedTotal = calculateFleetFare(selectedFleet, km, newType);
      setEstimatedFare(String(calculatedTotal));
      setAdvanceAmount(String(Math.round(calculatedTotal * 0.3)));
      setDriverPayeeAmount(String(Math.round(calculatedTotal * 0.77)));
    }
  };

  // Phone lookup debounce
  const handlePhoneChange = (val: string) => {
    setCustomerPhone(val);
    const digits = val.replace(/\D/g, '');
    if (digits.length >= 10) {
      if (lookupTimeoutRef.current) clearTimeout(lookupTimeoutRef.current);
      lookupTimeoutRef.current = setTimeout(async () => {
        setIsLookingUpPhone(true);
        try {
          const res = await fetch(`/api/admin/customers/lookup?phone=${encodeURIComponent(digits.slice(-10))}`);
          const data = await res.json();
          if (data && data.found && data.customer) {
            setExistingCustomerInfo(data.customer);
            if (!customerName && data.customer.fullName && data.customer.fullName !== 'Valued Customer') {
              setCustomerName(data.customer.fullName);
            }
            if (!customerEmail && data.customer.email) {
              setCustomerEmail(data.customer.email);
            }
            if (!pickupAddress && data.customer.recentPickup) {
              setPickupAddress(data.customer.recentPickup);
              const matched = ALL_LOCATIONS.find(
                (l) =>
                  l.label.toLowerCase() === data.customer.recentPickup.toLowerCase() ||
                  (l.sublabel && l.sublabel.toLowerCase() === data.customer.recentPickup.toLowerCase())
              );
              if (matched) {
                setPickupPlace(matched);
              }
            }
          } else {
            setExistingCustomerInfo(null);
          }
        } catch {
          setExistingCustomerInfo(null);
        } finally {
          setIsLookingUpPhone(false);
        }
      }, 400);
    } else {
      setExistingCustomerInfo(null);
    }
  };

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickupContainerRef.current && !pickupContainerRef.current.contains(e.target as Node)) {
        setIsPickupFocused(false);
      }
      if (dropContainerRef.current && !dropContainerRef.current.contains(e.target as Node)) {
        setIsDropFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered preset locations for Pickup
  const filteredPickupPresets = useMemo(() => {
    const q = pickupAddress.toLowerCase().trim();
    if (!q) {
      return ALL_LOCATIONS.filter((l) => l.category === 'AIRPORTS' || l.category === 'MANGALURU').slice(0, 8);
    }
    return ALL_LOCATIONS.filter((loc) => {
      return (
        loc.label.toLowerCase().includes(q) ||
        (loc.sublabel && loc.sublabel.toLowerCase().includes(q)) ||
        (loc.keywords && loc.keywords.some((k) => k.toLowerCase().includes(q)))
      );
    }).slice(0, 8);
  }, [pickupAddress]);

  // Filtered preset locations for Drop
  const filteredDropPresets = useMemo(() => {
    const q = dropAddress.toLowerCase().trim();
    if (!q) {
      return ALL_LOCATIONS.filter((l) => l.category === 'OUTSTATION' || l.category === 'AIRPORTS').slice(0, 8);
    }
    return ALL_LOCATIONS.filter((loc) => {
      return (
        loc.label.toLowerCase().includes(q) ||
        (loc.sublabel && loc.sublabel.toLowerCase().includes(q)) ||
        (loc.keywords && loc.keywords.some((k) => k.toLowerCase().includes(q)))
      );
    }).slice(0, 8);
  }, [dropAddress]);

  // OSM Live Search for Pickup (Debounced 350ms)
  useEffect(() => {
    if (!pickupAddress || pickupAddress.trim().length < 2) {
      setOsmPickupResults([]);
      setIsSearchingOsmPickup(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingOsmPickup(true);
      try {
        const q = encodeURIComponent(`${pickupAddress.trim()}, Karnataka, India`);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=in&limit=6&addressdetails=1`
        );
        if (res.ok) {
          const data = await res.json();
          const places: PlaceLocation[] = data.map((item: any) => {
            const parts = (item.display_name || '').split(',');
            return {
              label: parts[0]?.trim() || item.display_name,
              sublabel: parts.slice(1, 4).join(',').trim(),
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              category: 'OUTSTATION' as const,
              source: 'OSM_LIVE' as const,
            };
          });
          setOsmPickupResults(places);
        }
      } catch {
        // Ignore network errors in OSM search
      } finally {
        setIsSearchingOsmPickup(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [pickupAddress]);

  // OSM Live Search for Drop (Debounced 350ms)
  useEffect(() => {
    if (!dropAddress || dropAddress.trim().length < 2) {
      setOsmDropResults([]);
      setIsSearchingOsmDrop(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingOsmDrop(true);
      try {
        const q = encodeURIComponent(`${dropAddress.trim()}, Karnataka, India`);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=in&limit=6&addressdetails=1`
        );
        if (res.ok) {
          const data = await res.json();
          const places: PlaceLocation[] = data.map((item: any) => {
            const parts = (item.display_name || '').split(',');
            return {
              label: parts[0]?.trim() || item.display_name,
              sublabel: parts.slice(1, 4).join(',').trim(),
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              category: 'OUTSTATION' as const,
              source: 'OSM_LIVE' as const,
            };
          });
          setOsmDropResults(places);
        }
      } catch {
        // Ignore network errors in OSM search
      } finally {
        setIsSearchingOsmDrop(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [dropAddress]);

  // Driving distance recalculation
  const recalcDistance = useCallback(async (p: PlaceLocation, d: PlaceLocation) => {
    setIsCalculatingDistance(true);
    try {
      const route = await calculateRouteDistance(p.lat, p.lng, d.lat, d.lng);
      const dist = Math.max(Math.round(route.distanceKm * 10) / 10, 1);
      setDistanceKm(String(dist));
      setDistanceSource('AUTO');
      handleDistanceChange(String(dist));
    } catch {
      const geo = calculateGeoDistanceKm(p.lat, p.lng, d.lat, d.lng);
      const est = Math.max(Math.round(geo * 1.25 * 10) / 10, 5);
      setDistanceKm(String(est));
      setDistanceSource('AUTO');
      handleDistanceChange(String(est));
    } finally {
      setIsCalculatingDistance(false);
    }
  }, [selectedFleetId, tripType]);

  const handleSelectPickup = (place: PlaceLocation) => {
    setPickupAddress(place.label);
    setPickupPlace(place);
    setIsPickupFocused(false);
    if (dropPlace && place.lat && place.lng && dropPlace.lat && dropPlace.lng) {
      recalcDistance(place, dropPlace);
    }
  };

  const handleSelectDrop = (place: PlaceLocation) => {
    setDropAddress(place.label);
    setDropPlace(place);
    setIsDropFocused(false);
    if (pickupPlace && place.lat && place.lng && pickupPlace.lat && pickupPlace.lng) {
      recalcDistance(pickupPlace, place);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit customer mobile number.');
      return;
    }

    if (!pickupAddress.trim()) {
      setErrorMessage('Please specify the pickup address/location.');
      return;
    }

    if (!dropAddress.trim()) {
      setErrorMessage('Please specify the drop address/location.');
      return;
    }

    const parsedDistance = parseFloat(distanceKm) || 0;
    if (parsedDistance <= 0) {
      setErrorMessage('Please select pickup & drop locations or enter trip distance in KM.');
      return;
    }

    const parsedFare = parseFloat(estimatedFare) || 0;
    if (parsedFare <= 0) {
      setErrorMessage('Please specify or verify the customer fare amount.');
      return;
    }

    const scheduledDateTime = `${pickupDate}T${pickupTime || '09:00'}:00.000+05:30`;

    setSubmitting(true);
    try {
      const payload = {
        customerPhone: `+91${cleanPhone.slice(-10)}`,
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        tripType,
        category,
        fleetId: selectedFleet.id,
        fleetName: selectedFleet.name,
        pickupAddress: pickupAddress.trim(),
        dropAddress: dropAddress.trim(),
        scheduledAt: scheduledDateTime,
        distanceKm: parsedDistance,
        estimatedFare: parsedFare,
        advanceAmount: parseFloat(advanceAmount) || 0,
        advancePaymentStatus,
        driverPayeeAmount: parseFloat(driverPayeeAmount) || undefined,
        assignedDriverId: assignedDriverId || undefined,
        passengers,
        luggage: luggageSummary,
        luggageDetails: {
          small: smallBags,
          medium: mediumBags,
          large: largeBags,
          extraLarge: extraLargeBags,
        },
        hasCarrier: requestCarrier,
        hasPet: isPetFriendly,
        petType: isPetFriendly ? selectedPetType : undefined,
        isSeniorCitizen,
        isBabyOnBoard,
        isPregnancyFriendly,
        isHandicapped,
        needAirportDrop,
        needAirportPickup,
        needReturnJourney,
        flightNumber: flightNumber.trim() || undefined,
        specialRequirements: compiledSpecialRequirements || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create booking');
      }

      setSuccessToast(`Booking ${data.booking?.humanReadableRef || ''} confirmed!`);
      setTimeout(() => {
        onSuccess(data.booking);
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while creating the booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 font-extrabold text-lg">
              +
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Book Trip for Customer</h2>
              <p className="text-xs text-slate-300">
                Create & dispatch an official booking via Customer Phone Number
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 text-xs text-slate-700">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
              <IconAlert className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {successToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2">
              <IconCheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-bold">{successToast}</span>
            </div>
          )}

          {/* 1. CUSTOMER INFO */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <IconUser className="w-3.5 h-3.5 text-slate-500" />
                <span>1. Customer Details</span>
              </span>
              {existingCustomerInfo && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center space-x-1">
                  <span>✓ Existing Customer:</span>
                  <span className="underline">{existingCustomerInfo.fullName || 'Registered'}</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Customer Phone <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400 text-xs font-semibold">+91</span>
                  <input
                    type="tel"
                    required
                    placeholder="9481086058"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full pl-10 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  {isLookingUpPhone && (
                    <span className="absolute right-2.5 top-2 text-[10px] text-amber-600 font-semibold animate-pulse">
                      Searching...
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Passenger Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rakshith"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="customer@gmail.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* 2. ROUTE & TRIP TYPE */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <IconMapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>2. Trip Route & Schedule</span>
              </span>

              {/* Trip Type Selector */}
              <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-[10px] font-bold">
                {[
                  { id: TripType.ONEWAY, label: 'One Way' },
                  { id: TripType.ROUND, label: 'Round Trip' },
                  { id: TripType.AIRPORT, label: 'Airport' },
                  { id: TripType.LOCAL, label: 'Local Rental' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTripTypeChange(t.id)}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      tripType === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pickup Address Autocomplete */}
              <div className="relative" ref={pickupContainerRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Pickup Address / Landmark <span className="text-rose-500">*</span>
                  </label>
                  {pickupPlace && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center space-x-1">
                      <span>📍 Pinned</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mangaluru Airport (IXE) or Kadri, Mangalore"
                    value={pickupAddress}
                    onFocus={() => setIsPickupFocused(true)}
                    onChange={(e) => {
                      setPickupAddress(e.target.value);
                      setIsPickupFocused(true);
                      if (!e.target.value) setPickupPlace(null);
                    }}
                    className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden transition"
                  />
                  {pickupAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickupAddress('');
                        setPickupPlace(null);
                        setIsPickupFocused(false);
                      }}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                      title="Clear"
                    >
                      <IconX className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu */}
                {isPickupFocused && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100">
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 border-b border-slate-100">
                      <span>{pickupAddress.trim() ? 'Matching Locations' : 'Popular Pickup Hubs'}</span>
                      {isSearchingOsmPickup && (
                        <span className="text-amber-600 font-medium flex items-center space-x-1">
                          <span className="w-2 h-2 border-2 border-amber-500 border-t-transparent rounded-full animate-spin inline-block" />
                          <span>Searching map...</span>
                        </span>
                      )}
                    </div>

                    {filteredPickupPresets.map((loc, idx) => {
                      const badge =
                        loc.category === 'AIRPORTS'
                          ? { text: 'Airport', bg: 'bg-sky-50 text-sky-700 border-sky-200', icon: '✈️' }
                          : loc.category === 'MANGALURU'
                          ? { text: 'Coastal', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '📍' }
                          : { text: 'Outstation', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: '🚗' };
                      return (
                        <button
                          key={`preset-p-${idx}-${loc.label}`}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectPickup(loc);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-amber-50/60 transition flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                            <span className="text-sm shrink-0">{badge.icon}</span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 text-xs truncate group-hover:text-amber-600">
                                {loc.label}
                              </div>
                              {loc.sublabel && (
                                <div className="text-[10px] text-slate-400 truncate">{loc.sublabel}</div>
                              )}
                            </div>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${badge.bg}`}>
                            {badge.text}
                          </span>
                        </button>
                      );
                    })}

                    {osmPickupResults.length > 0 && (
                      <>
                        <div className="px-3 py-1 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-y border-slate-100">
                          Live OpenStreetMap Results
                        </div>
                        {osmPickupResults.map((loc, idx) => (
                          <button
                            key={`osm-p-${idx}-${loc.label}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectPickup(loc);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-amber-50/60 transition flex items-center justify-between group cursor-pointer"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                              <span className="text-sm shrink-0">🌐</span>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800 text-xs truncate group-hover:text-amber-600">
                                  {loc.label}
                                </div>
                                {loc.sublabel && (
                                  <div className="text-[10px] text-slate-400 truncate">{loc.sublabel}</div>
                                )}
                              </div>
                            </div>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 bg-purple-50 text-purple-700 border-purple-200">
                              Live OSM
                            </span>
                          </button>
                        ))}
                      </>
                    )}

                    {filteredPickupPresets.length === 0 && osmPickupResults.length === 0 && (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        {isSearchingOsmPickup
                          ? 'Searching map locations...'
                          : 'No preset matches. You can keep typing any custom address.'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Drop Address Autocomplete */}
              <div className="relative" ref={dropContainerRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Drop Address / City <span className="text-rose-500">*</span>
                  </label>
                  {dropPlace && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center space-x-1">
                      <span>🏁 Pinned</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kempegowda Intl Airport (BLR) or Udupi"
                    value={dropAddress}
                    onFocus={() => setIsDropFocused(true)}
                    onChange={(e) => {
                      setDropAddress(e.target.value);
                      setIsDropFocused(true);
                      if (!e.target.value) setDropPlace(null);
                    }}
                    className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden transition"
                  />
                  {dropAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropAddress('');
                        setDropPlace(null);
                        setIsDropFocused(false);
                      }}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                      title="Clear"
                    >
                      <IconX className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu */}
                {isDropFocused && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100">
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between sticky top-0 z-10 border-b border-slate-100">
                      <span>{dropAddress.trim() ? 'Matching Destinations' : 'Popular Destinations'}</span>
                      {isSearchingOsmDrop && (
                        <span className="text-amber-600 font-medium flex items-center space-x-1">
                          <span className="w-2 h-2 border-2 border-amber-500 border-t-transparent rounded-full animate-spin inline-block" />
                          <span>Searching map...</span>
                        </span>
                      )}
                    </div>

                    {filteredDropPresets.map((loc, idx) => {
                      const badge =
                        loc.category === 'AIRPORTS'
                          ? { text: 'Airport', bg: 'bg-sky-50 text-sky-700 border-sky-200', icon: '✈️' }
                          : loc.category === 'MANGALURU'
                          ? { text: 'Coastal', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '📍' }
                          : { text: 'Outstation', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: '🚗' };
                      return (
                        <button
                          key={`preset-d-${idx}-${loc.label}`}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectDrop(loc);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-amber-50/60 transition flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                            <span className="text-sm shrink-0">{badge.icon}</span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 text-xs truncate group-hover:text-amber-600">
                                {loc.label}
                              </div>
                              {loc.sublabel && (
                                <div className="text-[10px] text-slate-400 truncate">{loc.sublabel}</div>
                              )}
                            </div>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${badge.bg}`}>
                            {badge.text}
                          </span>
                        </button>
                      );
                    })}

                    {osmDropResults.length > 0 && (
                      <>
                        <div className="px-3 py-1 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-y border-slate-100">
                          Live OpenStreetMap Results
                        </div>
                        {osmDropResults.map((loc, idx) => (
                          <button
                            key={`osm-d-${idx}-${loc.label}`}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectDrop(loc);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-amber-50/60 transition flex items-center justify-between group cursor-pointer"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                              <span className="text-sm shrink-0">🌐</span>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-800 text-xs truncate group-hover:text-amber-600">
                                  {loc.label}
                                </div>
                                {loc.sublabel && (
                                  <div className="text-[10px] text-slate-400 truncate">{loc.sublabel}</div>
                                )}
                              </div>
                            </div>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 bg-purple-50 text-purple-700 border-purple-200">
                              Live OSM
                            </span>
                          </button>
                        ))}
                      </>
                    )}

                    {filteredDropPresets.length === 0 && osmDropResults.length === 0 && (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        {isSearchingOsmDrop
                          ? 'Searching map destinations...'
                          : 'No preset matches. You can keep typing any custom address.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Pickup Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Pickup Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Distance (KM)
                  </label>
                  {isCalculatingDistance ? (
                    <span className="text-[10px] text-amber-600 font-semibold animate-pulse flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-ping" />
                      <span>Calculating...</span>
                    </span>
                  ) : distanceSource === 'AUTO' && pickupPlace && dropPlace ? (
                    <span
                      className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200"
                      title="Calculated from real road route"
                    >
                      ⚡ Auto Route
                    </span>
                  ) : null}
                </div>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="Auto or enter KM"
                  value={distanceKm}
                  onChange={(e) => {
                    setDistanceSource('MANUAL');
                    handleDistanceChange(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* 3. REGISTERED FLEET SELECTION */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <IconCar className="w-3.5 h-3.5 text-slate-500" />
                <span>3. Registered Fleet Selection</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                {REGISTERED_FLEETS.length} Registered Models
              </span>
            </div>

            {/* Fleet Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {REGISTERED_FLEETS.map((f) => {
                const isSelected = selectedFleetId === f.id;
                const km = parseFloat(distanceKm) || 0;
                const cardFare = km > 0 ? calculateFleetFare(f, km, tripType) : null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelectFleet(f)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between relative group ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {f.badge && (
                      <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded-full border mb-1.5 self-start ${f.badgeClass}`}>
                        {f.badge}
                      </span>
                    )}
                    <div>
                      <div className="font-bold text-xs text-slate-900 group-hover:text-amber-700 leading-tight">
                        {f.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5" title={f.models}>
                        {f.models}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-600 font-medium">
                        <span>👥 {f.passengers}+1 Seats</span>
                        <span>🧳 {f.luggage} Bags</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 truncate text-[9px] font-semibold">{f.fuel}</span>
                        <span className="font-bold text-amber-700">₹{f.baseKmRate}/km</span>
                      </div>
                      {cardFare !== null && (
                        <div className="text-right text-[11px] font-extrabold text-emerald-700 pt-0.5">
                          ₹{cardFare.toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. ALL ADDITIONAL REQUIREMENTS & SPECIAL PREFERENCES */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <IconUsers className="w-3.5 h-3.5 text-slate-500" />
                <span>4. Additional Requirements & Preferences</span>
              </span>
              {compiledSpecialRequirements && (
                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full truncate max-w-xs" title={compiledSpecialRequirements}>
                  {compiledSpecialRequirements}
                </span>
              )}
            </div>

            {/* Row: Travellers count & Luggage Drawer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200">
              {/* Travellers */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <span>👥</span>
                    <span>Travellers</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {passengers} of max {selectedFleet.passengers} seats selected
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
                    <button
                      type="button"
                      disabled={passengers <= 1}
                      onClick={() => setPassengers((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-30 font-extrabold text-sm transition cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 font-bold text-xs text-slate-900 bg-white">
                      {passengers}
                    </span>
                    <button
                      type="button"
                      disabled={passengers >= selectedFleet.passengers}
                      onClick={() => setPassengers((p) => Math.min(selectedFleet.passengers, p + 1))}
                      className="px-2.5 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-30 font-extrabold text-sm transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Max {selectedFleet.passengers} for {selectedFleet.name}
                  </span>
                </div>
              </div>

              {/* Luggage Load Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <span>🧳</span>
                    <span>Luggage Load</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-700">
                    {totalBags > 0 ? `${totalBags} Bags Selected` : '0 Bags'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLuggageSectionOpen(!isLuggageSectionOpen)}
                  className="w-full px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-left text-xs font-medium text-slate-700 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="truncate">{luggageSummary}</span>
                  <span className="text-slate-400 text-xs ml-2 shrink-0">
                    {isLuggageSectionOpen ? '▲ Close' : '▼ Select Bags'}
                  </span>
                </button>
              </div>
            </div>

            {/* Detailed Luggage Expandable Box */}
            {isLuggageSectionOpen && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5 animate-in fade-in duration-150">
                {/* Small Bag */}
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                      <span>🎒</span>
                      <span>Small Bag</span>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">Handbags, laptop & personal</div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                    <button
                      type="button"
                      disabled={smallBags <= 0}
                      onClick={() => setSmallBags((b) => Math.max(0, b - 1))}
                      className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-bold text-xs text-slate-800">{smallBags}</span>
                    <button
                      type="button"
                      onClick={() => setSmallBags((b) => b + 1)}
                      className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Medium Bag */}
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                      <span>🧳</span>
                      <span>Medium (10 Kg)</span>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">Cabin-size trolley bags</div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                    <button
                      type="button"
                      disabled={mediumBags <= 0}
                      onClick={() => setMediumBags((b) => Math.max(0, b - 1))}
                      className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-bold text-xs text-slate-800">{mediumBags}</span>
                    <button
                      type="button"
                      onClick={() => setMediumBags((b) => b + 1)}
                      className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Large Bag */}
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                      <span>🧳</span>
                      <span>Large (20 Kg)</span>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">Standard check-in suitcases</div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                    <button
                      type="button"
                      disabled={largeBags <= 0}
                      onClick={() => setLargeBags((b) => Math.max(0, b - 1))}
                      className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-bold text-xs text-slate-800">{largeBags}</span>
                    <button
                      type="button"
                      onClick={() => setLargeBags((b) => b + 1)}
                      className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Extra Large Bag */}
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                      <span>📦</span>
                      <span>XL Bag (30 Kg)</span>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">Oversized check-in travel bags</div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                    <button
                      type="button"
                      disabled={extraLargeBags <= 0}
                      onClick={() => setExtraLargeBags((b) => Math.max(0, b - 1))}
                      className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-bold text-xs text-slate-800">{extraLargeBags}</span>
                    <button
                      type="button"
                      onClick={() => setExtraLargeBags((b) => b + 1)}
                      className="w-5 h-5 rounded bg-white border border-slate-300 flex items-center justify-center font-bold text-xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Special Care & Preferences Toggles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Senior Citizens */}
              <label className="flex items-start space-x-2.5 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-amber-300 transition">
                <input
                  type="checkbox"
                  checked={isSeniorCitizen}
                  onChange={(e) => setIsSeniorCitizen(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                />
                <div>
                  <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                    <span>🧓</span>
                    <span>Senior Citizens (Above Age 60)?</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    Easy access seating, gentle driving & driver assistance
                  </p>
                </div>
              </label>

              {/* Baby on Board */}
              <label className="flex items-start space-x-2.5 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-amber-300 transition">
                <input
                  type="checkbox"
                  checked={isBabyOnBoard}
                  onChange={(e) => setIsBabyOnBoard(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                />
                <div>
                  <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                    <span>👶</span>
                    <span>Baby on Board</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    Traveling with an infant or child for safer driving
                  </p>
                </div>
              </label>

              {/* Pregnancy Friendly */}
              <label className="flex items-start space-x-2.5 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-amber-300 transition">
                <input
                  type="checkbox"
                  checked={isPregnancyFriendly}
                  onChange={(e) => setIsPregnancyFriendly(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                />
                <div>
                  <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                    <span>🤰</span>
                    <span>Pregnancy Friendly</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    Extra gentle driving & careful speed on bumpy roads
                  </p>
                </div>
              </label>

              {/* Accessibility Assistance */}
              <label className="flex items-start space-x-2.5 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-amber-300 transition">
                <input
                  type="checkbox"
                  checked={isHandicapped}
                  onChange={(e) => setIsHandicapped(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                />
                <div>
                  <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                    <span>♿</span>
                    <span>Accessibility Assistance</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    Wheelchair support, easy boarding & driver assistance
                  </p>
                </div>
              </label>

              {/* Pet Friendly */}
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPetFriendly}
                    onChange={(e) => setIsPetFriendly(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                  />
                  <div>
                    <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                      <span>🐾</span>
                      <span>Pet Friendly</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Customer traveling with pets (clean cab & pet allowed)
                    </p>
                  </div>
                </label>
                {isPetFriendly && (
                  <div className="flex items-center space-x-2 pl-6 pt-1">
                    <span className="text-[10px] text-slate-500 font-medium">Pet Type:</span>
                    {(['dog', 'cat', 'bird'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedPetType(t)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition cursor-pointer ${
                          selectedPetType === t
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {t === 'dog' ? '🐕 Dog' : t === 'cat' ? '🐈 Cat' : '🦜 Bird'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Roof Carrier */}
              <label className="flex items-start space-x-2.5 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-amber-300 transition">
                <input
                  type="checkbox"
                  checked={requestCarrier}
                  disabled={!selectedFleet.hasCarrier}
                  onChange={(e) => setRequestCarrier(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0 disabled:opacity-40"
                />
                <div>
                  <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                    <span>🧳</span>
                    <span>Roof Carrier?</span>
                    {!selectedFleet.hasCarrier && (
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                        Sedan Boot Only
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    Rooftop luggage carrier for excess bags (SUVs / Travellers)
                  </p>
                </div>
              </label>

              {/* Need an Airport Drop? */}
              <label className="flex items-start space-x-2.5 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-amber-300 transition">
                <input
                  type="checkbox"
                  checked={needAirportDrop}
                  onChange={(e) => setNeedAirportDrop(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                />
                <div>
                  <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                    <span>✈️</span>
                    <span>Need an Airport Drop?</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    Driver alerted for airport departure terminal drop-off
                  </p>
                </div>
              </label>

              {/* Need an Airport Pickup? + Flight Number */}
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needAirportPickup}
                    onChange={(e) => setNeedAirportPickup(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                  />
                  <div>
                    <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                      <span>🛫</span>
                      <span>Need an Airport Pickup?</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Driver arrival gate pickup with flight tracking
                    </p>
                  </div>
                </label>
                {needAirportPickup && (
                  <div className="flex items-center space-x-2 pl-6 pt-1">
                    <span className="text-[10px] text-slate-500 font-medium">Flight No:</span>
                    <input
                      type="text"
                      placeholder="e.g. 6E 312"
                      value={flightNumber}
                      onChange={(e) => setFlightNumber(e.target.value)}
                      className="px-2 py-0.5 bg-slate-50 border border-slate-300 rounded text-xs uppercase font-bold text-slate-800 w-32"
                    />
                  </div>
                )}
              </div>

              {/* Need a Return Journey Later? */}
              <label className="flex items-start space-x-2.5 p-2.5 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-amber-300 transition col-span-1 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={needReturnJourney}
                  onChange={(e) => setNeedReturnJourney(e.target.checked)}
                  className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer shrink-0"
                />
                <div>
                  <div className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                    <span>🔄</span>
                    <span>Need a Return Journey Later?</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                    Customer may require a return trip on a later date (preferred driver priority)
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 5. PRICING & PAYMENT STATUS */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <IconCash className="w-3.5 h-3.5 text-slate-500" />
              <span>5. Pricing & Advance Payment</span>
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Customer Total Fare (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="Auto or enter ₹"
                  value={estimatedFare}
                  onChange={(e) => {
                    setEstimatedFare(e.target.value);
                    const total = parseFloat(e.target.value) || 0;
                    setAdvanceAmount(total > 0 ? String(Math.round(total * 0.3)) : '');
                    setDriverPayeeAmount(total > 0 ? String(Math.round(total * 0.77)) : '');
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Advance Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Auto or enter ₹"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Advance Collection</label>
                <select
                  value={advancePaymentStatus}
                  onChange={(e) => setAdvancePaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  <option value={PaymentStatus.PENDING}>Pending (Customer pays via App)</option>
                  <option value={PaymentStatus.PAID}>Paid (Cash / UPI collected upfront)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Driver Payout (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Auto or enter ₹"
                  value={driverPayeeAmount}
                  onChange={(e) => setDriverPayeeAmount(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-emerald-700 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Helper note explaining Balance & Advance status */}
            <div className={`p-2.5 rounded-lg text-xs flex items-center justify-between border ${
              advancePaymentStatus === PaymentStatus.PAID
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}>
              <div className="flex items-center space-x-2">
                <span>{advancePaymentStatus === PaymentStatus.PAID ? '✅' : 'ℹ️'}</span>
                <span>
                  {advancePaymentStatus === PaymentStatus.PAID
                    ? `Advance of ₹${advanceAmount || '0'} is PAID. Customer pays remaining Balance of ₹${Math.max(0, (parseFloat(estimatedFare) || 0) - (parseFloat(advanceAmount) || 0))} directly to the driver at drop.`
                    : `Advance is PENDING. Full Total Fare of ₹${estimatedFare || '0'} is due at drop (or switch to "Paid" if you collected the ₹${advanceAmount || '0'} advance upfront).`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowFareBreakdown(!showFareBreakdown)}
                className="text-[11px] font-bold underline hover:opacity-80 ml-2 shrink-0 cursor-pointer"
              >
                {showFareBreakdown ? 'Hide Breakdown ▲' : 'View Fare Breakdown ▼'}
              </button>
            </div>

            {/* Profit margin summary bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100 rounded-lg text-[11px] font-medium text-slate-600">
              <div>
                <span>Balance Due from Customer at Drop: </span>
                <span className="font-extrabold text-slate-900 text-xs">
                  ₹{Math.max(0, (parseFloat(estimatedFare) || 0) - (advancePaymentStatus === PaymentStatus.PAID ? (parseFloat(advanceAmount) || 0) : 0))}
                </span>
              </div>
              <div>
                <span>Est. Company Margin: </span>
                <span className="font-bold text-emerald-700">
                  +₹{Math.max(0, (parseFloat(estimatedFare) || 0) - (parseFloat(driverPayeeAmount) || 0))} ({(parseFloat(estimatedFare) > 0 ? Math.round(((parseFloat(estimatedFare) - parseFloat(driverPayeeAmount)) / parseFloat(estimatedFare)) * 100) : 23)}%)
                </span>
              </div>
            </div>

            {/* Collapsible itemized pricing breakdown */}
            {showFareBreakdown && (
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 animate-in fade-in duration-150">
                <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex items-center justify-between">
                  <span>Itemized Fare Breakdown & Allowances</span>
                  <span className="text-[10px] text-slate-500 font-normal">Pricing Engine Formula</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600">1. Base Distance Fare ({Math.max(parseFloat(distanceKm) || 0, selectedFleet.minKm)} KM @ ₹{selectedFleet.baseKmRate}/km):</span>
                    <span className="font-semibold text-slate-900">₹{Math.round(Math.max(parseFloat(distanceKm) || 0, selectedFleet.minKm) * selectedFleet.baseKmRate)}</span>
                  </div>
                  {tripType !== TripType.AIRPORT && tripType !== TripType.LOCAL && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">2. Driver Allowance (Chauffeur Day Bata / Food):</span>
                      <span className="font-semibold text-slate-900">₹350</span>
                    </div>
                  )}
                  {isPetFriendly && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">3. Pet Friendly Surcharge (Sanitization):</span>
                      <span className="font-semibold text-slate-900">₹500</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">4. Applicable GST (5% Transport Service Tax):</span>
                    <span className="font-semibold text-slate-900">₹{Math.round((parseFloat(estimatedFare) || 0) * 0.05 / 1.05)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-xs text-slate-900">
                    <span>= Customer Total Fare:</span>
                    <span className="text-amber-700">₹{estimatedFare || '0'}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded-lg space-y-1 text-[10px] text-slate-600 mt-2">
                  <div className="flex justify-between">
                    <span>• Advance Deposit (30%):</span>
                    <span className="font-bold text-slate-800">₹{advanceAmount || '0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Balance Payable at Trip Completion (70%):</span>
                    <span className="font-bold text-slate-800">₹{Math.round((parseFloat(estimatedFare) || 0) * 0.70)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Driver Payee Settlement (77% payout):</span>
                    <span className="font-bold text-emerald-700">₹{driverPayeeAmount || '0'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. DRIVER ASSIGNMENT (OPTIONAL) & DISPATCH */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <IconCar className="w-3.5 h-3.5 text-slate-500" />
              <span>6. Chauffeur Assignment (Optional) & Dispatch</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Assign Driver (Leave blank for broadcast/dispatch later)
                </label>
                <select
                  value={assignedDriverId}
                  onChange={(e) => setAssignedDriverId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  <option value="">Unassigned (Keep in Pending Dispatch)</option>
                  {availableDrivers.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.user?.fullName || 'Driver'} ({d.user?.phone}) {d.vehicles?.[0] ? `• ${d.vehicles[0].plateNumber}` : ''} {d.onlineStatus ? '🟢 Online' : '⚪ Offline'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Special Notes / Landmark Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Call before arrival, gate #2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating Booking...</span>
                </>
              ) : (
                <>
                  <IconCheckCircle className="w-3.5 h-3.5 text-white" />
                  <span>Confirm & Book Ride</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
