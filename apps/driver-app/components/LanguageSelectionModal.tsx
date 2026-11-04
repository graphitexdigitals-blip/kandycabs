import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  AppLanguage,
  changeAppLanguage,
  getPersistedLanguage,
} from '../lib/i18n';

interface LanguageSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onLanguageSelected?: (lang: AppLanguage) => void;
}

export function LanguageSelectionModal({
  visible,
  onClose,
  onLanguageSelected,
}: LanguageSelectionModalProps) {
  const { i18n, t } = useTranslation();
  const [selectedLang, setSelectedLang] = useState<AppLanguage>(
    (i18n.language as AppLanguage) || 'en'
  );

  useEffect(() => {
    if (visible) {
      getPersistedLanguage().then((curr) => {
        setSelectedLang(curr);
      });
    }
  }, [visible]);

  const handleSelectRadio = (code: AppLanguage) => {
    setSelectedLang(code);
  };

  const handleConfirm = () => {
    const targetT = i18n.getFixedT(selectedLang);
    const targetLangMeta = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang);
    const targetName = targetT(`common.langName_${selectedLang}`, {
      defaultValue: targetLangMeta?.nativeLabel || targetLangMeta?.label || selectedLang,
    });

    Alert.alert(
      targetT('common.changeLanguageConfirmTitle', { defaultValue: 'Change Language' }),
      targetT('common.changeLanguageConfirmMsg', {
        defaultValue: `Are you sure you want to change the language to ${targetName}?`,
        language: targetName,
      }),
      [
        {
          text: targetT('common.cancel', { defaultValue: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: targetT('common.confirm', { defaultValue: 'Confirm' }),
          onPress: async () => {
            await changeAppLanguage(selectedLang);
            if (onLanguageSelected) {
              onLanguageSelected(selectedLang);
            }
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetContainer}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIconBox}>
                    <Ionicons name="globe-outline" size={22} color="rgb(240, 117, 15)" />
                  </View>
                  <View>
                    <Text style={styles.headerTitle}>{t('common.chooseLanguage')}</Text>
                    <Text style={styles.headerSubtitle}>
                      {selectedLang === 'kn'
                        ? 'ಅಪ್ಲಿಕೇಶನ್‌ನ ಆದ್ಯತೆಯ ಭಾಷೆಯನ್ನು ಆರಿಸಿ'
                        : selectedLang === 'hi'
                        ? 'ऐप की पसंदीदा भाषा चुनें'
                        : 'Choose your preferred app language'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Single Grouped Language Container */}
              <View style={styles.groupContainer}>
                {SUPPORTED_LANGUAGES.map((item, index) => {
                  const isSelected = selectedLang === item.code;
                  const isLast = index === SUPPORTED_LANGUAGES.length - 1;
                  return (
                    <React.Fragment key={item.code}>
                      <TouchableOpacity
                        style={[
                          styles.langItemRow,
                          isSelected && styles.langItemRowSelected,
                        ]}
                        onPress={() => handleSelectRadio(item.code)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.langCardLeft}>
                          <View
                            style={[
                              styles.langBadge,
                              isSelected && styles.langBadgeSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.langBadgeText,
                                isSelected && styles.langBadgeTextSelected,
                              ]}
                            >
                              {item.badge || item.code.toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.langTextCol}>
                            <Text
                              style={[
                                styles.langNativeTitle,
                                isSelected && styles.langNativeTitleSelected,
                              ]}
                            >
                              {item.nativeLabel}
                            </Text>
                            {item.nativeLabel.toLowerCase() !== item.label.toLowerCase() && (
                              <Text style={styles.langSublabel}>
                                {item.label}
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Radio Selection Checkmark */}
                        <View
                          style={[
                            styles.radioCircle,
                            isSelected && styles.radioCircleSelected,
                          ]}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color="#ffffff" />
                          )}
                        </View>
                      </TouchableOpacity>

                      {/* Divider Separator between languages */}
                      {!isLast && <View style={styles.langSeparator} />}
                    </React.Fragment>
                  );
                })}
              </View>

              {/* Confirm Language Button */}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnText}>
                  {t('common.confirmLanguage', { defaultValue: 'Confirm Language' })}
                </Text>
                <Ionicons name="arrow-forward" size={17} color="#ffffff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 420,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#0f2744',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
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
  groupContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  langItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  langItemRowSelected: {
    backgroundColor: '#f8fafc',
  },
  langSeparator: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 62,
  },
  langCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  langBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBadgeSelected: {
    backgroundColor: 'rgb(240, 117, 15)',
  },
  langBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  langBadgeTextSelected: {
    color: '#ffffff',
  },
  langTextCol: {
    flex: 1,
  },
  langNativeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2744',
  },
  langNativeTitleSelected: {
    color: 'rgb(240, 117, 15)',
  },
  langSublabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1.5,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  radioCircleSelected: {
    borderColor: 'rgb(240, 117, 15)',
    backgroundColor: 'rgb(240, 117, 15)',
  },
  confirmBtn: {
    marginTop: 18,
    backgroundColor: 'rgb(240, 117, 15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: 'rgb(240, 117, 15)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

