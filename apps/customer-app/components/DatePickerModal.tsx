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

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (dateString: string, displayDate: string) => void;
  currentDate?: string;
  title?: string;
}

export function DatePickerModal({
  visible,
  onClose,
  onSelect,
  currentDate,
  title = 'Select Pickup Date',
}: DatePickerModalProps) {
  // Generate next 30 days
  const dates = React.useMemo(() => {
    const list: { key: string; dayName: string; dayNum: string; monthName: string; isToday: boolean; formatted: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const dayNum = String(d.getDate()).padStart(2, '0');
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const key = `${year}-${monthNum}-${dayNum}`;
      const formatted = `${dayNum}-${monthNum}-${year}`;
      const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });

      list.push({ key, dayName, dayNum, monthName, isToday: i === 0, formatted });
    }
    return list;
  }, []);

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#1e293b" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={dates}
            numColumns={3}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = currentDate === item.formatted || currentDate === item.key;
              return (
                <TouchableOpacity
                  style={[styles.dateCard, isSelected && styles.dateCardActive]}
                  onPress={() => {
                    onSelect(item.key, item.formatted);
                    onClose();
                  }}
                >
                  <Text style={[styles.dayName, isSelected && styles.textActive]}>{item.dayName}</Text>
                  <Text style={[styles.dayNum, isSelected && styles.textActive]}>{item.dayNum}</Text>
                  <Text style={[styles.monthName, isSelected && styles.textActive]}>{item.monthName}</Text>
                </TouchableOpacity>
              );
            }}
          />
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
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  list: {
    padding: 12,
  },
  dateCard: {
    flex: 1,
    margin: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCardActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  dayName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  dayNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#103A75',
    marginVertical: 2,
  },
  monthName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  textActive: {
    color: '#ffffff',
  },
});
