import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { customerApiClient, customerTokenStorage } from '../lib/api';
import { LOGIN_HERO_IMAGE } from '../constants/loginHeroImage';

export default function CustomerLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const containerWidth = Math.min(width, 480);
  const isCompact = height < 720;
  const heroHeight = Math.round(
    isCompact ? height * 0.34 : Math.min(containerWidth * (682 / 1024) + 20, height * 0.38)
  );
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'NAME'>('PHONE');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // Check if customer is already logged in -> auto-redirect to Home
  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      try {
        const token = await customerTokenStorage.getTokenAsync();
        if (token && mounted) {
          router.replace('/');
          return;
        }
      } catch (err) {
        console.warn('Auth check error:', err);
      } finally {
        if (mounted) setCheckingAuth(false);
      }
    };
    checkAuth();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSendOtp = async () => {
    const cleanedPhone = phone.trim().replace(/\D/g, '');
    if (cleanedPhone.length !== 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await customerApiClient.fetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: cleanedPhone, role: 'CUSTOMER' }),
      });

      if (res.success) {
        const receivedOtp = res.debugOtp || res.devOtp || '1234';
        setDevOtpHint(receivedOtp);
        setOtp(receivedOtp);
        setStep('OTP');
      } else {
        Alert.alert('Unable to Send OTP', res.message || 'Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Network Error', err.message || 'Unable to connect to authentication server. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 4) {
      Alert.alert('Invalid OTP', 'Please enter the 4-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const cleanedPhone = phone.trim().replace(/\D/g, '');
      const res = await customerApiClient.fetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone: cleanedPhone,
          otp: otp.trim(),
        }),
      });

      if (res.success && res.token) {
        customerTokenStorage.setToken(res.token);
        if (res.user) {
          customerTokenStorage.setUser(res.user);
        }

        if (res.hasRegisteredName || (res.user?.fullName && res.user.fullName !== 'Kandy Customer')) {
          router.replace('/');
        } else {
          setStep('NAME');
        }
      } else {
        Alert.alert('Verification Failed', res.message || 'Incorrect OTP code. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Verification Error', err.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name to complete registration.');
      return;
    }

    setLoading(true);
    try {
      const res = await customerApiClient.fetch('/api/auth/update-profile', {
        method: 'POST',
        body: JSON.stringify({ fullName: name.trim() }),
      });
      if (res?.user) {
        customerTokenStorage.setUser(res.user);
      }
      router.replace('/');
    } catch (err: any) {
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };



  if (checkingAuth) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="#ea580c" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { height: '100%', paddingTop: Math.max(topInset - 14, 0) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          bounces={false}
        >
          {/* Top Hero Banner - Exact Matching Scenery, Typography & Innova Car */}
          <View style={[styles.heroContainer, { width: containerWidth, height: heroHeight }]}>
            <Image
              source={LOGIN_HERO_IMAGE}
              style={{ width: containerWidth, height: heroHeight }}
              resizeMode="cover"
            />
          </View>

          {/* Elevated Rounded White Sheet Overlapping Hero */}
          <View
            style={[
              styles.card,
              {
                width: containerWidth,
                paddingBottom: Math.max(insets.bottom + 14, isCompact ? 12 : 20),
              },
            ]}
          >
            <View style={styles.cardMain}>

              {/* Customer Login Section */}
              <View style={[styles.loginSectionBox, { paddingTop: isCompact ? 8 : 18 }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <View style={styles.accentBar} />
                    <Text style={styles.cardTitle}>
                      {step === 'PHONE'
                        ? 'Customer Login'
                        : step === 'OTP'
                        ? 'Verify Code'
                        : 'Complete Profile'}
                    </Text>
                  </View>
                  <Text style={styles.cardSubtitle}>
                    {step === 'PHONE'
                      ? 'Login to book your cab, manage bookings and get the best travel experience.'
                      : step === 'OTP'
                      ? `Enter the 4-digit code sent to +91 ${phone}`
                      : 'Please enter your full name to complete your registration.'}
                  </Text>
                </View>

            {/* STEP 1: Phone Number Input */}
            {step === 'PHONE' && (
              <View style={styles.form}>
                <View style={styles.phoneInputRow}>
                  <Ionicons name="call" size={17} color="#ea580c" />
                  <Text style={styles.prefixText}>+91</Text>
                  <Ionicons name="chevron-down" size={14} color="#103A75" style={{ marginLeft: 4 }} />
                  <View style={styles.prefixDivider} />
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="9481086058"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                    editable={!loading}
                  />
                </View>

                {/* Primary Orange Login Button with Arrow */}
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <View style={styles.buttonContentRow}>
                      <Text style={styles.primaryButtonText}>Login with OTP</Text>
                      <Ionicons name="arrow-forward" size={19} color="#ffffff" style={styles.buttonArrow} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: OTP Verification */}
            {step === 'OTP' && (
              <View style={styles.form}>
                <Text style={styles.inputLabel}>4-DIGIT VERIFICATION CODE</Text>
                <View style={styles.otpInputWrapper}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="••••"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={4}
                    value={otp}
                    onChangeText={setOtp}
                    editable={!loading}
                    autoFocus
                  />
                </View>

                {devOtpHint ? (
                  <TouchableOpacity
                    style={styles.devHintBanner}
                    onPress={() => setOtp(devOtpHint)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="flash" size={15} color="#ea580c" />
                    <Text style={styles.devHintText}>
                      Demo Code: <Text style={{ fontWeight: '800' }}>{devOtpHint}</Text> (Tap to auto-fill)
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <View style={styles.buttonContentRow}>
                      <Text style={styles.primaryButtonText}>Verify & Proceed</Text>
                      <Ionicons name="arrow-forward" size={19} color="#ffffff" style={styles.buttonArrow} />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => {
                    setStep('PHONE');
                    setOtp('');
                  }}
                  disabled={loading}
                >
                  <Ionicons name="arrow-back" size={16} color="#64748b" style={{ marginRight: 6 }} />
                  <Text style={styles.backLinkText}>Change Mobile Number</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 3: Complete Profile Name */}
            {step === 'NAME' && (
              <View style={styles.form}>
                <Text style={styles.inputLabel}>YOUR FULL NAME</Text>
                <View style={styles.phoneInputRow}>
                  <Ionicons name="person-outline" size={18} color="#64748b" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="e.g. Rachel Sharma"
                    placeholderTextColor="#94a3b8"
                    value={name}
                    onChangeText={setName}
                    editable={!loading}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleSaveName}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <View style={styles.buttonContentRow}>
                      <Text style={styles.primaryButtonText}>Continue to Home</Text>
                      <Ionicons name="arrow-forward" size={19} color="#ffffff" style={styles.buttonArrow} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
              </View>
            </View>

            {/* Trust & Brand Assurance Section with Shield Badge & 3 Pillars */}
            <View style={styles.trustSection}>
              {/* Shield Badge Divider */}
              <View style={styles.shieldDividerRow}>
                <View style={styles.shieldDividerLine} />
                <View style={styles.shieldBadge}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#ea580c" />
                </View>
                <View style={styles.shieldDividerLine} />
              </View>

              <Text style={styles.trustHeadline}>Every journey starts with trust.</Text>

              {/* 3 Pillars with Vertical Dividers */}
              <View style={styles.pillarsRow}>
                <View style={styles.pillarItem}>
                  <View style={styles.pillarIconCircle}>
                    <Ionicons name="shield-checkmark-outline" size={19} color="#103A75" />
                  </View>
                  <Text style={styles.pillarText}>Safe rides</Text>
                </View>

                <View style={styles.pillarDivider} />

                <View style={styles.pillarItem}>
                  <View style={styles.pillarIconCircle}>
                    <MaterialCommunityIcons name="handshake-outline" size={22} color="#103A75" />
                  </View>
                  <Text style={styles.pillarText}>Reliable service</Text>
                </View>

                <View style={styles.pillarDivider} />

                <View style={styles.pillarItem}>
                  <View style={styles.pillarIconCircle}>
                    <Ionicons name="time-outline" size={20} color="#103A75" />
                  </View>
                  <Text style={styles.pillarText}>Easy bookings</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    width: 200,
    height: 70,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  heroContainer: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 8,
    marginTop: -20,
    justifyContent: 'space-between',
  },
  cardMain: {
    width: '100%',
  },
  loginSectionBox: {
    width: '100%',
    paddingHorizontal: 2,
  },
  cardHeader: {
    marginBottom: 22,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accentBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: '#ea580c',
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#103A75',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 18,
  },
  form: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 18,
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#103A75',
    marginLeft: 8,
  },
  prefixDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 12,
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#103A75',
    letterSpacing: 0.5,
  },
  primaryButton: {
    backgroundColor: '#ea580c',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  buttonArrow: {
    position: 'absolute',
    right: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },

  otpInputWrapper: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#ea580c',
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  otpInput: {
    fontSize: 24,
    fontWeight: '900',
    color: '#103A75',
    letterSpacing: 18,
    textAlign: 'center',
    width: '100%',
  },
  devHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  devHintText: {
    fontSize: 12,
    color: '#c2410c',
    marginLeft: 6,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 4,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  trustSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    paddingTop: 12,
    paddingBottom: 14,
  },
  shieldDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 6,
  },
  shieldDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  shieldBadge: {
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustHeadline: {
    fontSize: 15,
    fontWeight: '800',
    color: '#103A75',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 10,
  },
  pillarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingVertical: 2,
  },
  pillarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pillarText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  pillarDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e2e8f0',
  },
});
