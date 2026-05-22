// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card } from '../../src/components';
import { getDatabase, getBillCount, getBillsThisMonth, getTemplates, getBills } from '../../src/database/db';

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState({ totalBills: 0, monthlyBills: 0, monthlyRevenue: 0, templateCount: 0 });
  const [recentBills, setRecentBills] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const totalBills = await getBillCount(db);
      const monthly = await getBillsThisMonth(db);
      const templates = await getTemplates(db);
      const bills = await getBills(db);

      setStats({
        totalBills,
        monthlyBills: monthly.count,
        monthlyRevenue: monthly.total,
        templateCount: templates.length,
      });
      setRecentBills(bills.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'Rs. 0';
    const str = Math.round(amount).toString();
    let result = '';
    let count = 0;
    for (let i = str.length - 1; i >= 0; i--) {
      if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) result = ',' + result;
      result = str[i] + result;
      count++;
    }
    return `Rs. ${result}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>BillForge</Text>
          <Text style={styles.subtitle}>Billing Management System</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="receipt-outline" size={24} color={Colors.primary} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={[styles.statCard, { backgroundColor: Colors.primary }]}>
            <View style={styles.statIconWrap}>
              <Ionicons name="document-text" size={20} color="rgba(255,255,255,0.7)" />
            </View>
            <Text style={[styles.statValue, { color: '#fff' }]}>{stats.totalBills}</Text>
            <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.8)' }]}>Total Bills</Text>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: Colors.secondary }]}>
            <View style={styles.statIconWrap}>
              <Ionicons name="calendar" size={20} color="rgba(255,255,255,0.7)" />
            </View>
            <Text style={[styles.statValue, { color: '#fff' }]}>{stats.monthlyBills}</Text>
            <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.8)' }]}>This Month</Text>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: '#1A8754' }]}>
            <View style={styles.statIconWrap}>
              <Ionicons name="cash" size={20} color="rgba(255,255,255,0.7)" />
            </View>
            <Text style={[styles.statValue, { color: '#fff', fontSize: 18 }]}>
              {formatCurrency(stats.monthlyRevenue)}
            </Text>
            <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.8)' }]}>Revenue</Text>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: Colors.accent }]}>
            <View style={styles.statIconWrap}>
              <Ionicons name="layers" size={20} color="rgba(0,0,0,0.5)" />
            </View>
            <Text style={[styles.statValue, { color: Colors.text }]}>{stats.templateCount}</Text>
            <Text style={[styles.statLabel, { color: 'rgba(0,0,0,0.6)' }]}>Templates</Text>
          </Card>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/create-bill')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#EBF5FB' }]}>
              <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Create Bill</Text>
            <Text style={styles.actionSub}>New invoice</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/customers')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#F3E5F5' }]}>
              <Ionicons name="people-outline" size={24} color="#8E44AD" />
            </View>
            <Text style={styles.actionTitle}>Customers</Text>
            <Text style={styles.actionSub}>Manage directory</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.actionsRow, { marginTop: -Spacing.lg }]}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/templates')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#FFF8E1' }]}>
              <Ionicons name="cloud-upload-outline" size={24} color={Colors.accent} />
            </View>
            <Text style={styles.actionTitle}>Templates</Text>
            <Text style={styles.actionSub}>Manage templates</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/history')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="time-outline" size={24} color={Colors.success} />
            </View>
            <Text style={styles.actionTitle}>History</Text>
            <Text style={styles.actionSub}>Past bills</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Bills */}
        <Text style={styles.sectionTitle}>Recent Bills</Text>
        {recentBills.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="document-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No bills created yet</Text>
            <Text style={styles.emptySubtext}>Upload a template and create your first bill</Text>
          </Card>
        ) : (
          recentBills.map((bill) => (
            <TouchableOpacity
              key={bill.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/bill-preview/${bill.id}`)}
            >
              <Card style={styles.billCard}>
                <View style={styles.billCardRow}>
                  <View style={styles.billIconCircle}>
                    <Ionicons name="receipt-outline" size={18} color={Colors.primary} />
                  </View>
                  <View style={styles.billInfo}>
                    <Text style={styles.billCustomer} numberOfLines={1}>
                      {bill.customer_name || bill.bill_number || `Bill #${bill.id}`}
                    </Text>
                    <Text style={styles.billMeta}>
                      {bill.template_name || 'Custom'} -- {new Date(bill.created_at).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <Text style={styles.billAmount}>{formatCurrency(bill.total_amount)}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  greeting: {
    ...Typography.h1,
    color: Colors.primary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    width: '47%',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  statIconWrap: {
    marginBottom: Spacing.sm,
  },
  statValue: {
    ...Typography.h2,
    marginBottom: 2,
  },
  statLabel: {
    ...Typography.caption,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  actionTitle: {
    ...Typography.captionMedium,
    color: Colors.text,
  },
  actionSub: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  billCard: {
    marginBottom: Spacing.sm,
  },
  billCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBF5FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  billInfo: {
    flex: 1,
  },
  billCustomer: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  billMeta: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  billAmount: {
    ...Typography.bodySemibold,
    color: Colors.success,
  },
});
