// @ts-nocheck
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView,
  Platform, Animated, Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, EmptyState, Button, Input } from '../../src/components';
import {
  getDatabase, getBills, deleteBill, getPaymentsForBill,
  savePayment, getAllPayments, voidBill, restoreBill,
  deleteBillsBulk, restoreBillVersion,
} from '../../src/database/db';
import { useAuth } from '../../src/context/AuthContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  const num = Number(n);
  if (isNaN(num)) return '₹0';
  const str = Number.isInteger(num) ? num.toString() : parseFloat(num.toFixed(2)).toString();
  const parts = str.split('.');
  let int = parts[0].replace(/^-/, '');
  let res = ''; let count = 0;
  for (let i = int.length - 1; i >= 0; i--) {
    if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) res = ',' + res;
    res = int[i] + res; count++;
  }
  if (parts[0].startsWith('-')) res = '-' + res;
  return `₹${res}${parts[1] ? '.' + parts[1] : ''}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getPaymentStatus(totalAmount, paidAmount) {
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount >= totalAmount) return 'paid';
  return 'partial';
}

const STATUS_CONFIG = {
  paid:    { label: '✅ Fully Paid',  bg: '#DCFCE7', border: '#86EFAC', text: '#16A34A' },
  partial: { label: '🟡 Partial',     bg: '#FEF9C3', border: '#FDE047', text: '#854D0E' },
  unpaid:  { label: '🔴 Unpaid',      bg: '#FEE2E2', border: '#FCA5A5', text: '#DC2626' },
};

const FILTER_TABS = ['All', 'Today', 'This Week', 'This Month'];

function matchesFilter(bill, filter) {
  const d = new Date(bill.created_at);
  const now = new Date();
  if (filter === 'Today') {
    return d.toDateString() === now.toDateString();
  }
  if (filter === 'This Week') {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }
  if (filter === 'This Month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  return true;
}

// ─── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({ bill, visible, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  const load = useCallback(async () => {
    if (!bill) return;
    const db = await getDatabase();
    const pmts = await getPaymentsForBill(db, bill.id);
    setHistory(pmts);
  }, [bill]);

  React.useEffect(() => { if (visible) { load(); setAmount(''); setNote(''); } }, [visible, load]);

  const handleSave = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { Alert.alert('Error', 'Enter a valid payment amount.'); return; }
    setSaving(true);
    try {
      const db = await getDatabase();
      await savePayment(db, {
        bill_id: bill.id,
        customer_name: bill.customer_name || '',
        amount: num,
        note: note.trim(),
      });
      setAmount(''); setNote('');
      await load();
      onSaved();
    } catch (e) { Alert.alert('Error', 'Failed to save payment.'); }
    finally { setSaving(false); }
  };

  if (!bill) return null;
  const totalPaid = history.reduce((s, p) => s + (p.amount || 0), 0);
  const balance = (bill.total_amount || 0) - totalPaid;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={pm.container}>
          {/* Header */}
          <View style={pm.header}>
            <View style={{ flex: 1 }}>
              <Text style={pm.title}>Record Payment</Text>
              <Text style={pm.sub}>{bill.customer_name || 'Unknown'} · Bill #{bill.bill_number}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={pm.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Summary pills */}
          <View style={pm.pillRow}>
            <View style={[pm.pill, { backgroundColor: '#EFF6FF' }]}>
              <Text style={pm.pillLabel}>Total Bill</Text>
              <Text style={[pm.pillVal, { color: Colors.primary }]}>{fmtCurrency(bill.total_amount)}</Text>
            </View>
            <View style={[pm.pill, { backgroundColor: '#F0FDF4' }]}>
              <Text style={pm.pillLabel}>Paid</Text>
              <Text style={[pm.pillVal, { color: '#16A34A' }]}>{fmtCurrency(totalPaid)}</Text>
            </View>
            <View style={[pm.pill, { backgroundColor: balance > 0 ? '#FEF2F2' : '#F0FDF4' }]}>
              <Text style={pm.pillLabel}>Balance</Text>
              <Text style={[pm.pillVal, { color: balance > 0 ? '#DC2626' : '#16A34A' }]}>{fmtCurrency(balance)}</Text>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
            {/* Add payment */}
            <View style={pm.section}>
              <Text style={pm.sectionTitle}>Add Payment</Text>
              <Input
                label="Amount Received (₹)"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="Enter amount"
                icon="cash-outline"
              />
              <Input
                label="Note (Optional)"
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Cash, UPI, Cheque #1234"
                icon="document-text-outline"
              />
              <Button
                title="Save Payment"
                onPress={handleSave}
                loading={saving}
                variant="success"
                icon="checkmark-circle-outline"
                style={{ marginTop: Spacing.sm }}
              />
            </View>

            {/* Payment history */}
            {history.length > 0 && (
              <View style={pm.section}>
                <Text style={pm.sectionTitle}>Payment History</Text>
                {history.map((p) => (
                  <View key={p.id} style={pm.histRow}>
                    <View style={pm.histIcon}>
                      <Ionicons name="cash-outline" size={16} color="#16A34A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={pm.histAmt}>{fmtCurrency(p.amount)}</Text>
                      {p.note ? <Text style={pm.histNote}>{p.note}</Text> : null}
                      <Text style={pm.histDate}>{fmtDate(p.paid_at)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 500, maxHeight: '80%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  verCard: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.surface, marginBottom: 10 },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.xl, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  title: { ...Typography.h2, color: Colors.text },
  sub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  pillRow: { flexDirection: 'row', gap: 8, padding: Spacing.lg },
  pill: { flex: 1, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center' },
  pillLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 2 },
  pillVal: { ...Typography.bodyLargeBold },
  section: { padding: Spacing.lg, gap: 8 },
  sectionTitle: { ...Typography.bodyLargeBold, color: Colors.text, marginBottom: 4 },
  histRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  histIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  histAmt: { ...Typography.bodyMedium, color: '#16A34A' },
  histNote: { ...Typography.caption, color: Colors.textSecondary },
  histDate: { ...Typography.caption, color: Colors.textTertiary, marginTop: 1 },
});

// ─── Version History Modal ───────────────────────────────────────────────────
function VersionHistoryModal({ bill, visible, onClose, onRestoreVersion }) {
  if (!bill) return null;
  const versions = bill.versions || [];
  const currentVersion = bill.version || 1;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pm.overlay}>
        <View style={pm.modalBox}>
          <View style={pm.header}>
            <View style={{ flex: 1 }}>
              <Text style={pm.title}>Version History — #{bill.bill_number}</Text>
              <Text style={pm.sub}>{bill.customer_name || 'Party'} · Current Version: v{currentVersion}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={pm.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            {/* Current Active Version */}
            <View style={[pm.verCard, { borderColor: Colors.primary, backgroundColor: '#EBF5FB' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.primary }}>v{currentVersion} (Current Active Version)</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>{fmtCurrency(bill.total_amount)}</Text>
              </View>
              <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 4 }}>Last Saved: {fmtDate(bill.updated_at || bill.created_at)}</Text>
            </View>

            {versions.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: Colors.textSecondary }}>No earlier version snapshots recorded for this bill.</Text>
              </View>
            ) : (
              versions.map((v, idx) => (
                <View key={idx} style={pm.verCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.navy }}>v{v.version || (idx + 1)} (Previous Snapshot)</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.navy }}>{fmtCurrency(v.total_amount)}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>Saved on: {fmtDate(v.saved_at)}</Text>
                  <TouchableOpacity
                    style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1' }}
                    onPress={() => onRestoreVersion(v.version)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary }}>Revert to v{v.version}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Bill Card ────────────────────────────────────────────────────────────────
function BillCard({
  bill, paidMap, onEdit, onPayment, onVoid, onRestore, onDelete, onViewPdf, onViewVersions,
  expanded, onToggle, isRecycleBin, isSelected, onSelectToggle,
}) {
  const totalPaid = paidMap[bill.id] || 0;
  const status = getPaymentStatus(bill.total_amount || 0, totalPaid);
  const cfg = STATUS_CONFIG[status];
  const balance = (bill.total_amount || 0) - totalPaid;
  const pct = bill.total_amount > 0 ? Math.min(100, (totalPaid / bill.total_amount) * 100) : 0;
  const versionNum = bill.version || 1;

  return (
    <View style={[bc.card, isRecycleBin && { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' }]}>
      {/* Top row */}
      <TouchableOpacity style={bc.topRow} onPress={onToggle} activeOpacity={0.8}>
        {isRecycleBin && (
          <TouchableOpacity onPress={onSelectToggle} style={{ paddingRight: 8, justifyContent: 'center' }}>
            <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={22} color={isSelected ? Colors.danger : Colors.textTertiary} />
          </TouchableOpacity>
        )}
        <View style={bc.leftCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={bc.customerName} numberOfLines={1}>{bill.customer_name || 'Unknown Party'}</Text>
            {!isRecycleBin ? (
              <View style={[bc.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                <Text style={[bc.statusText, { color: cfg.text }]}>{cfg.label}</Text>
              </View>
            ) : (
              <View style={[bc.statusBadge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                <Text style={[bc.statusText, { color: '#DC2626' }]}>🚫 VOIDED</Text>
              </View>
            )}

            {/* Version Badge */}
            <TouchableOpacity onPress={onViewVersions} style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#0369A1' }}>v{versionNum} {versionNum > 1 ? '• History' : ''}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <Text style={bc.meta}>#{bill.bill_number}</Text>
            <Text style={bc.meta}>·</Text>
            <Text style={bc.meta}>{fmtDate(bill.created_at)}</Text>
            {bill.template_name ? <><Text style={bc.meta}>·</Text><Text style={bc.meta}>{bill.template_name}</Text></> : null}
          </View>
        </View>

        <View style={bc.rightCol}>
          <Text style={bc.amount}>{fmtCurrency(bill.total_amount)}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textTertiary} style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>

      {/* Progress bar */}
      {!isRecycleBin && (
        <View style={bc.progressTrack}>
          <View style={[bc.progressFill, { width: `${pct}%`, backgroundColor: status === 'paid' ? '#16A34A' : status === 'partial' ? '#EAB308' : '#E5E7EB' }]} />
        </View>
      )}

      {/* Amount row */}
      {!isRecycleBin && (
        <View style={bc.amtRow}>
          <Text style={bc.amtLabel}>Paid: <Text style={{ color: '#16A34A', fontWeight: '600' }}>{fmtCurrency(totalPaid)}</Text></Text>
          {balance > 0 ? <Text style={bc.amtLabel}>Balance: <Text style={{ color: '#DC2626', fontWeight: '600' }}>{fmtCurrency(balance)}</Text></Text> : null}
        </View>
      )}

      {/* Expanded actions */}
      {expanded && (
        <View style={bc.actions}>
          {!isRecycleBin ? (
            <>
              <TouchableOpacity style={bc.actionBtn} onPress={onEdit}>
                <Ionicons name="create-outline" size={18} color={Colors.primary} />
                <Text style={[bc.actionLabel, { color: Colors.primary }]}>Edit (Prefill)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={bc.actionBtn} onPress={onViewPdf}>
                <Ionicons name="document-text-outline" size={18} color="#7C3AED" />
                <Text style={[bc.actionLabel, { color: '#7C3AED' }]}>View PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={bc.actionBtn} onPress={onPayment}>
                <Ionicons name="cash-outline" size={18} color="#16A34A" />
                <Text style={[bc.actionLabel, { color: '#16A34A' }]}>Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={bc.actionBtn} onPress={onVoid}>
                <Ionicons name="ban-outline" size={18} color="#D97706" />
                <Text style={[bc.actionLabel, { color: '#D97706' }]}>Void Bill</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={bc.actionBtn} onPress={onRestore}>
                <Ionicons name="refresh-outline" size={18} color="#16A34A" />
                <Text style={[bc.actionLabel, { color: '#16A34A' }]}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity style={bc.actionBtn} onPress={onDelete}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger || '#DC2626'} />
                <Text style={[bc.actionLabel, { color: Colors.danger || '#DC2626' }]}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const bc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.md, gap: 8 },
  leftCol: { flex: 1 },
  rightCol: { alignItems: 'flex-end' },
  customerName: { ...Typography.bodyLargeBold, color: Colors.text, flexShrink: 1 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '600' },
  meta: { ...Typography.caption, color: Colors.textSecondary },
  amount: { ...Typography.h3, color: Colors.text },
  progressTrack: { height: 4, backgroundColor: '#F3F4F6', marginHorizontal: Spacing.md },
  progressFill: { height: 4, borderRadius: 2 },
  amtRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 8 },
  amtLabel: { ...Typography.caption, color: Colors.textSecondary },
  actions: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.borderLight,
    backgroundColor: Colors.backgroundSecondary,
  },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, gap: 4 },
  actionLabel: { fontSize: 11, fontWeight: '600' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { quarryId } = useAuth();
  const activeQuarryId = quarryId || 1;

  const [mainTab, setMainTab] = useState<'active' | 'recycle'>('active');
  const [bills, setBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [paidMap, setPaidMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [paymentBill, setPaymentBill] = useState(null);

  // Version history modal & selection state
  const [versionModalBill, setVersionModalBill] = useState(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const loadBills = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      const list = await getBills(db, activeQuarryId);
      const allPayments = await getAllPayments(db, activeQuarryId);
      const pm = {};
      for (const p of allPayments) {
        pm[p.bill_id] = (pm[p.bill_id] || 0) + (p.amount || 0);
      }
      setBills(list);
      setPaidMap(pm);
      applyFilters(list, searchQuery, activeFilter, mainTab);
    } catch (error) {
      console.error('Error loading bills:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeFilter, activeQuarryId, mainTab]);

  useFocusEffect(useCallback(() => { loadBills(); }, [loadBills]));

  const applyFilters = (list, query, filter, tab) => {
    let result = list.filter(b => (tab === 'recycle' ? b.status === 'voided' : b.status !== 'voided'));
    result = result.filter(b => matchesFilter(b, filter));
    if (query.trim()) {
      const lower = query.toLowerCase();
      result = result.filter(b =>
        (b.customer_name || '').toLowerCase().includes(lower) ||
        (b.bill_number || '').toLowerCase().includes(lower) ||
        (b.template_name || '').toLowerCase().includes(lower)
      );
    }
    setFilteredBills(result);
  };

  const handleSearch = (q) => {
    setSearchQuery(q);
    applyFilters(bills, q, activeFilter, mainTab);
  };

  const handleFilter = (f) => {
    setActiveFilter(f);
    applyFilters(bills, searchQuery, f, mainTab);
  };

  const handleSwitchTab = (tab: 'active' | 'recycle') => {
    setMainTab(tab);
    setSelectedIds([]);
    applyFilters(bills, searchQuery, activeFilter, tab);
  };

  const handleVoidBill = async (bill) => {
    Alert.alert(
      'Void Bill 🚫',
      `Move bill #${bill.bill_number} for "${bill.customer_name}" to Recycle Bin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void Bill',
          style: 'destructive',
          onPress: async () => {
            const db = await getDatabase();
            await voidBill(db, bill.id, activeQuarryId);
            await loadBills();
          },
        },
      ]
    );
  };

  const handleRestoreBill = async (bill) => {
    const db = await getDatabase();
    await restoreBill(db, bill.id, activeQuarryId);
    Alert.alert('Restored 🔄', `Bill #${bill.bill_number} restored to Active Invoices.`);
    await loadBills();
  };

  const handleDeletePermanent = (bill) => {
    Alert.alert(
      'Permanently Delete',
      `Permanently delete bill #${bill.bill_number}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            const db = await getDatabase();
            await deleteBill(db, bill.id, activeQuarryId);
            await loadBills();
          },
        },
      ]
    );
  };

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    const db = await getDatabase();
    for (const id of selectedIds) {
      await restoreBill(db, id, activeQuarryId);
    }
    Alert.alert('Restored 🔄', `${selectedIds.length} bills restored to Active Invoices.`);
    setSelectedIds([]);
    await loadBills();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    Alert.alert(
      'Delete Selected Bills 🗑️',
      `Permanently delete ${selectedIds.length} voided bills? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            const db = await getDatabase();
            await deleteBillsBulk(db, selectedIds, activeQuarryId);
            setSelectedIds([]);
            await loadBills();
          },
        },
      ]
    );
  };

  const handleRevertVersion = async (versionNum: number) => {
    if (!versionModalBill) return;
    const db = await getDatabase();
    const success = await restoreBillVersion(db, versionModalBill.id, versionNum, activeQuarryId);
    if (success) {
      Alert.alert('Version Restored 🔄', `Reverted bill #${versionModalBill.bill_number} to Version v${versionNum}.`);
      setVersionModalBill(null);
      await loadBills();
    }
  };

  const handleEdit = (bill) => {
    router.push({ pathname: '/bill-form/[templateId]', params: { templateId: bill.template_id || 1, editBillId: bill.id } });
  };

  const handleViewPdf = (bill) => {
    if (bill.pdf_uri) {
      router.push({ pathname: '/bill-preview/[billId]', params: { billId: bill.id } });
    } else {
      Alert.alert('No PDF', 'No PDF was saved for this bill. Re-open and save the bill to generate a PDF.');
    }
  };

  const activeBillsList = bills.filter(b => b.status !== 'voided');
  const voidedBillsList = bills.filter(b => b.status === 'voided');

  const totalRevenue = activeBillsList.reduce((s, b) => s + (b.total_amount || 0), 0);
  const totalPaidAll = Object.values(paidMap).reduce((s, v) => s + v, 0);
  const totalPending = totalRevenue - totalPaidAll;

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}><Text style={styles.headerTitle}>Bill Management</Text></View>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Bill Management</Text>
          <Text style={styles.headerSub}>{activeBillsList.length} active bills · {voidedBillsList.length} in recycle bin</Text>
        </View>
        <TouchableOpacity style={styles.ledgerBtn} onPress={() => router.push('/ledger')}>
          <Ionicons name="book-outline" size={18} color="#7C3AED" />
          <Text style={styles.ledgerBtnText}>Ledger</Text>
        </TouchableOpacity>
      </View>

      {/* Main Segment Switcher (Active Invoices vs Recycle Bin) */}
      <View style={{ flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingTop: 10, gap: 10 }}>
        <TouchableOpacity
          style={[{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.surface }, mainTab === 'active' && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
          onPress={() => handleSwitchTab('active')}
        >
          <Text style={[{ fontSize: 13, fontWeight: '700', color: Colors.textSecondary }, mainTab === 'active' && { color: '#FFF' }]}>
            📄 Active Invoices ({activeBillsList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.surface }, mainTab === 'recycle' && { backgroundColor: Colors.danger, borderColor: Colors.danger }]}
          onPress={() => handleSwitchTab('recycle')}
        >
          <Text style={[{ fontSize: 13, fontWeight: '700', color: Colors.textSecondary }, mainTab === 'recycle' && { color: '#FFF' }]}>
            🗑️ Recycle Bin ({voidedBillsList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      {mainTab === 'active' && (
        <View style={styles.statsRow}>
          <View style={[styles.statPill, { backgroundColor: '#EFF6FF' }]}>
            <Text style={styles.statLabel}>Revenue</Text>
            <Text style={[styles.statVal, { color: Colors.primary }]}>{fmtCurrency(totalRevenue)}</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: '#F0FDF4' }]}>
            <Text style={styles.statLabel}>Collected</Text>
            <Text style={[styles.statVal, { color: '#16A34A' }]}>{fmtCurrency(totalPaidAll)}</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: totalPending > 0 ? '#FEF2F2' : '#F0FDF4' }]}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={[styles.statVal, { color: totalPending > 0 ? '#DC2626' : '#16A34A' }]}>{fmtCurrency(totalPending)}</Text>
          </View>
        </View>
      )}

      {/* Bulk Action Bar on Recycle Bin */}
      {mainTab === 'recycle' && voidedBillsList.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 8, backgroundColor: '#FFF5F5' }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            onPress={() => {
              if (selectedIds.length === filteredBills.length) setSelectedIds([]);
              else setSelectedIds(filteredBills.map(b => b.id));
            }}
          >
            <Ionicons name={selectedIds.length === filteredBills.length && filteredBills.length > 0 ? "checkbox" : "square-outline"} size={20} color={Colors.danger} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.danger }}>
              {selectedIds.length === filteredBills.length && filteredBills.length > 0 ? "Deselect All" : "Select All"} ({selectedIds.length})
            </Text>
          </TouchableOpacity>

          {selectedIds.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={{ backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }} onPress={handleBulkRestore}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>Restore ({selectedIds.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ backgroundColor: Colors.danger, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }} onPress={handleBulkDelete}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>Delete Permanently ({selectedIds.length})</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customer, bill no…"
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTER_TABS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
            onPress={() => handleFilter(f)}
          >
            <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bill list */}
      {filteredBills.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={mainTab === 'recycle' ? "trash-outline" : "receipt-outline"}
            title={mainTab === 'recycle' ? "Recycle Bin is empty" : "No active bills found"}
            description={searchQuery || activeFilter !== 'All' ? 'Try changing your search or filter' : mainTab === 'recycle' ? 'Voided bills will appear here' : 'Create your first bill to see it here'}
          />
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {filteredBills.map(bill => (
            <BillCard
              key={bill.id}
              bill={bill}
              paidMap={paidMap}
              expanded={expandedId === bill.id}
              isRecycleBin={mainTab === 'recycle'}
              isSelected={selectedIds.includes(bill.id)}
              onSelectToggle={() => {
                if (selectedIds.includes(bill.id)) setSelectedIds(selectedIds.filter(i => i !== bill.id));
                else setSelectedIds([...selectedIds, bill.id]);
              }}
              onToggle={() => setExpandedId(expandedId === bill.id ? null : bill.id)}
              onEdit={() => handleEdit(bill)}
              onViewPdf={() => handleViewPdf(bill)}
              onViewVersions={() => setVersionModalBill(bill)}
              onPayment={() => setPaymentBill(bill)}
              onVoid={() => handleVoidBill(bill)}
              onRestore={() => handleRestoreBill(bill)}
              onDelete={() => handleDeletePermanent(bill)}
            />
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* Payment Modal */}
      <PaymentModal
        bill={paymentBill}
        visible={!!paymentBill}
        onClose={() => setPaymentBill(null)}
        onSaved={loadBills}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        bill={versionModalBill}
        visible={!!versionModalBill}
        onClose={() => setVersionModalBill(null)}
        onRestoreVersion={handleRevertVersion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerTitle: { ...Typography.h1, color: Colors.text },
  headerSub: { ...Typography.caption, color: Colors.textSecondary },
  ledgerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5F3FF', borderRadius: BorderRadius.md,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  ledgerBtnText: { ...Typography.captionSemibold, color: '#7C3AED' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, padding: Spacing.md, backgroundColor: Colors.surface },
  statPill: { flex: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: 'center' },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 2 },
  statVal: { ...Typography.bodyLargeBold, fontSize: 13 },
  searchWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  searchInput: { flex: 1, ...Typography.body, color: Colors.text, padding: 0 },
  filterScroll: { flexGrow: 0, marginBottom: 4 },
  filterContent: { paddingHorizontal: Spacing.lg, gap: 8, paddingBottom: 8 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight,
  },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTabText: { ...Typography.captionSemibold, color: Colors.textSecondary },
  filterTabTextActive: { color: '#FFF' },
  list: { flex: 1 },
  listContent: { padding: Spacing.lg },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
