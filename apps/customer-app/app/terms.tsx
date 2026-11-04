import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { termsAgreementState } from '../lib/terms-agreement';
import { LanguageSelectionModal } from '../components/LanguageSelectionModal';

interface TermSection {
  id: number;
  title: string;
  body?: string;
  bullets?: string[];
}

const TERMS_SECTIONS: TermSection[] = [
  {
    id: 1,
    title: 'Acceptance of Terms',
    body: 'By registering or accessing the KANDY CABS application, you agree to comply with these Terms & Conditions, the applicable Booking Policy, Cancellation Policy, Privacy Policy, and Ride Safety Guidelines. If you do not agree, you must not proceed.',
  },
  {
    id: 2,
    title: 'Eligibility and Account Registration',
    bullets: [
      'Customers must provide accurate and complete registration details.',
      'You are responsible for maintaining the confidentiality of your login credentials and OTPs.',
      'Do not create fake accounts, impersonate another person, or misuse the application.',
      'KANDY CABS may restrict or suspend accounts for suspected fraud, misuse, or unlawful activity, subject to applicable law.',
    ],
  },
  {
    id: 3,
    title: 'Booking and Confirmation',
    bullets: [
      'A booking request is subject to vehicle availability and confirmation by KANDY CABS.',
      'Customers must provide correct pickup and drop-off addresses, travel dates, reporting times, contact numbers, passenger count, and luggage details.',
      'Changes to the itinerary, pickup time, destination, or vehicle category must be communicated in advance and may result in revised charges.',
      'Customers should rely on the final booking confirmation for the agreed trip details and price.',
    ],
  },
  {
    id: 4,
    title: 'Fares, Taxes and Additional Charges',
    bullets: [
      'The applicable fare and inclusions will be communicated before booking confirmation.',
      'Toll charges, parking fees, permits, state taxes, additional kilometres, waiting time, night allowances, or other trip-related charges may apply where disclosed in the quotation or applicable booking conditions.',
      'GST and other applicable taxes will be charged as required by law.',
      'Any additional charges must be explained and supported by the applicable booking terms or actual trip expenses, as relevant.',
    ],
  },
  {
    id: 5,
    title: 'Payments and Invoices',
    bullets: [
      'Customers must pay through the payment methods officially authorised by KANDY CABS.',
      'For safety and transparency, customers are requested not to make cash payments directly to the chauffeur. Payments should be made through authorised online channels against the applicable invoice or payment request.',
      'Customers should retain their payment confirmation and contact KANDY CABS if a payment discrepancy arises.',
      'Invoices and receipts will be issued according to the applicable billing process.',
    ],
  },
  {
    id: 6,
    title: 'Cancellation, Rescheduling and Refunds',
    bullets: [
      'Cancellation and rescheduling charges, if any, will be governed by the cancellation policy communicated for the booking.',
      'Refund eligibility and processing timelines depend on the applicable policy, payment provider, and circumstances of cancellation.',
      'If KANDY CABS must cancel or materially change a confirmed booking, the customer will be informed and offered an appropriate resolution under the applicable policy and law.',
    ],
  },
  {
    id: 7,
    title: 'Customer Responsibilities',
    bullets: [
      'Be present at the confirmed pickup location at the scheduled time.',
      'Ensure all passengers wear seat belts and comply with applicable safety laws.',
      'Treat chauffeurs respectfully and refrain from abusive, threatening, discriminatory, or unlawful behaviour.',
      'Do not request speeding, dangerous driving, illegal stops, or violations of traffic regulations.',
      'Do not carry prohibited, illegal, dangerous, or hazardous items in the vehicle.',
      'Keep personal belongings secure and check the vehicle before leaving.',
    ],
  },
  {
    id: 8,
    title: 'Passenger Safety and Emergency Situations',
    bullets: [
      'Customers should verify the vehicle and chauffeur details provided in the app or booking confirmation before boarding.',
      'Any safety concern, accident, harassment, suspected misconduct, or emergency should be reported promptly to the appropriate emergency services and KANDY CABS.',
      'Chauffeurs may refuse requests that would violate traffic laws or compromise passenger safety.',
      'Children must be accompanied and supervised by a responsible adult, with suitable child restraints used where required.',
    ],
  },
  {
    id: 9,
    title: 'Trip Duration and Route',
    bullets: [
      'Estimated arrival times are indicative and may vary due to traffic, weather, road closures, vehicle restrictions, or other circumstances beyond reasonable control.',
      'Extra kilometres, additional stops, route deviations requested by the customer, and extensions beyond the agreed package may incur additional charges according to the confirmed fare terms.',
      'Drivers must follow applicable laws and prioritise road safety.',
    ],
  },
  {
    id: 10,
    title: 'Luggage and Personal Belongings',
    bullets: [
      'Customers must disclose luggage quantities and oversized items in advance.',
      'Luggage must fit safely within the available vehicle capacity.',
      'KANDY CABS should be notified promptly if any item is lost or left behind. Recovery and delivery arrangements may be subject to availability and reasonable disclosed costs.',
    ],
  },
  {
    id: 11,
    title: 'Privacy and Personal Information',
    bullets: [
      'Customer information may be used for account creation, booking management, payment processing, trip coordination, customer support, safety, and legal compliance.',
      'Location information may be processed where necessary for pickup coordination, navigation, trip tracking, and safety, subject to the app\'s permissions and Privacy Policy.',
      'Personal information will be handled in accordance with applicable data protection laws and the KANDY CABS Privacy Policy.',
      'Promotional communications should be handled in accordance with applicable consent and communication preferences.',
    ],
  },
  {
    id: 12,
    title: 'Service Availability and Limitations',
    bullets: [
      'Vehicle and chauffeur availability may vary by location, date, time, and service category.',
      'KANDY CABS will make reasonable efforts to provide the confirmed service but cannot guarantee that the application will always be uninterrupted or error-free.',
      'Nothing in these terms excludes liability or consumer rights that cannot legally be excluded under applicable law.',
    ],
  },
  {
    id: 13,
    title: 'Complaints and Customer Support',
    body: 'Customers may report booking issues, billing discrepancies, service complaints, or safety concerns through the support details displayed in the application or on the official website: www.kandycabs.in. Complaints will be handled in accordance with applicable law and the company\'s grievance procedure.',
  },
  {
    id: 14,
    title: 'Updates to These Terms',
    body: 'KANDY CABS may update these terms when required for operational, legal, or service-related reasons. Material changes will be communicated as appropriate. Where fresh acceptance is legally required or necessary for continued use, customers will be asked to review and accept the updated terms.',
  },
  {
    id: 15,
    title: 'Governing Law',
    body: 'These terms are governed by the applicable laws of India. Disputes will be handled by the competent authorities or courts having jurisdiction under applicable law, without limiting any statutory consumer rights.',
  },
];

export default function TermsAndConditionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;
  const { t, i18n } = useTranslation();
  const [agreed, setAgreed] = useState(false);
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0
  );

  const sectionsData = t('termsScreen.sections', { returnObjects: true });
  const sections: TermSection[] =
    Array.isArray(sectionsData) && sectionsData.length > 0
      ? (sectionsData as TermSection[])
      : TERMS_SECTIONS;

  const handleProceed = () => {
    if (!agreed) {
      Alert.alert(
        t('termsScreen.alertTitle', { defaultValue: 'Agreement Required' }),
        t('termsScreen.alertMessage', {
          defaultValue:
            'Please tick the checkbox to agree to the Terms & Conditions and Cancellation Policy before continuing.',
        })
      );
      return;
    }
    termsAgreementState.setAgreed(true);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="rgb(22, 34, 50)" />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit={true}>
            {t('termsScreen.headerTitle', { defaultValue: 'Terms & Conditions' })}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {t('termsScreen.headerSub', { defaultValue: 'Kandy Cabs Customer Policy' })}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.langPill}
          onPress={() => setIsLangModalOpen(true)}
          activeOpacity={0.75}
          accessibilityLabel="Select Language"
        >
          <Ionicons name="globe-outline" size={14} color="rgb(22, 34, 50)" />
          <Text style={styles.langPillText}>
            {i18n.language?.startsWith('kn')
              ? 'ಕನ್ನಡ'
              : i18n.language?.startsWith('hi')
                ? 'हिन्दी'
                : 'English'}
          </Text>
          <Ionicons name="chevron-down" size={11} color="rgb(22, 34, 50)" />
        </TouchableOpacity>
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isSmallDevice && { paddingHorizontal: 12 },
        ]}
        showsVerticalScrollIndicator={true}
      >
        {/* Banner Card */}
        <View style={styles.heroCard}>
          <View style={styles.badgeRow}>
            <View style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>
                {t('termsScreen.tagBadge', { defaultValue: 'CUSTOMER TERMS & CONDITIONS' })}
              </Text>
            </View>
            <View style={styles.verifiedBadgeHero}>
              <Ionicons name="shield-checkmark" size={13} color="#15803d" />
              <Text style={styles.verifiedBadgeText}>
                {t('termsScreen.official', { defaultValue: 'Official' })}
              </Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>
            {t('termsScreen.heroTitle', { defaultValue: 'Please read carefully before proceeding to login.' })}
          </Text>
          <Text style={styles.heroMeta}>
            {t('termsScreen.heroMeta', {
              defaultValue: 'Last updated: October 2026 • Effective for all bookings and accounts',
            })}
          </Text>
        </View>

        {/* 15 Terms Sections */}
        {sections.map((section) => (
          <View key={section.id} style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.numberPill}>
                <Text style={styles.numberPillText}>
                  {String(section.id).padStart(2, '0')}
                </Text>
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>

            {section.body && (
              <Text style={styles.sectionBody}>{section.body}</Text>
            )}

            {section.bullets && (
              <View style={styles.bulletsList}>
                {section.bullets.map((bullet, idx) => (
                  <View key={idx} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Help & Support Footer Card */}
        <View style={styles.supportFooterCard}>
          <Ionicons name="help-buoy-outline" size={20} color="rgb(240, 117, 15)" />
          <View style={{ flex: 1 }}>
            <Text style={styles.supportFooterTitle}>
              {t('termsScreen.supportTitle', { defaultValue: 'Have questions about our terms?' })}
            </Text>
            <Text style={styles.supportFooterText}>
              {t('termsScreen.supportText', {
                defaultValue: 'Contact 24/7 Support at support@kandycabs.in or visit www.kandycabs.in',
              })}
            </Text>
          </View>
        </View>

        {/* Bottom spacer so content doesn't get covered by sticky bar */}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Sticky Bottom Dock: Tick Bar + Accept CTA */}
      <View
        style={[
          styles.stickyDock,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {/* Tick Bar: Checkbox Row matching user screenshot */}
        <TouchableOpacity
          style={styles.termsTickRow}
          activeOpacity={0.7}
          onPress={() => setAgreed((prev) => !prev)}
        >
          <View
            style={[
              styles.termsTickBox,
              agreed && styles.termsTickBoxActive,
            ]}
          >
            {agreed && (
              <Ionicons name="checkmark" size={15} color="#ffffff" />
            )}
          </View>
          <Text style={styles.termsTickText}>
            {t('termsScreen.checkboxPrefix', { defaultValue: 'I agree to the ' })}
            <Text style={styles.termsTickHighlight}>
              {t('termsScreen.termsAndConditions', { defaultValue: 'Terms & Conditions' })}
            </Text>
            {t('termsScreen.and', { defaultValue: ' and ' })}
            <Text style={styles.termsTickHighlight}>
              {t('termsScreen.cancellationPolicy', { defaultValue: 'Cancellation Policy' })}
            </Text>
            {t('termsScreen.checkboxSuffix', { defaultValue: '.' })}
          </Text>
        </TouchableOpacity>

        {/* Confirm / Proceed Button */}
        <TouchableOpacity
          style={[
            styles.proceedBtn,
            !agreed && styles.proceedBtnDisabled,
          ]}
          onPress={handleProceed}
          activeOpacity={0.88}
        >
          <Text style={styles.proceedBtnText} numberOfLines={1} adjustsFontSizeToFit={true}>
            {agreed
              ? t('termsScreen.acceptAndContinue', { defaultValue: 'Accept & Continue' })
              : t('termsScreen.agreeAndContinue', { defaultValue: 'Agree to Terms & Continue' })}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={18}
            color="#ffffff"
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>
      </View>

      {/* Language Switcher Modal */}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1.5,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  langPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  verifiedBadgeHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tagBadge: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagBadgeText: {
    color: 'rgb(240, 117, 15)',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    lineHeight: 24,
    marginBottom: 6,
  },
  heroMeta: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 10,
  },
  numberPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberPillText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  sectionTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    flex: 1,
    letterSpacing: -0.2,
  },
  sectionBody: {
    fontSize: 14.5,
    color: '#334155',
    lineHeight: 22,
    fontWeight: '400',
  },
  bulletsList: {
    gap: 9,
    marginTop: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgb(240, 117, 15)',
    marginTop: 8,
  },
  bulletText: {
    fontSize: 14.5,
    color: '#334155',
    lineHeight: 22,
    flex: 1,
    fontWeight: '400',
  },
  supportFooterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
  },
  supportFooterTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    marginBottom: 3,
  },
  supportFooterText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 18,
  },
  stickyDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
    gap: 11,
  },
  termsTickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 3,
  },
  termsTickBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsTickBoxActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  termsTickText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  termsTickHighlight: {
    color: 'rgb(240, 117, 15)',
    fontWeight: '700',
  },
  proceedBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  proceedBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  proceedBtnText: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
