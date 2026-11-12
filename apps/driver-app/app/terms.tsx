import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TermSection {
  id: number;
  title: string;
  body?: string;
  bullets?: string[];
}

const DRIVER_TERMS_SECTIONS: TermSection[] = [
  {
    id: 1,
    title: 'Acceptance of Driver Partner Agreement',
    body: 'By registering, onboarding, or logging into the KANDY CABS Driver Application, you agree to comply with this Driver Partner Agreement, Code of Conduct, Vehicle Maintenance Guidelines, and Safety Protocols. If you do not agree to these terms, you must not accept trips or operate on the platform.',
  },
  {
    id: 2,
    title: 'Eligibility & Professional Qualifications',
    bullets: [
      'Driver Partners must hold a valid Indian Commercial Driving License (LMV-TR or equivalent transport badge where applicable).',
      'You must be at least 21 years of age and physically fit to operate commercial motor vehicles.',
      'You must submit accurate identity credentials including Aadhaar Card, PAN Card, and Police Verification Certificate.',
      'Any change in license status, suspension, or penalty points must be reported to KANDY CABS immediately.',
    ],
  },
  {
    id: 3,
    title: 'Vehicle Fitness & Document Compliance',
    bullets: [
      'All registered vehicles must carry valid Registration Certificate (RC), Comprehensive Commercial Insurance, Fitness Certificate, Commercial Tourist Permit, and Pollution Under Control (PUC) certificate.',
      'Cabs must be clean, air-conditioned, mechanically sound, and equipped with mandatory safety apparatus (seatbelts, spare tire, jack, first aid kit).',
      'Operating with expired vehicle documents is strictly prohibited and leads to immediate dispatch suspension.',
    ],
  },
  {
    id: 4,
    title: 'Trip Dispatch & Acceptance Policy',
    bullets: [
      'Once a trip broadcast is accepted, you are committed to punctually arriving at the pickup location.',
      'Drivers must verify the customer OTP before starting any ride and adhere strictly to authorized routes.',
      'Unauthorized trip cancellations without valid emergency justification are subject to platform demerits and penalty fees.',
    ],
  },
  {
    id: 5,
    title: 'Fare Inclusions, Tolls & Extra Kilometres',
    bullets: [
      'Fares are calculated based on transparent package rates (per-km, daily driver allowance, or fixed airport transfer packages).',
      'Tolls, parking fees, and interstate permits must be handled according to trip instructions and supported by digital slips.',
      'Drivers must never demand excess cash fares or extort customers beyond the agreed platform breakdown.',
    ],
  },
  {
    id: 6,
    title: 'Settlement & Bank Payouts',
    bullets: [
      'Trip earnings, minus applicable platform service fees, are disbursed directly to your verified Bank Account or UPI VPA.',
      'Payout cycles operate seamlessly via automatic settlement upon trip closure and admin reconciliation.',
      'Bank details must belong to the registered driver or authorized fleet operator.',
    ],
  },
  {
    id: 7,
    title: 'Safety, Professional Ethics & Zero Tolerance',
    bullets: [
      'Zero Tolerance for driving under the influence of alcohol, narcotics, or fatigue.',
      'Courteous, dignified conduct with all passengers. Harassment, verbal abuse, or discrimination results in permanent blacklisting.',
      'Adhere to speed limits, traffic regulations, and avoid mobile phone usage while driving without hands-free safety kits.',
    ],
  },
  {
    id: 8,
    title: 'Support & Grievance Redressal',
    bullets: [
      '24x7 Dedicated Driver Helpline (+91 98809 33504) and WhatsApp channel are available for route emergencies, breakdown assistance, and fare disputes.',
      'Emergency SOS trigger in the app connects directly to local emergency response (112).',
    ],
  },
];

export default function DriverTermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color="#0f2744" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Terms & Conditions</Text>
          <Text style={styles.headerSubtitle}>Kandy Cabs Driver Partner Policy</Text>
        </View>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Badge */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>DRIVER PARTNER TERMS</Text>
            </View>
            <View style={styles.officialBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#16a34a" />
              <Text style={styles.officialBadgeText}>Official Policy</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Operating Guidelines & Driver Partner Standards</Text>
          <Text style={styles.heroMeta}>Effective Version 1.0 • Updated November 2026</Text>
          <Text style={styles.heroDesc}>
            Please review the legal and operational responsibilities associated with providing premium chauffeur services under the KANDY CABS network.
          </Text>
        </View>

        {/* Sections */}
        {DRIVER_TERMS_SECTIONS.map((sec) => (
          <View key={sec.id} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.secNumberCircle}>
                <Text style={styles.secNumberText}>{sec.id}</Text>
              </View>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
            </View>

            {sec.body ? (
              <Text style={styles.sectionBody}>{sec.body}</Text>
            ) : null}

            {sec.bullets && sec.bullets.length > 0 ? (
              <View style={styles.bulletList}>
                {sec.bullets.map((b, idx) => (
                  <View key={idx} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {/* Support Help Card */}
        <View style={styles.supportCard}>
          <View style={styles.supportIconBox}>
            <Ionicons name="help-buoy" size={24} color="#ea580c" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.supportTitle}>Questions about our Driver Terms?</Text>
            <Text style={styles.supportText}>
              Contact our 24x7 Partner Care helpline at +91 98809 33504 or via WhatsApp.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2744',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  headerRightPlaceholder: {
    width: 38,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tagBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: 0.4,
  },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  officialBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2744',
    lineHeight: 22,
    marginBottom: 4,
  },
  heroMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  secNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0f2744',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0f2744',
  },
  sectionBody: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 19,
  },
  bulletList: {
    marginTop: 6,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 18,
    color: '#ea580c',
    fontWeight: '700',
  },
  bulletText: {
    flex: 1,
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginTop: 4,
  },
  supportIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9a3412',
    marginBottom: 2,
  },
  supportText: {
    fontSize: 11.5,
    color: '#c2410c',
    lineHeight: 16,
  },
});

