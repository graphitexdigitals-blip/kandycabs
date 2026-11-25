import {
  SendOtpResponse,
  VerifyOtpResponse,
  UserProfile,
  AuthUserResponse,
  LogoutResponse,
} from '../auth/types';

export interface TokenStorage {
  getToken(): Promise<string | null> | string | null;
  setToken(token: string): Promise<void> | void;
  removeToken(): Promise<void> | void;
}

// In-memory / Browser localStorage token adapter
export class DefaultTokenStorage implements TokenStorage {
  private memoryToken: string | null = null;

  getToken(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('kandy_token') || this.memoryToken;
    }
    return this.memoryToken;
  }

  setToken(token: string): void {
    this.memoryToken = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('kandy_token', token);
    }
  }

  removeToken(): void {
    this.memoryToken = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('kandy_token');
    }
  }
}

export interface KandyApiClientOptions {
  baseUrl?: string | (() => string);
  tokenStorage?: TokenStorage;
}

export class KandyApiClient {
  private baseUrl: string | (() => string);
  public tokenStorage: TokenStorage;

  constructor(options: KandyApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || (typeof window !== 'undefined' ? '' : 'http://localhost:3000');
    this.tokenStorage = options.tokenStorage || new DefaultTokenStorage();
  }

  public setBaseUrl(url: string | (() => string)) {
    this.baseUrl = url;
  }

  public getBaseUrl(): string {
    return typeof this.baseUrl === 'function' ? this.baseUrl() : this.baseUrl;
  }

  public getToken(): Promise<string | null> | string | null {
    return this.tokenStorage.getToken();
  }

  public setToken(token: string): Promise<void> | void {
    return this.tokenStorage.setToken(token);
  }

  public removeToken(): Promise<void> | void {
    return this.tokenStorage.removeToken();
  }

  public async fetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const currentBaseUrl = this.getBaseUrl();
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${currentBaseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      ...(typeof options.headers === 'object' && !(options.headers instanceof Headers)
        ? (options.headers as Record<string, string>)
        : {}),
    };

    if (options.body && typeof options.body === 'string' && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Automatically attach Bearer token if available
    const token = await this.tokenStorage.getToken();
    if (token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), (options as any).timeoutMs || 25000);

    try {
      response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
        headers,
        credentials: 'include', // send cookies across origins (admin on :3001, web on :3000)
      });
    } catch (netErr: any) {
      if (netErr?.name === 'AbortError') {
        const error: any = new Error('Request timed out. Please check your network connection.');
        error.status = 408;
        throw error;
      }
      const error: any = new Error(
        netErr?.message?.includes('Network') || netErr?.name === 'TypeError'
          ? 'Network request failed. Please check your internet connection.'
          : netErr?.message || 'Network error'
      );
      error.status = 0;
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      let errorBody: any = null;
      try {
        const text = await response.text();
        if (text) {
          if (text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html')) {
            errorMessage = response.status === 404
              ? 'API route not found (HTTP 404). Please ensure the backend is up to date.'
              : response.status === 413
              ? 'Request payload too large (HTTP 413). Please try with smaller photos.'
              : `Server returned error page (HTTP ${response.status})`;
          } else {
            try {
              errorBody = JSON.parse(text);
              errorMessage = errorBody.message || errorBody.error || errorMessage;
            } catch {
              errorMessage = text.length > 200 ? `${text.substring(0, 200)}...` : text;
            }
          }
        }
      } catch (_) {
        // Ignore parsing error
      }
      const error: any = new Error(errorMessage);
      error.status = response.status;
      if (errorBody && typeof errorBody === 'object') {
        error.code = errorBody.code || errorBody.error;
        error.data = errorBody;
      }
      throw error;
    }

    return response.json();
  }

  // Authentication API endpoints
  public auth = {
    sendOtp: async (phone: string, role?: string): Promise<SendOtpResponse> => {
      return this.fetch<SendOtpResponse>('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, role }),
      });
    },

    verifyOtp: async (
      phone: string,
      otp: string,
      fullName?: string,
      role?: string,
      deviceId?: string,
      forceLogoutOtherDevice?: boolean
    ): Promise<VerifyOtpResponse> => {
      const result = await this.fetch<VerifyOtpResponse>('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp, fullName, role, deviceId, forceLogoutOtherDevice }),
      });
      if (result?.token) {
        await this.tokenStorage.setToken(result.token);
      }
      return result;
    },

    getMe: async (): Promise<UserProfile | null> => {
      // Retry once on failure to prevent false logged-out flicker on page refreshes
      let attempts = 0;
      while (attempts < 2) {
        try {
          const res = await this.fetch<AuthUserResponse>('/api/auth/me', {
            method: 'GET',
          });
          return res.user;
        } catch (error: any) {
          attempts++;
          if (error?.status === 401) {
            // Truly unauthenticated (invalid or missing token)
            await this.tokenStorage.removeToken();
            return null;
          }
          if (attempts >= 2) {
            return null;
          }
          // Small backoff before retrying once
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
      return null;
    },

    logout: async (): Promise<LogoutResponse> => {
      try {
        const res = await this.fetch<LogoutResponse>('/api/auth/logout', {
          method: 'POST',
        });
        return res;
      } finally {
        await this.tokenStorage.removeToken();
      }
    },
  };
}

// Global default instance
export const apiClient = new KandyApiClient();
