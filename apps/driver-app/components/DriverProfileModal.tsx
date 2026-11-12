import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DriverProfileModalProps {
  visible: boolean;
  onClose: () => void;
  driver: any;
  onSaveProfile: (updatedDriver: any) => Promise<void> | void;
}

export function DriverProfileModal({
  visible,
  onClose,
  driver,
  onSaveProfile,
}: DriverProfileModalProps) {
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [email, setEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [experience, setExperience] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Sync state when driver changes or modal opens
  useEffect(() => {
    if (visible && driver) {
      setFullName(driver.fullName || '');
      setPhone(driver.phone || '');
      setAltPhone(driver.emergencyContact || driver.altPhone || '');
      setEmail(driver.email || '');
      setLicenseNumber(driver.licenseNumber || driver.docDates?.license?.docNumber || '');
      setExperience(String(driver.experienceYears || driver.experience || '5'));
      setCity(driver.city || 'Mangaluru');
      setAddress(driver.address || '');
      setProfilePhoto(driver.profilePhotoUrl || null);
      setIsEditing(false);
    }
  }, [visible, driver]);

  const openPicker = async (source: 'camera' | 'gallery') => {
    try {
      let result;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      };

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Needed', 'Please allow camera access to take your profile selfie.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Needed', 'Please allow photo library access to choose your profile photo.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setProfilePhoto(uri);
        setIsEditing(true); // Automatically switch to editing mode so Save button is visible!
      }
    } catch (err: any) {
      Alert.alert('Photo Error', err.message || 'Could not select photo.');
    }
  };

  const handlePickPhoto = () => {
    Alert.alert(
      'Update Profile Photo',
      'Choose an option to update your driver portrait photo:',
      [
        {
          text: 'Take Photo (Camera)',
          onPress: () => openPicker('camera'),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => openPicker('gallery'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Missing Name', 'Please enter your full name.');
      return;
    }

    setSaving(true);
    try {
      const updated = {
        ...(driver || {}),
        fullName: fullName.trim(),
        emergencyContact: altPhone.trim(),
        altPhone: altPhone.trim(),
        email: email.trim(),
        licenseNumber: licenseNumber.trim().toUpperCase(),
        experienceYears: experience.trim(),
        city: city.trim(),
        address: address.trim(),
        profilePhotoUrl: profilePhoto || driver?.profilePhotoUrl,
      };

      await onSaveProfile(updated);
      setIsEditing(false);
      Alert.alert('Profile Updated', 'Your driver profile details have been saved successfully.');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const isApproved = driver?.verificationStatus === 'APPROVED';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={isEditing ? () => setIsEditing(false) : onClose}
            activeOpacity={0.7}
          >
            <Ionicons name={isEditing ? 'close' : 'arrow-back'} size={24} color="#0f2744" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>{isEditing ? 'Edit Profile' : 'My Profile'}</Text>
            <Text style={styles.headerSub}>
              {isEditing ? 'Update personal & contact information' : 'Driver Partner Credentials'}
            </Text>
          </View>

          {!isEditing ? (
            <TouchableOpacity
              style={styles.headerEditBtn}
              onPress={() => setIsEditing(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={16} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.headerEditBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.headerSaveBtn, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={17} color="#ffffff" style={{ marginRight: 3 }} />
                  <Text style={styles.headerSaveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Avatar Card */}
            <View style={styles.avatarCard}>
              <TouchableOpacity
                style={styles.avatarWrapper}
                onPress={handlePickPhoto}
                activeOpacity={0.8}
              >
                <Image
                  source={
                    profilePhoto
                      ? { uri: profilePhoto }
                      : require('../assets/images/captain-avatar.png')
                  }
                  style={styles.avatarImg}
                  resizeMode="cover"
                />
                <View style={styles.avatarCameraBadge}>
                  <Ionicons name="camera" size={14} color="#ffffff" />
                </View>
              </TouchableOpacity>

              <Text style={styles.driverNameDisplay}>{fullName || 'Driver Partner'}</Text>
              <Text style={styles.driverPhoneDisplay}>{phone ? (phone.startsWith('+91') ? phone : `+91 ${phone}`) : ''}</Text>

              <View
                style={[
                  styles.statusPill,
                  isApproved ? styles.statusPillApproved : styles.statusPillPending,
                ]}
              >
                <Ionicons
                  name={isApproved ? 'checkmark-circle' : 'time'}
                  size={14}
                  color={isApproved ? '#16a34a' : '#d97706'}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    { color: isApproved ? '#166534' : '#92400e' },
                  ]}
                >
                  {isApproved ? 'Verified Driver Partner' : 'Under Verification'}
                </Text>
              </View>
            </View>

            {/* Form / Details Fields */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Personal & Contact Details</Text>

              {/* Full Name */}
              <View style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                {isEditing ? (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={18} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Enter full name"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                ) : (
                  <View style={styles.readOnlyWrapper}>
                    <Ionicons name="person-outline" size={18} color="#0f2744" style={styles.inputIcon} />
                    <Text style={styles.readOnlyText}>{fullName || 'Not provided'}</Text>
                  </View>
                )}
              </View>

              {/* Registered Phone (View Only with Notice) */}
              <View style={styles.fieldBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.fieldLabel}>Primary Registered Mobile</Text>
                  <View style={styles.lockedBadge}>
                    <Ionicons name="lock-closed" size={10} color="#64748b" />
                    <Text style={styles.lockedText}>Registered</Text>
                  </View>
                </View>
                <View style={[styles.readOnlyWrapper, { backgroundColor: '#f8fafc' }]}>
                  <Ionicons name="call-outline" size={18} color="#64748b" style={styles.inputIcon} />
                  <Text style={[styles.readOnlyText, { color: '#334155' }]}>
                    {phone ? (phone.startsWith('+91') ? phone : `+91 ${phone}`) : 'Not set'}
                  </Text>
                </View>
              </View>

              {/* Alternate / Emergency Phone */}
              <View style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>Emergency / Alternate Phone</Text>
                {isEditing ? (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={18} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={altPhone}
                      onChangeText={setAltPhone}
                      placeholder="10-digit emergency contact"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      maxLength={14}
                    />
                  </View>
                ) : (
                  <View style={styles.readOnlyWrapper}>
                    <Ionicons name="call-outline" size={18} color="#0f2744" style={styles.inputIcon} />
                    <Text style={styles.readOnlyText}>{altPhone || 'None added'}</Text>
                  </View>
                )}
              </View>

              {/* Email Address */}
              <View style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                {isEditing ? (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="driver@example.com"
                      placeholderTextColor="#94a3b8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                ) : (
                  <View style={styles.readOnlyWrapper}>
                    <Ionicons name="mail-outline" size={18} color="#0f2744" style={styles.inputIcon} />
                    <Text style={styles.readOnlyText}>{email || 'Not provided'}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* License & Experience */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>License & Operations</Text>

              {/* Driving License */}
              <View style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>Driving License Number</Text>
                {isEditing ? (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="card-outline" size={18} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={licenseNumber}
                      onChangeText={setLicenseNumber}
                      placeholder="e.g. KA-19-20180004921"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                    />
                  </View>
                ) : (
                  <View style={styles.readOnlyWrapper}>
                    <Ionicons name="card-outline" size={18} color="#0f2744" style={styles.inputIcon} />
                    <Text style={[styles.readOnlyText, { fontWeight: '700' }]}>
                      {licenseNumber || 'Under Review'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Experience */}
              <View style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>Driving Experience (Years)</Text>
                {isEditing ? (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="speedometer-outline" size={18} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={experience}
                      onChangeText={setExperience}
                      placeholder="e.g. 5"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                    />
                  </View>
                ) : (
                  <View style={styles.readOnlyWrapper}>
                    <Ionicons name="speedometer-outline" size={18} color="#0f2744" style={styles.inputIcon} />
                    <Text style={styles.readOnlyText}>{experience ? `${experience} Years` : '5 Years'}</Text>
                  </View>
                )}
              </View>

              {/* City / Service Area */}
              <View style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>Operational City / Hub</Text>
                {isEditing ? (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="business-outline" size={18} color="#64748b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={city}
                      onChangeText={setCity}
                      placeholder="e.g. Mangaluru"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                ) : (
                  <View style={styles.readOnlyWrapper}>
                    <Ionicons name="business-outline" size={18} color="#0f2744" style={styles.inputIcon} />
                    <Text style={styles.readOnlyText}>{city || 'Mangaluru'}</Text>
                  </View>
                )}
              </View>

              {/* Residential Address */}
              <View style={styles.fieldBox}>
                <Text style={styles.fieldLabel}>Residential Address</Text>
                {isEditing ? (
                  <View style={[styles.inputWrapper, { alignItems: 'flex-start', minHeight: 74, paddingVertical: 10 }]}>
                    <Ionicons name="location-outline" size={18} color="#64748b" style={[styles.inputIcon, { marginTop: 2 }]} />
                    <TextInput
                      style={[styles.textInput, { minHeight: 54, textAlignVertical: 'top' }]}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="Complete address with pincode"
                      placeholderTextColor="#94a3b8"
                      multiline
                    />
                  </View>
                ) : (
                  <View style={[styles.readOnlyWrapper, { minHeight: 54, paddingVertical: 10 }]}>
                    <Ionicons name="location-outline" size={18} color="#0f2744" style={[styles.inputIcon, { marginTop: 2 }]} />
                    <Text style={styles.readOnlyText}>
                      {address || 'Kandy Cabs Hub, Inland Impala, Mangaluru, Karnataka'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Bottom Actions when Editing */}
            {isEditing && (
              <View style={styles.bottomEditActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsEditing(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveChangesBtn, saving && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveChangesBtnText}>Save Profile Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f2744',
  },
  headerSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0750f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerEditBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
  },
  avatarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#f0750f',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0f2744',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverNameDisplay: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f2744',
    marginBottom: 3,
  },
  driverPhoneDisplay: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusPillApproved: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusPillPending: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f2744',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  fieldBox: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lockedText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f2744',
  },
  readOnlyWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f2744',
    fontWeight: '500',
  },
  bottomEditActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  saveChangesBtn: {
    flex: 2,
    backgroundColor: '#f0750f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f0750f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  saveChangesBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});

