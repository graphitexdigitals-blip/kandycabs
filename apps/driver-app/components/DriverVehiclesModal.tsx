import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface VehicleData {
  id?: string;
  category: string;
  model: string;
  plateNumber: string;
  fuelType: string;
  seatCount: string;
  verificationStatus?: string;
  rcDocUrl?: string;
  insuranceDocUrl?: string;
  permitDocUrl?: string;
  fitnessDocUrl?: string;
  taxDocUrl?: string;
  pucDocUrl?: string;
}

interface DriverVehiclesModalProps {
  visible: boolean;
  onClose: () => void;
  vehicles: VehicleData[];
  onSaveVehicles: (updatedVehicles: VehicleData[]) => Promise<void> | void;
  onOpenDocuments?: (vehicleIndex: number) => void;
}

const CATEGORY_OPTIONS = [
  { id: 'SEDAN', label: 'Sedan', defaultModel: 'Maruti Suzuki Dzire', defaultSeats: '4', img: require('../assets/images/fleet-sedan.png') },
  { id: 'SUV', label: 'SUV 6+1', defaultModel: 'Maruti Suzuki Ertiga', defaultSeats: '6', img: require('../assets/images/fleet-suv.png') },
  { id: 'INNOVA', label: 'Innova Crysta', defaultModel: 'Toyota Innova Crysta', defaultSeats: '7', img: require('../assets/images/fleet-crysta.png') },
  { id: 'HATCHBACK', label: 'Hatchback', defaultModel: 'Maruti Suzuki WagonR', defaultSeats: '4', img: require('../assets/images/fleet-hatchback.png') },
  { id: 'TRAVELLER', label: 'Tempo Traveller', defaultModel: 'Force Urbania / Traveller', defaultSeats: '12', img: require('../assets/images/fleet-traveller.png') },
];

const FUEL_OPTIONS = ['DIESEL', 'PETROL', 'CNG', 'ELECTRIC'];

export function DriverVehiclesModal({
  visible,
  onClose,
  vehicles,
  onSaveVehicles,
  onOpenDocuments,
}: DriverVehiclesModalProps) {
  const insets = useSafeAreaInsets();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formCategory, setFormCategory] = useState('SEDAN');
  const [formModel, setFormModel] = useState('');
  const [formPlate, setFormPlate] = useState('');
  const [formFuel, setFormFuel] = useState('DIESEL');
  const [formSeats, setFormSeats] = useState('4');

  const openAddForm = () => {
    setEditingIndex(null);
    setFormCategory('SEDAN');
    setFormModel('Maruti Suzuki Dzire');
    setFormPlate('');
    setFormFuel('DIESEL');
    setFormSeats('4');
    setIsFormOpen(true);
  };

  const openEditForm = (veh: VehicleData, index: number) => {
    setEditingIndex(index);
    setFormCategory(veh.category || 'SEDAN');
    setFormModel(veh.model || '');
    setFormPlate(veh.plateNumber || '');
    setFormFuel(veh.fuelType || 'DIESEL');
    setFormSeats(String(veh.seatCount || '4').replace(/\D/g, '') || '4');
    setIsFormOpen(true);
  };

  const handleSaveForm = async () => {
    const cleanPlate = formPlate.trim().toUpperCase();
    if (!cleanPlate) {
      Alert.alert('Missing Number Plate', 'Please enter your vehicle license plate number.');
      return;
    }

    const cleanModel = formModel.trim() || (CATEGORY_OPTIONS.find((c) => c.id === formCategory)?.defaultModel || 'Commercial Cab');

    setSaving(true);
    try {
      const updatedList = [...vehicles];
      const vehiclePayload: VehicleData = {
        id: editingIndex !== null ? vehicles[editingIndex]?.id || `veh-${editingIndex + 1}` : `veh-${Date.now()}`,
        category: formCategory,
        model: cleanModel,
        plateNumber: cleanPlate,
        fuelType: formFuel,
        seatCount: formSeats,
        verificationStatus: editingIndex !== null ? vehicles[editingIndex]?.verificationStatus || 'APPROVED' : 'PENDING',
        rcDocUrl: editingIndex !== null ? vehicles[editingIndex]?.rcDocUrl : undefined,
        insuranceDocUrl: editingIndex !== null ? vehicles[editingIndex]?.insuranceDocUrl : undefined,
      };

      if (editingIndex !== null) {
        updatedList[editingIndex] = vehiclePayload;
      } else {
        updatedList.push(vehiclePayload);
      }

      await onSaveVehicles(updatedList);
      setIsFormOpen(false);
      setEditingIndex(null);
      Alert.alert('Success', editingIndex !== null ? 'Vehicle updated successfully.' : 'New vehicle added to your fleet.');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save vehicle details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVehicle = (index: number) => {
    if (vehicles.length <= 1) {
      Alert.alert('Cannot Remove', 'You must have at least one active vehicle registered in your fleet.');
      return;
    }

    const target = vehicles[index];
    const plate = target?.plateNumber || `Vehicle #${index + 1}`;

    Alert.alert(
      'Remove Vehicle',
      `Are you sure you want to remove ${plate} (${target?.model || 'Cab'}) from your registered fleet?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const updatedList = vehicles.filter((_, i) => i !== index);
              await onSaveVehicles(updatedList);
              Alert.alert('Deleted', 'Vehicle removed from your fleet.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not remove vehicle.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const getFleetImage = (category?: string) => {
    const c = (category || '').toUpperCase();
    if (c === 'HATCHBACK') return require('../assets/images/fleet-hatchback.png');
    if (c === 'SUV' || c === 'ERTIGA') return require('../assets/images/fleet-suv.png');
    if (c === 'INNOVA' || c === 'CRYSTA') return require('../assets/images/fleet-crysta.png');
    if (c === 'TRAVELLER' || c === 'URBANIA') return require('../assets/images/fleet-traveller.png');
    return require('../assets/images/fleet-sedan.png');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#0f2744" />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>My Vehicles</Text>
            <Text style={styles.headerSub}>
              {vehicles.length} {vehicles.length === 1 ? 'Registered Cab' : 'Registered Cabs'} in Fleet
            </Text>
          </View>

          <TouchableOpacity style={styles.headerAddBtn} onPress={openAddForm} activeOpacity={0.8}>
            <Ionicons name="add" size={17} color="#ffffff" style={{ marginRight: 2 }} />
            <Text style={styles.headerAddBtnText}>Add Cab</Text>
          </TouchableOpacity>
        </View>

        {/* Vehicles List */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {vehicles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={54} color="#94a3b8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No Vehicles Registered</Text>
              <Text style={styles.emptySub}>
                Add your commercial cab details to start receiving trip dispatches from Kandy Cabs.
              </Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddForm} activeOpacity={0.85}>
                <Ionicons name="add-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.emptyAddBtnText}>+ Add First Vehicle</Text>
              </TouchableOpacity>
            </View>
          ) : (
            vehicles.map((veh, idx) => {
              const plate = (veh.plateNumber || 'KA-01-XX-0000').toUpperCase();
              const model = veh.model || 'Commercial Cab';
              const category = veh.category ? veh.category.charAt(0).toUpperCase() + veh.category.slice(1).toLowerCase() : 'Sedan';
              const fuel = veh.fuelType || 'DIESEL';
              const seats = veh.seatCount ? `${veh.seatCount} Seats` : '4 Seats';

              return (
                <View key={veh.id || idx} style={styles.vehicleCard}>
                  {/* Card Header */}
                  <View style={styles.vehicleCardTop}>
                    <View style={styles.fleetPill}>
                      <Text style={styles.fleetPillText}>{category}</Text>
                    </View>

                    <View style={styles.vehicleCardActions}>
                      <TouchableOpacity
                        style={styles.actionBtnEdit}
                        onPress={() => openEditForm(veh, idx)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="pencil" size={14} color="#0f2744" />
                        <Text style={styles.actionBtnEditText}>Edit</Text>
                      </TouchableOpacity>

                      {vehicles.length > 1 && (
                        <TouchableOpacity
                          style={styles.actionBtnDelete}
                          onPress={() => handleDeleteVehicle(idx)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={14} color="#dc2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Vehicle Body: Image + Title */}
                  <View style={styles.vehicleBodyRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.vehicleModelText} numberOfLines={1}>
                        {model}
                      </Text>
                      <View style={styles.plateContainer}>
                        <View style={styles.plateIndBadge}>
                          <Text style={styles.plateIndText}>IND</Text>
                        </View>
                        <Text style={styles.plateText}>{plate}</Text>
                      </View>
                    </View>
                    <Image source={getFleetImage(veh.category)} style={styles.vehicleThumbnail} resizeMode="contain" />
                  </View>

                  {/* Specification Badges */}
                  <View style={styles.specRow}>
                    <View style={styles.specBadge}>
                      <Ionicons name="people-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                      <Text style={styles.specBadgeText}>{seats}</Text>
                    </View>
                    <View style={styles.specBadge}>
                      <Ionicons name="flame-outline" size={13} color="#475569" style={{ marginRight: 4 }} />
                      <Text style={styles.specBadgeText}>{fuel}</Text>
                    </View>
                    {(() => {
                      const allDocs = [
                        veh.rcDocUrl,
                        veh.insuranceDocUrl,
                        veh.fitnessDocUrl,
                        veh.taxDocUrl,
                        veh.permitDocUrl,
                        veh.pucDocUrl,
                      ];
                      const docsAttachedCount = allDocs.filter(Boolean).length;
                      const isAllAttached = docsAttachedCount === 6;
                      return (
                        <View style={[
                          styles.specBadge,
                          isAllAttached
                            ? { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }
                            : { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }
                        ]}>
                          <Ionicons
                            name={isAllAttached ? "shield-checkmark" : "alert-circle"}
                            size={13}
                            color={isAllAttached ? "#16a34a" : "#dc2626"}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[
                            styles.specBadgeText,
                            { color: isAllAttached ? '#166534' : '#dc2626', fontWeight: '700' }
                          ]}>
                            {isAllAttached ? 'Verified (6/6)' : `Pending (${docsAttachedCount}/6)`}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>

                  {/* View / Upload Documents for this Vehicle */}
                  {onOpenDocuments && (() => {
                    const allDocs = [
                      veh.rcDocUrl,
                      veh.insuranceDocUrl,
                      veh.fitnessDocUrl,
                      veh.taxDocUrl,
                      veh.permitDocUrl,
                      veh.pucDocUrl,
                    ];
                    const docsAttachedCount = allDocs.filter(Boolean).length;
                    const isAllAttached = docsAttachedCount === 6;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.docUploadRowBtn,
                          isAllAttached ? styles.docUploadRowBtnAttached : styles.docUploadRowBtnMissing,
                        ]}
                        onPress={() => {
                          onClose();
                          onOpenDocuments(idx);
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons
                            name={isAllAttached ? "checkmark-circle" : "alert-circle-outline"}
                            size={15}
                            color={isAllAttached ? "#16a34a" : "#dc2626"}
                          />
                          <Text
                            style={[
                              styles.docUploadRowText,
                              isAllAttached ? styles.docUploadRowTextAttached : styles.docUploadRowTextMissing,
                            ]}
                          >
                            {isAllAttached
                              ? 'All Vehicle Documents Attached (6/6)'
                              : docsAttachedCount > 0
                                ? `Vehicle Documents Pending (${docsAttachedCount}/6 Attached)`
                                : 'Vehicle Documents: Not Attached (Upload Now)'}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={isAllAttached ? "#16a34a" : "#dc2626"}
                        />
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Add / Edit Vehicle Modal */}
        <Modal visible={isFormOpen} animationType="slide" transparent={true} onRequestClose={() => setIsFormOpen(false)}>
          <View style={styles.formModalOverlay}>
            <KeyboardAvoidingView
              style={styles.formModalContent}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.formModalHeader}>
                <View>
                  <Text style={styles.formModalTitle}>{editingIndex !== null ? 'Edit Vehicle Details' : 'Add New Vehicle'}</Text>
                  <Text style={styles.formModalSub}>Assign commercial vehicle to your driver fleet</Text>
                </View>
                <TouchableOpacity onPress={() => setIsFormOpen(false)} style={styles.formModalCloseBtn}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                {/* 1. Category Selection */}
                <Text style={styles.inputLabel}>Vehicle Category</Text>
                <View style={styles.categoryPickerRow}>
                  {CATEGORY_OPTIONS.map((cat) => {
                    const isSelected = formCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryOption, isSelected && styles.categoryOptionSelected]}
                        onPress={() => {
                          setFormCategory(cat.id);
                          if (!formModel || formModel === CATEGORY_OPTIONS.find((c) => c.id === formCategory)?.defaultModel) {
                            setFormModel(cat.defaultModel);
                          }
                          setFormSeats(cat.defaultSeats);
                        }}
                        activeOpacity={0.8}
                      >
                        <Image source={cat.img} style={styles.catOptionImg} resizeMode="contain" />
                        <Text style={[styles.catOptionText, isSelected && styles.catOptionTextSelected]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 2. Model & Make */}
                <Text style={styles.inputLabel}>Car Model / Make</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="car-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.formInput}
                    value={formModel}
                    onChangeText={setFormModel}
                    placeholder="e.g. Maruti Suzuki Dzire"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                {/* 3. Plate Number */}
                <Text style={styles.inputLabel}>Vehicle Number Plate</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="card-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.formInput, { textTransform: 'uppercase', fontWeight: '700' }]}
                    value={formPlate}
                    onChangeText={setFormPlate}
                    placeholder="e.g. KA 01 MJ 2023"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                  />
                </View>

                {/* 4. Fuel Type */}
                <Text style={styles.inputLabel}>Fuel / Emission</Text>
                <View style={styles.fuelPickerRow}>
                  {FUEL_OPTIONS.map((fuel) => {
                    const isSelected = formFuel === fuel;
                    return (
                      <TouchableOpacity
                        key={fuel}
                        style={[styles.fuelOption, isSelected && styles.fuelOptionSelected]}
                        onPress={() => setFormFuel(fuel)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.fuelOptionText, isSelected && styles.fuelOptionTextSelected]}>
                          {fuel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 5. Passenger Seats */}
                <Text style={styles.inputLabel}>Passenger Seating Capacity</Text>
                <View style={styles.seatsPickerRow}>
                  {['4', '6', '7', '12'].map((seats) => {
                    const isSelected = formSeats === seats;
                    return (
                      <TouchableOpacity
                        key={seats}
                        style={[styles.seatOption, isSelected && styles.seatOptionSelected]}
                        onPress={() => setFormSeats(seats)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.seatOptionText, isSelected && styles.seatOptionTextSelected]}>
                          {seats} Seats
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Submit Form Button */}
                <View style={styles.formSubmitRow}>
                  <TouchableOpacity
                    style={styles.formCancelBtn}
                    onPress={() => setIsFormOpen(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.formCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.formSaveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSaveForm}
                    disabled={saving}
                    activeOpacity={0.85}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.formSaveBtnText}>
                        {editingIndex !== null ? 'Save Changes' : '+ Add to Fleet'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f2744',
  },
  headerSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0750f',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  headerAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2744',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2744',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  vehicleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  vehicleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  fleetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  fleetPillNum: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ea580c',
  },
  fleetPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f2744',
  },
  vehicleCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionBtnEditText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f2744',
  },
  actionBtnDelete: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  vehicleModelText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2744',
    marginBottom: 6,
  },
  plateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#0f2744',
    borderRadius: 6,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  plateIndBadge: {
    backgroundColor: '#002244',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  plateIndText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fbbf24',
  },
  plateText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f2744',
    letterSpacing: 1.2,
    paddingHorizontal: 8,
  },
  vehicleThumbnail: {
    width: 90,
    height: 48,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginBottom: 10,
  },
  specBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  specBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  docUploadRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  docUploadRowBtnMissing: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  docUploadRowBtnAttached: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  docUploadRowText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c2410c',
  },
  docUploadRowTextMissing: {
    color: '#dc2626',
  },
  docUploadRowTextAttached: {
    color: '#166534',
  },
  // Form Modal Styles
  formModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 39, 68, 0.6)',
    justifyContent: 'flex-end',
  },
  formModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f2744',
  },
  formModalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  formModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  formInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f2744',
  },
  categoryPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    width: '31%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  categoryOptionSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#f0750f',
    borderWidth: 1.5,
  },
  catOptionImg: {
    width: 50,
    height: 28,
    marginBottom: 4,
  },
  catOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  catOptionTextSelected: {
    fontWeight: '800',
    color: '#ea580c',
  },
  fuelPickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fuelOption: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  fuelOptionSelected: {
    backgroundColor: '#0f2744',
    borderColor: '#0f2744',
  },
  fuelOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  fuelOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  seatsPickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  seatOption: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  seatOptionSelected: {
    backgroundColor: '#0f2744',
    borderColor: '#0f2744',
  },
  seatOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  seatOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  formSubmitRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  formCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  formCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  formSaveBtn: {
    flex: 2,
    backgroundColor: '#f0750f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#f0750f',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  formSaveBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
  },
});

