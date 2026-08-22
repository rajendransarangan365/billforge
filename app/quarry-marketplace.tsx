// @ts-nocheck
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, TextInput, Switch, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import {
  getDatabase, getMaterialCatalog, saveMaterialListing, deleteMaterialListing, toggleMaterialActive, getCompanyProfile,
} from '../src/database/db';

export default function QuarryMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { quarryId } = useAuth();
  const activeQuarryId = quarryId || 1;

  const [materials, setMaterials] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [matName, setMatName] = useState('');
  const [matPrice, setMatPrice] = useState('');
  const [matUnit, setMatUnit] = useState('unit');
  const [matMinOrder, setMatMinOrder] = useState('5');
  const [matHsn, setMatHsn] = useState('');
  const [matDesc, setMatDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const mats = await getMaterialCatalog(db, activeQuarryId);
      const prof = await getCompanyProfile(db, activeQuarryId);
      setMaterials(mats);
      setProfile(prof);
    } catch (e) {
      console.error('Marketplace load error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeQuarryId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openAddModal = () => {
    setEditingMaterial(null);
    setMatName(''); setMatPrice(''); setMatUnit('unit');
    setMatMinOrder('5'); setMatHsn(''); setMatDesc('');
    setModalVisible(true);
  };

  const openEditModal = (m) => {
    setEditingMaterial(m);
    setMatName(m.name || '');
    setMatPrice(String(m.price || m.price_per_unit || ''));
    setMatUnit(m.unit || m.unit_type || 'unit');
    setMatMinOrder(String(m.min_order || '5'));
    setMatHsn(m.hsn || '');
    setMatDesc(m.description || '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!matName.trim() || !matPrice) { Alert.alert('Required', 'Enter name and price.'); return; }
    setSaving(true);
    try {
      const db = await getDatabase();
      const listing = {
        id: editingMaterial?.id,
        name: matName.trim(), price: parseFloat(matPrice) || 0,
        price_per_unit: parseFloat(matPrice) || 0,
        unit: matUnit || 'unit', unit_type: matUnit || 'unit',
        min_order: parseInt(matMinOrder) || 5,
        hsn: matHsn.trim(), description: matDesc.trim(),
        is_active: editingMaterial?.is_active !== false,
      };
      await saveMaterialListing(db, activeQuarryId, listing);
      setModalVisible(false); await loadData();
      Alert.alert('Saved', 'Listing updated in marketplace.');
    } catch (e) { Alert.alert('Error', 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (m) => {
    try {
      const db = await getDatabase();
      await toggleMaterialActive(db, activeQuarryId, m.id);
      await loadData();
    } catch (e) { Alert.alert('Error', 'Failed to toggle.'); }
  };

  const handleDelete = (m) => {
    Alert.alert('Delete', 'Remove from marketplace?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { const db = await getDatabase(); await deleteMaterialListing(db, activeQuarryId, m.id); await loadData(); }
        catch (e) { Alert.alert('Error', 'Failed.'); }
      }},
    ]);
  };

  const activeMats = materials.filter(m => m.is_active !== false);
  const inactiveMats = materials.filter(m => m.is_active === false);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1F2C" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Quarry Marketplace</Text>
          <Text style={styles.headerSub}>Manage your public material listings</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Add Listing</Text>
        </TouchableOpacity>
      </View>

      {profile && (
        <View style={styles.profileBanner}>
          <View style={styles.profileIcon}><Ionicons name="business" size={22} color="#E57025" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{profile.name || profile.owner_name || 'Your Quarry'}</Text>
            <Text style={styles.profileSub}>{profile.location || profile.address || 'Location not set'}</Text>
          </View>
          <View style={styles.statsBadge}>
            <Text style={styles.statsNum}>{activeMats.length}</Text>
            <Text style={styles.statsLabel}>Active</Text>
          </View>
        </View>
      )}

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color="#E57025" /> : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {materials.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptySub}>Add materials so customers can find your quarry.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAddModal}>
                <Text style={styles.emptyBtnText}>+ Add First Listing</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {activeMats.length > 0 && (<>
                <Text style={styles.sectionLabel}>Active ({activeMats.length})</Text>
                {activeMats.map(m => (
                  <View key={m.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardIconCircle}><Ionicons name="cube-outline" size={20} color="#E57025" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardName}>{m.name}</Text>
                        <Text style={styles.cardSub}>{m.unit || m.unit_type || 'unit'} • Min: {m.min_order || 5}</Text>
                      </View>
                      <Text style={styles.cardPrice}>₹{Number(m.price || m.price_per_unit || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    {m.description ? <Text style={styles.cardDesc}>{m.description}</Text> : null}
                    <View style={styles.cardActions}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Switch value={m.is_active !== false} onValueChange={() => handleToggle(m)} trackColor={{ false: '#DDD', true: '#E57025' }} thumbColor="#FFF" />
                        <Text style={{ fontSize: 12, color: '#E57025' }}>Live</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(m)}>
                          <Ionicons name="pencil-outline" size={14} color="#E57025" /><Text style={[styles.btnText, { color: '#E57025' }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(m)}>
                          <Ionicons name="trash-outline" size={14} color="#EF4444" /><Text style={[styles.btnText, { color: '#EF4444' }]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </>)}
              {inactiveMats.length > 0 && (<>
                <Text style={[styles.sectionLabel, { marginTop: 20, color: '#9CA3AF' }]}>Hidden ({inactiveMats.length})</Text>
                {inactiveMats.map(m => (
                  <View key={m.id} style={[styles.card, { opacity: 0.6 }]}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardIconCircle}><Ionicons name="cube-outline" size={20} color="#9CA3AF" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardName, { color: '#6B7280' }]}>{m.name}</Text>
                        <Text style={styles.cardSub}>{m.unit || m.unit_type || 'unit'}</Text>
                      </View>
                      <Text style={[styles.cardPrice, { color: '#6B7280' }]}>₹{Number(m.price || m.price_per_unit || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.cardActions}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Switch value={false} onValueChange={() => handleToggle(m)} trackColor={{ false: '#DDD', true: '#E57025' }} thumbColor="#FFF" />
                        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Hidden</Text>
                      </View>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(m)}>
                        <Ionicons name="pencil-outline" size={14} color="#E57025" /><Text style={[styles.btnText, { color: '#E57025' }]}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>)}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingMaterial ? 'Edit Listing' : 'Add New Listing'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color="#374151" /></TouchableOpacity>
            </View>
            <ScrollView>
              {[
                { label: 'Material Name *', val: matName, set: setMatName, placeholder: 'e.g. M-Sand', kb: 'default' },
                { label: 'Price per Unit (₹) *', val: matPrice, set: setMatPrice, placeholder: '2600', kb: 'decimal-pad' },
                { label: 'Unit Type', val: matUnit, set: setMatUnit, placeholder: 'unit / ton / cft', kb: 'default' },
                { label: 'Min. Order', val: matMinOrder, set: setMatMinOrder, placeholder: '5', kb: 'numeric' },
                { label: 'HSN Code', val: matHsn, set: setMatHsn, placeholder: '2505', kb: 'default' },
                { label: 'Description', val: matDesc, set: setMatDesc, placeholder: 'Brief description...', kb: 'default', multi: true },
              ].map(f => (
                <View key={f.label} style={{ marginBottom: 14 }}>
                  <Text style={styles.inputLabel}>{f.label}</Text>
                  <TextInput
                    style={[styles.inputField, f.multi && { height: 72 }]}
                    value={f.val} onChangeText={f.set} placeholder={f.placeholder}
                    placeholderTextColor="#9CA3AF" keyboardType={f.kb} multiline={f.multi}
                  />
                </View>
              ))}
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Listing'}</Text>
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EAECF0' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1F2C' },
  headerSub: { fontSize: 12, color: '#6B7280' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E57025', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  profileBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', margin: 16, borderRadius: 14, padding: 14, borderLeftWidth: 4, borderLeftColor: '#E57025' },
  profileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF3EB', justifyContent: 'center', alignItems: 'center' },
  profileName: { fontSize: 15, fontWeight: '700', color: '#1A1F2C' },
  profileSub: { fontSize: 12, color: '#6B7280' },
  statsBadge: { alignItems: 'center', backgroundColor: '#FFF3EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  statsNum: { fontSize: 20, fontWeight: '800', color: '#E57025' },
  statsLabel: { fontSize: 11, color: '#E57025' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF3EB', justifyContent: 'center', alignItems: 'center' },
  cardName: { fontSize: 14, fontWeight: '700', color: '#1A1F2C' },
  cardSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  cardPrice: { fontSize: 16, fontWeight: '800', color: '#E57025' },
  cardDesc: { fontSize: 12, color: '#6B7280', marginTop: 8, marginLeft: 50 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#E57025', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#EF4444', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  btnText: { fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8 },
  emptyBtn: { backgroundColor: '#E57025', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, marginTop: 24 },
  emptyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1F2C' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputField: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1F2C' },
  saveBtn: { backgroundColor: '#E57025', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
