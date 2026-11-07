import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { driverApiClient } from '../lib/api';
import { DriverVerificationStatus, VehicleCategory, FuelType } from '@kandy-cabs/shared';

export default function DriverOnboardingScreen() {
  const router = useRouter();
  const [driverStatus, setDriverStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [fullName, setFullName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [category, setCategory] = useState<VehicleCategory>(VehicleCategory.SEDAN);
  const [fuelType, setFuelType] = useState<FuelType>(FuelType.DIESEL);
  const [seatCount, setSeatCount] = useState('4');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await driverApiClient.fetch('/api/driver/status');
      if (res.success && res.driver) {
        setDriverStatus(res.driver);
        setFullName(res.driver.fullName || '');
        setLicenseNumber(res.driver.licenseNumber || '');
        if (res.driver.vehicle) {
          setPlateNumber(res.driver.vehicle.plateNumber || '');
          setCategory(res.driver.vehicle.category);
        }
        const d = res.driver;
        const docsSubmitted = !!(
          d.licenseDocUrl ||
          d.rcDocUrl ||
          d.profilePhotoUrl ||
          d.insuranceDocUrl ||
          (d.licenseNumber && d.licenseNumber !== 'PENDING') ||
          (d.vehicle?.plateNumber && d.vehicle.plateNumber !== 'PENDING')
        );
        if (d.verificationStatus === DriverVerificationStatus.APPROVED || (d.verificationStatus === DriverVerificationStatus.PENDING && docsSubmitted)) {
          router.replace('/dashboard');
        }
      }
    } catch (err) {
      console.error('Fetch status error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!licenseNumber || !plateNumber) {
      setError('Please fill in your License number and Vehicle plate number');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        fullName,
        licenseNumber,
        category,
        fuelType,
        plateNumber,
        seatCount: parseInt(seatCount, 10) || 4,
        licenseDocUrl: 'https://placehold.co/800x600/png?text=Driving+License',
        rcDocUrl: 'https://placehold.co/800x600/png?text=RC+Book',
        insuranceDocUrl: 'https://placehold.co/800x600/png?text=Insurance+Certificate',
        vehiclePhotos: [
          'https://placehold.co/800x600/png?text=Front+Angle',
          'https://placehold.co/800x600/png?text=Rear+Angle',
          'https://placehold.co/800x600/png?text=Left+Angle',
          'https://placehold.co/800x600/png?text=Right+Angle',
          'https://placehold.co/800x600/png?text=Interior+View',
        ],
      };

      const res = await driverApiClient.fetch('/api/driver/onboarding', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        await fetchStatus();
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  // If driver verification is PENDING
  if (driverStatus && driverStatus.verificationStatus === DriverVerificationStatus.PENDING) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.statusBox}>
          <Text style={styles.statusEmoji}>⏳</Text>
          <Text style={styles.statusTitle}>Documents Under Review</Text>
          <Text style={styles.statusDesc}>
            Your registration is being reviewed by our verification team. You can explore your dashboard and update documents.
          </Text>

          <View style={styles.detailsCard}>
            <Text style={styles.detailRow}>
              Driver: <Text style={styles.detailVal}>{driverStatus.fullName}</Text>
            </Text>
            <Text style={styles.detailRow}>
              License: <Text style={styles.detailVal}>{driverStatus.licenseNumber}</Text>
            </Text>
            <Text style={styles.detailRow}>
              Vehicle: <Text style={styles.detailVal}>{driverStatus.vehicle?.plateNumber || 'In review'}</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryDashboardBtn}
            onPress={() => router.replace('/dashboard')}
          >
            <Text style={styles.primaryDashboardBtnText}>🚀 Open Driver Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryDocBtn}
            onPress={() => router.push('/documents')}
          >
            <Text style={styles.secondaryDocBtnText}>📤 Upload / Update Documents</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshBtn} onPress={fetchStatus}>
            <Text style={styles.refreshBtnText}>🔄 Check Verification Status</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Driver Onboarding</Text>
          <Text style={styles.subtitle}>Enter your details and vehicle information</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Personal Information</Text>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="e.g. Ramesh Kumar"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.label}>Driving License Number *</Text>
          <TextInput
            style={styles.input}
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            placeholder="DL-01-2024-000123"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Vehicle Details</Text>
          <Text style={styles.label}>Vehicle Number Plate *</Text>
          <TextInput
            style={styles.input}
            value={plateNumber}
            onChangeText={setPlateNumber}
            placeholder="KA-01-AB-1234"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Vehicle Category</Text>
          <View style={styles.pillRow}>
            {[
              VehicleCategory.HATCHBACK,
              VehicleCategory.SEDAN,
              VehicleCategory.SUV,
              VehicleCategory.SUV_PREMIUM,
              VehicleCategory.TEMPO_TRAVELER,
            ].map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.pill,
                  category === cat ? styles.pillActive : styles.pillInactive,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    category === cat ? styles.pillTextActive : styles.pillTextInactive,
                  ]}
                >
                  {cat.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Required KYC Documents</Text>
          <Text style={styles.docItem}>✅ Driver Profile Photo (Portrait / Selfie)</Text>
          <Text style={styles.docItem}>✅ Driving License Document</Text>
          <Text style={styles.docItem}>✅ RC Book Certificate</Text>
          <Text style={styles.docItem}>✅ Commercial Insurance</Text>
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Documents for Verification</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ea580c',
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    padding: 12,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 14,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  pillInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  pillTextInactive: {
    color: '#475569',
  },
  docItem: {
    color: '#334155',
    fontSize: 12.5,
    marginVertical: 4,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
    shadowColor: '#ea580c',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 12,
    fontWeight: '600',
  },
  statusBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  statusEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  statusDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 300,
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginVertical: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  detailRow: {
    color: '#64748b',
    fontSize: 13,
    marginVertical: 4,
  },
  detailVal: {
    color: '#0f172a',
    fontWeight: '700',
  },
  primaryDashboardBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#ea580c',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  primaryDashboardBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
  secondaryDocBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#ea580c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryDocBtnText: {
    color: '#ea580c',
    fontWeight: '800',
    fontSize: 13,
  },
  refreshBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13,
  },
});
