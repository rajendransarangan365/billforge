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

export default function CustomerMarketplaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Walkie & Doc Modals
  const [walkieModalVisible, setWalkieModalVisible] = useState(false);
  const [walkiePeer, setWalkiePeer] = useState({ name: 'Quarry Owner', role: 'quarry_owner', id: 'admin' });
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [selectedOrderForDoc, setSelectedOrderForDoc] = useState(null);

  // Form
  const [customerName, setCustomerName] = useState('Anand Construction');
  const [customerPhone, setCustomerPhone] = useState('9876543210');
  const [materialName, setMaterialName] = useState('River Sand');
  const [quantity, setQuantity] = useState('10');
  const [unitType, setUnitType] = useState('ton');
  const [customerAddress, setCustomerAddress] = useState('Coimbatore Site 4');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
      const response = await fetch(`${baseUrl}/api/marketplace`);
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.error('Marketplace load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadOrders(); }, [loadOrders]));

  const handlePostRequirement = async () => {
    if (!materialName.trim() || !quantity) {
      Alert.alert('Required', 'Please fill material name and quantity.');
      return;
    }
    setSaving(true);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
      await fetch(`${baseUrl}/api/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_order',
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(),
          materialName: materialName.trim(),
          quantity: parseFloat(quantity) || 1,
          unitType,
        }),
      });
      setModalVisible(false);
      Alert.alert('Posted 🎉', 'Your material requirement is live! Quarry owners will quote rates.');
      loadOrders();
    } catch (e) {
      Alert.alert('Error', 'Failed to post requirement.');
    } finally {
      setSaving(false);
    }
  };

  const handleAgreeRate = async (order) => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
      await fetch(`${baseUrl}/api/marketplace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'agree_rate', orderId: order._id || order.id }),
      });
      Alert.alert('Agreed! 🤝', 'Rate agreed! Quarry Owner is now assigning a Lorry Driver.');
      loadOrders();
    } catch (e) {
      Alert.alert('Agreed!', 'Rate agreed!');
      loadOrders();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Customer Marketplace 🏗️</Text>
          <Text style={styles.headerSub}>Post requirements, track lorry live & Walkie-Talkie</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="No Active Material Orders"
          description="Tap + to post a material requirement (e.g. 10 Tons Sand)"
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {orders.map((o) => {
            const statusConfig = {
              requirement_posted: { label: '📝 Requirement Posted', bg: '#FEF9C3', text: '#854D0E' },
              rate_quoted: { label: '💰 Quarry Rate Quoted', bg: '#EFF6FF', text: '#1D4ED8' },
              rate_agreed: { label: '🤝 Rate Agreed', bg: '#DCFCE7', text: '#16A34A' },
              bidding_active: { label: '🚚 Lorry Bidding Active', bg: '#F3E8FF', text: '#6B21A8' },
              driver_assigned: { label: '🚚 Lorry Assigned', bg: '#E0F2FE', text: '#0369A1' },
              loaded: { label: '📦 Material Loaded at Quarry', bg: '#FEF08A', text: '#713F12' },
              in_transit: { label: '🛣️ Lorry In Transit to Site', bg: '#DBEAFE', text: '#1E40AF' },
              delivered: { label: '✅ Delivered & Complete', bg: '#DCFCE7', text: '#16A34A' },
            }[o.status] || { label: o.status, bg: '#F3F4F6', text: '#374151' };

            return (
              <View key={o._id || o.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matTitle}>{o.quantity} {o.unitType} {o.materialName}</Text>
                    <Text style={styles.custMeta}>📍 Delivery Site: {o.customerAddress}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
                    <Text style={[styles.badgeText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
                  </View>
                </View>

                {/* Price Breakdown */}
                <View style={styles.priceBox}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Material Price:</Text>
                    <Text style={styles.priceVal}>{o.materialPrice > 0 ? fmtCurrency(o.materialPrice) : 'Quarry Quoting…'}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Transport Fare:</Text>
                    <Text style={styles.priceVal}>{o.transportPrice > 0 ? fmtCurrency(o.transportPrice) : 'Bidding in Progress…'}</Text>
                  </View>
                  <View style={[styles.priceRow, { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 4 }]}>
                    <Text style={[styles.priceLabel, { fontWeight: '800' }]}>Total Estimated:</Text>
                    <Text style={[styles.priceVal, { fontWeight: '800', color: Colors.primary }]}>{fmtCurrency(o.totalPrice || o.materialPrice)}</Text>
                  </View>
                </View>

                {/* Driver Info if assigned */}
                {o.driverName ? (
                  <View style={styles.driverPill}>
                    <Ionicons name="car-sport" size={18} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverName}>Lorry: {o.driverName} ({o.vehicleNo || 'TN 38 AB 1234'})</Text>
                      <Text style={styles.driverPhone}>📱 {o.driverPhone || '9876543210'}</Text>
                    </View>
                    <TouchableOpacity style={styles.trackMapBtn} onPress={() => router.push('/live-tracking')}>
                      <Ionicons name="map-outline" size={14} color="#FFF" />
                      <Text style={styles.trackMapText}>Live Map</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Actions Bar */}
                <View style={styles.actionsBar}>
                  {o.status === 'rate_quoted' && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#DCFCE7' }]} onPress={() => handleAgreeRate(o)}>
                      <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                      <Text style={[styles.actionText, { color: '#16A34A' }]}>Agree Rate ({fmtCurrency(o.materialPrice)})</Text>
                    </TouchableOpacity>
                  )}

                  {/* 3-Way Walkie Talkie button */}
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#F5F3FF' }]}
                    onPress={() => {
                      setWalkiePeer({ name: o.driverName ? `Lorry ${o.driverName}` : 'Quarry Owner', role: o.driverName ? 'driver' : 'quarry_owner', id: o.driverId || 'admin' });
                      setWalkieModalVisible(true);
                    }}
                  >
                    <Ionicons name="radio-outline" size={16} color="#7C3AED" />
                    <Text style={[styles.actionText, { color: '#7C3AED' }]}>Walkie-Talkie</Text>
                  </TouchableOpacity>

                  {/* Shared Documents button */}
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#EFF6FF' }]}
                    onPress={() => {
                      setSelectedOrderForDoc(o);
                      setDocModalVisible(true);
                    }}
                  >
                    <Ionicons name="document-text-outline" size={16} color="#2563EB" />
                    <Text style={[styles.actionText, { color: '#2563EB' }]}>Documents ({(o.documents || []).length})</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Post Requirement Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Material Requirement</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: Spacing.lg }}>
              <Input label="Your Name / Construction Company" value={customerName} onChangeText={setCustomerName} placeholder="e.g. Anand Construction" />
              <Input label="Contact Mobile Number" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" placeholder="e.g. 9876543210" />
              <Input label="Material Type Required" value={materialName} onChangeText={setMaterialName} placeholder="e.g. River Sand, M-Sand, Blue Metal" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="10" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Unit" value={unitType} onChangeText={setUnitType} placeholder="ton / unit" />
                </View>
              </View>

              <Input label="Delivery Site Address" value={customerAddress} onChangeText={setCustomerAddress} placeholder="Detailed site delivery location" />

              <Button title="🚀 Post Requirement to Quarries" onPress={handlePostRequirement} loading={saving} style={{ marginTop: 12 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Walkie-Talkie Modal */}
      <WalkieTalkieModal
        visible={walkieModalVisible}
        onClose={() => setWalkieModalVisible(false)}
        peerName={walkiePeer.name}
        peerRole={walkiePeer.role}
        peerId={walkiePeer.id}
      />

      {/* Documents Modal */}
      <DocumentUploadModal
        visible={docModalVisible}
        onClose={() => setDocModalVisible(false)}
        orderId={selectedOrderForDoc?._id || selectedOrderForDoc?.id}
        documents={selectedOrderForDoc?.documents || []}
        uploaderName="Customer"
        onUploaded={loadOrders}
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
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  matTitle: { ...Typography.h2, color: Colors.text },
  custMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  priceBox: { backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.md, padding: Spacing.md, gap: 3, marginVertical: 8 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { ...Typography.caption, color: Colors.textSecondary },
  priceVal: { ...Typography.captionSemibold, color: Colors.text },
  driverPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginVertical: 6,
  },
  driverName: { ...Typography.bodyMedium, color: Colors.primary, fontWeight: '700' },
  driverPhone: { ...Typography.caption, color: Colors.textSecondary },
  trackMapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 5 },
  trackMapText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  actionsBar: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: BorderRadius.sm },
  actionText: { fontSize: 11, fontWeight: '700' },
  // Modal
  modalContent: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { ...Typography.h2, color: Colors.text },
});
