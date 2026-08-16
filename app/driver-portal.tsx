// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Button, Card, EmptyState } from '../src/components';
import { getDatabase, getConsignments, saveConsignment } from '../src/database/db';
import { socketService } from '../src/services/socketService';
import WalkieTalkieModal from '../src/components/WalkieTalkieModal';

export default function DriverPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const driverId = params.driverId ? parseInt(params.driverId) : 1;
  const driverName = params.driverName || 'Ramesh (Driver)';

  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [walkieVisible, setWalkieVisible] = useState(false);

  // Load assigned consignments
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const list = await getConsignments(db);
      const activeList = list.filter(c => c.driver_id === driverId || c.driver_name === driverName);
      setConsignments(activeList);
    } catch (e) {
      console.error('Driver portal load error:', e);
    } finally {
      setLoading(false);
    }
  }, [driverId, driverName]);

  useEffect(() => {
    loadData();
    socketService.connect('driver', driverId);
  }, [loadData, driverId]);

  // Request & Start GPS Location Stream over WebSockets
  useEffect(() => {
    let intervalId;
    async function startGpsTracking() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('GPS location permission denied.');
          return;
        }
        setGpsActive(true);

        const loc = await Location.getCurrentPositionAsync({});
        setCurrentLocation(loc.coords);

        // Emit initial socket location update
        socketService.emitLocationUpdate({
          driverId,
          driverName,
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          status: 'On Duty',
        });

        // Ping position every 5 seconds over WebSocket
        intervalId = setInterval(async () => {
          try {
            const current = await Location.getCurrentPositionAsync({});
            setCurrentLocation(current.coords);

            // Emit live location stream via WebSocket
            socketService.emitLocationUpdate({
              driverId,
              driverName,
              lat: current.coords.latitude,
              lng: current.coords.longitude,
              status: 'On Duty',
            });

            // Sync with DB
            const db = await getDatabase();
            const list = await getConsignments(db);
            for (const c of list) {
              if ((c.driver_id === driverId || c.driver_name === driverName) && c.status !== 'delivered') {
                await saveConsignment(db, {
                  ...c,
                  driver_lat: current.coords.latitude,
                  driver_lng: current.coords.longitude,
                });
              }
            }
          } catch (err) {
            console.warn('GPS update ping error:', err);
          }
        }, 5000);
      } catch (e) {
        console.warn('Location initialization error:', e);
      }
    }
    startGpsTracking();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [driverId, driverName]);

  // Navigate to location via Google Maps App
  const openGoogleMapsNav = (lat, lng, addressLabel) => {
    if (!lat || !lng) {
      const encoded = encodeURIComponent(addressLabel || 'Tamil Nadu');
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`);
      return;
    }
    const url = Platform.OS === 'android'
      ? `google.navigation:q=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  };

  // Update Status
  const handleUpdateStatus = async (consignment, newStatus, label) => {
    try {
      const db = await getDatabase();
      await saveConsignment(db, {
        ...consignment,
        status: newStatus,
        driver_lat: currentLocation?.latitude || consignment.driver_lat,
        driver_lng: currentLocation?.longitude || consignment.driver_lng,
      });

      let alertTitle = 'Status Updated ✅';
      let alertMsg = `Consignment status updated to ${label}. Admin has been notified!`;

      if (newStatus === 'reached_pickup') {
        alertTitle = '📍 Reached Pickup Location';
        alertMsg = 'Owner has been notified: "Driver Ramesh reached Pickup Location!"';
      } else if (newStatus === 'reached_customer') {
        alertTitle = '🏁 Reached Customer Location';
        alertMsg = 'Owner has been notified: "Driver Ramesh reached Customer Location!"';
      }

      Alert.alert(alertTitle, alertMsg);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Driver App Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Driver Portal 🚚</Text>
          <Text style={styles.headerSub}>Welcome, {driverName}</Text>
        </View>
        <TouchableOpacity
          style={styles.walkieBtn}
          onPress={() => setWalkieVisible(true)}
        >
          <Ionicons name="radio" size={16} color="#FFF" />
          <Text style={styles.walkieBtnText}>Walkie-Talkie</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/')}>
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        </TouchableOpacity>
      </View>

      {/* GPS Status Banner */}
      <View style={[styles.gpsBanner, { backgroundColor: gpsActive ? '#DCFCE7' : '#FEF9C3' }]}>
        <Ionicons name={gpsActive ? 'navigate-circle' : 'warning-outline'} size={18} color={gpsActive ? '#16A34A' : '#D97706'} />
        <Text style={[styles.gpsText, { color: gpsActive ? '#16A34A' : '#D97706' }]}>
          {gpsActive
            ? `Live WebSockets GPS Active (${currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : 'Locating…'})`
            : 'Acquiring GPS Signal…'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : consignments.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="No active consignments"
          description="You currently have no pending deliveries assigned"
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {consignments.map(c => {
            const statusConfig = {
              assigned: { label: '🚚 Assigned', bg: '#EFF6FF', text: '#1D4ED8' },
              reached_pickup: { label: '📍 Reached Pickup', bg: '#FEF9C3', text: '#854D0E' },
              picked_up: { label: '📦 Picked Up', bg: '#F3E8FF', text: '#6B21A8' },
              reached_customer: { label: '🏁 Reached Customer', bg: '#FEF08A', text: '#713F12' },
              delivered: { label: '✅ Delivered', bg: '#DCFCE7', text: '#16A34A' },
            }[c.status] || { label: c.status, bg: '#F3F4F6', text: '#374151' };

            return (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.custName}>{c.customer_name}</Text>
                    <Text style={styles.custPhone}>📱 {c.customer_phone}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
                    <Text style={[styles.badgeText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
                  </View>
                </View>

                {/* Cargo Details */}
                <View style={styles.cargoBox}>
                  <Text style={styles.cargoTitle}>📦 Cargo Consignment Details:</Text>
                  <Text style={styles.cargoVal}>{c.quantity} {c.unit_type} {c.material_name}</Text>
                  <Text style={styles.cargoRate}>Agreed Value: ₹{c.agreed_rate}</Text>
                </View>

                {/* Navigation Action Buttons */}
                <Text style={styles.navHeader}>🧭 Google Maps Navigation:</Text>
                <View style={styles.navRow}>
                  <TouchableOpacity
                    style={[styles.navBtn, { backgroundColor: '#10B981' }]}
                    onPress={() => openGoogleMapsNav(c.pickup_lat, c.pickup_lng, c.pickup_address)}
                  >
                    <Ionicons name="navigate-circle" size={20} color="#FFF" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.navBtnTitle}>Navigate to Pickup</Text>
                      <Text style={styles.navBtnSub} numberOfLines={1}>{c.pickup_address || 'Quarry Yard'}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>

                <View style={styles.navRow}>
                  <TouchableOpacity
                    style={[styles.navBtn, { backgroundColor: '#3B82F6' }]}
                    onPress={() => openGoogleMapsNav(c.customer_lat, c.customer_lng, c.customer_address)}
                  >
                    <Ionicons name="navigate-circle" size={20} color="#FFF" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.navBtnTitle}>Navigate to Customer</Text>
                      <Text style={styles.navBtnSub} numberOfLines={1}>{c.customer_address || 'Delivery Site'}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {/* Delivery Progress Actions */}
                <Text style={styles.navHeader}>⚡ Delivery Status Actions:</Text>
                <View style={styles.statusGroup}>
                  {c.status === 'assigned' && (
                    <Button
                      title="📍 Reached Pickup Location"
                      onPress={() => handleUpdateStatus(c, 'reached_pickup', 'Reached Pickup Location')}
                      style={{ backgroundColor: '#D97706' }}
                    />
                  )}
                  {c.status === 'reached_pickup' && (
                    <Button
                      title="📦 Cargo Picked Up"
                      onPress={() => handleUpdateStatus(c, 'picked_up', 'Cargo Picked Up')}
                      style={{ backgroundColor: '#7C3AED' }}
                    />
                  )}
                  {c.status === 'picked_up' && (
                    <Button
                      title="🏁 Reached Customer Location"
                      onPress={() => handleUpdateStatus(c, 'reached_customer', 'Reached Customer Location')}
                      style={{ backgroundColor: '#2563EB' }}
                    />
                  )}
                  {c.status === 'reached_customer' && (
                    <Button
                      title="✅ Complete Delivery"
                      onPress={() => handleUpdateStatus(c, 'delivered', 'Delivered')}
                      variant="success"
                    />
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Push-to-Talk Walkie Talkie Modal */}
      <WalkieTalkieModal
        visible={walkieVisible}
        onClose={() => setWalkieVisible(false)}
        peerName="Quarry Owner (Admin)"
        peerRole="quarry_owner"
        peerId="admin"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerTitle: { ...Typography.h2, color: Colors.text },
  headerSub: { ...Typography.caption, color: Colors.textSecondary },
  walkieBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.sm },
  walkieBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  logoutBtn: { padding: 6, backgroundColor: '#FEE2E2', borderRadius: BorderRadius.sm },
  gpsBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  gpsText: { fontSize: 11, fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, marginBottom: 14, borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  custName: { ...Typography.h2, color: Colors.text },
  custPhone: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cargoBox: { backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: 12 },
  cargoTitle: { ...Typography.captionSemibold, color: Colors.primary },
  cargoVal: { ...Typography.h3, color: Colors.text, marginTop: 2 },
  cargoRate: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  navHeader: { ...Typography.captionSemibold, color: Colors.textSecondary, marginBottom: 6, marginTop: 4 },
  navRow: { marginBottom: 8 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: BorderRadius.md },
  navBtnTitle: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  navBtnSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  statusGroup: { marginTop: 4 },
});
