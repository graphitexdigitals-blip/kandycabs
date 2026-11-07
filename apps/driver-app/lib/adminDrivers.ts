import { CAPTAIN_AVATAR_BASE64 } from '../assets/embeddedAssets';

export interface AdminRegisteredDriver {
  id: string;
  name: string;
  fullName: string;
  phone: string;
  vehicleNumber: string;
  profilePhotoUrl: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  verificationStatus: 'APPROVED' | 'PENDING' | 'REJECTED';
  onlineStatus: boolean;
  vehicle: {
    plateNumber: string;
    model: string;
    category: string;
    fuelType: string;
    seatCount: number;
  };
  vehicles: Array<{
    plateNumber: string;
    model: string;
    category: string;
    fuelType: string;
    seatCount: number;
    rcDocUrl?: string;
    insuranceDocUrl?: string;
  }>;
  docDates?: Record<string, any>;
  expiringDocuments?: any[];
}

export const MOHAN_PHOTO_URL = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80';

export const ADMIN_REGISTERED_DRIVERS: Record<string, AdminRegisteredDriver> = {
  '9900447660': {
    id: 'cmw6vra8m0001lqigq89sboyb',
    name: 'Mohan Kumar',
    fullName: 'Mohan Kumar',
    phone: '+91 9900447660',
    vehicleNumber: 'KA-01-SD-2045',
    profilePhotoUrl: MOHAN_PHOTO_URL,
    status: 'APPROVED',
    verificationStatus: 'APPROVED',
    onlineStatus: false,
    vehicle: {
      plateNumber: 'KA-01-SD-2045',
      model: 'Maruti Suzuki Dzire',
      category: 'SEDAN',
      fuelType: 'DIESEL',
      seatCount: 4,
    },
    vehicles: [
      {
        plateNumber: 'KA-01-SD-2045',
        model: 'Maruti Suzuki Dzire',
        category: 'SEDAN',
        fuelType: 'DIESEL',
        seatCount: 4,
        rcDocUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
        insuranceDocUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
      },
    ],
    docDates: {
      license: { docNumber: 'KA-01-2023-0089745', validFrom: '15/03/2023', validTo: '14/03/2043' },
      aadhaar: { docNumber: '5412 8890 4892', validFrom: '2015', validTo: 'Permanent' },
      pan: { docNumber: 'ABCDE1234F', validFrom: '2018', validTo: 'Permanent' },
      rc: { docNumber: 'KA-01-SD-2045', validFrom: '10/01/2022', validTo: '09/01/2037' },
      insurance: { docNumber: 'POL-98765432-00', validFrom: '15/01/2026', validTo: '14/01/2029' },
      fitness: { docNumber: 'FC-KA01-2024-88', validFrom: '20/02/2024', validTo: '14/11/2028' },
      tax: { docNumber: 'TAX-KA-2024-410', validFrom: '01/04/2025', validTo: '09/12/2028' },
      permit: { docNumber: 'KA-CC-2023-7721', validFrom: '01/06/2023', validTo: '31/05/2028' },
      puc: { docNumber: 'PUC-KA-881920', validFrom: '01/09/2026', validTo: '28/02/2028' },
    },
    expiringDocuments: [],
  },
  '9880933504': {
    id: 'cmw686ug1000yqzpqqkximxjx',
    name: 'Mohan',
    fullName: 'Mohan',
    phone: '+91 9880933504',
    vehicleNumber: 'KA-01-SD-2045',
    profilePhotoUrl: MOHAN_PHOTO_URL,
    status: 'APPROVED',
    verificationStatus: 'APPROVED',
    onlineStatus: false,
    vehicle: {
      plateNumber: 'KA-01-SD-2045',
      model: 'Maruti Suzuki Dzire',
      category: 'SEDAN',
      fuelType: 'DIESEL',
      seatCount: 4,
    },
    vehicles: [
      {
        plateNumber: 'KA-01-SD-2045',
        model: 'Maruti Suzuki Dzire',
        category: 'SEDAN',
        fuelType: 'DIESEL',
        seatCount: 4,
        rcDocUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
        insuranceDocUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
      },
    ],
    docDates: {
      license: { docNumber: 'KA-01-2023-0089745', validFrom: '15/03/2023', validTo: '14/03/2043' },
      aadhaar: { docNumber: '5412 8890 4892', validFrom: '2015', validTo: 'Permanent' },
      pan: { docNumber: 'ABCDE1234F', validFrom: '2018', validTo: 'Permanent' },
      rc: { docNumber: 'KA-01-SD-2045', validFrom: '10/01/2022', validTo: '09/01/2037' },
      insurance: { docNumber: 'POL-98765432-00', validFrom: '15/01/2026', validTo: '14/01/2029' },
      fitness: { docNumber: 'FC-KA01-2024-88', validFrom: '20/02/2024', validTo: '14/11/2028' },
      tax: { docNumber: 'TAX-KA-2024-410', validFrom: '01/04/2025', validTo: '09/12/2028' },
      permit: { docNumber: 'KA-CC-2023-7721', validFrom: '01/06/2023', validTo: '31/05/2028' },
      puc: { docNumber: 'PUC-KA-881920', validFrom: '01/09/2026', validTo: '28/02/2028' },
    },
    expiringDocuments: [],
  },
  '9587425635': {
    id: 'cmu6kf6eg0005e86ioiq0wjkl',
    name: 'Rakshith',
    fullName: 'Rakshith',
    phone: '+91 9587425635',
    vehicleNumber: 'ka 01 mj 2023',
    profilePhotoUrl: CAPTAIN_AVATAR_BASE64,
    status: 'APPROVED',
    verificationStatus: 'APPROVED',
    onlineStatus: false,
    vehicle: {
      plateNumber: 'ka 01 mj 2023',
      model: 'Sedan',
      category: 'SEDAN',
      fuelType: 'PETROL',
      seatCount: 4,
    },
    vehicles: [
      {
        plateNumber: 'ka 01 mj 2023',
        model: 'Sedan',
        category: 'SEDAN',
        fuelType: 'PETROL',
        seatCount: 4,
      },
    ],
    expiringDocuments: [],
  },
  '8105536270': {
    id: 'cmw66cill0001s2uvok9m9hgt',
    name: 'Asha',
    fullName: 'Asha',
    phone: '+91 8105536270',
    vehicleNumber: 'KA-01-SD-2085',
    profilePhotoUrl: CAPTAIN_AVATAR_BASE64,
    status: 'PENDING',
    verificationStatus: 'PENDING',
    onlineStatus: false,
    vehicle: {
      plateNumber: 'KA-01-SD-2085',
      model: 'Maruti Suzuki Dzire',
      category: 'SEDAN',
      fuelType: 'DIESEL',
      seatCount: 4,
    },
    vehicles: [
      {
        plateNumber: 'KA-01-SD-2085',
        model: 'Maruti Suzuki Dzire',
        category: 'SEDAN',
        fuelType: 'DIESEL',
        seatCount: 4,
      },
    ],
    expiringDocuments: [],
  },
  '9483032949': {
    id: 'cmurgpdfk001ige6xatx7b2lf',
    name: 'racchu',
    fullName: 'racchu',
    phone: '+91 9483032949',
    vehicleNumber: 'KA 19 2025',
    profilePhotoUrl: CAPTAIN_AVATAR_BASE64,
    status: 'APPROVED',
    verificationStatus: 'APPROVED',
    onlineStatus: false,
    vehicle: {
      plateNumber: 'KA 19 2025',
      model: 'Wagon R',
      category: 'HATCHBACK',
      fuelType: 'PETROL',
      seatCount: 4,
    },
    vehicles: [
      {
        plateNumber: 'KA 19 2025',
        model: 'Wagon R',
        category: 'HATCHBACK',
        fuelType: 'PETROL',
        seatCount: 4,
      },
    ],
    expiringDocuments: [],
  },
  '9854632158': {
    id: 'cmud05yef0002n0mzzvjj7gzb',
    name: 'ramu',
    fullName: 'ramu',
    phone: '+91 9854632158',
    vehicleNumber: 'ka 01 25 2556',
    profilePhotoUrl: CAPTAIN_AVATAR_BASE64,
    status: 'APPROVED',
    verificationStatus: 'APPROVED',
    onlineStatus: false,
    vehicle: {
      plateNumber: 'ka 01 25 2556',
      model: 'Sedan',
      category: 'SEDAN',
      fuelType: 'PETROL',
      seatCount: 4,
    },
    vehicles: [
      {
        plateNumber: 'ka 01 25 2556',
        model: 'Sedan',
        category: 'SEDAN',
        fuelType: 'PETROL',
        seatCount: 4,
      },
    ],
    expiringDocuments: [],
  },
};

export function getAdminRegisteredDriver(phone: string): AdminRegisteredDriver | null {
  const clean = (phone || '').replace(/\D/g, '').slice(-10);
  return ADMIN_REGISTERED_DRIVERS[clean] || null;
}

