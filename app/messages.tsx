// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Linking, Platform, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import {
  getDatabase, getUniversalContacts, getUniversalMessages, sendUniversalMessage,
  editUniversalMessage, deleteUniversalMessage, getSharedThreadKey, getEntityId,
} from '../src/database/db';

import { useWindowDimensions } from 'react-native';

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, role, quarryId } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [chatInput, setChatInput] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // New Chat Directory Modal State
  const [newChatModalVisible, setNewChatModalVisible] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState([]);

  const myName = user?.name || user?.owner_name || (role === 'admin' ? 'Admin' : role === 'driver' ? 'Driver' : 'User');
  const myRole = role || 'quarry_owner';

  const handleOpenNewChatModal = async () => {
    try {
      const db = await getDatabase();
      const { webGet } = require('../src/database/db');
      const quarries = (webGet('bf_quarries') || []).map(q => ({
        id: `quarry_${q.id}`,
        quarry_id: q.id,
        name: q.name || 'Quarry',
        subtext: `Quarry Owner • ${q.location || 'Tamil Nadu'}`,
        phone: q.phone || '9894698049',
        role: 'quarry_owner',
        avatarIcon: 'business',
        badgeBg: '#E8F5E9',
        badgeColor: '#2E7D32',
      }));

      const drivers = (webGet('bf_drivers') || []).map(d => ({
        id: `driver_${d.phone || d.id}`,
        driver_id: d.id,
        name: `${d.name} (${d.vehicle_no || 'Lorry'})`,
        subtext: `Fleet Driver • Phone: ${d.phone}`,
        phone: d.phone,
        role: 'driver',
        avatarIcon: 'car-sport',
        badgeBg: '#E3F2FD',
        badgeColor: '#1565C0',
      }));

      const customers = (webGet('bf_global_customers') || []).map(c => ({
        id: `customer_${c.phone || c.id}`,
        name: c.name,
        subtext: `Customer • Phone: ${c.phone}`,
        phone: c.phone,
        role: 'customer',
        avatarIcon: 'person',
        badgeBg: '#F3E8FF',
        badgeColor: '#9333EA',
      }));

      const admins = [{
        id: 'admin',
        name: 'Platform Admin',
        subtext: 'System Administrator',
        phone: 'admin',
        role: 'admin',
        avatarIcon: 'shield-checkmark',
        badgeBg: '#FEF2F2',
        badgeColor: '#DC2626',
      }];

      setDirectoryUsers([...quarries, ...drivers, ...customers, ...admins]);
      setNewChatModalVisible(true);
    } catch (e) {}
  };

  const handleSelectDirectoryUser = (u) => {
    setNewChatModalVisible(false);
    setActiveContact(u);
    if (isMobile) setShowMobileChat(true);
  };


  const loadContacts = useCallback(async () => {
    try {
      const db = await getDatabase();
      const list = await getUniversalContacts(db, myRole, quarryId, user);
      setContacts(list);
      if (list.length > 0 && !activeContact) {
        setActiveContact(list[0]);
      }
    } catch (e) {
      console.error('Error loading contacts:', e);
    } finally {
      setLoading(false);
    }
  }, [myRole, quarryId, user, activeContact]);


  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const currentUserObj = { role: myRole, quarryId, phone: user?.phone };

  const loadMessages = useCallback(async (targetContact) => {
    if (!targetContact) return;
    try {
      const db = await getDatabase();
      const list = await getUniversalMessages(db, targetContact, currentUserObj);
      setMessages(list);
    } catch (e) {
      console.error('Error loading messages:', e);
    }
  }, [myRole, quarryId, user?.phone]);

  useEffect(() => {
    if (activeContact) {
      loadMessages(activeContact);

      // Real-time broadcast channel listener across browser windows/tabs
      let bc;
      try {
        if (typeof window !== 'undefined' && window.BroadcastChannel) {
          bc = new window.BroadcastChannel('billforge_chat');
          bc.onmessage = (event) => {
            if (event.data?.type === 'NEW_MESSAGE' || event.data?.type === 'NEW_ENQUIRY') {
              loadMessages(activeContact);
              loadContacts();
            }
          };
        }
      } catch (e) {}

      // Storage event listener fallback
      const handleStorageChange = () => {
        loadMessages(activeContact);
      };
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorageChange);
      }

      const interval = setInterval(() => {
        loadMessages(activeContact);
      }, 2000);

      return () => {
        clearInterval(interval);
        if (bc) bc.close();
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.removeEventListener('storage', handleStorageChange);
        }
      };
    }
  }, [activeContact, loadMessages]);

  const handleShareLocation = async () => {
    if (!activeContact) return;
    try {
      if (!navigator.geolocation) {
        Alert.alert('Error', 'Geolocation is not supported by your browser.');
        return;
      }
      setSending(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const locMsg = `📍 My Current Location\nLatitude: ${lat}\nLongitude: ${lng}\nhttps://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
          
          const db = await getDatabase();
          await sendUniversalMessage(db, currentUserObj, activeContact, locMsg);
          await loadMessages(activeContact);
          setSending(false);
        },
        (err) => {
          Alert.alert('Error', `Location access denied: ${err.message}`);
          setSending(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    } catch (e) {
      setSending(false);
      Alert.alert('Error', 'Failed to share location.');
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeContact) return;
    setSending(true);
    try {
      const db = await getDatabase();
      const threadKey = getSharedThreadKey(activeContact, currentUserObj);
      if (editingMessage) {
        await editUniversalMessage(db, editingMessage.id, chatInput.trim(), threadKey);
        setEditingMessage(null);
      } else {
        await sendUniversalMessage(db, activeContact, myRole, myName, chatInput.trim(), currentUserObj);
      }
      setChatInput('');
      await loadMessages(activeContact);
    } catch (e) {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMessage(msg);
    setChatInput(msg.text || '');
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setChatInput('');
  };

  const handleDeleteMessage = async (msg) => {
    if (!activeContact) return;
    try {
      const db = await getDatabase();
      const threadKey = getSharedThreadKey(activeContact, currentUserObj);
      await deleteUniversalMessage(db, msg.id, threadKey);
      await loadMessages(activeContact);
    } catch (e) {
      Alert.alert('Error', 'Failed to delete message.');
    }
  };

  const openWhatsAppDirect = (phone, textMessage = '') => {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const num = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${num}?text=${encodeURIComponent(textMessage || 'Hello from BillForge Application!')}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open WhatsApp application on this device.');
    });
  };

  const filteredContacts = contacts.filter((c) => {
    if (!c) return false;
    const nameStr = (c.name || '').toLowerCase();
    const subStr = (c.subtext || '').toLowerCase();
    const phoneStr = String(c.phone || '');
    const query = (searchQuery || '').toLowerCase();
    const matchesSearch = nameStr.includes(query) || subStr.includes(query) || phoneStr.includes(query);
    if (roleFilter === 'all') return matchesSearch;
    if (roleFilter === 'group') return matchesSearch && (c.isGroup || c.role === 'group');
    return matchesSearch && c.role === roleFilter;
  });

  const handleSelectContact = (c) => {
    if (!c) return;
    setActiveContact(c);
    if (isMobile) {
      setShowMobileChat(true);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top Bar Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>Messages & Live Chat</Text>
          <Text style={styles.topSub}>Connect with Quarry Owners, Transporters, Customers & Admin</Text>
        </View>
        <TouchableOpacity
          style={styles.waHeaderBtn}
          onPress={() => openWhatsAppDirect(activeContact?.phone || '9894698049')}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
          <Text style={styles.waBtnText}>WhatsApp Hub</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Left Contacts Sidebar */}
        {(!isMobile || !showMobileChat) && (
          <View style={[styles.sidebar, isMobile && { width: '100%' }]}>
            {/* Search Input & New Chat Button */}
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12, alignItems: 'center' }}>
              <View style={[styles.searchBox, { flex: 1, marginHorizontal: 0, marginTop: 0 }]}>
                <Ionicons name="search" size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Filter active chats..."
                  placeholderTextColor={Colors.textDisabled}
                />
              </View>
              <TouchableOpacity
                style={{ backgroundColor: '#2563EB', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                onPress={() => handleOpenNewChatModal()}
              >
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>New Chat</Text>
              </TouchableOpacity>
            </View>


            {/* Role Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'group', label: 'Groups 👥' },
                { id: 'quarry_owner', label: 'Quarries 🏢' },
                { id: 'driver', label: 'Drivers 🚛' },
                { id: 'customer', label: 'Buyers 👷' },
                { id: 'admin', label: 'Admin 🛡️' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterChip, roleFilter === f.id && styles.filterChipActive]}
                  onPress={() => setRoleFilter(f.id)}
                >
                  <Text style={[styles.filterText, roleFilter === f.id && styles.filterTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Contacts List */}
            {loading ? (
              <ActivityIndicator style={{ marginTop: 30 }} color="#2E7D32" />
            ) : (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {filteredContacts.map((c) => {
                  if (!c) return null;
                  const isSelected = activeContact?.id === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id || `contact-${Math.random()}`}
                      style={[styles.contactCard, isSelected && styles.contactCardSelected]}
                      onPress={() => handleSelectContact(c)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.avatar, { backgroundColor: c.badgeBg || '#E8F5E9', position: 'relative' }]}>
                        <Ionicons name={c.avatarIcon || 'person'} size={20} color={c.badgeColor || '#2E7D32'} />
                        <View style={styles.onlineBadgeDot} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactName} numberOfLines={1}>{c.name || 'Contact'}</Text>
                        <Text style={styles.contactSub} numberOfLines={1}>{c.subtext || ''}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={isSelected ? Colors.primary : Colors.textDisabled} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}


        {/* Right Chat Main Area */}
        {(!isMobile || showMobileChat) && (
          <View style={[styles.chatArea, isMobile && { flex: 1, width: '100%' }]}>
            {activeContact ? (
              <>
                {/* Chat Header */}
                <View style={styles.chatHeader}>
                  {isMobile && (
                    <TouchableOpacity style={{ paddingRight: 8 }} onPress={() => setShowMobileChat(false)}>
                      <Ionicons name="arrow-back" size={22} color={Colors.navy} />
                    </TouchableOpacity>
                  )}
                  <View style={[styles.avatar, { backgroundColor: activeContact.badgeBg, position: 'relative' }]}>
                    <Ionicons name={activeContact.avatarIcon || 'person'} size={22} color={activeContact.badgeColor} />
                    <View style={styles.onlineBadgeDot} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.activeTitle}>{activeContact.name}</Text>
                      <View style={styles.onlinePill}>
                        <Text style={styles.onlinePillText}>Online</Text>
                      </View>
                    </View>
                    <Text style={styles.activeSub}>{activeContact.subtext} • Phone: {activeContact.phone}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.openWaCardBtn}
                    onPress={() => openWhatsAppDirect(activeContact.phone, `Hi ${activeContact.name}, reaching out via BillForge application!`)}
                  >
                    <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                    <Text style={styles.openWaText}>Chat on WhatsApp</Text>
                  </TouchableOpacity>
                </View>

              {/* Messages Stream */}
              <ScrollView
                style={styles.msgFeed}
                contentContainerStyle={{ padding: 16, gap: 10 }}
                showsVerticalScrollIndicator={false}
              >
                {messages.map((m) => {
                  const myEntityId = getEntityId(currentUserObj);
                  const isMe = Boolean(
                    (myEntityId && String(m.sender_id) === String(myEntityId)) ||
                    (user?.phone && m.sender_phone && String(m.sender_phone).replace(/\D/g, '') === String(user.phone).replace(/\D/g, ''))
                  );

                  const isSystem = m.sender_role === 'system' || m.sender === 'system';

                  if (isSystem) {
                    return (
                      <View key={m.id} style={styles.systemBanner}>
                        <Ionicons name="information-circle-outline" size={16} color="#818CF8" />
                        <Text style={styles.systemText}>{m.text}</Text>
                      </View>
                    );
                  }

                  const displayName = isMe ? 'You' : (m.sender_name || activeContact.name || 'Contact');

                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.bubbleWrap,
                        isMe ? styles.bubbleRight : styles.bubbleLeft,
                        m.isDeleted && styles.bubbleDeleted,
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 12 }}>
                        <Text style={[styles.senderName, isMe ? { color: '#E0E7FF' } : { color: '#818CF8' }]}>
                          {displayName}
                        </Text>

                        {isMe && !m.isDeleted && (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity onPress={() => handleStartEdit(m)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Ionicons name="pencil-outline" size={13} color="#CBD5E1" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteMessage(m)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Ionicons name="trash-outline" size={13} color="#FB7185" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                      
                      <Text style={[styles.bubbleText, isMe ? { color: '#FFFFFF' } : { color: '#1a1a1a' }, m.isDeleted && styles.deletedText]}>
                        {m.isDeleted ? '🚫 This message was deleted' : m.text}
                      </Text>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 6 }}>
                        {m.isEdited && !m.isDeleted && (
                          <Text style={styles.editedTag}>✏️ edited</Text>
                        )}
                        <Text style={[styles.timeStamp, isMe ? { color: '#E0E7FF' } : { color: '#94A3B8' }]}>
                          {new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {isMe && !m.isDeleted && (
                          m.status === 'read' ? <Ionicons name="checkmark-done" size={16} color="#38BDF8" />
                          : m.status === 'delivered' ? <Ionicons name="checkmark-done" size={16} color="#CBD5E1" />
                          : <Ionicons name="checkmark" size={16} color="#CBD5E1" />
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Editing Banner indicator */}
              {editingMessage && (
                <View style={styles.editingBanner}>
                  <Ionicons name="pencil" size={14} color="#E57025" />
                  <Text style={styles.editingBannerText} numberOfLines={1}>
                    Editing message: "{editingMessage.text}"
                  </Text>
                  <TouchableOpacity onPress={handleCancelEdit}>
                    <Ionicons name="close-circle" size={18} color="#666" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Chat Input Bar */}
              <View style={styles.inputBar}>
                <TouchableOpacity
                  style={styles.locationBtn}
                  onPress={handleShareLocation}
                  disabled={sending}
                >
                  <Ionicons name="location" size={18} color="#FFF" />
                </TouchableOpacity>

                <TextInput
                  style={styles.msgInput}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder={editingMessage ? 'Edit your message...' : `Type message to ${activeContact.name}...`}
                  placeholderTextColor={Colors.textDisabled}
                  onSubmitEditing={handleSendMessage}
                />

                <TouchableOpacity
                  style={[styles.sendBtn, sending && { opacity: 0.6 }]}
                  onPress={handleSendMessage}
                  disabled={sending}
                >
                  {sending ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name={editingMessage ? 'checkmark' : 'send'} size={16} color="#FFF" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.waSendBtn}
                  onPress={() => openWhatsAppDirect(activeContact.phone, chatInput.trim() || `Hello ${activeContact.name}`)}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>

            </>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textDisabled} />
              <Text style={styles.emptyTitle}>Select a Contact</Text>
              <Text style={styles.emptySub}>Choose a Quarry Owner, Driver, Customer or Admin from the left list to start instant messaging.</Text>
            </View>
          )}
        </View>
      )}
    </View>


    {/* New Chat Directory Modal */}
    <Modal visible={newChatModalVisible} animationType="slide" transparent onRequestClose={() => setNewChatModalVisible(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <View style={{ width: '100%', maxWidth: 460, backgroundColor: '#FFF', borderRadius: 16, padding: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.navy }}>Start New Chat / Search Users</Text>
            <TouchableOpacity onPress={() => setNewChatModalVisible(false)}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
            Select a registered Quarry, Transporter, or Buyer to initiate a new direct conversation.
          </Text>

          <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 8 }}>
            {directoryUsers.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8, gap: 10, borderWidth: 1, borderColor: '#E2E8F0' }}
                onPress={() => handleSelectDirectoryUser(u)}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: u.badgeBg || '#E8F5E9', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={u.avatarIcon || 'person'} size={18} color={u.badgeColor || '#2E7D32'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.navy }}>{u.name}</Text>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary }}>{u.subtext}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topTitle: { fontSize: 17, fontWeight: '800', color: Colors.navy },
  topSub: { fontSize: 11, color: Colors.textSecondary },
  waHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  waBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },

  container: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 340,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    margin: 12,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text },
  filterScroll: { maxHeight: 36, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' },
  filterText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: '#2E7D32', fontWeight: '700' },

  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  contactCardSelected: { backgroundColor: Colors.primarySurface },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineBadgeDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  onlinePill: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  onlinePillText: { fontSize: 9, fontWeight: '800', color: '#2E7D32' },
  contactName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  contactSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  chatArea: { flex: 1, backgroundColor: '#E5DDD5' },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  activeTitle: { fontSize: 15, fontWeight: '800', color: Colors.navy },
  activeSub: { fontSize: 11, color: Colors.textSecondary },
  openWaCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCF8C6',
    borderWidth: 1,
    borderColor: '#25D366',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  openWaText: { fontSize: 11, fontWeight: '700', color: '#075E54' },

  msgFeed: { flex: 1 },
  systemBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginVertical: 6,
    gap: 6,
  },
  systemText: { fontSize: 11, color: '#1565C0', fontWeight: '500' },

  bubbleWrap: {
    maxWidth: '75%',
    padding: 10,
    borderRadius: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bubbleLeft: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF' },
  bubbleRight: { alignSelf: 'flex-end', backgroundColor: '#DCF8C6' },
  bubbleDeleted: { backgroundColor: '#F1F5F9', opacity: 0.8 },
  senderName: { fontSize: 10, fontWeight: '800', marginBottom: 2 },
  bubbleText: { fontSize: 13, color: '#000', lineHeight: 18 },
  deletedText: { fontStyle: 'italic', color: '#64748B' },
  editedTag: { fontSize: 9, fontStyle: 'italic', color: '#64748B', marginRight: 4 },
  timeStamp: { fontSize: 9, color: '#777', alignSelf: 'flex-end', marginTop: 4 },

  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#FFD8BE',
    gap: 8,
  },
  editingBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#E57025',
    fontWeight: '600',
  },

  inputBar: {

    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 8,
  },
  msgInput: {
    flex: 1,
    height: 42,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E57025',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#075E54',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: Colors.surface },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 12 },
  emptySub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, maxWidth: 320 },
});
