// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, Switch, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { getDatabase, getMaterialCatalog, saveMaterialListing, deleteMaterialListing, toggleMaterialActive } from '../src/database/db';

const MATERIAL_TYPES = ['River Sand Grade A', 'M-Sand (Manufactured Sand)', 'P-Sand (Plastering Sand)', 'Blue Metal 6mm', 'Blue Metal 12mm', 'Blue Metal 20mm (Jelly)', 'Blue Metal 40mm (Jelly)', 'Quarry Dust', 'Granite Gravel', 'Soil / Fill Gravel', 'Grit / Coarse Sand', 'Fly Ash Brick', 'Other'];
const UNITS = ['unit', 'ton', 'MT', 'CFT', 'load', 'trip'];

const DEFAULT_FORM = { name: '', price: '', unit: 'unit', min_order: '1', stock: '', hsn: '', description: '' };

export default function MaterialCatalogScreen() {
  const router = useRouter();
  const { user, quarryId: ctxQid } = useAuth();
  const qid = parseInt(ctxQid || user?.quarry_id || 1);

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [nameSearch, setNameSearch] = useState('');

  const loadMaterials = useCallback(async () => {
    try {
      const db = await getDatabase();
      const list = await getMaterialCatalog(db, qid);
      setMaterials(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [qid]);

  useEffect(() => { loadMaterials(); }, [loadMaterials]);

  const openAdd = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setModalVisible(true);
  };

  const openEdit = (mat) => {
    setEditing(mat);
    setForm({
      name: mat.name || '',
      price: String(mat.price || ''),
      unit: mat.unit || 'unit',
      min_order: String(mat.min_order || '1'),
      stock: String(mat.stock || ''),
      hsn: mat.hsn || '',
      description: mat.description || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Material name is required.'); return; }
    if (!form.price || isNaN(Number(form.price))) { Alert.alert('Please enter a valid price.'); return; }
    setSaving(true);
    try {
      const db = await getDatabase();
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        price: parseFloat(form.price) || 0,
        unit: form.unit,
        min_order: parseFloat(form.min_order) || 1,
        stock: form.stock ? parseFloat(form.stock) : null,
        hsn: form.hsn.trim(),
        description: form.description.trim(),
        is_active: editing ? editing.is_active : true,
      };
      await saveMaterialListing(db, qid, payload);
      setModalVisible(false);
      await loadMaterials();
    } catch (e) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (mat) => {
    Alert.alert('Delete Material?', `Remove "${mat.name}" from your catalog?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const db = await getDatabase();
          await deleteMaterialListing(db, qid, mat.id);
          await loadMaterials();
        }
      }
    ]);
  };

  const handleToggle = async (mat) => {
    const db = await getDatabase();
    await toggleMaterialActive(db, qid, mat.id);
    await loadMaterials();
  };

  const filtered = materials.filter(m => m.name?.toLowerCase().includes(nameSearch.toLowerCase()));
  const activeCount = materials.filter(m => m.is_active !== false).length;

  if (loading) return (
    <View style={styles.centerFlex}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🏔️ Material Catalog</Text>
          <Text style={styles.headerSub}>{activeCount} active listings • {materials.length} total</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={nameSearch}
          onChangeText={setNameSearch}
          placeholder="Search materials..."
          placeholderTextColor={Colors.textDisabled}
        />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMaterials(); }} />}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={48} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Materials Listed</Text>
            <Text style={styles.emptyText}>Add your quarry's materials and prices so customers can see them in the marketplace.</Text>
            <TouchableOpacity style={styles.addEmptyBtn} onPress={openAdd}>
              <Ionicons name="add-circle" size={18} color="#FFF" />
              <Text style={styles.addBtnText}>Add First Material</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map(mat => (
            <View key={mat.id} style={[styles.matCard, !mat.is_active && styles.matCardInactive]}>
              <View style={styles.matRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.matName}>{mat.name}</Text>
                  <Text style={styles.matPrice}>₹{(mat.price || 0).toLocaleString()} / {mat.unit}</Text>
                  {mat.stock != null && <Text style={styles.matSub}>📦 Stock: {mat.stock} {mat.unit}</Text>}
                  {mat.hsn ? <Text style={styles.matSub}>HSN: {mat.hsn}</Text> : null}
                  {mat.description ? <Text style={styles.matDesc} numberOfLines={1}>{mat.description}</Text> : null}
                </View>
                <View style={styles.matActions}>
                  <Switch
                    value={mat.is_active !== false}
                    onValueChange={() => handleToggle(mat)}
                    trackColor={{ false: Colors.border, true: '#A5D6A7' }}
                    thumbColor={mat.is_active !== false ? '#2E7D32' : '#aaa'}
                  />
                  <TouchableOpacity style={styles.editIcon} onPress={() => openEdit(mat)}>
                    <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteIcon} onPress={() => handleDelete(mat)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
              {!mat.is_active && (
                <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>PAUSED — Not visible to customers</Text></View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editing ? 'Edit Material' : 'Add New Material'}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Name */}
              <Text style={styles.fieldLabel}>Material Name *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {MATERIAL_TYPES.map(t => (
                    <TouchableOpacity key={t} style={[styles.typeChip, form.name === t && styles.typeChipActive]} onPress={() => setForm(f => ({ ...f, name: t }))}>
                      <Text style={[styles.typeChipText, form.name === t && styles.typeChipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="Or type custom material name" placeholderTextColor={Colors.textDisabled} />

              {/* Price */}
              <Text style={styles.fieldLabel}>Price per Unit (₹) *</Text>
              <TextInput style={styles.input} value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} placeholder="e.g. 2600" keyboardType="numeric" placeholderTextColor={Colors.textDisabled} />

              {/* Unit */}
              <Text style={styles.fieldLabel}>Unit of Measurement</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {UNITS.map(u => (
                  <TouchableOpacity key={u} style={[styles.typeChip, form.unit === u && styles.typeChipActive]} onPress={() => setForm(f => ({ ...f, unit: u }))}>
                    <Text style={[styles.typeChipText, form.unit === u && styles.typeChipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Min Order */}
              <Text style={styles.fieldLabel}>Minimum Order Quantity</Text>
              <TextInput style={styles.input} value={form.min_order} onChangeText={v => setForm(f => ({ ...f, min_order: v }))} placeholder="e.g. 5" keyboardType="numeric" placeholderTextColor={Colors.textDisabled} />

              {/* Stock */}
              <Text style={styles.fieldLabel}>Current Stock (Optional)</Text>
              <TextInput style={styles.input} value={form.stock} onChangeText={v => setForm(f => ({ ...f, stock: v }))} placeholder="e.g. 500" keyboardType="numeric" placeholderTextColor={Colors.textDisabled} />

              {/* HSN */}
              <Text style={styles.fieldLabel}>HSN Code (Optional)</Text>
              <TextInput style={styles.input} value={form.hsn} onChangeText={v => setForm(f => ({ ...f, hsn: v }))} placeholder="e.g. 2505" placeholderTextColor={Colors.textDisabled} />

              {/* Description */}
              <Text style={styles.fieldLabel}>Description / Grade Details</Text>
              <TextInput style={[styles.input, { minHeight: 72 }]} value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder="Quality, size, origin, etc." placeholderTextColor={Colors.textDisabled} multiline />

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>{editing ? 'Save Changes' : 'Add Material'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 12, color: Colors.textSecondary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, margin: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, height: 40 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  list: { flex: 1 },
  emptyCard: { alignItems: 'center', gap: 12, padding: 40, backgroundColor: Colors.surface, borderRadius: 16, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  addEmptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  matCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  matCardInactive: { opacity: 0.65, borderStyle: 'dashed' },
  matRow: { flexDirection: 'row', gap: 12 },
  matName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  matPrice: { fontSize: 17, fontWeight: '800', color: Colors.primary, marginTop: 2 },
  matSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  matDesc: { fontSize: 12, color: Colors.textTertiary, marginTop: 4, fontStyle: 'italic' },
  matActions: { alignItems: 'center', gap: 8 },
  editIcon: { padding: 6, backgroundColor: '#E3F2FD', borderRadius: 8 },
  deleteIcon: { padding: 6, backgroundColor: '#FFEBEE', borderRadius: 8 },
  inactiveBadge: { marginTop: 8, backgroundColor: '#FFF3E0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#FFB74D' },
  inactiveBadgeText: { fontSize: 10, fontWeight: '800', color: '#E65100' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.navy, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text, marginBottom: 14 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  typeChipActive: { borderColor: Colors.primary, backgroundColor: '#E8F5E9' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  typeChipTextActive: { color: Colors.primary, fontWeight: '700' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 24 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontWeight: '700', color: Colors.textSecondary },
  saveBtn: { flex: 2, height: 50, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontWeight: '700', color: '#FFF', fontSize: 15 },
});
