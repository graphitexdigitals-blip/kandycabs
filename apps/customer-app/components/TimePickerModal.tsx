import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (timeString: string) => void;
  currentTime?: string;
  selectedDate?: string;
  minTime?: string;
  title?: string;
}

export function isDateToday(dateStr?: string): boolean {
  if (!dateStr) return true;
  const str = dateStr.trim().toLowerCase();
  if (str === 'today') return true;

  const now = new Date();
  const d = now.getDate();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();

  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return Number(parts[0]) === y && Number(parts[1]) === m && Number(parts[2]) === d;
      } else {
        // DD-MM-YYYY
        return Number(parts[0]) === d && Number(parts[1]) === m && Number(parts[2]) === y;
      }
    }
  }

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        return Number(parts[0]) === y && Number(parts[1]) === m && Number(parts[2]) === d;
      } else {
        // DD/MM/YYYY
        return Number(parts[0]) === d && Number(parts[1]) === m && Number(parts[2]) === y;
      }
    }
  }

  return false;
}

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 7;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT; // 308px
const PADDING_VERTICAL = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2; // 132px

// Base arrays
const BASE_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const BASE_MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS_LIST: ('AM' | 'PM')[] = ['AM', 'PM'];

// Looped arrays for natural wheel scrolling
const HOURS_LOOP = [...BASE_HOURS, ...BASE_HOURS, ...BASE_HOURS]; // 36 items
const MINUTES_LOOP = [...BASE_MINUTES, ...BASE_MINUTES, ...BASE_MINUTES]; // 180 items

function parseTimeString(timeStr?: string, isToday = false): { hour12: number; minute: number; period: 'AM' | 'PM' } {
  if (timeStr && timeStr.includes(':')) {
    const [hStr, mStr] = timeStr.split(':');
    const h24 = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;

    const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const minVal = Math.max(0, Math.min(59, m));

    return { hour12, minute: minVal, period };
  }

  // Default upcoming time
  const now = new Date();
  if (isToday) {
    let h = now.getHours();
    let m = Math.ceil((now.getMinutes() + 15) / 5) * 5;
    if (m >= 60) {
      h += 1;
      m = 0;
    }
    if (h >= 24) h = 23;
    const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return { hour12, minute: m, period };
  }

  return { hour12: 9, minute: 0, period: 'AM' };
}

function convertTo24Hour(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let h24 = hour12;
  if (period === 'AM') {
    if (h24 === 12) h24 = 0;
  } else {
    if (h24 !== 12) h24 += 12;
  }
  const hh = String(h24).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Dedicated 60FPS Wheel Column component with real-time center tracking
interface WheelColumnProps<T> {
  items: T[];
  selectedIndex: number;
  onSelect: (index: number, item: T) => void;
  formatItem?: (item: T) => string;
}

function WheelColumn<T>({
  items,
  selectedIndex,
  onSelect,
  formatItem,
}: WheelColumnProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const isDraggingRef = useRef<boolean>(false);
  const activeIndexRef = useRef<number>(selectedIndex);
  const [activeIndex, setActiveIndex] = useState<number>(selectedIndex);

  // Initial scroll on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  // Sync scroll position when selectedIndex changes externally (not from user gesture)
  useEffect(() => {
    if (isDraggingRef.current) return;
    if (selectedIndex === activeIndexRef.current) return;
    activeIndexRef.current = selectedIndex;
    setActiveIndex(selectedIndex);
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [selectedIndex]);

  // Real-time tracking while scrolling (fires every 16ms)
  const handleScroll = useCallback(
    (e: any) => {
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      if (clamped !== activeIndexRef.current) {
        activeIndexRef.current = clamped;
        setActiveIndex(clamped);
        onSelect(clamped, items[clamped]);
      }
    },
    [items, onSelect]
  );

  // Exact center snapping on release
  const handleScrollEnd = useCallback(
    (e: any) => {
      isDraggingRef.current = false;
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const targetY = clamped * ITEM_HEIGHT;

      if (clamped !== activeIndexRef.current) {
        activeIndexRef.current = clamped;
        setActiveIndex(clamped);
        onSelect(clamped, items[clamped]);
      }

      // Snap exactly dead center to the pixel
      if (Math.abs(y - targetY) > 0.5) {
        scrollRef.current?.scrollTo({ y: targetY, animated: Platform.OS === 'ios' });
      }
    },
    [items, onSelect]
  );

  const handleScrollBeginDrag = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleScrollEndDrag = useCallback(
    (e: any) => {
      const velocity = e.nativeEvent?.velocity?.y ?? 0;
      // If released with almost no momentum, snap immediately.
      // Otherwise, let native momentum carry to onMomentumScrollEnd.
      if (Math.abs(velocity) < 0.1) {
        handleScrollEnd(e);
      }
    },
    [handleScrollEnd]
  );

  const handleItemPress = (index: number) => {
    isDraggingRef.current = false;
    activeIndexRef.current = index;
    setActiveIndex(index);
    onSelect(index, items[index]);
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: Platform.OS === 'ios' });
  };

  return (
    <View style={styles.wheelColumn}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={styles.wheelScrollContent}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {items.map((item, idx) => {
          const distance = Math.abs(idx - activeIndex);
          const isCenter = distance === 0;
          const label = formatItem ? formatItem(item) : String(item);

          return (
            <TouchableOpacity
              key={`wheel-item-${idx}`}
              style={styles.wheelItem}
              onPress={() => handleItemPress(idx)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.itemTextBase,
                  isCenter && styles.itemTextCenter,
                  distance === 1 && styles.itemTextDist1,
                  distance === 2 && styles.itemTextDist2,
                  distance >= 3 && styles.itemTextDist3,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function TimePickerModal({
  visible,
  onClose,
  onSelect,
  currentTime,
  selectedDate,
  minTime,
  title = 'Select Pickup Time',
}: TimePickerModalProps) {
  const { t } = useTranslation();
  const isToday = useMemo(() => isDateToday(selectedDate), [selectedDate]);

  const [selectedHour, setSelectedHour] = useState<number>(9);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  const [selectedHourIndex, setSelectedHourIndex] = useState<number>(12 + 8); // 9
  const [selectedMinuteIndex, setSelectedMinuteIndex] = useState<number>(60 + 0); // 00
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<number>(0); // AM

  // Sync state whenever modal opens or currentTime changes
  useEffect(() => {
    if (visible) {
      const parsed = parseTimeString(currentTime, isToday);
      const hIdx = 12 + (parsed.hour12 - 1);
      const mIdx = 60 + parsed.minute;
      const pIdx = parsed.period === 'AM' ? 0 : 1;

      setSelectedHour(parsed.hour12);
      setSelectedMinute(parsed.minute);
      setSelectedPeriod(parsed.period);

      setSelectedHourIndex(hIdx);
      setSelectedMinuteIndex(mIdx);
      setSelectedPeriodIndex(pIdx);
    }
  }, [visible, currentTime, isToday]);

  // Compute 24h total minutes for selected time
  const selectedTotalMinutes = useMemo(() => {
    let h24 = selectedHour;
    if (selectedPeriod === 'AM') {
      if (h24 === 12) h24 = 0;
    } else {
      if (h24 !== 12) h24 += 12;
    }
    return h24 * 60 + selectedMinute;
  }, [selectedHour, selectedMinute, selectedPeriod]);

  // Check if selected time is in the past for today
  const isTimeInPast = useMemo(() => {
    if (!isToday) return false;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return selectedTotalMinutes < nowMinutes;
  }, [isToday, selectedTotalMinutes]);

  // Check minTime constraint (e.g. return time after pickup time)
  const isTimeBeforeMin = useMemo(() => {
    if (!minTime || !minTime.includes(':')) return false;
    const [mh, mm] = minTime.split(':').map(Number);
    const minMinutes = mh * 60 + mm;
    return selectedTotalMinutes <= minMinutes;
  }, [minTime, selectedTotalMinutes]);

  const handleHourSelect = useCallback((idx: number, hour: number) => {
    setSelectedHourIndex(idx);
    setSelectedHour(hour);
  }, []);

  const handleMinuteSelect = useCallback((idx: number, minute: number) => {
    setSelectedMinuteIndex(idx);
    setSelectedMinute(minute);
  }, []);

  const handlePeriodSelect = useCallback((idx: number, period: 'AM' | 'PM') => {
    setSelectedPeriodIndex(idx);
    setSelectedPeriod(period);
  }, []);

  const handleConfirm = () => {
    if (isTimeInPast || isTimeBeforeMin) return;
    const time24 = convertTo24Hour(selectedHour, selectedMinute, selectedPeriod);
    onSelect(time24);
    onClose();
  };

  const displayTime = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')} ${selectedPeriod}`;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="time" size={22} color="rgb(22, 34, 50)" />
              </View>
              <View>
                <Text style={styles.title}>{title}</Text>
                {isToday && (
                  <Text style={styles.subtitle}>Showing upcoming times for today</Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#1e293b" />
            </TouchableOpacity>
          </View>

          {/* Unified Wheel Picker Cylinder */}
          <View style={styles.wheelArea}>
            {/* Center Selection Highlight Bar spanning across all 3 columns */}
            <View style={styles.selectionHighlightBar} pointerEvents="none" />

            {/* Column 1: Hour */}
            <WheelColumn
              items={HOURS_LOOP}
              selectedIndex={selectedHourIndex}
              onSelect={handleHourSelect}
              formatItem={(h) => String(h)}
            />

            {/* Column 2: Minute */}
            <WheelColumn
              items={MINUTES_LOOP}
              selectedIndex={selectedMinuteIndex}
              onSelect={handleMinuteSelect}
              formatItem={(m) => String(m).padStart(2, '0')}
            />

            {/* Column 3: Period (AM / PM) */}
            <WheelColumn
              items={PERIODS_LIST}
              selectedIndex={selectedPeriodIndex}
              onSelect={handlePeriodSelect}
            />

            {/* Top Fade Gradient Mask */}
            <View
              style={styles.topGradient}
              pointerEvents="none"
            />

            {/* Bottom Fade Gradient Mask */}
            <View
              style={styles.bottomGradient}
              pointerEvents="none"
            />
          </View>

          {/* Validation Warning */}
          {isTimeInPast && (
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle" size={15} color="#ef4444" style={{ marginRight: 6 }} />
              <Text style={styles.warningText}>
                {t('modals.timePicker.timeAlreadyPassed', {
                  defaultValue: 'Selected time has already passed for today. Please select an upcoming time.',
                })}
              </Text>
            </View>
          )}

          {isTimeBeforeMin && !isTimeInPast && (
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle" size={15} color="#ef4444" style={{ marginRight: 6 }} />
              <Text style={styles.warningText}>
                {t('modals.timePicker.returnTimeAfterPickup', {
                  defaultValue: 'Return time must be after the pickup time.',
                })}
              </Text>
            </View>
          )}

          {/* Bottom Confirmation Bar */}
          <View style={styles.bottomBar}>
            <View style={styles.selectedTimeBadge}>
              <Text style={styles.selectedTimeLabel}>{t('modals.timePicker.selectedTime', { defaultValue: 'SELECTED TIME' })}</Text>
              <Text style={[styles.selectedTimeValue, (isTimeInPast || isTimeBeforeMin) && styles.selectedTimeValueError]}>
                {displayTime}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (isTimeInPast || isTimeBeforeMin) && styles.confirmBtnDisabled,
              ]}
              disabled={isTimeInPast || isTimeBeforeMin}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmBtnText}>
                {t('modals.timePicker.confirmTime', { defaultValue: 'Confirm Time' })}
              </Text>
              <Ionicons name="checkmark-circle" size={17} color="#ffffff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgb(22, 34, 50)',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  wheelArea: {
    flexDirection: 'row',
    height: CONTAINER_HEIGHT,
    marginHorizontal: 16,
    marginVertical: 14,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionHighlightBar: {
    position: 'absolute',
    top: PADDING_VERTICAL,
    left: 12,
    right: 12,
    height: ITEM_HEIGHT,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  wheelColumn: {
    flex: 1,
    height: CONTAINER_HEIGHT,
  },
  wheelScrollContent: {
    paddingVertical: PADDING_VERTICAL,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextBase: {
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  itemTextCenter: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.5,
  },
  itemTextDist1: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    opacity: 0.85,
  },
  itemTextDist2: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    opacity: 0.7,
  },
  itemTextDist3: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    opacity: 0.5,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  warningText: {
    fontSize: 11,
    color: '#b91c1c',
    fontWeight: '600',
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  selectedTimeBadge: {
    flex: 1,
  },
  selectedTimeLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  selectedTimeValue: {
    fontSize: 16,
    fontWeight: '900',
    color: 'rgb(22, 34, 50)',
    marginTop: 1,
  },
  selectedTimeValueError: {
    color: '#ef4444',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(240, 117, 15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    shadowColor: 'rgb(240, 117, 15)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  confirmBtnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
