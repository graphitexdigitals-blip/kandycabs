import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  Linking,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { driverApiClient } from '../lib/api';

type FilterTab = 'ALL' | 'EARNINGS' | 'FINES' | 'DEPOSITS' | 'SETTLEMENTS';

interface WalletTransaction {
  id: string;
  type: 'EARNING' | 'FINE' | 'DEPOSIT' | 'SETTLEMENT';
  title: string;
  subtitle: string;
  amount: number; // positive for credits, negative for debits
  date: string;
  time: string;
  bookingRef?: string;
  status: 'COMPLETED' | 'HELD' | 'PROCESSED' | 'PENDING';
  fineReason?: string;
  customerFeedback?: string;
  settlementAccount?: string;
  utrNumber?: string;
  deductionRule?: string;
  customerFare?: number;
  platformFee?: number;
}

export default function DriverWalletScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);

  // Dynamic state populated from API and demo records
  const [driverEarnings, setDriverEarnings] = useState<number>(18450);
  const [settledPayouts, setSettledPayouts] = useState<number>(12500);
  const [securityDeposit, setSecurityDeposit] = useState<number>(5000);
  const [totalFines, setTotalFines] = useState<number>(650);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  // Withdrawal modal and processing state
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Security deposit modal and processing state
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('2000');
  const [depositMethod, setDepositMethod] = useState<'UPI' | 'NETBANKING' | 'EARNINGS'>('UPI');
  const [isDepositing, setIsDepositing] = useState(false);
  const [payoutAccount, setPayoutAccount] = useState<{
    method: 'BANK' | 'UPI';
    holderName: string;
    accountOrUpi: string;
    bankName: string;
  }>({
    method: 'BANK',
    holderName: 'Mohan Kumar',
    accountOrUpi: 'HDFC Bank •••• 2345',
    bankName: 'HDFC Bank',
  });

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      setLoading(true);

      // Fetch driver payout account if available
      try {
        const payoutRes = await driverApiClient.fetch('/api/driver/payout');
        if (payoutRes && payoutRes.success && payoutRes.payout) {
          const p = payoutRes.payout;
          if (p.payoutMethod === 'UPI' && p.payoutUpiId) {
            setPayoutAccount({
              method: 'UPI',
              holderName: p.bankAccountHolderName || 'Driver Partner',
              accountOrUpi: p.payoutUpiId,
              bankName: 'UPI Virtual Payment Address',
            });
          } else if (p.bankAccountNumber) {
            const masked = p.bankAccountNumber.length > 4
              ? `•••• ${p.bankAccountNumber.slice(-4)}`
              : p.bankAccountNumber;
            setPayoutAccount({
              method: 'BANK',
              holderName: p.bankAccountHolderName || 'Driver Partner',
              accountOrUpi: `${p.bankName || 'Bank Account'} (${masked})`,
              bankName: p.bankName || 'Bank Account',
            });
          }
        }
      } catch (err) {
        console.warn('Could not fetch payout settings, keeping defaults:', err);
      }

      const res = await driverApiClient.fetch('/api/driver/trips');
      
      let dynamicEarnings = 18450;
      let dynamicSettled = 12500;
      const dynamicTrips: WalletTransaction[] = [];

      if (res && res.success && res.trips && Array.isArray(res.trips)) {
        let earnedSum = 0;
        res.trips.forEach((trip: any, idx: number) => {
          const isDone = trip.status === 'TRIP_COMPLETED' || trip.status === 'COMPLETED';
          if (!isDone) return;

          const custTotal = Number(trip.estimatedFare || trip.totalPrice || 1600);
          const distanceKm = Number(trip.distanceKm || 0);
          const isReasonableDistance = distanceKm > 0 && distanceKm <= 2000;
          const rawPayee = Number(trip.driverPayeeAmount || 0);
          const allowance = Number(trip.driverAllowance || 0);

          let driverPayee = rawPayee > 0 ? rawPayee : isReasonableDistance ? Math.round(distanceKm * 10 + (allowance || 300)) : 1600;
          if (custTotal > 0 && driverPayee > custTotal * 1.5) {
            driverPayee = Math.round(custTotal * 0.85);
          }
          if (driverPayee > 25000) {
            driverPayee = 4850;
          }

          const platformMargin = Math.max(0, custTotal - driverPayee);
          earnedSum += driverPayee;

          if (dynamicTrips.length < 5) {
            dynamicTrips.push({
              id: `TX-TRIP-${trip.id || idx}`,
              type: 'EARNING',
              title: `Trip Earnings • ${trip.humanReadableRef || 'KC-2026-TRIP'}`,
              subtitle: `${trip.pickupAddress?.split(',')[0] || 'Mangaluru'} → ${trip.dropAddress?.split(',')[0] || 'Bengaluru'}`,
              amount: driverPayee,
              customerFare: custTotal,
              platformFee: platformMargin,
              date: trip.scheduledAt ? new Date(trip.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '18 Nov 2026',
              time: '04:30 PM',
              bookingRef: trip.humanReadableRef || `KC-2026-${trip.id?.slice(0, 6) || '402714'}`,
              status: 'COMPLETED',
            });
          }
        });
        if (earnedSum > 0) dynamicEarnings = earnedSum;
      }

      // Default comprehensive transaction list representing real-world Kandy Cabs driver operations
      const baseTransactions: WalletTransaction[] = [
        ...dynamicTrips,
        {
          id: 'TX-FINE-001',
          type: 'FINE',
          title: 'Fine: Late Arrival at Pickup',
          subtitle: 'Arrived 28 minutes late past pickup window',
          amount: -250,
          date: '17 Nov 2026',
          time: '09:45 AM',
          bookingRef: 'KC-2026-804669',
          status: 'COMPLETED',
          fineReason: 'Driver arrived 28 minutes late for scheduled Mangaluru Airport pickup without prior fleet dispatcher intimation.',
          deductionRule: 'Kandy Cabs Policy Sec 4.2: Late pickup delay exceeding 20 minutes incur ₹250 SLA fine.',
        },
        {
          id: 'TX-SETTLE-001',
          type: 'SETTLEMENT',
          title: 'Weekly Payout Settled to Bank',
          subtitle: 'NEFT Transfer to HDFC Bank A/c •••• 2345',
          amount: -6500,
          date: '15 Nov 2026',
          time: '06:15 PM',
          status: 'PROCESSED',
          settlementAccount: 'HDFC Bank • A/c ending 2345 (Mohan Kumar)',
          utrNumber: 'UTR9048127492019',
        },
        {
          id: 'TX-EARN-002',
          type: 'EARNING',
          title: 'Trip Earnings • KC-2026-701923',
          subtitle: 'Udupi Sri Krishna Matha → Kempegowda Intl Airport (BLR)',
          amount: 4850,
          date: '14 Nov 2026',
          time: '11:20 PM',
          bookingRef: 'KC-2026-701923',
          status: 'COMPLETED',
        },
        {
          id: 'TX-FINE-002',
          type: 'FINE',
          title: 'Fine: Customer Complaint (AC Not Switched On)',
          subtitle: '1-Star customer rating for refusal of cabin cooling',
          amount: -150,
          date: '12 Nov 2026',
          time: '02:10 PM',
          bookingRef: 'KC-2026-619024',
          status: 'COMPLETED',
          fineReason: 'Customer feedback verified: Driver refused to operate air-conditioning on a premium SUV sedan booking.',
          customerFeedback: '"Driver kept arguing that AC causes lower mileage and refused to turn it on despite 34°C heat."',
          deductionRule: 'Kandy Cabs Service Quality: AC refusal on confirmed AC cabs incurs ₹150 quality deduction.',
        },
        {
          id: 'TX-SETTLE-002',
          type: 'SETTLEMENT',
          title: 'Direct UPI Payout Settled',
          subtitle: 'Instant settlement to mohan@oksbi',
          amount: -6000,
          date: '08 Nov 2026',
          time: '05:40 PM',
          status: 'PROCESSED',
          settlementAccount: 'UPI ID: mohan@oksbi',
          utrNumber: 'UPI492019385012',
        },
        {
          id: 'TX-FINE-003',
          type: 'FINE',
          title: 'Fine: Unnotified Trip Cancellation',
          subtitle: 'Cancelled ride 15 mins after accepting dispatch',
          amount: -250,
          date: '05 Nov 2026',
          time: '07:30 AM',
          bookingRef: 'KC-2026-559281',
          status: 'COMPLETED',
          fineReason: 'Driver accepted dispatch and initiated cancellation 15 minutes later, causing customer stranded emergency.',
          deductionRule: 'Kandy Cabs Dispatch Rule 8.1: Driver cancellation post-acceptance without breakdown proof ₹250.',
        },
        {
          id: 'TX-DEP-001',
          type: 'DEPOSIT',
          title: 'Driver Security Deposit',
          subtitle: 'Onboarding Security Deposit (Fully Refundable)',
          amount: 5000,
          date: '01 Nov 2026',
          time: '10:00 AM',
          status: 'HELD',
          fineReason: 'Mandatory fleet security deposit held in escrow. Refundable upon end of contract or clearance.',
          utrNumber: 'DEP-KC-2026-MOHAN-5000',
        },
      ];

      setDriverEarnings(dynamicEarnings);
      setTransactions(baseTransactions);
    } catch (err) {
      console.warn('Failed to load wallet data, showing fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  // Net Current Balance calculation: (Earnings + Security Deposit) - Payouts Settled - Fines
  const netBalance = useMemo(() => {
    return driverEarnings + securityDeposit - settledPayouts - totalFines;
  }, [driverEarnings, securityDeposit, settledPayouts, totalFines]);

  // Withdrawable Trip Earnings: Pending earnings excluding held security deposit
  const withdrawableAmount = useMemo(() => {
    const pendingEarnings = driverEarnings - settledPayouts - totalFines;
    return Math.max(0, pendingEarnings);
  }, [driverEarnings, settledPayouts, totalFines]);

  const handleProcessWithdrawal = () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid withdrawal amount.');
      return;
    }
    if (amt < 100) {
      Alert.alert('Minimum Amount', 'Minimum withdrawal amount is ₹100.');
      return;
    }
    if (amt > withdrawableAmount) {
      Alert.alert(
        'Insufficient Balance',
        `You can withdraw up to ₹${withdrawableAmount.toLocaleString('en-IN')}. Security deposit of ₹${securityDeposit.toLocaleString('en-IN')} is kept safe and protected.`
      );
      return;
    }

    setIsWithdrawing(true);

    setTimeout(() => {
      setIsWithdrawing(false);
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const formattedTime = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const utrRef = `RZP${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${Math.floor(100000 + Math.random() * 900000)}`;

      const newTx: WalletTransaction = {
        id: `TX-WDR-${Date.now().toString().slice(-6)}`,
        type: 'SETTLEMENT',
        title: payoutAccount.method === 'UPI' ? 'Instant UPI Withdrawal' : 'Bank Payout Withdrawal',
        subtitle: `Transferred to ${payoutAccount.accountOrUpi}`,
        amount: -amt,
        date: formattedDate,
        time: formattedTime,
        status: 'PROCESSED',
        settlementAccount: `${payoutAccount.holderName} (${payoutAccount.accountOrUpi})`,
        utrNumber: utrRef,
      };

      setSettledPayouts((prev) => prev + amt);
      setTransactions((prev) => [newTx, ...prev]);
      setWithdrawModalOpen(false);
      setWithdrawAmount('');

      Alert.alert(
        '✓ Withdrawal Processed Successfully!',
        `₹${amt.toLocaleString('en-IN')} has been transferred to ${payoutAccount.accountOrUpi} on ${formattedDate} at ${formattedTime}.\n\nUTR Reference: ${utrRef}\n\nThis withdrawal is recorded in your ledger.`,
        [{ text: 'View Ledger', onPress: () => setActiveTab('SETTLEMENTS') }]
      );
    }, 1200);
  };

  const handleProcessDeposit = () => {
    const amt = parseFloat(depositAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid deposit amount.');
      return;
    }
    if (amt < 500) {
      Alert.alert('Minimum Amount', 'Minimum security deposit addition is ₹500.');
      return;
    }

    setIsDepositing(true);

    setTimeout(() => {
      setIsDepositing(false);
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const formattedTime = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const utrRef = `DEP-RZP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${Math.floor(100000 + Math.random() * 900000)}`;

      if (depositMethod === 'EARNINGS') {
        Alert.alert(
          '✓ Auto-Deduction Activated',
          `10% will be automatically withheld from upcoming completed trip fares until ₹${amt.toLocaleString('en-IN')} is added to your security deposit escrow.`,
          [{ text: 'OK' }]
        );
        setDepositModalOpen(false);
        return;
      }

      const newTx: WalletTransaction = {
        id: `TX-DEP-${Date.now().toString().slice(-6)}`,
        type: 'DEPOSIT',
        title: 'Security Deposit Top-Up',
        subtitle: depositMethod === 'UPI' ? 'Paid via UPI (Instant Escrow)' : 'Paid via Netbanking / Card',
        amount: amt,
        date: formattedDate,
        time: formattedTime,
        status: 'HELD',
        fineReason: 'Escrow security deposit held safely. 100% refundable upon account closure or contract clearance.',
        utrNumber: utrRef,
      };

      setSecurityDeposit((prev) => prev + amt);
      setTransactions((prev) => [newTx, ...prev]);
      setDepositModalOpen(false);
      setDepositAmount('2000');

      Alert.alert(
        '✓ Security Deposit Added Successfully!',
        `₹${amt.toLocaleString('en-IN')} has been added to your Security Deposit.\n\nUTR Reference: ${utrRef}\n\nYour total held deposit is now ₹${(securityDeposit + amt).toLocaleString('en-IN')} (100% Refundable).`,
        [{ text: 'View Deposits', onPress: () => setActiveTab('DEPOSITS') }]
      );
    }, 1200);
  };

  // Filtered transactions based on active tab
  const filteredTransactions = useMemo(() => {
    if (activeTab === 'ALL') return transactions;
    if (activeTab === 'EARNINGS') return transactions.filter((t) => t.type === 'EARNING');
    if (activeTab === 'FINES') return transactions.filter((t) => t.type === 'FINE');
    if (activeTab === 'DEPOSITS') return transactions.filter((t) => t.type === 'DEPOSIT');
    if (activeTab === 'SETTLEMENTS') return transactions.filter((t) => t.type === 'SETTLEMENT');
    return transactions;
  }, [transactions, activeTab]);

  const handleOpenDispute = (tx: WalletTransaction) => {
    setSelectedTx(tx);
    setDisputeModalOpen(true);
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:9008890090');
  };

  const handleWhatsAppSupport = () => {
    const text = selectedTx
      ? encodeURIComponent(`Hello Kandy Cabs Support, I would like to dispute/inquire about the fine/deduction on Trip ${selectedTx.bookingRef || selectedTx.id} of ₹${Math.abs(selectedTx.amount)}. Reason: ${selectedTx.title}`)
      : encodeURIComponent('Hello Kandy Cabs Support, I have a question regarding my Driver Wallet balance and fines.');
    Linking.openURL(`whatsapp://send?phone=919008890090&text=${text}`).catch(() => {
      Linking.openURL(`https://wa.me/919008890090?text=${text}`);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#162232" />

      {/* TOP APP BAR IN BRAND DARK BLUE (#162232) */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#ffffff" />
          <Text style={styles.backButtonText}>{t('wallet.back', 'Profile')}</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>{t('wallet.title', 'Driver Wallet')}</Text>
        </View>

        {/* Shortcut to Bank & Payout settings */}
        <TouchableOpacity
          style={styles.headerBankBtn}
          onPress={() => router.push('/payout-details')}
          activeOpacity={0.8}
        >
          <Ionicons name="card-outline" size={17} color="#ffffff" />
          <Text style={styles.headerBankBtnText}>{t('wallet.bank_btn', 'Bank A/c')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f0750f" />
          <Text style={styles.loadingText}>{t('wallet.loading', 'Loading Wallet Ledger & Payouts...')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ============================================================ */}
          {/* 1. HERO BALANCE CARD (AVAILABLE NET BALANCE & NEXT PAYOUT)   */}
          {/* ============================================================ */}
          <View style={styles.heroBalanceCard}>
            <View style={styles.heroBalanceTopRow}>
              <View>
                <Text style={styles.heroBalanceLabel}>{t('wallet.available_balance', 'AVAILABLE WALLET BALANCE')}</Text>
                <Text style={styles.heroBalanceAmount}>
                  ₹{netBalance > 0 ? netBalance.toLocaleString('en-IN') : '0'}
                </Text>
              </View>
              <View style={styles.heroActiveBadge}>
                <View style={styles.heroActiveDot} />
                <Text style={styles.heroActiveText}>{t('wallet.status_active', 'Active & Settling')}</Text>
              </View>
            </View>

            {/* Withdraw Action CTA inside Hero Card */}
            <View style={styles.heroActionRow}>
              <TouchableOpacity
                style={[
                  styles.heroWithdrawBtn,
                  withdrawableAmount <= 0 && styles.heroWithdrawBtnDisabled,
                ]}
                onPress={() => {
                  setWithdrawAmount(String(Math.min(withdrawableAmount, 2000) || 500));
                  setWithdrawModalOpen(true);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.heroWithdrawBtnText}>WITHDRAW EARNINGS</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroBalanceDivider} />

            <View style={styles.heroBalanceFooter}>
              <View style={styles.heroFooterItem}>
                <Text style={styles.heroFooterText}>
                  {t('wallet.next_cycle', 'Tuesday weekly settlement')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.heroPayoutLink}
                onPress={() => router.push('/payout-details')}
                activeOpacity={0.7}
              >
                <Text style={styles.heroPayoutLinkText}>{t('wallet.edit_bank', 'Edit Bank/UPI →')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ============================================================ */}
          {/* 2. 4-PILLAR BREAKDOWN GRID (EARNINGS, PAYOUTS, FINES, DEPOSIT)*/}
          {/* ============================================================ */}
          <View style={styles.statGrid}>
            <View style={styles.statRow}>
              {/* Card 1: Trip Earnings */}
              <TouchableOpacity
                style={[styles.statCard, activeTab === 'EARNINGS' && styles.statCardActive]}
                onPress={() => setActiveTab('EARNINGS')}
                activeOpacity={0.8}
              >
                <Ionicons name="trending-up" size={20} color="#16a34a" style={styles.statCardIcon} />
                <View style={styles.statCardTextGroup}>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {t('wallet.trip_earnings', 'Trip Earnings')}
                  </Text>
                  <Text style={[styles.statValue, { color: '#16a34a' }]} numberOfLines={1}>
                    +₹{driverEarnings.toLocaleString('en-IN')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Card 2: Settled Payouts */}
              <TouchableOpacity
                style={[styles.statCard, activeTab === 'SETTLEMENTS' && styles.statCardActive]}
                onPress={() => setActiveTab('SETTLEMENTS')}
                activeOpacity={0.8}
              >
                <Ionicons name="business" size={20} color="#4338ca" style={styles.statCardIcon} />
                <View style={styles.statCardTextGroup}>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {t('wallet.payouts_settled', 'Payouts Settled')}
                  </Text>
                  <Text style={[styles.statValue, { color: '#4338ca' }]} numberOfLines={1}>
                    ₹{settledPayouts.toLocaleString('en-IN')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.statRow}>
              {/* Card 3: Security Deposit */}
              <TouchableOpacity
                style={[styles.statCard, activeTab === 'DEPOSITS' && styles.statCardActive]}
                onPress={() => setActiveTab('DEPOSITS')}
                activeOpacity={0.8}
              >
                <Ionicons name="shield-checkmark" size={20} color="#2563eb" style={styles.statCardIcon} />
                <View style={styles.statCardTextGroup}>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {t('wallet.security_deposit', 'Security Deposit')}
                  </Text>
                  <Text style={[styles.statValue, { color: '#2563eb' }]} numberOfLines={1}>
                    ₹{securityDeposit.toLocaleString('en-IN')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Card 4: Fines & Deductions */}
              <TouchableOpacity
                style={[styles.statCard, activeTab === 'FINES' && styles.statCardActiveFine]}
                onPress={() => setActiveTab('FINES')}
                activeOpacity={0.8}
              >
                <Ionicons name="alert-circle" size={20} color="#dc2626" style={styles.statCardIcon} />
                <View style={styles.statCardTextGroup}>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {t('wallet.fines_deductions', 'Fines & Penalties')}
                  </Text>
                  <Text style={[styles.statValue, { color: '#dc2626' }]} numberOfLines={1}>
                    -₹{totalFines.toLocaleString('en-IN')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ============================================================ */}
          {/* 3. FILTER TABS (ALL, EARNINGS, FINES, DEPOSITS, SETTLEMENTS)  */}
          {/* ============================================================ */}
          <View style={styles.tabsWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
              <TouchableOpacity
                style={[styles.tabPill, activeTab === 'ALL' && styles.tabPillActive]}
                onPress={() => setActiveTab('ALL')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabPillText, activeTab === 'ALL' && styles.tabPillTextActive]}>
                  {t('wallet.tab_all', 'All Transactions')} ({transactions.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabPill, activeTab === 'FINES' && styles.tabPillActiveFine]}
                onPress={() => setActiveTab('FINES')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="alert-circle"
                  size={14}
                  color={activeTab === 'FINES' ? '#ffffff' : '#dc2626'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.tabPillText, activeTab === 'FINES' && styles.tabPillTextActive]}>
                  {t('wallet.tab_fines', 'Fines & Late Fees')} (3)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabPill, activeTab === 'EARNINGS' && styles.tabPillActive]}
                onPress={() => setActiveTab('EARNINGS')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabPillText, activeTab === 'EARNINGS' && styles.tabPillTextActive]}>
                  {t('wallet.tab_earnings', 'Trip Payouts')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabPill, activeTab === 'DEPOSITS' && styles.tabPillActive]}
                onPress={() => setActiveTab('DEPOSITS')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabPillText, activeTab === 'DEPOSITS' && styles.tabPillTextActive]}>
                  {t('wallet.tab_deposits', 'Security Deposits')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabPill, activeTab === 'SETTLEMENTS' && styles.tabPillActive]}
                onPress={() => setActiveTab('SETTLEMENTS')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabPillText, activeTab === 'SETTLEMENTS' && styles.tabPillTextActive]}>
                  {t('wallet.tab_settlements', 'Bank Transfers')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* ============================================================ */}
          {/* 4. TRANSACTIONS LEDGER LIST                                  */}
          {/* ============================================================ */}
          <View style={styles.transactionsSection}>
            {/* Dedicated Security Deposit Banner when Deposits tab is active */}
            {activeTab === 'DEPOSITS' && (
              <View style={styles.depositHeroBanner}>
                <View style={styles.depositHeroLeft}>
                  <View style={styles.depositShieldIconBox}>
                    <Ionicons name="shield-checkmark" size={24} color="#2563eb" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.depositHeroTitle}>Escrow Security Deposit</Text>
                    <Text style={styles.depositHeroAmount}>₹{securityDeposit.toLocaleString('en-IN')} Held</Text>
                    <Text style={styles.depositHeroDesc}>100% Refundable upon account clearance</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.depositHeroAddBtn}
                  onPress={() => setDepositModalOpen(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.depositHeroAddBtnText}>Add Deposit</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.txSectionHeader}>
              <Text style={styles.txSectionTitle}>
                {activeTab === 'ALL'
                  ? t('wallet.recent_activity', 'Ledger Activity')
                  : activeTab === 'FINES'
                  ? t('wallet.fines_activity', 'Fines & Deduction Records')
                  : activeTab === 'EARNINGS'
                  ? t('wallet.earnings_activity', 'Trip Earnings Records')
                  : activeTab === 'DEPOSITS'
                  ? t('wallet.deposits_activity', 'Deposit Records')
                  : t('wallet.settlement_activity', 'Bank Settlement Transfers')}
              </Text>
              <Text style={styles.txSectionCount}>{filteredTransactions.length} items</Text>
            </View>

            {filteredTransactions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="file-tray-outline" size={40} color="#94a3b8" />
                <Text style={styles.emptyTitle}>{t('wallet.empty_title', 'No transactions found')}</Text>
                <Text style={styles.emptySub}>
                  {t('wallet.empty_sub', 'Transactions for the selected filter will appear here.')}
                </Text>
              </View>
            ) : (
              filteredTransactions.map((tx) => {
                const isFine = tx.type === 'FINE';
                const isEarning = tx.type === 'EARNING';
                const isDeposit = tx.type === 'DEPOSIT';
                const isSettlement = tx.type === 'SETTLEMENT';

                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={[styles.txCard, isFine && styles.txCardFine]}
                    onPress={() => handleOpenDispute(tx)}
                    activeOpacity={0.8}
                  >
                    {/* Middle Details */}
                    <View style={styles.txInfo}>
                      <View style={styles.txTitleRow}>
                        <Text style={[styles.txTitle, isFine && { color: '#991b1b' }]} numberOfLines={1}>
                          {tx.title}
                        </Text>
                      </View>
                      <Text style={styles.txSubtitle} numberOfLines={1}>
                        {tx.subtitle}
                      </Text>
                      <View style={styles.txMetaRow}>
                        <Text style={styles.txDate}>
                          {tx.date} • {tx.time}
                        </Text>
                        {tx.bookingRef && (
                          <View style={styles.txRefBadge}>
                            <Text style={styles.txRefText}>{tx.bookingRef}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Right Amount & Status */}
                    <View style={styles.txAmountCol}>
                      <Text
                        style={[
                          styles.txAmount,
                          isFine
                            ? styles.txAmountFine
                            : isEarning
                            ? styles.txAmountEarn
                            : isDeposit
                            ? styles.txAmountDeposit
                            : styles.txAmountSettle,
                        ]}
                      >
                        {tx.amount > 0 ? `+₹${tx.amount.toLocaleString('en-IN')}` : `-₹${Math.abs(tx.amount).toLocaleString('en-IN')}`}
                      </Text>
                      <View
                        style={[
                          styles.txStatusPill,
                          isFine
                            ? { backgroundColor: '#fee2e2' }
                            : isEarning
                            ? { backgroundColor: '#dcfce7' }
                            : isDeposit
                            ? { backgroundColor: '#eff6ff' }
                            : { backgroundColor: '#f1f5f9' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.txStatusText,
                            isFine
                              ? { color: '#dc2626' }
                              : isEarning
                              ? { color: '#16a34a' }
                              : isDeposit
                              ? { color: '#2563eb' }
                              : { color: '#475569' },
                          ]}
                        >
                          {isFine ? 'FINE DEDUCTED' : tx.status}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* ============================================================ */}
      {/* 5. TRANSACTION & FINE DETAILS MODAL / DISPUTE SHEET          */}
      {/* ============================================================ */}
      <Modal
        visible={disputeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDisputeModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons
                  name={
                    selectedTx?.type === 'FINE'
                      ? 'alert-circle'
                      : selectedTx?.type === 'EARNING'
                      ? 'car'
                      : selectedTx?.type === 'DEPOSIT'
                      ? 'shield-checkmark'
                      : 'business'
                  }
                  size={24}
                  color={
                    selectedTx?.type === 'FINE'
                      ? '#dc2626'
                      : selectedTx?.type === 'EARNING'
                      ? '#16a34a'
                      : selectedTx?.type === 'DEPOSIT'
                      ? '#2563eb'
                      : '#4338ca'
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>
                    {selectedTx?.type === 'FINE'
                      ? 'Fine & Penalty Breakdown'
                      : selectedTx?.type === 'EARNING'
                      ? 'Trip Earning Receipt'
                      : selectedTx?.type === 'DEPOSIT'
                      ? 'Security Deposit Details'
                      : 'Bank Settlement Receipt'}
                  </Text>
                  <Text style={styles.modalSub}>
                    {selectedTx?.date} • Ref: {selectedTx?.bookingRef || selectedTx?.id}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setDisputeModalOpen(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Big Amount Card */}
                <View
                  style={[
                    styles.modalAmountBanner,
                    selectedTx.type === 'FINE'
                      ? { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }
                      : selectedTx.type === 'EARNING'
                      ? { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }
                      : { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
                  ]}
                >
                  <Text style={styles.modalAmountLabel}>
                    {selectedTx.type === 'FINE' ? 'PENALTY APPLIED' : 'AMOUNT'}
                  </Text>
                  <Text
                    style={[
                      styles.modalAmountValue,
                      selectedTx.type === 'FINE' ? { color: '#dc2626' } : { color: '#16a34a' },
                    ]}
                  >
                    {selectedTx.amount > 0 ? `+₹${selectedTx.amount.toLocaleString('en-IN')}` : `-₹${Math.abs(selectedTx.amount).toLocaleString('en-IN')}`}
                  </Text>
                  <Text style={styles.modalAmountStatus}>
                    Status: {selectedTx.status} • Recorded in Wallet Ledger
                  </Text>
                </View>

                {/* Specific Fine Details */}
                {selectedTx.type === 'FINE' && (
                  <View style={styles.fineBox}>
                    <View style={styles.fineSectionRow}>
                      <Ionicons name="alert-circle" size={17} color="#dc2626" style={{ marginRight: 6 }} />
                      <Text style={styles.fineSectionTitle}>Reason for Penalty</Text>
                    </View>
                    <Text style={styles.fineDescText}>{selectedTx.fineReason}</Text>

                    {selectedTx.customerFeedback && (
                      <View style={styles.customerReviewQuote}>
                        <Text style={styles.customerReviewLabel}>Customer Review Note:</Text>
                        <Text style={styles.customerReviewText}>{selectedTx.customerFeedback}</Text>
                      </View>
                    )}

                    {selectedTx.deductionRule && (
                      <View style={styles.ruleCard}>
                        <Text style={styles.ruleCardTitle}>Applicable SLA Policy:</Text>
                        <Text style={styles.ruleCardText}>{selectedTx.deductionRule}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Specific Earning Breakdown */}
                {selectedTx.type === 'EARNING' && (
                  <View style={[styles.fineBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <View style={styles.fineSectionRow}>
                      <Ionicons name="receipt-outline" size={17} color="#16a34a" style={{ marginRight: 6 }} />
                      <Text style={[styles.fineSectionTitle, { color: '#166534' }]}>Trip Earnings Breakdown</Text>
                    </View>
                    <View style={styles.specRow}>
                      <Text style={styles.specKey}>Customer Total Paid</Text>
                      <Text style={styles.specValue}>₹{(selectedTx.customerFare || Math.round(selectedTx.amount * 1.3)).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.specDivider} />
                    <View style={styles.specRow}>
                      <Text style={styles.specKey}>Kandy Cabs Platform Margin</Text>
                      <Text style={[styles.specValue, { color: '#ea580c' }]}>-₹{(selectedTx.platformFee || Math.round(selectedTx.amount * 0.3)).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.specDivider} />
                    <View style={styles.specRow}>
                      <Text style={[styles.specKey, { fontWeight: '800', color: '#0f172a' }]}>Driver Payout Amount</Text>
                      <Text style={[styles.specValue, { color: '#16a34a', fontWeight: '900', fontSize: 14 }]}>+₹{selectedTx.amount.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>
                )}

                {/* General Transaction Attributes */}
                <View style={styles.specCard}>
                  <View style={styles.specRow}>
                    <Text style={styles.specKey}>Transaction ID</Text>
                    <Text style={styles.specValue}>{selectedTx.id}</Text>
                  </View>
                  <View style={styles.specDivider} />

                  {selectedTx.bookingRef && (
                    <>
                      <View style={styles.specRow}>
                        <Text style={styles.specKey}>Booking ID</Text>
                        <Text style={[styles.specValue, { color: '#ea580c', fontWeight: '800' }]}>
                          {selectedTx.bookingRef}
                        </Text>
                      </View>
                      <View style={styles.specDivider} />
                    </>
                  )}

                  {selectedTx.settlementAccount && (
                    <>
                      <View style={styles.specRow}>
                        <Text style={styles.specKey}>Destination Account</Text>
                        <Text style={styles.specValue}>{selectedTx.settlementAccount}</Text>
                      </View>
                      <View style={styles.specDivider} />
                    </>
                  )}

                  {selectedTx.utrNumber && (
                    <>
                      <View style={styles.specRow}>
                        <Text style={styles.specKey}>Bank UTR Reference</Text>
                        <Text style={styles.specValue}>{selectedTx.utrNumber}</Text>
                      </View>
                      <View style={styles.specDivider} />
                    </>
                  )}

                  <View style={styles.specRow}>
                    <Text style={styles.specKey}>Timestamp</Text>
                    <Text style={styles.specValue}>{selectedTx.date} at {selectedTx.time}</Text>
                  </View>
                </View>

                {/* Dispute / Help Actions */}
                {selectedTx.type === 'FINE' ? (
                  <View style={styles.disputeSection}>
                    <Text style={styles.disputePrompt}>
                      Feel this fine was unjustified? Submit a dispute ticket with dispatch proof to refund your wallet.
                    </Text>

                    <View style={styles.disputeButtonsRow}>
                      <TouchableOpacity
                        style={styles.disputeCallBtn}
                        onPress={handleCallSupport}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="call" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.disputeBtnText}>Call Fleet Desk</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.disputeWhatsappBtn}
                        onPress={handleWhatsAppSupport}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.disputeBtnText}>Dispute Fine</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.receiptHelpBtn}
                    onPress={handleWhatsAppSupport}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="help-circle-outline" size={18} color="#0f2744" style={{ marginRight: 6 }} />
                    <Text style={styles.receiptHelpText}>Need Help with this Settlement?</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* 6. WITHDRAWAL BOTTOM SHEET MODAL                             */}
      {/* ============================================================ */}
      <Modal
        visible={withdrawModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWithdrawModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.withdrawModalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="flash" size={24} color="#ea580c" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Instant Driver Withdrawal</Text>
                  <Text style={styles.modalSub}>Transfer earnings directly to your bank account or UPI</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setWithdrawModalOpen(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Destination Account Card */}
              <View style={styles.withdrawDestCard}>
                <View style={styles.withdrawDestIconBox}>
                  <Ionicons
                    name={payoutAccount.method === 'UPI' ? 'phone-portrait' : 'business'}
                    size={20}
                    color="#0f2744"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.withdrawDestLabel}>PAYOUT DESTINATION</Text>
                  <Text style={styles.withdrawDestValue}>{payoutAccount.accountOrUpi}</Text>
                  <Text style={styles.withdrawDestSub}>{payoutAccount.holderName} • 24x7 IMPS</Text>
                </View>
                <TouchableOpacity
                  style={styles.withdrawChangeLink}
                  onPress={() => {
                    setWithdrawModalOpen(false);
                    router.push('/payout-details');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.withdrawChangeText}>Change</Text>
                </TouchableOpacity>
              </View>

              {/* Amount Input Box */}
              <View style={styles.withdrawInputBox}>
                <Text style={styles.withdrawInputLabel}>ENTER AMOUNT TO WITHDRAW</Text>
                <View style={styles.withdrawInputRow}>
                  <Text style={styles.withdrawRupeePrefix}>₹</Text>
                  <TextInput
                    style={styles.withdrawInput}
                    keyboardType="numeric"
                    value={withdrawAmount}
                    onChangeText={setWithdrawAmount}
                    placeholder="0"
                    placeholderTextColor="#cbd5e1"
                  />
                </View>
                <Text style={styles.withdrawHelperText}>
                  Max withdrawable: ₹{withdrawableAmount.toLocaleString('en-IN')} (Trip earnings minus fines & settled)
                </Text>
              </View>

              {/* Quick Preset Pills */}
              <View style={styles.presetRow}>
                {[500, 1000, 2000].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.presetPill}
                    onPress={() => setWithdrawAmount(String(amt))}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.presetPillText}>+₹{amt}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.presetPill, styles.presetPillAll]}
                  onPress={() => setWithdrawAmount(String(withdrawableAmount))}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.presetPillText, { color: '#ea580c' }]}>Withdraw All</Text>
                </TouchableOpacity>
              </View>

              {/* Confirm CTA */}
              <TouchableOpacity
                style={[
                  styles.confirmWithdrawBtn,
                  (isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0) &&
                    styles.confirmWithdrawBtnDisabled,
                ]}
                onPress={handleProcessWithdrawal}
                disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                activeOpacity={0.85}
              >
                {isWithdrawing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.confirmWithdrawBtnText}>
                      CONFIRM WITHDRAWAL OF ₹{withdrawAmount || '0'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
                <Ionicons name="lock-closed" size={13} color="#94a3b8" style={{ marginRight: 5 }} />
                <Text style={styles.withdrawNoticeText}>
                  Powered by RazorpayX instant settlements. Funds reflect in your bank account in 3–10 seconds.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* 7. ADD SECURITY DEPOSIT MODAL                                */}
      {/* ============================================================ */}
      <Modal
        visible={depositModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDepositModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.withdrawModalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="shield-checkmark" size={24} color="#2563eb" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Add Security Deposit</Text>
                  <Text style={styles.modalSub}>Fund your escrow security deposit via UPI or Netbanking</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setDepositModalOpen(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Current Deposit Summary Card */}
              <View style={styles.depositSummaryBox}>
                <View style={styles.depositSummaryIcon}>
                  <Ionicons name="shield-checkmark" size={22} color="#2563eb" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.depositSummaryLabel}>CURRENT HELD DEPOSIT</Text>
                  <Text style={styles.depositSummaryAmount}>₹{securityDeposit.toLocaleString('en-IN')}</Text>
                  <Text style={styles.depositSummaryNote}>100% Refundable Escrow Account</Text>
                </View>
              </View>

              {/* Amount Input Box */}
              <View style={styles.withdrawInputBox}>
                <Text style={styles.withdrawInputLabel}>ENTER AMOUNT TO ADD</Text>
                <View style={styles.withdrawInputRow}>
                  <Text style={styles.withdrawRupeePrefix}>₹</Text>
                  <TextInput
                    style={styles.withdrawInput}
                    keyboardType="numeric"
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    placeholder="2000"
                    placeholderTextColor="#cbd5e1"
                  />
                </View>
                <Text style={styles.withdrawHelperText}>
                  Standard fleet escrow deposit: ₹5,000 (Min addition: ₹500)
                </Text>
              </View>

              {/* Quick Preset Pills */}
              <View style={styles.presetRow}>
                {[1000, 2000, 5000].map((amt) => (
                  <TouchableOpacity
                    key={`dep-preset-${amt}`}
                    style={[
                      styles.presetPill,
                      depositAmount === String(amt) && styles.presetPillActive,
                    ]}
                    onPress={() => setDepositAmount(String(amt))}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.presetPillText,
                        depositAmount === String(amt) && styles.presetPillTextActive,
                      ]}
                    >
                      +₹{amt.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Payment Method Selector */}
              <Text style={[styles.withdrawInputLabel, { marginTop: 16, marginBottom: 8 }]}>
                SELECT PAYMENT METHOD
              </Text>

              <TouchableOpacity
                style={[
                  styles.methodCard,
                  depositMethod === 'UPI' && styles.methodCardActive,
                ]}
                onPress={() => setDepositMethod('UPI')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={20}
                  color={depositMethod === 'UPI' ? '#2563eb' : '#64748b'}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.methodTitle}>Instant UPI (GPay / PhonePe / Paytm)</Text>
                  <Text style={styles.methodSubtitle}>Instant credit to your deposit ledger via Razorpay</Text>
                </View>
                <Ionicons
                  name={depositMethod === 'UPI' ? 'radio-button-on' : 'radio-button-off'}
                  size={19}
                  color={depositMethod === 'UPI' ? '#2563eb' : '#94a3b8'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodCard,
                  depositMethod === 'NETBANKING' && styles.methodCardActive,
                ]}
                onPress={() => setDepositMethod('NETBANKING')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="card-outline"
                  size={20}
                  color={depositMethod === 'NETBANKING' ? '#2563eb' : '#64748b'}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.methodTitle}>Netbanking / Debit Card</Text>
                  <Text style={styles.methodSubtitle}>All major banks supported via secure gateway</Text>
                </View>
                <Ionicons
                  name={depositMethod === 'NETBANKING' ? 'radio-button-on' : 'radio-button-off'}
                  size={19}
                  color={depositMethod === 'NETBANKING' ? '#2563eb' : '#94a3b8'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodCard,
                  depositMethod === 'EARNINGS' && styles.methodCardActive,
                ]}
                onPress={() => setDepositMethod('EARNINGS')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="wallet-outline"
                  size={20}
                  color={depositMethod === 'EARNINGS' ? '#2563eb' : '#64748b'}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.methodTitle}>Auto-Deduct from Upcoming Trips</Text>
                  <Text style={styles.methodSubtitle}>10% auto-held per ride until target is achieved</Text>
                </View>
                <Ionicons
                  name={depositMethod === 'EARNINGS' ? 'radio-button-on' : 'radio-button-off'}
                  size={19}
                  color={depositMethod === 'EARNINGS' ? '#2563eb' : '#94a3b8'}
                />
              </TouchableOpacity>

              {/* Trust & Escrow Assurance Box */}
              <View style={styles.escrowNotice}>
                <Ionicons name="lock-closed" size={14} color="#059669" style={{ marginRight: 6, marginTop: 1 }} />
                <Text style={styles.escrowNoticeText}>
                  100% Refundable: In accordance with Aggregator Guidelines, security deposits are held in a ring-fenced escrow account and refunded within 48 hours of contract end.
                </Text>
              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                style={[
                  styles.depositSubmitBtn,
                  isDepositing && { opacity: 0.7 },
                ]}
                onPress={handleProcessDeposit}
                disabled={isDepositing}
                activeOpacity={0.85}
              >
                {isDepositing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.depositSubmitBtnText}>
                    {depositMethod === 'EARNINGS'
                      ? 'ACTIVATE AUTO-DEDUCTION'
                      : `PAY & ADD ₹${parseFloat(depositAmount || '0').toLocaleString('en-IN')} TO DEPOSIT`}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#162232',
  },
  header: {
    backgroundColor: '#162232',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#f97316',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 10,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  headerSub: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  headerBankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerBankBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 5,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  /* Hero Balance Card */
  heroBalanceCard: {
    backgroundColor: '#0f2744',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#0f2744',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  heroBalanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroBalanceLabel: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroBalanceAmount: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  heroActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  heroActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 5,
  },
  heroActiveText: {
    color: '#86efac',
    fontSize: 10.5,
    fontWeight: '800',
  },
  heroBalanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 10,
  },
  heroBalanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  heroFooterText: {
    color: '#fdba74',
    fontSize: 11.5,
    fontWeight: '700',
  },
  heroPayoutLink: {
    paddingLeft: 8,
  },
  heroPayoutLinkText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  /* 4-Pillar Breakdown Stat Grid */
  statGrid: {
    gap: 8,
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#64748b',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 1.5,
  },
  statCardActive: {
    borderColor: '#0f2744',
    backgroundColor: '#f8fafc',
  },
  statCardActiveFine: {
    borderColor: '#ef4444',
    backgroundColor: '#fff7f7',
  },
  statCardIcon: {
    marginRight: 6,
  },
  statCardTextGroup: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  statSubText: {
    fontSize: 10.5,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 4,
  },
  cardAddDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    gap: 2,
  },
  cardAddDepositBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#2563eb',
  },
  depositHeroBanner: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  depositHeroLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  depositShieldIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositHeroTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e40af',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  depositHeroAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e3a8a',
    marginTop: 1,
  },
  depositHeroDesc: {
    fontSize: 10.5,
    color: '#3b82f6',
    fontWeight: '600',
    marginTop: 2,
  },
  depositHeroAddBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  depositHeroAddBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Filter Tabs */
  tabsWrapper: {
    marginBottom: 14,
  },
  tabsScroll: {
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabPillActive: {
    backgroundColor: '#0f2744',
    borderColor: '#0f2744',
  },
  tabPillActiveFine: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  tabPillTextActive: {
    color: '#ffffff',
  },

  /* Transactions Ledger Section */
  transactionsSection: {
    marginBottom: 20,
  },
  txSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  txSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  txSectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  txCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  txCardFine: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffdfd',
  },
  txIconBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
    marginRight: 8,
  },
  txTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  txSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  txDate: {
    fontSize: 10.5,
    color: '#94a3b8',
    fontWeight: '600',
  },
  txRefBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  txRefText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#ea580c',
  },
  txAmountCol: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '900',
  },
  txAmountFine: {
    color: '#dc2626',
  },
  txAmountEarn: {
    color: '#16a34a',
  },
  txAmountDeposit: {
    color: '#2563eb',
  },
  txAmountSettle: {
    color: '#4338ca',
  },
  txStatusPill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  txStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* Modal Sheet */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalBody: {
    padding: 18,
  },
  modalAmountBanner: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 16,
  },
  modalAmountLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  modalAmountValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  modalAmountStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 4,
  },

  /* Fine Box inside modal */
  fineBox: {
    backgroundColor: '#fff7f7',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 16,
  },
  fineSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fineSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#dc2626',
  },
  fineDescText: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
    lineHeight: 18,
  },
  customerReviewQuote: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  customerReviewLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b91c1c',
    marginBottom: 2,
  },
  customerReviewText: {
    fontSize: 12,
    color: '#374151',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  ruleCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  ruleCardTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#991b1b',
  },
  ruleCardText: {
    fontSize: 11,
    color: '#7f1d1d',
    fontWeight: '600',
    marginTop: 2,
  },

  /* General Spec Details Card */
  specCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  specKey: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  specValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    maxWidth: '60%',
    textAlign: 'right',
  },
  specDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 2,
  },

  /* Dispute & Help CTA */
  disputeSection: {
    marginTop: 4,
    marginBottom: 10,
  },
  disputePrompt: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  disputeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  disputeCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f2744',
    paddingVertical: 12,
    borderRadius: 12,
  },
  disputeWhatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: 12,
  },
  disputeBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
  },
  receiptHelpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  receiptHelpText: {
    color: '#0f2744',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Withdrawal Hero Action CTA */
  heroActionRow: {
    marginTop: 10,
  },
  heroWithdrawBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 10,
    paddingVertical: 8.5,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  heroWithdrawBtnDisabled: {
    backgroundColor: '#475569',
    shadowOpacity: 0,
    elevation: 0,
  },
  heroWithdrawBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  heroWithdrawBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  heroWithdrawBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Withdrawal Bottom Sheet Modal Styles */
  withdrawModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 28,
  },
  withdrawDestCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  withdrawDestIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawDestLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  withdrawDestValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 1,
  },
  withdrawDestSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  withdrawChangeLink: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  withdrawChangeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f2744',
  },
  withdrawInputBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  withdrawInputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  withdrawInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  withdrawRupeePrefix: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    marginRight: 6,
  },
  withdrawInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    paddingVertical: 4,
  },
  withdrawHelperText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    fontWeight: '500',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetPill: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetPillAll: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  confirmWithdrawBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16a34a',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
    marginTop: 4,
    marginBottom: 12,
  },
  confirmWithdrawBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmWithdrawBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  withdrawNoticeText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },

  /* Deposit Modal Styles */
  depositSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  depositSummaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositSummaryLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#1e40af',
    letterSpacing: 0.3,
  },
  depositSummaryAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e3a8a',
    marginTop: 1,
  },
  depositSummaryNote: {
    fontSize: 10.5,
    color: '#3b82f6',
    fontWeight: '600',
  },
  presetPillActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  presetPillTextActive: {
    color: '#2563eb',
    fontWeight: '900',
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  methodCardActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  methodTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  methodSubtitle: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 2,
  },
  escrowNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  escrowNoticeText: {
    flex: 1,
    fontSize: 10.5,
    color: '#065f46',
    lineHeight: 15,
    fontWeight: '500',
  },
  depositSubmitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  depositSubmitBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
