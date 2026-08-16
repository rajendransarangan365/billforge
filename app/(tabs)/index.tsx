// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card } from '../../src/components';
import { getDatabase, getBillCount, getBillsThisMonth, getTemplates, getBills, getAllDrafts } from '../../src/database/db';

// Stat card widget
function StatCard({ icon, value, label, gradientColors, valueSize }) {
  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.statCard}
    >
      <View style={styles.statTop}>
        <View style={styles.statIconCircle}>
          <Ionicons name={icon} size={18} color="rgba(255,255,255,0.9)" />
        </View>
      </View>
      <Text style={[styles.statValue, valueSize && { fontSize: valueSize }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </LinearGradient>
  );
}

// Quick action button
function ActionBtn({ icon, label, sublabel, iconBg, iconColor, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSublabel}>{sublabel}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [stats, setStats] = useState({ totalBills: 0, monthlyBills: 0, monthlyRevenue: 0, templateCount: 0 });
  const [recentBills, setRecentBills] = useState([]);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const totalBills = await getBillCount(db);
      const monthly = await getBillsThisMonth(db);
      const templates = await getTemplates(db);
      const bills = await getBills(db);
      const drafts = await getAllDrafts();
      
      setStats({ totalBills, monthlyBills: monthly.count, monthlyRevenue: monthly.total, templateCount: templates.length });
      setRecentBills(bills.slice(0, 5));
      setPendingDraft(drafts.length > 0 ? drafts[0] : null);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'Rs. 0';
    const n = Number(amount);
    if (isNaN(n)) return 'Rs. 0';

    const numStr = Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();
    const parts = numStr.split('.');
    const isNegative = parts[0].startsWith('-');
    const intStr = isNegative ? parts[0].slice(1) : parts[0];

    let result = ''; let count = 0;
    for (let i = intStr.length - 1; i >= 0; i--) {
      if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) result = ',' + result;
      result = intStr[i] + result; count++;
    }

    if (isNegative) result = '-' + result;
    if (parts.length > 1 && parts[1]) {
      result = `${result}.${parts[1]}`;
    }

    return `Rs.\u00A0${result}`;
  };

  const cardWidth = (width - Spacing.lg * 2 - Spacing.md) / 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={Colors.gradientPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View>
          <Text style={styles.headerBrand}>BillForge</Text>
          <Text style={styles.headerSub}>Billing Management System</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="receipt-outline" size={24} color="rgba(255,255,255,0.85)" />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="document-text"
            value={stats.totalBills}
            label="Total Bills"
            gradientColors={Colors.gradientPrimary}
          />
          <StatCard
            icon="calendar"
            value={stats.monthlyBills}
            label="This Month"
            gradientColors={['#2952B3', '#4F6AF5']}
          />
          <StatCard
            icon="cash"
            value={formatCurrency(stats.monthlyRevenue)}
            label="Revenue"
            gradientColors={Colors.gradientSuccess}
            valueSize={stats.monthlyRevenue > 999999 ? 14 : 18}
          />
          <StatCard
            icon="layers"
            value={stats.templateCount}
            label="Templates"
            gradientColors={Colors.gradientAmber}
          />
        </View>

        {/* Resume Draft Banner */}
        {pendingDraft && (
          <TouchableOpacity
            style={styles.draftBanner}
            onPress={() => router.push(`/bill-form/${pendingDraft.templateId}`)}
            activeOpacity={0.8}
          >
            <View style={styles.draftBannerIconCircle}>
              <Ionicons name="play" size={18} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.draftBannerTitle}>Resume Unfinished Bill</Text>
              <Text style={styles.draftBannerSub}>You have left-over progress on a bill draft. Tap to resume!</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.actionsGrid}>
          <ActionBtn
            icon="add-circle-outline"
            label="Create Bill"
            sublabel="New invoice"
            iconBg={Colors.primarySurface}
            iconColor={Colors.primary}
            onPress={() => router.push('/(tabs)/create-bill')}
          />
          <ActionBtn
            icon="people-outline"
            label="Customers"
            sublabel="Directory"
            iconBg="#F3E5FB"
            iconColor="#8B3FC8"
            onPress={() => router.push('/customers')}
          />
          <ActionBtn
            icon="cloud-upload-outline"
            label="Templates"
            sublabel="Manage"
            iconBg={Colors.amberSurface}
            iconColor={Colors.warning}
            onPress={() => router.push('/(tabs)/templates')}
          />
          <ActionBtn
            icon="receipt-outline"
            label="Bills"
            sublabel="Manage & pay"
            iconBg={Colors.successLight}
            iconColor={Colors.success}
            onPress={() => router.push('/(tabs)/history')}
          />
          <ActionBtn
            icon="book-outline"
            label="Ledger"
            sublabel="Customer & material"
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
            onPress={() => router.push('/ledger')}
          />
          <ActionBtn
            icon="logo-whatsapp"
            label="WhatsApp"
            sublabel="Share bills"
            iconBg="#E8F8F5"
            iconColor="#25D366"
            onPress={() => router.push('/whatsapp-settings')}
          />
        </View>

        {/* Recent Bills */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent Bills</Text>
          {recentBills.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentBills.length === 0 ? (
          <Card style={styles.emptyCard} variant="tinted">
            <View style={styles.emptyInner}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="document-outline" size={28} color={Colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyText}>No bills yet</Text>
                <Text style={styles.emptySubtext}>Upload a template and create your first bill</Text>
              </View>
            </View>
          </Card>
        ) : (
          recentBills.map((bill) => (
            <TouchableOpacity
              key={bill.id}
              activeOpacity={0.75}
              onPress={() => router.push(`/bill-preview/${bill.id}`)}
            >
              <Card style={styles.billCard}>
                <View style={styles.billRow}>
                  <View style={styles.billIconCircle}>
                    <Ionicons name="receipt-outline" size={18} color={Colors.accent} />
                  </View>
                  <View style={styles.billInfo}>
                    <Text style={styles.billCustomer} numberOfLines={1}>
                      {bill.customer_name || bill.bill_number || `Bill #${bill.id}`}
                    </Text>
                    <Text style={styles.billMeta}>
                      {bill.template_name || 'Custom'} · {new Date(bill.created_at).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.billRight}>
                    <Text style={styles.billAmount}>{formatCurrency(bill.total_amount)}</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
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
    paddingBottom: Spacing.lg,
  },
  headerBrand: {
    ...Typography.h1,
    color: Colors.textOnPrimary,
    letterSpacing: -0.5,
  },
  headerSub: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  statIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    ...Typography.h2,
    color: '#fff',
    marginTop: Spacing.sm,
  },
  statLabel: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 2,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  seeAll: {
    ...Typography.captionMedium,
    color: Colors.accent,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  actionCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  actionLabel: {
    ...Typography.captionSemibold,
    color: Colors.text,
    textAlign: 'center',
  },
  actionSublabel: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 2,
    textAlign: 'center',
  },
  emptyCard: { marginBottom: Spacing.sm },
  emptyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  emptySubtext: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  billCard: {
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  billInfo: { flex: 1 },
  billCustomer: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  billMeta: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  billRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  billAmount: {
    ...Typography.captionSemibold,
    color: Colors.success,
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FB',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: 12,
  },
  draftBannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBannerTitle: {
    ...Typography.bodyMedium,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  draftBannerSub: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
