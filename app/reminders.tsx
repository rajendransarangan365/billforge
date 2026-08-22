// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, Linking, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Card, Button, Input } from '../src/components';
import {
  getDatabase, getReminders, saveReminder, deleteReminder,
} from '../src/database/db';
import {
  schedulePaymentReminder, cancelPaymentReminder,
} from '../src/services/mobileNotificationService';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCurrency(n) {
  if (!n && n !== 0) return '₹0';
  const num = Number(n);
  const str = parseFloat(num.toFixed(2)).toString();
  const parts = str.split('.');
  let int = parts[0].replace(/^-/, '');
  let res = ''; let count = 0;
  for (let i = int.length - 1; i >= 0; i--) {
    if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) res = ',' + res;
    res = int[i] + res; count++;
  }
  if (parts[0].startsWith('-')) res = '-' + res;
  return `₹${res}${parts[1] && parts[1] !== '00' ? '.' + parts[1] : ''}`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function isOverdue(dateStr) {
  return new Date(dateStr) < new Date();
}

function getStatusConfig(reminder) {
  if (reminder.status === 'paid') return { label: '✅ Paid', bg: '#DCFCE7', text: '#16A34A', border: '#86EFAC' };
  if (reminder.status === 'partial') return { label: '🟡 Partial', bg: '#FEF9C3', text: '#854D0E', border: '#FDE047' };
  if (reminder.status === 'cancelled') return { label: '❌ Cancelled', bg: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' };
  if (isOverdue(reminder.promised_date)) return { label: '🔴 Overdue', bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' };
  return { label: '🔔 Pending', bg: '#FEF9C3', text: '#D97706', border: '#FDE68A' };
}

// ─── Record Payment Modal ─────────────────────────────────────────────────────
function RecordPaymentModal({ reminder, visible, onClose, onSaved }) {
  const [paidAmt, setPaidAmt] = useState('');
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && reminder) {
      setPaidAmt(reminder.paid_amount > 0 ? String(reminder.paid_amount) : '');
      setDiscount(reminder.discount_amount > 0 ? String(reminder.discount_amount) : '');
      setNote(reminder.note || '');
    }
  }, [visible, reminder]);

  if (!reminder) return null;

  const promised = reminder.promised_amount || 0;
  const discountVal = parseFloat(discount) || 0;
  const paidVal = parseFloat(paidAmt) || 0;
  const afterDiscount = promised - discountVal;
  const balance = afterDiscount - paidVal;
  const isFullyPaid = balance <= 0;

  const handleSave = async (status) => {
    if (paidVal < 0 || discountVal < 0) { Alert.alert('Invalid', 'Values cannot be negative.'); return; }
    setSaving(true);
    try {
      const db = await getDatabase();
      await saveReminder(db, {
        ...reminder,
        paid_amount: paidVal,
        discount_amount: discountVal,
        status,
        note: note.trim(),
      });
      onSaved();
      onClose();
    } catch (e) { Alert.alert('Error', 'Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={rp.container}>
          {/* Header */}
          <View style={rp.header}>
            <View style={{ flex: 1 }}>
              <Text style={rp.title}>Record Payment</Text>
              <Text style={rp.sub}>{reminder.customer_name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={rp.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {/* Summary */}
            <View style={rp.summaryCard}>
              <Text style={rp.sumLabel}>Promised Amount</Text>
              <Text style={rp.sumVal}>{fmtCurrency(promised)}</Text>
            </View>

            {/* Input fields */}
            <View style={{ padding: Spacing.lg, gap: 12 }}>
              <Input
                label="Discount Amount (₹)"
                value={discount}
                onChangeText={setDiscount}
                keyboardType="numeric"
                placeholder="0 if no discount"
                icon="pricetag-outline"
              />
              <Input
                label="Amount Received (₹)"
                value={paidAmt}
                onChangeText={setPaidAmt}
                keyboardType="numeric"
                placeholder="Enter amount paid"
                icon="cash-outline"
              />
              <Input
                label="Note (Optional)"
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Cash / UPI / Cheque"
                icon="document-text-outline"
              />

              {/* Live calculation */}
              <View style={rp.calcCard}>
                <View style={rp.calcRow}>
                  <Text style={rp.calcLabel}>Promised Amount:</Text>
                  <Text style={rp.calcVal}>{fmtCurrency(promised)}</Text>
                </View>
                {discountVal > 0 && (
                  <View style={rp.calcRow}>
                    <Text style={[rp.calcLabel, { color: '#D97706' }]}>(-) Discount:</Text>
                    <Text style={[rp.calcVal, { color: '#D97706' }]}>-{fmtCurrency(discountVal)}</Text>
                  </View>
                )}
                <View style={rp.calcRow}>
                  <Text style={rp.calcLabel}>Net Due After Discount:</Text>
                  <Text style={rp.calcVal}>{fmtCurrency(afterDiscount)}</Text>
                </View>
                {paidVal > 0 && (
                  <View style={rp.calcRow}>
                    <Text style={[rp.calcLabel, { color: '#16A34A' }]}>(-) Paid Now:</Text>
                    <Text style={[rp.calcVal, { color: '#16A34A' }]}>-{fmtCurrency(paidVal)}</Text>
                  </View>
                )}
                <View style={[rp.calcRow, { borderTopWidth: 1, borderTopColor: Colors.borderLight, marginTop: 6, paddingTop: 8 }]}>
                  <Text style={[rp.calcLabel, { fontWeight: '800', color: balance > 0 ? '#DC2626' : '#16A34A' }]}>
                    {balance > 0 ? 'Remaining Balance:' : '🎉 Fully Cleared!'}
                  </Text>
                  <Text style={[rp.calcVal, { fontWeight: '800', color: balance > 0 ? '#DC2626' : '#16A34A' }]}>
                    {balance > 0 ? fmtCurrency(balance) : fmtCurrency(0)}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <Button
                title="✅ Mark as Fully Paid"
                onPress={() => handleSave('paid')}
                loading={saving}
                variant="success"
                style={{ marginTop: 4 }}
              />
              {!isFullyPaid && paidVal > 0 && (
                <Button
                  title="💰 Mark as Partial Payment"
                  onPress={() => handleSave('partial')}
                  loading={saving}
                  variant="outline"
                />
              )}
              <Button
                title="❌ Cancel Reminder"
                onPress={() => Alert.alert('Cancel Reminder', 'Are you sure?', [
                  { text: 'No', style: 'cancel' },
                  { text: 'Yes', onPress: () => handleSave('cancelled'), style: 'destructive' },
                ])}
                variant="ghost"
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const rp = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.xl, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  title: { ...Typography.h2, color: Colors.text },
  sub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { backgroundColor: Colors.primarySurface, padding: Spacing.lg, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  sumLabel: { ...Typography.caption, color: Colors.textSecondary },
  sumVal: { ...Typography.h1, color: Colors.primary, marginTop: 4 },
  calcCard: {
    backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.md,
    padding: Spacing.md, gap: 4, borderWidth: 1, borderColor: Colors.borderLight,
  },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  calcLabel: { ...Typography.caption, color: Colors.textSecondary },
  calcVal: { ...Typography.captionSemibold, color: Colors.text },
});

// ─── Reminder Card ────────────────────────────────────────────────────────────
function ReminderCard({ reminder, highlighted, onRecord, onDelete }) {
  const overdue = isOverdue(reminder.promised_date);
  const cfg = getStatusConfig(reminder);
  const promised = reminder.promised_amount || 0;
  const discount = reminder.discount_amount || 0;
  const paid = reminder.paid_amount || 0;
  const balance = promised - discount - paid;
  const phone = reminder.customer_phone;

  const handleCall = () => {
    if (!phone) { Alert.alert('No phone', 'No phone number saved for this reminder.'); return; }
    Linking.openURL(`tel:${phone.replace(/\D/g, '')}`);
  };

  const handleWhatsApp = () => {
    const clean = (phone || '').replace(/\D/g, '');
    const num = clean.length === 10 ? `91${clean}` : clean;
    const msg = `Hi ${reminder.customer_name}, this is a payment reminder. You had promised to pay ${fmtCurrency(promised)}${discount > 0 ? ` (with ₹${discount} discount, net: ${fmtCurrency(promised - discount)})` : ''}. Current balance due: ${fmtCurrency(balance)}. Please settle at your earliest convenience. Thank you!`;
    Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`);
  };

  return (
    <View style={[
      card.container,
      overdue && reminder.status === 'pending' ? card.overdueBorder : null,
      highlighted ? card.highlighted : null,
    ]}>
      {/* Top row */}
      <View style={card.topRow}>
        <View style={card.avatar}>
          <Text style={card.avatarText}>{(reminder.customer_name || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={card.name}>{reminder.customer_name || 'Unknown'}</Text>
            <View style={[card.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
              <Text style={[card.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
            </View>
          </View>
          <Text style={card.date}>
            <Ionicons name="alarm-outline" size={12} color={Colors.textSecondary} />{' '}
            {fmtDateTime(reminder.promised_date)}
          </Text>
          {reminder.note ? <Text style={card.note}>{reminder.note}</Text> : null}
        </View>
      </View>

      {/* Amount breakdown */}
      <View style={card.amtRow}>
        <View style={card.amtCell}>
          <Text style={card.amtLabel}>Promised</Text>
          <Text style={[card.amtVal, { color: Colors.primary }]}>{fmtCurrency(promised)}</Text>
        </View>
        {discount > 0 && (
          <>
            <View style={card.amtDivider} />
            <View style={card.amtCell}>
              <Text style={card.amtLabel}>Discount</Text>
              <Text style={[card.amtVal, { color: '#D97706' }]}>{fmtCurrency(discount)}</Text>
            </View>
          </>
        )}
        {paid > 0 && (
          <>
            <View style={card.amtDivider} />
            <View style={card.amtCell}>
              <Text style={card.amtLabel}>Paid</Text>
              <Text style={[card.amtVal, { color: '#16A34A' }]}>{fmtCurrency(paid)}</Text>
            </View>
          </>
        )}
        <View style={card.amtDivider} />
        <View style={card.amtCell}>
          <Text style={card.amtLabel}>Balance</Text>
          <Text style={[card.amtVal, { color: balance > 0 ? '#DC2626' : '#16A34A', fontWeight: '800' }]}>
            {fmtCurrency(Math.max(0, balance))}
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={card.actions}>
        {phone ? (
          <TouchableOpacity style={[card.actionBtn, { backgroundColor: '#DCFCE7' }]} onPress={handleCall}>
            <Ionicons name="call" size={16} color="#16A34A" />
            <Text style={[card.actionText, { color: '#16A34A' }]}>Call</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[card.actionBtn, { backgroundColor: '#E8F8F5' }]} onPress={handleWhatsApp}>
          <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
          <Text style={[card.actionText, { color: '#25D366' }]}>WhatsApp</Text>
        </TouchableOpacity>
        {reminder.status === 'pending' || reminder.status === 'partial' ? (
          <TouchableOpacity style={[card.actionBtn, { backgroundColor: Colors.primarySurface, flex: 1 }]} onPress={onRecord}>
            <Ionicons name="cash-outline" size={16} color={Colors.primary} />
            <Text style={[card.actionText, { color: Colors.primary }]}>Record Payment</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[card.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  overdueBorder: { borderColor: '#FCA5A5', borderWidth: 2 },
  highlighted: { borderColor: Colors.primary, borderWidth: 2 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: Spacing.md },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  name: { ...Typography.bodyLargeBold, color: Colors.text },
  badge: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  date: { ...Typography.caption, color: Colors.textSecondary, marginTop: 3 },
  note: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2, fontStyle: 'italic' },
  amtRow: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.borderLight,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  amtCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  amtDivider: { width: 1, backgroundColor: Colors.borderLight, marginVertical: 8 },
  amtLabel: { ...Typography.caption, color: Colors.textSecondary },
  amtVal: { ...Typography.bodyLargeBold, fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, padding: Spacing.sm, backgroundColor: Colors.backgroundSecondary },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { fontSize: 12, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RemindersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const highlightId = params.highlight ? parseInt(params.highlight) : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const list = await getReminders(db);
      setReminders(list);
    } catch (e) { console.error('Reminders load error:', e); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (r) => {
    Alert.alert('Delete Reminder', `Delete reminder for ${r.customer_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (r.notification_id) await cancelPaymentReminder(r.notification_id);
          const db = await getDatabase();
          await deleteReminder(db, r.id);
          await load();
        },
      },
    ]);
  };

  // Tab filter
  const now = new Date().toISOString();
  const pending = reminders.filter(r => r.status === 'pending' || r.status === 'partial');
  const overdue = pending.filter(r => r.promised_date < now);
  const upcoming = pending.filter(r => r.promised_date >= now);
  const done = reminders.filter(r => r.status === 'paid' || r.status === 'cancelled');

  const displayList = activeTab === 'pending' ? pending : done;
  const overdueInPending = activeTab === 'pending' ? overdue : [];
  const upcomingInPending = activeTab === 'pending' ? upcoming : [];

  // Stats
  const totalPromised = pending.reduce((s, r) => s + (r.promised_amount || 0), 0);
  const totalPaid = pending.reduce((s, r) => s + (r.paid_amount || 0), 0);
  const totalBalance = pending.reduce((s, r) => {
    return s + Math.max(0, (r.promised_amount || 0) - (r.discount_amount || 0) - (r.paid_amount || 0));
  }, 0);

  return (
    <View style={[ls.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={ls.header}>
        <TouchableOpacity style={ls.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={ls.headerTitle}>Payment Reminders</Text>
          <Text style={ls.headerSub}>{pending.length} active · {overdue.length} overdue</Text>
        </View>
        <TouchableOpacity style={ls.refreshBtn} onPress={load}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      {pending.length > 0 && (
        <View style={ls.summaryStrip}>
          <View style={ls.sumItem}>
            <Text style={ls.sumLabel}>Expected</Text>
            <Text style={[ls.sumVal, { color: Colors.primary }]}>{fmtCurrency(totalPromised)}</Text>
          </View>
          <View style={ls.sumDiv} />
          <View style={ls.sumItem}>
            <Text style={ls.sumLabel}>Collected</Text>
            <Text style={[ls.sumVal, { color: '#16A34A' }]}>{fmtCurrency(totalPaid)}</Text>
          </View>
          <View style={ls.sumDiv} />
          <View style={ls.sumItem}>
            <Text style={ls.sumLabel}>Outstanding</Text>
            <Text style={[ls.sumVal, { color: totalBalance > 0 ? '#DC2626' : '#16A34A' }]}>{fmtCurrency(totalBalance)}</Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={ls.tabs}>
        <TouchableOpacity
          style={[ls.tab, activeTab === 'pending' && ls.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Ionicons name="alarm-outline" size={15} color={activeTab === 'pending' ? Colors.primary : Colors.textSecondary} />
          <Text style={[ls.tabText, activeTab === 'pending' && ls.tabTextActive]}>
            Active ({pending.length})
          </Text>
          {overdue.length > 0 && (
            <View style={ls.tabBadge}><Text style={ls.tabBadgeText}>{overdue.length}</Text></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[ls.tab, activeTab === 'done' && ls.tabActive]}
          onPress={() => setActiveTab('done')}
        >
          <Ionicons name="checkmark-circle-outline" size={15} color={activeTab === 'done' ? Colors.primary : Colors.textSecondary} />
          <Text style={[ls.tabText, activeTab === 'done' && ls.tabTextActive]}>
            Completed ({done.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={ls.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : displayList.length === 0 ? (
        <View style={ls.empty}>
          <Ionicons name="alarm-outline" size={48} color={Colors.textTertiary} />
          <Text style={ls.emptyTitle}>{activeTab === 'pending' ? 'No active reminders' : 'No completed reminders'}</Text>
          <Text style={ls.emptySub}>
            {activeTab === 'pending'
              ? 'Set a payment reminder from any bill in the Bills tab'
              : 'Completed reminders will appear here'}
          </Text>
        </View>
      ) : (
        <ScrollView style={ls.scroll} contentContainerStyle={ls.scrollContent}>
          {/* Overdue section */}
          {overdueInPending.length > 0 && (
            <>
              <View style={ls.sectionHead}>
                <View style={[ls.sectionDot, { backgroundColor: '#DC2626' }]} />
                <Text style={[ls.sectionHeadText, { color: '#DC2626' }]}>
                  🔴 Overdue ({overdueInPending.length})
                </Text>
              </View>
              {overdueInPending.map(r => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  highlighted={r.id === highlightId}
                  onRecord={() => { setSelectedReminder(r); setPaymentModalVisible(true); }}
                  onDelete={() => handleDelete(r)}
                />
              ))}
            </>
          )}

          {/* Upcoming section */}
          {upcomingInPending.length > 0 && (
            <>
              <View style={ls.sectionHead}>
                <View style={[ls.sectionDot, { backgroundColor: '#D97706' }]} />
                <Text style={[ls.sectionHeadText, { color: '#D97706' }]}>
                  🔔 Upcoming ({upcomingInPending.length})
                </Text>
              </View>
              {upcomingInPending.map(r => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  highlighted={r.id === highlightId}
                  onRecord={() => { setSelectedReminder(r); setPaymentModalVisible(true); }}
                  onDelete={() => handleDelete(r)}
                />
              ))}
            </>
          )}

          {/* Done tab */}
          {activeTab === 'done' && done.map(r => (
            <ReminderCard
              key={r.id}
              reminder={r}
              highlighted={r.id === highlightId}
              onRecord={() => { setSelectedReminder(r); setPaymentModalVisible(true); }}
              onDelete={() => handleDelete(r)}
            />
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <RecordPaymentModal
        reminder={selectedReminder}
        visible={paymentModalVisible}
        onClose={() => { setPaymentModalVisible(false); setSelectedReminder(null); }}
        onSaved={load}
      />
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
  sumItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  sumLabel: { ...Typography.caption, color: Colors.textSecondary },
  sumVal: { ...Typography.h3, marginTop: 2 },
  sumDiv: { width: 1, backgroundColor: Colors.borderLight, marginVertical: 8 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary, backgroundColor: Colors.primarySurface + '40' },
  tabText: { ...Typography.captionSemibold, color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  tabBadge: { backgroundColor: '#DC2626', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tabBadgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: 10 },
  emptyTitle: { ...Typography.h3, color: Colors.textSecondary, textAlign: 'center' },
  emptySub: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionHeadText: { ...Typography.captionSemibold },
});
