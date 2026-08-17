// @ts-nocheck
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, TextInput, RefreshControl, Linking, Platform,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import * as API from '../src/services/MarketplaceAPI';
import { useAuth } from '../src/context/AuthContext';

function fmtCurrency(n: number) {
  if (!n && n !== 0) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function openGoogleMapsNav(lat: number, lng: number, label: string) {
  const androidUrl = `google.navigation:q=${lat},${lng}`;
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  Linking.openURL(androidUrl).catch(() => Linking.openURL(webUrl));
}

const TRIP_STATE_FLOW = [
  { state: 'ACCEPTED', label: 'Start Pickup Trip', next: 'GOING_TO_QUARRY', icon: 'navigate-outline', color: Colors.primary },
  { state: 'GOING_TO_QUARRY', label: 'Arrived at Quarry Yard', next: 'ARRIVED_AT_QUARRY', icon: 'business-outline', color: Colors.warning },
  { state: 'ARRIVED_AT_QUARRY', label: 'Start Material Loading', next: 'LOADING', icon: 'time-outline', color: Colors.warning },
  { state: 'LOADING', label: 'Mark Loaded & Weighed', next: 'LOADED', icon: 'cube-outline', color: Colors.warning },
  { state: 'LOADED', label: 'Start Delivery to Site', next: 'IN_TRANSIT', icon: 'car-sport-outline', color: Colors.info },
  { state: 'IN_TRANSIT', label: 'Arrived at Site', next: 'ARRIVED_AT_SITE', icon: 'location-outline', color: Colors.info },
  { state: 'ARRIVED_AT_SITE', label: 'Start Material Unloading', next: 'UNLOADING', icon: 'construct-outline', color: Colors.info },
  { state: 'UNLOADING', label: 'Proceed to Proof of Delivery', next: 'POD_REQUIRED', icon: 'checkmark-circle-outline', color: Colors.success },
];

export default function DriverMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const driverId = user?.id || params.driverId || 'driver-1';
  const driverName = user?.name || params.driverName || 'Ramesh Lorry Driver';
  const vehicleNo = user?.vehicleNo || params.vehicleNo || 'TN 38 AB 1234';

  const [isOnline, setIsOnline] = useState(true);
  const [operationalState, setOperationalState] = useState<string>('ONLINE');

  // Radar Trips & Active Assigned Trips
  const [radarTrips, setRadarTrips] = useState<API.Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<API.Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Proof of Delivery (PoD) Modal
  const [podModalVisible, setPodModalVisible] = useState(false);
  const [weighbridgeSlipUri, setWeighbridgeSlipUri] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [otp, setOtp] = useState('1234');
  const [submittingPod, setSubmittingPod] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const trips = await API.getDriverRadar(driverId);

      // Separate UNASSIGNED radar trips vs active assigned trip for this driver
      const radar = trips.filter(t => t.tripState === 'UNASSIGNED');
      const assigned = trips.find(t => t.driverId === driverId && t.tripState !== 'DELIVERED' && t.tripState !== 'CANCELLED');

      setRadarTrips(radar);
      setActiveTrip(assigned || null);
      if (assigned) {
        setOperationalState(assigned.tripState);
      }
    } catch (e) {
      console.error('Driver Radar Load Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useFocusEffect(useCallback(() => {
    loadData();

    // Subscribe to Pusher updates for newly broadcasted trips
    const unsub = API.subscribeToMarketplace({
      onOrderCreated: () => loadData(),
      onTripAccepted: () => loadData(),
      onTripStateChanged: () => loadData(),
    });

    const poll = setInterval(loadData, 6000);

    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [loadData]));

  // Toggle Online/Offline State
  const handleToggleOnline = async () => {
    const nextState = isOnline ? 'OFFLINE' : 'ONLINE';
    setIsOnline(!isOnline);
    setOperationalState(nextState);
    try {
      await API.toggleDriverOnline(driverId, nextState);
    } catch (e) {
      console.error(e);
    }
  };

  // Accept Radar Offer
  const handleAcceptRadarOffer = async (trip: API.Trip) => {
    Alert.alert(
      'Accept Trip Opportunity',
      `Accept 10-Ton load from ${trip.quarryName}? Estimated earnings: ${fmtCurrency(trip.driverEarnings)}`,
      [
        { text: 'Reject', style: 'cancel' },
        {
          text: 'Accept Trip',
          style: 'default',
          onPress: async () => {
            try {
              const accepted = await API.acceptTripOffer(trip._id || trip.id, driverId, {
                driverName,
                driverPhone: user?.phone || '9876543210',
                vehicleNo,
              });
              setActiveTrip(accepted);
              setOperationalState('ACCEPTED');
              Alert.alert('Trip Accepted! 🚛', 'Full site location & customer contact details are now revealed.');
              loadData();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  // Advance State Machine
  const handleAdvanceTripState = async (nextState: string) => {
    if (!activeTrip) return;
    if (nextState === 'POD_REQUIRED') {
      setPodModalVisible(true);
      return;
    }

    try {
      const updated = await API.updateTripState(activeTrip._id || activeTrip.id, nextState);
      setActiveTrip(updated);
      setOperationalState(nextState);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // Submit PoD
  const handleSubmitPoD = async () => {
    if (!activeTrip) return;
    setSubmittingPod(true);
    try {
      const res = await API.submitPoD(activeTrip._id || activeTrip.id, {
        photoUri: photoUri || 'https://via.placeholder.com/300?text=Delivery+Photo',
        weighbridgeSlipUri: weighbridgeSlipUri || 'https://via.placeholder.com/300?text=Weighbridge+Slip',
        otp,
        lat: activeTrip.customerLat,
        lng: activeTrip.customerLng,
      });

      setPodModalVisible(false);
      setActiveTrip(null);
      setOperationalState('ONLINE');
      Alert.alert(
        'Delivery Completed! 🎉',
        res.isOrderCompleted
          ? 'Proof of Delivery verified! All trips for this order are complete.'
          : 'Proof of Delivery verified! You are back ONLINE on the delivery radar.'
      );
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingPod(false);
    }
  };

  const currentFlowStep = activeTrip ? TRIP_STATE_FLOW.find(s => s.state === activeTrip.tripState) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Driver Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{driverName}</Text>
          <Text style={styles.vehicleNo}>{vehicleNo} · 10 Ton Tipper</Text>
        </View>

        {/* Online/Offline Toggle */}
        <TouchableOpacity
          style={[styles.onlineSwitch, isOnline ? { backgroundColor: Colors.success } : { backgroundColor: Colors.textDisabled }]}
          onPress={handleToggleOnline}
        >
          <View style={[styles.switchDot, isOnline ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]} />
          <Text style={styles.switchText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
        </TouchableOpacity>
      </View>

      {/* Operational State Banner */}
      <View style={[styles.stateBanner, isOnline ? { backgroundColor: Colors.primarySurface } : { backgroundColor: Colors.backgroundMuted }]}>
        <View style={[styles.stateDot, { backgroundColor: isOnline ? Colors.primary : Colors.textDisabled }]} />
        <Text style={styles.stateBannerText}>
          Status: <Text style={{ fontWeight: '800' }}>{operationalState}</Text>
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 8, color: Colors.textSecondary }}>Connecting to Lorry Delivery Radar...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* SECTION 1: ACTIVE TRIP EXECUTION (IF ASSIGNED) */}
          {activeTrip ? (
            <View style={styles.activeTripCard}>
              <View style={styles.activeHeader}>
                <View style={styles.livePulse} />
                <Text style={styles.activeTitle}>Active Delivery Trip (T{activeTrip.tripNumber})</Text>
              </View>

              <Text style={styles.matLoad}>{activeTrip.loadQuantityTon} Ton Load · Earnings: {fmtCurrency(activeTrip.driverEarnings)}</Text>

              {/* Revealed Privacy Details (Pickup & Delivery) */}
              <View style={styles.routeBox}>
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, { backgroundColor: Colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pointLbl}>1. Quarry Pickup</Text>
                    <Text style={styles.pointVal}>{activeTrip.quarryName} ({activeTrip.quarryAddress})</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={() => openGoogleMapsNav(activeTrip.quarryLat, activeTrip.quarryLng, activeTrip.quarryName)}
                  >
                    <Ionicons name="navigate" size={14} color="#FFF" />
                    <Text style={styles.navBtnText}>Map</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.routeLine} />

                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pointLbl}>2. Site Delivery (Full Details Unlocked)</Text>
                    <Text style={styles.pointVal}>{activeTrip.customerAddress}</Text>
                    {activeTrip.landmark ? <Text style={styles.pointSub}>Landmark: {activeTrip.landmark}</Text> : null}
                    <Text style={styles.pointSub}>Contact: {activeTrip.siteContact} ({activeTrip.customerPhone})</Text>
                    <Text style={styles.pointSub}>Instructions: {activeTrip.instructions || 'Standard unloading'}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.navBtn, { backgroundColor: Colors.info }]}
                    onPress={() => openGoogleMapsNav(activeTrip.customerLat, activeTrip.customerLng, activeTrip.customerAddress)}
                  >
                    <Ionicons name="navigate" size={14} color="#FFF" />
                    <Text style={styles.navBtnText}>Map</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* State Machine Transition Action Button */}
              {currentFlowStep && (
                <TouchableOpacity
                  style={[styles.actionStepBtn, { backgroundColor: currentFlowStep.color }]}
                  onPress={() => handleAdvanceTripState(currentFlowStep.next)}
                >
                  <Ionicons name={currentFlowStep.icon as any} size={18} color="#FFF" />
                  <Text style={styles.actionStepBtnText}>{currentFlowStep.label}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* SECTION 2: DELIVERY RADAR OPPORTUNITIES (PRIVACY PROTECTED BEFORE ACCEPTANCE) */
            <View style={{ gap: 14 }}>
              <View style={styles.radarHeaderRow}>
                <Ionicons name="radar-outline" size={20} color={Colors.primary} />
                <Text style={styles.radarTitle}>Delivery Radar Opportunities ({radarTrips.length})</Text>
              </View>

              {!isOnline ? (
                <View style={styles.centerWrap}>
                  <Ionicons name="power" size={44} color={Colors.textDisabled} />
                  <Text style={styles.emptyTitle}>You are OFFLINE</Text>
                  <Text style={styles.emptySub}>Switch your toggle to ONLINE to receive nearby delivery trip offers.</Text>
                </View>
              ) : radarTrips.length === 0 ? (
                <View style={styles.centerWrap}>
                  <Ionicons name="search-outline" size={44} color={Colors.textDisabled} />
                  <Text style={styles.emptyTitle}>Scanning Delivery Radar...</Text>
                  <Text style={styles.emptySub}>Nearby material pickup opportunities will appear here in real-time.</Text>
                </View>
              ) : (
                radarTrips.map(t => (
                  <View key={t._id || t.id} style={styles.radarCard}>
                    <View style={styles.radarTop}>
                      <View style={styles.iconBg}><Ionicons name="construct-outline" size={22} color={Colors.primary} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.radarQuarry}>{t.quarryName}</Text>
                        <Text style={styles.radarDistance}><Ionicons name="location-outline" size={12} /> {t.distanceKm} km away from quarry</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.earningVal}>{fmtCurrency(t.driverEarnings)}</Text>
                        <Text style={styles.earningLbl}>Payout</Text>
                      </View>
                    </View>

                    {/* Privacy Anonymized Delivery Info */}
                    <View style={styles.privacyBox}>
                      <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primary} />
                      <Text style={styles.privacyText}>
                        Load: <Text style={{ fontWeight: '800' }}>{t.loadQuantityTon} Tons</Text> · Customer location & contact revealed upon acceptance.
                      </Text>
                    </View>

                    <TouchableOpacity style={styles.acceptRadarBtn} onPress={() => handleAcceptRadarOffer(t)}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                      <Text style={styles.acceptRadarBtnText}>Accept Trip Opportunity</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* MODAL: PROOF OF DELIVERY (PoD) SUBMISSION */}
      <Modal visible={podModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPodModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalRoot}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Proof of Delivery (PoD)</Text>
                <Text style={styles.modalSub}>Upload weighbridge slip, photos, and customer OTP to complete trip</Text>
              </View>
              <TouchableOpacity onPress={() => setPodModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.navy} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14 }}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Customer Delivery OTP</Text>
                <TextInput style={styles.textInput} value={otp} onChangeText={setOtp} keyboardType="numeric" placeholder="Enter 4-digit OTP" />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Weighbridge Slip Photo URI</Text>
                <TextInput style={styles.textInput} value={weighbridgeSlipUri} onChangeText={setWeighbridgeSlipUri} placeholder="Photo URI or camera upload" />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Site Unloaded Material Photo URI</Text>
                <TextInput style={styles.textInput} value={photoUri} onChangeText={setPhotoUri} placeholder="Delivery site photo URI" />
              </View>

              <TouchableOpacity
                style={[styles.submitPodBtn, submittingPod && { opacity: 0.7 }]}
                onPress={handleSubmitPoD}
                disabled={submittingPod}
              >
                {submittingPod ? <ActivityIndicator color="#FFF" size="small" /> : (
                  <>
                    <Ionicons name="checkmark-done-circle" size={20} color="#FFF" />
                    <Text style={styles.submitPodBtnText}>Verify PoD & Mark Delivered</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  driverName: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  vehicleNo: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },

  onlineSwitch: { flexDirection: 'row', alignItems: 'center', width: 94, height: 32, borderRadius: 16, padding: 3, justifyContent: 'space-between' },
  switchDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF' },
  switchText: { fontSize: 10, fontWeight: '800', color: '#FFF', paddingHorizontal: 6 },

  stateBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  stateBannerText: { fontSize: 12, color: Colors.navy },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.navy },
  emptySub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  content: { flex: 1 },

  activeTripCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: Colors.primary, gap: 12 },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  livePulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  activeTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  matLoad: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  routeBox: { backgroundColor: Colors.background, padding: 12, borderRadius: 12, gap: 8 },
  routePoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  pointLbl: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary },
  pointVal: { fontSize: 13, fontWeight: '700', color: Colors.navy, marginTop: 1 },
  pointSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  routeLine: { width: 2, height: 14, backgroundColor: Colors.borderMedium, marginLeft: 4 },

  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  navBtnText: { fontSize: 11, fontWeight: '700', color: '#FFF' },

  actionStepBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12 },
  actionStepBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  radarHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radarTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy },

  radarCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, gap: 12 },
  radarTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBg: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  radarQuarry: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  radarDistance: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  earningVal: { fontSize: 16, fontWeight: '800', color: Colors.success },
  earningLbl: { fontSize: 10, color: Colors.textTertiary },

  privacyBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primarySurface, padding: 10, borderRadius: 10 },
  privacyText: { fontSize: 11, color: Colors.primary, flex: 1 },

  acceptRadarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, height: 44, borderRadius: 12 },
  acceptRadarBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  modalRoot: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  modalSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.navy },
  textInput: { height: 46, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: Colors.navy },
  submitPodBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12, backgroundColor: Colors.success, marginTop: 10 },
  submitPodBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});
