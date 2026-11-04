import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { APP_FONT } from '../constants/typography';

export interface BookingFlowHeaderProps {
  currentStep: 1 | 2 | 3;
  title: string;
  subStepLabel?: string;
  subtitle?: string;
  topInset?: number;
  isConfirmed?: boolean;
  step3Label?: string;
  onBack: () => void;
  onStep1Press?: () => void;
  onStep2Press?: () => void;
  onStep3Press?: () => void;
  rightElement?: React.ReactNode;
}

export default function BookingFlowHeader({
  currentStep,
  title,
  subStepLabel,
  subtitle,
  topInset = 0,
  isConfirmed = false,
  step3Label,
  onBack,
  onStep1Press,
  onStep2Press,
  onStep3Press,
  rightElement,
}: BookingFlowHeaderProps) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const isSmallDevice = windowWidth < 380;

  const step1Done = currentStep > 1;
  const step1Active = currentStep === 1;

  const step2Done = currentStep > 2;
  const step2Active = currentStep === 2;

  const step3Active = currentStep === 3;
  const step3Done = isConfirmed;

  return (
    <View style={[styles.headerContainer, { paddingTop: topInset + 6 }]}>
      {/* Top Header Row */}
      <View style={styles.headerTopRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={22} color="rgb(22, 34, 50)" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text
            style={[styles.headerTitle, isSmallDevice && styles.headerTitleSmall]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.8}
          >
            {title}
          </Text>
          <Text style={[styles.headerStepSub, isSmallDevice && styles.headerStepSubSmall]} numberOfLines={2}>
            {subtitle ? subtitle : `Step ${currentStep} of 3${subStepLabel ? ` • ${subStepLabel}` : ''}`}
          </Text>
        </View>

        {rightElement ? rightElement : <View style={{ width: isSmallDevice ? 28 : 36 }} />}
      </View>

      {/* 3-Step Progress Tracker */}
      <View style={[styles.stepProgressBar, isSmallDevice && styles.stepProgressBarSmall]}>
        {/* Step 1: Trip Details */}
        <TouchableOpacity
          style={[styles.stepTrackItem, isSmallDevice && styles.stepTrackItemSmall]}
          disabled={!step1Done || !onStep1Press}
          onPress={onStep1Press}
          activeOpacity={0.7}
        >
          <View
            style={[
              step1Done || step1Active ? styles.stepDotActive : styles.stepDotInactive,
              isSmallDevice && styles.stepDotSmall,
            ]}
          >
            {step1Done ? (
              <Ionicons name="checkmark" size={isSmallDevice ? 12 : 14} color="#ffffff" />
            ) : (
              <Text style={[styles.stepNumActive, isSmallDevice && styles.stepNumSmall]}>1</Text>
            )}
          </View>
          <Text
            style={[
              step1Active || step1Done ? styles.stepNameActive : styles.stepNameInactive,
              isSmallDevice && styles.stepNameSmall,
            ]}
            numberOfLines={1}
          >
            Trip Details
          </Text>
        </TouchableOpacity>

        {/* Connector 1 -> 2 */}
        <View
          style={[
            step1Done ? styles.stepConnectorActive : styles.stepConnector,
            isSmallDevice && styles.stepConnectorSmall,
          ]}
        />

        {/* Step 2: Select Cab */}
        <TouchableOpacity
          style={[styles.stepTrackItem, isSmallDevice && styles.stepTrackItemSmall]}
          disabled={!step2Done || !onStep2Press}
          onPress={onStep2Press}
          activeOpacity={0.7}
        >
          <View
            style={[
              step2Done || step2Active ? styles.stepDotActive : styles.stepDotInactive,
              isSmallDevice && styles.stepDotSmall,
            ]}
          >
            {step2Done ? (
              <Ionicons name="checkmark" size={isSmallDevice ? 12 : 14} color="#ffffff" />
            ) : (
              <Text style={[step2Active ? styles.stepNumActive : styles.stepNumInactive, isSmallDevice && styles.stepNumSmall]}>2</Text>
            )}
          </View>
          <Text
            style={[
              step2Active || step2Done ? styles.stepNameActive : styles.stepNameInactive,
              isSmallDevice && styles.stepNameSmall,
            ]}
            numberOfLines={1}
          >
            Select Cab
          </Text>
        </TouchableOpacity>

        {/* Connector 2 -> 3 */}
        <View
          style={[
            step2Done ? styles.stepConnectorActive : styles.stepConnector,
            isSmallDevice && styles.stepConnectorSmall,
          ]}
        />

        {/* Step 3: Confirm */}
        <TouchableOpacity
          style={[styles.stepTrackItem, isSmallDevice && styles.stepTrackItemSmall]}
          disabled={!onStep3Press}
          onPress={onStep3Press}
          activeOpacity={0.7}
        >
          <View
            style={[
              step3Done || step3Active ? styles.stepDotActive : styles.stepDotInactive,
              isSmallDevice && styles.stepDotSmall,
            ]}
          >
            {step3Done ? (
              <Ionicons name="checkmark" size={isSmallDevice ? 11 : 13} color="#ffffff" />
            ) : (
              <Text style={[step3Active ? styles.stepNumActive : styles.stepNumInactive, isSmallDevice && styles.stepNumSmall]}>3</Text>
            )}
          </View>
          <Text
            style={[
              step3Active || step3Done ? styles.stepNameActive : styles.stepNameInactive,
              isSmallDevice && styles.stepNameSmall,
            ]}
            numberOfLines={1}
          >
            {step3Label || 'Confirm'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontFamily: APP_FONT,
    fontSize: 16.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  headerTitleSmall: {
    fontSize: 15,
    lineHeight: 19,
  },
  headerStepSub: {
    fontFamily: APP_FONT,
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 16,
  },
  headerStepSubSmall: {
    fontSize: 11,
    lineHeight: 14,
  },
  stepProgressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  stepProgressBarSmall: {
    marginTop: 6,
    paddingHorizontal: 2,
  },
  stepTrackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepTrackItemSmall: {
    gap: 3.5,
  },
  stepDotActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgb(240, 117, 15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumActive: {
    fontFamily: APP_FONT,
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  stepNameActive: {
    fontFamily: APP_FONT,
    fontSize: 13.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  stepDotInactive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumInactive: {
    fontFamily: APP_FONT,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  stepNameInactive: {
    fontFamily: APP_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  stepDotSmall: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
  },
  stepNumSmall: {
    fontSize: 10,
  },
  stepNameSmall: {
    fontSize: 11,
    letterSpacing: -0.2,
  },
  stepConnector: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  stepConnectorActive: {
    flex: 1,
    height: 1.5,
    backgroundColor: 'rgb(240, 117, 15)',
    marginHorizontal: 8,
  },
  stepConnectorSmall: {
    marginHorizontal: 4,
  },
});
