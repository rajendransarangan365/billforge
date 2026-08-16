// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Button, Input, EmptyState } from '../src/components';
import { getDatabase, getDrivers, saveDriver } from '../src/database/db';

export default function DriversScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [password, setPassword] = useState('driver123');

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const list = await getDrivers(db);
      setDrivers(list);
    } catch (e) {
      console.error('Drivers load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadDrivers(); }, [loadDrivers]));

  const handleCreateDriver = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Driver name and phone number are required.');
      return;
    }
    setSaving(true);
    try {
      const db = await getDatabase();
      await saveDriver(db, {
        name: name.trim(),
        phone: phone.trim(),
        vehicle_no: vehicleNo.trim(),
        password: password.trim() || 'driver123',
      });
      setModalVisible(false);
      setName(''); setPhone(''); setVehicleNo(''); setPassword('driver123');
      loadDrivers();
    } catch (e) {
      Alert.alert('Error', 'Failed to save driver.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Driver Management</Text>
          <Text style={styles.headerSub}>{drivers.length} registered driver{drivers.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="person-add" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Driver Login Switch Banner */}
      <TouchableOpacity style={styles.portalBanner} onPress={() => router.push('/driver-login')}>
        <Ionicons name="key-outline" size={20} color={Colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.portalTitle}>Switch to Driver App Login</Text>
          <Text style={styles.portalSub}>Give login credentials to drivers for navigation & status</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : drivers.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No drivers registered"
          description="Add drivers to assign consignments and track live GPS"
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {drivers.map(d => (
            <View key={d.id} style={styles.card}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{d.name}</Text>
                <Text style={styles.driverMeta}>📱 {d.phone} · 🚚 {d.vehicle_no || 'No vehicle'}</Text>
                <Text style={styles.passwordText}>🔑 Password: {d.password || 'driver123'}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: d.status === 'On Duty' ? '#EFF6FF' : '#DCFCE7' }]}>
                <Text style={[styles.statusText, { color: d.status === 'On Duty' ? '#1D4ED8' : '#16A34A' }]}>{d.status || 'Available'}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Driver Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register New Driver</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: Spacing.lg }}>
              <Input label="Driver Full Name" value={name} onChangeText={setName} placeholder="e.g. Ramesh Kumar" icon="person-outline" />
              <Input label="Mobile / Login Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="e.g. 9876543210" icon="call-outline" />
              <Input label="Vehicle Registration Number" value={vehicleNo} onChangeText={setVehicleNo} placeholder="e.g. TN 38 AB 1234" icon="car-outline" />
              <Input label="Set Login Password" value={password} onChangeText={setPassword} placeholder="driver123" icon="key-outline" />

              <Button title="Save Driver Credentials" onPress={handleCreateDriver} loading={saving} style={{ marginTop: 12 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...Typography.h2, color: Colors.text },
  headerSub: { ...Typography.caption, color: Colors.textSecondary },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  portalBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: Spacing.lg, padding: Spacing.md,
    backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.primary,
  },
  portalTitle: { ...Typography.bodyMedium, color: Colors.primary, fontWeight: '700' },
  portalSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  driverName: { ...Typography.bodyLargeBold, color: Colors.text },
  driverMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  passwordText: { fontSize: 11, color: Colors.primary, marginTop: 2, fontWeight: '600' },
  statusBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  // Modal
  modalContent: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { ...Typography.h2, color: Colors.text },
});
