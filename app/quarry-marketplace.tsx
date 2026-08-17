// @ts-nocheck
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import * as API from '../src/services/MarketplaceAPI';
import { useAuth } from '../src/context/AuthContext';

function fmtCurrency(n: number) {
  if (!n) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  requirement_posted: { label: 'New Request',     color: Colors.statusNew,      bg: Colors.statusNewBg,      icon: 'alert-circle-outline' },
  rate_quoted:        { label: 'Rate Sent',        color: Colors.statusQuoted,   bg: Colors.statusQuotedBg,   icon: 'pricetag-outline' },
  rate_agreed:        { label: 'Rate Agreed',      color: Colors.statusAgreed,   bg: Colors.statusAgreedBg,   icon: 'checkmark-circle-outline' },
  bidding_active:     { label: 'Bids Coming In',   color: Colors.statusBidding,  bg: Colors.statusBiddingBg,  icon: 'trending-up-outline' },
  driver_assigned:    { label: 'Driver Assigned',  color: Colors.statusAssigned, bg: Colors.statusAssignedBg, icon: 'car-outline' },
  loaded:             { label: 'Material Loaded',  color: Colors.statusLoaded,   bg: Colors.statusLoadedBg,   icon: 'cube-outline' },
  in_transit:         { label: 'In Transit',       color: Colors.statusTransit,  bg: Colors.statusTransitBg,  icon: 'navigate-outline' },
  delivered:          { label: 'Delivered',        color: Colors.statusDelivered,bg: Colors.statusDeliveredBg,icon: 'checkmark-done-circle-outline' },
  settled:            { label: 'Settled',          color: Colors.statusSettled,  bg: Colors.statusSettledBg,  icon: 'wallet-outline' },
};

export default function QuarryMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [orders, setOrders] = useState<API.MarketplaceOrder[]>([]);
  const [bidsMap, setBidsMap] = useState<Record<string, API.TransportBid[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Quote modal
  const [quoteVisible, setQuoteVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<API.MarketplaceOrder | null>(null);
  const [matPrice, setMatPrice] = useState('');
  const [saving, setSaving] = useState(false);

  // Settle modal
  const [settleVisible, setSettleVisible] = useState(false);
  const [settleOrder, setSettleOrder] = useState<API.MarketplaceOrder | null>(null);

  // Live notification
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { orders: all, bids } = await API.getOrders();
      setOrders(all);
      const map: Record<string, API.TransportBid[]> = {};
      bids.forEach(b => {
        if (!map[b.orderId]) map[b.orderId] = [];
        map[b.orderId].push(b);
      });
      setBidsMap(map);
    } catch (e) {
      console.error('Quarry load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();

    // Real-time subscriptions
    const unsub = API.subscribeToMarketplace({
      onOrderCreated: (data) => {
        setNewOrderAlert(`New order: ${data.customerName} needs ${data.quantity} ${data.unitType} ${data.materialName}`);
        setTimeout(() => setNewOrderAlert(null), 5000);
        loadData();
      },
      onBidSubmitted: (data) => {
        loadData(); // Refresh to show new bids
      },
    });

    // Fallback polling every 8s
    const poll = setInterval(loadData, 8000);

    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [loadData]));

  const handleQuoteRate = async () => {
    if (!matPrice || !selectedOrder) { Alert.alert('Required', 'Please enter material rate.'); return; }
    const price = parseFloat(matPrice);
    if (isNaN(price) || price <= 0) { Alert.alert('Invalid', 'Enter a valid positive rate.'); return; }
    setSaving(true);
    try {
      const orderId = selectedOrder._id || selectedOrder.id || '';
      await API.quoteRate(orderId, price);
      setQuoteVisible(false);
      setMatPrice('');
      setSelectedOrder(null);
      Alert.alert('Rate Sent', `Your rate of ${fmtCurrency(price)} has been sent to the customer. They will receive it instantly.`);
      loadData();
    } catch (e) {
      Alert.alert('Error', `Failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptBid = async (order: API.MarketplaceOrder, bid: API.TransportBid) => {
    Alert.alert(
      'Accept Transport Bid?',
      `Assign ${bid.driverName} (${bid.vehicleNo}) at ${fmtCurrency(bid.fareQuote)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept & Assign',
          style: 'default',
          onPress: async () => {
            try {
              const orderId = order._id || order.id || '';
              await API.acceptBid(orderId, bid);
              Alert.alert('Driver Assigned!', `${bid.driverName} has been assigned. They are notified in real-time.`);
              loadData();
            } catch (e) {
              Alert.alert('Error', `Failed: ${e.message}`);
            }
          },
        },
      ]
    );
  };

  const handleSettle = async () => {
    if (!settleOrder) return;
    try {
      const orderId = settleOrder._id || settleOrder.id || '';
      await API.settleOrder(orderId);
      setSettleVisible(false);
      setSettleOrder(null);
      Alert.alert('Settled', 'Order fully settled.');
      loadData();
    } catch (e) {
      Alert.alert('Error', `Failed: ${e.message}`);
    }
  };

  const urgentOrders = orders.filter(o => o.status === 'requirement_posted');
  const activeOrders = orders.filter(o => !['requirement_posted', 'settled'].includes(o.status));
  const settledOrders = orders.filter(o => o.status === 'settled');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Quarry Dispatch</Text>
          {user?.name ? <Text style={styles.headerSub}>{user.name}</Text> : null}
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); loadData(); }}>
          <Ionicons name="refresh" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* New order real-time alert */}
      {newOrderAlert && (
        <View style={styles.liveAlert}>
          <View style={styles.liveDot} />
          <Text style={styles.liveAlertText} numberOfLines={1}>{newOrderAlert}</Text>
        </View>
      )}

      {/* Stats bar */}
      <View style={styles.statsBar}>
        {[
          { num: urgentOrders.length, lbl: 'New', color: Colors.statusNew },
          { num: activeOrders.length, lbl: 'Active', color: Colors.statusAssigned },
          { num: settledOrders.length, lbl: 'Settled', color: Colors.success },
          { num: orders.length, lbl: 'Total', color: Colors.primary },
        ].map((s, i, arr) => (
          <React.Fragment key={s.lbl}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: s.color }]}>{s.num}</Text>
              <Text style={styles.statLbl}>{s.lbl}</Text>
            </View>
            {i < arr.length - 1 && <View style={styles.statDivider} />}
          </React.Fragment>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerWrap}>
          <View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={40} color={Colors.textTertiary} /></View>
          <Text style={styles.emptyTitle}>No Customer Orders Yet</Text>
          <Text style={styles.emptySub}>When customers post material requirements, they'll appear here instantly. Share your quarry link with customers to get started.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll} contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} tintColor={Colors.primary} />}
        >
          {orders.map(order => {
            const sc = STATUS_LABELS[order.status] || STATUS_LABELS.requirement_posted;
            const orderId = order._id || order.id || '';
            const orderBids = bidsMap[orderId] || [];
            const pendingBids = orderBids.filter(b => b.status === 'pending');
            const isNew = order.status === 'requirement_posted';

            return (
              <View key={orderId} style={[styles.card, isNew && styles.newCard]}>
                {isNew && (
                  <View style={styles.newBadgeRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.newBadgeText}>New Customer Request</Text>
                  </View>
                )}

                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardMat}>{order.quantity} {order.unitType} {order.materialName}</Text>
                    <View style={styles.customerRow}>
                      <Ionicons name="person-outline" size={13} color={Colors.textTertiary} />
                      <Text style={styles.customerName}>{order.customerName} · {order.customerPhone}</Text>
                    </View>
                    <View style={styles.addressRow}>
                      <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
                      <Text style={styles.addressText} numberOfLines={2}>{order.customerAddress}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                    <Ionicons name={sc.icon as any} size={11} color={sc.color} />
                    <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* New — Quote rate */}
                {order.status === 'requirement_posted' && (
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => { setSelectedOrder(order); setMatPrice(''); setQuoteVisible(true); }} activeOpacity={0.82}>
                    <Ionicons name="pricetag" size={16} color="#FFF" />
                    <Text style={styles.primaryBtnText}>Quote Material Rate</Text>
                  </TouchableOpacity>
                )}

                {/* Rate sent — waiting for customer */}
                {order.status === 'rate_quoted' && (
                  <View style={styles.waitingBox}>
                    <Ionicons name="time-outline" size={16} color={Colors.statusQuoted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.waitingTitle}>Waiting for Customer</Text>
                      <Text style={styles.waitingText}>Quoted {fmtCurrency(order.materialPrice)} — customer needs to agree. You'll be notified instantly.</Text>
                    </View>
                  </View>
                )}

                {/* Rate agreed — show driver bids */}
                {(order.status === 'rate_agreed' || order.status === 'bidding_active') && (
                  <View style={styles.bidsSection}>
                    <View style={styles.bidsHeader}>
                      <Ionicons name="car-sport" size={15} color={Colors.navy} />
                      <Text style={styles.bidsSectionTitle}>
                        Transport Bids {pendingBids.length > 0 ? `— ${pendingBids.length} driver(s) available` : '— Waiting for drivers to bid...'}
                      </Text>
                    </View>

                    {pendingBids.length === 0 ? (
                      <View style={styles.noBidsBox}>
                        <ActivityIndicator size="small" color={Colors.textTertiary} />
                        <Text style={styles.noBidsText}>Nearby lorry drivers will see this and submit bids shortly...</Text>
                      </View>
                    ) : (
                      pendingBids.map(bid => (
                        <View key={bid._id || bid.id} style={styles.bidCard}>
                          <View style={styles.bidLeft}>
                            <View style={styles.bidDriverIcon}><Ionicons name="car-sport" size={16} color={Colors.info} /></View>
                            <View>
                              <Text style={styles.bidDriverName}>{bid.driverName}</Text>
                              <Text style={styles.bidVehicle}>{bid.vehicleNo} · {bid.distanceKm} km</Text>
                            </View>
                          </View>
                          <View style={styles.bidRight}>
                            <Text style={styles.bidFare}>{fmtCurrency(bid.fareQuote)}</Text>
                            <TouchableOpacity style={styles.acceptBidBtn} onPress={() => handleAcceptBid(order, bid)}>
                              <Text style={styles.acceptBidText}>Accept</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* Active trip */}
                {['driver_assigned', 'loaded', 'in_transit'].includes(order.status) && order.driverName && (
                  <View style={styles.tripInfoBox}>
                    <View style={styles.tripRow}>
                      <Ionicons name="car-sport" size={14} color={Colors.info} />
                      <Text style={styles.tripLabel}>{order.driverName} · {order.vehicleNo}</Text>
                    </View>
                    <View style={styles.tripRow}>
                      <Ionicons name="cash-outline" size={14} color={Colors.success} />
                      <Text style={styles.tripLabel}>
                        Material {fmtCurrency(order.materialPrice)} + Transport {fmtCurrency(order.transportPrice)} = Total {fmtCurrency((order.materialPrice || 0) + (order.transportPrice || 0))}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Delivered — collect and settle */}
                {order.status === 'delivered' && (
                  <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: Colors.success }]} onPress={() => { setSettleOrder(order); setSettleVisible(true); }} activeOpacity={0.82}>
                    <Ionicons name="wallet" size={16} color="#FFF" />
                    <Text style={styles.primaryBtnText}>Collect Payment & Settle Driver</Text>
                  </TouchableOpacity>
                )}

                {order.status === 'settled' && (
                  <View style={[styles.waitingBox, { backgroundColor: Colors.statusSettledBg }]}>
                    <Ionicons name="checkmark-done-circle" size={16} color={Colors.statusSettled} />
                    <Text style={[styles.waitingTitle, { color: Colors.statusSettled }]}>Fully Settled</Text>
                  </View>
                )}

                <Text style={styles.orderDate}>
                  {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Quote Rate Modal */}
      <Modal visible={quoteVisible} animationType="slide" transparent onRequestClose={() => setQuoteVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={styles.dialogHandle} />
            <Text style={styles.dialogTitle}>Quote Material Rate</Text>
            {selectedOrder && (
              <View style={styles.dialogInfoBox}>
                <Text style={styles.dialogInfoText}>{selectedOrder.quantity} {selectedOrder.unitType} {selectedOrder.materialName}</Text>
                <Text style={styles.dialogInfoSub}>{selectedOrder.customerName} · {selectedOrder.customerAddress}</Text>
              </View>
            )}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Your Rate per {selectedOrder?.unitType || 'unit'} (₹)</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="cash-outline" size={18} color={Colors.textTertiary} style={{ paddingLeft: 14 }} />
                <TextInput style={styles.modalInput} value={matPrice} onChangeText={setMatPrice} placeholder="e.g. 3200" placeholderTextColor={Colors.textDisabled} keyboardType="numeric" autoFocus />
              </View>
              {matPrice && selectedOrder ? (
                <Text style={styles.totalCalc}>Total = {fmtCurrency(parseFloat(matPrice) * selectedOrder.quantity)} for {selectedOrder.quantity} {selectedOrder.unitType}</Text>
              ) : null}
            </View>
            <View style={styles.dialogBtns}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setQuoteVisible(false)}><Text style={styles.dialogCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.dialogConfirmBtn, saving && { opacity: 0.7 }]} onPress={handleQuoteRate} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.dialogConfirmText}>Send Quote</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settle Modal */}
      <Modal visible={settleVisible} animationType="slide" transparent onRequestClose={() => setSettleVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={styles.dialogHandle} />
            <Text style={styles.dialogTitle}>Settle Order</Text>
            {settleOrder && (
              <>
                <View style={styles.settleRow}><Text style={styles.settleLabel}>Material</Text><Text style={styles.settleVal}>{fmtCurrency(settleOrder.materialPrice)}</Text></View>
                <View style={styles.settleRow}><Text style={styles.settleLabel}>Transport</Text><Text style={styles.settleVal}>{fmtCurrency(settleOrder.transportPrice)}</Text></View>
                <View style={[styles.settleRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8, marginTop: 4 }]}>
                  <Text style={[styles.settleLabel, { fontWeight: '700', color: Colors.navy }]}>Total to Collect</Text>
                  <Text style={[styles.settleVal, { fontWeight: '800', color: Colors.primary, fontSize: 16 }]}>{fmtCurrency((settleOrder.materialPrice || 0) + (settleOrder.transportPrice || 0))}</Text>
                </View>
              </>
            )}
            <View style={styles.dialogBtns}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setSettleVisible(false)}><Text style={styles.dialogCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.dialogConfirmBtn, { backgroundColor: Colors.success }]} onPress={handleSettle}><Text style={styles.dialogConfirmText}>Mark Settled</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  refreshBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  liveAlert: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primarySurface, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.primaryBorder },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  liveAlertText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.primary },
  statsBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLbl: { fontSize: 11, color: Colors.textTertiary, fontWeight: '600' },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.borderLight },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary, marginTop: 8 },
  emptyIcon: { width: 80, height: 80, borderRadius: 20, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  newCard: { borderColor: Colors.primary, borderWidth: 1.5 },
  newBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  newBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardMat: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  customerName: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 3 },
  addressText: { fontSize: 12, color: Colors.textTertiary, flex: 1, lineHeight: 16 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14 },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  waitingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.statusQuotedBg, borderRadius: 10, padding: 12 },
  waitingTitle: { fontSize: 13, fontWeight: '700', color: Colors.statusQuoted },
  waitingText: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  bidsSection: { backgroundColor: Colors.statusBiddingBg, borderRadius: 12, padding: 12, gap: 10 },
  bidsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bidsSectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.navy, flex: 1 },
  noBidsBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  noBidsText: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic', flex: 1 },
  bidCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.borderLight },
  bidLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bidDriverIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.infoLight, alignItems: 'center', justifyContent: 'center' },
  bidDriverName: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  bidVehicle: { fontSize: 11, color: Colors.textSecondary },
  bidRight: { alignItems: 'flex-end', gap: 4 },
  bidFare: { fontSize: 15, fontWeight: '800', color: Colors.success },
  acceptBidBtn: { backgroundColor: Colors.success, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBidText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  tripInfoBox: { backgroundColor: Colors.infoLight, borderRadius: 10, padding: 12, gap: 6 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripLabel: { fontSize: 12, color: Colors.navyMid, fontWeight: '500', flex: 1 },
  orderDate: { fontSize: 11, color: Colors.textTertiary, marginTop: 10 },
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  dialog: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32, gap: 16 },
  dialogHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.borderMedium, alignSelf: 'center', marginBottom: 8 },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  dialogInfoBox: { backgroundColor: Colors.background, borderRadius: 10, padding: 12 },
  dialogInfoText: { fontSize: 15, fontWeight: '700', color: Colors.navy },
  dialogInfoSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12 },
  modalInput: { flex: 1, height: 52, paddingHorizontal: 12, fontSize: 16, color: Colors.text },
  totalCalc: { fontSize: 12, color: Colors.success, fontWeight: '600', marginTop: 4 },
  dialogBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dialogCancelBtn: { flex: 1, height: 50, borderRadius: 12, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  dialogCancelText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  dialogConfirmBtn: { flex: 1.5, height: 50, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  dialogConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  settleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  settleLabel: { fontSize: 13, color: Colors.textSecondary },
  settleVal: { fontSize: 14, fontWeight: '600', color: Colors.text },
});
