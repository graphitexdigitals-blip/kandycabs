// Customer Login Screen - 2-Step Login (Mobile Number -> Verify OTP)
import React, { useState, useEffect, useRef } from 'react';
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
  ScrollView,
  StatusBar,
  Dimensions,
  useWindowDimensions,
  ImageBackground,
  Image,
  Keyboard,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { customerApiClient, customerTokenStorage } from '../lib/api';
import { flagNewUserRegistration, clearNewUserFlag, markNewUserLangPromptDone, changeAppLanguage, getPersistedLanguage, AppLanguage } from '../lib/i18n';
import { formatTitleCase } from '../constants/typography';

export default function CustomerLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const screenDimensions = Dimensions.get('screen');
  const fullScreenHeight = Math.max(screenDimensions.height, windowHeight);
  const fullScreenWidth = Math.max(screenDimensions.width, windowWidth);

  // Responsive device checks
  const isTablet = windowWidth >= 600;
  const isSmallDevice = windowHeight < 720;
  const isMediumDevice = windowHeight >= 720 && windowHeight < 840;

  // Responsive container width & paddings
  const containerWidth = Math.min(windowWidth - (isTablet ? 96 : 40), isTablet ? 420 : 360);
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : insets.top;
  const topPadding = Math.max(statusBarHeight + (isSmallDevice ? 36 : 60), insets.top + (isSmallDevice ? 36 : 60), 60);

  // Responsive sizes
  const inputHeight = isSmallDevice ? 48 : 52;
  const logoWidth = isTablet ? 200 : isSmallDevice ? 145 : 170;
  const logoHeight = Math.round(logoWidth * (598 / 1158));

  // Form State: 'LOGIN' (both Phone & OTP on single page) -> 'NAME' (new customer name completion)
  const [step, setStep] = useState<'LOGIN' | 'NAME'>('LOGIN');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [currentLang, setCurrentLang] = useState<AppLanguage>('en');

  // Load persisted language
  useEffect(() => {
    getPersistedLanguage().then((l) => {
      if (l) setCurrentLang(l);
    });
  }, []);

  const onSelectLang = async (lang: AppLanguage) => {
    setCurrentLang(lang);
    await changeAppLanguage(lang);
  };

  // Smooth animation progress: 0 = keyboard closed, 1 = keyboard open
  const keyboardProgress = useRef(new Animated.Value(0)).current;
  const otpInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

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

  // Coordinated keyboard animations: scales logo down and positions form cleanly below it
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onKeyboardShow = (e: any) => {
      Animated.timing(keyboardProgress, {
        toValue: 1,
        duration: Platform.OS === 'ios' ? e?.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    };

    const onKeyboardHide = (e: any) => {
      Animated.timing(keyboardProgress, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e?.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardProgress]);

  // Interpolations for Logo (scales down to compact size while remaining completely visible)
  const logoScale = keyboardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, isSmallDevice ? 0.68 : 0.74],
  });

  const logoTranslateY = keyboardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isSmallDevice ? -20 : -16],
  });

  const welcomeScale = keyboardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, isSmallDevice ? 0.76 : 0.82],
  });

  // Interpolations for Form Section: smoothly shifts up with ample breathing room from logo
  const formTranslateY = keyboardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isSmallDevice ? -24 : -20],
  });

  // STEP 1: Send OTP to Mobile Number
  const handleSendOtp = async (isManualResend = false) => {
    const cleanedPhone = phone.trim().replace(/\D/g, '');
    if (cleanedPhone.length !== 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      phoneInputRef.current?.focus();
      return;
    }

    setSendingOtp(true);
    try {
      const res = await customerApiClient.fetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phone: cleanedPhone, role: 'CUSTOMER' }),
      });

      if (res.success) {
        const receivedOtp = res.debugOtp || res.devOtp || '1234';
        setDevOtpHint(receivedOtp);
        setOtp(receivedOtp);
        setOtpSent(true);
        setResendTimer(30);
        setTimeout(() => otpInputRef.current?.focus(), 150);
        if (isManualResend) {
          Alert.alert('OTP Sent', `Verification code sent to +91 ${cleanedPhone}. Code: ${receivedOtp}`);
        }
      } else {
        Alert.alert('Unable to Send OTP', res.message || 'Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      // Offline / Demo fallback
      const fallbackOtp = '1234';
      setDevOtpHint(fallbackOtp);
      setOtp(fallbackOtp);
      setOtpSent(true);
      setResendTimer(30);
      setTimeout(() => otpInputRef.current?.focus(), 150);
      if (isManualResend) {
        Alert.alert(
          'OTP Sent (Demo Mode)',
          `Verification code 1234 has been sent for +91 ${cleanedPhone}.`,
          [{ text: 'OK' }]
        );
      }
    } finally {
      setSendingOtp(false);
    }
  };

  // STEP 2: Verify OTP and navigate to Home or Profile
  const handleVerifyOtp = async () => {
    const cleanedPhone = phone.trim().replace(/\D/g, '');
    if (cleanedPhone.length !== 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      setStep('LOGIN');
      phoneInputRef.current?.focus();
      return;
    }

    if (otp.trim().length !== 4) {
      Alert.alert('Invalid OTP', 'Please enter the 4-digit verification code.');
      otpInputRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
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

        const isNew = Boolean(res.isNewUser);
        setIsNewUser(isNew);

        const hasName = Boolean(
          res.hasRegisteredName ||
          (res.user?.fullName && res.user.fullName !== 'Kandy Customer' && res.user.fullName.trim().length > 0)
        );

        if (hasName) {
          if (isNew) {
            await flagNewUserRegistration(res.user?.id);
          } else {
            // Returning existing user with existing profile: never show language prompt
            await clearNewUserFlag(res.user?.id);
            await markNewUserLangPromptDone(res.user?.id);
          }
          router.replace('/');
        } else {
          setStep('NAME');
        }
      } else {
        Alert.alert('Verification Failed', res.message || 'Incorrect OTP code. Please try again.');
      }
    } catch (err: any) {
      if (otp.trim() === '1234' || otp.trim() === devOtpHint) {
        const localUser = {
          id: 'demo-' + cleanedPhone,
          phone: cleanedPhone,
          fullName: 'Kandy Customer',
          role: 'CUSTOMER',
        };
        customerTokenStorage.setToken('demo-token-' + cleanedPhone);
        customerTokenStorage.setUser(localUser);
        setIsNewUser(true);
        setStep('NAME');
        return;
      }
      Alert.alert('Verification Error', err.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Unified LOGIN CTA: Sends OTP if needed, or verifies OTP if entered
  const handleLogin = async () => {
    const cleanedPhone = phone.trim().replace(/\D/g, '');
    if (cleanedPhone.length !== 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit mobile number.');
      phoneInputRef.current?.focus();
      return;
    }

    if (!otp.trim() || otp.trim().length !== 4) {
      if (!otpSent) {
        await handleSendOtp(false);
      } else {
        Alert.alert('Enter OTP', 'Please enter the 4-digit verification code.');
        otpInputRef.current?.focus();
      }
      return;
    }

    await handleVerifyOtp();
  };

  // STEP 3 for new users: Complete Profile Name & Language
  const handleSaveName = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name to complete registration.');
      return;
    }

    setLoading(true);
    const cleanedPhone = phone.trim().replace(/\D/g, '');
    const titleCaseName = formatTitleCase(name);
    try {
      // 1. Persist chosen language
      await changeAppLanguage(currentLang);

      // 2. Persist name on backend
      const res = await customerApiClient.fetch('/api/auth/update-profile', {
        method: 'POST',
        body: JSON.stringify({ fullName: titleCaseName }),
      });
      const updatedUser = res?.user || { ...customerTokenStorage.getUser(), fullName: titleCaseName };
      customerTokenStorage.setUser(updatedUser);

      // 3. Mark setup complete
      await markNewUserLangPromptDone(updatedUser?.id);
      await clearNewUserFlag(updatedUser?.id);
      router.replace('/');
    } catch (err: any) {
      console.warn('Update profile fallback:', err);
      await changeAppLanguage(currentLang);
      const existing = customerTokenStorage.getUser() || { phone: cleanedPhone };
      const updatedUser = { ...existing, fullName: titleCaseName };
      customerTokenStorage.setUser(updatedUser);

      await markNewUserLangPromptDone(updatedUser?.id);
      await clearNewUserFlag(updatedUser?.id);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(statusBarHeight + (isSmallDevice ? 54 : 84), insets.top + (isSmallDevice ? 54 : 84), 86),
              paddingBottom: Math.max(insets.bottom, 16),
              minHeight: fullScreenHeight,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Top Section: Branding Logo & Form (slightly down from top) */}
          <View
            style={{
              width: '100%',
              alignItems: 'center',
              justifyContent: 'flex-start',
            }}
          >
            {/* 
              ================================================================
              1. SEPARATE RESPONSIVE LOGO SECTION
              ================================================================
              - Normal state: prominent and large.
              - Typing state: smoothly scales down so it remains visible without
                colliding with or being covered by the inputs!
            */}
            <Animated.View
              style={[
                styles.brandingContainer,
                {
                  transform: [
                    { translateY: logoTranslateY },
                    { scale: logoScale },
                  ],
                },
              ]}
            >
              <Animated.Text
                style={[
                  styles.welcomeText,
                  {
                    fontSize: isSmallDevice ? 12 : 13.5,
                    transform: [{ scale: welcomeScale }],
                  },
                ]}
              >
                WELCOME TO
              </Animated.Text>
              <Image
                source={require('../assets/images/logo-with-tagline.png')}
                style={[
                  styles.logoImage,
                  {
                    width: logoWidth,
                    height: logoHeight,
                  },
                ]}
                resizeMode="contain"
              />
            </Animated.View>

            {/* 
              ================================================================
              2. FLOATING FORM SECTION (Mobile Number & OTP arranged in 1 page)
              ================================================================
            */}
            <Animated.View
              style={[
                styles.formSection,
                {
                  width: containerWidth,
                  transform: [{ translateY: formTranslateY }],
                },
              ]}
            >
              {/* PRIMARY STEP: MOBILE NUMBER & OTP IN ONE PAGE + LOGIN BUTTON */}
              {step === 'LOGIN' && (
                <>
                  {/* Field 1: Mobile Number */}
                  <View style={[styles.inputContainer, { height: inputHeight }]}>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={isSmallDevice ? 19 : 20}
                      color="#64748b"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={phoneInputRef}
                      style={[styles.textInput, { fontSize: isSmallDevice ? 15 : 16 }]}
                      placeholder="Mobile Number"
                      placeholderTextColor="#94a3b8"
                      value={phone}
                      onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      showSoftInputOnFocus={true}
                      maxLength={10}
                      editable={!loading && !sendingOtp}
                      returnKeyType="next"
                      onSubmitEditing={() => {
                        if (!otpSent) {
                          handleSendOtp(false);
                        } else {
                          otpInputRef.current?.focus();
                        }
                      }}
                      autoFocus={false}
                    />

                    {/* Inline Get OTP / Countdown / Resend Pill */}
                    {otpSent ? (
                      resendTimer > 0 ? (
                        <View style={styles.timerBadge}>
                          <Text style={styles.timerBadgeText}>Resend {resendTimer}s</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleSendOtp(true)}
                          activeOpacity={0.7}
                          disabled={sendingOtp}
                          style={styles.inlineResendBtn}
                        >
                          <Text style={styles.inlineResendText}>Resend</Text>
                        </TouchableOpacity>
                      )
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleSendOtp(false)}
                        activeOpacity={0.7}
                        disabled={phone.trim().length !== 10 || sendingOtp}
                        style={[
                          styles.getOtpPill,
                          phone.trim().length !== 10 && styles.getOtpPillDisabled,
                        ]}
                      >
                        {sendingOtp ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.getOtpPillText}>Get OTP</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Field 2: OTP */}
                  <View style={[styles.inputContainer, { height: inputHeight }]}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={isSmallDevice ? 19 : 20}
                      color="#64748b"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={otpInputRef}
                      style={[styles.textInput, { fontSize: isSmallDevice ? 15 : 16 }]}
                      placeholder="Enter OTP"
                      placeholderTextColor="#94a3b8"
                      value={otp}
                      onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      showSoftInputOnFocus={true}
                      maxLength={4}
                      editable={!loading}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                    />

                    {/* Auto-fill demo badge if present */}
                    {devOtpHint ? (
                      <TouchableOpacity
                        onPress={() => setOtp(devOtpHint)}
                        activeOpacity={0.7}
                        style={styles.otpActionBadge}
                      >
                        <Text style={styles.otpActionBadgeText}>{devOtpHint}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* Primary Orange LOGIN Button */}
                  <TouchableOpacity
                    style={[
                      styles.loginButton,
                      { height: inputHeight },
                      (loading || sendingOtp) && styles.buttonDisabled,
                    ]}
                    onPress={handleLogin}
                    disabled={loading || sendingOtp}
                    activeOpacity={0.88}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={[styles.loginButtonText, { fontSize: isSmallDevice ? 15 : 16 }]}>
                        LOGIN
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* STEP 2: NAME COMPLETION (for new customer after verifying OTP) */}
              {step === 'NAME' && (
                <>
                  <View style={[styles.inputContainer, { height: inputHeight }]}>
                    <Ionicons
                      name="person-outline"
                      size={isSmallDevice ? 19 : 20}
                      color="#64748b"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.textInput, { fontSize: isSmallDevice ? 14.5 : 15 }]}
                      placeholder="Enter your full name"
                      placeholderTextColor="#94a3b8"
                      value={name}
                      onChangeText={setName}
                      editable={!loading}
                      autoFocus={true}
                      returnKeyType="done"
                      onSubmitEditing={handleSaveName}
                    />
                  </View>

                  {/* STEP 2B: Language Selection for Registration */}
                  <View style={{ marginTop: 14, marginBottom: 16 }}>
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: '700',
                        color: '#475569',
                        marginBottom: 8,
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Choose App Language / ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                      {[
                        { code: 'en' as const, label: 'English', sub: 'EN' },
                        { code: 'kn' as const, label: 'ಕನ್ನಡ', sub: 'KN' },
                        { code: 'hi' as const, label: 'हिन्दी', sub: 'HI' },
                      ].map((lang) => {
                        const isSelected = currentLang === lang.code;
                        return (
                          <TouchableOpacity
                            key={lang.code}
                            activeOpacity={0.8}
                            onPress={() => onSelectLang(lang.code)}
                            style={{
                              flex: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 6,
                              borderRadius: 12,
                              borderWidth: 1.5,
                              borderColor: isSelected ? '#ea580c' : '#e2e8f0',
                              backgroundColor: isSelected ? '#fff7ed' : '#ffffff',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13.5,
                                fontWeight: isSelected ? '800' : '600',
                                color: isSelected ? '#ea580c' : '#334155',
                              }}
                            >
                              {lang.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.loginButton,
                      { height: inputHeight },
                      loading && styles.buttonDisabled,
                    ]}
                    onPress={handleSaveName}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={[styles.loginButtonText, { fontSize: isSmallDevice ? 15 : 16 }]}>
                        GET STARTED
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.signUpRow}
                    activeOpacity={0.75}
                    onPress={() => {
                      setStep('LOGIN');
                      setOtp('');
                    }}
                  >
                    <Text style={styles.signUpTextPrompt}>
                      <Text style={styles.signUpTextLink}>← Change Mobile Number</Text>
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </View>

          {/* Bottom Section: English | ಕನ್ನಡ | हिन्दी */}
          <View style={[styles.bottomLangContainer, { paddingBottom: Math.max(insets.bottom + 40, 52) }]}>
            <View style={styles.langSelectorRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onSelectLang('en')}
                style={styles.langTouchArea}
              >
                <Text
                  style={[
                    styles.langItemText,
                    currentLang === 'en' && styles.langItemTextActive,
                    { fontSize: isSmallDevice ? 14 : 15 },
                  ]}
                >
                  English
                </Text>
              </TouchableOpacity>

              <Text style={styles.langDivider}>|</Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onSelectLang('kn')}
                style={styles.langTouchArea}
              >
                <Text
                  style={[
                    styles.langItemText,
                    currentLang === 'kn' && styles.langItemTextActive,
                    { fontSize: isSmallDevice ? 14 : 15 },
                  ]}
                >
                  ಕನ್ನಡ
                </Text>
              </TouchableOpacity>

              <Text style={styles.langDivider}>|</Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onSelectLang('hi')}
                style={styles.langTouchArea}
              >
                <Text
                  style={[
                    styles.langItemText,
                    currentLang === 'hi' && styles.langItemTextActive,
                    { fontSize: isSmallDevice ? 14 : 15 },
                  ]}
                >
                  हिन्दी
                </Text>
              </TouchableOpacity>
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
    backgroundColor: '#ffffff',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
  },

  /* 
   * ==============================================================
   * LOGO & BRANDING STYLES
   * ==============================================================
   */
  brandingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    marginTop: 4,
    marginBottom: 16,
  },
  welcomeText: {
    fontWeight: '800',
    fontSize: 13,
    color: '#0f2942',
    letterSpacing: 2.2,
    marginBottom: 8,
    textAlign: 'center',
    alignSelf: 'center',
    textTransform: 'uppercase',
  },
  logoImage: {
    alignSelf: 'center',
  },

  /* 
   * ==============================================================
   * FLOATING INPUTS & BUTTON STYLES
   * ==============================================================
   */
  formSection: {
    alignSelf: 'center',
    width: '100%',
    marginTop: 38,
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    height: '100%',
    color: '#00142b',
    fontWeight: '600',
    paddingVertical: 0,
    letterSpacing: 0.5,
  },
  otpActionBadge: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  otpActionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ea580c',
  },
  getOtpPill: {
    backgroundColor: '#f05a22',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  getOtpPillDisabled: {
    backgroundColor: '#cbd5e1',
  },
  getOtpPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  timerBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  timerBadgeText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineResendBtn: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inlineResendText: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '700',
  },
  resendBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resendText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ea580c',
  },
  loginButton: {
    backgroundColor: '#f05a22', // Official Kandy Cabs bright orange
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 14,
    shadowColor: '#f05a22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  bottomLangContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  langSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  langTouchArea: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  langItemText: {
    color: '#475569',
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  langItemTextActive: {
    color: '#f05a22',
    fontWeight: '800',
  },
  langDivider: {
    color: '#94a3b8',
    fontSize: 14,
    marginHorizontal: 4,
  },
  signUpRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginTop: 4,
  },
  signUpTextPrompt: {
    fontWeight: '600',
    color: '#00142b',
    textShadowColor: 'rgba(255, 255, 255, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  signUpTextLink: {
    color: '#f05a22',
    fontWeight: '800',
  },
  bottomFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 8,
    gap: 12,
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  footerTagline: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
