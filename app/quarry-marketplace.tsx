// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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

export default function QuarryMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quote rate modal
  const [quoteModalVisible, setQuoteModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [materialPrice, setMaterialPrice] = useState('');
  const [saving, setSaving] = useState(false);

  // Walkie & Doc Modals
  const [walkieModalVisible, setWalkieModalVisible] = useState(false);
  const [walkiePeer, setWalkiePeer] = useState({ name: 'Customer', role: 'customer', id: 'customer' });
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
      console.error('Quarry marketplace load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleQuoteRate = async () => {
    if (!materialPrice || !selectedOrder) {
      Alert.alert('Required', 'Please enter your material rate quote.');
      return;
    }
    setSaving(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
      await fetch(`${baseUrl}/api/marketplace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quote_rate',
          orderId: selectedOrder._id || selectedOrder.id,
          materialPrice: parseFloat(materialPrice) || 0,
        }),
      });
      setQuoteModalVisible(false);
      setMaterialPrice('');
      Alert.alert('Quoted 💰', 'Material rate quote sent to customer.');
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to submit quote.');
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptBid = async (order, bid) => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
      await fetch(`${baseUrl}/api/marketplace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept_bid',
          orderId: order._id || order.id,
          bidId: bid._id || bid.id,
          driverId: bid.driverId,
          driverName: bid.driverName,
          vehicleNo: bid.vehicleNo,
          transportPrice: bid.fareQuote,
        }),
      });
      Alert.alert('Transport Agreed! 🚚', `Assigned lorry ${bid.driverName} (${bid.vehicleNo}) for ${fmtCurrency(bid.fareQuote)}.`);
      loadData();
    } catch (e) {
      Alert.alert('Transport Agreed!', 'Lorry assigned.');
      loadData();
    }
  };

  const handleSettleOrder = async (order) => {
    Alert.alert('Settle Order & Driver Fare', `Mark customer payment collected (${fmtCurrency(order.totalPrice)}) and settle driver transport fare (${fmtCurrency(order.transportPrice)})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Settle Payment',
        onPress: async () => {
          try {
            const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
            await fetch(`${baseUrl}/api/marketplace`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'update_status',
                orderId: order._id || order.id,
                status: 'settled',
              }),
            });
            Alert.alert('Settled 🎉', 'Payment collected and driver transport fare settled!');
            loadData();
          } catch (e) {
            loadData();
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Quarry Owner Marketplace 🏢</Text>
          <Text style={styles.headerSub}>Review enquiries, accept lorry bids & settle driver fares</Text>
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
          icon="business-outline"
          title="No incoming requirements"
          description="Customer material requirements posted from mobile/web will appear here"
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {orders.map((o) => {
            const orderBids = bids.filter(b => b.orderId === (o._id || o.id));

            return (
              <View key={o._id || o.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.custName}>{o.customerName}</Text>
                    <Text style={styles.custPhone}>📱 {o.customerPhone || 'No phone'} · 📍 {o.customerAddress}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{o.status.toUpperCase().replace('_', ' ')}</Text>
                  </View>
                </View>

                {/* Cargo */}
                <View style={styles.cargoBox}>
                  <Text style={styles.cargoTitle}>Required Material:</Text>
                  <Text style={styles.cargoVal}>{o.quantity} {o.unitType} {o.materialName}</Text>
                </View>

                {/* Action 1: Quote Material Rate */}
                {o.status === 'requirement_posted' && (
                  <Button
                    title="💰 Quote Material Rate"
                    onPress={() => {
                      setSelectedOrder(o);
                      setQuoteModalVisible(true);
                    }}
                    style={{ marginVertical: 6 }}
                  />
                )}

                {/* Action 2: Show Driver Transport Bids when Rate Agreed / Bidding Active */}
                {(o.status === 'rate_agreed' || o.status === 'bidding_active') && (
                  <View style={styles.bidsSection}>
                    <Text style={styles.bidsTitle}>🚚 Nearby Lorry Driver Transport Bids ({orderBids.length}):</Text>
                    {orderBids.length === 0 ? (
                      <Text style={styles.noBidsText}>Waiting for nearby drivers to quote transport price…</Text>
                    ) : (
                      orderBids.map(b => (
                        <View key={b._id || b.id} style={styles.bidCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.driverBidName}>{b.driverName} ({b.vehicleNo})</Text>
                            <Text style={styles.driverBidFare}>Transport Quote: <Text style={{ color: '#16A34A', fontWeight: '800' }}>{fmtCurrency(b.fareQuote)}</Text> for {b.distanceKm || 12} km</Text>
                          </View>
                          <TouchableOpacity style={styles.acceptBidBtn} onPress={() => handleAcceptBid(o, b)}>
                            <Text style={styles.acceptBidText}>Accept Bid</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* Trip Execution Status */}
                {o.driverName ? (
                  <View style={styles.executionBox}>
                    <Text style={styles.execTitle}>Assigned Lorry: {o.driverName} ({o.vehicleNo})</Text>
                    <Text style={styles.execText}>Material Price: {fmtCurrency(o.materialPrice)} · Transport Fare: {fmtCurrency(o.transportPrice)}</Text>
                    <Text style={styles.execTotal}>Total Customer Payment: {fmtCurrency(o.totalPrice)}</Text>

                    {o.status === 'delivered' && (
                      <Button
                        title="💵 Collect Payment & Settle Driver Fare"
                        onPress={() => handleSettleOrder(o)}
                        variant="success"
                        style={{ marginTop: 8 }}
                      />
                    )}
                  </View>
                ) : null}

                {/* Shared Tools */}
                <View style={styles.toolsRow}>
                  <TouchableOpacity
                    style={[styles.toolBtn, { backgroundColor: '#F5F3FF' }]}
                    onPress={() => {
                      setWalkiePeer({ name: `Customer ${o.customerName}`, role: 'customer', id: 'customer' });
                      setWalkieModalVisible(true);
                    }}
                  >
                    <Ionicons name="radio-outline" size={14} color="#7C3AED" />
                    <Text style={[styles.toolText, { color: '#7C3AED' }]}>Walkie Customer</Text>
                  </TouchableOpacity>

                  {o.driverName ? (
                    <TouchableOpacity
                      style={[styles.toolBtn, { backgroundColor: '#EFF6FF' }]}
                      onPress={() => {
                        setWalkiePeer({ name: `Lorry ${o.driverName}`, role: 'driver', id: o.driverId });
                        setWalkieModalVisible(true);
                      }}
                    >
                      <Ionicons name="radio-outline" size={14} color="#2563EB" />
                      <Text style={[styles.toolText, { color: '#2563EB' }]}>Walkie Driver</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.toolBtn, { backgroundColor: '#DCFCE7' }]}
                    onPress={() => {
                      setSelectedOrderForDoc(o);
                      setDocModalVisible(true);
                    }}
                  >
                    <Ionicons name="document-text-outline" size={14} color="#16A34A" />
                    <Text style={[styles.toolText, { color: '#16A34A' }]}>Trip Docs ({(o.documents || []).length})</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Quote Rate Modal */}
      <Modal visible={quoteModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Quote Material Rate</Text>
            <Text style={styles.dialogSub}>Quote price for {selectedOrder?.quantity} {selectedOrder?.unitType} {selectedOrder?.materialName}</Text>

            <Input
              label="Quarry Material Rate (₹)"
              value={materialPrice}
              onChangeText={setMaterialPrice}
              keyboardType="numeric"
              placeholder="e.g. 3200"
              icon="cash-outline"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button title="Cancel" onPress={() => setQuoteModalVisible(false)} variant="ghost" style={{ flex: 1 }} />
              <Button title="Submit Quote" onPress={handleQuoteRate} loading={saving} style={{ flex: 1 }} />
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
        uploaderName="Quarry Owner"
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  custName: { ...Typography.h2, color: Colors.text },
  custPhone: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  badge: { backgroundColor: Colors.primarySurface, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 10, color: Colors.primary, fontWeight: '700' },
  cargoBox: { backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.md, padding: Spacing.md, marginVertical: 6 },
  cargoTitle: { ...Typography.caption, color: Colors.textSecondary },
  cargoVal: { ...Typography.h3, color: Colors.text, marginTop: 2 },
  bidsSection: { backgroundColor: '#F3E8FF', borderRadius: BorderRadius.md, padding: Spacing.md, marginVertical: 6 },
  bidsTitle: { ...Typography.captionSemibold, color: '#6B21A8', marginBottom: 6 },
  noBidsText: { ...Typography.caption, color: Colors.textSecondary, fontStyle: 'italic' },
  bidCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 8, borderRadius: BorderRadius.sm, marginBottom: 6 },
  driverBidName: { ...Typography.bodyMedium, color: Colors.text, fontWeight: '700' },
  driverBidFare: { ...Typography.caption, color: Colors.textSecondary },
  acceptBidBtn: { backgroundColor: '#16A34A', borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  acceptBidText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  executionBox: { backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.md, padding: Spacing.md, marginVertical: 6 },
  execTitle: { ...Typography.bodyMedium, color: Colors.primary, fontWeight: '700' },
  execText: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  execTotal: { ...Typography.captionSemibold, color: Colors.text, marginTop: 2 },
  toolsRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: BorderRadius.sm },
  toolText: { fontSize: 11, fontWeight: '700' },
  // Dialog
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  dialog: { width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl },
  dialogTitle: { ...Typography.h2, color: Colors.text, textAlign: 'center' },
  dialogSub: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 12 },
});
