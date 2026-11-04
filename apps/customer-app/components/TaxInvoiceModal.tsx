import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { customerApiClient } from '../lib/api';

interface TaxInvoiceModalProps {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaxInvoiceModal({
  bookingId,
  isOpen,
  onClose,
}: TaxInvoiceModalProps) {
  const { t } = useTranslation();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && bookingId) {
      setLoading(true);
      setError('');
      customerApiClient
        .fetch(`/api/customer/bookings/${bookingId}/invoice`)
        .then((data: any) => {
          if (data && data.success && data.invoice) {
            setInvoice(data.invoice);
          } else {
            setError(data?.message || 'Failed to generate tax invoice');
          }
        })
        .catch((err: any) => {
          setError(err.message || 'Failed to load invoice');
        })
        .finally(() => setLoading(false));
    } else {
      setInvoice(null);
    }
  }, [isOpen, bookingId]);

  if (!isOpen || !bookingId) return null;

  const handleShare = async () => {
    if (!invoice) return;
    try {
      await Share.share({
        message: `Kandy Cabs Tax Invoice #${invoice.invoiceNumber}\nBooking Ref: ${invoice.booking.ref}\nTotal Fare: ₹${invoice.financials.totalFare}\nAdvance Paid: ₹${invoice.financials.advancePaid}\nBalance: ₹${invoice.financials.balanceDue} (${invoice.financials.balanceStatus})\nPickup: ${invoice.booking.pickupAddress}\nDrop: ${invoice.booking.dropAddress}`,
      });
    } catch (_) {}
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.badgeText}>{t('modals.invoice.title', { defaultValue: 'Official Tax Invoice' }).toUpperCase()}</Text>
              <Text style={styles.companyTitle}>Kandy Cabs Pvt Ltd</Text>
              <Text style={styles.gstText}>GSTIN: 29ABCDE1234F1Z5 • Karnataka</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={16} color="#0f172a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="rgb(240, 117, 15)" />
              <Text style={styles.loadingMessage}>Generating official invoice...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : invoice ? (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {/* Meta Grid */}
              <View style={styles.metaGrid}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Invoice No:</Text>
                  <Text style={styles.metaVal}>{invoice.invoiceNumber}</Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Booking Ref:</Text>
                  <Text style={[styles.metaVal, { color: 'rgb(240, 117, 15)' }]}>{invoice.booking.ref}</Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Date:</Text>
                  <Text style={styles.metaVal}>
                    {new Date(invoice.invoiceDate).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Customer:</Text>
                  <Text style={styles.metaVal}>{invoice.customer.name}</Text>
                </View>
              </View>

              {/* Trip Route Details */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>TRIP ROUTE & DETAILS</Text>
                <Text style={styles.routeItem}>
                  <Text style={styles.bold}>Pickup (Verified OTP): </Text>
                  {invoice.booking.actualPickupAddress || invoice.booking.pickupAddress}
                </Text>
                {invoice.booking.actualPickupAddress && invoice.booking.actualPickupAddress !== invoice.booking.pickupAddress ? (
                  <Text style={[styles.metaSmall, { marginBottom: 4, marginLeft: 2 }]}>
                    Booked: {invoice.booking.pickupAddress}
                  </Text>
                ) : null}

                <Text style={styles.routeItem}>
                  <Text style={styles.bold}>Drop (Final Reached): </Text>
                  {invoice.booking.actualDropAddress || invoice.booking.dropAddress}
                </Text>
                {invoice.booking.actualDropAddress && invoice.booking.actualDropAddress !== invoice.booking.dropAddress ? (
                  <Text style={[styles.metaSmall, { marginBottom: 4, marginLeft: 2 }]}>
                    Booked: {invoice.booking.dropAddress}
                  </Text>
                ) : null}

                <View style={styles.routeMetaRow}>
                  <Text style={styles.metaSmall}>
                    Distance: {invoice.booking.actualDistanceKm ?? invoice.booking.distanceKm} km
                  </Text>
                  <Text style={styles.metaSmall}>Type: {invoice.booking.tripType}</Text>
                </View>
              </View>

              {/* Financial Itemization */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>PRICE BREAKDOWN</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Pre-tax Ride Subtotal</Text>
                  <Text style={styles.rowVal}>₹{invoice.financials.preTaxSubtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>CGST (2.5%)</Text>
                  <Text style={styles.rowVal}>₹{invoice.financials.cgst.toFixed(2)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>SGST (2.5%)</Text>
                  <Text style={styles.rowVal}>₹{invoice.financials.sgst.toFixed(2)}</Text>
                </View>
                {invoice.financials.tollAmount > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Toll Charges</Text>
                    <Text style={styles.rowVal}>₹{invoice.financials.tollAmount.toFixed(2)}</Text>
                  </View>
                )}
                {invoice.financials.parkingAmount > 0 && (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Parking Charges</Text>
                    <Text style={styles.rowVal}>₹{invoice.financials.parkingAmount.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.row, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Tax-Inclusive Fare</Text>
                  <Text style={styles.totalVal}>₹{invoice.financials.totalFare.toFixed(2)}</Text>
                </View>
              </View>

              {/* Payment Settlement Status */}
              <View style={styles.paymentStatusCard}>
                <View style={styles.row}>
                  <Text style={styles.paidLabel}>Online Advance Paid (25%):</Text>
                  <Text style={styles.paidVal}>
                    ₹{invoice.financials.advancePaid.toFixed(2)} (PAID)
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.dueLabel}>Balance Payable on Trip (75%):</Text>
                  <Text style={styles.dueVal}>
                    ₹{invoice.financials.balanceDue.toFixed(2)} ({invoice.financials.balanceStatus})
                  </Text>
                </View>
              </View>

              <Text style={styles.footerNote}>
                This is a computer-generated tax invoice and requires no physical signature.
              </Text>
            </ScrollView>
          ) : null}

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Close Invoice</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgb(240, 117, 15)',
    letterSpacing: 1,
  },
  companyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
    marginTop: 1,
  },
  gstText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareBtn: {
    padding: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMessage: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 10,
    fontWeight: '600',
  },
  errorBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
  },
  body: {
    paddingTop: 14,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  metaCol: {
    width: '50%',
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    marginTop: 1,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  routeItem: {
    fontSize: 11,
    color: '#334155',
    marginBottom: 4,
    lineHeight: 16,
  },
  bold: {
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  routeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 4,
  },
  metaSmall: {
    fontSize: 10,
    color: '#64748b',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  rowLabel: {
    fontSize: 11,
    color: '#475569',
  },
  rowVal: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 6,
    paddingTop: 6,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
  },
  totalVal: {
    fontSize: 13,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  paymentStatusCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 12,
    marginBottom: 12,
  },
  paidLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  paidVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#065f46',
  },
  dueLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  dueVal: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgb(240, 117, 15)',
  },
  footerNote: {
    fontSize: 9,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 14,
  },
  doneBtn: {
    backgroundColor: 'rgb(22, 34, 50)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
