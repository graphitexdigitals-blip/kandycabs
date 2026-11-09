import React from 'react';
import { StyleSheet, View, Text, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface TripFlowHeaderProps {
  currentStep: 1 | 2 | 3 | 4; // 1: Pickup, 2: Odometer, 3: OTP, 4: Drop
  bookingRef?: string;
  statusLabel?: string;
}

export function TripFlowHeader({ currentStep }: TripFlowHeaderProps) {
  const insets = useSafeAreaInsets();
  // With non-translucent Android status bar, top inset is already accounted for by the OS
  const topPad = Platform.OS === 'android' ? 6 : Math.max(insets.top, 6);

  const steps = [
    { num: 1, label: 'Pickup', icon: 'location-sharp' as const },
    { num: 2, label: 'Odometer', icon: 'speedometer' as const },
    { num: 3, label: 'OTP', icon: 'key' as const },
    { num: 4, label: 'Drop', icon: 'flag' as const },
  ];

  return (
    <View style={[styles.headerContainer, { paddingTop: topPad }]}>
      {/* 4-Step Connected Progress Stepper Bar */}
      <View style={styles.stepperWrapper}>
        {steps.map((step, idx) => {
          const isCompleted = currentStep > step.num;
          const isActive = currentStep === step.num;
          const isPending = currentStep < step.num;

          return (
            <React.Fragment key={step.num}>
              {/* Step Circle & Label */}
              <View style={styles.stepNode}>
                <View
                  style={[
                    styles.stepCircle,
                    isCompleted && styles.circleCompleted,
                    isActive && styles.circleActive,
                    isPending && styles.circlePending,
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={15} color="#ffffff" style={styles.checkIcon} />
                  ) : isActive ? (
                    <Ionicons name={step.icon} size={14} color="#ffffff" />
                  ) : (
                    <Text style={styles.pendingNumText}>{step.num}</Text>
                  )}
                </View>

                <Text
                  style={[
                    styles.stepLabel,
                    isCompleted && styles.labelCompleted,
                    isActive && styles.labelActive,
                    isPending && styles.labelPending,
                  ]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
              </View>

              {/* Connecting Line between steps */}
              {idx < steps.length - 1 && (
                <View style={styles.lineContainer}>
                  <View
                    style={[
                      styles.line,
                      currentStep > idx + 1 ? styles.lineCompleted : styles.linePending,
                    ]}
                  />
                </View>
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  stepperWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  stepNode: {
    alignItems: 'center',
    width: 56,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  circleCompleted: {
    backgroundColor: '#ea580c',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  circleActive: {
    backgroundColor: '#ea580c',
    borderWidth: 2.5,
    borderColor: '#ffedd5',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  circlePending: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  checkIcon: {
    fontWeight: '900',
  },
  pendingNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  labelCompleted: {
    color: '#0f172a',
    fontWeight: '800',
  },
  labelActive: {
    color: '#ea580c',
    fontWeight: '900',
  },
  labelPending: {
    color: '#94a3b8',
  },
  lineContainer: {
    flex: 1,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  line: {
    width: '100%',
    height: 2.5,
    borderRadius: 1.5,
  },
  lineCompleted: {
    backgroundColor: '#ea580c',
  },
  linePending: {
    backgroundColor: '#e2e8f0',
  },
});

