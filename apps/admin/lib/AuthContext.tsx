'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { UserProfile, SendOtpResponse, VerifyOtpResponse, KandyApiClient, apiClient } from '@kandy-cabs/shared';

export interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sendOtp: (phone: string, role?: string) => Promise<SendOtpResponse>;
  verifyOtp: (phone: string, otp: string, fullName?: string) => Promise<VerifyOtpResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserProfile | null>;
  client: KandyApiClient;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
  client?: KandyApiClient;
  initialUser?: UserProfile | null;
}

export function AuthProvider({
  children,
  client = apiClient,
  initialUser = null,
}: AuthProviderProps) {
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [isLoading, setIsLoading] = useState<boolean>(!initialUser);
  const isMounted = useRef(false);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      // 3.5s safety timeout to prevent infinite "Checking authorization..." if backend is slow/unreachable
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 3500)
      );
      const fetchPromise = client.auth.getMe();
      const currentUser = await Promise.race([fetchPromise, timeoutPromise]);
      setUser(currentUser);
      return currentUser;
    } catch (err) {
      console.error('Failed to refresh user session:', err);
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      refreshUser();
    }
  }, [refreshUser]);

  const sendOtp = useCallback(
    async (phone: string, role?: string): Promise<SendOtpResponse> => {
      return await client.auth.sendOtp(phone, role);
    },
    [client]
  );

  const verifyOtp = useCallback(
    async (
      phone: string,
      otp: string,
      fullName?: string
    ): Promise<VerifyOtpResponse> => {
      setIsLoading(true);
      try {
        const response = await client.auth.verifyOtp(phone, otp, fullName);
        if (response.user) {
          setUser(response.user);
        }
        return response;
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await client.auth.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setIsLoading(false);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, [client]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    sendOtp,
    verifyOtp,
    logout,
    refreshUser,
    client,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  sendOtp: async () => ({ success: false, message: 'Auth not initialized' }),
  verifyOtp: async () => ({ success: false, message: 'Auth not initialized' }),
  logout: async () => {},
  refreshUser: async () => null,
  client: apiClient,
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    return defaultAuthContext;
  }
  return context;
}
