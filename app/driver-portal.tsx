// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput,
  Linking, Alert, ActivityIndicator, Platform, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import {
  getDatabase, getDriverTrips, getConsignments, saveConsignment,
  getDriverRateCard, saveDriverRateCard, getConsignmentDocuments,
  updateTripStatus, getTripsForDriver,
} from '../src/database/db';
import { ProfileSettingsModal } from '../src/components';

export default function DriverPortalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const driverId = user?.id || 1;
  const driverName = user?.name || 'Ramesh (Driver)';
  const vehicleNo = user?.vehicle_no || 'TN 38 AB 1234';

  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Rate Card State
  const [rateModalVisible, setModalRateVisible] = useState(false);
  const [ratePerKm, setRatePerKm] = useState('45');
  const [minCharge, setMinCharge] = useState('1200');
  const [loadingCharge, setLoadingCharge] = useState('500');
  const [waitingCharge, setWaitingCharge] = useState('200');
  const [savingRate, setSavingRate] = useState(false);

  // Legal Docs State
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [currentDocs, setCurrentDocs] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Profile State
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState(user);

  const [prevTripCount, setPrevTripCount] = useState<number | null>(null);

  const playBuzzerNotification = () => {
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25); // A5
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {}
  };

  const loadData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const list = await getDriverTrips(db, driverId);
      
      // Play buzzer if a new trip assignment arrived
      if (prevTripCount !== null && list.length > prevTripCount) {
        playBuzzerNotification();
      }
      setPrevTripCount(list.length);
      setConsignments(list);

      const rates = await getDriverRateCard(db, driverId);
      if (rates) {
        setRatePerKm((rates.rate_per_km || 45).toString());
        setMinCharge((rates.min_charge || 1200).toString());
        setLoadingCharge((rates.loading_charge || 500).toString());
        setWaitingCharge((rates.waiting_charge_per_hr || 200).toString());
      }
    } catch (e) {
      console.error('Driver portal load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId, prevTripCount]);

  const handleSaveRateCard = async () => {
    setSavingRate(true);
    try {
      const db = await getDatabase();
      await saveDriverRateCard(db, driverId, {
        rate_per_km: parseFloat(ratePerKm) || 45,
        min_charge: parseFloat(minCharge) || 1200,
        loading_charge: parseFloat(loadingCharge) || 500,
        waiting_charge_per_hr: parseFloat(waitingCharge) || 200,
      });
      Alert.alert('Rate Card Updated 🚚', 'Your per-kilometer pricing and charges have been saved!');
      setModalRateVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to save rate card.');
    } finally {
      setSavingRate(false);
    }
  };

  const handleViewDocs = async (trip: any) => {
    setSelectedTrip(trip);
    try {
      const db = await getDatabase();
      const docs = await getConsignmentDocuments(db, trip.id, trip.quarry_id || 1);
      setCurrentDocs(docs);
      setDocModalVisible(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to load transport documents.');
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openGoogleMapsNav = (addressLabel) => {
    const encoded = encodeURIComponent(addressLabel || 'Tamil Nadu');
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`).catch(() => {});
  };

  const handleUpdateStatus = async (consignment, newStatus, label) => {
    // Geo-fence check for critical statuses
    const geoFencedStatuses = {
      reached_quarry: { address: consignment.pickup_address || consignment.from_address, lat: consignment.from_lat, lng: consignment.from_lng },
      reached_customer: { address: consignment.customer_address || consignment.to_address, lat: consignment.to_lat, lng: consignment.to_lng },
    };

    if (geoFencedStatuses[newStatus]) {
      const target = geoFencedStatuses[newStatus];
      try {
        if (Platform.OS === 'web' && navigator?.geolocation) {
          Alert.alert('📍 Location Check', `We'll verify you're within 150m of "${target.address || 'destination'}". Allow location access?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Check Location', onPress: async () => {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                  const dLat = pos.coords.latitude;
                  const dLng = pos.coords.longitude;
                  // If we have target coords, check distance; otherwise proceed
                  if (target.lat && target.lng) {
                    const R = 6371000;
                    const dLatR = (target.lat - dLat) * Math.PI / 180;
                    const dLngR = (target.lng - dLng) * Math.PI / 180;
                    const a = Math.sin(dLatR/2) * Math.sin(dLatR/2) + Math.cos(dLat * Math.PI / 180) * Math.cos(target.lat * Math.PI / 180) * Math.sin(dLngR/2) * Math.sin(dLngR/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    const dist = R * c;
                    
                    if (dist > 150) {
                      Alert.alert('Geofence Alert', `You are ${Math.round(dist)}m away from the target location. Please move closer.\n\n(Demo: Bypass this error to continue?)`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Bypass (Demo)', onPress: () => doUpdateStatus(consignment, newStatus, label, { lat: dLat, lng: dLng }) }
                      ]);
                      return;
                    }
                  }
                  await doUpdateStatus(consignment, newStatus, label, { lat: dLat, lng: dLng });
                }, async () => {
                  // Location denied - allow with warning
                  Alert.alert('Location Unavailable', 'Could not verify location. Proceeding anyway.', [
                    { text: 'OK', onPress: () => doUpdateStatus(consignment, newStatus, label, null) }
                  ]);
                }, { enableHighAccuracy: true, timeout: 8000 });
              }
            }
          ]);
          return;
        }
      } catch {}
    }
    await doUpdateStatus(consignment, newStatus, label, null);
  };

  const doUpdateStatus = async (consignment, newStatus, label, geo) => {
    try {
      const db = await getDatabase();
      // Try new Trip system first
      const { updateTripStatus, getTripsForDriver } = await import('../src/database/db');
      const allTrips = await getTripsForDriver(db, driverId);
      const matchingTrip = allTrips.find(t => t.id === consignment.id);
      if (matchingTrip) {
        await updateTripStatus(db, consignment.id, newStatus, geo);
      } else {
        await saveConsignment(db, { ...consignment, status: newStatus });
      }

      // Broadcast Real-time Live Event
      try {
        const { broadcastRealtimeEvent } = require('../src/services/realtimeService');
        broadcastRealtimeEvent('DELIVERY_STAGE_UPDATE', {
          order_id: consignment.id,
          status: newStatus,
          status_label: label,
          driver_name: driverName,
          vehicle_no: vehicleNo,
        });
      } catch (e) {}

      Alert.alert('✅ Status Updated', `Trip status: ${label}`);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to update trip status.');
    }
  };

  const getGeoLocationPromise = () => {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => reject(err)
        );
      } else {
        reject(new Error('Geolocation not supported'));
      }
    });
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // in metres
  };

  const handleTripStage = async (trip, nextStage) => {
    try {
      setLoading(true);
      const db = await getDatabase();
      // Try to get actual geo, fallback to mock if failed to allow testing
      let geo = null;
      try {
        geo = await getGeoLocationPromise();
        
        // Geofencing verification (e.g., must be within 100m of quarry to mark reached_quarry)
        if (nextStage === 'reached_quarry' && trip.from_lat && trip.from_lng) {
          const dist = calculateDistance(geo.lat, geo.lng, trip.from_lat, trip.from_lng);
          if (dist > 150) { // 150 meters tolerance
            Alert.alert('Geofence Alert', `You appear to be ${Math.round(dist)}m away from the quarry. Please move closer to mark arrival.\n\n(Demo: Bypass this error to continue?)`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Bypass (Demo)', onPress: () => forceUpdateTripStage(db, trip, nextStage, geo) }
            ]);
            setLoading(false);
            return;
          }
        }
        
        if (nextStage === 'reached_customer' && trip.to_lat && trip.to_lng) {
          const dist = calculateDistance(geo.lat, geo.lng, trip.to_lat, trip.to_lng);
          if (dist > 150) {
            Alert.alert('Geofence Alert', `You appear to be ${Math.round(dist)}m away from the delivery site. Please move closer.\n\n(Demo: Bypass this error to continue?)`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Bypass (Demo)', onPress: () => forceUpdateTripStage(db, trip, nextStage, geo) }
            ]);
            setLoading(false);
            return;
          }
        }

      } catch (err) {
        console.warn('Geo failed', err);
        // Fallback mock geo for demo
        geo = { lat: 11.0168, lng: 76.9558 }; 
      }

      await forceUpdateTripStage(db, trip, nextStage, geo);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const forceUpdateTripStage = async (db, trip, nextStage, geo) => {
    await updateTripStatus(db, trip.id, nextStage, geo);
    Alert.alert('Success', `Trip status updated to: ${nextStage.replace('_', ' ')}`);
    loadData();
  };


  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/select-role')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{currentUserProfile?.name || driverName}</Text>
          <Text style={styles.headerSub}>Vehicle: {vehicleNo}</Text>
        </View>
        <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: '#E3F2FD', paddingHorizontal: 10, width: 'auto', flexDirection: 'row', gap: 4 }]} onPress={() => setModalRateVisible(true)}>
          <Ionicons name="pricetag-outline" size={16} color="#1565C0" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#1565C0' }}>Rate Card</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.refreshBtn, { marginLeft: 8 }]} onPress={() => setProfileModalVisible(true)}>
          <Ionicons name="person-circle" size={22} color="#1565C0" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#1565C0" />
          <Text style={{ marginTop: 8, color: Colors.textSecondary }}>Loading Assigned Trips...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={['#1565C0']} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusBanner}>
            <Ionicons name="location" size={20} color="#1565C0" />
            <Text style={styles.statusBannerText}>Driver Status: <Text style={{ fontWeight: '800' }}>Active & Ready</Text></Text>
          </View>

          <Text style={styles.sectionTitle}>Assigned Trips ({consignments.length})</Text>

          {consignments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="car-sport-outline" size={40} color={Colors.textDisabled} />
              <Text style={styles.emptyTitle}>No Active Trips Assigned</Text>
              <Text style={styles.emptySub}>When a quarry owner assigns a trip to your lorry, it will appear here instantly.</Text>
            </View>
          ) : (
            consignments.map((c) => (
              <View key={c.id} style={styles.tripCard}>
                <View style={styles.tripHeader}>
                  <View style={styles.materialIconWrap}>
                    <Ionicons name="cube" size={22} color="#1565C0" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.materialName}>{c.material_name || 'Construction Material'}</Text>
                    <Text style={styles.tripQty}>{c.quantity || 1} {c.unit_type || 'units'} • Rate: ₹{c.agreed_rate || 0}</Text>
                  </View>
                  <View style={[styles.statusBadge, c.status === 'delivered' ? { backgroundColor: Colors.successLight } : { backgroundColor: '#E3F2FD' }]}>
                    <Text style={[styles.statusText, c.status === 'delivered' ? { color: Colors.success } : { color: '#1565C0' }]}>
                      {(c.status || 'assigned').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationGroup}>
                  <TouchableOpacity style={styles.locRow} onPress={() => openGoogleMapsNav(c.pickup_address)}>
                    <Ionicons name="pin" size={16} color={Colors.primary} />
                    <Text style={styles.locText} numberOfLines={1}>Pickup: {c.pickup_address || 'Quarry Site'}</Text>
                    <Ionicons name="navigate-outline" size={14} color={Colors.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.locRow} onPress={() => openGoogleMapsNav(c.customer_address)}>
                    <Ionicons name="location" size={16} color={Colors.success} />
                    <Text style={styles.locText} numberOfLines={1}>Delivery: {c.customer_address || c.customer_name || 'Customer Site'}</Text>
                    <Ionicons name="navigate-outline" size={14} color={Colors.success} />
                  </TouchableOpacity>
                </View>

                {c.customer_name ? (
                  <View style={styles.customerRow}>
                    <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.customerText}>Customer: {c.customer_name} ({c.customer_phone || 'N/A'})</Text>
                    {c.customer_phone ? (
                      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => Linking.openURL(`tel:${c.customer_phone}`)}>
                          <Ionicons name="call-outline" size={16} color={Colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 }}
                          onPress={() => router.push('/messages')}
                        >
                          <Ionicons name="chatbubbles" size={14} color="#1565C0" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#1565C0' }}>Chat Customer</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primarySurface, padding: 8, borderRadius: 8, marginTop: 4 }} onPress={() => handleViewDocs(c)}>
                  <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>View Transport Docs (eWay Bill)</Text>
                </TouchableOpacity>

                {/* Status Action Buttons */}
                <View style={styles.actionRow}>
                  {c.status === 'assigned' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.primary }]} onPress={() => handleUpdateStatus(c, 'reached_quarry', 'Reached Quarry')}>
                      <Ionicons name="location-outline" size={16} color="#FFF" />
                      <Text style={styles.actionBtnText}>Reached Quarry</Text>
                    </TouchableOpacity>
                  )}
                  {c.status === 'reached_quarry' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F57C00' }]} onPress={() => handleUpdateStatus(c, 'picked_up', 'Material Loaded')}>
                      <Ionicons name="cube-outline" size={16} color="#FFF" />
                      <Text style={styles.actionBtnText}>Material Picked Up</Text>
                    </TouchableOpacity>
                  )}
                  {c.status === 'picked_up' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1565C0' }]} onPress={() => handleUpdateStatus(c, 'reached_customer', 'Reached Delivery Site')}>
                      <Ionicons name="navigate-circle-outline" size={16} color="#FFF" />
                      <Text style={styles.actionBtnText}>Reached Drop Loc.</Text>
                    </TouchableOpacity>
                  )}
                  {c.status === 'reached_customer' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: Colors.success }]} onPress={() => handleUpdateStatus(c, 'delivered', 'Delivered to Site')}>
                      <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
                      <Text style={styles.actionBtnText}>Mark Delivered</Text>
                    </TouchableOpacity>
                  )}
                  {c.status === 'delivered' && (
                    <View style={styles.deliveredTag}>
                      <Ionicons name="checkmark-done" size={16} color={Colors.success} />
                      <Text style={styles.deliveredText}>Delivery Completed</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Rate Card Modal */}
      <Modal visible={rateModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 450, backgroundColor: Colors.surface, borderRadius: 16, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, paddingBottom: 10 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.navy }}>My Driver Rate Card (Kilometers Pricing)</Text>
              <TouchableOpacity onPress={() => setModalRateVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 4 }}>Rate Per Kilometer (₹/km)</Text>
                <TextInput style={{ height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: Colors.text }} value={ratePerKm} onChangeText={setRatePerKm} keyboardType="numeric" placeholder="45" />
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 4 }}>Minimum Trip Charge (₹)</Text>
                <TextInput style={{ height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: Colors.text }} value={minCharge} onChangeText={setMinCharge} keyboardType="numeric" placeholder="1200" />
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 4 }}>Loading / Unloading Charge (₹)</Text>
                <TextInput style={{ height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: Colors.text }} value={loadingCharge} onChangeText={setLoadingCharge} keyboardType="numeric" placeholder="500" />
              </View>
              <View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 4 }}>Waiting Charge (₹ / hour)</Text>
                <TextInput style={{ height: 44, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: Colors.text }} value={waitingCharge} onChangeText={setWaitingCharge} keyboardType="numeric" placeholder="200" />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight }}>
              <TouchableOpacity style={{ flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setModalRateVisible(false)}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, height: 44, borderRadius: 8, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center' }} onPress={handleSaveRateCard} disabled={savingRate}>
                {savingRate ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Save Rate Card</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ProfileSettingsModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        role="driver"
        userProfile={currentUserProfile}
        onProfileUpdated={(updated) => setCurrentUserProfile(updated)}
      />

      {/* Legal Transport Docs Modal */}
      <Modal visible={docModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 450, backgroundColor: Colors.surface, borderRadius: 16, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, paddingBottom: 10 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.navy }}>Transport Legal Documents</Text>
              <TouchableOpacity onPress={() => setDocModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {currentDocs.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Ionicons name="document-outline" size={36} color={Colors.textDisabled} />
                <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                  No legal documents (eWay Bill / Delivery Challan) attached for this trip yet.
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textTertiary, marginTop: 4, textAlign: 'center' }}>
                  Quarry Owner can attach official eWay bills from their portal.
                </Text>
              </View>
            ) : (
              currentDocs.map(doc => (
                <View key={doc.id} style={{ backgroundColor: Colors.background, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.navy }}>{doc.doc_name}</Text>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>Type: {doc.doc_type}</Text>
                  <Text style={{ fontSize: 11, color: Colors.textTertiary, marginTop: 4 }}>Content: {doc.doc_content}</Text>
                </View>
              ))
            )}

            <TouchableOpacity style={{ height: 44, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 14 }} onPress={() => setDocModalVisible(false)}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Close Documents</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 11, color: Colors.textSecondary },
  refreshBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E3F2FD', padding: 12, borderRadius: 10, marginBottom: 16, borderWidth: 1, borderColor: '#BBDEFB' },
  statusBannerText: { fontSize: 13, color: '#1565C0' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  emptyCard: { padding: 36, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderLight, marginTop: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 10 },
  emptySub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  tripCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight, gap: 12 },
  tripHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  materialIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' },
  materialName: { fontSize: 16, fontWeight: '700', color: Colors.navy },
  tripQty: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  locationGroup: { backgroundColor: Colors.background, borderRadius: 10, padding: 10, gap: 8 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.text },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  customerText: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  actionRow: { marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 10 },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  deliveredTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: Colors.successLight, borderRadius: 10 },
  deliveredText: { fontSize: 13, fontWeight: '700', color: Colors.success },
});
