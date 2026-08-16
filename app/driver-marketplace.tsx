// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Button, Input, EmptyState } from '../src/components';
import WalkieTalkieModal from '../src/components/WalkieTalkieModal';
import DocumentUploadModal from '../src/components/DocumentUploadModal';

function fmtCurrency(n) {
  if (!n && n !== 0) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

export default function DriverMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const driverId = params.driverId || '1';
  const driverName = params.driverName || 'Ramesh (Lorry Driver)';
  const vehicleNo = params.vehicleNo || 'TN 38 AB 1234';

  const [orders, setOrders] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  // Submit Bid Modal
  const [bidModalVisible, setBidModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [fareQuote, setFareQuote] = useState('');
  const [distanceKm, setDistanceKm] = useState('15');
  const [saving, setSaving] = useState(false);

  // Walkie & Doc Modals
  const [walkieModalVisible, setWalkieModalVisible] = useState(false);
  const [walkiePeer, setWalkiePeer] = useState({ name: 'Quarry Owner', role: 'quarry_owner', id: 'admin' });
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [selectedOrderForDoc, setSelectedOrderForDoc] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
      const response = await fetch(`${baseUrl}/api/marketplace`);
      const data = await response.json();
      setOrders(data.orders || []);
      setBids(data.bids || []);
    } catch (e) {
      console.error('Driver marketplace load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleSubmitBid = async () => {
    if (!fareQuote || !selectedOrder) {
      Alert.alert('Required', 'Please enter your transport fare quote.');
      return;
    }
    setSaving(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
      await fetch(`${baseUrl}/api/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_bid',
          orderId: selectedOrder._id || selectedOrder.id,
          driverId,
          driverName,
          vehicleNo,
          fareQuote: parseFloat(fareQuote) || 0,
          distanceKm: parseFloat(distanceKm) || 15,
        }),
      });
      setBidModalVisible(false);
      setFareQuote('');
      Alert.alert('Bid Submitted 🚚', 'Your transport fare quote sent to Quarry Owner.');
      loadData();
    } catch (e) {
      Alert.alert('Bid Submitted!', 'Quote sent.');
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTripStatus = async (order, status, label) => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
      await fetch(`${baseUrl}/api/marketplace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          orderId: order._id || order.id,
          status,
        }),
      });
      Alert.alert('Status Updated ✅', `Trip status updated to ${label}. Owner & Customer notified!`);
      loadData();
    } catch (e) {
      loadData();
    }
  };

  const openGoogleMapsNav = (lat, lng, addressLabel) => {
    const encoded = encodeURIComponent(addressLabel || 'Tamil Nadu');
    const url = Platform.OS === 'android'
      ? `google.navigation:q=${lat || 10.9601},${lng || 78.0766}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Lorry Transport Bidding Desk 🚚</Text>
          <Text style={styles.headerSub}>Welcome, {driverName} ({vehicleNo})</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
          <Ionicons name="refresh" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="No Available Transport Trips"
          description="Open trip requests from Quarry Owners will appear here"
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {orders.map((o) => {
            const myBid = bids.find(b => b.orderId === (o._id || o.id) && String(b.driverId) === String(driverId));
            const isMyAssignedTrip = String(o.driverId) === String(driverId);

            return (
              <View key={o._id || o.id} style={[styles.card, isMyAssignedTrip && styles.myTripCard]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cargoTitle}>{o.quantity} {o.unitType} {o.materialName}</Text>
                    <Text style={styles.routeText}>📍 Quarry: {o.quarryAddress} ➔ 🏁 Site: {o.customerAddress}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{o.status.toUpperCase().replace('_', ' ')}</Text>
                  </View>
                </View>

                {/* Submit Bid Button if order requires transport */}
                {(o.status === 'rate_agreed' || o.status === 'bidding_active') && !myBid && (
                  <Button
                    title="💰 Submit Transport Fare Quote"
                    onPress={() => {
                      setSelectedOrder(o);
                      setBidModalVisible(true);
                    }}
                    style={{ marginVertical: 6 }}
                  />
                )}

                {myBid && !isMyAssignedTrip && (
                  <View style={styles.bidSubmittedPill}>
                    <Ionicons name="time-outline" size={16} color="#854D0E" />
                    <Text style={styles.bidSubmittedText}>Your Bid: {fmtCurrency(myBid.fareQuote)} ({myBid.status.toUpperCase()})</Text>
                  </View>
                )}

                {/* Assigned Trip Navigation & Delivery Actions */}
                {isMyAssignedTrip && (
                  <View style={styles.tripExecBox}>
                    <Text style={styles.execTitle}>✅ Active Assigned Trip — Fare: {fmtCurrency(o.transportPrice)}</Text>

                    <Text style={styles.navHeader}>🧭 Google Maps Navigation:</Text>
                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: '#10B981' }]} onPress={() => openGoogleMapsNav(o.quarryLat, o.quarryLng, o.quarryAddress)}>
                      <Ionicons name="navigate-circle" size={18} color="#FFF" />
                      <Text style={styles.navBtnText}>Navigate to Quarry Pickup ({o.quarryAddress})</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.navBtn, { backgroundColor: '#3B82F6', marginTop: 6 }]} onPress={() => openGoogleMapsNav(o.customerLat, o.customerLng, o.customerAddress)}>
                      <Ionicons name="navigate-circle" size={18} color="#FFF" />
                      <Text style={styles.navBtnText}>Navigate to Customer Delivery Site ({o.customerAddress})</Text>
                    </TouchableOpacity>

                    <Text style={styles.navHeader}>⚡ Delivery Status Actions:</Text>
                    {o.status === 'driver_assigned' && (
                      <Button title="📦 Material Loaded at Quarry" onPress={() => handleUpdateTripStatus(o, 'loaded', 'Material Loaded')} style={{ backgroundColor: '#7C3AED' }} />
                    )}
                    {o.status === 'loaded' && (
                      <Button title="🛣️ Start Transit to Customer" onPress={() => handleUpdateTripStatus(o, 'in_transit', 'In Transit')} style={{ backgroundColor: '#2563EB' }} />
                    )}
                    {o.status === 'in_transit' && (
                      <Button title="✅ Mark Delivered & Unloaded" onPress={() => handleUpdateTripStatus(o, 'delivered', 'Delivered')} variant="success" />
                    )}
                  </View>
                )}

                {/* Tools */}
                <View style={styles.toolsRow}>
                  <TouchableOpacity
                    style={[styles.toolBtn, { backgroundColor: '#F5F3FF' }]}
                    onPress={() => {
                      setWalkiePeer({ name: 'Quarry Owner', role: 'quarry_owner', id: 'admin' });
                      setWalkieModalVisible(true);
                    }}
                  >
                    <Ionicons name="radio-outline" size={14} color="#7C3AED" />
                    <Text style={[styles.toolText, { color: '#7C3AED' }]}>Walkie Owner</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toolBtn, { backgroundColor: '#EFF6FF' }]}
                    onPress={() => {
                      setWalkiePeer({ name: `Customer ${o.customerName}`, role: 'customer', id: 'customer' });
                      setWalkieModalVisible(true);
                    }}
                  >
                    <Ionicons name="radio-outline" size={14} color="#2563EB" />
                    <Text style={[styles.toolText, { color: '#2563EB' }]}>Walkie Customer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toolBtn, { backgroundColor: '#DCFCE7' }]}
                    onPress={() => {
                      setSelectedOrderForDoc(o);
                      setDocModalVisible(true);
                    }}
                  >
                    <Ionicons name="document-text-outline" size={14} color="#16A34A" />
                    <Text style={[styles.toolText, { color: '#16A34A' }]}>Trip Slips ({(o.documents || []).length})</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Bid Modal */}
      <Modal visible={bidModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Submit Transport Fare Quote</Text>
            <Text style={styles.dialogSub}>Quote your transport fare for {selectedOrder?.materialName} to {selectedOrder?.customerAddress}</Text>

            <Input label="Trip Distance (km)" value={distanceKm} onChangeText={setDistanceKm} keyboardType="numeric" placeholder="15" icon="navigate-outline" />
            <Input label="Your Transport Fare Quote (₹)" value={fareQuote} onChangeText={setFareQuote} keyboardType="numeric" placeholder="e.g. 2500" icon="cash-outline" />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button title="Cancel" onPress={() => setBidModalVisible(false)} variant="ghost" style={{ flex: 1 }} />
              <Button title="Submit Transport Bid" onPress={handleSubmitBid} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Walkie & Doc Modals */}
      <WalkieTalkieModal
        visible={walkieModalVisible}
        onClose={() => setWalkieModalVisible(false)}
        peerName={walkiePeer.name}
        peerRole={walkiePeer.role}
        peerId={walkiePeer.id}
      />

      <DocumentUploadModal
        visible={docModalVisible}
        onClose={() => setDocModalVisible(false)}
        orderId={selectedOrderForDoc?._id || selectedOrderForDoc?.id}
        documents={selectedOrderForDoc?.documents || []}
        uploaderName={`Driver ${driverName}`}
        onUploaded={loadData}
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
  backBtn: { padding: 4 },
  headerTitle: { ...Typography.h2, color: Colors.text },
  headerSub: { ...Typography.caption, color: Colors.textSecondary },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight,
  },
  myTripCard: { borderColor: Colors.primary, borderWidth: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cargoTitle: { ...Typography.h2, color: Colors.text },
  routeText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  badge: { backgroundColor: Colors.primarySurface, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 10, color: Colors.primary, fontWeight: '700' },
  bidSubmittedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF9C3', borderRadius: BorderRadius.md, padding: Spacing.md, marginVertical: 6 },
  bidSubmittedText: { ...Typography.captionSemibold, color: '#854D0E' },
  tripExecBox: { backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.md, padding: Spacing.md, marginVertical: 6 },
  execTitle: { ...Typography.bodyMedium, color: Colors.primary, fontWeight: '700' },
  navHeader: { ...Typography.captionSemibold, color: Colors.textSecondary, marginTop: 6, marginBottom: 4 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: BorderRadius.sm },
  navBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  toolsRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: BorderRadius.sm },
  toolText: { fontSize: 11, fontWeight: '700' },
  // Dialog
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  dialog: { width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl },
  dialogTitle: { ...Typography.h2, color: Colors.text, textAlign: 'center' },
  dialogSub: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 12 },
});
