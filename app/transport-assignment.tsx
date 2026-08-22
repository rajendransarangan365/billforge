// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import {
  getDatabase, autoAssignLowestCostDriver, getAvailableDrivers,
  createTrip, getTransportRequests, calculateDistanceKm,
} from '../src/database/db';

const STATUS_COLOR = {
  assigned: '#2196F3', en_route_quarry: '#FF9800', reached_quarry: '#9C27B0',
  picked_up: '#FF5722', en_route_customer: '#4CAF50', reached_customer: '#009688', delivered: '#4CAF50',
};

export default function TransportAssignmentScreen() {
  const router = useRouter();
  const { user, quarryId: ctxQid } = useAuth();
  const { requestId } = useLocalSearchParams();

  const qid = parseInt(ctxQid || user?.quarry_id || 1);

  const [request, setRequest] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [mode, setMode] = useState('auto'); // 'auto' | 'manual' | 'own'
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const requests = await getTransportRequests(db, qid);
      const req = requestId ? requests.find(r => r.id === requestId) : requests.find(r => r.status === 'pending_assignment');
      setRequest(req || null);

      const scored = await autoAssignLowestCostDriver(db,
        req?.from_lat, req?.from_lng, req?.to_lat, req?.to_lng
      );
      setDrivers(scored || []);
      if (req?.to_address) setDeliveryAddress(req.to_address);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [qid, requestId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAssign = async () => {
    if (!request) { Alert.alert('No pending transport request found.'); return; }

    let chosenDriver = null;
    if (mode === 'auto') {
      chosenDriver = drivers[0]; // Lowest cost
    } else if (mode === 'manual') {
      chosenDriver = drivers.find(d => d.id === selectedDriverId);
      if (!chosenDriver) { Alert.alert('Please select a driver.'); return; }
    } else if (mode === 'own') {
      // Check if quarry's own registered driver/vehicle is available
      const ownDriver = drivers.find(d => d.quarry_id === qid && d.status === 'Available');
      if (ownDriver) {
        chosenDriver = ownDriver;
      } else {
        // Own vehicle is busy or not available -> alert and fallback to 3rd party lowest cost
        Alert.alert(
          '🏭 Quarry Vehicle Busy',
          'Your registered lorry is currently on an active trip. Automatically switching to 3rd-party lowest cost transport.',
          [{ text: 'Proceed with 3rd Party', onPress: () => {} }]
        );
        chosenDriver = drivers[0]; // 3rd party lowest cost
      }
    }

    if (!chosenDriver) { Alert.alert('No drivers available right now.'); return; }

    setAssigning(true);
    try {
      const db = await getDatabase();
      const trip = await createTrip(db, {
        transport_request_id: request.id,
        enquiry_id: request.enquiry_id,
        quarry_id: qid,
        driver_id: chosenDriver.id,
        driver_name: chosenDriver.name,
        driver_phone: chosenDriver.phone,
        vehicle_no: chosenDriver.vehicle_no || 'N/A',
        customer_name: request.customer_name,
        customer_phone: request.customer_phone,
        material_name: request.material_name,
        quantity: request.quantity,
        from_address: request.from_address,
        from_lat: request.from_lat,
        from_lng: request.from_lng,
        to_address: deliveryAddress || request.to_address,
        to_lat: request.to_lat,
        to_lng: request.to_lng,
        distance_km: chosenDriver.distance_km || request.distance_km || 10,
        estimated_cost: chosenDriver.estimated_cost || 0,
      });

      // Broadcast Real-Time Notification & Live Event
      try {
        const { broadcastRealtimeEvent } = require('../src/services/realtimeService');
        broadcastRealtimeEvent('DELIVERY_STAGE_UPDATE', {
          order_id: request.id,
          status: 'assigned',
          status_label: `Trip Assigned to ${chosenDriver.name} (${chosenDriver.vehicle_no || 'N/A'})`,
          driver_name: chosenDriver.name,
          vehicle_no: chosenDriver.vehicle_no,
        });
      } catch (e) {}

      Alert.alert(
        '✅ Trip Created!',
        `${chosenDriver.name} (${chosenDriver.vehicle_no}) has been notified and assigned to deliver ${request.material_name}.`,
        [{ text: 'View Trips', onPress: () => router.replace('/driver-marketplace') }, { text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Assignment Failed', e.message || 'Could not create trip.');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return (
    <View style={styles.centerFlex}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>Loading transport options...</Text>
    </View>
  );

  if (!request) return (
    <View style={styles.centerFlex}>
      <Ionicons name="truck-outline" size={52} color={Colors.textSecondary} />
      <Text style={styles.emptyTitle}>No Pending Requests</Text>
      <Text style={styles.emptyText}>All transport requests have been assigned.</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🚚 Assign Transport</Text>
          <Text style={styles.headerSub}>Choose how to deliver this order</Text>
        </View>
      </View>

      {/* Order Summary */}
      <View style={styles.orderCard}>
        <Text style={styles.sectionLabel}>ORDER DETAILS</Text>
        <View style={styles.orderRow}><Text style={styles.orderKey}>Material:</Text><Text style={styles.orderVal}>{request.material_name}</Text></View>
        <View style={styles.orderRow}><Text style={styles.orderKey}>Quantity:</Text><Text style={styles.orderVal}>{request.quantity} {request.unit_type}</Text></View>
        <View style={styles.orderRow}><Text style={styles.orderKey}>Customer:</Text><Text style={styles.orderVal}>{request.customer_name} ({request.customer_phone})</Text></View>
        <View style={styles.orderRow}><Text style={styles.orderKey}>Agreed Rate:</Text><Text style={styles.orderVal}>₹{request.agreed_rate}/unit</Text></View>
        <View style={styles.orderRow}><Text style={styles.orderKey}>Pickup:</Text><Text style={styles.orderVal}>{request.from_address || 'Quarry Yard'}</Text></View>
        <View style={styles.orderRow}><Text style={styles.orderKey}>Deliver to:</Text><Text style={styles.orderVal}>{request.to_address || 'Customer Site'}</Text></View>
      </View>

      {/* Delivery Address Override */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>📍 DELIVERY ADDRESS (Edit if needed)</Text>
        <TextInput
          style={styles.input}
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          placeholder="Full delivery site address"
          placeholderTextColor={Colors.textDisabled}
          multiline
        />
      </View>

      {/* Mode Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>⚙️ TRANSPORT MODE</Text>
        <View style={styles.modeRow}>
          {[
            { key: 'auto', label: '⚡ Auto Lowest Cost', icon: 'flash' },
            { key: 'manual', label: '🔍 Manual Select', icon: 'list' },
            { key: 'own', label: '🏭 Own Vehicle', icon: 'car' },
          ].map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeBtn, mode === m.key && styles.modeBtnActive]}
              onPress={() => setMode(m.key)}
            >
              <Text style={[styles.modeBtnText, mode === m.key && styles.modeBtnTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Driver List */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>🚗 AVAILABLE DRIVERS ({drivers.length})</Text>
        {drivers.length === 0 ? (
          <View style={styles.emptyDrivers}>
            <Ionicons name="person-remove-outline" size={32} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No drivers currently available</Text>
          </View>
        ) : (
          drivers.map((driver, idx) => (
            <TouchableOpacity
              key={driver.id}
              style={[styles.driverCard, mode === 'manual' && selectedDriverId === driver.id && styles.driverCardSelected]}
              onPress={() => { if (mode === 'manual') setSelectedDriverId(driver.id); }}
              activeOpacity={0.85}
            >
              {/* Rank badge */}
              {idx === 0 && mode === 'auto' && (
                <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>⚡ CHEAPEST</Text></View>
              )}
              <View style={styles.driverRow}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>{(driver.name || 'D')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  <Text style={styles.driverSub}>{driver.vehicle_no} • ₹{driver.rate_per_km}/km</Text>
                  <Text style={styles.driverSub}>📞 {driver.phone}</Text>
                </View>
                <View style={styles.costBadge}>
                  <Text style={styles.costLabel}>Est. Cost</Text>
                  <Text style={styles.costAmount}>₹{driver.estimated_cost?.toLocaleString()}</Text>
                  <Text style={styles.costKm}>{driver.distance_km} km</Text>
                </View>
                {mode === 'manual' && selectedDriverId === driver.id && (
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" style={{ marginLeft: 8 }} />
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Assign CTA */}
      <TouchableOpacity
        style={[styles.assignBtn, assigning && { opacity: 0.7 }]}
        onPress={handleAssign}
        disabled={assigning}
      >
        {assigning
          ? <ActivityIndicator color="#FFF" />
          : <>
            <Ionicons name="checkmark-circle" size={22} color="#FFF" />
            <Text style={styles.assignBtnText}>
              {mode === 'auto' ? '⚡ Auto-Assign Cheapest Driver' : mode === 'manual' ? '✅ Assign Selected Driver' : '🏭 Use Own Vehicle'}
            </Text>
          </>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40, maxWidth: 700, alignSelf: 'center', width: '100%' },
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  backBtn: { marginTop: 16, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  backBtnText: { color: '#FFF', fontWeight: '700' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 12, color: Colors.textSecondary },

  orderCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orderKey: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', flex: 1 },
  orderVal: { fontSize: 13, color: Colors.text, fontWeight: '700', flex: 2, textAlign: 'right' },

  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.textTertiary, letterSpacing: 1, marginBottom: 10 },
  input: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 12, fontSize: 14, color: Colors.text, minHeight: 44 },

  modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  modeBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', minWidth: 100 },
  modeBtnActive: { borderColor: Colors.primary, backgroundColor: '#E8F5E9' },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  modeBtnTextActive: { color: Colors.primary },

  driverCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: Colors.border },
  driverCardSelected: { borderColor: '#4CAF50', backgroundColor: '#F1F8F1' },
  bestBadge: { backgroundColor: '#E8F5E9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 },
  bestBadgeText: { fontSize: 10, fontWeight: '800', color: '#2E7D32' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  driverAvatarText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  driverName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  driverSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  costBadge: { alignItems: 'center', backgroundColor: Colors.background, borderRadius: 8, padding: 8, minWidth: 72 },
  costLabel: { fontSize: 9, fontWeight: '700', color: Colors.textTertiary, letterSpacing: 0.5 },
  costAmount: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  costKm: { fontSize: 10, color: Colors.textSecondary },

  emptyDrivers: { alignItems: 'center', padding: 24, gap: 8, backgroundColor: Colors.surface, borderRadius: 12 },

  assignBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#2E7D32', height: 56, borderRadius: 14, marginTop: 8, marginBottom: 32,
    shadowColor: '#2E7D32', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6,
  },
  assignBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
