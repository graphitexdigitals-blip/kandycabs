import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
  driverApiClient,
  getDynamicBaseUrl,
  setCustomApiUrl,
  DEFAULT_LAN_URL,
  DEFAULT_PROD_URL,
} from '../lib/api';

export default function DriverLoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [currentServer, setCurrentServer] = useState(getDynamicBaseUrl());
  const [showServerModal, setShowServerModal] = useState(false);
  const [customServerInput, setCustomServerInput] = useState('');

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await driverApiClient.auth.sendOtp(phone, 'DRIVER');
      if (res.success) {
        if (!res.isRegistered || !res.isDriver) {
          setError('No driver registered with this number. Please contact admin to register as a driver partner.');
          return;
        }
        setStep('OTP');
        if (res.debugOtp) setDebugOtp(res.debugOtp);
      } else {
        setError(res.message || 'No driver registered with this number. Please contact admin.');
      }
    } catch (err: any) {
      setError(err.message || 'No driver registered with this number. Please contact admin.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) {
      setError('Please enter the 4-digit OTP');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await driverApiClient.auth.verifyOtp(phone, otp, undefined, 'DRIVER');
      if (res.success && res.token) {
        try {
          const initialDriver = {
            id: res.user?.id || 'driver',
            name: (res.user as any)?.fullName || (res.user as any)?.name || (phone === '9587425635' ? 'Rakshith' : (phone === '8888888888' ? 'Ramesh Kumar' : 'Driver Partner')),
            phone: phone,
            vehicleNumber: phone === '9587425635' ? 'KA 01 MJ 2023' : (phone === '8888888888' ? 'KA-01-SD-2002' : ''),
            status: 'APPROVED',
            verificationStatus: 'APPROVED',
            onlineStatus: false,
          };
          await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(initialDriver));
        } catch (_) {}
        router.replace('/dashboard');
      } else {
        setError(res.message || 'Verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" translucent={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <View style={styles.header}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={styles.badgeContainer}>
            <Text style={styles.badge}>DRIVER PARTNER NETWORK</Text>
          </View>
          <Text style={styles.subtitle}>Sign in to accept rides and manage your trips</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {step === 'PHONE' ? (
          <View style={styles.form}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.phoneInputContainer}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="9876543210"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleSendOtp}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Get Verification Code</Text>
              )}
            </TouchableOpacity>

            {/* Quick Demo Driver Logins */}
            <View style={styles.demoSection}>
              <Text style={styles.demoHeading}>
                ⚡ Quick Demo Driver Logins
              </Text>
              <TouchableOpacity
                style={styles.demoCardOrange}
                onPress={async () => {
                  setPhone('9587425635');
                  setLoading(true);
                  setError('');
                  try {
                    const otpRes = await driverApiClient.auth.sendOtp('9587425635', 'DRIVER');
                    const devCode = otpRes.debugOtp || '1234';
                    const verifyRes = await driverApiClient.auth.verifyOtp('9587425635', devCode);
                    if (verifyRes.success) {
                      try {
                        const initialDriver = {
                          id: verifyRes.user?.id || 'rakshith',
                          name: 'Rakshith',
                          phone: '9587425635',
                          vehicleNumber: 'KA 01 MJ 2023',
                          status: 'APPROVED',
                          verificationStatus: 'APPROVED',
                          onlineStatus: false,
                        };
                        await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(initialDriver));
                      } catch (_) {}
                      router.replace('/dashboard');
                    } else {
                      setStep('OTP');
                    }
                  } catch (e: any) {
                    // Graceful fallback: If dev server is unreachable over 4G, load demo session directly
                    const initialDriver = {
                      id: 'rakshith',
                      name: 'Rakshith',
                      phone: '9587425635',
                      vehicleNumber: 'KA 01 MJ 2023',
                      status: 'APPROVED',
                      verificationStatus: 'APPROVED',
                      onlineStatus: false,
                    };
                    await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(initialDriver));
                    router.replace('/dashboard');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={styles.demoName}>👨🏽‍✈️ Rakshith (Driver)</Text>
                  <Text style={styles.demoSubtitleOrange}>KA 01 MJ 2023 • +91 9587425635</Text>
                </View>
                <View style={styles.demoActionPillOrange}>
                  <Text style={styles.demoActionTextOrange}>LOGIN →</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoCardBlue}
                onPress={async () => {
                  setPhone('8888888888');
                  setLoading(true);
                  setError('');
                  try {
                    const otpRes = await driverApiClient.auth.sendOtp('8888888888', 'DRIVER');
                    const devCode = otpRes.debugOtp || '1234';
                    const verifyRes = await driverApiClient.auth.verifyOtp('8888888888', devCode);
                    if (verifyRes.success) {
                      try {
                        const initialDriver = {
                          id: verifyRes.user?.id || 'ramesh',
                          name: 'Ramesh Kumar',
                          phone: '8888888888',
                          vehicleNumber: 'KA-01-SD-2002',
                          status: 'APPROVED',
                          verificationStatus: 'APPROVED',
                          onlineStatus: false,
                        };
                        await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(initialDriver));
                      } catch (_) {}
                      router.replace('/dashboard');
                      return;
                    } else {
                      setStep('OTP');
                    }
                  } catch (e: any) {
                    // Graceful fallback: If dev server is unreachable over 4G, load demo session directly
                    const initialDriver = {
                      id: 'ramesh',
                      name: 'Ramesh Kumar',
                      phone: '8888888888',
                      vehicleNumber: 'KA-01-SD-2002',
                      status: 'APPROVED',
                      verificationStatus: 'APPROVED',
                      onlineStatus: false,
                    };
                    await SecureStore.setItemAsync('kandy_cached_driver', JSON.stringify(initialDriver));
                    router.replace('/dashboard');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={styles.demoName}>👨🏽‍✈️ Ramesh Kumar (Driver)</Text>
                  <Text style={styles.demoSubtitleBlue}>KA-01-SD-2002 • +91 8888888888</Text>
                </View>
                <View style={styles.demoActionPillBlue}>
                  <Text style={styles.demoActionTextBlue}>LOGIN →</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Enter 4-Digit OTP</Text>
            <TextInput
              style={styles.otpInput}
              placeholder="••••"
              placeholderTextColor="#cbd5e1"
              keyboardType="number-pad"
              maxLength={4}
              value={otp}
              onChangeText={setOtp}
              autoFocus
            />

            {debugOtp ? (
              <View style={styles.debugBox}>
                <Text style={styles.debugText}>Dev OTP: {debugOtp}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#10b981' }]}
              onPress={handleVerifyOtp}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStep('PHONE')}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>← Change Mobile Number</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  inner: {
    flex: 1,
    padding: 22,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 16,
    alignItems: 'center',
  },
  logoImage: {
    width: 210,
    height: 105,
    marginBottom: 2,
  },
  badgeContainer: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 14,
    marginBottom: 6,
  },
  badge: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  form: {
    backgroundColor: '#ffffff',
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    marginBottom: 18,
    paddingHorizontal: 14,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '700',
  },
  otpInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    paddingVertical: 14,
    fontSize: 26,
    color: '#0f172a',
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#ea580c',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 10,
    borderRadius: 10,
    fontWeight: '600',
  },
  debugBox: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 14,
    alignItems: 'center',
  },
  debugText: {
    color: '#b45309',
    fontSize: 12.5,
    fontWeight: '700',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 4,
  },
  backButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  demoSection: {
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  demoHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  demoCardOrange: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  demoCardBlue: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  demoName: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13.5,
  },
  demoSubtitleOrange: {
    color: '#b45309',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  demoSubtitleBlue: {
    color: '#0284c7',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  demoActionPillOrange: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  demoActionTextOrange: {
    color: '#b45309',
    fontWeight: '800',
    fontSize: 12,
  },
  demoActionPillBlue: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  demoActionTextBlue: {
    color: '#0284c7',
    fontWeight: '800',
    fontSize: 12,
  },
});

