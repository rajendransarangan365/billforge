// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, TextInput,
  Dimensions, RefreshControl, Linking, Platform,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import * as MarketplaceStore from '../src/store/MarketplaceStore';
import { useAuth } from '../src/context/AuthContext';

const { width: W } = Dimensions.get('window');

function fmtCurrency(n: number) {
  if (!n) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function openGoogleMapsNav(lat: number, lng: number, label: string) {
  const encoded = encodeURIComponent(label || 'Destination');
  const androidUrl = `google.navigation:q=${lat},${lng}`;
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  Linking.openURL(androidUrl).catch(() => Linking.openURL(webUrl));
}

const TRIP_STEPS = [
  { status: 'driver_assigned', label: 'Go to Quarry',   icon: 'navigate-outline', action: 'loaded', actionLabel: 'Mark Loaded', color: Colors.statusAssigned },
  { status: 'loaded',          label: 'Go to Customer', icon: 'car-sport-outline', action: 'in_transit', actionLabel: 'Start Delivery', color: Colors.statusLoaded },
  { status: 'in_transit',      label: 'Delivering',     icon: 'navigate',          action: 'delivered',  actionLabel: 'Mark Delivered', color: Colors.statusTransit },
  { status: 'delivered',       label: 'Delivered',      icon: 'checkmark-done-circle-outline', action: null, actionLabel: null, color: Colors.success },
];

export default function DriverMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const driverId = user?.id || params.driverId || 'driver-1';
  const driverName = user?.name || params.driverName || 'Driver';
  const vehicleNo = user?.vehicleNo || params.vehicleNo || 'TN 38 AB 1234';

  const [availableOrders, setAvailableOrders] = useState<MarketplaceStore.MarketplaceOrder[]>([]);
  const [myBids, setMyBids] = useState<MarketplaceStore.TransportBid[]>([]);
  const [myTrips, setMyTrips] = useState<MarketplaceStore.MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'mytrips'>('available');

  // Bid modal
  const [bidVisible, setBidVisible] = useState(false);
  const [bidOrder, setBidOrder] = useState<MarketplaceStore.MarketplaceOrder | null>(null);
  const [fare, setFare] = useState('');
  const [distance, setDistance] = useState('15');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const allOrders = await MarketplaceStore.getOrders();
      const allBids = await MarketplaceStore.getBids();

      // My bids
      const mine = allBids.filter(b => b.driverId === driverId);
      setMyBids(mine);

      // Available to bid: rate_agreed or bidding_active + I haven't bid yet
      const myBidOrderIds = new Set(mine.map(b => b.orderId));
      const available = allOrders.filter(o =>
        (o.status === 'rate_agreed' || o.status === 'bidding_active') &&
        !myBidOrderIds.has(o.id)
      );
      setAvailableOrders(available);

      // My active/completed trips
      const trips = allOrders.filter(o => o.driverId === driverId);
      setMyTrips(trips);
    } catch (e) {
      console.error('Driver load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useFocusEffect(useCallback(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [loadData]));

  const handleSubmitBid = async () => {
    if (!fare || !bidOrder) { Alert.alert('Required', 'Please enter your transport fare.'); return; }
    const fareNum = parseFloat(fare);
    if (isNaN(fareNum) || fareNum <= 0) { Alert.alert('Invalid', 'Enter a valid fare amount.'); return; }
    const distNum = parseFloat(distance) || 15;

    setSaving(true);
    try {
      await MarketplaceStore.createBid({
        orderId: bidOrder.id,
        driverId,
        driverName,
        vehicleNo,
        fareQuote: fareNum,
        distanceKm: distNum,
      });
      setBidVisible(false);
      setFare(''); setDistance('15');
      Alert.alert('Bid Submitted!', 'Your transport quote has been sent to the quarry owner. You will be notified if your bid is accepted.');
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to submit bid. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTripStatus = async (order: MarketplaceStore.MarketplaceOrder, newStatus: string, label: string) => {
    Alert.alert(
      'Confirm Status Update',
      `Mark this delivery as "${label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: async () => {
            await MarketplaceStore.updateOrder(order.id, { status: newStatus as any });
            Alert.alert('Updated!', `Status updated to ${label}. The quarry owner and customer have been notified.`);
            loadData();
          },
        },
      ]
    );
  };

  const currentTrip = myTrips.find(t => ['driver_assigned', 'loaded', 'in_transit'].includes(t.status));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{driverName}</Text>
          <View style={styles.vehicleBadge}>
            <Ionicons name="car-outline" size={11} color={Colors.info} />
            <Text style={styles.vehicleText}>{vehicleNo}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); loadData(); }}>
          <Ionicons name="refresh" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Active Trip Banner */}
      {currentTrip && (
        <View style={styles.activeTripBanner}>
          <View style={styles.activeDot} />
          <Text style={styles.activeTripText}>Active Trip: {currentTrip.quantity} {currentTrip.unitType} {currentTrip.materialName}</Text>
          <TouchableOpacity onPress={() => setActiveTab('mytrips')} style={styles.viewTripBtn}>
            <Text style={styles.viewTripText}>View</Text>
            <Ionicons name="chevron-forward" size={13} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.tabActive]}
          onPress={() => setActiveTab('available')}
        >
          <Ionicons name="grid-outline" size={14} color={activeTab === 'available' ? Colors.primary : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'available' && styles.tabTextActive]}>
            Available ({availableOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'mytrips' && styles.tabActive]}
          onPress={() => setActiveTab('mytrips')}
        >
          <Ionicons name="car-sport-outline" size={14} color={activeTab === 'mytrips' ? Colors.primary : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'mytrips' && styles.tabTextActive]}>
            My Trips ({myTrips.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeTab === 'available' ? (
        /* Available Trips Tab */
        availableOrders.length === 0 ? (
          <View style={styles.centerWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="car-sport-outline" size={40} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No Available Trips</Text>
            <Text style={styles.emptySub}>When quarry owners need transport after a customer agrees to rates, trips will appear here for you to bid on.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} tintColor={Colors.primary} />}
          >
            {availableOrders.map(order => (
              <View key={order.id} style={styles.card}>
                {/* Material Info */}
                <View style={styles.cardTop}>
                  <View style={styles.cardMatIcon}>
                    <Ionicons name="layers" size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardMat}>{order.quantity} {order.unitType} {order.materialName}</Text>
                    <Text style={styles.cardCustomer}>{order.customerName}</Text>
                  </View>
                </View>

                {/* Route */}
                <View style={styles.routeCard}>
                  <View style={styles.routeRow}>
                    <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.routeLabel}>Pickup (Quarry)</Text>
                      <Text style={styles.routeAddr}>{order.quarryAddress}</Text>
                    </View>
                  </View>
                  <View style={styles.routeLine} />
                  <View style={styles.routeRow}>
                    <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.routeLabel}>Delivery Site</Text>
                      <Text style={styles.routeAddr}>{order.customerAddress}</Text>
                    </View>
                  </View>
                </View>

                {/* Bid button */}
                <TouchableOpacity
                  style={styles.bidBtn}
                  onPress={() => { setBidOrder(order); setFare(''); setDistance('15'); setBidVisible(true); }}
                  activeOpacity={0.82}
                >
                  <Ionicons name="trending-up" size={16} color="#FFF" />
                  <Text style={styles.bidBtnText}>Submit Transport Quote</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )
      ) : (
        /* My Trips Tab */
        myTrips.length === 0 ? (
          <View style={styles.centerWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={40} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No Trips Yet</Text>
            <Text style={styles.emptySub}>Submit bids on available trips. When your bid is accepted by a quarry owner, the trip will appear here.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} tintColor={Colors.primary} />}
          >
            {myTrips.map(trip => {
              const currentStep = TRIP_STEPS.find(s => s.status === trip.status);
              const isActive = ['driver_assigned', 'loaded', 'in_transit'].includes(trip.status);

              return (
                <View key={trip.id} style={[styles.card, isActive && styles.activeCard]}>
                  {isActive && (
                    <View style={styles.activeTripHeader}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activeTripHeaderText}>Active Trip</Text>
                    </View>
                  )}

                  <Text style={styles.cardMat}>{trip.quantity} {trip.unitType} {trip.materialName}</Text>
                  <Text style={styles.cardCustomer}>{trip.customerName} · {trip.customerPhone}</Text>

                  <View style={styles.fareBox}>
                    <Ionicons name="wallet-outline" size={16} color={Colors.success} />
                    <Text style={styles.fareText}>Your Earning: {fmtCurrency(trip.transportPrice)}</Text>
                  </View>

                  {/* Navigation Buttons */}
                  {isActive && (
                    <View style={styles.navBtns}>
                      <TouchableOpacity
                        style={[styles.navBtn, { backgroundColor: Colors.primary }]}
                        onPress={() => openGoogleMapsNav(trip.quarryLat, trip.quarryLng, trip.quarryAddress)}
                      >
                        <Ionicons name="navigate" size={15} color="#FFF" />
                        <Text style={styles.navBtnText}>Navigate to Quarry</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.navBtn, { backgroundColor: Colors.info }]}
                        onPress={() => openGoogleMapsNav(trip.customerLat, trip.customerLng, trip.customerAddress)}
                      >
                        <Ionicons name="navigate" size={15} color="#FFF" />
                        <Text style={styles.navBtnText}>Navigate to Customer</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Status Action */}
                  {currentStep && currentStep.action && (
                    <TouchableOpacity
                      style={[styles.statusActionBtn, { backgroundColor: currentStep.color }]}
                      onPress={() => handleUpdateTripStatus(trip, currentStep.action!, currentStep.actionLabel!)}
                    >
                      <Text style={styles.statusActionText}>{currentStep.actionLabel}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#FFF" />
                    </TouchableOpacity>
                  )}

                  {trip.status === 'delivered' && (
                    <View style={styles.completedBox}>
                      <Ionicons name="checkmark-done-circle" size={20} color={Colors.success} />
                      <Text style={styles.completedText}>Delivery Complete — Awaiting Payment Clearance</Text>
                    </View>
                  )}

                  {trip.status === 'settled' && (
                    <View style={styles.settledBox}>
                      <Ionicons name="wallet" size={20} color={Colors.statusSettled} />
                      <Text style={styles.settledText}>Payment Settled — {fmtCurrency(trip.transportPrice)}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )
      )}

      {/* Bid Modal */}
      <Modal visible={bidVisible} animationType="slide" transparent onRequestClose={() => setBidVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={styles.dialogHandle} />
            <Text style={styles.dialogTitle}>Submit Transport Quote</Text>
            {bidOrder && (
              <View style={styles.routeCard}>
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>Pickup — {bidOrder.quarryAddress}</Text>
                  </View>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>Delivery — {bidOrder.customerAddress}</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.bidFormRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Distance (km)</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.modalInput}
                    value={distance}
                    onChangeText={setDistance}
                    keyboardType="numeric"
                    placeholder="15"
                    placeholderTextColor={Colors.textDisabled}
                  />
                </View>
              </View>
              <View style={[styles.fieldGroup, { flex: 1.5 }]}>
                <Text style={styles.fieldLabel}>Your Fare Quote (₹)</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.modalInput}
                    value={fare}
                    onChangeText={setFare}
                    keyboardType="numeric"
                    placeholder="e.g. 2500"
                    placeholderTextColor={Colors.textDisabled}
                    autoFocus
                  />
                </View>
              </View>
            </View>

            <View style={styles.dialogBtns}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setBidVisible(false)}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogConfirmBtn, saving && { opacity: 0.7 }]}
                onPress={handleSubmitBid}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.dialogConfirmText}>Submit Bid</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  vehicleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  vehicleText: { fontSize: 11, color: Colors.info, fontWeight: '600' },
  refreshBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  activeTripBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primarySurface, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.primaryBorder,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  activeTripText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.primary },
  viewTripBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewTripText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  tabs: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textTertiary },
  tabTextActive: { color: Colors.primary },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 20, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3,
    gap: 10,
  },
  activeCard: { borderColor: Colors.primary, borderWidth: 1.5 },
  activeTripHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeTripHeaderText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardMatIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  cardMat: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  cardCustomer: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  routeCard: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, gap: 0, borderWidth: 1, borderColor: Colors.borderLight },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeAddr: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  routeLabel: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary },
  routeLine: { width: 1.5, height: 16, backgroundColor: Colors.borderMedium, marginLeft: 4, marginVertical: 2 },
  bidBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 50, borderRadius: 12, backgroundColor: Colors.primary,
  },
  bidBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  fareBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.statusAgreedBg, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: Colors.successBorder,
  },
  fareText: { fontSize: 14, fontWeight: '700', color: Colors.success },
  navBtns: { gap: 8 },
  navBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 12 },
  navBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  statusActionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 50, borderRadius: 12,
  },
  statusActionText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  completedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.statusAgreedBg, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.successBorder,
  },
  completedText: { fontSize: 13, fontWeight: '600', color: Colors.success, flex: 1 },
  settledBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.statusSettledBg, borderRadius: 10, padding: 12,
  },
  settledText: { fontSize: 13, fontWeight: '600', color: Colors.statusSettled, flex: 1 },
  // Modal
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  dialog: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32, gap: 16 },
  dialogHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.borderMedium, alignSelf: 'center', marginBottom: 8 },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  bidFormRow: { flexDirection: 'row', gap: 12 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  inputWrap: {
    backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
  },
  modalInput: { height: 50, paddingHorizontal: 14, fontSize: 16, color: Colors.text },
  dialogBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dialogCancelBtn: { flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  dialogCancelText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  dialogConfirmBtn: { flex: 1.5, height: 50, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  dialogConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
