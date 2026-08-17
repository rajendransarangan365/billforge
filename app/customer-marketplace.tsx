// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, TextInput, Dimensions, RefreshControl, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import * as API from '../src/services/MarketplaceAPI';
import { useAuth } from '../src/context/AuthContext';

const { width: W } = Dimensions.get('window');

function fmtCurrency(n: number) {
  if (!n && n !== 0) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

const CATEGORIES = [
  { id: 'all', label: 'All Materials', icon: 'apps-outline' },
  { id: 'river_sand', label: 'River Sand', icon: 'water-outline' },
  { id: 'msand', label: 'M-Sand', icon: 'cube-outline' },
  { id: 'blue_metal', label: 'Blue Metal', icon: 'layers-outline' },
  { id: 'jelly', label: 'Jelly / Gravel', icon: 'construct-outline' },
];

export default function CustomerMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Navigation tabs: 'browse' | 'enquiries' | 'orders'
  const [activeTab, setActiveTab] = useState<'browse' | 'enquiries' | 'orders'>('browse');

  // Materials & Marketplace Catalog
  const [materials, setMaterials] = useState<API.QuarryMaterial[]>([]);
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Enquiries & Quotes
  const [enquiries, setEnquiries] = useState<API.Enquiry[]>([]);
  const [quotesMap, setQuotesMap] = useState<Record<string, API.Quote[]>>({});

  // Orders & Multi-Trips
  const [orders, setOrders] = useState<API.Order[]>([]);
  const [tripsMap, setTripsMap] = useState<Record<string, API.Trip[]>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Enquiry Creation Modal
  const [enquiryModalVisible, setEnquiryModalVisible] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<API.QuarryMaterial | null>(null);
  const [quantity, setQuantity] = useState('10');
  const [unitType, setUnitType] = useState('ton');
  const [deliveryDate, setDeliveryDate] = useState('Tomorrow');
  const [timeWindow, setTimeWindow] = useState('10 AM - 1 PM');
  const [siteAddress, setSiteAddress] = useState('Site #42, Avinashi Road, Coimbatore');
  const [landmark, setLandmark] = useState('Near KMCH Hospital');
  const [contactPerson, setContactPerson] = useState('Rajesh (Site Engg)');
  const [contactPhone, setContactPhone] = useState('9876543210');
  const [instructions, setInstructions] = useState('Enter through North gate. Call security before entering.');
  const [maxVehicleWeight, setMaxVehicleWeight] = useState('20');
  const [savingEnquiry, setSavingEnquiry] = useState(false);

  // Bargaining / Counter-Offer Modal
  const [bargainModalVisible, setBargainModalVisible] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<API.Quote | null>(null);
  const [counterMaterialPrice, setCounterMaterialPrice] = useState('');
  const [counterTransportPrice, setCounterTransportPrice] = useState('');
  const [counterNote, setCounterNote] = useState('');
  const [savingBargain, setSavingBargain] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      // 1. Fetch materials catalog
      const mats = await API.getMaterials();
      setMaterials(mats);

      // 2. Fetch enquiries & quotes
      const { enquiries: enqList, quotes: qList } = await API.getEnquiries(user?.id || 'cust-demo');
      setEnquiries(enqList);

      const qMap: Record<string, API.Quote[]> = {};
      qList.forEach(q => {
        if (!qMap[q.enquiryId]) qMap[q.enquiryId] = [];
        qMap[q.enquiryId].push(q);
      });
      setQuotesMap(qMap);

      // 3. Fetch Orders & Trips
      const { orders: ordList, trips: trList } = await API.getOrders(user?.id || 'cust-demo');
      setOrders(ordList);

      const tMap: Record<string, API.Trip[]> = {};
      trList.forEach(t => {
        if (!tMap[t.orderId]) tMap[t.orderId] = [];
        tMap[t.orderId].push(t);
      });
      setTripsMap(tMap);

    } catch (e) {
      console.error('Customer Marketplace Load Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    loadData();

    // Subscribe to Pusher Real-Time Updates
    const unsub = API.subscribeToMarketplace({
      onQuoteReceived: () => loadData(),
      onNegotiationCountered: () => loadData(),
      onOrderCreated: () => loadData(),
      onTripStateChanged: () => loadData(),
    });

    const poll = setInterval(loadData, 8000);

    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [loadData]));

  // Create Enquiry Handler
  const handleCreateEnquiry = async () => {
    if (!quantity || isNaN(parseFloat(quantity))) {
      Alert.alert('Required', 'Please enter a valid quantity.');
      return;
    }
    if (!siteAddress.trim()) {
      Alert.alert('Required', 'Please enter your construction site address.');
      return;
    }

    setSavingEnquiry(true);
    try {
      await API.createEnquiry({
        customerId: user?.id || 'cust-demo',
        customerName: user?.name || 'Anand Construction',
        customerPhone: user?.phone || '9876543210',
        materialName: selectedMaterial ? selectedMaterial.materialName : 'River Sand',
        quantity: parseFloat(quantity),
        unitType: selectedMaterial ? selectedMaterial.unitType : unitType,
        deliveryDate,
        timeWindow,
        siteAddress,
        siteLat: 11.0168,
        siteLng: 76.9558,
        landmark,
        contactPerson,
        contactPhone,
        instructions,
        maxVehicleWeightTon: parseFloat(maxVehicleWeight) || 20,
      });

      setEnquiryModalVisible(false);
      Alert.alert('Enquiry Sent! 🎉', 'Your material requirement is live. Quarries will review and send quotes shortly.');
      setActiveTab('enquiries');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingEnquiry(false);
    }
  };

  // Counter Offer Handler
  const handleCounterQuote = async () => {
    if (!selectedQuote) return;
    setSavingBargain(true);
    try {
      await API.counterQuote({
        quoteId: selectedQuote._id || selectedQuote.id,
        proposedBy: 'customer',
        materialPrice: parseFloat(counterMaterialPrice) || selectedQuote.materialPrice,
        transportPrice: parseFloat(counterTransportPrice) || selectedQuote.transportPrice,
        note: counterNote.trim() || 'Customer counter-offer',
        userName: user?.name || 'Customer',
      });
      setBargainModalVisible(false);
      Alert.alert('Counter-Offer Sent 🤝', 'Your price offer was sent to the quarry owner.');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingBargain(false);
    }
  };

  // Accept Quote Handler
  const handleAcceptQuote = (quote: API.Quote) => {
    Alert.alert(
      'Accept & Create Order',
      `Accept commercial quote from ${quote.quarryName} for total ${fmtCurrency(quote.totalPrice)}? Commercial terms will be frozen into a contract.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept Quote',
          style: 'default',
          onPress: async () => {
            try {
              const res = await API.acceptQuote(quote._id || quote.id);
              Alert.alert(
                'Order Created! 🏗️',
                `Order confirmed with ${quote.quarryName}! Decomposed into ${res.order.totalTripsRequired} lorry trips.`
              );
              setActiveTab('orders');
              loadData();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  // Filtered Materials
  const filteredMaterials = materials.filter(m => {
    const matchCat = selectedCat === 'all' || m.materialName.toLowerCase().includes(selectedCat.replace('_', ' '));
    const matchSearch = !searchQuery || m.materialName.toLowerCase().includes(searchQuery.toLowerCase()) || m.quarryName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top Banner & Search */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.navy} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.siteLabel}>Deliver to Construction Site</Text>
            <View style={styles.siteRow}>
              <Ionicons name="location" size={14} color={Colors.primary} />
              <Text style={styles.siteName} numberOfLines={1}>Site #42, Avinashi Road</Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
            </View>
          </View>
          <TouchableOpacity style={styles.cartBtn} onPress={() => setActiveTab('enquiries')}>
            <Ionicons name="cart-outline" size={20} color={Colors.navy} />
            {enquiries.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{enquiries.length}</Text></View>}
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search River Sand, M-Sand, Blue Metal..."
            placeholderTextColor={Colors.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Tabs Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'browse' && styles.tabActive]} onPress={() => setActiveTab('browse')}>
          <Ionicons name="storefront-outline" size={16} color={activeTab === 'browse' ? Colors.primary : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'browse' && styles.tabTextActive]}>Marketplace</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'enquiries' && styles.tabActive]} onPress={() => setActiveTab('enquiries')}>
          <Ionicons name="chatbubbles-outline" size={16} color={activeTab === 'enquiries' ? Colors.primary : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'enquiries' && styles.tabTextActive]}>
            Enquiries & Quotes ({enquiries.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'orders' && styles.tabActive]} onPress={() => setActiveTab('orders')}>
          <Ionicons name="cube-outline" size={16} color={activeTab === 'orders' ? Colors.primary : Colors.textTertiary} />
          <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
            My Orders ({orders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 8, color: Colors.textSecondary }}>Loading construction marketplace...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: BROWSE MARKETPLACE */}
          {activeTab === 'browse' && (
            <>
              {/* Category Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {CATEGORIES.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.catPill, selectedCat === c.id && styles.catPillSelected]}
                      onPress={() => setSelectedCat(c.id)}
                    >
                      <Ionicons name={c.icon as any} size={14} color={selectedCat === c.id ? '#FFF' : Colors.textSecondary} />
                      <Text style={[styles.catPillText, selectedCat === c.id && { color: '#FFF' }]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Material Cards */}
              <Text style={styles.sectionTitle}>Available Construction Materials</Text>
              <View style={{ gap: 12, marginTop: 8 }}>
                {filteredMaterials.map(m => (
                  <View key={m._id || m.id || m.materialName} style={styles.materialCard}>
                    <View style={styles.cardHeader}>
                      <View style={styles.iconBg}>
                        <Ionicons name="construct" size={24} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.matName}>{m.materialName}</Text>
                        <Text style={styles.quarrySub}>{m.quarryName} · <Ionicons name="star" size={11} color="#F5A623" /> {m.rating} ({m.reliabilityScore}% reliability)</Text>
                      </View>
                      <View style={styles.priceWrap}>
                        <Text style={styles.basePrice}>{fmtCurrency(m.basePrice)}</Text>
                        <Text style={styles.perUnit}>per {m.unitType}</Text>
                      </View>
                    </View>

                    <View style={styles.cardMeta}>
                      <Text style={styles.metaChip}><Ionicons name="cube-outline" size={11} /> Stock: {m.availableQty} Tons</Text>
                      <Text style={styles.metaChip}><Ionicons name="flag-outline" size={11} /> MOQ: {m.moq} Ton</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.enquireBtn}
                      onPress={() => {
                        setSelectedMaterial(m);
                        setUnitType(m.unitType);
                        setEnquiryModalVisible(true);
                      }}
                    >
                      <Ionicons name="paper-plane-outline" size={16} color="#FFF" />
                      <Text style={styles.enquireBtnText}>Send Enquiry & Negotiate</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* TAB 2: ENQUIRIES & QUOTE BARGAINING DESK */}
          {activeTab === 'enquiries' && (
            <View style={{ gap: 16 }}>
              {enquiries.length === 0 ? (
                <View style={styles.centerWrap}>
                  <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.textDisabled} />
                  <Text style={styles.emptyTitle}>No Active Enquiries</Text>
                  <Text style={styles.emptySub}>Select a material from the marketplace to submit your site requirement.</Text>
                </View>
              ) : (
                enquiries.map(enq => {
                  const enqId = enq._id || enq.id;
                  const quotes = quotesMap[enqId] || [];

                  return (
                    <View key={enqId} style={styles.enquiryCard}>
                      <View style={styles.enqTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.enqTitle}>{enq.quantity} {enq.unitType} {enq.materialName}</Text>
                          <Text style={styles.enqSite}><Ionicons name="location-outline" size={12} /> {enq.siteLocation.address}</Text>
                          <Text style={styles.enqTime}><Ionicons name="calendar-outline" size={12} /> {enq.deliveryDate} ({enq.timeWindow})</Text>
                        </View>
                        <View style={[styles.statusTag, enq.status === 'open' ? { backgroundColor: Colors.warningLight } : { backgroundColor: Colors.successLight }]}>
                          <Text style={[styles.statusTagText, enq.status === 'open' ? { color: Colors.warning } : { color: Colors.success }]}>
                            {enq.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.divider} />

                      {/* Submitted Quotes */}
                      <Text style={styles.quotesHeader}>Quarry Quotes & Negotiation ({quotes.length})</Text>

                      {quotes.length === 0 ? (
                        <Text style={styles.waitingText}>Waiting for quarries to submit quotes...</Text>
                      ) : (
                        quotes.map(q => {
                          const quoteId = q._id || q.id;
                          return (
                            <View key={quoteId} style={styles.quoteCard}>
                              <View style={styles.quoteRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.quarryTitle}>{q.quarryName}</Text>
                                  <Text style={styles.quoteBreakdown}>
                                    Mat: {fmtCurrency(q.materialPrice)} | Trans: {fmtCurrency(q.transportPrice)} | Tax: {fmtCurrency(q.tax)}
                                  </Text>
                                </View>
                                <Text style={styles.quoteTotal}>{fmtCurrency(q.totalPrice)}</Text>
                              </View>

                              {/* Negotiation History */}
                              {q.negotiationHistory && q.negotiationHistory.length > 1 && (
                                <View style={styles.historyBox}>
                                  {q.negotiationHistory.map((h, idx) => (
                                    <Text key={idx} style={styles.historyText}>
                                      • {h.proposedBy === 'customer' ? 'You' : q.quarryName}: {fmtCurrency(h.materialPrice)} material ({h.note || ''})
                                    </Text>
                                  ))}
                                </View>
                              )}

                              {/* Action Buttons */}
                              {q.status !== 'accepted' && (
                                <View style={styles.quoteActions}>
                                  <TouchableOpacity
                                    style={styles.counterBtn}
                                    onPress={() => {
                                      setSelectedQuote(q);
                                      setCounterMaterialPrice(q.materialPrice.toString());
                                      setCounterTransportPrice(q.transportPrice.toString());
                                      setBargainModalVisible(true);
                                    }}
                                  >
                                    <Ionicons name="options-outline" size={14} color={Colors.primary} />
                                    <Text style={styles.counterBtnText}>Negotiate / Counter</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={styles.acceptQuoteBtn}
                                    onPress={() => handleAcceptQuote(q)}
                                  >
                                    <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                                    <Text style={styles.acceptQuoteBtnText}>Accept Quote</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          );
                        })
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 3: MY ORDERS & MULTI-TRIP TRACKER */}
          {activeTab === 'orders' && (
            <View style={{ gap: 16 }}>
              {orders.length === 0 ? (
                <View style={styles.centerWrap}>
                  <Ionicons name="cube-outline" size={48} color={Colors.textDisabled} />
                  <Text style={styles.emptyTitle}>No Confirmed Orders</Text>
                  <Text style={styles.emptySub}>Accepted quote terms will appear here as frozen order contracts with multi-trip tracking.</Text>
                </View>
              ) : (
                orders.map(ord => {
                  const ordId = ord._id || ord.id;
                  const trips = tripsMap[ordId] || [];

                  return (
                    <View key={ordId} style={styles.orderCard}>
                      <View style={styles.ordTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ordMat}>{ord.totalQuantity} {ord.unitType} {ord.materialName}</Text>
                          <Text style={styles.ordQuarry}>Quarry: {ord.quarryName}</Text>
                        </View>
                        <View style={styles.frozenBadge}>
                          <Ionicons name="lock-closed" size={12} color={Colors.primary} />
                          <Text style={styles.frozenText}>Contract Frozen</Text>
                        </View>
                      </View>

                      {/* Snapshotted Commercial Terms */}
                      <View style={styles.priceSnapshotCard}>
                        <View style={styles.snapRow}>
                          <Text style={styles.snapLbl}>Material Price</Text>
                          <Text style={styles.snapVal}>{fmtCurrency(ord.priceSnapshot?.materialPrice)}</Text>
                        </View>
                        <View style={styles.snapRow}>
                          <Text style={styles.snapLbl}>Transport Fee</Text>
                          <Text style={styles.snapVal}>{fmtCurrency(ord.priceSnapshot?.transportPrice)}</Text>
                        </View>
                        <View style={[styles.snapRow, { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 4 }]}>
                          <Text style={[styles.snapLbl, { fontWeight: '700', color: Colors.navy }]}>Total Paid/Agreed</Text>
                          <Text style={[styles.snapVal, { fontWeight: '800', color: Colors.primary }]}>{fmtCurrency(ord.priceSnapshot?.totalAmount)}</Text>
                        </View>
                      </View>

                      {/* Multi-Trip Progression */}
                      <Text style={styles.tripsHeader}>
                        Multi-Trip Execution ({ord.completedTrips} of {ord.totalTripsRequired} Trips Completed)
                      </Text>

                      <View style={{ gap: 8, marginTop: 4 }}>
                        {trips.map(t => (
                          <View key={t._id || t.id} style={styles.tripRowCard}>
                            <View style={styles.tripBadge}>
                              <Text style={styles.tripNum}>Trip {t.tripNumber}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.tripLoad}>{t.loadQuantityTon} Ton Load</Text>
                              <Text style={styles.tripDriver}>
                                {t.driverName ? `${t.driverName} (${t.vehicleNo})` : 'Awaiting Driver Assignment'}
                              </Text>
                            </View>
                            <View style={[styles.statePill, t.tripState === 'DELIVERED' ? { backgroundColor: Colors.successLight } : { backgroundColor: Colors.warningLight }]}>
                              <Text style={[styles.statePillText, t.tripState === 'DELIVERED' ? { color: Colors.success } : { color: Colors.warning }]}>
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
        </ScrollView>
      )}

      {/* MODAL 1: ENQUIRY CREATION WITH PINNED GPS & INSTRUCTIONS */}
      <Modal visible={enquiryModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEnquiryModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalRoot}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Post Material Requirement</Text>
                <Text style={styles.modalSub}>{selectedMaterial?.materialName || 'River Sand'} · Pin location & specify instructions</Text>
              </View>
              <TouchableOpacity onPress={() => setEnquiryModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }}>
              {/* Quantity */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Required Quantity ({unitType})</Text>
                <TextInput
                  style={styles.textInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="e.g. 20"
                />
              </View>

              {/* Delivery Window */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <TextInput style={styles.textInput} value={deliveryDate} onChangeText={setDeliveryDate} />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Time Window</Text>
                  <TextInput style={styles.textInput} value={timeWindow} onChangeText={setTimeWindow} />
                </View>
              </View>

              {/* Site Address */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Site Address & Landmark</Text>
                <TextInput style={styles.textInput} value={siteAddress} onChangeText={setSiteAddress} placeholder="Exact Site Location" />
                <TextInput style={[styles.textInput, { marginTop: 6 }]} value={landmark} onChangeText={setLandmark} placeholder="Landmark (e.g. Near KMCH)" />
              </View>

              {/* Site Contact */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Site Contact Person</Text>
                  <TextInput style={styles.textInput} value={contactPerson} onChangeText={setContactPerson} />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Contact Phone</Text>
                  <TextInput style={styles.textInput} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
                </View>
              </View>

              {/* Gate & Weight Instructions */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Delivery Instructions & Max Vehicle Weight</Text>
                <TextInput
                  style={[styles.textInput, { height: 60, textAlignVertical: 'top', paddingTop: 8 }]}
                  value={instructions}
                  onChangeText={setInstructions}
                  multiline
                  placeholder="Gate entrance instructions"
                />
                <TextInput style={[styles.textInput, { marginTop: 6 }]} value={maxVehicleWeight} onChangeText={setMaxVehicleWeight} keyboardType="numeric" placeholder="Max lorry weight allowed (Ton)" />
              </View>

              <TouchableOpacity
                style={[styles.submitModalBtn, savingEnquiry && { opacity: 0.7 }]}
                onPress={handleCreateEnquiry}
                disabled={savingEnquiry}
              >
                {savingEnquiry ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <>
                    <Ionicons name="paper-plane" size={18} color="#FFF" />
                    <Text style={styles.submitModalBtnText}>Post Requirement to Quarries</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 2: CONTROLLED BARGAINING & COUNTER-OFFER */}
      <Modal visible={bargainModalVisible} animationType="slide" transparent onRequestClose={() => setBargainModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={styles.dialogHandle} />
            <Text style={styles.dialogTitle}>Negotiate Price Quote</Text>
            <Text style={styles.dialogSub}>Propose your counter-offer to {selectedQuote?.quarryName}</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Your Offer for Material (₹)</Text>
              <TextInput style={styles.textInput} value={counterMaterialPrice} onChangeText={setCounterMaterialPrice} keyboardType="numeric" />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Your Offer for Transport (₹)</Text>
              <TextInput style={styles.textInput} value={counterTransportPrice} onChangeText={setCounterTransportPrice} keyboardType="numeric" />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Note / Reason for Counter-Offer</Text>
              <TextInput style={styles.textInput} value={counterNote} onChangeText={setCounterNote} placeholder="e.g. Bulk order discount requested" />
            </View>

            <View style={styles.dialogBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setBargainModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, savingBargain && { opacity: 0.7 }]} onPress={handleCounterQuote} disabled={savingBargain}>
                {savingBargain ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.confirmBtnText}>Send Counter-Offer</Text>}
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
  header: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  siteLabel: { fontSize: 10, color: Colors.textTertiary, textTransform: 'uppercase', fontWeight: '700' },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  siteName: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  cartBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.primary, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, color: '#FFF', fontWeight: '800' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: Colors.borderLight },
  searchInput: { flex: 1, fontSize: 13, color: Colors.navy },

  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.navy },
  emptySub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  content: { flex: 1 },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight },
  catPillSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catPillText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  materialCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, gap: 12 },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBg: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  matName: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  quarrySub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  priceWrap: { alignItems: 'flex-end' },
  basePrice: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  perUnit: { fontSize: 10, color: Colors.textTertiary },

  cardMeta: { flexDirection: 'row', gap: 10 },
  metaChip: { fontSize: 11, color: Colors.textSecondary, backgroundColor: Colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  enquireBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, height: 44 },
  enquireBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Enquiries & Quotes
  enquiryCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, gap: 10 },
  enqTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  enqTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  enqSite: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  enqTime: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusTagText: { fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.borderLight },
  quotesHeader: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  waitingText: { fontSize: 12, color: Colors.textTertiary, fontStyle: 'italic' },

  quoteCard: { backgroundColor: Colors.background, borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: Colors.borderLight },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quarryTitle: { fontSize: 14, fontWeight: '700', color: Colors.navy },
  quoteBreakdown: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  quoteTotal: { fontSize: 16, fontWeight: '800', color: Colors.success },
  historyBox: { backgroundColor: Colors.surface, padding: 8, borderRadius: 8, gap: 2 },
  historyText: { fontSize: 11, color: Colors.textSecondary },

  quoteActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  counterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 38, borderRadius: 10, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  counterBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  acceptQuoteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 38, borderRadius: 10, backgroundColor: Colors.success },
  acceptQuoteBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  // Orders
  orderCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, gap: 12 },
  ordTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ordMat: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  ordQuarry: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  frozenBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primarySurface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  frozenText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  priceSnapshotCard: { backgroundColor: Colors.background, borderRadius: 10, padding: 10, gap: 4 },
  snapRow: { flexDirection: 'row', justifyContent: 'space-between' },
  snapLbl: { fontSize: 12, color: Colors.textSecondary },
  snapVal: { fontSize: 12, fontWeight: '600', color: Colors.navy },
  tripsHeader: { fontSize: 13, fontWeight: '700', color: Colors.navy },
  tripRowCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.background, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderLight },
  tripBadge: { width: 48, height: 28, borderRadius: 6, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  tripNum: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  tripLoad: { fontSize: 12, fontWeight: '700', color: Colors.navy },
  tripDriver: { fontSize: 11, color: Colors.textSecondary },
  statePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statePillText: { fontSize: 10, fontWeight: '800' },

  // Modals
  modalRoot: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  modalSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.navy },
  textInput: { height: 46, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: Colors.navy },
  submitModalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12, backgroundColor: Colors.primary, marginTop: 10 },
  submitModalBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  dialog: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  dialogHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.borderMedium, alignSelf: 'center' },
  dialogTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  dialogSub: { fontSize: 12, color: Colors.textSecondary },
  dialogBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 10, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  confirmBtn: { flex: 1.5, height: 46, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
