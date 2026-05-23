// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Card, Button, Input } from '../src/components';
import { getDatabase, getCustomers, saveCustomer, deleteCustomer } from '../src/database/db';

export default function CustomersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      const list = await getCustomers(db);
      setCustomers(list);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [loadCustomers])
  );

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Required', 'Please enter a customer name.');
      return;
    }

    setSaving(true);
    try {
      const db = await getDatabase();
      await saveCustomer(db, {
        id: editingCustomer?.id,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
      });

      setModalVisible(false);
      resetForm();
      await loadCustomers();
      Alert.alert('Success', editingCustomer ? 'Customer updated successfully.' : 'Customer added successfully.');
    } catch (error) {
      console.error('Save customer error:', error);
      Alert.alert('Error', 'Failed to save customer details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, name) => {
    const performDelete = async () => {
      try {
        const db = await getDatabase();
        await deleteCustomer(db, id);
        await loadCustomers();
      } catch (error) {
        console.error('Delete customer error:', error);
        Alert.alert('Error', 'Failed to delete customer.');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to delete "${name}"? This will remove them from the directory, but past bills won't be affected.`);
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Customer',
        `Are you sure you want to delete "${name}"? This will remove them from the directory, but past bills won't be affected.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete,
          }
        ]
      );
    }
  };

  const openModal = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone || '',
        address: customer.address || '',
      });
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', address: '' });
  };

  // Filter customers by name or phone
  const filteredCustomers = customers.filter(c => {
    const nameMatch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = (c.phone || '').toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || phoneMatch;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Customer Directory</Text>
            <Text style={styles.headerSub}>Manage your clients & party names</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
          <Ionicons name="person-add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name or phone…"
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : filteredCustomers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={Colors.border} />
            <Text style={styles.emptyText}>No customers found</Text>
            <Text style={styles.emptySub}>
              {searchQuery ? 'Try adjusting your search terms.' : 'Add your regular customers for automatic autofill during billing.'}
            </Text>
            {!searchQuery && (
              <Button
                title="Add Customer"
                onPress={() => openModal()}
                style={{ marginTop: Spacing.lg }}
                icon="person-add-outline"
              />
            )}
          </View>
        ) : (
          filteredCustomers.map(customer => (
            <Card key={customer.id} style={styles.customerCard}>
              <View style={styles.cardHeader}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.avatarText}>
                    {customer.name ? customer.name.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
                <View style={styles.customerMeta}>
                  <Text style={styles.customerName}>{customer.name}</Text>
                  
                  {customer.phone ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="call-outline" size={14} color={Colors.textTertiary} />
                      <Text style={styles.detailText}>{customer.phone}</Text>
                    </View>
                  ) : null}

                  {customer.address ? (
                    <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                      <Ionicons name="location-outline" size={14} color={Colors.textTertiary} style={{ marginTop: 2 }} />
                      <Text style={styles.detailText} numberOfLines={2}>{customer.address}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.editBtn]}
                  onPress={() => openModal(customer)}
                >
                  <Ionicons name="pencil" size={16} color={Colors.primary} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDelete(customer.id, customer.name)}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCustomer ? 'Edit Customer Info' : 'New Customer'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalForm}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Input
                label="Customer / Party Name"
                value={formData.name}
                onChangeText={(val) => setFormData(prev => ({ ...prev, name: val }))}
                placeholder="Enter business or person name"
                required
                icon="business-outline"
              />

              <Input
                label="Phone Number (Internal Record)"
                value={formData.phone}
                onChangeText={(val) => setFormData(prev => ({ ...prev, phone: val }))}
                placeholder="Enter 10-digit mobile number"
                keyboardType="phone-pad"
                icon="call-outline"
              />

              <Input
                label="Resident Address (Internal Record)"
                value={formData.address}
                onChangeText={(val) => setFormData(prev => ({ ...prev, address: val }))}
                placeholder="Enter delivery/resident address"
                multiline
                numberOfLines={3}
                icon="location-outline"
              />

              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={18} color={Colors.info} />
                <Text style={styles.infoText}>
                  Phone number and address are stored securely for internal search and billing, and will never print on PDF invoices.
                </Text>
              </View>

              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  onPress={() => setModalVisible(false)}
                  variant="outline"
                  style={styles.modalBtn}
                />
                <Button
                  title="Save Details"
                  onPress={handleSave}
                  variant="primary"
                  loading={saving}
                  style={styles.modalBtn}
                  icon="checkmark"
                />
              </View>
            </ScrollView>
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    marginRight: Spacing.md,
    padding: 4,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  headerSub: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: '#8B3FC8',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B3FC8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  searchContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.md,
    height: 46,
    gap: Spacing.sm,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
    color: Colors.text,
    paddingVertical: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  centerContainer: {
    marginTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3E5FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    ...Typography.bodySemibold,
    color: '#8B3FC8',
    fontSize: 18,
  },
  customerMeta: {
    flex: 1,
    gap: 4,
  },
  customerName: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailText: {
    ...Typography.small,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    justifyContent: 'flex-end',
    gap: Spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  editBtn: {
    backgroundColor: Colors.primarySurface,
  },
  editBtnText: {
    ...Typography.small,
    color: Colors.primary,
    fontWeight: '500',
  },
  deleteBtn: {
    backgroundColor: Colors.dangerLight,
  },
  deleteBtnText: {
    ...Typography.small,
    color: Colors.danger,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: Spacing.xl,
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
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingBottom: Spacing.sm,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalForm: {
    marginBottom: Spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.infoLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginVertical: Spacing.lg,
    alignItems: 'flex-start',
  },
  infoText: {
    ...Typography.caption,
    color: Colors.info,
    flex: 1,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  modalBtn: {
    flex: 1,
  },
});
