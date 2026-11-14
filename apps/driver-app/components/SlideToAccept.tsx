import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  PanResponder,
  ActivityIndicator,
  Platform,
  Vibration,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from './SafeLinearGradient';

interface SlideToAcceptProps {
  onAccept: () => void;
  isAccepting?: boolean;
  disabled?: boolean;
  title?: string;
  acceptingTitle?: string;
  fontSize?: number;
}

function formatSliderTitle(text: string): string {
  if (!text) return '';
  return text
    .replace(/^slide\s+(?:right\s+to|to|right\s*:?|:)\s*/i, '')
    .replace(/\b(?:slide\s+to|slide\s+right\s+to|slide\s+right)\b\s*/gi, '')
    .replace(/\(\s*slide\s+right\s*\)/gi, '')
    .trim();
}

export function SlideToAccept({
  onAccept,
  isAccepting = false,
  disabled = false,
  title = 'ACCEPT',
  acceptingTitle = 'ACCEPTING RIDE...',
  fontSize = 12,
}: SlideToAcceptProps) {
  const [trackWidth, setTrackWidth] = useState(300);
  const knobWidth = 44;
  const padding = 6;
  const maxSlide = Math.max(0, trackWidth - knobWidth - padding * 2);

  const pan = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const isAcceptedRef = useRef(false);

  // Keep latest mutable props in ref so PanResponder closures never go stale
  const latestRef = useRef({ onAccept, isAccepting, disabled, maxSlide });
  useEffect(() => {
    latestRef.current = { onAccept, isAccepting, disabled, maxSlide };
  });

  // Chevron pulsing shimmer animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  // Reset slider if accepting finished or cancelled
  useEffect(() => {
    if (!isAccepting && isAcceptedRef.current) {
      isAcceptedRef.current = false;
      Animated.spring(pan, {
        toValue: 0,
        friction: 6,
        tension: 50,
        useNativeDriver: false,
      }).start();
    }
  }, [isAccepting, pan]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !latestRef.current.disabled && !latestRef.current.isAccepting,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !latestRef.current.disabled && !latestRef.current.isAccepting && Math.abs(gesture.dx) > 3,
      onPanResponderGrant: () => {
        pan.setOffset(0);
      },
      onPanResponderMove: (_, gesture) => {
        if (latestRef.current.disabled || latestRef.current.isAccepting || isAcceptedRef.current) return;
        const newX = Math.max(0, Math.min(gesture.dx, latestRef.current.maxSlide));
        pan.setValue(newX);
      },
      onPanResponderRelease: (_, gesture) => {
        if (latestRef.current.disabled || latestRef.current.isAccepting || isAcceptedRef.current) return;
        const currentX = Math.max(0, gesture.dx);
        const curMaxSlide = latestRef.current.maxSlide;

        // Threshold: 65% of track width
        if (currentX >= curMaxSlide * 0.65) {
          isAcceptedRef.current = true;
          Animated.timing(pan, {
            toValue: curMaxSlide,
            duration: 120,
            useNativeDriver: false,
          }).start(() => {
            if (Platform.OS !== 'web') {
              try {
                Vibration.vibrate(40);
              } catch {}
            }
            latestRef.current.onAccept();
          });
        } else {
          // Snap back to start
          Animated.spring(pan, {
            toValue: 0,
            friction: 7,
            tension: 60,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (!isAcceptedRef.current) {
          Animated.spring(pan, {
            toValue: 0,
            friction: 7,
            tension: 60,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // Fade out track text as the knob slides over it
  const textOpacity = pan.interpolate({
    inputRange: [0, Math.max(1, maxSlide * 0.6)],
    outputRange: [1, 0.05],
    extrapolate: 'clamp',
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - trackWidth) > 2) {
          setTrackWidth(w);
        }
      }}
    >
      {disabled ? (
        <TouchableOpacity
          style={[styles.track, styles.trackDisabled]}
          activeOpacity={0.85}
          onPress={() => {
            Alert.alert(
              'Trip in Progress',
              'You already have an active trip. Please complete your ongoing trip before starting or accepting another ride.'
            );
          }}
        >
          <View style={[styles.textWrapper, { paddingLeft: 30, justifyContent: 'center' }]}>
            <Ionicons name="lock-closed" size={14} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={styles.trackTextDisabled} numberOfLines={1}>{formatSliderTitle(title)}</Text>
          </View>
          <View style={[styles.knob, styles.knobDisabled]}>
            <Ionicons name="lock-closed" size={20} color="#64748b" />
          </View>
        </TouchableOpacity>
      ) : (
        /* Gradient Pill Track */
        <View style={styles.trackShadowContainer}>
          <LinearGradient
            colors={
              isAccepting
                ? ['#059669', '#047857']
                : ['#10b981', '#059669']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.trackGradient,
              isAccepting && styles.trackAccepting,
            ]}
          >
            {/* Animated Center Text & Chevrons */}
            <Animated.View style={[styles.textWrapper, { opacity: isAccepting ? 0.3 : textOpacity }]}>
              <Text style={[styles.trackText, fontSize ? { fontSize } : null]}>{isAccepting ? acceptingTitle : formatSliderTitle(title)}</Text>
              {!isAccepting && (
                <Animated.View
                  style={[
                    styles.chevronsRow,
                    { transform: [{ translateX: shimmerTranslate }] },
                  ]}
                >
                  <Ionicons name="chevron-forward" size={15} color="#a7f3d0" style={{ opacity: 0.55 }} />
                  <Ionicons name="chevron-forward" size={15} color="#d1fae5" style={{ opacity: 0.8, marginLeft: -7 }} />
                  <Ionicons name="chevron-forward" size={15} color="#ffffff" style={{ marginLeft: -7 }} />
                </Animated.View>
              )}
            </Animated.View>

            {/* Sliding White Circular Knob with Green Arrow */}
            <Animated.View
              style={[
                styles.knob,
                {
                  transform: [{ translateX: pan }],
                },
              ]}
              {...panResponder.panHandlers}
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color="#0c9035" />
              ) : (
                <View style={styles.knobInner}>
                  <Ionicons name="arrow-forward" size={24} color="#0c9035" />
                </View>
              )}
            </Animated.View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  trackShadowContainer: {
    width: '100%',
    borderRadius: 28,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  trackGradient: {
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 6,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#059669',
  },
  track: {
    height: 56,
    backgroundColor: '#059669',
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 6,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#34d399',
  },
  trackAccepting: {
    backgroundColor: '#047857',
    borderColor: '#059669',
  },
  trackDisabled: {
    backgroundColor: '#64748b',
    borderColor: '#94a3b8',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
  },
  textWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 56,
    paddingRight: 16,
    gap: 6,
  },
  trackText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  trackTextDisabled: {
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  chevronsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  knob: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  knobDisabled: {
    backgroundColor: '#f1f5f9',
  },
  knobInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
