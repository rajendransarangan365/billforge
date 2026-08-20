// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, Button, Input, FAB } from '../../src/components';
import { getDatabase, getMaterials, saveMaterial, deleteMaterial } from '../../src/database/db';

import { useAuth } from '../../src/context/AuthContext';

export default function MaterialsScreen() {
  const insets = useSafeAreaInsets();
  const { companyId } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [formData, setFormData] = useState({ name: '', price_per_unit: '', unit_type: '' });

  const loadMaterials = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      const list = await getMaterials(db, companyId);
      setMaterials(list);
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useFocusEffect(useCallback(() => { loadMaterials(); }, [loadMaterials]));

  const handleSave = async () => {
    if (!formData.name || !formData.price_per_unit) {
      Alert.alert('Required', 'Please enter both name and price.');
      return;
    }
    setSaving(true);
    try {
      const db = await getDatabase();
      await saveMaterial(db, {
        id: editingMaterial?.id,
        company_id: companyId,
        name: formData.name,
        price_per_unit: parseFloat(formData.price_per_unit),
        unit_type: formData.unit_type,
      });
      setModalVisible(false);
      resetForm();
      loadMaterials();
    } catch (error) {
      Alert.alert('Error', 'Failed to save material.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    const performDelete = async () => {
      try {
        const db = await getDatabase();
        await deleteMaterial(db, id);
        loadMaterials();
      } catch (error) {
        Alert.alert('Error', 'Failed to delete material.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this material?')) performDelete();
    } else {
      Alert.alert('Delete Material', 'Delete this material?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  const openModal = (material = null) => {
    if (material) {
      setEditingMaterial(material);
      setFormData({ name: material.name, price_per_unit: String(material.price_per_unit), unit_type: material.unit_type || '' });
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const resetForm = () => {
    setEditingMaterial(null);
    setFormData({ name: '', price_per_unit: '', unit_type: '' });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Materials</Text>
          <Text style={styles.headerCount}>{materials.length} item{materials.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => openModal()} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color={Colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {materials.length === 0 && !loading ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="cube-outline" size={40} color={Colors.primaryLight} />
            </View>
            <Text style={styles.emptyTitle}>No materials yet</Text>
            <Text style={styles.emptySub}>Add materials with preset prices for faster billing.</Text>
            <Button
              title="Add First Material"
              onPress={() => openModal()}
              style={{ marginTop: Spacing.xl }}
              icon="add-circle-outline"
            />
          </View>
        ) : (
          materials.map(material => (
            <Card key={material.id} style={styles.materialCard}>
              <View style={styles.materialLeft}>
                <View style={styles.materialIconBox}>
                  <Ionicons name="cube" size={18} color={Colors.primaryLight} />
                </View>
                <View style={styles.materialTextArea}>
                  <Text style={styles.materialName}>{material.name}</Text>
                  <View style={styles.pricePill}>
                    <Text style={styles.materialPrice}>
                      Rs. {material.price_per_unit.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.unitText}>/ {material.unit_type || 'Unit'}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.materialActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.primarySurface }]}
                  onPress={() => openModal(material)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="pencil" size={16} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.dangerLight }]}
                  onPress={() => handleDelete(material.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
            {/* Handle */}
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editingMaterial ? 'Edit Material' : 'Add Material'}
            </Text>
            <Input
              label="Material Name"
              value={formData.name}
              onChangeText={(val) => setFormData(prev => ({ ...prev, name: val }))}
              placeholder="e.g. River Sand"
              icon="cube-outline"
            />
            <Input
              label="Price Per Unit (Rs.)"
              value={formData.price_per_unit}
              onChangeText={(val) => setFormData(prev => ({ ...prev, price_per_unit: val }))}
              placeholder="0.00"
              keyboardType="decimal-pad"
              icon="cash-outline"
            />
            <Input
              label="Unit Type (Optional)"
              value={formData.unit_type}
              onChangeText={(val) => setFormData(prev => ({ ...prev, unit_type: val }))}
              placeholder="e.g. kg, meter, unit"
              icon="resize-outline"
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setModalVisible(false)}
                variant="outline"
                style={styles.modalBtn}
              />
              <Button
                title="Save"
                onPress={handleSave}
                variant="primary"
                style={styles.modalBtn}
                icon="checkmark-circle-outline"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  headerCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  emptyWrap: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: Spacing.xxxl,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptySub: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  materialCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm + 2,
    paddingVertical: Spacing.md,
  },
  materialLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  materialIconBox: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  materialTextArea: { flex: 1 },
  materialName: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 3,
  },
  materialPrice: {
    ...Typography.captionMedium,
    color: Colors.success,
    fontWeight: '700',
  },
  unitText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  materialActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.overlay,
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    paddingTop: Spacing.md,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalBtn: { flex: 1 },
});
