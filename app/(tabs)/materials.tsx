// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, Modal, TextInput, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, Button, Input } from '../../src/components';
import { getDatabase, getMaterials, saveMaterial, deleteMaterial } from '../../src/database/db';

export default function MaterialsScreen() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    price_per_unit: '',
    unit_type: '',
  });

  const loadMaterials = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      const list = await getMaterials(db);
      setMaterials(list);
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMaterials();
    }, [loadMaterials])
  );

  const handleSave = async () => {
    if (!formData.name || !formData.price_per_unit) {
      Alert.alert('Error', 'Please enter both name and price.');
      return;
    }

    try {
      const db = await getDatabase();
      await saveMaterial(db, {
        id: editingMaterial?.id,
        name: formData.name,
        price_per_unit: parseFloat(formData.price_per_unit),
        unit_type: formData.unit_type,
      });
      
      setModalVisible(false);
      resetForm();
      loadMaterials();
    } catch (error) {
      console.error('Save material error:', error);
      Alert.alert('Error', 'Failed to save material.');
    }
  };

  const handleDelete = (id) => {
    const performDelete = async () => {
      try {
        const db = await getDatabase();
        await deleteMaterial(db, id);
        loadMaterials();
      } catch (error) {
        console.error('Delete material error:', error);
        Alert.alert('Error', 'Failed to delete material.');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to delete this material?');
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Material',
        'Are you sure you want to delete this material?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: performDelete
          }
        ]
      );
    }
  };

  const openModal = (material = null) => {
    if (material) {
      setEditingMaterial(material);
      setFormData({
        name: material.name,
        price_per_unit: String(material.price_per_unit),
        unit_type: material.unit_type || '',
      });
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Materials</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {materials.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyText}>No materials added yet.</Text>
            <Text style={styles.emptySub}>Add materials with preset prices for faster billing.</Text>
            <Button 
              title="Add First Material" 
              onPress={() => openModal()} 
              style={{ marginTop: Spacing.lg }}
              variant="primary"
            />
          </View>
        ) : (
          materials.map(material => (
            <Card key={material.id} style={styles.materialCard}>
              <View style={styles.materialInfo}>
                <Text style={styles.materialName}>{material.name}</Text>
                <Text style={styles.materialPrice}>Rs. {material.price_per_unit} / {material.unit_type || 'Unit'}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => openModal(material)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={20} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(material.id)} style={styles.actionBtn}>
                  <Ionicons name="trash" size={20} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingMaterial ? 'Edit Material' : 'Add New Material'}
            </Text>
            
            <Input
              label="Material Name"
              value={formData.name}
              onChangeText={(val) => setFormData(prev => ({ ...prev, name: val }))}
              placeholder="e.g. Material A"
            />
            
            <Input
              label="Price Per Unit"
              value={formData.price_per_unit}
              onChangeText={(val) => setFormData(prev => ({ ...prev, price_per_unit: val }))}
              placeholder="0.00"
              keyboardType="numeric"
            />
            
            <Input
              label="Unit Type (Optional)"
              value={formData.unit_type}
              onChangeText={(val) => setFormData(prev => ({ ...prev, unit_type: val }))}
              placeholder="e.g. kg, meter, unit"
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
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  materialCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  materialName: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  materialPrice: {
    ...Typography.small,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionBtn: {
    padding: Spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptySub: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    elevation: 5,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  modalBtn: {
    flex: 1,
  },
});
