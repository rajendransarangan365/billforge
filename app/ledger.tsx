// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Card, EmptyState } from '../src/components';
import { getDatabase, getCustomerLedger, getMaterialLedger } from '../src/database/db';

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
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ProgressBar({ pct, color }) {
  return (
    <View style={{ height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <View style={{ width: `${Math.min(100, pct)}%`, height: 6, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

// ─── Customer Ledger Card ─────────────────────────────────────────────────────
function CustomerCard({ entry, expanded, onToggle }) {
  const pct = entry.totalBilled > 0 ? (entry.totalPaid / entry.totalBilled) * 100 : 0;
  const status = entry.balanceDue <= 0 ? 'paid' : entry.totalPaid > 0 ? 'partial' : 'unpaid';
  const statusColor = status === 'paid' ? '#16A34A' : status === 'partial' ? '#D97706' : '#DC2626';
  const statusLabel = status === 'paid' ? '✅ Cleared' : status === 'partial' ? '🟡 Partial' : '🔴 Unpaid';

  const sendWhatsApp = () => {
    const bills = entry.bills || [];
    const lastBill = bills[0];
    const phone = lastBill?.customer_phone;
    const name = entry.customerName;
    const msg = `📖 *Ledger Statement*\n*Customer:* ${name}\n*Total Billed:* ${fmtCurrency(entry.totalBilled)}\n*Paid:* ${fmtCurrency(entry.totalPaid)}\n*Balance Due:* ${fmtCurrency(entry.balanceDue)}\n\n_Please settle your account. Thank you!_`;
    const encoded = encodeURIComponent(msg);
    const url = phone ? `https://wa.me/91${phone.replace(/\D/g, '')}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    Linking.openURL(url);
  };

  return (
    <View style={cc.card}>
      <TouchableOpacity style={cc.header} onPress={onToggle} activeOpacity={0.8}>
        <View style={cc.avatar}>
          <Text style={cc.avatarText}>{(entry.customerName || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={cc.name} numberOfLines={1}>{entry.customerName}</Text>
            <View style={[cc.badge, { backgroundColor: status === 'paid' ? '#DCFCE7' : status === 'partial' ? '#FEF9C3' : '#FEE2E2' }]}>
              <Text style={[cc.badgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={cc.meta}>{entry.bills.length} bill{entry.bills.length !== 1 ? 's' : ''} · Last: {fmtDate(entry.bills[0]?.created_at)}</Text>
          <ProgressBar pct={pct} color={status === 'paid' ? '#16A34A' : status === 'partial' ? '#EAB308' : '#E5E7EB'} />
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textTertiary} style={{ marginTop: 4 }} />
      </TouchableOpacity>

      {/* Amount summary */}
      <View style={cc.amtRow}>
        <View style={cc.amtCell}>
          <Text style={cc.amtLabel}>Billed</Text>
          <Text style={[cc.amtVal, { color: Colors.primary }]}>{fmtCurrency(entry.totalBilled)}</Text>
        </View>
        <View style={cc.amtDivider} />
        <View style={cc.amtCell}>
          <Text style={cc.amtLabel}>Paid</Text>
          <Text style={[cc.amtVal, { color: '#16A34A' }]}>{fmtCurrency(entry.totalPaid)}</Text>
        </View>
        <View style={cc.amtDivider} />
        <View style={cc.amtCell}>
          <Text style={cc.amtLabel}>Balance</Text>
          <Text style={[cc.amtVal, { color: entry.balanceDue > 0 ? '#DC2626' : '#16A34A' }]}>
            {fmtCurrency(entry.balanceDue)}
          </Text>
        </View>
      </View>

      {/* Expanded bill list */}
      {expanded && (
        <View style={cc.billList}>
          <View style={cc.billListHeader}>
            <Text style={cc.billListTitle}>Bill History</Text>
            <TouchableOpacity style={cc.waBtn} onPress={sendWhatsApp}>
              <Ionicons name="logo-whatsapp" size={14} color="#FFF" />
              <Text style={cc.waBtnText}>Send Statement</Text>
            </TouchableOpacity>
          </View>
          {entry.bills.map(b => (
            <View key={b.id} style={cc.billRow}>
              <View style={{ flex: 1 }}>
                <Text style={cc.billNo}>#{b.bill_number} · {fmtDate(b.created_at)}</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                  <Text style={cc.billAmt}>Bill: {fmtCurrency(b.total_amount)}</Text>
                  <Text style={[cc.billAmt, { color: '#16A34A' }]}>Paid: {fmtCurrency(b.paidAmount)}</Text>
                </View>
              </View>
              {b.balanceDue > 0 && (
                <View style={cc.balDue}>
                  <Text style={cc.balDueText}>{fmtCurrency(b.balanceDue)}</Text>
                  <Text style={{ fontSize: 10, color: '#DC2626' }}>due</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const cc = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  name: { ...Typography.bodyLargeBold, color: Colors.text, flexShrink: 1 },
  meta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  amtRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.borderLight },
  amtCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  amtDivider: { width: 1, backgroundColor: Colors.borderLight, marginVertical: 8 },
  amtLabel: { ...Typography.caption, color: Colors.textSecondary },
  amtVal: { ...Typography.bodyLargeBold, fontSize: 13, marginTop: 2 },
  billList: { borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: Colors.backgroundSecondary },
  billListHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, paddingBottom: 6 },
  billListTitle: { ...Typography.captionSemibold, color: Colors.textSecondary },
  waBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#25D366', borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  waBtnText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  billRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  billNo: { ...Typography.captionSemibold, color: Colors.text },
  billAmt: { ...Typography.caption, color: Colors.textSecondary },
  balDue: { alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  balDueText: { ...Typography.captionSemibold, color: '#DC2626' },
});

// ─── Material Card ─────────────────────────────────────────────────────────────
function MaterialCard({ entry }) {
  return (
    <View style={mc.card}>
      <View style={mc.header}>
        <View style={mc.iconCircle}>
          <Ionicons name="cube-outline" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={mc.name}>{entry.materialName}</Text>
          <Text style={mc.meta}>{entry.billCount} transaction{entry.billCount !== 1 ? 's' : ''}</Text>
        </View>
        <View style={mc.revBadge}>
          <Text style={mc.revVal}>{fmtCurrency(entry.totalRevenue)}</Text>
          <Text style={mc.revLabel}>revenue</Text>
        </View>
      </View>
      <View style={mc.statsRow}>
        {entry.totalTrips > 0 && (
          <View style={mc.stat}>
            <Ionicons name="car-outline" size={14} color={Colors.textSecondary} />
            <Text style={mc.statVal}>{entry.totalTrips.toFixed(0)}</Text>
            <Text style={mc.statLabel}>Trips</Text>
          </View>
        )}
        {entry.totalUnits > 0 && (
          <View style={mc.stat}>
            <Ionicons name="layers-outline" size={14} color={Colors.textSecondary} />
            <Text style={mc.statVal}>{entry.totalUnits.toFixed(2)}</Text>
            <Text style={mc.statLabel}>Units</Text>
          </View>
        )}
        {entry.avgPrice > 0 && (
          <View style={mc.stat}>
            <Ionicons name="pricetag-outline" size={14} color={Colors.textSecondary} />
            <Text style={mc.statVal}>{fmtCurrency(entry.avgPrice)}</Text>
            <Text style={mc.statLabel}>Avg Rate</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const mc = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.md },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  name: { ...Typography.bodyLargeBold, color: Colors.text },
  meta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  revBadge: { alignItems: 'flex-end' },
  revVal: { ...Typography.h3, color: Colors.primary },
  revLabel: { ...Typography.caption, color: Colors.textSecondary },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.borderLight },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  statVal: { ...Typography.bodyMedium, color: Colors.text },
  statLabel: { ...Typography.caption, color: Colors.textSecondary },
});

// ─── Main Ledger Screen ────────────────────────────────────────────────────────
export default function LedgerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('customer');
  const [customerData, setCustomerData] = useState([]);
  const [materialData, setMaterialData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCustomer, setExpandedCustomer] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const [cust, mat] = await Promise.all([getCustomerLedger(db), getMaterialLedger(db)]);
      setCustomerData(cust);
      setMaterialData(mat);
    } catch (e) {
      console.error('Ledger load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Summary stats
  const totalBilled = customerData.reduce((s, c) => s + c.totalBilled, 0);
  const totalPaid = customerData.reduce((s, c) => s + c.totalPaid, 0);
  const totalPending = totalBilled - totalPaid;
  const totalMatRevenue = materialData.reduce((s, m) => s + m.totalRevenue, 0);

  return (
    <View style={[ls.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={ls.header}>
        <TouchableOpacity style={ls.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={ls.headerTitle}>Ledger Management</Text>
          <Text style={ls.headerSub}>Track payments by customer & material</Text>
        </View>
        <TouchableOpacity style={ls.refreshBtn} onPress={load}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      <View style={ls.summaryStrip}>
        <View style={ls.summaryItem}>
          <Text style={ls.summaryLabel}>Total Billed</Text>
          <Text style={[ls.summaryVal, { color: Colors.primary }]}>{fmtCurrency(totalBilled)}</Text>
        </View>
        <View style={ls.summaryDivider} />
        <View style={ls.summaryItem}>
          <Text style={ls.summaryLabel}>Collected</Text>
          <Text style={[ls.summaryVal, { color: '#16A34A' }]}>{fmtCurrency(totalPaid)}</Text>
        </View>
        <View style={ls.summaryDivider} />
        <View style={ls.summaryItem}>
          <Text style={ls.summaryLabel}>Pending Dues</Text>
          <Text style={[ls.summaryVal, { color: totalPending > 0 ? '#DC2626' : '#16A34A' }]}>{fmtCurrency(totalPending)}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={ls.tabs}>
        <TouchableOpacity
          style={[ls.tab, tab === 'customer' && ls.tabActive]}
          onPress={() => setTab('customer')}
        >
          <Ionicons name="people-outline" size={16} color={tab === 'customer' ? Colors.primary : Colors.textSecondary} />
          <Text style={[ls.tabText, tab === 'customer' && ls.tabTextActive]}>
            Customer Ledger ({customerData.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ls.tab, tab === 'material' && ls.tabActive]}
          onPress={() => setTab('material')}
        >
          <Ionicons name="cube-outline" size={16} color={tab === 'material' ? Colors.primary : Colors.textSecondary} />
          <Text style={[ls.tabText, tab === 'material' && ls.tabTextActive]}>
            Material Ledger ({materialData.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={ls.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ ...Typography.caption, color: Colors.textSecondary, marginTop: 12 }}>Building ledger…</Text>
        </View>
      ) : (
        <ScrollView style={ls.scroll} contentContainerStyle={ls.scrollContent}>
          {tab === 'customer' ? (
            customerData.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="No customer ledger yet"
                description="Save bills with customer names to see the ledger here"
              />
            ) : (
              <>
                {customerData.filter(c => c.balanceDue > 0).length > 0 && (
                  <View style={ls.sectionHeader}>
                    <Ionicons name="warning-outline" size={14} color="#DC2626" />
                    <Text style={[ls.sectionTitle, { color: '#DC2626' }]}>Outstanding Balances</Text>
                  </View>
                )}
                {customerData.filter(c => c.balanceDue > 0).map(entry => (
                  <CustomerCard
                    key={entry.customerName}
                    entry={entry}
                    expanded={expandedCustomer === entry.customerName}
                    onToggle={() => setExpandedCustomer(expandedCustomer === entry.customerName ? null : entry.customerName)}
                  />
                ))}
                {customerData.filter(c => c.balanceDue <= 0).length > 0 && (
                  <View style={ls.sectionHeader}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#16A34A" />
                    <Text style={[ls.sectionTitle, { color: '#16A34A' }]}>Fully Cleared</Text>
                  </View>
                )}
                {customerData.filter(c => c.balanceDue <= 0).map(entry => (
                  <CustomerCard
                    key={entry.customerName}
                    entry={entry}
                    expanded={expandedCustomer === entry.customerName}
                    onToggle={() => setExpandedCustomer(expandedCustomer === entry.customerName ? null : entry.customerName)}
                  />
                ))}
              </>
            )
          ) : (
            materialData.length === 0 ? (
              <EmptyState
                icon="cube-outline"
                title="No material data yet"
                description="Bills with material line items will appear here"
              />
            ) : (
              <>
                <View style={ls.sectionHeader}>
                  <Ionicons name="bar-chart-outline" size={14} color={Colors.primary} />
                  <Text style={ls.sectionTitle}>Total Material Revenue: {fmtCurrency(totalMatRevenue)}</Text>
                </View>
                {materialData.map(entry => (
                  <MaterialCard key={entry.materialName} entry={entry} />
                ))}
              </>
            )
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const ls = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: { ...Typography.h2, color: Colors.text },
  headerSub: { ...Typography.caption, color: Colors.textSecondary },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  summaryStrip: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  summaryLabel: { ...Typography.caption, color: Colors.textSecondary },
  summaryVal: { ...Typography.h3, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: Colors.borderLight, marginVertical: 8 },
  tabs: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight, marginBottom: 0,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary, backgroundColor: Colors.primarySurface + '60' },
  tabText: { ...Typography.captionSemibold, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8, marginTop: 4,
  },
  sectionTitle: { ...Typography.captionSemibold, color: Colors.textSecondary },
});
