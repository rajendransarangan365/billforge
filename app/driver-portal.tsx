// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Alert, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { getDatabase, getDriverTrips, getConsignments, saveConsignment } from '../src/database/db';

export default function DriverPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const driverId = user?.id || 1;
  const driverName = user?.name || 'Ramesh (Driver)';
  const vehicleNo = user?.vehicle_no || 'TN 38 AB 1234';

  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const list = await getDriverTrips(db, driverId);
      setConsignments(list);
    } catch (e) {
      console.error('Driver portal load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openGoogleMapsNav = (addressLabel) => {
    const encoded = encodeURIComponent(addressLabel || 'Tamil Nadu');
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`).catch(() => {});
  };

  const handleUpdateStatus = async (consignment, newStatus, label) => {
    try {
      const db = await getDatabase();
      await saveConsignment(db, {
        ...consignment,
        status: newStatus,
      });
      Alert.alert('Status Updated ✅', `Trip status updated to: ${label}`);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/select-role')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{driverName}</Text>
          <Text style={styles.headerSub}>Vehicle: {vehicleNo}</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); loadData(); }}>
          <Ionicons name="refresh" size={18} color="#1565C0" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={{ marginTop: 8, color: Colors.textSecondary }}>Loading Assigned Trips...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={['#1565C0']} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusBanner}>
            <Ionicons name="location" size={20} color="#1565C0" />
            <Text style={styles.statusBannerText}>Driver Status: <Text style={{ fontWeight: '800' }}>Active & Ready</Text></Text>
          </View>

          <Text style={styles.sectionTitle}>Assigned Trips ({consignments.length})</Text>

          {consignments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="car-sport-outline" size={40} color={Colors.textDisabled} />
              <Text style={styles.emptyTitle}>No Active Trips Assigned</Text>
              <Text style={styles.emptySub}>When a quarry owner assigns a trip to your lorry, it will appear here instantly.</Text>
            </View>
          ) : (
            consignments.map((c) => (
              <View key={c.id} style={styles.tripCard}>
                <View style={styles.tripHeader}>
                  <View style={styles.materialIconWrap}>
                    <Ionicons name="cube" size={22} color="#1565C0" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.materialName}>{c.material_name || 'Construction Material'}</Text>
                    <Text style={styles.tripQty}>{c.quantity || 1} {c.unit_type || 'units'} • Rate: ₹{c.agreed_rate || 0}</Text>
                  </View>
                  <View style={[styles.statusBadge, c.status === 'delivered' ? { backgroundColor: Colors.successLight } : { backgroundColor: '#E3F2FD' }]}>
                    <Text style={[styles.statusText, c.status === 'delivered' ? { color: Colors.success } : { color: '#1565C0' }]}>
                      {(c.status || 'assigned').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationGroup}>
                  <TouchableOpacity style={styles.locRow} onPress={() => openGoogleMapsNav(c.pickup_address)}>
                    <Ionicons name="pin" size={16} color={Colors.primary} />
                    <Text style={styles.locText} numberOfLines={1}>Pickup: {c.pickup_address || 'Quarry Site'}</Text>
                    <Ionicons name="navigate-outline" size={14} color={Colors.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.locRow} onPress={() => openGoogleMapsNav(c.customer_address)}>
                    <Ionicons name="location" size={16} color={Colors.success} />
                    <Text style={styles.locText} numberOfLines={1}>Delivery: {c.customer_address || c.customer_name || 'Customer Site'}</Text>
                    <Ionicons name="navigate-outline" size={14} color={Colors.success} />
                  </TouchableOpacity>
                </View>

                {c.customer_name ? (
                  <View style={styles.customerRow}>
                    <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.customerText}>Customer: {c.customer_name} ({c.customer_phone || 'N/A'})</Text>
                    {c.customer_phone ? (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${c.customer_phone}`)}>
                        <Ionicons name="call-outline" size={16} color={Colors.primary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                {/* Status Action Buttons */}
                <View style={styles.actionRow}>
                  {c.status === 'assigned' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary }]} onPress={() => handleUpdateStatus(c, 'reached_pickup', 'Reached Quarry')}>
                      <Ionicons name="location-outline" size={16} color="#FFF" />
                      <Text style={styles.actionBtnText}>Reached Quarry</Text>
                    </TouchableOpacity>
                  )}
                  {c.status === 'reached_pickup' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1565C0' }]} onPress={() => handleUpdateStatus(c, 'loaded', 'Material Loaded')}>
                      <Ionicons name="cube-outline" size={16} color="#FFF" />
                      <Text style={styles.actionBtnText}>Loaded & In Transit</Text>
                    </TouchableOpacity>
                  )}
                  {c.status === 'loaded' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success }]} onPress={() => handleUpdateStatus(c, 'delivered', 'Delivered to Site')}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
                      <Text style={styles.actionBtnText}>Mark Delivered</Text>
                    </TouchableOpacity>
                  )}
                  {c.status === 'delivered' && (
                    <View style={styles.deliveredTag}>
                      <Ionicons name="checkmark-done" size={16} color={Colors.success} />
                      <Text style={styles.deliveredText}>Delivery Completed</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 11, color: Colors.textSecondary },
  refreshBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E3F2FD', padding: 12, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: '#BBDEFB' },
  statusBannerText: { fontSize: 13, color: '#1565C0' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  emptyCard: { padding: 36, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderLight, marginTop: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 10 },
  emptySub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  tripCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight, gap: 12 },
  tripHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  materialIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' },
  materialName: { fontSize: 16, fontWeight: '700', color: Colors.navy },
  tripQty: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  locationGroup: { backgroundColor: Colors.background, borderRadius: 10, padding: 10, gap: 8 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.text },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerText: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  actionRow: { marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 10 },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  deliveredTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: Colors.successLight, borderRadius: 10 },
  deliveredText: { fontSize: 13, fontWeight: '700', color: Colors.success },
});
