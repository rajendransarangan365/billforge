// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { Card, EmptyState } from '../../src/components';
import { getDatabase, getBills, deleteBill } from '../../src/database/db';
import { Alert } from 'react-native';

export default function HistoryScreen() {
  const router = useRouter();
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

  useFocusEffect(
    useCallback(() => {
      loadBills();
    }, [loadBills])
  );

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredBills(bills);
      return;
    }
    const lower = query.toLowerCase();
    const filtered = bills.filter(bill =>
      (bill.customer_name || '').toLowerCase().includes(lower) ||
      (bill.bill_number || '').toLowerCase().includes(lower) ||
      (bill.template_name || '').toLowerCase().includes(lower)
    );
    setFilteredBills(filtered);
  };

  const handleDeleteBill = (bill) => {
    Alert.alert(
      'Delete Bill',
      `Delete bill "${bill.customer_name || bill.bill_number || `#${bill.id}`}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              await deleteBill(db, bill.id);
              await loadBills();
            } catch (error) {
              console.error('Delete error:', error);
            }
          },
        },
      ],
    );
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bill History</Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bill History</Text>
        <Text style={styles.headerCount}>{bills.length} bill(s)</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer, bill number..."
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredBills.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title={searchQuery ? 'No Results' : 'No Bills Yet'}
            message={searchQuery ? 'No bills match your search criteria.' : 'Create your first bill to see it here.'}
          />
        ) : (
          filteredBills.map((bill) => (
            <TouchableOpacity
              key={bill.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/bill-preview/${bill.id}`)}
              onLongPress={() => handleDeleteBill(bill)}
            >
              <Card style={styles.billCard}>
                <View style={styles.billRow}>
                  <View style={styles.billIconCircle}>
                    <Ionicons name="receipt-outline" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.billInfo}>
                    <Text style={styles.billCustomer} numberOfLines={1}>
                      {bill.customer_name || bill.bill_number || `Bill #${bill.id}`}
                    </Text>
                    <Text style={styles.billTemplate}>{bill.template_name || 'Custom'}</Text>
                    <Text style={styles.billDate}>
                      {new Date(bill.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={styles.billRight}>
                    <Text style={styles.billAmount}>{formatCurrency(bill.total_amount)}</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                  </View>
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
    alignItems: 'baseline',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0,
  },
  headerTitle: {
    ...Typography.h1,
    color: Colors.text,
  },
  headerCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
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
    height: 40,
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
  billCard: {
    marginBottom: Spacing.sm + 2,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EBF5FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  billInfo: {
    flex: 1,
  },
  billCustomer: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  billTemplate: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  billDate: {
    ...Typography.small,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  billRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  billAmount: {
    ...Typography.bodySemibold,
    color: Colors.success,
  },
});
