// @ts-nocheck
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, TextInput, Dimensions, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { getDatabase, getAllQuarryCatalogs, saveEnquiry } from '../src/database/db';

export default function CustomerMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const customerName = user?.name || 'Customer';
  const customerPhone = user?.phone || '';

  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Enquiry Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [targetQuarry, setTargetQuarry] = useState<any>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [quantity, setQuantity] = useState('10');
  const [unitType, setUnitType] = useState('unit');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadCatalogs = useCallback(async () => {
    try {
      const db = await getDatabase();
      const list = await getAllQuarryCatalogs(db);
      setCatalogs(list);
    } catch (e) {
      console.error('Customer Marketplace Load Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  const openEnquiryModal = (quarry: any, material: any) => {
    setTargetQuarry(quarry);
    setSelectedMaterial(material);
    setQuantity('10');
    setUnitType(material.unit_type || 'unit');
    setModalVisible(true);
  };

  const handleSendEnquiry = async () => {
    if (!customerPhone.trim()) {
      Alert.alert('Mobile Required', 'Please provide a contact mobile number.');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
      return;
    }

    setSubmitting(true);
    try {
      const db = await getDatabase();
      await saveEnquiry(db, {
        quarry_id: targetQuarry.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        material_name: selectedMaterial.name,
        quantity: parseFloat(quantity),
        unit_type: unitType,
        quoted_rate: selectedMaterial.price_per_unit || 0,
        customer_address: address.trim(),
        pickup_address: targetQuarry.location || targetQuarry.name,
      });

      Alert.alert('Enquiry Sent ✅', `Your enquiry for ${selectedMaterial.name} has been sent to ${targetQuarry.name}. They will call you shortly.`);
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to send enquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCatalogs = catalogs.map(c => {
    if (!searchQuery.trim()) return c;
    const qName = (c.quarry.name || '').toLowerCase();
    const qLoc = (c.quarry.location || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    if (qName.includes(query) || qLoc.includes(query)) return c;
    const matchedMats = c.materials.filter((m: any) => (m.name || '').toLowerCase().includes(query));
    if (matchedMats.length > 0) return { ...c, materials: matchedMats };
    return null;
  }).filter(Boolean);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/select-role')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Quarry Materials Marketplace</Text>
          <Text style={styles.subTitle}>Browse Live Material Rates & Enquire Directly</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarWrap}>
        <Ionicons name="search" size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search materials (River Sand, M-Sand, Blue Metal...) or location"
          placeholderTextColor={Colors.textDisabled}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={{ marginTop: 8, color: Colors.textSecondary }}>Loading Quarry Catalogs...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCatalogs(); }} colors={['#2E7D32']} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredCatalogs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="storefront-outline" size={40} color={Colors.textDisabled} />
              <Text style={styles.emptyTitle}>No Quarries Found</Text>
              <Text style={styles.emptySub}>No active quarry catalogs match your search query.</Text>
            </View>
          ) : (
            filteredCatalogs.map(({ quarry, materials }: any) => (
              <View key={quarry.id} style={styles.quarryCard}>
                <View style={styles.quarryHeader}>
                  <View style={styles.quarryBadge}>
                    <Ionicons name="business" size={20} color="#2E7D32" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quarryName}>{quarry.name}</Text>
                    <Text style={styles.quarrySub}><Ionicons name="location-outline" size={12} /> {quarry.location || 'Tamil Nadu'} • Phone: {quarry.phone}</Text>
                  </View>
                </View>

                {/* Materials List */}
                <Text style={styles.matSectionTitle}>Available Materials & Prices</Text>
                <View style={styles.matsGrid}>
                  {materials.map((m: any) => (
                    <View key={m.id || m.name} style={styles.matCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.matName}>{m.name}</Text>
                        <Text style={styles.matPrice}>₹{m.price_per_unit || 0} <Text style={styles.unitText}>/ {m.unit_type || 'unit'}</Text></Text>
                      </View>
                      <TouchableOpacity style={styles.enquireBtn} onPress={() => openEnquiryModal(quarry, m)}>
                        <Text style={styles.enquireBtnText}>Enquire</Text>
                        <Ionicons name="send" size={12} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Enquiry Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enquire Material</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {targetQuarry && selectedMaterial && (
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryQuarry}>{targetQuarry.name}</Text>
                  <Text style={styles.summaryMat}>{selectedMaterial.name} @ ₹{selectedMaterial.price_per_unit} / {selectedMaterial.unit_type || 'unit'}</Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Quantity Required</Text>
                  <TextInput style={styles.formInput} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="10" />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Unit Type</Text>
                  <TextInput style={styles.formInput} value={unitType} onChangeText={setUnitType} placeholder="unit / ton" />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Delivery Address / Site Location</Text>
                  <TextInput style={styles.formInput} value={address} onChangeText={setAddress} placeholder="Site address in Tiruppur..." />
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSendEnquiry} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.submitText}>Send Enquiry</Text>}
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
  title: { fontSize: 17, fontWeight: '800', color: Colors.navy },
  subTitle: { fontSize: 11, color: Colors.textSecondary },
  searchBarWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 44, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderLight, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  emptyCard: { padding: 36, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderLight, marginTop: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 10 },
  emptySub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  quarryCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.borderLight, gap: 12 },
  quarryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quarryBadge: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  quarryName: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  quarrySub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  matSectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  matsGrid: { gap: 8 },
  matCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderLight },
  matName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  matPrice: { fontSize: 14, fontWeight: '800', color: '#2E7D32', marginTop: 2 },
  unitText: { fontSize: 11, fontWeight: '400', color: Colors.textSecondary },
  enquireBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2E7D32', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  enquireBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { width: '100%', maxWidth: 480, backgroundColor: Colors.surface, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, paddingBottom: 10 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.navy },
  summaryBox: { backgroundColor: '#E8F5E9', padding: 12, borderRadius: 10, marginBottom: 12 },
  summaryQuarry: { fontSize: 14, fontWeight: '800', color: '#2E7D32' },
  summaryMat: { fontSize: 12, color: Colors.text, marginTop: 2 },
  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  formInput: { height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: Colors.text, backgroundColor: Colors.background },
  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  cancelBtn: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  submitBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: '#2E7D32', alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
