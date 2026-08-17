// @ts-nocheck
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import * as API from '../src/services/MarketplaceAPI';
import { useAuth } from '../src/context/AuthContext';

function fmtCurrency(n: number) {
  if (!n && n !== 0) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

export default function QuarryMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Tabs: 'dashboard' | 'enquiries' | 'orders' | 'materials' | 'lorries'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'enquiries' | 'orders' | 'materials' | 'lorries'>('dashboard');

  const [enquiries, setEnquiries] = useState<API.Enquiry[]>([]);
  const [quotesMap, setQuotesMap] = useState<Record<string, API.Quote[]>>({});
  const [orders, setOrders] = useState<API.Order[]>([]);
  const [tripsMap, setTripsMap] = useState<Record<string, API.Trip[]>>({});
  const [materials, setMaterials] = useState<API.QuarryMaterial[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Quote Submission Modal
  const [quoteModalVisible, setQuoteModalVisible] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<API.Enquiry | null>(null);
  const [materialPrice, setMaterialPrice] = useState('3000');
  const [transportPrice, setTransportPrice] = useState('500');
  const [estDeliveryHours, setEstDeliveryHours] = useState('4');
  const [submittingQuote, setSubmittingQuote] = useState(false);

  // Counter Offer Modal
  const [counterModalVisible, setCounterModalVisible] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<API.Quote | null>(null);
  const [counterMaterialPrice, setCounterMaterialPrice] = useState('');
  const [counterTransportPrice, setCounterTransportPrice] = useState('');
  const [submittingCounter, setSubmittingCounter] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch enquiries & quotes
      const { enquiries: enqList, quotes: qList } = await API.getEnquiries();
      setEnquiries(enqList);

      const qMap: Record<string, API.Quote[]> = {};
      qList.forEach(q => {
        if (!qMap[q.enquiryId]) qMap[q.enquiryId] = [];
        qMap[q.enquiryId].push(q);
      });
      setQuotesMap(qMap);

      // 2. Fetch orders & multi-trips
      const { orders: ordList, trips: trList } = await API.getOrders(undefined, user?.id || 'quarry-1');
      setOrders(ordList);

      const tMap: Record<string, API.Trip[]> = {};
      trList.forEach(t => {
        if (!tMap[t.orderId]) tMap[t.orderId] = [];
        tMap[t.orderId].push(t);
      });
      setTripsMap(tMap);

      // 3. Materials
      const mats = await API.getMaterials();
      setMaterials(mats);

    } catch (e) {
      console.error('Quarry Load Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    loadData();

    // Subscribe to Pusher Real-Time Updates
    const unsub = API.subscribeToMarketplace({
      onEnquiryCreated: () => loadData(),
      onNegotiationCountered: () => loadData(),
      onOrderCreated: () => loadData(),
      onTripStateChanged: () => loadData(),
      onPoDSubmitted: () => loadData(),
    });

    const poll = setInterval(loadData, 8000);

    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [loadData]));

  // Submit Initial Quote
  const handleSubmitQuote = async () => {
    if (!selectedEnquiry) return;
    setSubmittingQuote(true);
    try {
      await API.submitQuote({
        enquiryId: selectedEnquiry._id || selectedEnquiry.id,
        quarryId: user?.id || 'quarry-1',
        quarryName: user?.name || 'Sri Murugan Quarry',
        materialPrice: parseFloat(materialPrice) || 3000,
        transportPrice: parseFloat(transportPrice) || 500,
        estDeliveryHours: parseFloat(estDeliveryHours) || 4,
      });

      setQuoteModalVisible(false);
      Alert.alert('Quote Submitted! 💰', 'Commercial terms sent to customer.');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingQuote(false);
    }
  };

  // Submit Counter Offer to Bargaining Customer
  const handleCounterOffer = async () => {
    if (!selectedQuote) return;
    setSubmittingCounter(true);
    try {
      await API.counterQuote({
        quoteId: selectedQuote._id || selectedQuote.id,
        proposedBy: 'quarry',
        materialPrice: parseFloat(counterMaterialPrice) || selectedQuote.materialPrice,
        transportPrice: parseFloat(counterTransportPrice) || selectedQuote.transportPrice,
        note: 'Quarry Owner counter-offer',
        userName: user?.name || 'Sri Murugan Quarry',
      });
      setCounterModalVisible(false);
      Alert.alert('Counter-Offer Sent 🤝', 'Updated commercial terms sent to customer.');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingCounter(false);
    }
  };

  // Stats
  const activeEnquiriesCount = enquiries.filter(e => e.status !== 'accepted' && e.status !== 'cancelled').length;
  const inProgressOrdersCount = orders.filter(o => o.status === 'in_progress' || o.status === 'confirmed').length;
  const completedOrdersCount = orders.filter(o => o.status === 'completed' || o.status === 'settled').length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.quarryTitle}>{user?.name || 'Sri Murugan Quarry Yard'}</Text>
          <Text style={styles.quarrySub}>Karur Road · Delivery Radar Active</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); loadData(); }}>
          <Ionicons name="refresh" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 12 }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
            { id: 'enquiries', label: `Enquiries (${activeEnquiriesCount})`, icon: 'chatbubbles-outline' },
            { id: 'orders', label: `Orders (${orders.length})`, icon: 'cube-outline' },
            { id: 'materials', label: 'Materials', icon: 'layers-outline' },
            { id: 'lorries', label: 'Lorries & Fleet', icon: 'car-sport-outline' },
          ].map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabItem, activeTab === t.id && styles.tabActive]}
              onPress={() => setActiveTab(t.id as any)}
            >
              <Ionicons name={t.icon as any} size={15} color={activeTab === t.id ? Colors.primary : Colors.textTertiary} />
              <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 8, color: Colors.textSecondary }}>Loading quarry dispatch management...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <View style={{ gap: 16 }}>
              {/* Metric Cards */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: Colors.primarySurface }]}>
                  <Text style={[styles.statNum, { color: Colors.primary }]}>{activeEnquiriesCount}</Text>
                  <Text style={styles.statLbl}>Pending Enquiries</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: Colors.warningLight }]}>
                  <Text style={[styles.statNum, { color: Colors.warning }]}>{inProgressOrdersCount}</Text>
                  <Text style={styles.statLbl}>Active Orders</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: Colors.successLight }]}>
                  <Text style={[styles.statNum, { color: Colors.success }]}>{completedOrdersCount}</Text>
                  <Text style={styles.statLbl}>Completed Orders</Text>
                </View>
              </View>

              {/* Quick Actions */}
              <Text style={styles.sectionTitle}>Quarry Operations</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={styles.quickActionCard} onPress={() => setActiveTab('enquiries')}>
                  <Ionicons name="chatbubbles" size={20} color={Colors.primary} />
                  <Text style={styles.quickActionTitle}>Respond to Enquiries</Text>
                  <Text style={styles.quickActionSub}>{activeEnquiriesCount} waiting for quotes</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={() => setActiveTab('orders')}>
                  <Ionicons name="car-sport" size={20} color={Colors.success} />
                  <Text style={styles.quickActionTitle}>Dispatch Lorries</Text>
                  <Text style={styles.quickActionSub}>Manage multi-trip execution</Text>
                </TouchableOpacity>
              </View>

              {/* Recent Orders List */}
              <Text style={styles.sectionTitle}>Recent Confirmed Orders</Text>
              {orders.slice(0, 3).map(ord => (
                <View key={ord._id || ord.id} style={styles.miniCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniTitle}>{ord.totalQuantity} {ord.unitType} {ord.materialName}</Text>
                    <Text style={styles.miniSub}>{ord.customerName} · {ord.totalTripsRequired} Trips ({ord.completedTrips} done)</Text>
                  </View>
                  <Text style={styles.miniPrice}>{fmtCurrency(ord.priceSnapshot?.totalAmount)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* TAB 2: ENQUIRIES & BARGAINING DESK */}
          {activeTab === 'enquiries' && (
            <View style={{ gap: 16 }}>
              {enquiries.length === 0 ? (
                <View style={styles.centerWrap}>
                  <Ionicons name="chatbubble-outline" size={48} color={Colors.textDisabled} />
                  <Text style={styles.emptyTitle}>No Enquiries Yet</Text>
                  <Text style={styles.emptySub}>When customers search for materials on the platform, their enquiries will land here.</Text>
                </View>
              ) : (
                enquiries.map(enq => {
                  const enqId = enq._id || enq.id;
                  const quotes = quotesMap[enqId] || [];
                  const myQuote = quotes.find(q => q.quarryId === (user?.id || 'quarry-1'));

                  return (
                    <View key={enqId} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.matTitle}>{enq.quantity} {enq.unitType} {enq.materialName}</Text>
                          <Text style={styles.custSub}>{enq.customerName} ({enq.customerPhone})</Text>
                        </View>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusText}>{enq.status.toUpperCase()}</Text>
                        </View>
                      </View>

                      {/* Site Details */}
                      <View style={styles.siteInfoBox}>
                        <Text style={styles.siteText}><Ionicons name="location-outline" size={13} /> {enq.siteLocation?.address}</Text>
                        {enq.siteLocation?.landmark ? <Text style={styles.siteSub}>Landmark: {enq.siteLocation.landmark}</Text> : null}
                        <Text style={styles.siteSub}>Gate Instructions: {enq.siteLocation?.deliveryInstructions || 'None'} (Max {enq.siteLocation?.maxVehicleWeightTon || 20}T Lorry)</Text>
                      </View>

                      {/* Quote Status */}
                      {!myQuote ? (
                        <TouchableOpacity
                          style={styles.quoteBtn}
                          onPress={() => {
                            setSelectedEnquiry(enq);
                            setMaterialPrice('3000');
                            setTransportPrice('500');
                            setQuoteModalVisible(true);
                          }}
                        >
                          <Ionicons name="pricetag" size={16} color="#FFF" />
                          <Text style={styles.quoteBtnText}>Submit Quote Rates</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.quoteDetailCard}>
                          <View style={styles.quoteDetailRow}>
                            <Text style={styles.quoteDetailLbl}>Your Quote Status</Text>
                            <Text style={[styles.quoteDetailVal, { color: Colors.primary }]}>{myQuote.status.toUpperCase()}</Text>
                          </View>
                          <View style={styles.quoteDetailRow}>
                            <Text style={styles.quoteDetailLbl}>Material Price</Text>
                            <Text style={styles.quoteDetailVal}>{fmtCurrency(myQuote.materialPrice)}</Text>
                          </View>
                          <View style={styles.quoteDetailRow}>
                            <Text style={styles.quoteDetailLbl}>Transport Charge</Text>
                            <Text style={styles.quoteDetailVal}>{fmtCurrency(myQuote.transportPrice)}</Text>
                          </View>
                          <View style={[styles.quoteDetailRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 4 }]}>
                            <Text style={[styles.quoteDetailLbl, { fontWeight: '700', color: Colors.navy }]}>Total Quote</Text>
                            <Text style={[styles.quoteDetailVal, { fontWeight: '800', color: Colors.success }]}>{fmtCurrency(myQuote.totalPrice)}</Text>
                          </View>

                          {/* Bargaining Action */}
                          {myQuote.status === 'countered' && (
                            <TouchableOpacity
                              style={styles.counterBtn}
                              onPress={() => {
                                setSelectedQuote(myQuote);
                                setCounterMaterialPrice(myQuote.materialPrice.toString());
                                setCounterTransportPrice(myQuote.transportPrice.toString());
                                setCounterModalVisible(true);
                              }}
                            >
                              <Ionicons name="options" size={14} color="#FFF" />
                              <Text style={styles.counterBtnText}>Respond to Customer Counter-Offer</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 3: ORDERS & MULTI-TRIP DISPATCHER */}
          {activeTab === 'orders' && (
            <View style={{ gap: 16 }}>
              {orders.length === 0 ? (
                <View style={styles.centerWrap}>
                  <Ionicons name="cube-outline" size={48} color={Colors.textDisabled} />
                  <Text style={styles.emptyTitle}>No Confirmed Orders</Text>
                  <Text style={styles.emptySub}>Accepted customer quotes create contract orders with multi-trip logistics dispatching.</Text>
                </View>
              ) : (
                orders.map(ord => {
                  const ordId = ord._id || ord.id;
                  const trips = tripsMap[ordId] || [];

                  return (
                    <View key={ordId} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.matTitle}>{ord.totalQuantity} {ord.unitType} {ord.materialName}</Text>
                          <Text style={styles.custSub}>Customer: {ord.customerName} ({ord.customerPhone})</Text>
                          <Text style={styles.custSub}>Site: {ord.siteLocation?.address}</Text>
                        </View>
                        <View style={styles.frozenTag}>
                          <Text style={styles.frozenTagText}>Contract Frozen</Text>
                        </View>
                      </View>

                      {/* Snapshotted Commercials */}
                      <View style={styles.snapshotBox}>
                        <Text style={styles.snapText}>Material: {fmtCurrency(ord.priceSnapshot?.materialPrice)} | Trans: {fmtCurrency(ord.priceSnapshot?.transportPrice)} | Total: {fmtCurrency(ord.priceSnapshot?.totalAmount)}</Text>
                      </View>

                      {/* Multi-Trip Dispatch List */}
                      <Text style={styles.sectionSubTitle}>Multi-Trip Dispatch ({ord.completedTrips} of {ord.totalTripsRequired} Completed)</Text>
                      <View style={{ gap: 8, marginTop: 4 }}>
                        {trips.map(t => (
                          <View key={t._id || t.id} style={styles.tripRow}>
                            <View style={styles.tripBadge}><Text style={styles.tripNum}>T{t.tripNumber}</Text></View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.tripDriverName}>{t.driverName ? `${t.driverName} (${t.vehicleNo})` : 'Unassigned Lorry'}</Text>
                              <Text style={styles.tripLoad}>{t.loadQuantityTon} Ton Load · Earnings {fmtCurrency(t.driverEarnings)}</Text>
                            </View>
                            <View style={[styles.stateTag, t.tripState === 'DELIVERED' ? { backgroundColor: Colors.successLight } : { backgroundColor: Colors.warningLight }]}>
                              <Text style={[styles.stateTagText, t.tripState === 'DELIVERED' ? { color: Colors.success } : { color: Colors.warning }]}>
                                {t.tripState}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 4: MATERIALS CATALOG */}
          {activeTab === 'materials' && (
            <View style={{ gap: 12 }}>
              <Text style={styles.sectionTitle}>Quarry Material Inventory & Rates</Text>
              {materials.map(m => (
                <View key={m._id || m.id || m.materialName} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matTitle}>{m.materialName}</Text>
                      <Text style={styles.custSub}>Base Rate: {fmtCurrency(m.basePrice)} per {m.unitType}</Text>
                    </View>
                    <View style={styles.availTag}>
                      <Text style={styles.availText}>{m.isAvailable ? 'AVAILABLE' : 'OUT OF STOCK'}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                    <Text style={styles.metaText}>Stock: {m.availableQty} Ton</Text>
                    <Text style={styles.metaText}>MOQ: {m.moq} Ton</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 5: LORRIES & FLEET */}
          {activeTab === 'lorries' && (
            <View style={{ gap: 12 }}>
              <Text style={styles.sectionTitle}>Quarry Fleet & Outsourced Lorry Radar</Text>
              <View style={styles.card}>
                <Text style={styles.matTitle}>Owned Fleet Lorries</Text>
                <Text style={styles.custSub}>TN 38 AB 1234 · 10-Wheeler Tipper (10 Ton) · Active</Text>
                <Text style={styles.custSub}>TN 38 AB 5678 · 14-Wheeler Tipper (20 Ton) · Active</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.matTitle}>Independent Outsourced Drivers</Text>
                <Text style={styles.custSub}>Registered independent lorry drivers in the Coimbatore network receive trip offers automatically via Delivery Radar.</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* MODAL 1: SUBMIT QUOTE */}
      <Modal visible={quoteModalVisible} animationType="slide" transparent onRequestClose={() => setQuoteModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={styles.dialogHandle} />
            <Text style={styles.dialogTitle}>Submit Quote</Text>
            <Text style={styles.dialogSub}>Requirement: {selectedEnquiry?.quantity} {selectedEnquiry?.unitType} {selectedEnquiry?.materialName}</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Material Rate (₹)</Text>
              <TextInput style={styles.textInput} value={materialPrice} onChangeText={setMaterialPrice} keyboardType="numeric" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Transport Freight Charge (₹)</Text>
              <TextInput style={styles.textInput} value={transportPrice} onChangeText={setTransportPrice} keyboardType="numeric" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Estimated Delivery Hours</Text>
              <TextInput style={styles.textInput} value={estDeliveryHours} onChangeText={setEstDeliveryHours} keyboardType="numeric" />
            </View>

            <View style={styles.dialogBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setQuoteModalVisible(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, submittingQuote && { opacity: 0.7 }]} onPress={handleSubmitQuote} disabled={submittingQuote}>
                {submittingQuote ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.confirmBtnText}>Submit Quote</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: COUNTER OFFER */}
      <Modal visible={counterModalVisible} animationType="slide" transparent onRequestClose={() => setCounterModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={styles.dialogHandle} />
            <Text style={styles.dialogTitle}>Respond to Counter-Offer</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Revised Material Rate (₹)</Text>
              <TextInput style={styles.textInput} value={counterMaterialPrice} onChangeText={setCounterMaterialPrice} keyboardType="numeric" />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Revised Transport Charge (₹)</Text>
              <TextInput style={styles.textInput} value={counterTransportPrice} onChangeText={setCounterTransportPrice} keyboardType="numeric" />
            </View>
            <View style={styles.dialogBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCounterModalVisible(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, submittingCounter && { opacity: 0.7 }]} onPress={handleCounterOffer} disabled={submittingCounter}>
                {submittingCounter ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.confirmBtnText}>Send Revised Terms</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  quarryTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  quarrySub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  refreshBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },

  tabBar: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, maxHeight: 48 },
  tabItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 12, marginRight: 8 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.navy },
  emptySub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  content: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  sectionSubTitle: { fontSize: 13, fontWeight: '700', color: Colors.navy, marginTop: 6 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center' },

  quickActionCard: { flex: 1, backgroundColor: Colors.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, gap: 4 },
  quickActionTitle: { fontSize: 13, fontWeight: '700', color: Colors.navy, marginTop: 4 },
  quickActionSub: { fontSize: 11, color: Colors.textSecondary },

  miniCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight },
  miniTitle: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  miniSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  miniPrice: { fontSize: 14, fontWeight: '800', color: Colors.primary },

  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  matTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  custSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { backgroundColor: Colors.primarySurface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800', color: Colors.primary },

  siteInfoBox: { backgroundColor: Colors.background, padding: 10, borderRadius: 10, gap: 2 },
  siteText: { fontSize: 12, fontWeight: '600', color: Colors.navy },
  siteSub: { fontSize: 11, color: Colors.textSecondary },

  quoteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, height: 42, borderRadius: 10, marginTop: 4 },
  quoteBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  quoteDetailCard: { backgroundColor: Colors.background, padding: 10, borderRadius: 10, gap: 4 },
  quoteDetailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quoteDetailLbl: { fontSize: 11, color: Colors.textSecondary },
  quoteDetailVal: { fontSize: 12, fontWeight: '600', color: Colors.navy },

  counterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, height: 38, borderRadius: 8, marginTop: 6 },
  counterBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  frozenTag: { backgroundColor: Colors.primarySurface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  frozenTagText: { fontSize: 10, fontWeight: '800', color: Colors.primary },
  snapshotBox: { backgroundColor: Colors.background, padding: 8, borderRadius: 8 },
  snapText: { fontSize: 11, fontWeight: '600', color: Colors.navy },

  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.background, padding: 10, borderRadius: 10 },
  tripBadge: { width: 32, height: 24, borderRadius: 6, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  tripNum: { fontSize: 10, fontWeight: '800', color: Colors.primary },
  tripDriverName: { fontSize: 12, fontWeight: '700', color: Colors.navy },
  tripLoad: { fontSize: 11, color: Colors.textSecondary },
  stateTag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  stateTagText: { fontSize: 9, fontWeight: '800' },

  availTag: { backgroundColor: Colors.successLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  availText: { fontSize: 10, fontWeight: '800', color: Colors.success },
  metaText: { fontSize: 11, color: Colors.textSecondary },

  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  dialog: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  dialogHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.borderMedium, alignSelf: 'center' },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  dialogSub: { fontSize: 12, color: Colors.textSecondary },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.navy },
  textInput: { height: 46, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: Colors.navy },
  dialogBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 10, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  confirmBtn: { flex: 1.5, height: 46, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
