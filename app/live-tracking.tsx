// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { getDatabase, getTripsForQuarry, getTripsForDriver } from '../src/database/db';

const STATUS_LABELS = {
  assigned: { label: 'Assigned', color: '#3B82F6', icon: 'checkmark-circle-outline' },
  en_route_quarry: { label: 'En Route to Quarry', color: '#F59E0B', icon: 'navigate-outline' },
  reached_quarry: { label: 'Reached Quarry', color: '#8B5CF6', icon: 'location-outline' },
  picked_up: { label: 'Loaded', color: '#06B6D4', icon: 'cube-outline' },
  en_route_customer: { label: 'Delivering', color: '#EC4899', icon: 'car-outline' },
  reached_customer: { label: 'Arrived at Site', color: '#10B981', icon: 'pin-outline' },
  delivered: { label: 'Delivered', color: '#22C55E', icon: 'checkmark-done-circle-outline' },
};

export default function LiveTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { quarryId, user, isDriver } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTrips = useCallback(async () => {
    try {
      const db = await getDatabase();
      let data = [];
      if (isDriver && user?.id) {
        data = await getTripsForDriver(db, user.id);
      } else {
        data = await getTripsForQuarry(db, quarryId || 1);
      }
      setTrips(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [quarryId, user, isDriver]);

  useEffect(() => {
    loadTrips();
    const interval = setInterval(loadTrips, 10000);
    return () => clearInterval(interval);
  }, [loadTrips]);

  const activeTrips = trips.filter(t => t.status !== 'delivered');
  const completedTrips = trips.filter(t => t.status === 'delivered');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color="#1A1F2C" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Live Trip Tracking</Text>
          <Text style={styles.headerSub}>Real-time delivery status</Text>
        </View>
        <TouchableOpacity onPress={loadTrips} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={18} color="#E57025" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: 'Active', val: activeTrips.length, color: '#3B82F6' },
          { label: 'Delivered', val: completedTrips.length, color: '#22C55E' },
          { label: 'Total', val: trips.length, color: '#6B7280' },
        ].map(s => (
          <View key={s.label} style={styles.statBox}>
            <Text style={[styles.statNum, { color: s.color }]}>{s.val}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color="#E57025" /> : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {trips.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Active Trips</Text>
              <Text style={styles.emptySub}>When deliveries are assigned and in progress, they will appear here with live status updates.</Text>
            </View>
          ) : (
            <>
              {activeTrips.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Active Trips ({activeTrips.length})</Text>
                  {activeTrips.map(t => <TripCard key={t.id} trip={t} />)}
                </>
              )}
              {completedTrips.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 20, color: '#6B7280' }]}>Completed ({completedTrips.length})</Text>
                  {completedTrips.slice(0, 10).map(t => <TripCard key={t.id} trip={t} />)}
                </>
              )}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function TripCard({ trip }) {
  const s = STATUS_LABELS[trip.status] || { label: trip.status, color: '#6B7280', icon: 'time-outline' };
  const pct = ['assigned','en_route_quarry','reached_quarry','picked_up','en_route_customer','reached_customer','delivered'].indexOf(trip.status) / 6;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: s.color + '22', borderColor: s.color + '55' }]}>
          <Ionicons name={s.icon} size={14} color={s.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.cardTitle}>{trip.material_name || 'Material'}</Text>
          <Text style={[styles.statusLabel, { color: s.color }]}>{s.label}</Text>
        </View>
        <Text style={styles.amount}>₹{Number(trip.estimated_cost || 0).toLocaleString('en-IN')}</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: (pct * 100) + '%', backgroundColor: s.color }]} />
      </View>
      <View style={styles.cardDetails}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="person-outline" size={12} color="#6B7280" />
          <Text style={styles.cardMeta}>{trip.driver_name || 'Driver'} • {trip.vehicle_no || ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="cube-outline" size={12} color="#6B7280" />
          <Text style={styles.cardMeta}>{trip.quantity || ''} {trip.unit_type || 'units'}</Text>
        </View>
      </View>
      <View style={styles.routeRow}>
        <View style={styles.routePoint}>
          <Ionicons name="location-outline" size={14} color="#E57025" />
          <Text style={styles.routeText} numberOfLines={1}>{trip.from_address || 'Quarry'}</Text>
        </View>
        <Ionicons name="arrow-forward" size={14} color="#9CA3AF" />
        <View style={styles.routePoint}>
          <Ionicons name="flag-outline" size={14} color="#22C55E" />
          <Text style={styles.routeText} numberOfLines={1}>{trip.to_address || 'Site'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EAECF0' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1F2C' },
  headerSub: { fontSize: 12, color: '#6B7280' },
  refreshBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF3EB', justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EAECF0', gap: 12 },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 10 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statusDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1F2C' },
  statusLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '800', color: '#E57025' },
  progressBarBg: { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, marginBottom: 10 },
  progressBarFill: { height: 6, borderRadius: 3 },
  cardDetails: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  cardMeta: { fontSize: 12, color: '#6B7280' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 8 },
  routePoint: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeText: { fontSize: 12, color: '#374151', flex: 1 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
