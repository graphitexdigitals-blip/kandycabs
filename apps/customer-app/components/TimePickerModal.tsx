import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (timeString: string) => void;
  currentTime?: string;
  selectedDate?: string;
  minTime?: string;
  title?: string;
}

const ALL_TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m of ['00', '30']) {
    const hh = String(h).padStart(2, '0');
    ALL_TIME_SLOTS.push(`${hh}:${m}`);
  }
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

export function TimePickerModal({
  visible,
  onClose,
  onSelect,
  currentTime,
  selectedDate,
  minTime,
  title = 'Select Pickup Time',
}: TimePickerModalProps) {
  // Filter out time slots that have already passed for today
  const availableSlots = React.useMemo(() => {
    const isToday = isDateToday(selectedDate);
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    let minTotalMinutes = -1;
    if (minTime && minTime.includes(':')) {
      const [mh, mm] = minTime.split(':').map(Number);
      minTotalMinutes = mh * 60 + mm;
    }

    return ALL_TIME_SLOTS.filter((slot) => {
      const [h, m] = slot.split(':').map(Number);
      const slotTotalMinutes = h * 60 + m;

      // 1. If date is today, do not show times that are already in the past
      if (isToday) {
        if (slotTotalMinutes < currentTotalMinutes) {
          return false;
        }
      }

      // 2. If minTime is specified (e.g. return time must be after pickup time)
      if (minTotalMinutes >= 0 && slotTotalMinutes <= minTotalMinutes) {
        return false;
      }

      return true;
    });
  }, [selectedDate, minTime, visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{title}</Text>
              {isDateToday(selectedDate) && (
                <Text style={styles.subtitle}>Showing upcoming times for today</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#1e293b" />
            </TouchableOpacity>
          </View>

          {availableSlots.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={40} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No More Slots Today</Text>
              <Text style={styles.emptySubtitle}>
                All pickup time slots for today have passed. Please select tomorrow's date.
              </Text>
            </View>
          ) : (
            <FlatList
              data={availableSlots}
              numColumns={3}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = currentTime === item;
                const [hourStr, minStr] = item.split(':');
                const hourNum = parseInt(hourStr, 10);
                const ampm = hourNum >= 12 ? 'PM' : 'AM';
                const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
                const formattedTime12 = `${displayHour}:${minStr} ${ampm}`;

                return (
                  <TouchableOpacity
                    style={[styles.timeCard, isSelected && styles.timeCardActive]}
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.timeText, isSelected && styles.textActive]}>
                      {formattedTime12}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#103A75',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ea580c',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  list: {
    padding: 12,
  },
  timeCard: {
    flex: 1,
    margin: 5,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeCardActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#103A75',
  },
  textActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#103A75',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
