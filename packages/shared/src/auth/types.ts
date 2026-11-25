import { UserRole, DriverVerificationStatus } from '../types';

export interface AuthTokenPayload {
  userId: string;
  phone: string;
  roles: UserRole[];
  customerId?: string | null;
  driverId?: string | null;
  activeDeviceId?: string | null;
  sessionVersion?: number;
}

export interface UserProfile {
  id: string;
  phone: string;
  fullName: string;
  roles: UserRole[];
  createdAt: string | Date;
  customer?: {
    id: string;
    email?: string | null;
    savedAddresses?: any;
  } | null;
  driver?: {
    id: string;
    licenseNumber: string;
    verificationStatus: DriverVerificationStatus;
    onlineStatus: boolean;
    currentLat?: number | null;
    currentLng?: number | null;
  } | null;
}

export interface SendOtpRequest {
  phone: string;
  role?: UserRole | string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  debugOtp?: string; // Only returned in non-production for local testing
  isRegistered?: boolean;
  existingName?: string | null;
  roles?: UserRole[];
  isDriver?: boolean;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
  fullName?: string;
  deviceId?: string;
  forceLogoutOtherDevice?: boolean;
}

export interface VerifyOtpResponse {
  success: boolean;
  token?: string;
  user?: UserProfile;
  message?: string;
  code?: string;
}

export interface AuthUserResponse {
  user: UserProfile;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}
