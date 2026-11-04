import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (dateString: string, displayDate: string) => void;
  currentDate?: string;
  title?: string;
  minDate?: string;
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Monday-first weekday headers as shown in reference (M, T, W, T, F, S, S)
const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const WEEKDAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseDate(str?: string): { year: number; month: number; day: number } {
  const today = new Date();
  if (!str || typeof str !== 'string' || !str.trim()) {
    return {
      year: today.getFullYear(),
      month: today.getMonth(),
      day: today.getDate(),
    };
  }
  const clean = str.trim();
  if (clean.includes('-')) {
    const parts = clean.split('-').map(Number);
    if (parts.length === 3) {
      if (parts[0] > 1000) {
        // YYYY-MM-DD
        return { year: parts[0], month: parts[1] - 1, day: parts[2] };
      } else {
        // DD-MM-YYYY
        return { year: parts[2], month: parts[1] - 1, day: parts[0] };
      }
    }
  }

  // Handle formats like "25 Oct 2026" or "Wed, 25 Oct 2026"
  const tokens = clean.replace(/,/g, '').split(/\s+/);
  if (tokens.length >= 3) {
    // Look for day, month string, year
    const numTokens = tokens.filter(t => /^\d+$/.test(t)).map(Number);
    const monthToken = tokens.find(t => isNaN(Number(t)));
    if (monthToken && numTokens.length >= 2) {
      const day = numTokens.find(n => n >= 1 && n <= 31) || numTokens[0];
      const year = numTokens.find(n => n >= 2020) || numTokens[1];
      const monthIdx = MONTH_NAMES_SHORT.findIndex(
        m => m.toLowerCase() === monthToken.substring(0, 3).toLowerCase()
      );
      if (day && year && monthIdx !== -1) {
        return { year, month: monthIdx, day };
      }
    }
  }

  const parsedNative = new Date(clean);
  if (!isNaN(parsedNative.getTime())) {
    return {
      year: parsedNative.getFullYear(),
      month: parsedNative.getMonth(),
      day: parsedNative.getDate(),
    };
  }

  return {
    year: today.getFullYear(),
    month: today.getMonth(),
    day: today.getDate(),
  };
}

export function DatePickerModal({
  visible,
  onClose,
  onSelect,
  currentDate,
  title,
  minDate,
}: DatePickerModalProps) {
  const { t } = useTranslation();
  const displayTitle = title || t('modals.datePicker.title', { defaultValue: 'Select Pickup Date' });
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  // Mode: 'CALENDAR' or 'COLUMNS' (Wheel/Column mode toggled by pencil icon)
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'COLUMNS'>('CALENDAR');

  // Dropdown for Year / Month selection grid
  const [isYearMonthPickerOpen, setIsYearMonthPickerOpen] = useState(false);

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedDay, setSelectedDay] = useState<number>(currentDay);

  const dayScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);
  const yearScrollRef = useRef<ScrollView>(null);

  // Sync state whenever modal opens or currentDate/minDate changes
  useEffect(() => {
    if (visible) {
      const initialDateStr = currentDate || minDate;
      const parsed = parseDate(initialDateStr);
      setSelectedYear(parsed.year);
      setSelectedMonth(parsed.month);
      setSelectedDay(parsed.day);
      setViewMode('CALENDAR');
      setIsYearMonthPickerOpen(false);
    }
  }, [visible, currentDate, minDate]);

  // Year options: current year and next 15 years (matching Reference 3 grid)
  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y <= currentYear + 15; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // Days in current selected month/year
  const daysInSelectedMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Days in previous month
  const daysInPrevMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Ensure selectedDay does not exceed daysInSelectedMonth
  useEffect(() => {
    if (selectedDay > daysInSelectedMonth) {
      setSelectedDay(daysInSelectedMonth);
    }
  }, [daysInSelectedMonth, selectedDay]);

  // Scroll to active items in Columns view
  useEffect(() => {
    if (visible && viewMode === 'COLUMNS') {
      const timer = setTimeout(() => {
        const ITEM_HEIGHT = 44;
        if (dayScrollRef.current) {
          const dayIndex = Math.max(0, selectedDay - 3);
          dayScrollRef.current.scrollTo({ y: dayIndex * ITEM_HEIGHT, animated: true });
        }
        if (monthScrollRef.current) {
          const monthIndex = Math.max(0, selectedMonth - 2);
          monthScrollRef.current.scrollTo({ y: monthIndex * ITEM_HEIGHT, animated: true });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible, viewMode, selectedDay, selectedMonth]);

  // Check if a specific date is in the past or before minDate
  const isDateInPast = (year: number, month: number, day: number): boolean => {
    const target = new Date(year, month, day, 23, 59, 59, 999).getTime();
    const todayMidnight = new Date(currentYear, currentMonth, currentDay, 0, 0, 0, 0).getTime();
    if (minDate) {
      const parsedMin = parseDate(minDate);
      const minMidnight = new Date(parsedMin.year, parsedMin.month, parsedMin.day, 0, 0, 0, 0).getTime();
      return target < Math.max(todayMidnight, minMidnight);
    }
    return target < todayMidnight;
  };

  // Check if previous month navigation is allowed
  const canGoPrevMonth = useMemo(() => {
    let minYear = currentYear;
    let minMonth = currentMonth;
    if (minDate) {
      const parsedMin = parseDate(minDate);
      if (parsedMin.year > minYear || (parsedMin.year === minYear && parsedMin.month > minMonth)) {
        minYear = parsedMin.year;
        minMonth = parsedMin.month;
      }
    }
    if (selectedYear < minYear) return false;
    if (selectedYear === minYear && selectedMonth <= minMonth) return false;
    return true;
  }, [selectedYear, selectedMonth, currentYear, currentMonth, minDate]);

  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return;
    if (selectedMonth === 0) {
      setSelectedYear((prev) => prev - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedYear((prev) => prev + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  // Confirm selection
  const handleConfirm = (day = selectedDay, month = selectedMonth, year = selectedYear) => {
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month + 1).padStart(2, '0');
    const yearStr = String(year);
    const key = `${yearStr}-${monthStr}-${dayStr}`;
    const formatted = `${dayStr}-${monthStr}-${yearStr}`;

    onSelect(key, formatted);
    onClose();
  };

  // Header Big Formatted Date (Reference 1: "Mon, Nov 17")
  const headerDateDisplay = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, selectedDay);
    const dayName = WEEKDAY_NAMES_SHORT[d.getDay()];
    const monthName = MONTH_NAMES_SHORT[selectedMonth];
    return `${dayName}, ${monthName} ${selectedDay}`;
  }, [selectedYear, selectedMonth, selectedDay]);

  // Bottom selected date description
  const selectedDateFullDisplay = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, selectedDay);
    const dayName = WEEKDAY_NAMES_SHORT[d.getDay()];
    const monthName = MONTH_NAMES_SHORT[selectedMonth];
    const isToday =
      selectedYear === currentYear &&
      selectedMonth === currentMonth &&
      selectedDay === currentDay;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      selectedYear === tomorrow.getFullYear() &&
      selectedMonth === tomorrow.getMonth() &&
      selectedDay === tomorrow.getDate();

    if (isToday) return `Today, ${selectedDay} ${monthName} ${selectedYear}`;
    if (isTomorrow) return `Tomorrow, ${selectedDay} ${monthName} ${selectedYear}`;
    return `${dayName}, ${selectedDay} ${monthName} ${selectedYear}`;
  }, [selectedYear, selectedMonth, selectedDay, currentYear, currentMonth, currentDay]);

  // Calendar matrix calculation (Monday-first ISO format as shown in Reference 2)
  const calendarCells = useMemo(() => {
    const cells: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      isPast: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // First day of selected month (0=Sun, 1=Mon, ..., 6=Sat)
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    // Monday-first offset: 0 for Mon, 1 for Tue, ..., 6 for Sun
    const startDayIndex = (firstDay.getDay() + 6) % 7;

    // Previous month trailing days
    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    for (let i = 0; i < startDayIndex; i++) {
      const d = daysInPrevMonth - startDayIndex + 1 + i;
      cells.push({
        day: d,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        isPast: isDateInPast(prevYear, prevMonth, d),
        isToday:
          prevYear === currentYear &&
          prevMonth === currentMonth &&
          d === currentDay,
        isSelected: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInSelectedMonth; d++) {
      const isPast = isDateInPast(selectedYear, selectedMonth, d);
      const isToday =
        selectedYear === currentYear &&
        selectedMonth === currentMonth &&
        d === currentDay;
      const isSelected = d === selectedDay;

      cells.push({
        day: d,
        month: selectedMonth,
        year: selectedYear,
        isCurrentMonth: true,
        isPast,
        isToday,
        isSelected,
      });
    }

    // Next month leading days to complete the 7-column row
    const totalCurrentCells = cells.length;
    const remainder = totalCurrentCells % 7;
    const extraCells = remainder === 0 ? 0 : 7 - remainder;
    const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
    const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;

    for (let d = 1; d <= extraCells; d++) {
      cells.push({
        day: d,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        isPast: false,
        isToday:
          nextYear === currentYear &&
          nextMonth === currentMonth &&
          d === currentDay,
        isSelected: false,
      });
    }

    return cells;
  }, [
    selectedYear,
    selectedMonth,
    selectedDay,
    daysInSelectedMonth,
    daysInPrevMonth,
    currentYear,
    currentMonth,
    currentDay,
  ]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="calendar" size={22} color="rgb(22, 34, 50)" />
              </View>
              <View>
                <Text style={styles.title}>{displayTitle}</Text>
                <Text style={styles.subtitle}>{headerDateDisplay}</Text>
              </View>
            </View>

            <View style={styles.headerActionsRow}>
              {/* Mode Toggle Button: Pencil Icon ➔ Columns / Wheel Picker */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => {
                  setIsYearMonthPickerOpen(false);
                  setViewMode((prev) => (prev === 'CALENDAR' ? 'COLUMNS' : 'CALENDAR'));
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={viewMode === 'CALENDAR' ? 'create-outline' : 'calendar-outline'}
                  size={18}
                  color="#1e293b"
                />
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#1e293b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Main Content: CALENDAR VIEW */}
          {viewMode === 'CALENDAR' ? (
            <View style={styles.calendarBody}>
              {/* Month & Year Navigation Row (Reference 2: "October 2021 ▼  ‹  ›") */}
              <View style={styles.monthYearNavRow}>
                {/* Left: Dropdown Toggle for Year / Month Selector */}
                <TouchableOpacity
                  style={styles.dropdownToggleBtn}
                  onPress={() => setIsYearMonthPickerOpen((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dropdownToggleText}>
                    {MONTH_NAMES_FULL[selectedMonth]} {selectedYear}
                  </Text>
                  <Ionicons
                    name={isYearMonthPickerOpen ? 'caret-up' : 'caret-down'}
                    size={15}
                    color="rgb(22, 34, 50)"
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>

                {/* Right: < and > Month Navigation Chevrons */}
                <View style={styles.navChevronsRow}>
                  <TouchableOpacity
                    style={[styles.chevronBtn, !canGoPrevMonth && styles.chevronBtnDisabled]}
                    disabled={!canGoPrevMonth}
                    onPress={handlePrevMonth}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={20}
                      color={canGoPrevMonth ? 'rgb(22, 34, 50)' : '#cbd5e1'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.chevronBtn}
                    onPress={handleNextMonth}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="chevron-forward" size={20} color="rgb(22, 34, 50)" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dropdown Open: Year & Month Selector Grid (Reference 3) */}
              {isYearMonthPickerOpen ? (
                <ScrollView
                  style={styles.yearMonthGridContainer}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 16 }}
                >
                  {/* Month Selection Grid */}
                  <Text style={styles.gridSectionLabel}>SELECT MONTH</Text>
                  <View style={styles.monthPillsGrid}>
                    {MONTH_NAMES_SHORT.map((mName, idx) => {
                      const isSelected = idx === selectedMonth;
                      const isPastMonth = selectedYear === currentYear && idx < currentMonth;

                      return (
                        <TouchableOpacity
                          key={mName}
                          disabled={isPastMonth}
                          style={[
                            styles.monthPill,
                            isSelected && styles.monthPillActive,
                            isPastMonth && styles.gridItemDisabled,
                          ]}
                          onPress={() => {
                            setSelectedMonth(idx);
                          }}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.monthPillText,
                              isSelected && styles.monthPillTextActive,
                              isPastMonth && styles.gridItemTextDisabled,
                            ]}
                          >
                            {mName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Year Selection Grid (Reference 3: 4-column year grid) */}
                  <Text style={styles.gridSectionLabel}>SELECT YEAR</Text>
                  <View style={styles.yearGrid}>
                    {availableYears.map((yr) => {
                      const isSelected = yr === selectedYear;

                      return (
                        <TouchableOpacity
                          key={yr}
                          style={[styles.yearGridPill, isSelected && styles.yearGridPillActive]}
                          onPress={() => {
                            setSelectedYear(yr);
                            setIsYearMonthPickerOpen(false);
                          }}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.yearGridPillText,
                              isSelected && styles.yearGridPillTextActive,
                            ]}
                          >
                            {yr}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Close Dropdown / Show Calendar Button */}
                  <TouchableOpacity
                    style={styles.closeDropdownBtn}
                    onPress={() => setIsYearMonthPickerOpen(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.closeDropdownBtnText}>View Calendar</Text>
                    <Ionicons name="calendar-outline" size={16} color="rgb(22, 34, 50)" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                /* Regular Calendar Grid (Reference 2) */
                <View style={styles.calendarGridView}>
                  {/* Weekday Headers: M  T  W  T  F  S  S */}
                  <View style={styles.weekdayRow}>
                    {WEEKDAY_HEADERS.map((letter, idx) => (
                      <View key={`wk-${idx}`} style={styles.weekdayCol}>
                        <Text style={styles.weekdayLetter}>{letter}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Day Cells (7-column grid) */}
                  <View style={styles.dayGridRow}>
                    {calendarCells.map((item, idx) => {
                      const handleDayPress = () => {
                        if (item.isPast) return;
                        setSelectedYear(item.year);
                        setSelectedMonth(item.month);
                        setSelectedDay(item.day);
                      };

                      return (
                        <View key={`cell-${idx}`} style={styles.dayCellContainer}>
                          <TouchableOpacity
                            disabled={item.isPast}
                            style={[
                              styles.dayCircle,
                              item.isSelected && styles.dayCircleSelected,
                              !item.isSelected && item.isToday && styles.dayCircleToday,
                            ]}
                            onPress={handleDayPress}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.dayNumberText,
                                !item.isCurrentMonth && styles.dayNumberAdjacentMonth,
                                item.isCurrentMonth && styles.dayNumberCurrentMonth,
                                item.isPast && styles.dayNumberDisabled,
                                item.isSelected && styles.dayNumberSelected,
                                !item.isSelected && item.isToday && styles.dayNumberToday,
                              ]}
                            >
                              {item.day}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* Tab 2 / Mode 2: Date • Month • Year Columns Picker */
            <View style={styles.columnsContainer}>
              {/* Column 1: Date */}
              <View style={styles.columnBox}>
                <View style={styles.columnHeader}>
                  <Ionicons name="calendar-outline" size={14} color="rgb(22, 34, 50)" />
                  <Text style={styles.columnHeaderTitle}>DATE</Text>
                </View>
                <ScrollView
                  ref={dayScrollRef}
                  style={styles.columnScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.columnScrollContent}
                >
                  {Array.from({ length: daysInSelectedMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const isSelected = dayNum === selectedDay;
                    const isPast = isDateInPast(selectedYear, selectedMonth, dayNum);

                    return (
                      <TouchableOpacity
                        key={`col-day-${dayNum}`}
                        disabled={isPast}
                        style={[
                          styles.columnItem,
                          isSelected && styles.columnItemActive,
                          isPast && styles.columnItemDisabled,
                        ]}
                        onPress={() => setSelectedDay(dayNum)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.columnItemText,
                            isSelected && styles.columnItemTextActive,
                            isPast && styles.columnItemTextDisabled,
                          ]}
                        >
                          {String(dayNum).padStart(2, '0')}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={13} color="#ffffff" style={{ marginLeft: 3 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Column 2: Month */}
              <View style={styles.columnBox}>
                <View style={styles.columnHeader}>
                  <Ionicons name="albums-outline" size={14} color="rgb(22, 34, 50)" />
                  <Text style={styles.columnHeaderTitle}>MONTH</Text>
                </View>
                <ScrollView
                  ref={monthScrollRef}
                  style={styles.columnScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.columnScrollContent}
                >
                  {MONTH_NAMES_SHORT.map((mName, idx) => {
                    const isSelected = idx === selectedMonth;
                    const isPastMonth = selectedYear === currentYear && idx < currentMonth;

                    return (
                      <TouchableOpacity
                        key={`col-month-${mName}`}
                        disabled={isPastMonth}
                        style={[
                          styles.columnItem,
                          isSelected && styles.columnItemActive,
                          isPastMonth && styles.columnItemDisabled,
                        ]}
                        onPress={() => setSelectedMonth(idx)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.columnItemText,
                            isSelected && styles.columnItemTextActive,
                            isPastMonth && styles.columnItemTextDisabled,
                          ]}
                        >
                          {mName}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={13} color="#ffffff" style={{ marginLeft: 3 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Column 3: Year */}
              <View style={styles.columnBox}>
                <View style={styles.columnHeader}>
                  <Ionicons name="time-outline" size={14} color="rgb(22, 34, 50)" />
                  <Text style={styles.columnHeaderTitle}>YEAR</Text>
                </View>
                <ScrollView
                  ref={yearScrollRef}
                  style={styles.columnScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.columnScrollContent}
                >
                  {availableYears.map((yr) => {
                    const isSelected = yr === selectedYear;

                    return (
                      <TouchableOpacity
                        key={`col-year-${yr}`}
                        style={[styles.columnItem, isSelected && styles.columnItemActive]}
                        onPress={() => setSelectedYear(yr)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.columnItemText,
                            isSelected && styles.columnItemTextActive,
                          ]}
                        >
                          {yr}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark" size={13} color="#ffffff" style={{ marginLeft: 3 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          {/* 3. Bottom Action Bar (App Brand Colors: Cancel & Orange CTA Confirm) */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>{t('common.cancel', { defaultValue: 'Cancel' })}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => handleConfirm()}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>{t('modals.datePicker.confirmDate', { defaultValue: 'Confirm Date' })}</Text>
              <Ionicons name="checkmark-circle" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
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
    overflow: 'hidden',
    maxHeight: '94%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: {
        elevation: 14,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
    }),
  },

  // Header (Clean White Header matching TimePickerModal)
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgb(22, 34, 50)',
    marginTop: 2,
    fontWeight: '600',
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2. Calendar Body
  calendarBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    minHeight: 330,
  },

  // Month & Year Nav Row
  monthYearNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  dropdownToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  dropdownToggleText: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },
  navChevronsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chevronBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  chevronBtnDisabled: {
    opacity: 0.35,
  },

  // Weekday Headers: M T W T F S S
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  weekdayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  weekdayLetter: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b',
  },

  // Calendar Grid
  calendarGridView: {
    width: '100%',
  },
  dayGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellContainer: {
    width: '14.2857%', // exactly 1/7th
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayCircleSelected: {
    backgroundColor: 'rgb(22, 34, 50)',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: 'rgb(22, 34, 50)',
    backgroundColor: 'transparent',
  },

  // Day Number Texts
  dayNumberText: {
    fontSize: 14.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  dayNumberCurrentMonth: {
    color: 'rgb(22, 34, 50)',
  },
  dayNumberAdjacentMonth: {
    color: '#cbd5e1',
  },
  dayNumberDisabled: {
    color: '#e2e8f0',
  },
  dayNumberSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  dayNumberToday: {
    color: 'rgb(22, 34, 50)',
    fontWeight: '800',
  },

  // Year & Month Selector Grid (Reference 3)
  yearMonthGridContainer: {
    maxHeight: 330,
    paddingHorizontal: 4,
  },
  gridSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 8,
  },
  monthPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  monthPill: {
    width: '22.5%',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPillActive: {
    backgroundColor: 'rgb(22, 34, 50)',
    borderColor: 'rgb(22, 34, 50)',
  },
  monthPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  monthPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  gridItemDisabled: {
    opacity: 0.35,
    backgroundColor: '#f1f5f9',
  },
  gridItemTextDisabled: {
    color: '#94a3b8',
  },

  // 4-column year grid (Reference 3)
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  yearGridPill: {
    width: '22.5%',
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  yearGridPillActive: {
    backgroundColor: 'rgb(22, 34, 50)',
  },
  yearGridPillText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  yearGridPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  closeDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    marginTop: 6,
  },
  closeDropdownBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
  },

  // Columns / Wheel Mode
  columnsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 10,
    height: 310,
  },
  columnBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 5,
  },
  columnHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgb(22, 34, 50)',
    letterSpacing: 0.5,
  },
  columnScroll: {
    flex: 1,
  },
  columnScrollContent: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 4,
  },
  columnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  columnItemActive: {
    backgroundColor: 'rgb(22, 34, 50)',
    borderColor: 'rgb(22, 34, 50)',
  },
  columnItemDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
    opacity: 0.35,
  },
  columnItemText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgb(22, 34, 50)',
  },
  columnItemTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  columnItemTextDisabled: {
    color: '#cbd5e1',
  },

  // 3. Bottom Action Bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 14,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  cancelBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#64748b',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgb(240, 117, 15)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
    ...Platform.select({
      ios: {
        shadowColor: 'rgb(240, 117, 15)',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: 'rgb(240, 117, 15)',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 4,
      },
    }),
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});
