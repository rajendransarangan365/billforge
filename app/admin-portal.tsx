// @ts-nocheck
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, RefreshControl, Modal, Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { getDatabase, authenticateAdmin, getAllQuarries, registerQuarry, getGlobalDrivers } from '../src/database/db';

export default function AdminPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAdmin, loginAdmin, loginOwner, logout } = useAuth();

  // PIN login state if not admin
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Admin dashboard state
  const [quarries, setQuarries] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Register quarry modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [regName, setRegName] = useState('');
  const [regOwner, setRegOwner] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('admin123');
  const [regLocation, setRegLocation] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regSaving, setRegSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const qList = await getAllQuarries(db);
      const dList = await getGlobalDrivers(db);
      setQuarries(qList);
      setDrivers(dList);
    } catch (e) {
      console.error('Admin Load Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, loadData]);

  const handlePinSubmit = async () => {
    setPinError('');
    if (!pin.trim()) { setPinError('Enter master PIN'); return; }
    setPinLoading(true);
    try {
      const db = await getDatabase();
      const res = await authenticateAdmin(db, pin.trim());
      if (res) {
        loginAdmin(res);
        loadData();
      } else {
        setPinError('Invalid Admin PIN. (Default: admin123)');
      }
    } catch (e) {
      setPinError('Authentication error');
    } finally {
      setPinLoading(false);
    }
  };

  const handleRegisterQuarry = async () => {
    if (!regName.trim() || !regPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter Quarry Name and Mobile Number.');
      return;
    }
    setRegSaving(true);
    try {
      const db = await getDatabase();
      await registerQuarry(db, {
        name: regName.trim(),
        owner_name: regOwner.trim() || regName.trim(),
        phone: regPhone.trim(),
        password: regPassword.trim() || 'admin123',
        location: regLocation.trim(),
        address: regAddress.trim(),
      });
      Alert.alert('Success', `Quarry "${regName}" registered successfully!`);
      setModalVisible(false);
      setRegName(''); setRegOwner(''); setRegPhone(''); setRegLocation(''); setRegAddress('');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to register quarry.');
    } finally {
      setRegSaving(false);
    }
  };

  const handleImpersonateQuarry = (quarry: any) => {
    loginOwner({
      id: quarry.id,
      quarry_id: quarry.id,
      name: quarry.name,
      owner_name: quarry.owner_name,
      phone: quarry.phone,
      location: quarry.location,
      address: quarry.address,
      role: 'quarry_owner',
    });
    router.push('/(tabs)');
  };

  // If not logged in as Admin, show PIN entry modal
  if (!isAdmin) {
    return (
      <View style={[styles.pinRoot, { paddingTop: insets.top + 20 }]}>
        <View style={styles.pinCard}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.pinIconWrap}>
            <Ionicons name="shield-checkmark" size={36} color="#E65100" />
          </View>
          <Text style={styles.pinTitle}>Admin Control Tower</Text>
          <Text style={styles.pinSub}>Enter Master PIN to access platform administration</Text>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={{ paddingLeft: 12 }} />
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={setPin}
              placeholder="Enter Master PIN"
              placeholderTextColor={Colors.textDisabled}
              secureTextEntry
              keyboardType="numeric"
              onSubmitEditing={handlePinSubmit}
            />
          </View>

          {pinError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
              <Text style={styles.errorText}>{pinError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: '#E65100' }, pinLoading && { opacity: 0.7 }]}
            onPress={handlePinSubmit}
            disabled={pinLoading}
          >
            {pinLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={styles.btnText}>Authenticate Admin</Text>
                <Ionicons name="key-outline" size={18} color="#FFF" />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.pinHint}>Default Master PIN: <Text style={{ fontWeight: '700' }}>admin123</Text></Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/select-role')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Admin Control Tower</Text>
          <Text style={styles.subTitle}>Platform Oversight & Multi-Quarry Operations</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Add Quarry</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 8, color: Colors.textSecondary }}>Loading Platform Data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Platform Metrics */}
          <Text style={styles.sectionTitle}>Platform Overview</Text>
          <View style={styles.grid}>
            <View style={[styles.gridCard, { backgroundColor: Colors.primarySurface }]}>
              <Text style={[styles.gridNum, { color: Colors.primary }]}>{quarries.length}</Text>
              <Text style={styles.gridLbl}>Registered Quarries</Text>
            </View>
            <View style={[styles.gridCard, { backgroundColor: Colors.infoLight }]}>
              <Text style={[styles.gridNum, { color: Colors.info }]}>{drivers.length}</Text>
              <Text style={styles.gridLbl}>Registered Drivers</Text>
            </View>
            <View style={[styles.gridCard, { backgroundColor: Colors.successLight }]}>
              <Text style={[styles.gridNum, { color: Colors.success }]}>{quarries.filter(q => q.status === 'active').length}</Text>
              <Text style={styles.gridLbl}>Active Outlets</Text>
            </View>
          </View>

          {/* Quarry Directory */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Registered Quarries ({quarries.length})</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
              <Text style={styles.linkText}>+ Register New</Text>
            </TouchableOpacity>
          </View>

          {quarries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="business-outline" size={32} color={Colors.textDisabled} />
              <Text style={styles.emptyText}>No quarries registered yet.</Text>
              <TouchableOpacity style={[styles.btnPrimary, { marginTop: 12, backgroundColor: Colors.primary }]} onPress={() => setModalVisible(true)}>
                <Text style={styles.btnText}>Register First Quarry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            quarries.map((q) => (
              <View key={q.id} style={styles.quarryCard}>
                <View style={styles.quarryHeader}>
                  <View style={styles.quarryAvatar}>
                    <Ionicons name="business" size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quarryName}>{q.name}</Text>
                    <Text style={styles.quarryOwner}>Owner: {q.owner_name} ({q.phone})</Text>
                    {q.location ? <Text style={styles.quarryLoc}><Ionicons name="location-outline" size={12} /> {q.location}</Text> : null}
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>ACTIVE</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.manageBtn} onPress={() => handleImpersonateQuarry(q)}>
                  <Ionicons name="open-outline" size={16} color={Colors.primary} />
                  <Text style={styles.manageBtnText}>Manage & View Bills</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* Global Drivers Pool */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Global Driver Pool ({drivers.length})</Text>
          {drivers.map((d) => (
            <View key={d.id} style={styles.driverCard}>
              <Ionicons name="car-sport" size={20} color={Colors.info} />
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{d.name}</Text>
                <Text style={styles.driverSub}>{d.phone} • {d.vehicle_no}</Text>
              </View>
              <Text style={styles.driverStatus}>{d.status || 'Available'}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Modal: Add Quarry */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register New Quarry</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Quarry Name *</Text>
                <TextInput style={styles.formInput} value={regName} onChangeText={setRegName} placeholder="e.g. Sri Murugan Blue Metal Quarry" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Owner Name</Text>
                <TextInput style={styles.formInput} value={regOwner} onChangeText={setRegOwner} placeholder="e.g. K. Ramasamy" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Mobile Number (Owner Login) *</Text>
                <TextInput style={styles.formInput} value={regPhone} onChangeText={setRegPhone} placeholder="10-digit mobile number" keyboardType="phone-pad" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Login Password</Text>
                <TextInput style={styles.formInput} value={regPassword} onChangeText={setRegPassword} placeholder="Default: admin123" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Quarry Location / District</Text>
                <TextInput style={styles.formInput} value={regLocation} onChangeText={setRegLocation} placeholder="e.g. Tiruppur" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Full Address</Text>
                <TextInput style={styles.formInput} value={regAddress} onChangeText={setRegAddress} placeholder="Survey No 142, Main Quarry Road" />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, regSaving && { opacity: 0.7 }]} onPress={handleRegisterQuarry} disabled={regSaving}>
                {regSaving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveText}>Save & Create Quarry</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  subTitle: { fontSize: 11, color: Colors.textSecondary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  linkText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  grid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  gridCard: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  gridNum: { fontSize: 22, fontWeight: '900' },
  gridLbl: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  quarryCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight, gap: 12 },
  quarryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  quarryAvatar: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  quarryName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  quarryOwner: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  quarryLoc: { fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  statusBadge: { backgroundColor: Colors.successLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.success },
  manageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.primarySurface, borderWidth: 1, borderColor: Colors.primaryBorder },
  manageBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  driverCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight },
  driverName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  driverSub: { fontSize: 12, color: Colors.textSecondary },
  driverStatus: { fontSize: 11, fontWeight: '700', color: Colors.info },
  emptyCard: { padding: 32, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight },
  emptyText: { fontSize: 13, color: Colors.textSecondary, marginTop: 8 },
  pinRoot: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  pinCard: { width: '100%', maxWidth: 400, backgroundColor: Colors.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  pinIconWrap: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  pinTitle: { fontSize: 22, fontWeight: '800', color: Colors.navy, textAlign: 'center' },
  pinSub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, overflow: 'hidden' },
  pinInput: { flex: 1, height: 48, paddingHorizontal: 12, fontSize: 15, color: Colors.text },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.dangerLight, borderRadius: 8, padding: 8, marginTop: 10 },
  errorText: { fontSize: 12, color: Colors.danger },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 10, marginTop: 14 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  pinHint: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { width: '100%', maxWidth: 500, backgroundColor: Colors.surface, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, paddingBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.navy },
  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  formInput: { height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: Colors.text, backgroundColor: Colors.background },
  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  cancelBtn: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
