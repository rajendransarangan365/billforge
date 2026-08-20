// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Linking, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import {
  getDatabase, getUniversalContacts, getUniversalMessages, sendUniversalMessage,
} from '../src/database/db';

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, role, quarryId } = useAuth();

  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const myName = user?.name || user?.owner_name || (role === 'admin' ? 'Admin' : role === 'driver' ? 'Driver' : 'User');
  const myRole = role || 'quarry_owner';

  const loadContacts = useCallback(async () => {
    try {
      const db = await getDatabase();
      const list = await getUniversalContacts(db, myRole, quarryId);
      setContacts(list);
      if (list.length > 0 && !activeContact) {
        setActiveContact(list[0]);
      }
    } catch (e) {
      console.error('Error loading contacts:', e);
    } finally {
      setLoading(false);
    }
  }, [myRole, quarryId, activeContact]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const loadMessages = useCallback(async (contactId) => {
    if (!contactId) return;
    try {
      const db = await getDatabase();
      const list = await getUniversalMessages(db, contactId);
      setMessages(list);
    } catch (e) {
      console.error('Error loading messages:', e);
    }
  }, []);

  useEffect(() => {
    if (activeContact) {
      loadMessages(activeContact.id);
    }
  }, [activeContact, loadMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeContact) return;
    setSending(true);
    try {
      const db = await getDatabase();
      await sendUniversalMessage(db, activeContact.id, myRole, myName, chatInput.trim());
      setChatInput('');
      await loadMessages(activeContact.id);
    } catch (e) {
      Alert.alert('Error', 'Failed to send message.');
    } finally {
      setSending(false);
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
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.subtext.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.phone || '').includes(searchQuery);
    if (roleFilter === 'all') return matchesSearch;
    return matchesSearch && c.role === roleFilter;
  });

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
        <View style={styles.sidebar}>
          {/* Search Input */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search contacts..."
              placeholderTextColor={Colors.textDisabled}
            />
          </View>

          {/* Role Filter Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
            {[
              { id: 'all', label: 'All' },
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
                const isSelected = activeContact?.id === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.contactCard, isSelected && styles.contactCardSelected]}
                    onPress={() => setActiveContact(c)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.avatar, { backgroundColor: c.badgeBg || '#E8F5E9' }]}>
                      <Ionicons name={c.avatarIcon || 'person'} size={20} color={c.badgeColor || '#2E7D32'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactName} numberOfLines={1}>{c.name}</Text>
                      <Text style={styles.contactSub} numberOfLines={1}>{c.subtext}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={isSelected ? Colors.primary : Colors.textDisabled} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Right Chat Main Area */}
        <View style={styles.chatArea}>
          {activeContact ? (
            <>
              {/* Chat Header */}
              <View style={styles.chatHeader}>
                <View style={[styles.avatar, { backgroundColor: activeContact.badgeBg }]}>
                  <Ionicons name={activeContact.avatarIcon || 'person'} size={22} color={activeContact.badgeColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeTitle}>{activeContact.name}</Text>
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
                  const isMe = m.sender_role === myRole || m.sender_name === myName;
                  const isSystem = m.sender_role === 'system';

                  if (isSystem) {
                    return (
                      <View key={m.id} style={styles.systemBanner}>
                        <Ionicons name="information-circle-outline" size={16} color="#1565C0" />
                        <Text style={styles.systemText}>{m.text}</Text>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.bubbleWrap,
                        isMe ? styles.bubbleRight : styles.bubbleLeft,
                      ]}
                    >
                      <Text style={[styles.senderName, isMe ? { color: '#1B5E20' } : { color: '#1565C0' }]}>
                        {m.sender_name} ({m.sender_role || 'User'})
                      </Text>
                      <Text style={styles.bubbleText}>{m.text}</Text>
                      <Text style={styles.timeStamp}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Chat Input Bar */}
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.msgInput}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder={`Type message to ${activeContact.name}...`}
                  placeholderTextColor={Colors.textDisabled}
                  onSubmitEditing={handleSendMessage}
                />

                <TouchableOpacity
                  style={[styles.sendBtn, sending && { opacity: 0.6 }]}
                  onPress={handleSendMessage}
                  disabled={sending}
                >
                  {sending ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="send" size={16} color="#FFF" />}
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
      </View>
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
  senderName: { fontSize: 10, fontWeight: '800', marginBottom: 2 },
  bubbleText: { fontSize: 13, color: '#000', lineHeight: 18 },
  timeStamp: { fontSize: 9, color: '#777', alignSelf: 'flex-end', marginTop: 4 },

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
    borderRadius: 21,
    paddingHorizontal: 16,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
