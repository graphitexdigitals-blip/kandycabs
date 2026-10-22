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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { customerApiClient, customerTokenStorage, formatDisplayPhone } from '../lib/api';
import { CustomerBottomDock } from '../components/CustomerBottomDock';
import { AuthModal } from '../components/AuthModal';
import { CircularImageCropperModal } from '../components/CircularImageCropperModal';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  const [user, setUser] = useState<any | null>(customerTokenStorage.getUser());
  const [loading, setLoading] = useState(!customerTokenStorage.getUser());
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            customerTokenStorage.removeToken();
            setUser(null);
            Alert.alert('Signed Out', 'You have been signed out.');
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
    <SafeAreaView style={[styles.safeArea, { paddingTop: topInset }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#ea580c']} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#ea580c" />
            <Text style={styles.loadingText}>Loading profile details...</Text>
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
                <View style={styles.heroNameRow}>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {user.fullName || 'Valued Customer'}
                  </Text>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                </View>
                <Text style={styles.heroPhone}>{formatDisplayPhone(user.phone)}</Text>
              </View>

              {!isEditing && (
                <TouchableOpacity
                  style={styles.editPill}
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pencil" size={11} color="#103A75" />
                  <Text style={styles.editPillText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Account Details Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>ACCOUNT DETAILS</Text>
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
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isEditing ? (
                <View style={styles.editForm}>
                  {/* Profile Picture Option in Edit Mode */}
                  <View style={styles.editPhotoSection}>
                    <Text style={styles.inputLabel}>PROFILE PICTURE</Text>
                    <View style={styles.photoActionRow}>
                      <TouchableOpacity
                        style={styles.changePhotoBtn}
                        onPress={handlePickImage}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="camera" size={15} color="#103A75" />
                        <Text style={styles.changePhotoBtnText}>
                          {user.profilePhoto ? 'Change Photo' : 'Upload Photo'}
                        </Text>
                      </TouchableOpacity>

                      {user.profilePhoto && (
                        <TouchableOpacity
                          style={styles.removePhotoBtn}
                          onPress={handleRemovePhoto}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={14} color="#dc2626" />
                          <Text style={styles.removePhotoBtnText}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 10 }]}>FULL NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Your Full Name"
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
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.detailsList}>
                  {/* Full Name Row */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconBox}>
                      <Ionicons name="person-outline" size={17} color="#ee5c21" />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Full Name</Text>
                      <Text style={styles.detailValue}>{user.fullName || 'Not provided'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailDivider} />

                  {/* Mobile Row */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconBox}>
                      <Ionicons name="call-outline" size={17} color="#ee5c21" />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Registered Mobile</Text>
                      <Text style={styles.detailValue}>{formatDisplayPhone(user.phone)}</Text>
                    </View>
                  </View>

                  <View style={styles.detailDivider} />

                  {/* Email Row */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconBox}>
                      <Ionicons name="mail-outline" size={17} color="#ee5c21" />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>Email Address</Text>
                      <Text style={styles.detailValue}>{user.email || 'None added (used for tax receipts)'}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Quick Actions Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>

              {/* My Bookings */}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => router.push('/my-bookings')}
                activeOpacity={0.7}
              >
                <View style={styles.actionItemLeft}>
                  <View style={styles.actionIconBox}>
                    <Ionicons name="receipt-outline" size={17} color="#ee5c21" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>My Bookings & Invoices</Text>
                    <Text style={styles.actionItemSubtitle}>View active rides, driver tracking & history</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
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
                    <Ionicons name="car-sport-outline" size={17} color="#ee5c21" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>Book a New Cab</Text>
                    <Text style={styles.actionItemSubtitle}>One-way, round trip, airport & rentals</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            {/* Support & Helpline Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>24/7 SUPPORT & ASSISTANCE</Text>
                <TouchableOpacity
                  onPress={() => router.push('/support')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewSupportLink}>View Desk ›</Text>
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
                    <Ionicons name="call-outline" size={17} color="#ee5c21" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>24/7 Customer Helpline</Text>
                    <Text style={styles.supportNumberText}>+91 99008 87777 (Toll Free)</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
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
                    <Ionicons name="logo-whatsapp" size={17} color="#ee5c21" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>WhatsApp Support Desk</Text>
                    <Text style={styles.supportNumberText}>+91 90088 90090 (Instant Chat)</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
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
                    <Ionicons name="phone-portrait-outline" size={17} color="#ee5c21" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionItemTitle}>App Support Helpline</Text>
                    <Text style={styles.supportNumberText}>+91 91873 36058 (Technical Help)</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
              </TouchableOpacity>
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={16} color="#dc2626" />
              <Text style={styles.signOutButtonText}>Sign Out from Device</Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Guest State */
          <View style={styles.guestContainer}>
            <View style={styles.guestAvatar}>
              <Ionicons name="person" size={36} color="#94a3b8" />
            </View>
            <Text style={styles.guestTitle}>You are not signed in</Text>
            <Text style={styles.guestSubtitle}>
              Sign in with your mobile number to view your bookings, trip receipts, and live driver tracking.
            </Text>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => setIsAuthModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="log-in-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.signInButtonText}>Sign In / Register</Text>
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
    fontSize: 17,
    fontWeight: '800',
    color: '#103A75',
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
    fontSize: 13,
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
    borderWidth: 1,
    borderColor: '#f1f5f9',
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
    backgroundColor: '#ee5c21',
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
    backgroundColor: '#103A75',
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
    fontSize: 16,
    fontWeight: '800',
    color: '#103A75',
    letterSpacing: -0.2,
    maxWidth: 160,
  },
  heroPhone: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    gap: 3,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  editPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#103A75',
  },

  // Section Card
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
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
    fontSize: 11,
    fontWeight: '800',
    color: '#103A75',
    letterSpacing: 0.6,
  },
  viewSupportLink: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#ee5c21',
  },
  cancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cancelBtnText: {
    fontSize: 11,
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
    fontSize: 12,
    fontWeight: '700',
    color: '#103A75',
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
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#103A75',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#ee5c21',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  // Details List
  detailsList: {
    marginTop: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748b',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#103A75',
    marginTop: 1.5,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#f8fafc',
    marginVertical: 3,
    marginLeft: 48,
  },

  // Action Items
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  actionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextCol: {
    flex: 1,
  },
  actionItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#103A75',
  },
  actionItemSubtitle: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1.5,
    fontWeight: '500',
  },
  supportNumberText: {
    fontSize: 11,
    color: '#103A75',
    marginTop: 1.5,
    fontWeight: '700',
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#f8fafc',
    marginVertical: 3,
    marginLeft: 48,
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
    paddingVertical: 12,
    gap: 6,
    marginTop: 4,
  },
  signOutButtonText: {
    fontSize: 13,
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
    color: '#103A75',
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
    backgroundColor: '#103A75',
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
});
