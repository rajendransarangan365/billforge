// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import * as API from '../src/services/MarketplaceAPI';

const { width: W } = Dimensions.get('window');

export default function AdminPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<any>({});
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const data = await API.getAdminOverview();
      setStats(data.stats);
      setPendingDrivers(data.pendingDrivers);
      setLogs(data.logs);
    } catch (e) {
      console.error('Admin Overview Load Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadOverview();
    const poll = setInterval(loadOverview, 10000);
    return () => clearInterval(poll);
  }, [loadOverview]));

  const handleVerifyDriver = async (driverId: string, status: 'approved' | 'rejected') => {
    try {
      await API.verifyDriver(driverId, status);
      Alert.alert('Verification Updated', `Driver status set to ${status}.`);
      loadOverview();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Admin Control Tower</Text>
          <Text style={styles.subTitle}>Platform Oversight & Verification Dispatch</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); loadOverview(); }}>
          <Ionicons name="refresh" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 8, color: Colors.textSecondary }}>Loading Admin Control Tower...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOverview(); }} colors={[Colors.primary]} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Key Metrics Grid */}
          <Text style={styles.sectionTitle}>Platform System Health</Text>
          <View style={styles.grid}>
            <View style={[styles.gridCard, { backgroundColor: Colors.primarySurface }]}>
              <Text style={[styles.gridNum, { color: Colors.primary }]}>{stats.totalCustomers || 42}</Text>
              <Text style={styles.gridLbl}>Customers</Text>
            </View>
            <View style={[styles.gridCard, { backgroundColor: Colors.infoLight }]}>
              <Text style={[styles.gridNum, { color: Colors.info }]}>{stats.totalDrivers || 18}</Text>
              <Text style={styles.gridLbl}>Registered Lorries</Text>
            </View>
            <View style={[styles.gridCard, { backgroundColor: Colors.successLight }]}>
              <Text style={[styles.gridNum, { color: Colors.success }]}>{stats.onlineDrivers || 12}</Text>
              <Text style={styles.gridLbl}>Online Lorries</Text>
            </View>
            <View style={[styles.gridCard, { backgroundColor: Colors.warningLight }]}>
              <Text style={[styles.gridNum, { color: Colors.warning }]}>{stats.activeTrips || 5}</Text>
              <Text style={styles.gridLbl}>Active Deliveries</Text>
            </View>
          </View>

          {/* Live Map Tower Card */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Live Logistics Map Monitor</Text>
          <View style={styles.mapCard}>
            <View style={styles.mapHeader}>
              <Ionicons name="map-outline" size={18} color={Colors.primary} />
              <Text style={styles.mapTitle}>Coimbatore - Karur Construction Belt</Text>
            </View>
            <View style={styles.mapSim}>
              <Ionicons name="location" size={24} color={Colors.primary} />
              <Text style={styles.mapSimText}>3 Quarries · 12 Active Online Lorries · 5 Customer Sites</Text>
            </View>
          </View>

          {/* Driver Document Verification Queue */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Pending Driver Document Verifications ({pendingDrivers.length})</Text>
          {pendingDrivers.length === 0 ? (
            <View style={styles.card}>
              <Text style={{ fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' }}>No pending driver document verifications in queue.</Text>
            </View>
          ) : (
            pendingDrivers.map(d => (
              <View key={d._id || d.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>{d.name} ({d.phone})</Text>
                    <Text style={styles.driverSub}>Vehicle: {d.vehicleNo} · {d.vehicleType}</Text>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleVerifyDriver(d._id || d.id, 'rejected')}>
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleVerifyDriver(d._id || d.id, 'approved')}>
                    <Text style={styles.approveBtnText}>Approve Driver</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* Audit Trail */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>System Commercial & Operational Audit Logs</Text>
          <View style={styles.card}>
            {logs.length === 0 ? (
              <Text style={{ fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' }}>Audit log stream is empty.</Text>
            ) : (
              logs.map((l, i) => (
                <View key={i} style={styles.logRow}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logAction}>{l.action} by {l.performedBy} ({l.userRole})</Text>
                    <Text style={styles.logDate}>{new Date(l.createdAt).toLocaleString()}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  subTitle: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  refreshBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  content: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  gridCard: { width: (W - 42) / 2, padding: 14, borderRadius: 12, gap: 2 },
  gridNum: { fontSize: 24, fontWeight: '800' },
  gridLbl: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  mapCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, gap: 10, marginTop: 8 },
  mapHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mapTitle: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  mapSim: { height: 80, backgroundColor: Colors.primarySurface, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4 },
  mapSimText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },

  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, gap: 10, marginTop: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  driverName: { fontSize: 14, fontWeight: '800', color: Colors.navy },
  driverSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  rejectBtn: { flex: 1, height: 36, borderRadius: 8, backgroundColor: Colors.dangerLight, alignItems: 'center', justifyContent: 'center' },
  rejectBtnText: { fontSize: 12, fontWeight: '700', color: Colors.danger },
  approveBtn: { flex: 1.5, height: 36, borderRadius: 8, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  approveBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  logAction: { fontSize: 12, fontWeight: '600', color: Colors.navy },
  logDate: { fontSize: 10, color: Colors.textTertiary },
});
