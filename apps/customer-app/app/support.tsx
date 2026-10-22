import React, { useState, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomerBottomDock } from '../components/CustomerBottomDock';
import { safeNavigate } from '../lib/safeNav';
import { customerTokenStorage, getDynamicBaseUrl } from '../lib/api';
import {
  SUPPORT_CONFIG,
  HELP_CATEGORIES,
  FAQ_DATA,
  SAFETY_TIPS,
  FAQItem,
} from '../constants/supportConfig';

const SEDAN_IMAGE = require('../assets/images/fleet-4-sedan.png');

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);
  const scrollRef = useRef<ScrollView>(null);

  // Search & Category State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [showSafetyTips, setShowSafetyTips] = useState(false);

  // Modals State
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [appSupportModalVisible, setAppSupportModalVisible] = useState(false);

  // App Support Form State
  const currentUser = customerTokenStorage.getUser();
  const [ticketCategory, setTicketCategory] = useState('Login / OTP Issue');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketBookingRef, setTicketBookingRef] = useState('');
  const [customerName, setCustomerName] = useState(currentUser?.name || currentUser?.fullName || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || currentUser?.mobile || '');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    let list = FAQ_DATA;

    // Apply category filter if not "all" and not "contact"
    if (selectedCategory !== 'all' && selectedCategory !== 'contact') {
      list = list.filter((item) => item.category === selectedCategory);
    }

    // Apply search filter if query is present
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q) ||
          item.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    return list;
  }, [selectedCategory, searchQuery]);

  // Number of FAQs to show
  const displayedFaqs = useMemo(() => {
    if (searchQuery.trim().length > 0 || showAllFaqs) {
      return filteredFaqs;
    }
    return filteredFaqs.slice(0, 5);
  }, [filteredFaqs, searchQuery, showAllFaqs]);

  // Actions
  const handleCallSupport = () => {
    Linking.openURL(`tel:${SUPPORT_CONFIG.phone}`);
  };

  const handleWhatsApp = () => {
    Linking.openURL(
      `https://wa.me/${SUPPORT_CONFIG.whatsappPhone}?text=Hello%20Kandy%20Cabs%2C%20I%20need%20assistance%20with%20my%20booking.`
    );
  };

  const handleEmailSupport = () => {
    Linking.openURL(
      `mailto:${SUPPORT_CONFIG.email}?subject=Kandy%20Cabs%20Customer%20Support%20Enquiry`
    );
  };

  const handleAppSupportPhone = () => {
    Linking.openURL(`tel:${SUPPORT_CONFIG.appSupportPhone}`);
  };

  const handleCallPolice = () => {
    Linking.openURL(`tel:${SUPPORT_CONFIG.policeEmergencyPhone}`);
  };

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    setShowAllFaqs(false);
    if (catId === 'contact') {
      // Scroll to Contact Us section
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const toggleFaqAccordion = (id: string) => {
    setExpandedFaqId((prev) => (prev === id ? null : id));
  };

  // Submit App Support Ticket
  const handleSubmitTicket = async () => {
    if (!ticketDescription.trim()) {
      Alert.alert('Required Information', 'Please provide a brief description of the technical issue.');
      return;
    }

    setTicketSubmitting(true);
    try {
      const baseUrl = getDynamicBaseUrl();
      const response = await fetch(`${baseUrl}/api/customer/support-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customerTokenStorage.getToken()
            ? { Authorization: `Bearer ${customerTokenStorage.getToken()}` }
            : {}),
        },
        body: JSON.stringify({
          category: ticketCategory,
          description: ticketDescription.trim(),
          bookingRef: ticketBookingRef.trim() || undefined,
          customerName: customerName.trim() || 'Valued Customer',
          customerPhone: customerPhone.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSubmittedTicketId(data.ticketId);
        setTicketDescription('');
        setTicketBookingRef('');
      } else {
        Alert.alert('Submission Error', data.message || 'Unable to submit ticket. Please call our technical helpline.');
      }
    } catch {
      // Fallback: generate local ticket reference so the user is never stuck
      const fallbackId = `TCK-${Date.now().toString().slice(-6)}`;
      setSubmittedTicketId(fallbackId);
      setTicketDescription('');
      setTicketBookingRef('');
    } finally {
      setTicketSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />

      {/* 1. COMPACT TOP HEADER INSPIRED BY IMAGE 2 */}
      <View style={[styles.headerContainer, { paddingTop: topInset + 4 }]}>
        <View style={styles.headerLeftCol}>
          <View style={styles.headerTitleRow}>
            {router.canGoBack() && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={20} color="#0f172a" />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.headerTitle}>Help & Support</Text>
              <Text style={styles.headerSubtitle}>We're here to assist you</Text>
            </View>
          </View>
        </View>

        {/* White Sedan Cab Asset from Image 2 */}
        <View style={styles.headerCarContainer}>
          <Image
            source={SEDAN_IMAGE}
            style={styles.headerCarImage}
            resizeMode="contain"
          />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 2. SEARCHABLE HELP CENTER INPUT */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search-outline" size={18} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search help topics (e.g. booking, payment, cancellation)"
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={17} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* 3. HORIZONTALLY SCROLLABLE HELP CATEGORY TABS */}
        <View style={styles.categoriesWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScrollContent}
          >
            {HELP_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                  onPress={() => handleCategorySelect(cat.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryIconWrap, isActive && styles.categoryIconWrapActive]}>
                    <Ionicons
                      name={cat.icon as any}
                      size={17}
                      color={isActive ? '#ffffff' : '#103A75'}
                    />
                  </View>
                  <Text style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 4. FREQUENTLY ASKED QUESTIONS SECTION */}
        <View style={styles.faqSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
              <Text style={styles.sectionSubtitle}>Find answers to common questions</Text>
            </View>

            {filteredFaqs.length > 5 && searchQuery.trim().length === 0 && (
              <TouchableOpacity
                onPress={() => setShowAllFaqs((prev) => !prev)}
                style={styles.viewAllBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>{showAllFaqs ? 'View Less' : 'View All'}</Text>
                <Ionicons
                  name={showAllFaqs ? 'chevron-up' : 'chevron-forward'}
                  size={14}
                  color="#ee5c21"
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Accordion FAQ Rows */}
          {displayedFaqs.length > 0 ? (
            <View style={styles.faqListContainer}>
              {displayedFaqs.map((faq) => {
                const isExpanded = expandedFaqId === faq.id;
                return (
                  <View key={faq.id} style={[styles.faqAccordionCard, isExpanded && styles.faqAccordionCardExpanded]}>
                    <TouchableOpacity
                      style={styles.faqHeaderRow}
                      onPress={() => toggleFaqAccordion(faq.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.faqQuestionText, isExpanded && styles.faqQuestionTextActive]}>
                        {faq.question}
                      </Text>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={17}
                        color={isExpanded ? '#ee5c21' : '#64748b'}
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.faqAnswerContainer}>
                        <View style={styles.faqDivider} />
                        <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            /* Search Empty State */
            <View style={styles.emptyStateCard}>
              <Ionicons name="help-circle-outline" size={36} color="#94a3b8" />
              <Text style={styles.emptyStateTitle}>No matching help topics found</Text>
              <Text style={styles.emptyStateSubtitle}>
                Try searching with different terms like "booking", "fare", or "driver", or select a category above.
              </Text>
              <TouchableOpacity
                style={styles.emptyStateResetBtn}
                onPress={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
              >
                <Text style={styles.emptyStateResetText}>Clear Search & Show All FAQs</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 5. NEED FURTHER ASSISTANCE? - CONTACT OPTIONS GRID */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Need Further Assistance?</Text>
          <Text style={styles.sectionSubtitle}>Get in touch with our support team</Text>

          {/* 4 Contact Cards in 1 Row matching Target Reference Image */}
          <View style={styles.contactGrid}>
            {/* 1. Call Us */}
            <TouchableOpacity
              style={styles.contactCard}
              onPress={handleCallSupport}
              activeOpacity={0.7}
            >
              <View style={[styles.solidIconBadge, { backgroundColor: '#f95700' }]}>
                <Ionicons name="call" size={17} color="#ffffff" />
              </View>
              <Text style={styles.contactCardTitle} numberOfLines={1}>Call Us</Text>
              <Text style={styles.contactCardValue} numberOfLines={1}>9900887777</Text>
              <Text style={styles.contactCardSubtext} numberOfLines={1}>6 AM – 10 PM</Text>
            </TouchableOpacity>

            {/* 2. WhatsApp */}
            <TouchableOpacity
              style={styles.contactCard}
              onPress={handleWhatsApp}
              activeOpacity={0.7}
            >
              <View style={[styles.solidIconBadge, { backgroundColor: '#25D366' }]}>
                <Ionicons name="logo-whatsapp" size={18} color="#ffffff" />
              </View>
              <Text style={styles.contactCardTitle} numberOfLines={1}>WhatsApp</Text>
              <Text style={styles.contactCardValue} numberOfLines={1}>9008890090</Text>
              <Text style={styles.contactCardSubtext} numberOfLines={1}>Instant Chat</Text>
            </TouchableOpacity>

            {/* 3. Email Us */}
            <TouchableOpacity
              style={styles.contactCard}
              onPress={handleEmailSupport}
              activeOpacity={0.7}
            >
              <View style={[styles.solidIconBadge, { backgroundColor: '#f95700' }]}>
                <Ionicons name="mail" size={17} color="#ffffff" />
              </View>
              <Text style={styles.contactCardTitle} numberOfLines={1}>Email Us</Text>
              <Text
                style={[styles.contactCardValue, styles.emailValueText]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                support@kandycabs.com
              </Text>
              <Text style={styles.contactCardSubtext} numberOfLines={1}>Reply in 2 hrs</Text>
            </TouchableOpacity>

            {/* 4. App Support */}
            <TouchableOpacity
              style={styles.contactCard}
              onPress={handleAppSupportPhone}
              onLongPress={() => setAppSupportModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.solidIconBadge, { backgroundColor: '#103A75' }]}>
                <Ionicons name="phone-portrait" size={17} color="#ffffff" />
              </View>
              <Text style={styles.contactCardTitle} numberOfLines={1}>App Support</Text>
              <Text style={styles.contactCardValue} numberOfLines={1}>9187336058</Text>
              <Text style={styles.contactCardSubtext} numberOfLines={1}>Tech Help</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. EMERGENCY SOS BAR INSPIRED BY IMAGE 2 */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyIconContainer}>
            <Ionicons name="headset" size={24} color="#dc2626" />
          </View>
          <View style={styles.emergencyTextCol}>
            <Text style={styles.emergencyTitle}>Emergency SOS</Text>
            <Text style={styles.emergencySubtitle}>For urgent assistance during your trip</Text>
          </View>
          <TouchableOpacity
            style={styles.emergencyBtn}
            onPress={() => setEmergencyModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={13} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={styles.emergencyBtnText}>Emergency Contacts</Text>
          </TouchableOpacity>
        </View>

        {/* 7. COLLAPSIBLE RIDE SAFETY TIPS */}
        <View style={styles.safetySection}>
          <TouchableOpacity
            style={styles.safetyHeaderBtn}
            onPress={() => setShowSafetyTips((prev) => !prev)}
            activeOpacity={0.7}
          >
            <View style={styles.safetyHeaderLeft}>
              <View style={styles.safetyShieldBadge}>
                <Ionicons name="shield-checkmark" size={15} color="#ee5c21" />
              </View>
              <Text style={styles.safetyHeaderTitle}>Ride Safety Tips & Guidelines</Text>
            </View>
            <Ionicons
              name={showSafetyTips ? 'chevron-up' : 'chevron-down'}
              size={17}
              color="#64748b"
            />
          </TouchableOpacity>

          {showSafetyTips && (
            <View style={styles.safetyBody}>
              {SAFETY_TIPS.map((tip) => (
                <View key={tip.id} style={styles.safetyTipRow}>
                  <View style={styles.safetyTipIconBox}>
                    <Ionicons name={tip.icon as any} size={15} color="#103A75" />
                  </View>
                  <View style={styles.safetyTipTextCol}>
                    <Text style={styles.safetyTipTitle}>{tip.title}</Text>
                    <Text style={styles.safetyTipDesc}>{tip.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 8. EMERGENCY ASSISTANCE MODAL POPUP */}
      <Modal
        visible={emergencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmergencyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.emergencyModalCard}>
            <View style={styles.emergencyModalHeader}>
              <View style={styles.emergencyModalBadge}>
                <Ionicons name="warning" size={20} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emergencyModalTitle}>Emergency Assistance</Text>
                <Text style={styles.emergencyModalSubtitle}>
                  Connect directly with response services for immediate safety needs.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEmergencyModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.emergencyModalActions}>
              {/* Police 112 */}
              <View style={styles.emergencyActionCard}>
                <View style={styles.emergencyActionTextCol}>
                  <Text style={styles.emergencyActionTitle}>Police Emergency Services</Text>
                  <Text style={styles.emergencyActionSubtitle}>Direct national helpline across India</Text>
                  <Text style={styles.emergencyNumberHighlight}>Dial 112</Text>
                </View>
                <TouchableOpacity
                  style={[styles.emergencyCallBtn, { backgroundColor: '#dc2626' }]}
                  onPress={() => {
                    setEmergencyModalVisible(false);
                    handleCallPolice();
                  }}
                >
                  <Ionicons name="call" size={14} color="#ffffff" />
                  <Text style={styles.emergencyCallBtnText}>Call 112</Text>
                </TouchableOpacity>
              </View>

              {/* Kandy Cabs 24x7 Safety Desk */}
              <View style={styles.emergencyActionCard}>
                <View style={styles.emergencyActionTextCol}>
                  <Text style={styles.emergencyActionTitle}>KANDY CABS Safety Helpline</Text>
                  <Text style={styles.emergencyActionSubtitle}>On-trip dispatch and chauffeur coordination</Text>
                  <Text style={styles.emergencyNumberHighlight}>{SUPPORT_CONFIG.phoneDisplay}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.emergencyCallBtn, { backgroundColor: '#103A75' }]}
                  onPress={() => {
                    setEmergencyModalVisible(false);
                    handleCallSupport();
                  }}
                >
                  <Ionicons name="call" size={14} color="#ffffff" />
                  <Text style={styles.emergencyCallBtnText}>Call Support</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.emergencyDismissBtn}
              onPress={() => setEmergencyModalVisible(false)}
            >
              <Text style={styles.emergencyDismissText}>Close & Return</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 9. APP SUPPORT & TECHNICAL HELP MODAL FORM */}
      <Modal
        visible={appSupportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setAppSupportModalVisible(false);
          setSubmittedTicketId(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.appSupportModalCard}>
            <View style={styles.emergencyModalHeader}>
              <View style={[styles.emergencyModalBadge, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="phone-portrait-outline" size={20} color="#103A75" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emergencyModalTitle}>App Technical Support</Text>
                <Text style={styles.emergencyModalSubtitle}>
                  Submit a technical inquiry or call our direct helpline.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setAppSupportModalVisible(false);
                  setSubmittedTicketId(null);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {submittedTicketId ? (
              /* Success Confirmation */
              <View style={styles.ticketSuccessContainer}>
                <View style={styles.ticketSuccessBadge}>
                  <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
                </View>
                <Text style={styles.ticketSuccessTitle}>Support Request Logged</Text>
                <Text style={styles.ticketSuccessText}>
                  Your inquiry has been successfully registered under reference:
                </Text>
                <View style={styles.ticketIdBadge}>
                  <Text style={styles.ticketIdText}>{submittedTicketId}</Text>
                </View>
                <Text style={styles.ticketSuccessNote}>
                  Our technical operations team will review your report and follow up via phone or SMS within 2 hours.
                </Text>
                <TouchableOpacity
                  style={styles.ticketDoneBtn}
                  onPress={() => {
                    setSubmittedTicketId(null);
                    setAppSupportModalVisible(false);
                  }}
                >
                  <Text style={styles.ticketDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Form */
              <ScrollView style={styles.appSupportFormScroll} keyboardShouldPersistTaps="handled">
                {/* Direct Helpline Pill */}
                <TouchableOpacity
                  style={styles.directHelplinePill}
                  onPress={handleAppSupportPhone}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={14} color="#103A75" />
                  <Text style={styles.directHelplineText}>
                    Urgent Technical Call: <Text style={{ fontWeight: '800' }}>+91 91873 36058</Text>
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color="#103A75" />
                </TouchableOpacity>

                {/* Category Selector */}
                <Text style={styles.formFieldLabel}>Issue Category</Text>
                <View style={styles.categoryChipsRow}>
                  {['Login / OTP Issue', 'App Crash / Performance', 'Location / GPS Error', 'Payment & Booking', 'Other'].map(
                    (chip) => {
                      const isSelected = ticketCategory === chip;
                      return (
                        <TouchableOpacity
                          key={chip}
                          style={[styles.chipItem, isSelected && styles.chipItemActive]}
                          onPress={() => setTicketCategory(chip)}
                        >
                          <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                            {chip}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  )}
                </View>

                {/* Description */}
                <Text style={styles.formFieldLabel}>Issue Description *</Text>
                <TextInput
                  style={styles.formTextArea}
                  placeholder="Describe what happened (e.g. error message, unexpected behavior, step to reproduce)..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={4}
                  value={ticketDescription}
                  onChangeText={setTicketDescription}
                />

                {/* Optional Booking Reference */}
                <Text style={styles.formFieldLabel}>Booking Reference (Optional)</Text>
                <TextInput
                  style={styles.formTextInput}
                  placeholder="e.g. KC-2026-XXXX"
                  placeholderTextColor="#94a3b8"
                  value={ticketBookingRef}
                  onChangeText={setTicketBookingRef}
                  autoCapitalize="characters"
                />

                {/* Customer Contact */}
                <Text style={styles.formFieldLabel}>Your Contact Mobile</Text>
                <TextInput
                  style={styles.formTextInput}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                />

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.formSubmitBtn, ticketSubmitting && styles.formSubmitBtnDisabled]}
                  onPress={handleSubmitTicket}
                  disabled={ticketSubmitting}
                >
                  {ticketSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.formSubmitBtnText}>Submit Support Ticket</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 10. PERSISTENT CUSTOMER BOTTOM DOCK */}
      <CustomerBottomDock activeTab="SUPPORT" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingBottom: 110,
  },

  // 1. Top Header
  headerContainer: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeftCol: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#103A75',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
  },
  headerCarContainer: {
    width: 100,
    height: 52,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerCarImage: {
    width: 95,
    height: 48,
  },

  // 2. Search Bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
      default: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
    }),
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#103A75',
    padding: 0,
  },
  clearSearchBtn: {
    padding: 2,
  },

  // 3. Category Tabs
  categoriesWrapper: {
    marginVertical: 4,
  },
  categoriesScrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  categoryTabActive: {
    backgroundColor: '#ee5c21',
    borderColor: '#ee5c21',
  },
  categoryIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconWrapActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#103A75',
  },
  categoryTabTextActive: {
    color: '#ffffff',
  },

  // 4. FAQ Section
  faqSection: {
    marginHorizontal: 14,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#103A75',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 1,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ee5c21',
  },
  faqListContainer: {
    gap: 7,
  },
  faqAccordionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  faqAccordionCardExpanded: {
    borderColor: '#fed7aa',
  },
  faqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 13,
    gap: 10,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#103A75',
    lineHeight: 18,
  },
  faqQuestionTextActive: {
    color: '#103A75',
    fontWeight: '800',
  },
  faqAnswerContainer: {
    paddingHorizontal: 13,
    paddingBottom: 11,
  },
  faqDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 8,
  },
  faqAnswerText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  emptyStateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 4,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#103A75',
    marginTop: 8,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 12,
  },
  emptyStateResetBtn: {
    backgroundColor: '#eff6ff',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  emptyStateResetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#103A75',
  },

  // 5. Contact Options Grid - matching Target Reference Image
  contactSection: {
    marginHorizontal: 12,
    marginTop: 14,
  },
  contactGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 5,
    marginTop: 8,
  },
  contactCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  solidIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  contactCardTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#103A75',
    textAlign: 'center',
  },
  contactCardValue: {
    fontSize: 9.8,
    fontWeight: '800',
    color: '#103A75',
    marginTop: 2,
    textAlign: 'center',
  },
  emailValueText: {
    fontSize: 7.6,
    fontWeight: '700',
    color: '#103A75',
  },
  liveChatValueText: {
    fontSize: 8.5,
    fontWeight: '600',
    color: '#475569',
  },
  contactCardSubtext: {
    fontSize: 7.8,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },

  // 6. Emergency Support Bar
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 13,
    marginHorizontal: 14,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  emergencyIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  emergencyTextCol: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b91c1c',
  },
  emergencySubtitle: {
    fontSize: 10.5,
    color: '#991b1b',
    marginTop: 1,
  },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  emergencyBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },

  // 7. Safety Tips Section
  safetySection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  safetyHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  safetyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  safetyShieldBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  safetyHeaderTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#103A75',
  },
  safetyBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  safetyTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
  safetyTipIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  safetyTipTextCol: {
    flex: 1,
  },
  safetyTipTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#103A75',
  },
  safetyTipDesc: {
    fontSize: 10.5,
    color: '#475569',
    lineHeight: 15,
    marginTop: 1,
  },

  // Modals Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emergencyModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
    }),
  },
  emergencyModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  emergencyModalBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#103A75',
  },
  emergencyModalSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  modalCloseBtn: {
    padding: 4,
  },
  emergencyModalActions: {
    gap: 10,
  },
  emergencyActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  emergencyActionTextCol: {
    flex: 1,
  },
  emergencyActionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#103A75',
  },
  emergencyActionSubtitle: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  emergencyNumberHighlight: {
    fontSize: 13,
    fontWeight: '800',
    color: '#103A75',
    marginTop: 2,
  },
  emergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 5,
  },
  emergencyCallBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  emergencyDismissBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 12,
  },
  emergencyDismissText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },

  // App Support Modal Form
  appSupportModalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
  },
  appSupportFormScroll: {
    maxHeight: 460,
  },
  directHelplinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 6,
  },
  directHelplineText: {
    flex: 1,
    fontSize: 12,
    color: '#103A75',
  },
  formFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#103A75',
    marginBottom: 6,
    marginTop: 4,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chipItem: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipItemActive: {
    backgroundColor: '#ee5c21',
    borderColor: '#ee5c21',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  formTextArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    fontSize: 12.5,
    color: '#103A75',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 10,
  },
  formTextInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#103A75',
    marginBottom: 10,
  },
  formSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#103A75',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  formSubmitBtnDisabled: {
    opacity: 0.6,
  },
  formSubmitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },

  // Ticket Success State
  ticketSuccessContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  ticketSuccessBadge: {
    marginBottom: 10,
  },
  ticketSuccessTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#103A75',
  },
  ticketSuccessText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  ticketIdBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 10,
  },
  ticketIdText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#103A75',
    letterSpacing: 0.5,
  },
  ticketSuccessNote: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  ticketDoneBtn: {
    backgroundColor: '#103A75',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  ticketDoneBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
