import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { driverApiClient } from '../lib/api';

type PayoutMethodType = 'BANK' | 'UPI';

export default function PayoutDetailsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Payout Method: 'BANK' or 'UPI'
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethodType>('BANK');

  // Option 1: Bank Transfer fields
  const [bankAccountHolderName, setBankAccountHolderName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankName, setBankName] = useState('');

  // Option 2: UPI Transfer fields
  const [upiFullName, setUpiFullName] = useState('');
  const [payoutUpiId, setPayoutUpiId] = useState('');

  // Contact fields (Optional for both)
  const [payoutPhone, setPayoutPhone] = useState('');
  const [payoutEmail, setPayoutEmail] = useState('');

  // Status
  const [payoutStatus, setPayoutStatus] = useState('PENDING');

  useEffect(() => {
    loadPayoutDetails();
  }, []);

  const loadPayoutDetails = async () => {
    setLoading(true);
    try {
      const res = await driverApiClient.fetch('/api/driver/payout');
      if (res && res.success && res.payout) {
        const p = res.payout;
        setPayoutMethod(p.payoutMethod === 'UPI' ? 'UPI' : 'BANK');
        setBankAccountHolderName(p.bankAccountHolderName || '');
        setBankAccountNumber(p.bankAccountNumber || '');
        setConfirmAccountNumber(p.bankAccountNumber || '');
        setBankIfsc(p.bankIfsc || '');
        setBankName(p.bankName || '');
        setUpiFullName(p.bankAccountHolderName || '');
        setPayoutUpiId(p.payoutUpiId || '');
        setPayoutPhone(p.payoutPhone || '');
        setPayoutEmail(p.payoutEmail || '');
        setPayoutStatus(p.payoutStatus || 'PENDING');
      }
    } catch (err: any) {
      console.warn('Failed to load payout details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    if (payoutMethod === 'BANK') {
      setBankAccountHolderName('Mohan Kumar');
      setBankAccountNumber('50100428912345');
      setConfirmAccountNumber('50100428912345');
      setBankIfsc('HDFC0001234');
      setBankName('HDFC Bank');
      setPayoutPhone('919900447660');
      setPayoutEmail('mohan.driver@kandycabs.in');
    } else {
      setUpiFullName('Mohan Kumar');
      setPayoutUpiId('mohankumar@oksbi');
      setPayoutPhone('919900447660');
      setPayoutEmail('mohan.driver@kandycabs.in');
    }
    Alert.alert('⚡ Demo Values Filled', `Filled demo ${payoutMethod === 'BANK' ? 'Bank Account' : 'UPI'} details.`);
  };

  const handleSave = async () => {
    // Validation
    if (payoutMethod === 'BANK') {
      if (!bankAccountHolderName.trim()) {
        Alert.alert('Required Field', 'Please enter the Bank Account Holder Name as registered in bank records.');
        return;
      }
      if (!bankAccountNumber.trim()) {
        Alert.alert('Required Field', 'Please enter your Bank Account Number.');
        return;
      }
      if (confirmAccountNumber.trim() && bankAccountNumber.trim() !== confirmAccountNumber.trim()) {
        Alert.alert('Account Number Mismatch', 'Account Number and Confirm Account Number do not match.');
        return;
      }
      if (!bankIfsc.trim() || bankIfsc.trim().length < 8) {
        Alert.alert('Required Field', 'Please enter a valid 11-character Bank IFSC Code (e.g. SBIN0001234).');
        return;
      }
    } else {
      // UPI validation
      if (!upiFullName.trim()) {
        Alert.alert('Required Field', "Please enter Driver's Full Name as registered with UPI.");
        return;
      }
      if (!payoutUpiId.trim() || !payoutUpiId.includes('@')) {
        Alert.alert('Required Field', 'Please enter a valid UPI ID (e.g. driver@oksbi or phone@upi).');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        payoutMethod,
        bankAccountHolderName: (payoutMethod === 'BANK' ? bankAccountHolderName : upiFullName).trim(),
        bankAccountNumber: payoutMethod === 'BANK' ? bankAccountNumber.trim() : null,
        bankIfsc: payoutMethod === 'BANK' ? bankIfsc.trim().toUpperCase() : null,
        bankName: payoutMethod === 'BANK' && bankName.trim() ? bankName.trim() : null,
        payoutUpiId: payoutMethod === 'UPI' ? payoutUpiId.trim() : null,
        payoutPhone: payoutPhone.trim() || null,
        payoutEmail: payoutEmail.trim() || null,
      };

      const res = await driverApiClient.fetch('/api/driver/payout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res && res.success) {
        setPayoutStatus('PENDING');
        Alert.alert(
          '✓ Saved Successfully',
          'Your payout details have been recorded and submitted for admin verification. Weekly trip settlements will be routed to this account.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Error', res?.message || 'Failed to save payout details. Please try again.');
      }
    } catch (err: any) {
      console.error('Failed to save payout:', err);
      Alert.alert('Submission Error', err.message || 'Network error occurred while saving payout details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
            <Text style={styles.backButtonText}>Profile</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Settlement & Bank</Text>

          <View style={{ width: 68 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#162232" />
            <Text style={styles.loadingText}>Loading Settlement Details...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >


            {/* Payout Method Selector Tabs */}
            <View style={styles.methodSelectorBox}>
              <TouchableOpacity
                style={[
                  styles.methodTab,
                  payoutMethod === 'BANK' && styles.methodTabActive,
                ]}
                onPress={() => setPayoutMethod('BANK')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="business-outline"
                  size={18}
                  color={payoutMethod === 'BANK' ? '#162232' : '#64748b'}
                />
                <View style={{ marginLeft: 8 }}>
                  <Text
                    style={[
                      styles.methodTabTitle,
                      payoutMethod === 'BANK' && styles.methodTabTitleActive,
                    ]}
                  >
                    Option 1: Bank Transfer
                  </Text>
                  <Text style={styles.methodTabSub}>NEFT / IMPS Direct</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodTab,
                  payoutMethod === 'UPI' && styles.methodTabActive,
                ]}
                onPress={() => setPayoutMethod('UPI')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={18}
                  color={payoutMethod === 'UPI' ? '#162232' : '#64748b'}
                />
                <View style={{ marginLeft: 8 }}>
                  <Text
                    style={[
                      styles.methodTabTitle,
                      payoutMethod === 'UPI' && styles.methodTabTitleActive,
                    ]}
                  >
                    Option 2: UPI Transfer
                  </Text>
                  <Text style={styles.methodTabSub}>Instant UPI / VPA</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* OPTION 1: BANK ACCOUNT TRANSFER */}
            {payoutMethod === 'BANK' && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>🏦 Bank Account Information</Text>
                </View>

                {/* Account Holder Name */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Account Holder Name</Text>
                    <Text style={styles.requiredTag}>* Required</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Ramesh Kumar (as on Passbook)"
                    placeholderTextColor="#94a3b8"
                    value={bankAccountHolderName}
                    onChangeText={setBankAccountHolderName}
                    autoCapitalize="words"
                  />
                  <Text style={styles.helperText}>Name as it appears in bank account records</Text>
                </View>

                {/* Bank Account Number */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Bank Account Number</Text>
                    <Text style={styles.requiredTag}>* Required</Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, styles.fontMono]}
                    placeholder="e.g. 50100428912345"
                    placeholderTextColor="#94a3b8"
                    value={bankAccountNumber}
                    onChangeText={setBankAccountNumber}
                    keyboardType="number-pad"
                  />
                </View>

                {/* Confirm Account Number */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Confirm Account Number</Text>
                    <Text style={styles.requiredTag}>* Required</Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, styles.fontMono]}
                    placeholder="Re-enter account number"
                    placeholderTextColor="#94a3b8"
                    value={confirmAccountNumber}
                    onChangeText={setConfirmAccountNumber}
                    keyboardType="number-pad"
                  />
                </View>

                {/* IFSC Code */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Bank IFSC Code</Text>
                    <Text style={styles.requiredTag}>* Required</Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, styles.fontMono, { textTransform: 'uppercase' }]}
                    placeholder="e.g. HDFC0001234 / SBIN0001234"
                    placeholderTextColor="#94a3b8"
                    value={bankIfsc}
                    onChangeText={(val) => setBankIfsc(val.toUpperCase())}
                    maxLength={11}
                    autoCapitalize="characters"
                  />
                  <Text style={styles.helperText}>11-digit alphanumeric code printed on cheque or passbook</Text>
                </View>

                {/* Bank Name */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Bank Name</Text>
                    <Text style={styles.optionalTag}>Useful for display</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. HDFC Bank / State Bank of India / ICICI"
                    placeholderTextColor="#94a3b8"
                    value={bankName}
                    onChangeText={setBankName}
                  />
                </View>
              </View>
            )}

            {/* OPTION 2: UPI TRANSFER */}
            {payoutMethod === 'UPI' && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>⚡ UPI Transfer Information</Text>
                </View>

                <View style={styles.upiNoteBox}>
                  <Ionicons name="information-circle-outline" size={18} color="#162232" />
                  <Text style={styles.upiNoteText}>
                    You don't need a bank account number when receiving payouts through UPI.
                  </Text>
                </View>

                {/* Driver's Full Name */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Driver's Full Name</Text>
                    <Text style={styles.requiredTag}>* Required</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Ramesh Kumar"
                    placeholderTextColor="#94a3b8"
                    value={upiFullName}
                    onChangeText={setUpiFullName}
                    autoCapitalize="words"
                  />
                  <Text style={styles.helperText}>Name as registered with your UPI VPA handle</Text>
                </View>

                {/* UPI ID */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>UPI ID (VPA)</Text>
                    <Text style={styles.requiredTag}>* Required</Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, styles.fontMono]}
                    placeholder="e.g. driver@oksbi / 9876543210@paytm"
                    placeholderTextColor="#94a3b8"
                    value={payoutUpiId}
                    onChangeText={(val) => setPayoutUpiId(val.trim().toLowerCase())}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <Text style={styles.helperText}>Must contain @ (e.g. @okaxis, @okhdfcbank, @ybl, @paytm)</Text>
                </View>
              </View>
            )}

            {/* CONTACT DETAILS (Optional for Payout Contact) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📞 Payout Contact Details</Text>
                <Text style={styles.optionalTag}>Optional for SMS / Email Receipts</Text>
              </View>

              {/* Mobile Number */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Mobile Number</Text>
                  <Text style={styles.optionalTag}>Optional for payout contact</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#94a3b8"
                  value={payoutPhone}
                  onChangeText={setPayoutPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Email Address */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Email Address</Text>
                  <Text style={styles.optionalTag}>Optional for payout contact</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. driver@kandycabs.in"
                  placeholderTextColor="#94a3b8"
                  value={payoutEmail}
                  onChangeText={setPayoutEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Verification Status Card */}
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Ionicons
                  name={payoutStatus === 'VERIFIED' ? 'checkmark-circle' : 'time-outline'}
                  size={20}
                  color={payoutStatus === 'VERIFIED' ? '#16a34a' : '#d97706'}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.statusTitle}>
                    {payoutStatus === 'VERIFIED' ? 'Payout Account Verified' : 'Verification Under Review'}
                  </Text>
                  <Text style={styles.statusSub}>
                    {payoutStatus === 'VERIFIED'
                      ? 'Your settlement details are verified by Kandy Cabs operations team.'
                      : 'New or updated payout details are validated before processing bulk payouts.'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={20} color="#ffffff" />
                  <Text style={styles.saveButtonText}>SAVE & SUBMIT PAYOUT DETAILS</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  demoButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ea580c',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 10,
    marginBottom: 6,
  },
  introIconBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  introTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#162232',
  },
  introDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 17,
  },
  methodSelectorBox: {
    flexDirection: 'row',
    gap: 10,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  methodTabActive: {
    borderColor: '#162232',
    backgroundColor: '#f0f7ff',
  },
  methodTabTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  methodTabTitleActive: {
    color: '#162232',
  },
  methodTabSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  requiredBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  requiredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
  },
  upiNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    gap: 8,
  },
  upiNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#002744',
    lineHeight: 15,
  },
  inputGroup: {
    gap: 5,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  requiredTag: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgb(240, 117, 15)',
  },
  optionalTag: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94a3b8',
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  fontMono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  helperText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#162232',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#162232',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});

