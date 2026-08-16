// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, TextInput, Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Card, Button, Input } from '../src/components';
import { 
  getDatabase, getCustomersWithSummary, saveCustomer, deleteCustomer, getCompanyProfile, getTemplates 
} from '../src/database/db';

function formatIndianNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const n = Number(num);
  if (isNaN(n)) return '0';

  const numStr = Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();
  const parts = numStr.split('.');
  const isNegative = parts[0].startsWith('-');
  const intStr = isNegative ? parts[0].slice(1) : parts[0];

  let result = '';
  let count = 0;
  for (let i = intStr.length - 1; i >= 0; i--) {
    if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) result = ',' + result;
    result = intStr[i] + result;
    count++;
  }

  if (isNegative) result = '-' + result;
  if (parts.length > 1 && parts[1]) {
    result = `${result}.${parts[1]}`;
  }

  return result;
}

export default function CustomersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);

  // WhatsApp Share Modal
  const [whatsappModalVisible, setWhatsappModalVisible] = useState(false);
  const [selectedCustomerWhatsApp, setSelectedCustomerWhatsApp] = useState(null);
  const [whatsappPhone, setWhatsappPhone] = useState('');

  // Customer Invoices Drawer Modal
  const [invoicesModalVisible, setInvoicesModalVisible] = useState(false);
  const [selectedCustomerInvoices, setSelectedCustomerInvoices] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  const loadCustomersData = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      const list = await getCustomersWithSummary(db);
      const profile = await getCompanyProfile(db);
      const tmplList = await getTemplates(db);
      setCustomers(list);
      setCompanyProfile(profile);
      setTemplates(tmplList);
    } catch (error) {
      console.error('Error loading customer registry:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCustomersData();
    }, [loadCustomersData])
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
      await loadCustomersData();
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
        await loadCustomersData();
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

  // Open WhatsApp Ledger Statement Modal
  const openWhatsAppModal = (customer) => {
    setSelectedCustomerWhatsApp(customer);
    setWhatsappPhone(customer.phone || '');
    setWhatsappModalVisible(true);
  };

  // Generate WhatsApp Ledger Statement message text
  const generateWhatsAppLedgerMessage = () => {
    if (!selectedCustomerWhatsApp) return '';
    const shopName = companyProfile?.name || 'Our Shop';
    const customerName = selectedCustomerWhatsApp.name || 'Valued Customer';
    const billCount = selectedCustomerWhatsApp.billCount || 0;
    const totalBilled = formatIndianNumber(selectedCustomerWhatsApp.totalBilled || 0);
    const unclearedBal = formatIndianNumber(selectedCustomerWhatsApp.unclearedBalance || 0);
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return `📖 *LEDGER STATEMENT OF ACCOUNT*\n----------------------------------------\n*Merchant:* ${shopName}\n*Customer:* ${customerName}\n*Statement Date:* ${dateStr}\n----------------------------------------\n*💰 STATEMENT SUMMARY:*\n• Total Billed Invoices: ${billCount}\n• Total Purchases: Rs. ${totalBilled}\n• Uncleared Balance Due: Rs. ${unclearedBal}\n----------------------------------------\n_Please review and settle your ledger statement. Thank you for your business! - ${shopName}_`;
  };

  // Trigger sending WhatsApp message via deep link (serverless — no server needed)
  const handleSendWhatsAppLedger = async () => {
    if (!whatsappPhone.trim()) {
      Alert.alert('Error', 'Please enter a valid phone number.');
      return;
    }
    let cleanedPhone = whatsappPhone.replace(/\D/g, '');
    if (cleanedPhone.length === 10) {
      cleanedPhone = '91' + cleanedPhone;
    } else if (cleanedPhone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number.');
      return;
    }

    const message = generateWhatsAppLedgerMessage();
    const encodedMessage = encodeURIComponent(message);

    try {
      // Serverless: use wa.me deep link — opens WhatsApp directly with the statement pre-filled
      const whatsappUrl = `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
        setWhatsappModalVisible(false);
      } else {
        Alert.alert('WhatsApp Not Found', 'WhatsApp is not installed on this device. Please install WhatsApp and try again.');
      }
    } catch (error) {
      console.error('WhatsApp Ledger error:', error);
      Alert.alert('Error', 'Failed to open WhatsApp.');
    }
  };

  // Direct Call Action
  const handleCallCustomer = (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  // Open Customer Invoices Modal
  const openInvoicesModal = (customer) => {
    setSelectedCustomerInvoices(customer);
    setInvoicesModalVisible(true);
  };

  // Filter customers
  const filteredCustomers = customers.filter(c => {
    const nameMatch = (c.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = (c.phone || '').toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || phoneMatch;
  });

  // Calculate totals
  const totalRevenueAll = customers.reduce((sum, c) => sum + (c.totalBilled || 0), 0);
  const totalDuesAll = customers.reduce((sum, c) => sum + (c.unclearedBalance || 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Customer Registry</Text>
            <Text style={styles.headerSub}>Manage clients, ledgers & WhatsApp statements</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#25D366' }]} onPress={() => router.push('/whatsapp-settings')}>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
            <Ionicons name="person-add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Banner */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{customers.length}</Text>
          <Text style={styles.summaryLabel}>Clients</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.success }]}>₹{formatIndianNumber(totalRevenueAll)}</Text>
          <Text style={styles.summaryLabel}>Total Sales</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.danger }]}>₹{formatIndianNumber(totalDuesAll)}</Text>
          <Text style={styles.summaryLabel}>Total Dues</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by client name or phone…"
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

      {/* Main Registry List */}
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
              {searchQuery ? 'Try adjusting your search terms.' : 'Add your clients to manage ledger statements and share via WhatsApp.'}
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.customerName}>{customer.name}</Text>
                    {customer.phone ? (
                      <TouchableOpacity onPress={() => handleCallCustomer(customer.phone)} style={styles.callBadge}>
                        <Ionicons name="call-outline" size={12} color={Colors.primary} />
                        <Text style={styles.callBadgeText}>{customer.phone}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {customer.address ? (
                    <View style={[styles.detailRow, { alignItems: 'flex-start', marginTop: 4 }]}>
                      <Ionicons name="location-outline" size={14} color={Colors.textTertiary} style={{ marginTop: 2 }} />
                      <Text style={styles.detailText} numberOfLines={2}>{customer.address}</Text>
                    </View>
                  ) : null}

                  {/* Financial Metrics Badges */}
                  <View style={styles.metricsRow}>
                    <View style={styles.metricBadge}>
                      <Ionicons name="receipt-outline" size={12} color={Colors.accent} />
                      <Text style={styles.metricText}>{customer.billCount || 0} Bills</Text>
                    </View>
                    <View style={[styles.metricBadge, { backgroundColor: '#E8F8F5' }]}>
                      <Text style={[styles.metricText, { color: Colors.success, fontWeight: 'bold' }]}>
                        ₹{formatIndianNumber(customer.totalBilled || 0)}
                      </Text>
                    </View>
                    {customer.unclearedBalance > 0 && (
                      <View style={[styles.metricBadge, { backgroundColor: '#FDEDEC' }]}>
                        <Text style={[styles.metricText, { color: Colors.danger, fontWeight: 'bold' }]}>
                          Due: ₹{formatIndianNumber(customer.unclearedBalance)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Action Buttons Row */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.whatsappBtn]}
                  onPress={() => openWhatsAppModal(customer)}
                >
                  <Ionicons name="logo-whatsapp" size={15} color="#fff" />
                  <Text style={styles.whatsappBtnText}>WhatsApp Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.invoicesBtn]}
                  onPress={() => openInvoicesModal(customer)}
                >
                  <Ionicons name="documents-outline" size={15} color={Colors.accent} />
                  <Text style={styles.invoicesBtnText}>Invoices ({customer.billCount || 0})</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.editBtn]}
                  onPress={() => openModal(customer)}
                >
                  <Ionicons name="pencil" size={15} color={Colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDelete(customer.id, customer.name)}
                >
                  <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* WhatsApp Share Ledger Modal */}
      <Modal
        visible={whatsappModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setWhatsappModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                <Text style={styles.modalTitle}>Share Ledger Statement</Text>
              </View>
              <TouchableOpacity onPress={() => setWhatsappModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalForm}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.promptQuestion}>
                Send statement summary of {selectedCustomerWhatsApp?.name} via WhatsApp:
              </Text>

              <Input
                label="WhatsApp Phone Number"
                value={whatsappPhone}
                onChangeText={setWhatsappPhone}
                placeholder="e.g. 9876543210"
                keyboardType="phone-pad"
                icon="call-outline"
              />

              <Text style={styles.previewLabel}>WhatsApp Statement Preview</Text>
              <View style={styles.previewBox}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                  <Text style={styles.previewText}>{generateWhatsAppLedgerMessage()}</Text>
                </ScrollView>
              </View>

              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  onPress={() => setWhatsappModalVisible(false)}
                  variant="outline"
                  style={styles.modalBtn}
                />
                <Button
                  title="Send via WhatsApp"
                  onPress={handleSendWhatsAppLedger}
                  variant="success"
                  style={styles.modalBtn}
                  icon="logo-whatsapp"
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Customer Invoices Drawer / History Modal */}
      <Modal
        visible={invoicesModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInvoicesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="receipt-outline" size={22} color={Colors.primary} />
                <Text style={styles.modalTitle}>{selectedCustomerInvoices?.name}&apos;s Invoices</Text>
              </View>
              <TouchableOpacity onPress={() => setInvoicesModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              {(!selectedCustomerInvoices?.bills || selectedCustomerInvoices.bills.length === 0) ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} style={{ marginBottom: 8 }} />
                  <Text style={{ ...Typography.bodyMedium, color: Colors.textSecondary }}>No past invoices for this customer yet.</Text>
                </View>
              ) : (
                selectedCustomerInvoices.bills.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.invoiceItemCard}
                    onPress={() => {
                      setInvoicesModalVisible(false);
                      router.push(`/bill-preview/${b.id}`);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invoiceItemNum}>{b.bill_number || `Bill #${b.id}`}</Text>
                      <Text style={styles.invoiceItemDate}>
                        {new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.invoiceItemAmount}>₹{formatIndianNumber(b.total_amount)}</Text>
                      <Text style={styles.invoiceItemAction}>View PDF →</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add/Edit Customer Modal */}
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
                  Customer details are stored for search, automated autofill, and WhatsApp ledger statement sharing.
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
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  titleContainer: {
    flexDirection: 'column',
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
  },
  headerSub: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    ...Typography.captionSemibold,
    fontSize: 16,
    color: Colors.text,
  },
  summaryLabel: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.borderLight,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  centerContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyText: {
    ...Typography.h3,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySub: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  customerCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(79, 106, 245, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    ...Typography.h3,
    color: Colors.primary,
  },
  customerMeta: {
    flex: 1,
  },
  customerName: {
    ...Typography.bodyLargeBold,
    color: Colors.text,
  },
  callBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 106, 245, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  callBadgeText: {
    ...Typography.small,
    color: Colors.primary,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  detailText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
  },
  metricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  metricText: {
    ...Typography.small,
    color: Colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
  },
  whatsappBtnText: {
    ...Typography.captionSemibold,
    color: '#fff',
    marginLeft: 4,
  },
  invoicesBtn: {
    backgroundColor: Colors.accentSurface,
  },
  invoicesBtnText: {
    ...Typography.captionSemibold,
    color: Colors.accent,
    marginLeft: 4,
  },
  editBtn: {
    backgroundColor: Colors.primarySurface,
  },
  deleteBtn: {
    backgroundColor: '#FDEDEC',
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalForm: {
    paddingTop: Spacing.lg,
  },
  promptQuestion: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  previewLabel: {
    ...Typography.captionSemibold,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  previewBox: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  previewText: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(52, 152, 219, 0.08)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.md,
    alignItems: 'flex-start',
  },
  infoText: {
    ...Typography.caption,
    color: Colors.info,
    marginLeft: Spacing.sm,
    flex: 1,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  modalBtn: {
    flex: 1,
  },
  invoiceItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  invoiceItemNum: {
    ...Typography.bodyMedium,
    fontWeight: 'bold',
    color: Colors.text,
  },
  invoiceItemDate: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  invoiceItemAmount: {
    ...Typography.bodyMedium,
    fontWeight: 'bold',
    color: Colors.success,
  },
  invoiceItemAction: {
    ...Typography.caption,
    color: Colors.primary,
    marginTop: 2,
  },
});
