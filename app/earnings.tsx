// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { getDatabase, getQuarryEarnings, getDriverEarnings } from '../src/database/db';

function StatCard({ icon, label, value, color = Colors.primary, prefix = '₹' }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{prefix}{typeof value === 'number' ? value.toLocaleString() : value}</Text>
    </View>
  );
}

const TRIP_STATUS_LABEL = {
  assigned: 'Assigned', en_route_quarry: 'En Route Quarry', reached_quarry: 'At Quarry',
  picked_up: 'Picked Up', en_route_customer: 'En Route Customer', reached_customer: 'At Customer', delivered: '✅ Delivered',
};
const TRIP_STATUS_COLOR = {
  assigned: '#2196F3', en_route_quarry: '#FF9800', reached_quarry: '#9C27B0',
  picked_up: '#FF5722', en_route_customer: '#03A9F4', reached_customer: '#009688', delivered: '#4CAF50',
};

export default function EarningsScreen() {
  const router = useRouter();
  const { user, role, quarryId } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDriver = role === 'driver';
  const isOwner = role === 'quarry_owner' || role === 'admin';

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      let result;
      if (isDriver) {
        result = await getDriverEarnings(db, user?.id || 1);
      } else {
        result = await getQuarryEarnings(db, quarryId || user?.quarry_id || 1);
      }
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDriver, user, quarryId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return (
    <View style={styles.centerFlex}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>Loading earnings...</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{isDriver ? '🚚 Driver Earnings' : '💰 Quarry Earnings'}</Text>
          <Text style={styles.headerSub}>{isDriver ? user?.name : 'Financial Overview'}</Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {isDriver ? (
          <>
            <StatCard icon="cash-outline" label="Total Earned" value={data?.totalEarned || 0} color="#2E7D32" />
            <StatCard icon="checkmark-circle-outline" label="Collected" value={data?.paid || 0} color="#4CAF50" />
            <StatCard icon="time-outline" label="Pending Pay" value={data?.unpaid || 0} color="#FF9800" />
            <StatCard icon="car-outline" label="Trips Done" value={data?.completedTrips || 0} color="#2196F3" prefix="" />
            <StatCard icon="flash-outline" label="Active Trips" value={data?.activeTrips || 0} color="#FF5722" prefix="" />
            <StatCard icon="navigate-outline" label="Total KM" value={data?.totalKm || 0} color="#9C27B0" prefix="" />
          </>
        ) : (
          <>
            <StatCard icon="receipt-outline" label="Total Billed" value={data?.totalBilled || 0} color="#2196F3" />
            <StatCard icon="cash-outline" label="Collected" value={data?.totalCollected || 0} color="#4CAF50" />
            <StatCard icon="alert-circle-outline" label="Outstanding" value={data?.totalOutstanding || 0} color="#FF5722" />
            <StatCard icon="car-outline" label="Transport Rev." value={data?.tripRevenue || 0} color="#9C27B0" />
            <StatCard icon="time-outline" label="Active Trips" value={data?.pendingTrips || 0} color="#FF9800" prefix="" />
            <StatCard icon="checkmark-done-outline" label="Completed Trips" value={data?.completedTrips || 0} color="#2E7D32" prefix="" />
          </>
        )}
      </View>

      {/* Recent Trips */}
      <Text style={styles.sectionLabel}>RECENT TRIPS</Text>
      {(data?.recentTrips || []).length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="truck-outline" size={36} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No trips yet</Text>
        </View>
      ) : (
        (data?.recentTrips || []).map(trip => (
          <View key={trip.id} style={styles.tripCard}>
            <View style={styles.tripRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tripTitle}>{trip.material_name} • {trip.quantity} unit</Text>
                <Text style={styles.tripSub}>
                  {isDriver ? `Customer: ${trip.customer_name}` : `Driver: ${trip.driver_name}`}
                </Text>
                <Text style={styles.tripSub}>📍 {trip.to_address || 'N/A'}</Text>
                <Text style={styles.tripDate}>{trip.created_at ? new Date(trip.created_at).toLocaleDateString('en-IN') : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={[styles.statusBadge, { backgroundColor: (TRIP_STATUS_COLOR[trip.status] || '#999') + '22', borderColor: TRIP_STATUS_COLOR[trip.status] || '#999' }]}>
                  <Text style={[styles.statusText, { color: TRIP_STATUS_COLOR[trip.status] || '#999' }]}>{TRIP_STATUS_LABEL[trip.status] || trip.status}</Text>
                </View>
                <Text style={styles.tripCost}>₹{(trip.estimated_cost || 0).toLocaleString()}</Text>
                <View style={[styles.payBadge, { backgroundColor: trip.payment_status === 'paid' ? '#E8F5E9' : '#FFF3E0', borderColor: trip.payment_status === 'paid' ? '#4CAF50' : '#FF9800' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: trip.payment_status === 'paid' ? '#4CAF50' : '#FF9800' }}>
                    {trip.payment_status === 'paid' ? '✅ Paid' : '⏳ Unpaid'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))
      )}

      {/* Recent Bills (owner only) */}
      {!isDriver && (data?.recentBills || []).length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>RECENT BILLS</Text>
          {(data.recentBills || []).map(bill => (
            <View key={bill.id} style={styles.tripCard}>
              <View style={styles.tripRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripTitle}>{bill.customer_name}</Text>
                  <Text style={styles.tripSub}>{bill.bill_no || `BILL-${bill.id}`}</Text>
                  <Text style={styles.tripDate}>{bill.created_at ? new Date(bill.created_at).toLocaleDateString('en-IN') : ''}</Text>
                </View>
                <Text style={styles.tripCost}>₹{(bill.total_amount || 0).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40, maxWidth: 700, alignSelf: 'center', width: '100%' },
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 12, color: Colors.textSecondary },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, minWidth: 140, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, gap: 4 },
  statLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginTop: 4 },
  statValue: { fontSize: 22, fontWeight: '800' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textTertiary, letterSpacing: 1, marginBottom: 10 },
  emptyCard: { alignItems: 'center', gap: 8, padding: 32, backgroundColor: Colors.surface, borderRadius: 14 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  tripCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  tripRow: { flexDirection: 'row', gap: 12 },
  tripTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  tripSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  tripDate: { fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
  tripCost: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },
  payBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
});
