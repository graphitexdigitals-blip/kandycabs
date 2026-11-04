import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BackgroundProtectionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BackgroundProtectionModal({ visible, onClose }: BackgroundProtectionModalProps) {
  const handleOpenSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (_) {}
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark" size={28} color="#008860" />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Stay Online in Background</Text>
              <Text style={styles.subtitle}>Keep GPS & ride alerts active at all times</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.introText}>
              To ensure you receive direct Admin bookings and stay tracked when your screen is locked or while using Google Maps:
            </Text>

            {/* Step 1: Lock in Recent Apps */}
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepTitle}>Lock App in Recent Apps (🔒)</Text>
              </View>
              <Text style={styles.stepDesc}>
                Open your phone's Recent Apps screen, drag down on <Text style={styles.boldText}>Kandy Cabs</Text> or tap the 3 dots, and select the <Text style={styles.boldText}>Lock 🔒</Text> icon.
              </Text>
              <View style={styles.highlightBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#008860" />
                <Text style={styles.highlightText}>Prevents 'Clear All' from closing Kandy Cabs</Text>
              </View>
            </View>

            {/* Step 2: Battery Whitelist */}
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepTitle}>Allow Background Battery Usage</Text>
              </View>
              <Text style={styles.stepDesc}>
                Set Battery Optimization to <Text style={styles.boldText}>"Allow high background battery usage"</Text> or <Text style={styles.boldText}>"Unrestricted"</Text>.
              </Text>
              <View style={styles.highlightBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#008860" />
                <Text style={styles.highlightText}>Prevents the phone from putting GPS to sleep</Text>
              </View>
            </View>

            {/* Step 3: Autostart */}
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepTitle}>Enable Autostart (Vivo / Xiaomi / Oppo)</Text>
              </View>
              <Text style={styles.stepDesc}>
                In your phone's App Management or iManager, enable <Text style={styles.boldText}>Autostart</Text> for Kandy Cabs Driver.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.settingsBtn} onPress={handleOpenSettings}>
              <Ionicons name="settings-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.settingsBtnText}>Open Phone Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>I've Done This (Got It)</Text>
            </TouchableOpacity>
          </View>
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
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e6f4f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  introText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  stepCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#162232',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
  },
  stepDesc: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 6,
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f4f0',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  highlightText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#008860',
    marginLeft: 5,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  settingsBtn: {
    flexDirection: 'row',
    backgroundColor: '#008860',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
});

