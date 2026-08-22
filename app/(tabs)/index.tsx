// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Linking, Alert, Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import {
  getDatabase, getBillCount, getBillsThisMonth, getTemplates,
  getBills, getAllDrafts, getAllPayments, getActiveReminders, getOverdueReminders,
} from '../../src/database/db';
import { setupAndroidChannel, requestNotificationPermissions, addNotificationTapListener } from '../../src/services/notificationService';
import { useAuth } from '../../src/context/AuthContext';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCurrency(n) {
  if (!n && n !== 0) return '₹0';
  const num = Number(n);
  const str = Number.isInteger(num) ? num.toString() : parseFloat(num.toFixed(0)).toString();
  const parts = str.split('.');
  let int = parts[0].replace(/^-/, '');
  let res = ''; let count = 0;
  for (let i = int.length - 1; i >= 0; i--) {
    if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) res = ',' + res;
    res = int[i] + res; count++;
  }
  if (parts[0].startsWith('-')) res = '-' + res;
  return `₹${res}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayStr() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────
function FinanceStat({ label, value, color, icon }) {
  return (
    <View style={fs.item}>
      <View style={[fs.iconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[fs.value, { color }]}>{value}</Text>
      <Text style={fs.label}>{label}</Text>
    </View>
  );
}
const fs = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', gap: 4 },
  iconBox: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  value: { ...Typography.bodyLargeBold, fontSize: 14 },
  label: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center' },
});

// ─── Quick Action Pill ────────────────────────────────────────────────────────
function QuickAction({ icon, label, color, bg, onPress, badge }) {
  return (
    <TouchableOpacity style={[qa.btn, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.82}>
      {badge > 0 && (
        <View style={qa.badge}>
          <Text style={qa.badgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[qa.label, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const qa = StyleSheet.create({
  btn: {
    width: 80, height: 80, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#DC2626', borderRadius: 10, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 2, borderColor: Colors.background,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
});

// ─── Reminder Chip ────────────────────────────────────────────────────────────
function ReminderChip({ reminder, onPress }) {
  const isOverdue = new Date(reminder.promised_date) < new Date();
  const finalDue = (reminder.promised_amount || 0) - (reminder.discount_amount || 0) - (reminder.paid_amount || 0);
  return (
    <TouchableOpacity
      style={[rc.chip, isOverdue ? rc.overdue : rc.upcoming]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Ionicons
          name={isOverdue ? 'warning' : 'alarm-outline'}
          size={14}
          color={isOverdue ? '#DC2626' : '#D97706'}
        />
        <Text style={[rc.status, { color: isOverdue ? '#DC2626' : '#D97706' }]}>
          {isOverdue ? 'OVERDUE' : 'DUE SOON'}
        </Text>
      </View>
      <Text style={rc.name} numberOfLines={1}>{reminder.customer_name}</Text>
      <Text style={rc.amount}>{fmtCurrency(finalDue)}</Text>
      <Text style={rc.date}>{fmtDate(reminder.promised_date)}</Text>
      {reminder.customer_phone ? (
        <TouchableOpacity
          style={rc.callBtn}
          onPress={() => Linking.openURL(`tel:${reminder.customer_phone.replace(/\D/g, '')}`)}
        >
          <Ionicons name="call" size={12} color="#FFF" />
          <Text style={rc.callText}>Call</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}
const rc = StyleSheet.create({
  chip: {
    width: 140, borderRadius: 16, padding: 12,
    marginRight: 10, borderWidth: 1.5,
  },
  overdue: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  upcoming: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  status: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  name: { ...Typography.bodyMedium, color: Colors.text, marginBottom: 2 },
  amount: { ...Typography.h3, color: Colors.text, fontSize: 16 },
  date: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#16A34A', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 6,
    alignSelf: 'flex-start',
  },
  callText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
});

// ─── Bill Row ─────────────────────────────────────────────────────────────────
function RecentBillRow({ bill, paidMap, onPress }) {
  const paid = paidMap[bill.id] || 0;
  const status = paid <= 0 ? 'unpaid' : paid >= (bill.total_amount || 0) ? 'paid' : 'partial';
  const badgeCfg = {
    paid:    { bg: '#DCFCE7', text: '#16A34A', label: '✅ Paid' },
    partial: { bg: '#FEF9C3', text: '#854D0E', label: '🟡 Partial' },
    unpaid:  { bg: '#FEE2E2', text: '#DC2626', label: '⚪ Unpaid' },
  }[status];

  return (
    <TouchableOpacity style={rb.row} onPress={onPress} activeOpacity={0.8}>
      <View style={rb.avatar}>
        <Text style={rb.avatarText}>{((bill.customer_name || 'B')[0]).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={rb.name} numberOfLines={1}>{bill.customer_name || 'Unknown Party'}</Text>
        <Text style={rb.meta}>#{bill.bill_number} · {fmtDate(bill.created_at)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={rb.amount}>{fmtCurrency(bill.total_amount)}</Text>
        <View style={[rb.badge, { backgroundColor: badgeCfg.bg }]}>
          <Text style={[rb.badgeText, { color: badgeCfg.text }]}>{badgeCfg.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
const rb = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...Typography.bodyLargeBold, color: Colors.primary, fontSize: 16 },
  name: { ...Typography.bodyMedium, color: Colors.text },
  meta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  amount: { ...Typography.captionSemibold, color: Colors.text },
  badge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState({ totalBills: 0, monthlyBills: 0, monthlyRevenue: 0, templateCount: 0 });
  const [recentBills, setRecentBills] = useState([]);
  const [paidMap, setPaidMap] = useState({});
  const [pendingDraft, setPendingDraft] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Set up Android notification channel + tap listener
  useEffect(() => {
    setupAndroidChannel();
    requestNotificationPermissions();
    const unsub = addNotificationTapListener((reminderId) => {
      router.push(`/reminders?highlight=${reminderId}`);
    });
    return unsub;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const [totalBills, monthly, templates, bills, drafts, allPayments, activeReminders] = await Promise.all([
        getBillCount(db),
        getBillsThisMonth(db),
        getTemplates(db),
        getBills(db),
        getAllDrafts(),
        getAllPayments(db),
        getActiveReminders(db),
      ]);

      const pm = {};
      let tPaid = 0;
      for (const p of allPayments) {
        pm[p.bill_id] = (pm[p.bill_id] || 0) + (p.amount || 0);
        tPaid += p.amount || 0;
      }
      const tRevenue = bills.reduce((s, b) => s + (b.total_amount || 0), 0);

      setStats({ totalBills, monthlyBills: monthly.count, monthlyRevenue: monthly.total, templateCount: templates.length });
      setRecentBills(bills.slice(0, 6));
      setPaidMap(pm);
      setTotalRevenue(tRevenue);
      setTotalPaid(tPaid);
      setPendingDraft(drafts.length > 0 ? drafts[0] : null);

      // Sort: overdue first, then upcoming
      const now = new Date().toISOString();
      const overdue = activeReminders.filter(r => r.promised_date < now);
      const upcoming = activeReminders.filter(r => r.promised_date >= now);
      setReminders([...overdue, ...upcoming]);
    } catch (error) {
      console.error('Dashboard load error:', error);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const totalPending = totalRevenue - totalPaid;
  const overdueCount = reminders.filter(r => new Date(r.promised_date) < new Date()).length;

  const QUICK_ACTIONS = [
    { icon: 'add-circle', label: 'New Bill', color: Colors.primary, bg: Colors.primarySurface, route: '/(tabs)/create-bill' },
    { icon: 'storefront', label: 'Customer Portal', color: '#16A34A', bg: '#DCFCE7', route: '/customer-marketplace' },
    { icon: 'business', label: 'Quarry Portal', color: Colors.primary, bg: Colors.primarySurface, route: '/quarry-marketplace' },
    { icon: 'car-sport', label: 'Lorry Portal', color: '#2563EB', bg: '#EFF6FF', route: '/driver-marketplace' },
    { icon: 'cart', label: 'Enquiries', color: '#059669', bg: '#ECFDF5', route: '/enquiries' },
    { icon: 'navigate-circle', label: 'Live GPS', color: '#2563EB', bg: '#EFF6FF', route: '/live-tracking' },
    { icon: 'people', label: 'Customers', color: '#9333EA', bg: '#F3E8FF', route: '/customers' },
    { icon: 'receipt', label: 'Bills', color: '#0284C7', bg: '#E0F2FE', route: '/(tabs)/history' },
    { icon: 'book', label: 'Ledger', color: '#D97706', bg: '#FFFBEB', route: '/ledger' },
    { icon: 'alarm', label: 'Reminders', color: '#DC2626', bg: '#FEF2F2', route: '/reminders', badge: overdueCount },
    { icon: 'logo-whatsapp', label: 'Share', color: '#16A34A', bg: '#DCFCE7', route: '/whatsapp-settings' },
  ];


  const { user, logout } = useAuth();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Compact Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.greeting}>{getGreeting()}, {user?.name || 'Quarry Owner'}</Text>
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerBadgeText}>🏢 Owner</Text>
            </View>
          </View>
          <Text style={styles.date}>{todayStr()}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.switchPortalBtn}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="person-circle" size={16} color={Colors.primary} />
            <Text style={styles.switchPortalText}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.switchPortalBtn}
            onPress={() => {
              logout();
              router.push('/select-role');
            }}
          >
            <Ionicons name="swap-horizontal" size={16} color={Colors.primary} />
            <Text style={styles.switchPortalText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* ── Finance Summary Card ── */}
        <View style={styles.financeCard}>
          <View style={styles.financeTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.financeTitle}>Total Revenue</Text>
              <Text style={styles.financeRevenue}>{fmtCurrency(totalRevenue)}</Text>
            </View>
            {totalPending > 0 && (
              <View style={styles.pendingBadge}>
                <Ionicons name="warning" size={12} color="#DC2626" />
                <Text style={styles.pendingBadgeText}>{fmtCurrency(totalPending)} pending</Text>
              </View>
            )}
          </View>
          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: totalRevenue > 0 ? `${Math.min(100, (totalPaid / totalRevenue) * 100)}%` : '0%'
            }]} />
          </View>
          <View style={styles.financeStats}>
            <FinanceStat label="Collected" value={fmtCurrency(totalPaid)} color="#16A34A" icon="checkmark-circle" />
            <View style={styles.fsDivider} />
            <FinanceStat label="Pending" value={fmtCurrency(totalPending)} color={totalPending > 0 ? '#DC2626' : '#16A34A'} icon="time" />
            <View style={styles.fsDivider} />
            <FinanceStat label="This Month" value={fmtCurrency(stats.monthlyRevenue)} color={Colors.primary} icon="calendar" />
          </View>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total Bills', val: stats.totalBills, icon: 'receipt-outline', color: Colors.primary },
            { label: 'This Month', val: stats.monthlyBills, icon: 'calendar-outline', color: '#7C3AED' },
            { label: 'Templates', val: stats.templateCount, icon: 'document-text-outline', color: '#059669' },
            { label: 'Reminders', val: reminders.length, icon: 'alarm-outline', color: overdueCount > 0 ? '#DC2626' : '#D97706' },
          ].map((s, i) => (
            <View key={i} style={styles.miniStat}>
              <Ionicons name={s.icon} size={18} color={s.color} />
              <Text style={[styles.miniStatVal, { color: s.color }]}>{s.val}</Text>
              <Text style={styles.miniStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Active Reminders Strip ── */}
        {reminders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="alarm" size={16} color="#DC2626" />
                <Text style={styles.sectionTitle}>Payment Reminders</Text>
                {overdueCount > 0 && (
                  <View style={styles.overdueCount}>
                    <Text style={styles.overdueCountText}>{overdueCount} overdue</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => router.push('/reminders')}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Spacing.lg }}>
              <View style={{ flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: 4 }}>
                {reminders.slice(0, 6).map(r => (
                  <ReminderChip
                    key={r.id}
                    reminder={r}
                    onPress={() => router.push(`/reminders?highlight=${r.id}`)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Draft Resume Banner ── */}
        {pendingDraft && (
          <TouchableOpacity
            style={styles.draftBanner}
            onPress={() => router.push(`/bill-form/${pendingDraft.templateId}`)}
            activeOpacity={0.85}
          >
            <View style={styles.draftIcon}>
              <Ionicons name="play" size={16} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.draftTitle}>Resume Unfinished Bill</Text>
              <Text style={styles.draftSub}>You have unsaved bill progress. Tap to resume!</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        )}

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg, paddingBottom: 4 }}>
              {QUICK_ACTIONS.map((a) => (
                <QuickAction
                  key={a.label}
                  icon={a.icon}
                  label={a.label}
                  color={a.color}
                  bg={a.bg}
                  badge={a.badge || 0}
                  onPress={() => router.push(a.route)}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ── Recent Bills ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Bills</Text>
            {recentBills.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentBills.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>No bills yet. Create your first bill!</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/create-bill')}>
                <Text style={styles.emptyBtnText}>+ Create Bill</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.billsCard}>
              {recentBills.map(bill => (
                <RecentBillRow
                  key={bill.id}
                  bill={bill}
                  paidMap={paidMap}
                  onPress={() => router.push(`/bill-preview/${bill.id}`)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  greeting: { ...Typography.h3, color: Colors.text },
  date: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  profileBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  // Finance card
  financeCard: {
    margin: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderLight,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  financeTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  financeTitle: { ...Typography.caption, color: Colors.textSecondary },
  financeRevenue: { ...Typography.h1, color: Colors.text, fontSize: 28, marginTop: 2 },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEE2E2', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  pendingBadgeText: { ...Typography.caption, color: '#DC2626', fontWeight: '700' },
  progressTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, marginBottom: 14, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#16A34A', borderRadius: 3 },
  financeStats: { flexDirection: 'row', alignItems: 'center' },
  fsDivider: { width: 1, height: 32, backgroundColor: Colors.borderLight },
  // Stats row
  statsRow: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  miniStat: {
    flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3,
    borderRightWidth: 1, borderRightColor: Colors.borderLight,
  },
  miniStatVal: { ...Typography.bodyLargeBold, fontSize: 16 },
  miniStatLabel: { fontSize: 9, color: Colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  // Section
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { ...Typography.h3, color: Colors.text },
  seeAll: { ...Typography.captionSemibold, color: Colors.primary },
  overdueCount: {
    backgroundColor: '#FEE2E2', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  overdueCountText: { fontSize: 10, color: '#DC2626', fontWeight: '700' },
  // Draft banner
  draftBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  draftIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  draftTitle: { ...Typography.bodyMedium, color: Colors.primary, fontWeight: '700' },
  draftSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  // Bills section
  billsCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight,
  },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 24, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.borderLight },
  emptyText: { ...Typography.body, color: Colors.textSecondary },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: 20, paddingVertical: 8 },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  ownerBadge: { backgroundColor: Colors.primarySurface, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  ownerBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: '700' },
  switchPortalBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.md,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.primary + '40',
  },
  switchPortalText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
});

