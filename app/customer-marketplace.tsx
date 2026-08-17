// @ts-nocheck
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, TextInput, Dimensions, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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

const STATUS_CONFIG = {
  requirement_posted: { label: 'Requirement Sent', icon: 'paper-plane-outline', color: Colors.statusNew, bg: Colors.statusNewBg },
  rate_quoted:        { label: 'Rate Quoted',       icon: 'pricetag-outline',    color: Colors.statusQuoted, bg: Colors.statusQuotedBg },
  rate_agreed:        { label: 'Rate Agreed',       icon: 'checkmark-circle-outline', color: Colors.statusAgreed, bg: Colors.statusAgreedBg },
  bidding_active:     { label: 'Finding Driver',    icon: 'search-outline',      color: Colors.statusBidding, bg: Colors.statusBiddingBg },
  driver_assigned:    { label: 'Driver Assigned',   icon: 'car-outline',         color: Colors.statusAssigned, bg: Colors.statusAssignedBg },
  loaded:             { label: 'Material Loaded',   icon: 'cube-outline',        color: Colors.statusLoaded, bg: Colors.statusLoadedBg },
  in_transit:         { label: 'On the Way',        icon: 'navigate-outline',    color: Colors.statusTransit, bg: Colors.statusTransitBg },
  delivered:          { label: 'Delivered',         icon: 'checkmark-done-circle-outline', color: Colors.statusDelivered, bg: Colors.statusDeliveredBg },
  settled:            { label: 'Payment Settled',   icon: 'wallet-outline',      color: Colors.statusSettled, bg: Colors.statusSettledBg },
};

const STEPS = ['requirement_posted','rate_quoted','rate_agreed','driver_assigned','loaded','in_transit','delivered'];

function StepTracker({ status }: { status: string }) {
  const currentIdx = STEPS.indexOf(status);
  if (currentIdx === -1) return null;

  const visibleSteps = [
    { label: 'Sent', icon: 'paper-plane-outline' },
    { label: 'Quoted', icon: 'pricetag-outline' },
    { label: 'Agreed', icon: 'handshake-outline' },
    { label: 'Driver', icon: 'car-outline' },
    { label: 'Loaded', icon: 'cube-outline' },
    { label: 'Transit', icon: 'navigate-outline' },
    { label: 'Done', icon: 'checkmark-done-circle-outline' },
  ];

  return (
    <View style={stepStyles.wrap}>
      {visibleSteps.map((s, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={i}>
            <View style={stepStyles.step}>
              <View style={[
                stepStyles.circle,
                done && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                active && stepStyles.activeCircle,
              ]}>
                <Ionicons
                  name={s.icon as any}
                  size={11}
                  color={done ? '#FFF' : Colors.textDisabled}
                />
              </View>
              <Text style={[stepStyles.lbl, done && { color: Colors.primary }]} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
            {i < visibleSteps.length - 1 && (
              <View style={[stepStyles.line, i < currentIdx && { backgroundColor: Colors.primary }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 12, paddingHorizontal: 2 },
  step: { alignItems: 'center', width: 38 },
  circle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.backgroundMuted,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  activeCircle: { borderColor: Colors.primary, backgroundColor: Colors.primarySurface },
  line: { flex: 1, height: 1.5, backgroundColor: Colors.border, marginTop: 13, marginHorizontal: 1 },
  lbl: { fontSize: 9, fontWeight: '600', color: Colors.textDisabled, marginTop: 4, textAlign: 'center' },
});

export default function CustomerMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [orders, setOrders] = useState<MarketplaceStore.MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [matName, setMatName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitType, setUnitType] = useState('ton');
  const [address, setAddress] = useState('');

  const loadOrders = useCallback(async () => {
    try {
      const all = await MarketplaceStore.getOrders();
      // Show only this customer's orders
      const myOrders = user?.name
        ? all.filter(o => o.customerName === user.name || o.customerPhone === user.phone)
        : all;
      setOrders(myOrders);
    } catch (e) {
      console.error('Load orders error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000); // poll every 5s for status updates
    return () => clearInterval(interval);
  }, [loadOrders]));

  const handlePostRequirement = async () => {
    if (!matName.trim()) { Alert.alert('Required', 'Please enter material type.'); return; }
    if (!quantity.trim()) { Alert.alert('Required', 'Please enter quantity.'); return; }
    if (!address.trim()) { Alert.alert('Required', 'Please enter your delivery site address.'); return; }

    setSaving(true);
    try {
      await MarketplaceStore.createOrder({
        customerName: user?.name || 'Customer',
        customerPhone: user?.phone || '',
        customerAddress: address.trim(),
        materialName: matName.trim(),
        quantity: parseFloat(quantity) || 1,
        unitType: unitType.trim() || 'ton',
      });
      setModalVisible(false);
      setMatName(''); setQuantity(''); setAddress(''); setUnitType('ton');
      Alert.alert('Requirement Posted', 'Your material requirement has been posted. Quarry owners will review and quote rates shortly.');
      loadOrders();
    } catch (e) {
      Alert.alert('Error', 'Failed to post requirement. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAgreeRate = (order: MarketplaceStore.MarketplaceOrder) => {
    Alert.alert(
      'Agree to Rate?',
      `The quarry has quoted ${fmtCurrency(order.materialPrice)} for ${order.quantity} ${order.unitType} ${order.materialName}. Do you agree?`,
      [
        { text: 'Negotiate', style: 'cancel' },
        {
          text: 'Agree & Proceed',
          style: 'default',
          onPress: async () => {
            await MarketplaceStore.updateOrder(order.id, { status: 'rate_agreed' });
            Alert.alert('Agreed!', 'The quarry owner will now arrange a driver for your order.');
            loadOrders();
          },
        },
      ]
    );
  };

  const UNIT_OPTIONS = ['ton', 'unit', 'load', 'trip', 'cft'];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Orders</Text>
          {user?.name ? <Text style={styles.headerSub}>{user.name}</Text> : null}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centerWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="clipboard-outline" size={40} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptySub}>Post your first material requirement and quarry owners will quote rates for you.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
            <Ionicons name="add-circle-outline" size={18} color="#FFF" />
            <Text style={styles.emptyBtnText}>Post Requirement</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadOrders(); }}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {orders.map(order => {
            const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.requirement_posted;
            return (
              <View key={order.id} style={styles.card}>
                {/* Card Header */}
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardMat}>{order.quantity} {order.unitType} {order.materialName}</Text>
                    <View style={styles.addressRow}>
                      <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
                      <Text style={styles.addressText} numberOfLines={1}>{order.customerAddress}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                    <Ionicons name={sc.icon as any} size={11} color={sc.color} />
                    <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>

                {/* Step Tracker */}
                <StepTracker status={order.status} />

                {/* Price breakdown */}
                {order.materialPrice > 0 && (
                  <View style={styles.priceCard}>
                    <View style={styles.priceRow}>
                      <View style={styles.priceRowLeft}>
                        <Ionicons name="layers-outline" size={14} color={Colors.textSecondary} />
                        <Text style={styles.priceLabel}>Material</Text>
                      </View>
                      <Text style={styles.priceVal}>{fmtCurrency(order.materialPrice)}</Text>
                    </View>
                    {order.transportPrice > 0 && (
                      <View style={styles.priceRow}>
                        <View style={styles.priceRowLeft}>
                          <Ionicons name="car-outline" size={14} color={Colors.textSecondary} />
                          <Text style={styles.priceLabel}>Transport</Text>
                        </View>
                        <Text style={styles.priceVal}>{fmtCurrency(order.transportPrice)}</Text>
                      </View>
                    )}
                    <View style={[styles.priceRow, styles.priceTotalRow]}>
                      <View style={styles.priceRowLeft}>
                        <Ionicons name="wallet-outline" size={14} color={Colors.primary} />
                        <Text style={[styles.priceLabel, { fontWeight: '700', color: Colors.primary }]}>Total</Text>
                      </View>
                      <Text style={[styles.priceVal, { fontWeight: '800', color: Colors.primary }]}>
                        {fmtCurrency((order.materialPrice || 0) + (order.transportPrice || 0))}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Driver info */}
                {order.driverName ? (
                  <View style={styles.driverCard}>
                    <View style={styles.driverIconWrap}>
                      <Ionicons name="car-sport" size={18} color={Colors.info} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverName}>{order.driverName}</Text>
                      <Text style={styles.driverVehicle}>{order.vehicleNo} · {order.driverPhone}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.trackBtn}
                      onPress={() => router.push('/live-tracking')}
                    >
                      <Ionicons name="navigate" size={13} color="#FFF" />
                      <Text style={styles.trackBtnText}>Track</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Action: Agree Rate */}
                {order.status === 'rate_quoted' && (
                  <TouchableOpacity style={styles.agreeBtn} onPress={() => handleAgreeRate(order)}>
                    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                    <Text style={styles.agreeBtnText}>
                      Agree to Rate — {fmtCurrency(order.materialPrice)}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Order date */}
                <Text style={styles.orderDate}>
                  Placed {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Post Requirement Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalRoot}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Post Material Requirement</Text>
                <Text style={styles.modalSub}>Quarry owners will quote rates for your requirement</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              {/* Material Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  <Ionicons name="layers-outline" size={13} /> Material Type
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={matName}
                  onChangeText={setMatName}
                  placeholder="e.g. River Sand, M-Sand, Blue Metal 20mm"
                  placeholderTextColor={Colors.textDisabled}
                />
              </View>

              {/* Quantity + Unit */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Quantity</Text>
                  <TextInput
                    style={styles.textInput}
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="e.g. 10"
                    placeholderTextColor={Colors.textDisabled}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {UNIT_OPTIONS.map(u => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.unitChip, unitType === u && styles.unitChipSelected]}
                          onPress={() => setUnitType(u)}
                        >
                          <Text style={[styles.unitChipText, unitType === u && { color: Colors.primary }]}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              {/* Delivery Address */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  <Ionicons name="location-outline" size={13} /> Delivery Site Address
                </Text>
                <TextInput
                  style={[styles.textInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Enter detailed delivery site address"
                  placeholderTextColor={Colors.textDisabled}
                  multiline
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.7 }]}
                onPress={handlePostRequirement}
                disabled={saving}
                activeOpacity={0.82}
              >
                {saving
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : (
                    <>
                      <Ionicons name="paper-plane" size={18} color="#FFF" />
                      <Text style={styles.submitBtnText}>Send to Quarry Owners</Text>
                    </>
                  )
                }
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
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  addBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary, marginTop: 8 },
  emptyIcon: { width: 80, height: 80, borderRadius: 20, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: Colors.borderLight,
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardMat: { fontSize: 16, fontWeight: '800', color: Colors.navy },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  addressText: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: '700' },
  priceCard: {
    backgroundColor: Colors.background, borderRadius: 10,
    padding: 12, gap: 6, marginTop: 4,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priceLabel: { fontSize: 13, color: Colors.textSecondary },
  priceVal: { fontSize: 13, fontWeight: '600', color: Colors.text },
  priceTotalRow: { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 6, marginTop: 2 },
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.infoLight, borderRadius: 10, padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: Colors.infoBorder,
  },
  driverIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  driverName: { fontSize: 14, fontWeight: '700', color: Colors.navy },
  driverVehicle: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  trackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.info, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  trackBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  agreeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.success, borderRadius: 12, padding: 14, marginTop: 12,
  },
  agreeBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  orderDate: { fontSize: 11, color: Colors.textTertiary, marginTop: 10 },
  // Modal
  modalRoot: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 20, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.navy },
  modalSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.backgroundMuted, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { flex: 1 },
  fieldGroup: { gap: 6, marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  textInput: {
    height: 52, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14,
    fontSize: 14, color: Colors.text,
  },
  unitChip: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    backgroundColor: Colors.backgroundMuted, borderWidth: 1, borderColor: Colors.border,
  },
  unitChipSelected: { backgroundColor: Colors.primarySurface, borderColor: Colors.primary },
  unitChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 56, borderRadius: 14, backgroundColor: Colors.primary,
    marginTop: 8,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
