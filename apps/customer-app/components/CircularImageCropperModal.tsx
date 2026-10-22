import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  PanResponder,
  ActivityIndicator,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Circular crop cutout diameter
const CIRCLE_DIAMETER = Math.min(Math.round(SCREEN_WIDTH * 0.78), 310);
const CIRCLE_RADIUS = CIRCLE_DIAMETER / 2;

// The border thickness around the circular window
const MASK_BORDER_THICKNESS = 1200;

interface CircularImageCropperModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onSave: (croppedUri: string, base64?: string) => Promise<void> | void;
  onChangeImage: () => void;
}

export function CircularImageCropperModal({
  visible,
  imageUri,
  onClose,
  onSave,
  onChangeImage,
}: CircularImageCropperModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0);

  // Original image natural dimensions
  const [origSize, setOrigSize] = useState<{ width: number; height: number } | null>(null);

  // Transform states
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Live refs for smooth gestures
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const minScaleRef = useRef(1);
  const origSizeRef = useRef<{ width: number; height: number } | null>(null);

  panRef.current = pan;
  scaleRef.current = scale;
  minScaleRef.current = minScale;
  origSizeRef.current = origSize;

  // Multi-touch pinch & pan tracking
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset and calculate natural bounds when imageUri changes
  useEffect(() => {
    if (!imageUri || !visible) return;

    Image.getSize(
      imageUri,
      (w, h) => {
        setOrigSize({ width: w, height: h });
        // Scale so image covers the circle cutout completely
        const calculatedMin = Math.max(CIRCLE_DIAMETER / w, CIRCLE_DIAMETER / h);
        const initialScale = calculatedMin * 1.08;
        setMinScale(calculatedMin);
        setScale(initialScale);
        setPan({ x: 0, y: 0 });
      },
      (err) => {
        console.warn('[Cropper] Image.getSize error:', err);
        // Fallback default aspect ratio
        const fallbackMin = 1;
        setOrigSize({ width: 1000, height: 1000 });
        setMinScale(fallbackMin);
        setScale(fallbackMin);
        setPan({ x: 0, y: 0 });
      }
    );
  }, [imageUri, visible]);

  // Handle Pan and Pinch Gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return Math.abs(gestureState.dx) > 1 || Math.abs(gestureState.dy) > 1;
      },
      onPanResponderGrant: (evt) => {
        panStartRef.current = { ...panRef.current };
        if (evt.nativeEvent.touches.length === 2) {
          const t0 = evt.nativeEvent.touches[0];
          const t1 = evt.nativeEvent.touches[1];
          pinchStartDistRef.current = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
          pinchStartScaleRef.current = scaleRef.current;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 2) {
          // Pinch to Zoom
          if (pinchStartDistRef.current) {
            const t0 = evt.nativeEvent.touches[0];
            const t1 = evt.nativeEvent.touches[1];
            const currentDist = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
            const factor = currentDist / pinchStartDistRef.current;
            const newScale = Math.min(
              Math.max(pinchStartScaleRef.current * factor, minScaleRef.current * 0.7),
              minScaleRef.current * 4.5
            );
            setScale(newScale);
          }
        } else if (evt.nativeEvent.touches.length === 1) {
          // Single finger Pan / Drag
          const newX = panStartRef.current.x + gestureState.dx;
          const newY = panStartRef.current.y + gestureState.dy;
          setPan({ x: newX, y: newY });
        }
      },
      onPanResponderRelease: () => {
        pinchStartDistRef.current = null;
        panStartRef.current = { ...panRef.current };
      },
      onPanResponderTerminate: () => {
        pinchStartDistRef.current = null;
        panStartRef.current = { ...panRef.current };
      },
    })
  ).current;

  // Zoom Button Handlers (+ / -)
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev * 1.18, minScaleRef.current * 4.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev / 1.18, minScaleRef.current * 0.75));
  }, []);

  // Confirm Crop and Save
  const handleConfirmCrop = async () => {
    if (!imageUri || !origSize || isProcessing) return;

    setIsProcessing(true);
    try {
      const origW = origSize.width;
      const origH = origSize.height;
      const currentScale = scale;

      // Current displayed dimensions of the image
      const dispW = origW * currentScale;
      const dispH = origH * currentScale;

      // Center offset calculation:
      // When pan = (0, 0), the image center is aligned with the circular hole center.
      // Crop rectangle bounds relative to image top-left:
      const relX = -pan.x + (dispW - CIRCLE_DIAMETER) / 2;
      const relY = -pan.y + (dispH - CIRCLE_DIAMETER) / 2;

      // Convert from displayed pixels to original image pixels:
      let originX = Math.round(relX / currentScale);
      let originY = Math.round(relY / currentScale);
      let cropSize = Math.round(CIRCLE_DIAMETER / currentScale);

      // Clamp to original image bounds
      if (originX < 0) originX = 0;
      if (originY < 0) originY = 0;
      if (originX + cropSize > origW) {
        cropSize = origW - originX;
      }
      if (originY + cropSize > origH) {
        cropSize = origH - originY;
      }

      // Ensure square aspect ratio
      const finalSize = Math.max(10, Math.min(cropSize, origW - originX, origH - originY));

      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.max(0, originX),
              originY: Math.max(0, originY),
              width: finalSize,
              height: finalSize,
            },
          },
          {
            resize: {
              width: 360,
              height: 360,
            },
          },
        ],
        {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      await onSave(manipResult.uri, manipResult.base64);
      onClose();
    } catch (err: any) {
      console.error('[Cropper] Crop error:', err);
      Alert.alert('Crop Error', err?.message || 'Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!visible || !imageUri) return null;

  const currentDispW = origSize ? origSize.width * scale : CIRCLE_DIAMETER;
  const currentDispH = origSize ? origSize.height * scale : CIRCLE_DIAMETER;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

        {/* Top Header Bar matching reference image */}
        <View style={[styles.header, { paddingTop: topInset + 6 }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Drag the image to adjust
          </Text>

          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={onChangeImage}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-undo-outline" size={17} color="#ffffff" style={styles.uploadIcon} />
            <Text style={styles.uploadBtnText}>Upload</Text>
          </TouchableOpacity>
        </View>

        {/* Interactive Viewport Area */}
        <View style={styles.viewport}>
          {/* Pan & Pinch Gesture Surface */}
          <View
            style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}
            {...panResponder.panHandlers}
          >
            {/* Moving & Scaling Image */}
            <View
              style={[
                styles.imageContainer,
                {
                  width: currentDispW,
                  height: currentDispH,
                  transform: [{ translateX: pan.x }, { translateY: pan.y }],
                },
              ]}
            >
              <Image
                source={{ uri: imageUri }}
                style={{ width: currentDispW, height: currentDispH }}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Circular Cutout Window Overlay (Dark backdrop outside circle) */}
          <View pointerEvents="none" style={styles.maskContainer}>
            <View
              style={[
                styles.circularCutout,
                {
                  width: CIRCLE_DIAMETER + MASK_BORDER_THICKNESS * 2,
                  height: CIRCLE_DIAMETER + MASK_BORDER_THICKNESS * 2,
                  borderRadius: (CIRCLE_DIAMETER + MASK_BORDER_THICKNESS * 2) / 2,
                  borderWidth: MASK_BORDER_THICKNESS,
                },
              ]}
            />
            {/* White Ring Outline */}
            <View
              style={[
                styles.whiteRing,
                {
                  width: CIRCLE_DIAMETER,
                  height: CIRCLE_DIAMETER,
                  borderRadius: CIRCLE_RADIUS,
                },
              ]}
            />
          </View>

          {/* Right Floating Zoom Pill [+ | -] matching reference image */}
          <View style={styles.zoomPill}>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={handleZoomIn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add" size={22} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.zoomDivider} />

            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={handleZoomOut}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="remove" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Floating Green Confirmation Button matching reference image */}
          <TouchableOpacity
            style={[styles.floatingCheckBtn, isProcessing && styles.checkBtnDisabled]}
            onPress={handleConfirmCrop}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="checkmark" size={32} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    zIndex: 20,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 8,
    letterSpacing: -0.2,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    gap: 4,
  },
  uploadIcon: {
    transform: [{ rotate: '90deg' }],
  },
  uploadBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  viewport: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maskContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  circularCutout: {
    borderColor: 'rgba(0, 0, 0, 0.72)',
    backgroundColor: 'transparent',
  },
  whiteRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    backgroundColor: 'transparent',
  },
  zoomPill: {
    position: 'absolute',
    right: 18,
    top: '42%',
    backgroundColor: 'rgba(28, 28, 30, 0.88)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 5,
    zIndex: 50,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 5,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  zoomBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    width: 18,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    marginVertical: 4,
  },
  floatingCheckBtn: {
    position: 'absolute',
    right: 22,
    bottom: 30,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    ...Platform.select({
      ios: {
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  checkBtnDisabled: {
    opacity: 0.7,
  },
});
