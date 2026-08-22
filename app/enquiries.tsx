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
import {
  getDatabase, getEnquiries, saveEnquiry, getDrivers, saveConsignment,
  getQuarryChats, getChatMessages, sendChatMessage, saveConsignmentDocument, getGlobalDrivers,
} from '../src/database/db';
import { useAuth } from '../src/context/AuthContext';

function fmtCurrency(n) {
  if (!n && n !== 0) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

export default function EnquiriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { quarryId, user } = useAuth();
  const activeQuarryId = quarryId || 1;

  const [enquiries, setEnquiries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [saving, setSaving] = useState(false);

  // eWay Bill Doc Modal
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [docConsignmentId, setDocConsignmentId] = useState(null);
  const [docName, setDocName] = useState('eWay Bill #EW-98231');
  const [docContent, setDocContent] = useState('Govt eWay Bill No: 8231-9012-4412 | Vehicle: TN 38 AB 1234');
  const [savingDoc, setSavingDoc] = useState(false);

  // Chat Modal State
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [activeChatPhone, setActiveChatPhone] = useState(null);
  const [activeChatName, setActiveChatName] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const list = await getEnquiries(db, activeQuarryId);
      const localDrivers = await getDrivers(db, activeQuarryId);
      const globalDrivers = await getGlobalDrivers(db);
      
      // Combine local and global drivers, avoiding duplicates
      const driverMap = new Map();
      localDrivers.forEach(d => driverMap.set(d.id, { ...d, isLocal: true }));
      globalDrivers.forEach(d => {
        if (!driverMap.has(d.id)) {
          driverMap.set(d.id, { ...d, isLocal: false });
        }
      });
      const combinedDrivers = Array.from(driverMap.values());
      
      const chatIndex = await getQuarryChats(db, activeQuarryId);
      setEnquiries(list);
      setDrivers(combinedDrivers);
      setChats(chatIndex);
    } catch (e) {
      console.error('Enquiries load error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeQuarryId]);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [materialName, setMaterialName] = useState('River Sand');
  const [quantity, setQuantity] = useState('1');
  const [unitType, setUnitType] = useState('ton');
  const [quotedRate, setQuotedRate] = useState('');
  const [pickupAddress, setPickupAddress] = useState('Quarry Yard 1');
  const [customerAddress, setCustomerAddress] = useState('Customer Site');

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleCreateEnquiry = async () => {
    if (!customerName.trim() || !materialName.trim() || !quotedRate) {
      Alert.alert('Error', 'Please fill customer name, material name, and rate.');
      return;
    }
    setSaving(true);
    try {
      const db = await getDatabase();
      await saveEnquiry(db, {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        material_name: materialName.trim(),
        quantity: parseFloat(quantity) || 1,
        unit_type: unitType,
        quoted_rate: parseFloat(quotedRate) || 0,
        agreed_rate: parseFloat(quotedRate) || 0,
        status: 'pending',
        pickup_address: pickupAddress.trim(),
        customer_address: customerAddress.trim(),
      });

      // Trigger Real-Time Notification & Live Broadcast
      try {
        const { broadcastRealtimeEvent } = require('../src/services/realtimeService');
        broadcastRealtimeEvent('NEW_ENQUIRY', {
          customer_name: customerName.trim(),
          material: materialName.trim(),
          quantity: quantity,
          pickup: pickupAddress.trim(),
          delivery: customerAddress.trim(),
        });
      } catch (e) {}

      setModalVisible(false);
      resetForm();
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to save enquiry.');
    } finally {
      setSaving(false);
    }
  };

  const openChatModal = async (phone: string, name: string) => {
    setActiveChatPhone(phone);
    setActiveChatName(name || phone);
    setChatModalVisible(true);
    await loadChatMessages(phone);
  };

  const loadChatMessages = async (phone: string) => {
    try {
      const db = await getDatabase();
      const msgs = await getChatMessages(db, activeQuarryId, phone);
      setChatMessages(msgs);
    } catch (e) {}
  };

  const handleSendOwnerMessage = async () => {
    if (!chatInput.trim() || !activeChatPhone) return;
    const msgText = chatInput.trim();
    setSendingChat(true);
    try {
      const db = await getDatabase();
      await sendChatMessage(db, activeQuarryId, activeChatPhone, 'owner', user?.name || 'Quarry Owner', msgText);

      try {
        const { broadcastRealtimeEvent } = require('../src/services/realtimeService');
        broadcastRealtimeEvent('CHAT_MESSAGE', {
          sender_name: user?.name || 'Quarry Owner',
          text: msgText,
          phone: activeChatPhone,
        });
      } catch (e) {}

      setChatInput('');
      await loadChatMessages(activeChatPhone);

    } catch (e) {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSendingChat(false);
    }
  };

  const handleAttachEwayBill = async (consignmentId: number) => {
    setDocConsignmentId(consignmentId);
    setDocModalVisible(true);
  };

  const handleSaveDoc = async () => {
    if (!docConsignmentId || !docName.trim()) return;
    setSavingDoc(true);
    try {
      const db = await getDatabase();
      await saveConsignmentDocument(db, docConsignmentId, activeQuarryId, docName.trim(), 'eWay Bill', docContent.trim());
      Alert.alert('Legal Document Attached 📄', 'eWay Bill / Transport Document attached successfully! The assigned driver can view it in their portal.');
      setDocModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to attach document.');
    } finally {
      setSavingDoc(false);
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setMaterialName('River Sand');
    setQuantity('1');
    setQuotedRate('');
  };

  const handleAgreeEnquiry = async (enquiry) => {
    const db = await getDatabase();
    await saveEnquiry(db, { ...enquiry, status: 'agreed' });
    loadData();
  };

  const handleAssignDriver = async () => {
    if (!selectedEnquiry || !selectedDriverId) {
      Alert.alert('Select Driver', 'Please choose a driver to assign.');
      return;
    }
    setSaving(true);
    try {
      const db = await getDatabase();
      const driver = drivers.find(d => d.id === selectedDriverId);
      
      await saveConsignment(db, {
        enquiry_id: selectedEnquiry.id,
        driver_id: driver.id,
        driver_name: driver.name,
        customer_name: selectedEnquiry.customer_name,
        customer_phone: selectedEnquiry.customer_phone,
        material_name: selectedEnquiry.material_name,
        quantity: selectedEnquiry.quantity,
        unit_type: selectedEnquiry.unit_type,
        agreed_rate: selectedEnquiry.agreed_rate || selectedEnquiry.quoted_rate,
        pickup_address: selectedEnquiry.pickup_address,
        pickup_lat: selectedEnquiry.pickup_lat || 10.9601,
        pickup_lng: selectedEnquiry.pickup_lng || 78.0766,
        customer_address: selectedEnquiry.customer_address,
        customer_lat: selectedEnquiry.customer_lat || 11.0168,
        customer_lng: selectedEnquiry.customer_lng || 76.9558,
        status: 'assigned',
      });

      await saveEnquiry(db, { ...selectedEnquiry, status: 'assigned' });

      setAssignModalVisible(false);
      setSelectedEnquiry(null);
      Alert.alert('Success 🎉', `Consignment assigned to driver ${driver.name}.`);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to assign consignment.');
    } finally {
      setSaving(false);
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
          <Text style={styles.headerTitle}>Material Rate Enquiries</Text>
          <Text style={styles.headerSub}>Manage rates, agreements & driver dispatch</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : enquiries.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="No rate enquiries yet"
          description="Create a rate enquiry (e.g. 1 Ton Sand) when a customer calls"
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {enquiries.map((e) => {
            const statusConfig = {
              pending: { label: '⏳ Rate Quoted', bg: '#FEF9C3', text: '#854D0E' },
              agreed: { label: '🤝 Price Agreed', bg: '#DCFCE7', text: '#16A34A' },
              assigned: { label: '🚚 Driver Assigned', bg: '#EFF6FF', text: '#1D4ED8' },
            }[e.status] || { label: e.status, bg: '#F3F4F6', text: '#4B5563' };

            return (
              <View key={e.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.custName}>{e.customer_name}</Text>
                    <Text style={styles.custPhone}>📱 {e.customer_phone || 'No phone'}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: statusConfig.bg }]}>
                    <Text style={[styles.badgeText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
                  </View>
                </View>

                <View style={styles.detailBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Material:</Text>
                    <Text style={styles.detailVal}>🏗️ {e.quantity} {e.unit_type} {e.material_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Quoted Rate:</Text>
                    <Text style={[styles.detailVal, { color: Colors.primary, fontWeight: '700' }]}>
                      {fmtCurrency(e.quoted_rate)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Pickup:</Text>
                    <Text style={styles.detailVal}>📍 {e.pickup_address}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer Site:</Text>
                    <Text style={styles.detailVal}>🏁 {e.customer_address}</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  {e.customer_phone ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#E3F2FD' }]}
                      onPress={() => openChatModal(e.customer_phone, e.customer_name)}
                    >
                      <Ionicons name="chatbubbles-outline" size={16} color="#1565C0" />
                      <Text style={[styles.actionText, { color: '#1565C0' }]}>Chat with Customer</Text>
                    </TouchableOpacity>
                  ) : null}

                  {e.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#DCFCE7' }]}
                      onPress={() => handleAgreeEnquiry(e)}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                      <Text style={[styles.actionText, { color: '#16A34A' }]}>Mark Price Agreed</Text>
                    </TouchableOpacity>
                  )}
                  {e.status === 'agreed' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.primarySurface, flex: 1 }]}
                      onPress={() => {
                        setSelectedEnquiry(e);
                        setSelectedDriverId(drivers[0]?.id || null);
                        setAssignModalVisible(true);
                      }}
                    >
                      <Ionicons name="person-add" size={16} color={Colors.primary} />
                      <Text style={[styles.actionText, { color: Colors.primary }]}>Assign Driver</Text>
                    </TouchableOpacity>
                  )}
                  {e.status === 'assigned' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#FFF3E0' }]}
                      onPress={() => handleAttachEwayBill(e.id)}
                    >
                      <Ionicons name="document-text-outline" size={16} color="#E65100" />
                      <Text style={[styles.actionText, { color: '#E65100' }]}>Attach eWay Bill</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {/* Active Customer Chats */}
          {chats.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Customer Live Chats ({chats.length})</Text>
              {chats.map(c => (
                <TouchableOpacity key={c.customer_phone} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderLight, gap: 10 }} onPress={() => openChatModal(c.customer_phone, c.customer_name)}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person" size={18} color="#1565C0" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.navy }}>{c.customer_name}</Text>
                    <Text style={{ fontSize: 12, color: Colors.textSecondary }}>Phone: {c.customer_phone}</Text>
                  </View>
                  <View style={{ backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="chatbubbles" size={14} color="#1565C0" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1565C0' }}>Open Chat</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* New Enquiry Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Rate Enquiry</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: Spacing.lg }}>
              <Input label="Customer Name" value={customerName} onChangeText={setCustomerName} placeholder="e.g. Anand Builders" />
              <Input label="Customer Phone" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" placeholder="e.g. 9876543210" />
              <Input label="Material Name" value={materialName} onChangeText={setMaterialName} placeholder="e.g. River Sand, M-Sand" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Unit" value={unitType} onChangeText={setUnitType} placeholder="ton / unit" />
                </View>
              </View>

              <Input label="Quoted Rate (₹)" value={quotedRate} onChangeText={setQuotedRate} keyboardType="numeric" placeholder="e.g. 3200" />
              <Input label="Pickup Address / Quarry" value={pickupAddress} onChangeText={setPickupAddress} placeholder="Quarry address" />
              <Input label="Customer Delivery Location" value={customerAddress} onChangeText={setCustomerAddress} placeholder="Customer site address" />

              <Button title="Save Enquiry" onPress={handleCreateEnquiry} loading={saving} style={{ marginTop: 12 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assign Driver Modal */}
      <Modal visible={assignModalVisible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Assign Driver & Transport Negotiation</Text>
            <Text style={styles.dialogSub}>Select an available driver or chat to negotiate transport rates for {selectedEnquiry?.customer_name}</Text>

            <ScrollView style={{ maxHeight: 220, marginVertical: 12 }}>
              {drivers.map(d => (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.driverRow, 
                    selectedDriverId === d.id && styles.driverRowActive, 
                    { flexDirection: 'row', alignItems: 'center' }
                  ]}
                  onPress={() => setSelectedDriverId(d.id)}
                >
                  <Ionicons name="person-circle" size={26} color={selectedDriverId === d.id ? Colors.primary : Colors.textSecondary} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.driverName, selectedDriverId === d.id && { color: Colors.primary }]}>
                      {d.name} {d.isLocal ? '(In-house)' : '(External/Transport)'}
                    </Text>
                    <Text style={styles.driverMeta}>Vehicle: {d.vehicle_no || 'Lorry'} • Mobile: {d.phone}</Text>
                  </View>
                  <TouchableOpacity
                    style={{ backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 }}
                    onPress={() => {
                      setAssignModalVisible(false);
                      router.push('/messages');
                    }}
                  >
                    <Ionicons name="chatbubbles" size={14} color="#1565C0" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#1565C0' }}>Chat</Text>
                  </TouchableOpacity>
                  {selectedDriverId === d.id && <Ionicons name="checkmark" size={20} color={Colors.primary} style={{ marginLeft: 8 }} />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Cancel" onPress={() => setAssignModalVisible(false)} variant="ghost" style={{ flex: 1 }} />
              <Button title="Assign Now" onPress={handleAssignDriver} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Live Chat Modal */}
      <Modal visible={chatModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { height: 500 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, paddingBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.navy }}>Chat with {activeChatName}</Text>
                <Text style={{ fontSize: 11, color: Colors.textSecondary }}>Mobile: {activeChatPhone}</Text>
              </View>
              <TouchableOpacity onPress={() => setChatModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
              {chatMessages.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Ionicons name="chatbubbles-outline" size={30} color={Colors.textDisabled} />
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
                    No messages yet. Send a message to start negotiating rates!
                  </Text>
                </View>
              ) : (
                chatMessages.map((msg) => {
                  const isOwner = msg.sender === 'owner';
                  return (
                    <View key={msg.id} style={[{ marginBottom: 8, maxWidth: '80%', padding: 10, borderRadius: 10 }, isOwner ? { alignSelf: 'flex-end', backgroundColor: Colors.primarySurface } : { alignSelf: 'flex-start', backgroundColor: Colors.backgroundSecondary }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: isOwner ? Colors.primary : Colors.text, marginBottom: 2 }}>{msg.sender_name}</Text>
                      <Text style={{ fontSize: 13, color: Colors.text }}>{msg.text}</Text>
                      <Text style={{ fontSize: 9, color: Colors.textTertiary, alignSelf: 'flex-end', marginTop: 4 }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight }}>
              <Input
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Type reply to customer..."
                style={{ flex: 1 }}
                onSubmitEditing={handleSendOwnerMessage}
              />
              <TouchableOpacity style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 6 }} onPress={handleSendOwnerMessage} disabled={sendingChat}>
                {sendingChat ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="send" size={16} color="#FFF" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Attach eWay Bill Modal */}
      <Modal visible={docModalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.navy }}>Attach Transport eWay Bill</Text>
              <TouchableOpacity onPress={() => setDocModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12 }}>
              <Input label="Document Name / Title" value={docName} onChangeText={setDocName} placeholder="eWay Bill #EW-98231" />
              <Input label="Document Content / Govt Reg Details" value={docContent} onChangeText={setDocContent} placeholder="eWay Bill details, GSTIN, Vehicle No..." multiline numberOfLines={3} />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Button title="Cancel" onPress={() => setDocModalVisible(false)} variant="ghost" style={{ flex: 1 }} />
              <Button title="Attach Document" onPress={handleSaveDoc} loading={savingDoc} style={{ flex: 1 }} />
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
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  custName: { ...Typography.bodyLargeBold, color: Colors.text },
  custPhone: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  detailBox: { backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.md, padding: Spacing.md, gap: 4, marginBottom: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { ...Typography.caption, color: Colors.textSecondary },
  detailVal: { ...Typography.captionSemibold, color: Colors.text },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.sm },
  actionText: { fontSize: 12, fontWeight: '700' },
  // Modal
  modalContent: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { ...Typography.h2, color: Colors.text },
  // Dialog
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  dialog: { width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl },
  dialogTitle: { ...Typography.h2, color: Colors.text, textAlign: 'center' },
  dialogSub: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: BorderRadius.md, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  driverRowActive: { backgroundColor: Colors.primarySurface },
  driverName: { ...Typography.bodyMedium, color: Colors.text },
  driverMeta: { ...Typography.caption, color: Colors.textSecondary },
});
