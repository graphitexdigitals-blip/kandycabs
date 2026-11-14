import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AI_CALL_ASSISTANT_ICON = require('../assets/images/ai_call_assistant.png');

export function FloatingCallAssistant() {
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const handleCallKandyCabs = () => {
    setModalVisible(false);
    Linking.openURL('tel:+919900887777').catch(() => {});
  };

  const handleCallTechSupport = () => {
    setModalVisible(false);
    Linking.openURL('tel:+919187336058').catch(() => {});
  };

  const handleWhatsApp = () => {
    setModalVisible(false);
    Linking.openURL('https://wa.me/919008890090').catch(() => {});
  };

  const bottomOffset = Math.max(insets.bottom, 16) + 76;

  return (
    <>
      {/* Fixed WhatsApp AI Assistant Calling Icon (Floating Action Button) */}
      <View
        pointerEvents="box-none"
        style={[
          styles.fabContainer,
          { bottom: bottomOffset },
        ]}
      >
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.82}
          accessibilityLabel="Call Support Assistant"
          accessibilityRole="button"
        >
          <Image
            source={AI_CALL_ASSISTANT_ICON}
            style={styles.fabImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* Support Contact Info Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                {/* Drag Handle / Bar */}
                <View style={styles.dragHandle} />

                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.headerLeft}>
                    <Image
                      source={AI_CALL_ASSISTANT_ICON}
                      style={styles.headerAssistantIcon}
                      resizeMode="contain"
                    />
                    <View>
                      <Text style={styles.headerTitle}>Support & Helpline</Text>
                      <Text style={styles.headerSubtitle}>Tap to connect instantly</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setModalVisible(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {/* Support Option 1: Call KandyCabs */}
                <TouchableOpacity
                  style={styles.supportOptionCard}
                  onPress={handleCallKandyCabs}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionIconCircle, { backgroundColor: '#ecfdf5' }]}>
                    <Ionicons name="call" size={22} color="#059669" />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Call KandyCabs</Text>
                    <Text style={styles.optionSubtitle}>24/7 Helpline & Booking Assistance</Text>
                    <Text style={styles.optionPhone}>+91 99008 87777</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                </TouchableOpacity>

                {/* Support Option 2: Call Technical Support */}
                <TouchableOpacity
                  style={styles.supportOptionCard}
                  onPress={handleCallTechSupport}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionIconCircle, { backgroundColor: '#eff6ff' }]}>
                    <Ionicons name="build" size={20} color="#2563eb" />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Call Technical Support</Text>
                    <Text style={styles.optionSubtitle}>App, Payment & Customer Tech Help</Text>
                    <Text style={[styles.optionPhone, { color: '#2563eb' }]}>+91 91873 36058</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                </TouchableOpacity>

                {/* Support Option 3: WhatsApp Chat */}
                <TouchableOpacity
                  style={styles.supportOptionCard}
                  onPress={handleWhatsApp}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionIconCircle, { backgroundColor: '#f0fdf4' }]}>
                    <Ionicons name="logo-whatsapp" size={22} color="#16a34a" />
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text style={styles.optionTitle}>Chat on WhatsApp</Text>
                    <Text style={styles.optionSubtitle}>Instant WhatsApp Support</Text>
                    <Text style={[styles.optionPhone, { color: '#16a34a' }]}>+91 90088 90090</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    right: 14,
    zIndex: 99999,
    elevation: 10,
  },
  fabButton: {
    width: 52,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabImage: {
    width: 52,
    height: 62,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAssistantIcon: {
    width: 40,
    height: 48,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  optionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  optionSubtitle: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  optionPhone: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
    marginTop: 3,
  },
  cancelButton: {
    marginTop: 6,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
