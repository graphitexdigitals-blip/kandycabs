import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
          <Ionicons name="chevron-back" size={22} color="#103A75" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.headerStepSub} numberOfLines={2}>
            {subtitle ? subtitle : `Step ${currentStep} of 3${subStepLabel ? ` • ${subStepLabel}` : ''}`}
          </Text>
        </View>

        {rightElement ? rightElement : <View style={{ width: 36 }} />}
      </View>

      {/* 3-Step Progress Tracker */}
      <View style={styles.stepProgressBar}>
        {/* Step 1: Trip Details */}
        <TouchableOpacity
          style={styles.stepTrackItem}
          disabled={!step1Done || !onStep1Press}
          onPress={onStep1Press}
          activeOpacity={0.7}
        >
          <View style={step1Done || step1Active ? styles.stepDotActive : styles.stepDotInactive}>
            {step1Done ? (
              <Ionicons name="checkmark" size={13} color="#ffffff" />
            ) : (
              <Text style={styles.stepNumActive}>1</Text>
            )}
          </View>
          <Text style={step1Active || step1Done ? styles.stepNameActive : styles.stepNameInactive}>
            Trip Details
          </Text>
        </TouchableOpacity>

        {/* Connector 1 -> 2 */}
        <View style={step1Done ? styles.stepConnectorActive : styles.stepConnector} />

        {/* Step 2: Select Cab */}
        <TouchableOpacity
          style={styles.stepTrackItem}
          disabled={!step2Done || !onStep2Press}
          onPress={onStep2Press}
          activeOpacity={0.7}
        >
          <View
            style={
              step2Done || step2Active
                ? styles.stepDotActive
                : styles.stepDotInactive
            }
          >
            {step2Done ? (
              <Ionicons name="checkmark" size={13} color="#ffffff" />
            ) : (
              <Text style={step2Active ? styles.stepNumActive : styles.stepNumInactive}>2</Text>
            )}
          </View>
          <Text style={step2Active || step2Done ? styles.stepNameActive : styles.stepNameInactive}>
            Select Cab
          </Text>
        </TouchableOpacity>

        {/* Connector 2 -> 3 */}
        <View style={step2Done ? styles.stepConnectorActive : styles.stepConnector} />

        {/* Step 3: Confirm */}
        <TouchableOpacity
          style={styles.stepTrackItem}
          disabled={!onStep3Press}
          onPress={onStep3Press}
          activeOpacity={0.7}
        >
          <View
            style={
              step3Done || step3Active
                ? styles.stepDotActive
                : styles.stepDotInactive
            }
          >
            {step3Done ? (
              <Ionicons name="checkmark" size={13} color="#ffffff" />
            ) : (
              <Text style={step3Active ? styles.stepNumActive : styles.stepNumInactive}>3</Text>
            )}
          </View>
          <Text style={step3Active || step3Done ? styles.stepNameActive : styles.stepNameInactive}>
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
    fontSize: 16,
    fontWeight: '800',
    color: '#103A75',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  headerStepSub: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1.5,
    textAlign: 'center',
    lineHeight: 14.5,
  },
  stepProgressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
    paddingHorizontal: 4,
  },
  stepTrackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDotActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EE5C21',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumActive: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  stepNameActive: {
    fontSize: 12,
    fontWeight: '800',
    color: '#103A75',
  },
  stepDotInactive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumInactive: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  stepNameInactive: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94a3b8',
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
    backgroundColor: '#EE5C21',
    marginHorizontal: 8,
  },
});
