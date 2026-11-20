export interface SecurityDepositConfig {
  enabled: boolean;
  defaultAmount: number;
  minWalletThreshold: number;
  allowInstallmentDeduction: boolean;
  installmentPercentage: number;
  refundLockPeriodDays: number;
  categoryOverrides: Record<string, number>;
}

export type FineSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ViolationFineRule {
  id: string;
  code: string;
  name: string;
  description: string;
  defaultAmount: number;
  severity: FineSeverity;
  enabled: boolean;
  deductFromPayout: boolean;
}

export interface DepositsAndFinesConfig {
  securityDeposit: SecurityDepositConfig;
  fineRules: ViolationFineRule[];
  autoDeductFromPayout: boolean;
  suspensionFineThreshold: number;
  updatedAt?: string;
}

export type LedgerRecordType = 'DEPOSIT' | 'FINE';
export type LedgerRecordStatus = 'PENDING' | 'DEDUCTED' | 'PAID' | 'REFUNDED' | 'WAIVED';

export interface DriverFineOrDepositRecord {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate?: string;
  type: LedgerRecordType;
  category: string;
  title: string;
  amount: number;
  bookingRef?: string;
  status: LedgerRecordStatus;
  remarks?: string;
  paymentMethod?: string;
  createdAt: string;
  settledAt?: string;
  waiverReason?: string;
}

export const DEFAULT_SECURITY_DEPOSIT_CONFIG: SecurityDepositConfig = {
  enabled: true,
  defaultAmount: 5000,
  minWalletThreshold: 1000,
  allowInstallmentDeduction: true,
  installmentPercentage: 10,
  refundLockPeriodDays: 30,
  categoryOverrides: {
    HATCHBACK: 3000,
    SEDAN: 4000,
    SUV: 5000,
    CRYSTA: 7500,
    TEMPO_TRAVELLER: 10000,
  },
};

export const DEFAULT_FINE_RULES: ViolationFineRule[] = [
  {
    id: 'fine-late-pickup',
    code: 'LATE_ARRIVAL',
    name: 'Late Arrival at Pickup (> 15 mins)',
    description: 'Driver delays pickup beyond scheduled arrival window without notifying passenger or dispatch.',
    defaultAmount: 250,
    severity: 'LOW',
    enabled: true,
    deductFromPayout: true,
  },
  {
    id: 'fine-unauth-cancel',
    code: 'UNAUTHORIZED_CANCELLATION',
    name: 'Driver Cancellation after Acceptance',
    description: 'Driver cancels or drops an accepted dispatch without verified breakdown or emergency proof.',
    defaultAmount: 500,
    severity: 'MEDIUM',
    enabled: true,
    deductFromPayout: true,
  },
  {
    id: 'fine-no-show',
    code: 'NO_SHOW',
    name: 'Driver No-Show without Notice',
    description: 'Driver fails to report to pickup location leaving customer stranded.',
    defaultAmount: 1000,
    severity: 'CRITICAL',
    enabled: true,
    deductFromPayout: true,
  },
  {
    id: 'fine-ac-refusal',
    code: 'AC_REFUSAL',
    name: 'AC Not Switched On / Vehicle Unclean',
    description: 'Refusal to turn on air conditioning or vehicle interior found unhygienic / unpleasant.',
    defaultAmount: 200,
    severity: 'LOW',
    enabled: true,
    deductFromPayout: true,
  },
  {
    id: 'fine-overcharging',
    code: 'OVERCHARGING',
    name: 'Direct Cash Demand / Overcharging',
    description: 'Driver demands extra cash or charges unauthorized fares directly from customer.',
    defaultAmount: 1500,
    severity: 'CRITICAL',
    enabled: true,
    deductFromPayout: true,
  },
  {
    id: 'fine-rude-conduct',
    code: 'RUDE_CONDUCT',
    name: 'Customer Misbehavior / Rude Conduct',
    description: 'Verbal altercation, inappropriate behavior, or abusive language with passenger.',
    defaultAmount: 750,
    severity: 'HIGH',
    enabled: true,
    deductFromPayout: true,
  },
  {
    id: 'fine-bad-feedback',
    code: 'BAD_CUSTOMER_FEEDBACK',
    name: 'Bad Customer Feedback / 1-Star Rating',
    description: 'Verified customer complaint or 1-star trip review for poor service, unhygienic cab, or unsatisfactory trip experience.',
    defaultAmount: 300,
    severity: 'MEDIUM',
    enabled: true,
    deductFromPayout: true,
  },
  {
    id: 'fine-rash-driving',
    code: 'RASH_DRIVING',
    name: 'Over-speeding / Rash Driving (> 100 km/h)',
    description: 'Documented reckless driving, aggressive maneuvers, or excessive highway speeding.',
    defaultAmount: 1000,
    severity: 'HIGH',
    enabled: true,
    deductFromPayout: true,
  },
  {
    id: 'fine-uniform',
    code: 'UNIFORM_NON_COMPLIANCE',
    name: 'Chauffeur Dress Code Non-Compliance',
    description: 'Reporting on duty without prescribed clean uniform or identity badge.',
    defaultAmount: 150,
    severity: 'LOW',
    enabled: true,
    deductFromPayout: true,
  },
  {
    id: 'fine-odometer',
    code: 'ODOMETER_DISCREPANCY',
    name: 'Odometer / Route Mileage Discrepancy',
    description: 'Inflated start/end odometer photo readings or false distance declaration.',
    defaultAmount: 2000,
    severity: 'CRITICAL',
    enabled: true,
    deductFromPayout: true,
  },
];

export const DEFAULT_DEPOSITS_AND_FINES_CONFIG: DepositsAndFinesConfig = {
  securityDeposit: DEFAULT_SECURITY_DEPOSIT_CONFIG,
  fineRules: DEFAULT_FINE_RULES,
  autoDeductFromPayout: true,
  suspensionFineThreshold: 2500,
};
