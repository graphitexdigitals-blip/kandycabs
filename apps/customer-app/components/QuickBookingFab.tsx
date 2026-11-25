import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Linking,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';

const BUTTON_WIDTH = 54;
const BUTTON_HEIGHT = 54;
const CARD_WIDTH = 220;

const WHATSAPP_NUMBER = '919008890090';
const HELPLINE_PHONE = '+919900887777';
const TECH_SUPPORT_PHONE = '+919187336058';

export function QuickBookingFab() {
  const pathname = usePathname();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);

  // Screen Bounds
  const minX = 10;
  const maxX = Math.max(10, screenWidth - BUTTON_WIDTH - 10);
  const minY = insets.top + 50;
  const maxY = screenHeight - Math.max(insets.bottom, 16) - 120;

  // Default Position: aligned exactly straight in line with "+ Add a Stop" pill
  const initialDefaultY = Math.min(maxY, Math.max(minY, (insets.top || 30) + 233));
  const initialDefaultX = maxX;

  // Track position using Animated.ValueXY and a ref
  const pan = useRef(new Animated.ValueXY({ x: initialDefaultX, y: initialDefaultY })).current;
  const currentPos = useRef({ x: initialDefaultX, y: initialDefaultY });
  const isDragging = useRef(false);
  const isInitialMount = useRef(true);

  // Pulse animation for the Quick Booking badge
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.07,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => {
      pulse.stop();
    };
  }, [pulseAnim]);

  // Keep within bounds on dimension change, setting exact "+ Add a Stop" row on mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const exactY = Math.min(maxY, Math.max(minY, (insets.top || 30) + 233));
      const exactX = maxX;
      currentPos.current = { x: exactX, y: exactY };
      pan.setValue({ x: exactX, y: exactY });
      return;
    }
    const clampedX = Math.min(Math.max(currentPos.current.x, minX), maxX);
    const clampedY = Math.min(Math.max(currentPos.current.y, minY), maxY);
    currentPos.current = { x: clampedX, y: clampedY };
    pan.setValue({ x: clampedX, y: clampedY });
  }, [screenWidth, screenHeight, insets, minX, maxX, minY, maxY, pan]);

  // PanResponder handles smooth drag and snaps to left or right edge
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.hypot(gestureState.dx, gestureState.dy) > 4;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.hypot(gestureState.dx, gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        isDragging.current = true;
        pan.setOffset({
          x: currentPos.current.x,
          y: currentPos.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        setTimeout(() => {
          isDragging.current = false;
        }, 80);

        const rawX = currentPos.current.x + gestureState.dx;
        const rawY = currentPos.current.y + gestureState.dy;

        // Clamp Y within screen bounds
        const finalY = Math.min(Math.max(rawY, minY), maxY);

        // Snap smoothly to nearest horizontal edge (left or right)
        const finalX = rawX < screenWidth / 2 ? minX : maxX;

        currentPos.current = { x: finalX, y: finalY };

        Animated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          friction: 7,
          tension: 45,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  // Only show Quick Book on Home screen (hidden on My Bookings, Support, Profile, and all other screens)
  const isAllowedScreen = (() => {
    if (!pathname) return false;
    const clean = pathname.split('?')[0].replace(/\/$/, '') || '/';
    return clean === '/' || clean === '/index';
  })();

  if (!isAllowedScreen) {
    return null;
  }

  const isHidden = false;

  const handleWhatsAppBooking = () => {
    setModalVisible(false);
    const msg = encodeURIComponent(
      'Hello Kandy Cabs! 🚖 I would like to book a cab. Please share the fare quote and vehicle options.'
    );
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`).catch(() => {});
  };

  const handleCallToBook = () => {
    setModalVisible(false);
    Linking.openURL(`tel:${HELPLINE_PHONE}`).catch(() => {});
  };

  const handleCallAppSupport = () => {
    setModalVisible(false);
    Linking.openURL(`tel:${TECH_SUPPORT_PHONE}`).catch(() => {});
  };

  const isRightSide = currentPos.current.x > screenWidth / 2;
  const isBottomHalf = currentPos.current.y > screenHeight / 2;

  // Calculate card popover coordinates
  const cardStyle: any = {
    position: 'absolute',
  };

  if (isBottomHalf) {
    cardStyle.bottom = Math.max(20, screenHeight - currentPos.current.y + 6);
  } else {
    cardStyle.top = Math.max(insets.top + 10, currentPos.current.y + BUTTON_HEIGHT + 6);
  }

  if (isRightSide) {
    cardStyle.right = Math.max(10, screenWidth - (currentPos.current.x + BUTTON_WIDTH));
  } else {
    cardStyle.left = Math.max(10, currentPos.current.x);
  }

  return (
    <>
      {/* Movable Floating Quick Booking Button */}
      <Animated.View
        {...panResponder.panHandlers}
        pointerEvents={isHidden ? 'none' : 'auto'}
        style={[
          styles.movableFab,
          pan.getLayout(),
          {
            opacity: isHidden ? 0 : 1,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => {
            if (!isDragging.current) {
              setModalVisible(true);
            }
          }}
          style={styles.touchArea}
        >
          <Animated.View style={[styles.fabBadge, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.cleanWhatsappBtn}>
              <Ionicons name="logo-whatsapp" size={32} color="#ffffff" />
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      {/* Small Reference Card Popover Modal */}
      <Modal
        visible={modalVisible && !isHidden}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={[styles.smallCardWrapper, cardStyle]}>
            <TouchableOpacity
              activeOpacity={1}
              style={styles.smallCard}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Pointer Tip Arrow pointing towards FAB */}
              <View
                style={[
                  styles.pointerTip,
                  isBottomHalf ? styles.pointerTipBottom : styles.pointerTipTop,
                  isRightSide ? styles.pointerTipRight : styles.pointerTipLeft,
                ]}
              />

              {/* Row 1: WhatsApp KandyCabs */}
              <TouchableOpacity
                style={styles.cardRow}
                onPress={handleWhatsAppBooking}
                activeOpacity={0.75}
              >
                <Ionicons name="logo-whatsapp" size={24} color="#25D366" style={styles.btnIcon} />
                <Text style={styles.btnText}>WhatsApp KandyCabs</Text>
              </TouchableOpacity>

              {/* Thin Divider Line */}
              <View style={styles.cardDivider} />

              {/* Row 2: Call KandyCabs */}
              <TouchableOpacity
                style={styles.cardRow}
                onPress={handleCallToBook}
                activeOpacity={0.75}
              >
                <Ionicons name="call" size={20} color="#0f172a" style={styles.btnIcon} />
                <Text style={styles.btnText}>Call KandyCabs</Text>
              </TouchableOpacity>

              {/* Thin Divider Line */}
              <View style={styles.cardDivider} />

              {/* Row 3: Call App Support */}
              <TouchableOpacity
                style={styles.cardRow}
                onPress={handleCallAppSupport}
                activeOpacity={0.75}
              >
                <Ionicons name="headset" size={20} color="#2563eb" style={styles.btnIcon} />
                <Text style={styles.btnText}>Call App Support</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  movableFab: {
    position: 'absolute',
    zIndex: 999999,
    elevation: 20,
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
  },
  touchArea: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBadge: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanWhatsappBtn: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_WIDTH / 2,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },

  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },

  smallCardWrapper: {
    width: CARD_WIDTH,
    zIndex: 1000000,
  },

  // Small Reference Card
  smallCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 4,
    paddingHorizontal: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  // Pointer Tip
  pointerTip: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    transform: [{ rotate: '45deg' }],
    zIndex: 1,
  },
  pointerTipBottom: {
    bottom: -7,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
  },
  pointerTipTop: {
    top: -7,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
  },
  pointerTipRight: {
    right: 20,
  },
  pointerTipLeft: {
    left: 20,
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 10,
  },
  btnIcon: {
    marginRight: 10,
  },
  btnText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
