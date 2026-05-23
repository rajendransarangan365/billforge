// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, EmptyState } from '../../src/components';
import { getDatabase, getBills, deleteBill } from '../../src/database/db';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bills, setBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadBills = useCallback(async () => {
    try {
      const db = await getDatabase();
      const list = await getBills(db);
      setBills(list);
      setFilteredBills(list);
    } catch (error) {
      console.error('Error loading bills:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadBills(); }, [loadBills]));

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) { setFilteredBills(bills); return; }
    const lower = query.toLowerCase();
    setFilteredBills(bills.filter(b =>
      (b.customer_name || '').toLowerCase().includes(lower) ||
      (b.bill_number || '').toLowerCase().includes(lower) ||
      (b.template_name || '').toLowerCase().includes(lower)
    ));
  };

  const handleDeleteBill = (bill) => {
    Alert.alert(
      'Delete Bill',
      `Delete "${bill.customer_name || bill.bill_number || `Bill #${bill.id}`}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              await deleteBill(db, bill.id);
              await loadBills();
            } catch (error) { console.error('Delete error:', error); }
          },
        },
      ],
    );
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'Rs. 0';
    const str = Math.round(amount).toString();
    let result = ''; let count = 0;
    for (let i = str.length - 1; i >= 0; i--) {
      if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) result = ',' + result;
      result = str[i] + result; count++;
    }
    return `Rs.\u00A0${result}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bill History</Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bill History</Text>
          <Text style={styles.headerCount}>{bills.length} bill{bills.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customer, bill number…"
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredBills.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title={searchQuery ? 'No Results' : 'No Bills Yet'}
            message={searchQuery ? 'No bills match your search.' : 'Create your first bill and it will appear here.'}
          />
        ) : (
          filteredBills.map((bill) => (
            <TouchableOpacity
              key={bill.id}
              activeOpacity={0.75}
              onPress={() => router.push(`/bill-preview/${bill.id}`)}
              onLongPress={() => handleDeleteBill(bill)}
            >
              <Card style={styles.billCard}>
                <View style={styles.billRow}>
                  <View style={styles.billIconBox}>
                    <Ionicons name="receipt-outline" size={20} color={Colors.accent} />
                  </View>
                  <View style={styles.billInfo}>
                    <Text style={styles.billCustomer} numberOfLines={1}>
                      {bill.customer_name || bill.bill_number || `Bill #${bill.id}`}
                    </Text>
                    <Text style={styles.billTemplate}>{bill.template_name || 'Custom'}</Text>
                    <Text style={styles.billDate}>
                      {new Date(bill.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.billRight}>
                    <Text style={styles.billAmount}>{formatCurrency(bill.total_amount)}</Text>
                    <View style={styles.chevronWrap}>
                      <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
                    </View>
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
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
    color: Colors.text,
    paddingVertical: 0,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.lg,
  },
  billCard: {
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billIconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  billInfo: { flex: 1 },
  billCustomer: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  billTemplate: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  billDate: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  billRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  billAmount: {
    ...Typography.captionSemibold,
    color: Colors.success,
  },
  chevronWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
