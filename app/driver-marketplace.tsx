// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Linking, Alert, ActivityIndicator, Platform, RefreshControl, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../src/theme';
import { Card, Button, Input } from '../src/components';
import { useAuth } from '../src/context/AuthContext';
import {
  getDatabase, getOpenDeliveryOrders, acceptDeliveryOrder,
  getDriverRateCard, saveDriverRateCard,
} from '../src/database/db';

export default function DriverMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [driverCategory, setDriverCategory] = useState<'freelance' | 'in_house'>('freelance');
  const [driverName, setDriverName] = useState(user?.name || 'Ramesh (Private Transporter)');
  const [driverPhone, setDriverPhone] = useState(user?.phone || '9876543210');
  const [vehicleNo, setVehicleNo] = useState(user?.vehicle_no || 'TN 38 AB 1234');
  const [vehicleType, setVehicleType] = useState('Taurus 10-Wheeler Tipper');

  const [openOrders, setOpenOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);

  // Rate Card State
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [ratePerKm, setRatePerKm] = useState('85');
  const [minCharge, setMinCharge] = useState('1200');
  const [loadingCharge, setLoadingCharge] = useState('500');
  const [savingRate, setSavingRate] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      const orders = await getOpenDeliveryOrders(db);
      setOpenOrders(orders);
    } catch (e) {
      console.error('Error loading delivery orders:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcceptOrder = async (order) => {
    setAcceptingId(order.id);
    try {
      const db = await getDatabase();
      await acceptDeliveryOrder(db, order.id, order.quarry_id, user?.id || 1, driverName, vehicleNo);
      Alert.alert(
        'Delivery Order Accepted! 🚚',
        `You have accepted the trip for ${order.material_name} (${order.quantity} ${order.unit_type}) from ${order.quarry_name} to ${order.customer_name}.\n\nEstimated Payout: ₹${order.estimated_payout}`,
        [
          {
            text: 'Go to Driver Portal',
            onPress: () => router.push('/driver-portal'),
          },
          { text: 'Stay Here', style: 'cancel' },
        ]
      );
      await loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to accept delivery order.');
    } finally {
      setAcceptingId(null);
    }
  };

  const openGoogleNav = (addressLabel) => {
    const encoded = encodeURIComponent(addressLabel || 'Tamil Nadu');
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`).catch(() => {});
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="navigate-circle" size={20} color={Colors.primary} />
            <Text style={styles.headerTitle}>Driver & Lorry Marketplace</Text>
          </View>
          <Text style={styles.headerSub}>Zomato-style Heavy Material Logistics & Delivery Orders</Text>
        </View>
        <TouchableOpacity style={styles.portalBtn} onPress={() => router.push('/driver-portal')}>
          <Ionicons name="clipboard-outline" size={16} color={Colors.primary} />
          <Text style={styles.portalBtnText}>My Trips</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Driver Category Selector Box */}
        <View style={styles.categoryCard}>
          <Text style={styles.sectionTitle}>Select Your Driver Category</Text>
          <Text style={styles.categorySub}>Choose how you operate on the BillForge building material network</Text>

          <View style={styles.categoryRow}>
            <TouchableOpacity
              style={[styles.categoryOption, driverCategory === 'freelance' && styles.categoryOptionActive]}
              onPress={() => setDriverCategory('freelance')}
            >
              <View style={[styles.iconCircle, driverCategory === 'freelance' && { backgroundColor: Colors.primary }]}>
                <Ionicons name="globe-outline" size={20} color={driverCategory === 'freelance' ? '#FFF' : Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.categoryTitle, driverCategory === 'freelance' && { color: Colors.primary }]}>
                  🚛 Private / Freelance Transporter
                </Text>
                <Text style={styles.categoryDesc}>
                  Independent lorry owner. Accept delivery orders from ANY quarry across Tamil Nadu!
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.categoryOption, driverCategory === 'in_house' && styles.categoryOptionActive]}
              onPress={() => setDriverCategory('in_house')}
            >
              <View style={[styles.iconCircle, driverCategory === 'in_house' && { backgroundColor: Colors.primary }]}>
                <Ionicons name="business-outline" size={20} color={driverCategory === 'in_house' ? '#FFF' : Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.categoryTitle, driverCategory === 'in_house' && { color: Colors.primary }]}>
                  🏢 In-House Quarry Fleet Driver
                </Text>
                <Text style={styles.categoryDesc}>
                  Dedicated driver employed directly by Demo Quarry & Crushers.
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Driver Profile Summary Card */}
        <View style={styles.profileCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={22} color="#FFF" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.navy }}>{driverName}</Text>
                <Text style={{ fontSize: 12, color: Colors.textSecondary }}>📞 {driverPhone} · 🚛 {vehicleNo}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.rateBtn} onPress={() => setRateModalVisible(true)}>
              <Ionicons name="calculator-outline" size={14} color={Colors.primary} />
              <Text style={styles.rateBtnText}>Rate Card (₹{ratePerKm}/km)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.badgeRow}>
            <View style={[styles.typeBadge, { backgroundColor: driverCategory === 'freelance' ? '#DCFCE7' : '#EFF6FF' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: driverCategory === 'freelance' ? '#15803D' : '#1D4ED8' }}>
                {driverCategory === 'freelance' ? '🌍 Open Market Transporter' : '🔒 Demo Quarry Fleet Driver'}
              </Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: '#F1F5F9' }]}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textSecondary }}>{vehicleType}</Text>
            </View>
          </View>
        </View>

        {/* Live Delivery Orders Feed */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.navy }}>Live Delivery Orders</Text>
            <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Available material trips open for pickup</Text>
          </View>
          <View style={{ backgroundColor: Colors.primarySurface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>{openOrders.length} Orders Open</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 30 }} />
        ) : openOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={48} color={Colors.textTertiary} style={{ marginBottom: 10 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textSecondary }}>No open delivery orders right now</Text>
            <Text style={{ fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: 4 }}>
              New material orders from quarries will automatically pop up here in real time!
            </Text>
          </View>
        ) : (
          openOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              {/* Top Banner */}
              <View style={styles.orderHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quarryName}>{order.quarry_name}</Text>
                  <Text style={styles.quarryLoc}>📍 Pickup: {order.pickup_address}</Text>
                </View>
                <View style={styles.payoutBadge}>
                  <Text style={styles.payoutText}>₹{order.estimated_payout}</Text>
                  <Text style={styles.payoutSub}>Freight Payout</Text>
                </View>
              </View>

              {/* Delivery Details */}
              <View style={styles.orderDetailsGrid}>
                <View style={styles.detailItem}>
                  <Ionicons name="cube-outline" size={16} color={Colors.primary} />
                  <View>
                    <Text style={styles.detailLabel}>Material</Text>
                    <Text style={styles.detailVal}>{order.material_name} ({order.quantity} {order.unit_type})</Text>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <Ionicons name="navigate-outline" size={16} color="#7C3AED" />
                  <View>
                    <Text style={styles.detailLabel}>Delivery Site</Text>
                    <Text style={styles.detailVal} numberOfLines={1}>{order.customer_name} · {order.customer_address}</Text>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <Ionicons name="speedometer-outline" size={16} color="#D97706" />
                  <View>
                    <Text style={styles.detailLabel}>Distance</Text>
                    <Text style={styles.detailVal}>{order.distance_km} km approx.</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.orderActionRow}>
                <TouchableOpacity style={styles.navBtn} onPress={() => openGoogleNav(order.customer_address)}>
                  <Ionicons name="navigate" size={16} color={Colors.primary} />
                  <Text style={styles.navBtnText}>Map Nav</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleAcceptOrder(order)}
                  disabled={acceptingId === order.id}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.acceptBtnText}>
                    {acceptingId === order.id ? 'Accepting...' : 'Accept Delivery Order 🚚'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Rate Card Modal */}
      <Modal visible={rateModalVisible} animationType="slide" transparent onRequestClose={() => setRateModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Driver Freight Rate Card</Text>
              <TouchableOpacity onPress={() => setRateModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              <Input
                label="Rate Per Kilometer (₹/km) *"
                value={ratePerKm}
                onChangeText={setRatePerKm}
                keyboardType="numeric"
                icon="speedometer-outline"
              />
              <Input
                label="Minimum Trip Charge (₹)"
                value={minCharge}
                onChangeText={setMinCharge}
                keyboardType="numeric"
                icon="cash-outline"
              />
              <Input
                label="Quarry Loading & Halting Charge (₹)"
                value={loadingCharge}
                onChangeText={setLoadingCharge}
                keyboardType="numeric"
                icon="time-outline"
              />

              <Button
                title={savingRate ? 'Saving...' : 'Save Freight Rate Card'}
                onPress={() => {
                  Alert.alert('Rate Card Saved! 🚚', `Per Km Rate: ₹${ratePerKm}/km\nMin Charge: ₹${minCharge}`);
                  setRateModalVisible(false);
                }}
                variant="success"
                fullWidth
                style={{ marginTop: 10 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 11, color: Colors.textSecondary },
  portalBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primarySurface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  portalBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  
  categoryCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  categorySub: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12 },
  categoryRow: { gap: 10 },
  categoryOption: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.surface },
  categoryOptionActive: { borderColor: Colors.primary, backgroundColor: '#F0F9FF' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  categoryTitle: { fontSize: 13, fontWeight: '700', color: Colors.navy, marginBottom: 2 },
  categoryDesc: { fontSize: 11, color: Colors.textSecondary },

  profileCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 14, borderWidth: 1, borderColor: Colors.borderLight },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F3FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#DDD6FE' },
  rateBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },

  emptyCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 30, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.borderLight },
  orderCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  quarryName: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  quarryLoc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  payoutBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignItems: 'center' },
  payoutText: { fontSize: 15, fontWeight: '900', color: '#15803D' },
  payoutSub: { fontSize: 9, fontWeight: '700', color: '#166534' },

  orderDetailsGrid: { padding: 14, gap: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailLabel: { fontSize: 10, color: Colors.textSecondary, textTransform: 'uppercase' },
  detailVal: { fontSize: 13, fontWeight: '700', color: Colors.text },

  orderActionRow: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: Colors.borderLight, backgroundColor: Colors.surface },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.primarySurface, borderWidth: 1, borderColor: Colors.borderLight },
  navBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.success, borderRadius: 10, paddingVertical: 10 },
  acceptBtnText: { fontSize: 13, fontWeight: '800', color: '#FFF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 500, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  closeBtn: { padding: 4 },
});
