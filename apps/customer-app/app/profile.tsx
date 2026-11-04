import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  Linking,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system';
import { customerApiClient, customerTokenStorage, formatDisplayPhone } from '../lib/api';
import { CustomerBottomDock } from '../components/CustomerBottomDock';
import { AuthModal } from '../components/AuthModal';
import { CircularImageCropperModal } from '../components/CircularImageCropperModal';
import { LanguageSelectionModal } from '../components/LanguageSelectionModal';
import { formatTitleCase } from '../constants/typography';

let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  // Not bundled in native APK
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const [user, setUser] = useState<any | null>(customerTokenStorage.getUser());
  const [loading, setLoading] = useState(!customerTokenStorage.getUser());
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);

  const getCurrentLanguageName = () => {
    if (i18n.language?.startsWith('kn')) return 'ಕನ್ನಡ (Kannada)';
    if (i18n.language?.startsWith('hi')) return 'हिन्दी (Hindi)';
    return 'English';
  };

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  // Circular Profile Picture Cropper State
  const [selectedRawImage, setSelectedRawImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const loadProfile = useCallback(async (showLoading = false) => {
    const cachedUser = customerTokenStorage.getUser();
    if (cachedUser) {
      setUser(cachedUser);
      setFullName(cachedUser.fullName || '');
      setEmail(cachedUser.email || '');
      setLoading(false);
    } else if (showLoading) {
      setLoading(true);
    }

    try {
      const token = customerTokenStorage.getToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 4-second timeout to prevent UI hanging on slow networks
      const fetchPromise = customerApiClient.fetch('/api/auth/me');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 4000)
      );

      const res: any = await Promise.race([fetchPromise, timeoutPromise]);
      if (res?.user) {
        const localUser = customerTokenStorage.getUser();
        const mergedUser = {
          ...res.user,
          profilePhoto: res.user.profilePhoto || localUser?.profilePhoto,
        };
        setUser(mergedUser);
        customerTokenStorage.setUser(mergedUser);
        setFullName(mergedUser.fullName || '');
        setEmail(mergedUser.email || '');
      }
    } catch (err: any) {
      if (err?.status === 401) {
        customerTokenStorage.removeToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    const unsub = customerTokenStorage.subscribe(() => {
      const u = customerTokenStorage.getUser();
      setUser(u);
      if (u) {
        setLoading(false);
        setFullName(u.fullName || '');
        setEmail(u.email || '');
      }
    });
    return () => unsub();
  }, [loadProfile]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfile(false);
  };

  const handlePickImage = async () => {
    if (!ImagePicker || !ImagePicker.requestMediaLibraryPermissionsAsync) {
      Alert.alert(
        'Photo Upload Unavailable',
        'Profile photo selection is not enabled in this build.'
      );
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo Permission Required',
          'Please grant access to your photo library to select a profile picture.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Adjusted in custom circular cropper modal
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedRawImage(result.assets[0].uri);
        setIsCropperOpen(true);
      }
    } catch (err: any) {
      console.warn('Image picker error:', err);
      Alert.alert('Error', 'Unable to open photo library. Please try again.');
    }
  };

  const handleSaveCroppedPhoto = async (croppedUri: string, base64?: string) => {
    setUploadingPhoto(true);

    let savedUri = croppedUri;
    try {
      // 1. Copy cropped photo to permanent app storage to avoid SecureStore 2KB size limit
      const permanentPath = `${FileSystem.documentDirectory}user_avatar_${Date.now()}.jpg`;
      await FileSystem.copyAsync({
        from: croppedUri,
        to: permanentPath,
      });
      savedUri = permanentPath;
    } catch (fileErr) {
      console.warn('File system copy error, using croppedUri directly:', fileErr);
    }

    // 2. Immediately update state and storage with file path (tiny string, fits in SecureStore)
    const updated = { ...user, profilePhoto: savedUri };
    setUser(updated);
    customerTokenStorage.setUser(updated);

    // 3. Sync to backend (with base64 payload if available)
    try {
      const photoPayload = base64 ? `data:image/jpeg;base64,${base64}` : savedUri;
      const res = await customerApiClient.fetch('/api/auth/update-profile', {
        method: 'POST',
        body: JSON.stringify({
          fullName: user?.fullName || fullName,
          email: user?.email || email,
          profilePhoto: photoPayload,
        }),
      });

      if (res?.user) {
        const merged = { ...res.user, profilePhoto: savedUri };
        setUser(merged);
        customerTokenStorage.setUser(merged);
      }
    } catch (err: any) {
      console.warn('Backend profilePhoto sync notice (deferred):', err?.message || err);
    } finally {
      setUploadingPhoto(false);
      Alert.alert('Profile Picture Saved', 'Your circular profile picture has been saved successfully!');
    }
  };

  const handleRemovePhoto = () => {
    Alert.alert(
      'Remove Profile Photo',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = { ...user, profilePhoto: null };
            setUser(updated);
            customerTokenStorage.setUser(updated);
            try {
              await customerApiClient.fetch('/api/auth/update-profile', {
                method: 'POST',
                body: JSON.stringify({
                  fullName: user?.fullName || fullName,
                  email: user?.email || email,
                  profilePhoto: null,
                }),
              });
            } catch {}
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Please enter your full name');
      return;
    }

    setSaving(true);
    try {
      const res = await customerApiClient.fetch('/api/auth/update-profile', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim() || undefined,
          profilePhoto: user?.profilePhoto || undefined,
        }),
      });

      if (res?.success && res.user) {
        setUser(res.user);
        customerTokenStorage.setUser(res.user);
        setIsEditing(false);
        Alert.alert('Profile Updated', 'Your profile details have been successfully saved.');
      } else {
        const updated = { ...user, fullName: fullName.trim(), email: email.trim() };
        setUser(updated);
        customerTokenStorage.setUser(updated);
        setIsEditing(false);
        Alert.alert('Profile Updated', 'Your profile name has been updated.');
      }
    } catch {
      const updated = { ...user, fullName: fullName.trim(), email: email.trim() };
      setUser(updated);
      customerTokenStorage.setUser(updated);
      setIsEditing(false);
      Alert.alert('Profile Updated', 'Your profile name has been updated.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      t('profile.signOutConfirmTitle'),
      t('profile.signOutConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.signOut'),
          style: 'destructive',
          onPress: () => {
            customerTokenStorage.removeToken();
            setUser(null);
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:+919900887777');
  };

  const handleWhatsApp = () => {
    Linking.openURL('https://wa.me/919008890090?text=Hello%20Kandy%20Cabs%2C%20I%20need%20assistance%20with%20my%20account.');
  };

  const handleAppSupportCall = () => {
    Linking.openURL('tel:+919187336058');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.myProfile')}</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
          isSmallDevice && { paddingHorizontal: 10 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['rgb(240, 117, 15)']} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="rgb(240, 117, 15)" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : user ? (
          <>
            {/* User Profile Hero Card */}
            <View style={styles.heroCard}>
              <TouchableOpacity
                style={styles.avatarTouchable}
                onPress={handlePickImage}
                activeOpacity={0.8}
              >
                <View style={styles.avatar}>
                  {user.profilePhoto ? (
                    <Image
                      source={{ uri: user.profilePhoto }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.avatarText}>
                      {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                    </Text>
                  )}
                  {uploadingPhoto && (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator size="small" color="#ffffff" />
                    </View>
                  )}
                </View>
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={12} color="#ffffff" />
                </View>
              </TouchableOpacity>

              <View style={styles.heroDetails}>
                <Text style={styles.heroName} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.8}>
                  {formatTitleCase(user.fullName) || t('profile.valuedCustomer')}
                </Text>
                <Text style={styles.heroPhone} numberOfLines={1} adjustsFontSizeToFit={true}>{formatDisplayPhone(user.phone)}</Text>
              </View>

              {!isEditing && (
                <TouchableOpacity
                  style={styles.editPill}
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pencil" size={11} color="rgb(22, 34, 50)" />
                  <Text style={styles.editPillText}>{t('common.edit')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Account Details Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('profile.accountDetails')}</Text>
                {isEditing && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setIsEditing(false);
                      setFullName(user.fullName || '');
                      setEmail(user.email || '');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isEditing ? (
                <View style={styles.editForm}>
                  {/* Profile Picture Option in Edit Mode */}
                  <View style={styles.editPhotoSection}>
                    <Text style={styles.inputLabel}>{t('profile.profilePhoto')}</Text>
                    <View style={styles.photoActionRow}>
                      <TouchableOpacity
                        style={styles.changePhotoBtn}
                        onPress={handlePickImage}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="camera" size={15} color="rgb(22, 34, 50)" />
                        <Text style={styles.changePhotoBtnText}>
                          {user.profilePhoto ? t('profile.changePhoto') : t('profile.uploadPhoto')}
                        </Text>
                      </TouchableOpacity>

                      {user.profilePhoto && (
                        <TouchableOpacity
                          style={styles.removePhotoBtn}
                          onPress={handleRemovePhoto}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={14} color="#dc2626" />
                          <Text style={styles.removePhotoBtnText}>{t('common.remove')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 10 }]}>{t('profile.fullName')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder={t('auth.fullNamePlaceholder')}
                    placeholderTextColor="#94a3b8"
                  />

                  <Text style={[styles.inputLabel, { marginTop: 10 }]}>EMAIL ADDRESS (FOR GST INVOICES)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="your.email@example.com"
                    placeholderTextColor="#94a3b8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={[styles.saveButton, saving && { opacity: 0.7 }]}
                    onPress={handleSaveProfile}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.saveButtonText}>{t('common.saveChanges')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.detailsList}>
                  {/* Full Name Row */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconBox}>
                      <Ionicons name="person-outline" size={21} color="rgb(240, 117, 15)" />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>{t('profile.fullName')}</Text>
                      <Text style={styles.detailValue}>{formatTitleCase(user.fullName) || t('profile.notProvided')}</Text>
                    </View>
                  </View>

                  <View style={styles.detailDivider} />

                  {/* Mobile Row */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconBox}>
                      <Ionicons name="call-outline" size={21} color="rgb(240, 117, 15)" />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>{t('profile.registeredMobile')}</Text>
                      <Text style={styles.detailValue}>{formatDisplayPhone(user.phone)}</Text>
                    </View>
                  </View>

                  <View style={styles.detailDivider} />

                  {/* Email Row */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconBox}>
                      <Ionicons name="mail-outline" size={21} color="rgb(240, 117, 15)" />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>{t('profile.emailAddress')}</Text>
                      <Text style={styles.detailValue}>{user.email || t('profile.emailPlaceholder')}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Quick Actions Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('profile.quickActions')}</Text>

              {/* My Bookings */}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => router.push('/my-bookings')}
                activeOpacity={0.7}
              >
                <View style={styles.actionItemLeft}>
                  <View style={styles.actionIconBox}>
                    <Ionicons name="receipt-outline" size={21} color="rgb(240, 117, 15)" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>{t('profile.myBookings')}</Text>
                    <Text style={styles.actionItemSubtitle}>{t('profile.myBookingsSub')}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>

              <View style={styles.actionDivider} />

              {/* Book Cab */}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => router.push('/select-trip-type')}
                activeOpacity={0.7}
              >
                <View style={styles.actionItemLeft}>
                  <View style={styles.actionIconBox}>
                    <Ionicons name="car-sport-outline" size={21} color="rgb(240, 117, 15)" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>{t('profile.bookNewCab')}</Text>
                    <Text style={styles.actionItemSubtitle}>{t('profile.bookNewCabSub')}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>

              <View style={styles.actionDivider} />

              {/* App Language */}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => setIsLangModalOpen(true)}
                activeOpacity={0.7}
              >
                <View style={styles.actionItemLeft}>
                  <View style={styles.actionIconBox}>
                    <Ionicons name="globe-outline" size={21} color="rgb(240, 117, 15)" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>{t('profile.appLanguage')}</Text>
                    <Text style={styles.actionItemSubtitle}>{getCurrentLanguageName()}</Text>
                  </View>
                </View>
                <View style={styles.langBadge}>
                  <Text style={styles.langBadgeText}>
                    {i18n.language?.startsWith('kn') ? 'ಕನ್ನಡ' : i18n.language?.startsWith('hi') ? 'हिन्दी' : 'English'}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color="rgb(240, 117, 15)" />
                </View>
              </TouchableOpacity>

              <View style={styles.actionDivider} />

              {/* Terms & Conditions */}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => router.push('/terms')}
                activeOpacity={0.7}
              >
                <View style={styles.actionItemLeft}>
                  <View style={styles.actionIconBox}>
                    <Ionicons name="document-text-outline" size={21} color="rgb(240, 117, 15)" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>{t('profile.terms')}</Text>
                    <Text style={styles.supportNumberText}>{t('profile.termsSub')}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            {/* Support & Helpline Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('profile.support')}</Text>
                <TouchableOpacity
                  onPress={() => router.push('/support')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewSupportLink}>{t('profile.viewDesk')}</Text>
                </TouchableOpacity>
              </View>

              {/* Helpline Call */}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleCallSupport}
                activeOpacity={0.7}
              >
                <View style={styles.actionItemLeft}>
                  <View style={styles.actionIconBox}>
                    <Ionicons name="call-outline" size={21} color="rgb(240, 117, 15)" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>{t('profile.callSupport')}</Text>
                    <Text style={styles.supportNumberText}>+91 99008 87777 ({t('profile.tollFree', { defaultValue: 'Toll Free' })})</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>

              <View style={styles.actionDivider} />

              {/* WhatsApp Chat */}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleWhatsApp}
                activeOpacity={0.7}
              >
                <View style={styles.actionItemLeft}>
                  <View style={styles.actionIconBox}>
                    <Ionicons name="logo-whatsapp" size={21} color="rgb(240, 117, 15)" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>{t('profile.whatsappSupport')}</Text>
                    <Text style={styles.supportNumberText}>+91 90088 90090 ({t('profile.instantChat', { defaultValue: 'Instant Chat' })})</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>

              <View style={styles.actionDivider} />

              {/* App Support Call */}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={handleAppSupportCall}
                activeOpacity={0.7}
              >
                <View style={styles.actionItemLeft}>
                  <View style={styles.actionIconBox}>
                    <Ionicons name="phone-portrait-outline" size={21} color="rgb(240, 117, 15)" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>{t('profile.appSupportHelpline', { defaultValue: 'App Support Helpline' })}</Text>
                    <Text style={styles.supportNumberText}>+91 91873 36058 ({t('profile.technicalHelp', { defaultValue: 'Technical Help' })})</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={18} color="#dc2626" />
              <Text style={styles.signOutButtonText} numberOfLines={1} adjustsFontSizeToFit={true}>{t('profile.signOut')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Guest State */
          <View style={styles.guestContainer}>
            <View style={styles.guestAvatar}>
              <Ionicons name="person" size={36} color="#94a3b8" />
            </View>
            <Text style={styles.guestTitle}>{t('profile.notSignedIn')}</Text>
            <Text style={styles.guestSubtitle}>
              {t('profile.notSignedInSub')}
            </Text>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => setIsAuthModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="log-in-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.signInButtonText} numberOfLines={1} adjustsFontSizeToFit={true}>{t('profile.signInRegister')}</Text>
            </TouchableOpacity>

            {/* Guest Language Selector Button */}
            <TouchableOpacity
              style={styles.guestLangButton}
              onPress={() => setIsLangModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="globe-outline" size={17} color="rgb(22, 34, 50)" />
              <Text style={styles.guestLangButtonText}>
                {t('profile.appLanguage')}: <Text style={{ color: 'rgb(240, 117, 15)', fontWeight: '800' }}>{getCurrentLanguageName()}</Text>
              </Text>
              <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Persistent Bottom Dock */}
      <CustomerBottomDock
        activeTab="PROFILE"
        onPressProfile={() => {
          if (!user) setIsAuthModalOpen(true);
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        visible={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          setIsAuthModalOpen(false);
          loadProfile(false);
        }}
      />

      {/* Circular Image Cropper Modal */}
      <CircularImageCropperModal
        visible={isCropperOpen}
        imageUri={selectedRawImage}
        onClose={() => {
          setIsCropperOpen(false);
          setSelectedRawImage(null);
        }}
        onSave={handleSaveCroppedPhoto}
        onChangeImage={handlePickImage}
      />

      {/* Language Selection Modal */}
      <LanguageSelectionModal
        visible={isLangModalOpen}
        onClose={() => setIsLangModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.3,
  },
  headerRightPlaceholder: {
    width: 36,
  },

  scrollContent: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 95,
    gap: 12,
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },

  // User Hero Card
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 0.8,
      },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
    }),
  },
  avatarTouchable: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgb(240, 117, 15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgb(22, 34, 50)',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  heroDetails: {
    flex: 1,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroName: {
    fontSize: 18.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.2,
  },
  heroPhone: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 4,
  },
  verifiedText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#15803d',
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  editPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },

  // Section Card
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 0.8,
      },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.5,
  },
  viewSupportLink: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
  },
  cancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },

  // Edit Form
  editForm: {
    marginTop: 2,
  },
  editPhotoSection: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  photoActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  changePhotoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  removePhotoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 5,
    letterSpacing: 0.4,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14.5,
    color: 'rgb(22, 34, 50)',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
  },

  // Details List
  detailsList: {
    marginTop: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  detailIconBox: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  detailValue: {
    fontSize: 14.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    marginTop: 2,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 3,
    marginLeft: 38,
  },

  // Action Items
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8.5,
  },
  actionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIconBox: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextCol: {
    flex: 1,
  },
  actionItemTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  actionItemSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  supportNumberText: {
    fontSize: 13.5,
    color: 'rgb(22, 34, 50)',
    marginTop: 2,
    fontWeight: '700',
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 3,
    marginLeft: 38,
  },

  // Sign Out Button
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fee2e2',
    borderRadius: 14,
    paddingVertical: 13,
    gap: 7,
    marginTop: 4,
  },
  signOutButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#dc2626',
  },

  // Guest State
  guestContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 14,
  },
  guestAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  guestTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    marginBottom: 6,
  },
  guestSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(22, 34, 50)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 11,
    width: '100%',
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  langBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgb(240, 117, 15)',
  },
  guestLangButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    marginTop: 12,
  },
  guestLangButtonText: {
    fontSize: 13,
    color: 'rgb(22, 34, 50)',
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
  },
});
